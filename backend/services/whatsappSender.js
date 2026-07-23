const db = require('../db');
const FormData = require('form-data');

function formatPhone(phone) {
    if (!phone) return '';
    // Strip non-digits
    const cleaned = phone.replace(/\D/g, '');
    // If it's 10 digits (common for Indian numbers), assume country code 91
    if (cleaned.length === 10) {
        return '91' + cleaned;
    }
    return cleaned;
}

async function getCredentials() {
    await db.ready;
    const conn = db.get("SELECT phone_number_id, token, waba_id FROM whatsapp_connections WHERE status = 'Active' ORDER BY id DESC LIMIT 1");
    if (conn && conn.token) {
        return {
            token: conn.token,
            phoneNumberId: conn.phone_number_id,
            wabaId: conn.waba_id
        };
    }
    
    // Fallback to settings
    const token = db.get("SELECT value FROM settings WHERE key = 'whatsapp_token'")?.value;
    const phoneNumberId = db.get("SELECT value FROM settings WHERE key = 'whatsapp_phone_number_id'")?.value;
    const wabaId = db.get("SELECT value FROM settings WHERE key = 'whatsapp_business_account_id'")?.value;
    return { token, phoneNumberId, wabaId };
}

async function incrementDailyUsage(phoneNumberId) {
    const today = new Date().toISOString().split('T')[0];
    db.run(
        `INSERT INTO whatsapp_daily_usage (phone_number_id, date, messages_sent)
         VALUES (?, ?, 1)
         ON CONFLICT(phone_number_id, date) DO UPDATE SET messages_sent = messages_sent + 1`,
        [phoneNumberId, today]
    );
}

