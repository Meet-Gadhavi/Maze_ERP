const express = require('express');
const router = express.Router();
const db = require('../db');
const whatsappSender = require('../services/whatsappSender');
const campaignSyncService = require('../services/email/campaignSyncService');

// Connect QEIWA (Quantro ERP Identity WhatsApp Automation)
router.post('/connect-qeiwa', async (req, res, next) => {
    try {
        await db.ready;
        const qeiwaPhoneId = '1232217746642571';
        const qeiwaWabaId = '1522938979283733';
        const qeiwaToken = 'EAATPnZC7jFeIBSLfZALKc7Dpkw4woJ5N2BCuq50uRWOZC8xnus3N7NoKZCnTQIqdTFUpCiCCkI9QtC8SM74pQdrtCxD5HW7ZCko9goqege6lN9jWLqsdpk7XwywquRZBg5kPVeEHS7VA9bKs8Ij4vY07WPTjQPZBRGp2MtVnyFuXhU2d52wsb1OZAgiraVnvn2oEI6dxW2hqoyAOhUosmrMMCVtU1xomTZBSSbCawPdDJJQxxEOKLbnYrEgZDZD';
        const qeiwaPhone = '+91 9033281960';
        const appId = '1354185989887458';
        const appSecret = '678f644e1e7eafce62c29e5ba2dd17ff';
        const verifyToken = 'maze_secure_verify_2026';

        db.run(
            `INSERT OR REPLACE INTO whatsapp_connections (phone_number_id, waba_id, token, status, service_type, phone_number)
             VALUES (?, ?, ?, 'Active', 'QEIWA', ?)`,
            [qeiwaPhoneId, qeiwaWabaId, qeiwaToken, qeiwaPhone]
        );

        // Update settings keys for consistency
        db.run("UPDATE settings SET value = ? WHERE key = 'whatsapp_token'", [qeiwaToken]);
        db.run("UPDATE settings SET value = ? WHERE key = 'whatsapp_phone_number_id'", [qeiwaPhoneId]);
        db.run("UPDATE settings SET value = ? WHERE key = 'whatsapp_business_account_id'", [qeiwaWabaId]);
        db.run("UPDATE settings SET value = ? WHERE key = 'whatsapp_app_id'", [appId]);
        db.run("UPDATE settings SET value = ? WHERE key = 'whatsapp_app_secret'", [appSecret]);
        db.run("UPDATE settings SET value = ? WHERE key = 'whatsapp_webhook_verify_token'", [verifyToken]);

        // Sync WhatsApp connection metadata
        campaignSyncService.pushMetadata().catch(err => console.error('[Sync] Failed to push metadata on QEIWA connect:', err.message));

        res.json({ success: true, message: 'Connected to Quantro ERP Identity WhatsApp Automation (QEIWA) successfully.' });
    } catch (err) {
        next(err);
    }
});

// Simulated Meta Embedded Signup page matching Facebook Login for Business UX
router.get('/connect', async (req, res, next) => {
    try {
        await db.ready;
        const appId = db.get("SELECT value FROM settings WHERE key = 'whatsapp_app_id'")?.value || '1354185989887458';
        const configId = '1222207263263139'; // Meta-hosted config ID provided by user

        const onboardingUrl = `https://business.facebook.com/messaging/whatsapp/onboard/?app_id=${appId}&config_id=${configId}&extras=%7B%22sessionInfoVersion%22%3A%223%22%2C%22version%22%3A%22v4%22%7D`;
        
        console.log('[WhatsApp Auth] Redirecting directly to Meta-hosted landing page:', onboardingUrl);
        res.redirect(onboardingUrl);
    } catch (err) {
        next(err);
    }
});

