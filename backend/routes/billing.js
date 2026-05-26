const express = require('express');
const router = express.Router();
const db = require('../db');
const { getDayOfMonth, calculateCurrentDue, isBillingBlocked } = require('../services/billingHelper');

// GET /api/billing/status
router.get('/status', async (req, res, next) => {
    try {
        await db.ready;
        const rows = db.all("SELECT key, value FROM settings");
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });

        const dues = await calculateCurrentDue(settings);
        const currentDay = getDayOfMonth(settings);
        const blocked = await isBillingBlocked();

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
            licenseKey: settings.license_key || ''
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
    const { enableAutopay } = req.body;
    try {
        await db.ready;
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_payment_method_added', 'true')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_payment_method_autopay', ?)", [enableAutopay ? 'true' : 'false']);
        res.json({ success: true, message: 'Payment method successfully added.' });
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
