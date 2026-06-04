const express = require('express');
const router = express.Router();
const db = require('../db');
const { getDayOfMonth, calculateCurrentDue, isBillingBlocked, checkAndRunAutopay } = require('../services/billingHelper');

// GET /api/billing/status
router.get('/status', async (req, res, next) => {
    try {
        await db.ready;
        const rows = db.all("SELECT key, value FROM settings");
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });

        const blocked = await isBillingBlocked();
        const dues = await calculateCurrentDue(settings);
        const currentDay = getDayOfMonth(settings);

        // Check if Gmail is connected
        const gmailRows = db.all("SELECT id FROM email_connections");
        const gmailConnected = gmailRows.length > 0;

        // Check if WhatsApp is connected
        const whatsappRows = db.all("SELECT id FROM whatsapp_connections");
        const whatsappConnected = whatsappRows.length > 0;

        // Check active VoIP numbers from active voice agents
        const activeAgents = db.all("SELECT name, config FROM mazeway_agents WHERE status = 'ACTIVE'");
        const phoneNumberPurchased = activeAgents.length > 0;
        let phoneNumberDetails = '';
        if (phoneNumberPurchased) {
            const numbers = activeAgents.map(a => {
                try {
                    const config = JSON.parse(a.config || '{}');
                    return config.phone_number;
                } catch (e) {
                    return null;
                }
            }).filter(Boolean);
            phoneNumberDetails = numbers.join(', ');
        }

        // Check if any voice agent is created in the database
        const allAgents = db.all("SELECT id FROM mazeway_agents");
        const voiceAgentCreated = allAgents.length > 0;

        res.json({
            paymentMethodAdded: settings.billing_payment_method_added === 'true',
            paymentMethodAutopay: settings.billing_payment_method_autopay === 'true',
            paymentMethodBrand: settings.billing_payment_method_brand || 'Visa',
            paymentMethodLast4: settings.billing_payment_method_last4 || '4242',
            paymentMethodExpiry: settings.billing_payment_method_expiry || '12/28',
            phoneNumberPurchased,
            phoneNumberDetails,
            voiceAgentCreated,
            whatsappNonCswCount: parseInt(settings.billing_whatsapp_non_csw_count || '0', 10),
            voiceAgentSeconds: parseInt(settings.billing_voice_agent_seconds || '0', 10),
            emailSentCount: parseInt(settings.billing_email_sent_count || '0', 10),
            emailPackageActive: settings.billing_email_package_active === 'true',
            simulatedDay: settings.billing_simulated_day || '',
            currentDay,
            isBlocked: blocked,
            gmailConnected,
            whatsappConnected,
            dues,
            licensePlan: settings.license_plan || 'Free',
            licenseStatus: settings.license_status || 'Active',
            licenseKey: settings.license_key || '',
            syncId: settings.online_sync_id || ''
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/billing/upgrade
router.post('/upgrade', async (req, res, next) => {
    const { plan } = req.body;
    if (!['Pro', 'Professional'].includes(plan)) {
        return res.status(400).json({ success: false, message: 'Invalid plan' });
    }
    try {
        await db.ready;
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_plan', ?)", [plan]);
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_status', 'Active')");
        res.json({ success: true, message: `Successfully upgraded to ${plan} plan.` });
    } catch (err) {
        next(err);
    }
});

// POST /api/billing/cancel-subscription
router.post('/cancel-subscription', async (req, res, next) => {
    try {
        await db.ready;
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_plan', 'Free')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_status', 'Active')");
        res.json({ success: true, message: 'Subscription successfully cancelled. Downgraded to Free Starter plan.' });
    } catch (err) {
        next(err);
    }
});

// POST /api/billing/add-payment-method
router.post('/add-payment-method', async (req, res, next) => {
    const { enableAutopay, brand, last4, expiry } = req.body;
    try {
        await db.ready;
        
        let methodBrand = brand || 'Visa';
        let methodLast4 = last4 || '4242';
        let methodExpiry = expiry || '12/28';

        if (methodBrand.toUpperCase() === 'UPI') {
            methodBrand = 'UPI';
            methodExpiry = 'N/A';
            methodLast4 = last4 || 'user@upi';
        }

        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_payment_method_added', 'true')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_payment_method_autopay', ?)", [enableAutopay ? 'true' : 'false']);
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_payment_method_brand', ?)", [methodBrand]);
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_payment_method_last4', ?)", [methodLast4]);
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_payment_method_expiry', ?)", [methodExpiry]);
        res.json({ success: true, message: 'Payment method successfully added.' });
    } catch (err) {
        next(err);
    }
});

// POST /api/billing/remove-payment-method
router.post('/remove-payment-method', async (req, res, next) => {
    try {
        await db.ready;
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_payment_method_added', 'false')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_payment_method_autopay', 'false')");
        db.run("DELETE FROM settings WHERE key IN ('billing_payment_method_brand', 'billing_payment_method_last4', 'billing_payment_method_expiry')");
        res.json({ success: true, message: 'Payment method successfully removed.' });
    } catch (err) {
        next(err);
    }
});