// OAuth Callback receiver
router.get('/callback', async (req, res, next) => {
    try {
        await db.ready;
        const { code, target_waba_id } = req.query;

        console.log('[WhatsApp Auth] Callback received with query params:', req.query);

        // Fetch the permanent token from settings
        const permanentToken = db.get("SELECT value FROM settings WHERE key = 'whatsapp_token'")?.value || 
            'EAATPnZC7jFeIBSLfZALKc7Dpkw4woJ5N2BCuq50uRWOZC8xnus3N7NoKZCnTQIqdTFUpCiCCkI9QtC8SM74pQdrtCxD5HW7ZCko9goqege6lN9jWLqsdpk7XwywquRZBg5kPVeEHS7VA9bKs8Ij4vY07WPTjQPZBRGp2MtVnyFuXhU2d52wsb1OZAgiraVnvn2oEI6dxW2hqoyAOhUosmrMMCVtU1xomTZBSSbCawPdDJJQxxEOKLbnYrEgZDZD';

        // 1. Direct Bypass: If Meta passed target_waba_id, use permanent system user token to query phone numbers
        if (target_waba_id) {
            console.log(`[WhatsApp Auth] Bypassing code exchange. Querying phone numbers for WABA: ${target_waba_id} using permanent token...`);
            try {
                const phoneResponse = await fetch(`https://graph.facebook.com/v23.0/${target_waba_id}/phone_numbers?access_token=${permanentToken}`);
                const phoneData = await phoneResponse.json();

                if (phoneResponse.ok && phoneData.data && phoneData.data.length > 0) {
                    const phoneNumberId = phoneData.data[0].id;
                    const displayPhone = phoneData.data[0].display_phone_number || ('+' + phoneNumberId);
                    console.log(`[WhatsApp Auth] Resolved Phone Number ID: ${phoneNumberId} from WABA ${target_waba_id}. Saving connection...`);
                    
                    db.run(
                        `INSERT OR REPLACE INTO whatsapp_connections (phone_number_id, waba_id, token, status, service_type, phone_number)
                         VALUES (?, ?, ?, 'Active', 'OBIWA', ?)`,
                        [phoneNumberId, target_waba_id, permanentToken, displayPhone]
                    );

                    // Sync WhatsApp connection metadata
                    campaignSyncService.pushMetadata().catch(err => console.error('[Sync] Failed to push metadata on WhatsApp bypass callback:', err.message));

                    return res.redirect('maze-erp://whatsapp-auth-callback?status=success');
                } else {
                    console.error('[WhatsApp Auth] Failed to fetch phone numbers via permanent token:', phoneData);
                }
            } catch (fetchErr) {
                console.error('[WhatsApp Auth] Error fetching phone numbers via permanent token:', fetchErr);
            }
        }

        // 2. Real Meta OAuth flow fallback: Exchange code for user access token
        if (code) {
            const appId = db.get("SELECT value FROM settings WHERE key = 'whatsapp_app_id'")?.value || '1354185989887458';
            const appSecret = db.get("SELECT value FROM settings WHERE key = 'whatsapp_app_secret'")?.value || '678f644e1e7eafce62c29e5ba2dd17ff';
            const redirectUri = 'http://localhost:3001/auth/whatsapp/callback';

            console.log('[WhatsApp Auth] Exchanging authorization code for User Access Token...');
            
            try {
                const tokenResponse = await fetch(`https://graph.facebook.com/v23.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`);
                const tokenData = await tokenResponse.json();

                if (tokenResponse.ok && tokenData.access_token) {
                    const userAccessToken = tokenData.access_token;
                    console.log('[WhatsApp Auth] Token exchange succeeded. Fetching user accounts...');

                    // Fetch WhatsApp Business Accounts
                    const accountsResponse = await fetch(`https://graph.facebook.com/v23.0/me/whatsapp_business_accounts?access_token=${userAccessToken}`);
                    const accountsData = await accountsResponse.json();

                    if (accountsResponse.ok && accountsData.data && accountsData.data.length > 0) {
                        const wabaId = accountsData.data[0].id;
                        console.log(`[WhatsApp Auth] Found WABA: ${wabaId}. Fetching phone numbers...`);

                        // Fetch Phone Numbers for WABA
                        const phoneResponse = await fetch(`https://graph.facebook.com/v23.0/${wabaId}/phone_numbers?access_token=${userAccessToken}`);
                        const phoneData = await phoneResponse.json();

                        if (phoneResponse.ok && phoneData.data && phoneData.data.length > 0) {
                            const phoneNumberId = phoneData.data[0].id;
                            const displayPhone = phoneData.data[0].display_phone_number || ('+' + phoneNumberId);
                            console.log(`[WhatsApp Auth] Resolved Phone Number ID: ${phoneNumberId}. Saving connection...`);

                            db.run(
                                `INSERT OR REPLACE INTO whatsapp_connections (phone_number_id, waba_id, token, status, service_type, phone_number)
                                 VALUES (?, ?, ?, 'Active', 'OBIWA', ?)`,
                                [phoneNumberId, wabaId, userAccessToken || permanentToken, displayPhone]
                            );

                            // Sync WhatsApp connection metadata
                            campaignSyncService.pushMetadata().catch(err => console.error('[Sync] Failed to push metadata on WhatsApp OAuth callback:', err.message));

                            return res.redirect('maze-erp://whatsapp-auth-callback?status=success');
                        } else {
                            console.error('[WhatsApp Auth] Failed to fetch phone numbers via user access token:', phoneData);
                            const errMsg = `No phone numbers found under WABA ID: ${wabaId}. Please register a phone number in Meta Business Suite.`;
                            return res.redirect(`maze-erp://whatsapp-auth-callback?status=error&message=${encodeURIComponent(errMsg)}`);
                        }
                    } else {
                        console.error('[WhatsApp Auth] Failed to fetch WABA accounts via user access token:', accountsData);
                        const errMsg = 'No WhatsApp Business Accounts (WABA) found. Ensure you created one in Meta Business Suite.';
                        return res.redirect(`maze-erp://whatsapp-auth-callback?status=error&message=${encodeURIComponent(errMsg)}`);
                    }
                } else {
                    console.error('[WhatsApp Auth] Token exchange failed:', tokenData);
                    const errMsg = `Failed to exchange authorization code: ${tokenData.error?.message || 'Unknown error'}`;
                    return res.redirect(`maze-erp://whatsapp-auth-callback?status=error&message=${encodeURIComponent(errMsg)}`);
                }
            } catch (exchangeErr) {
                console.error('[WhatsApp Auth] Code exchange flow failed:', exchangeErr);
                const errMsg = `Internal error processing OAuth callback: ${exchangeErr.message}`;
                return res.redirect(`maze-erp://whatsapp-auth-callback?status=error&message=${encodeURIComponent(errMsg)}`);
            }
        }

        // 3. Fallback: If no code or target_waba_id, but the user settings have the pre-configured credentials,
        // we can try using the pre-configured ones as a fallback.
        const defaultWabaId = db.get("SELECT value FROM settings WHERE key = 'whatsapp_business_account_id'")?.value || '1522938979283733';
        const defaultPhoneId = db.get("SELECT value FROM settings WHERE key = 'whatsapp_phone_number_id'")?.value || '1232217746642571';
        
        if (defaultWabaId && defaultPhoneId && permanentToken) {
            console.log('[WhatsApp Auth] No callback params found. Attempting fallback with pre-configured settings credentials...');
            db.run(
                `INSERT OR REPLACE INTO whatsapp_connections (phone_number_id, waba_id, token, status, service_type, phone_number)
                 VALUES (?, ?, ?, 'Active', 'QEIWA', '+91 9033281960')`,
                [defaultPhoneId, defaultWabaId, permanentToken]
            );

            // Sync WhatsApp connection metadata
            campaignSyncService.pushMetadata().catch(err => console.error('[Sync] Failed to push metadata on WhatsApp fallback connect:', err.message));

            return res.redirect('maze-erp://whatsapp-auth-callback?status=success');
        }

        const errMsg = 'Could not automatically complete the WhatsApp Business connection. Please verify that your system user access token in Settings is valid.';
        return res.redirect(`maze-erp://whatsapp-auth-callback?status=error&message=${encodeURIComponent(errMsg)}`);
    } catch (err) {
        next(err);
    }
});

