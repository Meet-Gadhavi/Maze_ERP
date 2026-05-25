const express = require('express');
const router = express.Router();
const db = require('../db');
const whatsappSender = require('../services/whatsappSender');

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
            'EAATPnZC7jFeIBRqggccKGFX3E8Q3UNUmNf4bS59ZCV8MpbzIvfaIHmFrMRvDIHRkiS91DlU110DKgvY5EHWqKzzKL3mgPO9iuv8iFnR5ZAr6GC3CKZC4jmBkZBzSNoFB1v7ArepgYwCUoAeM2UFca2wudIVnPZCJRVgc9W3n0k2S5BG9EmA95Q6g8x1ZAuMjvdkCgZDZD';

        // 1. Direct Bypass: If Meta passed target_waba_id, use permanent system user token to query phone numbers
        if (target_waba_id) {
            console.log(`[WhatsApp Auth] Bypassing code exchange. Querying phone numbers for WABA: ${target_waba_id} using permanent token...`);
            try {
                const phoneResponse = await fetch(`https://graph.facebook.com/v23.0/${target_waba_id}/phone_numbers?access_token=${permanentToken}`);
                const phoneData = await phoneResponse.json();

                if (phoneResponse.ok && phoneData.data && phoneData.data.length > 0) {
                    const phoneNumberId = phoneData.data[0].id;
                    console.log(`[WhatsApp Auth] Resolved Phone Number ID: ${phoneNumberId} from WABA ${target_waba_id}. Saving connection...`);
                    
                    db.run(
                        `INSERT OR REPLACE INTO whatsapp_connections (phone_number_id, waba_id, token, status)
                         VALUES (?, ?, ?, 'Active')`,
                        [phoneNumberId, target_waba_id, permanentToken]
                    );

                    return res.redirect('http://localhost:5173/#/automation?whatsapp=success');
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
                            console.log(`[WhatsApp Auth] Resolved Phone Number ID: ${phoneNumberId}. Saving connection...`);

                            db.run(
                                `INSERT OR REPLACE INTO whatsapp_connections (phone_number_id, waba_id, token, status)
                                 VALUES (?, ?, ?, 'Active')`,
                                [phoneNumberId, wabaId, permanentToken]
                            );

                            return res.redirect('http://localhost:5173/#/automation?whatsapp=success');
                        } else {
                            console.error('[WhatsApp Auth] Failed to fetch phone numbers via user access token:', phoneData);
                            return res.status(400).send(`
                                <h2>Meta Onboarding Error</h2>
                                <p>No phone numbers were found under WABA ID: ${wabaId}.</p>
                                <p>Please register a phone number in your Meta Business Suite under this WhatsApp Business Account.</p>
                            `);
                        }
                    } else {
                        console.error('[WhatsApp Auth] Failed to fetch WABA accounts via user access token:', accountsData);
                        return res.status(400).send(`
                            <h2>Meta Onboarding Error</h2>
                            <p>No WhatsApp Business Accounts (WABA) were found associated with your Facebook profile.</p>
                            <p>Ensure you have created a WABA in your Meta Business Suite and it is linked to your Meta Developer App.</p>
                        `);
                    }
                } else {
                    console.error('[WhatsApp Auth] Token exchange failed:', tokenData);
                    return res.status(400).send(`
                        <h2>Meta Onboarding Callback Error</h2>
                        <p>Failed to exchange authorization code: ${tokenData.error?.message || 'Unknown error'}</p>
                        <p>Please verify your Meta App credentials in Settings, or make sure your permanent System User Access Token is configured and valid.</p>
                    `);
                }
            } catch (exchangeErr) {
                console.error('[WhatsApp Auth] Code exchange flow failed:', exchangeErr);
                return res.status(500).send(`
                    <h2>Meta Onboarding Internal Error</h2>
                    <p>Internal error processing OAuth callback: ${exchangeErr.message}</p>
                `);
            }
        }

        // 3. Fallback: If no code or target_waba_id, but the user settings have the pre-configured credentials,
        // we can try using the pre-configured ones as a fallback.
        const defaultWabaId = db.get("SELECT value FROM settings WHERE key = 'whatsapp_business_account_id'")?.value || '3150419608479658';
        const defaultPhoneId = db.get("SELECT value FROM settings WHERE key = 'whatsapp_phone_number_id'")?.value || '1117813404753239';
        
        if (defaultWabaId && defaultPhoneId && permanentToken) {
            console.log('[WhatsApp Auth] No callback params found. Attempting fallback with pre-configured settings credentials...');
            db.run(
                `INSERT OR REPLACE INTO whatsapp_connections (phone_number_id, waba_id, token, status)
                 VALUES (?, ?, ?, 'Active')`,
                [defaultPhoneId, defaultWabaId, permanentToken]
            );
            return res.redirect('http://localhost:5173/#/automation?whatsapp=success');
        }

        return res.status(400).send(`
            <h2>Meta Onboarding Connection Error</h2>
            <p>Could not automatically complete the WhatsApp Business connection. Please verify that your system user access token in Settings is valid and has permissions for your WhatsApp Business Account.</p>
        `);
    } catch (err) {
        next(err);
    }
});

// GET active connections
router.get('/connections', async (req, res, next) => {
    try {
        await db.ready;
        const rows = db.all("SELECT id, phone_number_id, waba_id, status, connected_at FROM whatsapp_connections");
        res.json(rows);
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

    // Handle statuses or incoming messages here if necessary.
    // Return standard success response to Meta
    res.status(200).send('EVENT_RECEIVED');
});

module.exports = router;