// POST /api/billing/send-cancellation-code
router.post('/send-cancellation-code', async (req, res, next) => {
    try {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await db.ready;
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_cancellation_code', ?)", [code]);

        const emailRows = db.all("SELECT email FROM email_connections WHERE status = 'Active'");
        const settingsRows = db.all("SELECT key, value FROM settings");
        const settings = {};
        settingsRows.forEach(r => { settings[r.key] = r.value; });

        const targetEmail = settings.email || (emailRows.length > 0 ? emailRows[0].email : 'user@example.com');
        const subject = 'Quantro Subscription Cancellation Code';
        const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaecf0; border-radius: 8px;">
                <h2 style="color: #1e3a8a;">Cancel Your Quantro Subscription</h2>
                <p>Hello,</p>
                <p>We received a request to cancel your subscription to Quantro ERP.</p>
                <p>Please use the following 6-digit confirmation code to complete the cancellation:</p>
                <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #1e293b; margin: 24px 0;">
                    ${code}
                </div>
                <p style="font-size: 12px; color: #64748b;">If you did not request this cancellation, please ignore this email. Your subscription will remain active.</p>
            </div>
        `;

        let emailSent = false;
        let errorMessage = '';

        if (emailRows.length > 0) {
            const senderEmail = emailRows[0].email;
            try {
                const gmailSender = require('../services/email/gmailSender');
                const auth = await gmailSender.getAuthorizedClient(senderEmail);
                const { google } = require('googleapis');
                const gmail = google.gmail({ version: 'v1', auth });
                
                const rawMime = Buffer.from(
                    `To: ${targetEmail}\r\n` +
                    `From: "Quantro ERP Admin" <${senderEmail}>\r\n` +
                    `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=\r\n` +
                    `MIME-Version: 1.0\r\n` +
                    `Content-Type: text/html; charset="UTF-8"\r\n\r\n` +
                    htmlBody
                ).toString('base64url');

                await gmail.users.messages.send({
                    userId: 'me',
                    requestBody: {
                        raw: rawMime
                    }
                });

                emailSent = true;
                console.log(`[Billing Cancellation] Verification code sent to ${targetEmail} via ${senderEmail}`);
            } catch (err) {
                console.error('[Billing Cancellation] Gmail send error:', err);
                errorMessage = err.message;
            }
        } else {
            errorMessage = 'No Gmail connection configured.';
        }

        console.log(`\n==================================================`);
        console.log(`[CANCELLATION CODE] Verification Code for ${targetEmail}: ${code}`);
        console.log(`==================================================\n`);

        res.json({
            success: true,
            emailSent,
            targetEmail,
            message: emailSent 
                ? `Verification code sent to ${targetEmail}.`
                : `Verification code generated: ${code} (Gmail service details: ${errorMessage}).`
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/billing/confirm-cancellation
router.post('/confirm-cancellation', async (req, res, next) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ success: false, message: 'Verification code is required.' });
    }
    try {
        await db.ready;
        const row = db.get("SELECT value FROM settings WHERE key = 'billing_cancellation_code'");
        if (!row || row.value !== code.trim()) {
            return res.status(450).json({ success: false, message: 'Invalid verification code.' });
        }

        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_plan', 'Free')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_status', 'Active')");
        db.run("DELETE FROM settings WHERE key = 'billing_cancellation_code'");

        res.json({ success: true, message: 'Subscription successfully cancelled. Downgraded to Free Starter plan.' });
    } catch (err) {
        next(err);
    }
});

// POST /api/billing/buy-number
router.post('/buy-number', async (req, res, next) => {
    try {
        await db.ready;
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_phone_number_purchased', 'true')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_phone_number_details', '+91 99990 12345')");
        res.json({ success: true, message: 'Phone number purchased. Monthly subscription (₹750) active.' });
    } catch (err) {
        next(err);
    }
});

// POST /api/billing/buy-email-package
router.post('/buy-email-package', async (req, res, next) => {
    try {
        await db.ready;
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_email_package_active', 'true')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_email_package_due', '2500')");
        res.json({ success: true, message: 'Transactional Email Package purchased. Limit increased to 50,000 monthly.' });
    } catch (err) {
        next(err);
    }
});

// POST /api/billing/pay-dues
router.post('/pay-dues', async (req, res, next) => {
    try {
        await db.ready;
        
        // Reset usage counters that contribute to the current dues
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_whatsapp_non_csw_count', '0')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_voice_agent_seconds', '0')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_email_sent_count', '0')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_email_package_due', '0')");
        
        const todayStr = new Date().toLocaleDateString('en-IN');
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_last_payment_date', ?)", [todayStr]);

        res.json({ success: true, message: 'Payment of outstanding dues successful. All services unblocked.' });
    } catch (err) {
        next(err);
    }
});

// POST /api/billing/simulate-day
router.post('/simulate-day', async (req, res, next) => {
    const { day } = req.body; // Can be a number 1-30, or '' (empty string to disable simulation)
    try {
        await db.ready;
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_simulated_day', ?)", [String(day || '')]);
        res.json({ success: true, message: day ? `Simulated day set to Day ${day} of the month.` : 'Day simulation disabled (using actual system clock).' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