// GET active connections
router.get('/connections', async (req, res, next) => {
    try {
        await db.ready;
        const rows = db.all("SELECT id, phone_number_id, waba_id, status, service_type, phone_number, connected_at FROM whatsapp_connections");
        const today = new Date().toISOString().split('T')[0];
        
        const connectionsWithUsage = rows.map(r => {
            const usageRow = db.get("SELECT messages_sent FROM whatsapp_daily_usage WHERE phone_number_id = ? AND date = ?", [r.phone_number_id, today]);
            return {
                ...r,
                messagesSentToday: usageRow ? usageRow.messages_sent : 0,
                messagesLimit: 1800
            };
        });
        
        res.json(connectionsWithUsage);
    } catch (err) {
        next(err);
    }
});

// POST disconnect WhatsApp
router.post('/disconnect', async (req, res, next) => {
    try {
        await db.ready;
        const { phone_number_id } = req.body;
        if (!phone_number_id) {
            return res.status(400).json({ error: "phone_number_id is required" });
        }

        db.run("DELETE FROM whatsapp_connections WHERE phone_number_id = ?", [phone_number_id]);
        res.json({ message: "WhatsApp service disconnected successfully." });

        // Sync WhatsApp connection metadata
        campaignSyncService.pushMetadata().catch(err => console.error('[Sync] Failed to push metadata on WhatsApp disconnect:', err.message));
    } catch (err) {
        next(err);
    }
});

