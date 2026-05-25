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
                throw new Error(data.error?.message || "Error sending WhatsApp message");
            }

            await incrementDailyUsage(phoneNumberId);
            console.log(`[WhatsApp Sender] Text message successfully sent to ${formattedTo}. Message ID: ${data.messages?.[0]?.id}`);
            return data;
        } catch (err) {
            console.error('[WhatsApp Sender] Error sending text:', err);
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
            throw new Error(data.error?.message || "Error uploading WhatsApp media");
        }

        return data.id; // Returns the media ID
    },

    async sendInvoicePDF(phone, pdfBuffer, filename, caption = "Please find attached your invoice PDF.") {
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
                throw new Error(data.error?.message || "Error sending WhatsApp document message");
            }

            await incrementDailyUsage(phoneNumberId);
            console.log(`[WhatsApp Sender] Invoice PDF successfully sent to ${formattedTo}. Message ID: ${data.messages?.[0]?.id}`);
            return data;
        } catch (err) {
            console.error('[WhatsApp Sender] Error sending PDF:', err);
            throw err;
        }
    }
};

module.exports = whatsappSender;