const whatsappSender = {
    async getDailyUsage(phoneNumberId) {
        await db.ready;
        const today = new Date().toISOString().split('T')[0];
        const row = db.get("SELECT messages_sent FROM whatsapp_daily_usage WHERE phone_number_id = ? AND date = ?", [phoneNumberId, today]);
        return row ? row.messages_sent : 0;
    },

    async sendText(phone, messageText) {
        try {
            // Check billing block status
            const { isBillingBlocked } = require('./billingHelper');
            const blocked = await isBillingBlocked();
            if (blocked) {
                throw new Error("WhatsApp Service Blocked: Outstanding dues have not been paid. Please complete payment in the Billing tab.");
            }

            const { isCustomerSessionActive } = require('./whatsappSessionService');
            const sessionActive = await isCustomerSessionActive(phone);
            const { getCreditBalance } = require('./billingHelper');
            const currentBal = await getCreditBalance();
            if (currentBal < 0.30) {
                throw new Error("Insufficient Wallet Credit: Please top up your wallet credit balance in the Billing tab to send WhatsApp messages.");
            }
            if (!sessionActive) {
                console.warn(`[WhatsApp Sender] CSW is inactive for ${phone}. Sending free-form text might be rejected by Meta: "${messageText.substring(0, 50)}..."`);
            }

            const { token, phoneNumberId } = await getCredentials();
            if (!token || !phoneNumberId) {
                throw new Error("WhatsApp Cloud API credentials not configured.");
            }

            const formattedTo = formatPhone(phone);
            if (!formattedTo) {
                throw new Error("Invalid phone number format.");
            }

            const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: formattedTo,
                type: "text",
                text: {
                    preview_url: false,
                    body: messageText
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                if (data.error && (data.error.code === 190 || data.error.type === 'OAuthException')) {
                    db.run("UPDATE whatsapp_connections SET status = 'Expired' WHERE token = ?", [token]);
                    throw new Error("Authentication Error: Your WhatsApp Cloud API token has expired or been invalidated by Meta. Please reconnect your account in Settings.");
                }
                throw new Error(data.error?.message || "Error sending WhatsApp message");
            }

            await incrementDailyUsage(phoneNumberId);
            db.run("UPDATE settings SET value = CAST(CAST(COALESCE((SELECT value FROM settings WHERE key = 'billing_whatsapp_non_csw_count'), '0') AS INTEGER) + 1 AS TEXT) WHERE key = 'billing_whatsapp_non_csw_count'");

            try {
                const { deductCredit } = require('./billingHelper');
                await deductCredit('WhatsApp', 1, 0.30, `WhatsApp API message sent to +${formattedTo}`);
            } catch (deductErr) {
                console.error('[WhatsApp Sender] Ledger deduction error:', deductErr);
            }

            console.log(`[WhatsApp Sender] Text message successfully sent to ${formattedTo}. Message ID: ${data.messages?.[0]?.id}`);
            return data;
        } catch (err) {
            console.error('[WhatsApp Sender] Error sending text:', err);
            throw err;
        }
    },

    async sendTemplate(phone, templateName, variables = [], buttonUrlParam = null, language = 'en') {
        try {
            // Check billing block status
            const { isBillingBlocked } = require('./billingHelper');
            const blocked = await isBillingBlocked();
            if (blocked) {
                throw new Error("WhatsApp Service Blocked: Outstanding dues have not been paid. Please complete payment in the Billing tab.");
            }

            const { isCustomerSessionActive } = require('./whatsappSessionService');
            const sessionActive = await isCustomerSessionActive(phone);
            const { getCreditBalance } = require('./billingHelper');
            const currentBal = await getCreditBalance();
            if (currentBal < 0.30) {
                throw new Error("Insufficient Wallet Credit: Please top up your wallet credit balance in the Billing tab to send WhatsApp templates.");
            }

            const { token, phoneNumberId } = await getCredentials();
            if (!token || !phoneNumberId) {
                throw new Error("WhatsApp Cloud API credentials not configured.");
            }

            const formattedTo = formatPhone(phone);
            if (!formattedTo) {
                throw new Error("Invalid phone number format.");
            }

            const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
            
            const components = [
                {
                    type: "body",
                    parameters: variables.map(val => ({
                        type: "text",
                        text: String(val)
                    }))
                }
            ];

            if (buttonUrlParam) {
                components.push({
                    type: "button",
                    sub_type: "url",
                    index: "0",
                    parameters: [
                        {
                            type: "text",
                            text: String(buttonUrlParam)
                        }
                    ]
                });
            }

            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: formattedTo,
                type: "template",
                template: {
                    name: templateName,
                    language: {
                        code: language
                    },
                    components
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                if (data.error && (data.error.code === 190 || data.error.type === 'OAuthException')) {
                    db.run("UPDATE whatsapp_connections SET status = 'Expired' WHERE token = ?", [token]);
                    throw new Error("Authentication Error: Your WhatsApp Cloud API token has expired or been invalidated by Meta. Please reconnect your account in Settings.");
                }
                throw new Error(data.error?.message || `Error sending WhatsApp template message ${templateName}`);
            }

            await incrementDailyUsage(phoneNumberId);
            db.run("UPDATE settings SET value = CAST(CAST(COALESCE((SELECT value FROM settings WHERE key = 'billing_whatsapp_non_csw_count'), '0') AS INTEGER) + 1 AS TEXT) WHERE key = 'billing_whatsapp_non_csw_count'");

            try {
                const { deductCredit } = require('./billingHelper');
                await deductCredit('WhatsApp', 1, 0.30, `WhatsApp template "${templateName}" sent to +${formattedTo}`);
            } catch (deductErr) {
                console.error('[WhatsApp Sender] Ledger deduction error:', deductErr);
            }

            console.log(`[WhatsApp Sender] Template "${templateName}" successfully sent to ${formattedTo}. Message ID: ${data.messages?.[0]?.id}`);
            return data;
        } catch (err) {
            console.error(`[WhatsApp Sender] Error sending template ${templateName}:`, err);
            throw err;
        }
    },

    async uploadMedia(pdfBuffer, filename) {
        const { token, phoneNumberId } = await getCredentials();
        if (!token || !phoneNumberId) {
            throw new Error("WhatsApp Cloud API credentials not configured.");
        }

        const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/media`;
        const form = new FormData();
        form.append('file', pdfBuffer, {
            filename: filename,
            contentType: 'application/pdf'
        });
        form.append('messaging_product', 'whatsapp');
        form.append('type', 'application/pdf');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                ...form.getHeaders()
            },
            body: form
        });

        const data = await response.json();
        if (!response.ok) {
            if (data.error && (data.error.code === 190 || data.error.type === 'OAuthException')) {
                db.run("UPDATE whatsapp_connections SET status = 'Expired' WHERE token = ?", [token]);
                throw new Error("Authentication Error: Your WhatsApp Cloud API token has expired or been invalidated by Meta. Please reconnect your account in Settings.");
            }
            throw new Error(data.error?.message || "Error uploading WhatsApp media");
        }

        return data.id; // Returns the media ID
    },

    async sendInvoicePDFDirect(phone, pdfBuffer, filename, caption = "Please find attached your invoice PDF.") {
        try {
            const { token, phoneNumberId } = await getCredentials();
            if (!token || !phoneNumberId) {
                throw new Error("WhatsApp Cloud API credentials not configured.");
            }

            const formattedTo = formatPhone(phone);
            if (!formattedTo) {
                throw new Error("Invalid phone number.");
            }

            console.log(`[WhatsApp Sender] Uploading PDF media for invoice...`);
            const mediaId = await this.uploadMedia(pdfBuffer, filename);
            console.log(`[WhatsApp Sender] Media uploaded successfully. ID: ${mediaId}`);

            const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: formattedTo,
                type: "document",
                document: {
                    id: mediaId,
                    filename: filename,
                    caption: caption
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                if (data.error && (data.error.code === 190 || data.error.type === 'OAuthException')) {
                    db.run("UPDATE whatsapp_connections SET status = 'Expired' WHERE token = ?", [token]);
                    throw new Error("Authentication Error: Your WhatsApp Cloud API token has expired or been invalidated by Meta. Please reconnect your account in Settings.");
                }
                throw new Error(data.error?.message || "Error sending WhatsApp document message");
            }

            await incrementDailyUsage(phoneNumberId);
            console.log(`[WhatsApp Sender] Invoice PDF successfully sent to ${formattedTo}. Message ID: ${data.messages?.[0]?.id}`);
            return data;
        } catch (err) {
            console.error('[WhatsApp Sender] Error sending PDF:', err);
            throw err;
        }
    },

    async sendInvoicePDF(phone, pdfBuffer, filename, caption = "Please find attached your invoice PDF.", metadata = {}) {
        try {
            const { isCustomerSessionActive } = require('./whatsappSessionService');
            const sessionActive = await isCustomerSessionActive(phone);

            // Resolve metadata details
            let customerName = metadata.customerName;
            let invoiceNumber = metadata.invoiceNumber;
            let companyName = metadata.companyName;

            // Resolve invoiceId from metadata or filename regex
            let invoiceId = metadata.invoiceId;
            if (!invoiceId) {
                const match = filename.match(/Invoice_(\d+)/i);
                if (match) {
                    invoiceId = parseInt(match[1], 10);
                }
            }

            if (!invoiceId) {
                throw new Error("Could not determine invoice ID to generate hosted link.");
            }

            // Sync invoice to public cloud DB and get sharing link
            const hostedInvoiceService = require('./hostedInvoiceService');
            const { url: invoiceUrl, token: secureToken } = await hostedInvoiceService.generateHostedInvoice(invoiceId);

            if (!customerName || !invoiceNumber || !companyName) {
                await db.ready;
                const cleanPhone = formatPhone(phone);
                
                // Find customer
                let customer = null;
                if (cleanPhone) {
                    const customers = db.all("SELECT * FROM customers WHERE phone IS NOT NULL AND phone != ''");
                    customer = customers.find(c => {
                        const dbPhone = (c.phone || '').replace(/\D/g, '');
                        return dbPhone && (dbPhone === cleanPhone || dbPhone.endsWith(cleanPhone) || cleanPhone.endsWith(dbPhone));
                    });
                }
                
                if (!customerName) {
                    customerName = customer ? customer.name : "Valued Customer";
                }
                
                if (!invoiceNumber) {
                    // Try to fetch specific invoice
                    const inv = db.get("SELECT * FROM invoices WHERE id = ?", [invoiceId]);
                    invoiceNumber = inv ? (inv.invoice_number || `#${inv.id}`) : `Invoice #${invoiceId}`;
                }
                
                if (!companyName) {
                    companyName = db.get("SELECT value FROM settings WHERE key = 'company_name'")?.value || "Quantro";
                }
            }

            if (sessionActive) {
                console.log(`[WhatsApp Sender] Active CSW exists for ${phone}. Sending free-form invoice text message with link.`);
                const messageText = `Hello ${customerName}, your invoice ${invoiceNumber} from ${companyName} is ready. View it here: ${invoiceUrl}`;
                return await this.sendText(phone, messageText);
            } else {
                console.log(`[WhatsApp Sender] No active CSW for ${phone}. Sending template message with link and URL CTA button.`);
                
                // Send approved WhatsApp utility template with body parameters
                // Variables: [customerName, invoiceNumber, companyName, invoiceUrl]
                // Dynamic button URL suffix parameter: invoice/{id}?token={token}
                const buttonUrlParam = `invoice/${invoiceId}?token=${secureToken}`;
                console.log(`[WhatsApp Sender] Sending utility template "invoice_ready" with button suffix parameter: "${buttonUrlParam}"`);
                return await this.sendTemplate(phone, "invoice_ready", [customerName, invoiceNumber, companyName, invoiceUrl], buttonUrlParam);
            }
        } catch (err) {
            console.error('[WhatsApp Sender] Error in sendInvoicePDF wrapper:', err);
            throw err;
        }
    }
};

module.exports = whatsappSender;