// POST test-message
router.post('/test-message', async (req, res, next) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ error: "recipient phone is required" });
        }

        const msgText = "Test Message from Quantro ERP WhatsApp Integration!\n\nYour WhatsApp Cloud API is successfully configured.";
        const result = await whatsappSender.sendText(phone, msgText);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST send-invoice via WhatsApp
router.post('/send-invoice', async (req, res, next) => {
    const { to, invoiceId } = req.body;
    if (!to || !invoiceId) {
        return res.status(400).json({ error: 'to and invoiceId parameters are required.' });
    }

    try {
        await db.ready;
        // Fetch Invoice details
        const invoice = db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }

        // Fetch invoice items
        const items = db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        invoice.items = items;

        // Fetch settings
        const settingsRows = db.all('SELECT key, value FROM settings');
        const settings = {};
        settingsRows.forEach(r => { settings[r.key] = r.value; });

        const companyName = settings.company_name || 'Maze ERP';
        
        // Generate Invoice PDF
        const { generateInvoicePDF } = require('../services/pdfGenerator');
        const pdfBuffer = await generateInvoicePDF(invoice, settings);
        const filename = `Invoice_${String(invoice.id).padStart(4, '0')}.pdf`;
        const caption = `Dear customer, please find attached invoice #${invoice.invoice_number || invoice.id} for your purchase from ${companyName}.`;

        // Send PDF via WhatsApp
        await whatsappSender.sendInvoicePDF(to, pdfBuffer, filename, caption);

        // Record communication log
        if (invoice.customer_id) {
            db.run(
                "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'SMS', ?)",
                [invoice.customer_id, `Sent invoice #${invoice.invoice_number || invoice.id} via WhatsApp`]
            );
        }

        res.json({ message: 'Invoice sent successfully via WhatsApp' });
    } catch (err) {
        console.error('[WhatsApp Auth] Send invoice failed:', err);
        res.status(500).json({ error: err.message || 'Failed to send invoice via WhatsApp.' });
    }
});

