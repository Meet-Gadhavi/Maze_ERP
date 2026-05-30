const express = require('express');
const router = express.Router();
const googleOAuthService = require('../services/googleOAuthService');
const EmailConnection = require('../models/EmailConnection');
const gmailSender = require('../services/email/gmailSender');
const db = require('../db');
const campaignSyncService = require('../services/email/campaignSyncService');

// GET /auth/google -> Redirects user to Google Consent page
router.get('/', (req, res) => {
    try {
        const url = googleOAuthService.getAuthUrl();
        res.redirect(url);
    } catch (err) {
        console.error('[Google Auth] Failed to generate Auth URL:', err);
        res.status(500).json({ error: 'Failed to initiate Google Authentication.' });
    }
});

// GET /auth/google/callback -> Google redirects here
router.get('/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error) {
        console.error('[Google Auth] Consent error:', error);
        return res.redirect(`maze-erp://google-auth-callback?status=error&message=${encodeURIComponent(error)}`);
    }

    try {
        console.log('[Google Auth] Exchanging authorization code...');
        const tokens = await googleOAuthService.exchangeCode(code);
        
        console.log('[Google Auth] Fetching user profile info...');
        const profile = await googleOAuthService.getUserInfo(tokens);
        
        console.log('[Google Auth] Storing connection metadata...');
        const expiryDate = tokens.expiry_date || (Date.now() + (tokens.expires_in * 1000));
        
        await EmailConnection.createOrUpdateConnection({
            provider: 'gmail',
            email: profile.email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token, // might be undefined if not first consent, handled by COALESCE
            expiryDate: expiryDate,
            status: 'Active'
        });

        // Redirect back to Electron application using custom protocol
        res.redirect(`maze-erp://google-auth-callback?status=success&email=${encodeURIComponent(profile.email)}`);
        
        // Sync connection metadata to online server
        campaignSyncService.pushMetadata().catch(err => console.error('[Sync] Failed to push metadata on callback:', err.message));
    } catch (err) {
        console.error('[Google Auth] Callback exchange failed:', err);
        res.redirect(`maze-erp://google-auth-callback?status=error&message=${encodeURIComponent(err.message || 'Authentication exchange failed.')}`);
    }
});

// GET /auth/google/callback-bypass -> Direct connect bypass for local testing
router.get('/callback-bypass', async (req, res) => {
    try {
        const email = req.query.email || 'gadhavimeet63@gmail.com';
        console.log(`[Google Auth] Bypassing OAuth flow. Registering direct connection for: ${email}...`);
        
        await EmailConnection.createOrUpdateConnection({
            provider: 'gmail',
            email: email,
            accessToken: 'mock_access_token',
            refreshToken: 'mock_refresh_token',
            expiryDate: Date.now() + 3600000,
            status: 'Active'
        });

        // Sync connection metadata to online server
        campaignSyncService.pushMetadata().catch(err => console.error('[Sync] Failed to push metadata on bypass callback:', err.message));
        
        res.redirect(`maze-erp://google-auth-callback?status=success&email=${encodeURIComponent(email)}`);
    } catch (err) {
        console.error('[Google Auth] Bypass callback failed:', err);
        res.redirect(`maze-erp://google-auth-callback?status=error&message=${encodeURIComponent(err.message || 'Bypass authentication failed.')}`);
    }
});


// GET /auth/google/connections -> Get all connected Gmail accounts
router.get('/connections', async (req, res, next) => {
    try {
        const connections = await EmailConnection.getConnections();
        // Clean access token/refresh token details for safety
        const safeConnections = await Promise.all(connections.map(async conn => {
            const emailsSentToday = await EmailConnection.getDailyUsage(conn.email);
            return {
                id: conn.id,
                provider: conn.provider,
                email: conn.email,
                status: conn.status,
                connectedAt: conn.connected_at,
                isExpired: Date.now() >= (conn.expiry_date - 300000),
                emailsSentToday,
                emailsLimit: 1000
            };
        }));
        res.json(safeConnections);
    } catch (err) {
        next(err);
    }
});

// POST /auth/google/disconnect -> Disconnect a connected email
router.post('/disconnect', async (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email parameter is required.' });
    }

    try {
        await EmailConnection.deleteConnection(email);
        res.json({ message: `Successfully disconnected Gmail account: ${email}` });

        // Sync connection metadata to online server
        campaignSyncService.pushMetadata().catch(err => console.error('[Sync] Failed to push metadata on disconnect:', err.message));
    } catch (err) {
        next(err);
    }
});

