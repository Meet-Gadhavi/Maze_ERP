const express = require('express');
const router = express.Router();
const db = require('../db');
const { getDayOfMonth, isBillingBlocked, getCreditBalance, getCreditLedger, addCredit } = require('../services/billingHelper');

// GET /api/billing/status
router.get('/status', async (req, res, next) => {
    try {
        await db.ready;
        const rows = db.all("SELECT key, value FROM settings");
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });

        const blocked = await isBillingBlocked();
        const creditBalance = await getCreditBalance();
        const creditLedger = await getCreditLedger();

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

        res.json({
            phoneNumberPurchased,
            phoneNumberDetails,
            isBlocked: blocked,
            gmailConnected,
            whatsappConnected,
            creditBalance,
            creditLedger,
            licensePlan: settings.license_plan || 'Free',
            licenseStatus: settings.license_status || 'Active',
            licenseKey: settings.license_key || '',
            licenseExpiresAt: settings.license_expires_at || '',
            vobizExpiresAt: settings.vobiz_expires_at || '',
            syncId: settings.online_sync_id || ''
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/billing/ledger
router.get('/ledger', async (req, res, next) => {
    try {
        const ledger = await getCreditLedger();
        const balance = await getCreditBalance();
        res.json({ balance, ledger });
    } catch (err) {
        next(err);
    }
});

// POST /api/billing/topup
router.post('/topup', async (req, res, next) => {
    try {
        const { amount, description } = req.body;
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid topup amount.' });
        }
        const newBal = await addCredit(Number(amount), description || 'Credit Top-up via Razorpay / quantro-web');
        res.json({ success: true, newBalance: newBal, message: `Successfully topped up ₹${Number(amount).toFixed(2)} wallet credits.` });
    } catch (err) {
        next(err);
    }
});

// POST /api/billing/upgrade
router.post('/upgrade', async (req, res, next) => {
    const { plan } = req.body;
    try {
        await db.ready;
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_plan', ?)", [plan || 'PRO']);
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_status', 'Active')");
        res.json({ success: true, message: `Successfully updated plan to ${plan}.` });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