// Webhook Verification (GET /webhook)
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = db.get("SELECT value FROM settings WHERE key = 'whatsapp_webhook_verify_token'")?.value || 'maze_secure_verify_2026';

    if (mode && token) {
        if (mode === 'subscribe' && token === verifyToken) {
            console.log('[WhatsApp Webhook] Verified successfully.');
            return res.status(200).send(challenge);
        } else {
            return res.status(403).send('Forbidden');
        }
    }
    res.status(400).send('Bad Request');
});

// Webhook Event Receiver (POST /webhook)
router.post('/webhook', (req, res) => {
    const body = req.body;
    console.log('[WhatsApp Webhook] Received Event:', JSON.stringify(body, null, 2));

    try {
        if (body.object === 'whatsapp_business_account' && body.entry) {
            for (const entry of body.entry) {
                if (entry.changes) {
                    for (const change of entry.changes) {
                        if (change.value && change.value.messages) {
                            for (const message of change.value.messages) {
                                const fromPhone = message.from;
                                if (fromPhone) {
                                    const { updateCustomerSession } = require('../services/whatsappSessionService');
                                    // Set or update the CSW for this customer
                                    updateCustomerSession(fromPhone, 'active');
                                    console.log(`[WhatsApp Webhook] Active CSW updated/stored for phone: ${fromPhone}`);

                                    // Intercept text messages for AI reply
                                    if (message.type === 'text' && message.text && message.text.body) {
                                        const messageText = message.text.body;

                                        // Execute matching and auto-reply asynchronously
                                        (async () => {
                                            try {
                                                const cleanFromPhone = fromPhone.replace(/\D/g, '');
                                                let customer = null;
                                                if (cleanFromPhone) {
                                                    const customers = db.all("SELECT * FROM customers WHERE phone IS NOT NULL AND phone != ''");
                                                    customer = customers.find(c => {
                                                        const dbPhone = (c.phone || '').replace(/\D/g, '');
                                                        return dbPhone && (dbPhone === cleanFromPhone || dbPhone.endsWith(cleanFromPhone) || cleanFromPhone.endsWith(dbPhone));
                                                    });
                                                }

                                                if (!customer) {
                                                    const leadName = `AI Lead (${fromPhone})`;
                                                    const insertRes = db.run(
                                                        "INSERT INTO customers (name, phone, email, address) VALUES (?, ?, '', '')",
                                                        [leadName, fromPhone]
                                                    );
                                                    customer = { id: insertRes.lastInsertRowid, name: leadName, phone: fromPhone, email: '', address: '' };
                                                    console.log(`[WhatsApp Webhook] Created new lead placeholder: ${leadName} (ID: ${customer.id})`);
                                                }

                                                // Log incoming message
                                                db.run(
                                                    "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'SMS', ?)",
                                                    [customer.id, `Received WhatsApp: ${messageText}`]
                                                );

                                                // Get AI reply
                                                const { processIncomingMessage } = require('../services/aiReplyService');
                                                const cleanReplyText = await processIncomingMessage({
                                                    customerId: customer.id,
                                                    text: messageText,
                                                    channel: 'WhatsApp',
                                                    phone: fromPhone
                                                });

                                                // Send response
                                                await whatsappSender.sendText(fromPhone, cleanReplyText);

                                                // Log outgoing AI reply
                                                db.run(
                                                    "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'SMS', ?)",
                                                    [customer.id, `AI Auto-Reply: ${cleanReplyText}`]
                                                );
                                                console.log(`[WhatsApp Webhook] Replied to ${fromPhone} using AI`);
                                            } catch (e) {
                                                console.error('[WhatsApp Webhook AI Processing Error]', e);
                                            }
                                        })();
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error('[WhatsApp Webhook] Error processing event:', err);
    }

    // Return standard success response to Meta
    res.status(200).send('EVENT_RECEIVED');
});

module.exports = router;