// POST /auth/google/test-email -> Send test email
router.post('/test-email', async (req, res, next) => {
    const { senderEmail, to, subject, body } = req.body;
    if (!senderEmail || !to) {
        return res.status(400).json({ error: 'senderEmail and to parameters are required.' });
    }

    try {
        await db.ready;
        const settingsRows = db.all('SELECT key, value FROM settings');
        const settings = {};
        settingsRows.forEach(r => { settings[r.key] = r.value; });

        const companyName = (settings.company_name && settings.company_name.trim() !== '' && settings.company_name !== 'Quantro')
            ? settings.company_name
            : 'Maze ERP';

        const html = gmailSender.generateTestEmailTemplate(body, settings);
        await gmailSender.sendMail({
            senderEmail,
            to,
            subject: subject || `${companyName} - Test Email`,
            htmlBody: html,
            textBody: body || 'Test email content.'
        });
        res.json({ message: `Test email sent successfully to ${to}` });
    } catch (err) {
        console.error('[Google Auth] Test email failed:', err);
        res.status(500).json({ error: err.message || 'Failed to send test email.' });
    }
});

// POST /auth/google/send-invoice -> Sends compiled invoice to customer
router.post('/send-invoice', async (req, res, next) => {
    const { senderEmail, to, invoiceId, style } = req.body;
    if (!senderEmail || !to || !invoiceId) {
        return res.status(400).json({ error: 'senderEmail, to, and invoiceId parameters are required.' });
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

        // Compile template style
        const activeStyle = style || settings.invoice_style || 'classic';
        const htmlBody = gmailSender.generateInvoiceTemplate(invoice, settings, activeStyle);

        // Send Email
        const subject = `Invoice #${invoice.invoice_number || invoice.id} from ${settings.company_name || 'Maze ERP'}`;
        await gmailSender.sendMail({
            senderEmail,
            to,
            subject,
            htmlBody,
            textBody: `Please find attached your Invoice #${invoice.invoice_number || invoice.id} from ${settings.company_name || 'Maze ERP'}.`
        });

        // Record communication log
        if (invoice.customer_id) {
            db.run(
                "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'Email', ?)",
                [invoice.customer_id, `Sent invoice #${invoice.invoice_number || invoice.id} via Gmail (${senderEmail})`]
            );
        }

        res.json({ message: 'Invoice sent successfully' });
    } catch (err) {
        console.error('[Google Auth] Send invoice failed:', err);
        res.status(500).json({ error: err.message || 'Failed to send invoice email.' });
    }
});

// GET /auth/google/campaigns -> Fetch scheduled campaigns
router.get('/campaigns', async (req, res, next) => {
    try {
        await db.ready;
        const campaigns = db.all('SELECT * FROM email_campaigns ORDER BY created_at DESC');
        res.json(campaigns.map(c => ({
            ...c,
            customers: JSON.parse(c.customers || '[]'),
            customContent: c.custom_content
        })));
    } catch (err) {
        next(err);
    }
});

// POST /auth/google/campaigns -> Schedule email campaign
router.post('/campaigns', async (req, res, next) => {
    const { name, customers, startDate, endDate, timeToSend, template, channel, customContent } = req.body;
    if (!name || !customers || !startDate || !timeToSend || !template) {
        return res.status(400).json({ error: 'Missing required campaign scheduling parameters.' });
    }

    try {
        await db.ready;
        const sql = `
            INSERT INTO email_campaigns (name, customers, start_date, end_date, time_to_send, template, channel, custom_content, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
        `;
        const result = db.run(sql, [
            name, 
            JSON.stringify(customers), 
            startDate, 
            endDate || null, 
            timeToSend, 
            template,
            channel || 'email',
            customContent || null
        ]);
        res.json({ message: 'Campaign scheduled successfully', id: result.lastInsertRowid });

        // Sync campaigns list to cloud
        campaignSyncService.pushCampaigns().catch(err => console.error('[Sync] Failed to push campaigns on schedule:', err.message));
    } catch (err) {
        next(err);
    }
});

// DELETE /auth/google/campaigns/:id -> Cancel campaign
router.delete('/campaigns/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        await db.ready;
        db.run('DELETE FROM email_campaigns WHERE id = ?', [id]);
        res.json({ message: 'Campaign cancelled successfully.' });

        // Sync campaigns list to cloud
        campaignSyncService.pushCampaigns().catch(err => console.error('[Sync] Failed to push campaigns on cancel:', err.message));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
