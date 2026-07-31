const express = require('express');
const router = express.Router();
const db = require('../db');
const { getDayOfMonth, calculateCurrentDue, isBillingBlocked, checkAndRunAutopay, getCreditBalance, getCreditLedger, addCredit } = require('../services/billingHelper');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://waywrispbgbtnppusikg.supabase.co';
const supabaseAnonKey = 'sb_publishable_J4ZoFCETv9sy_gh6m9hZlg_qrTElZDV';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
        const creditBalance = await getCreditBalance();
        const creditLedger = await getCreditLedger();

        // Check if Gmail is connected
        const gmailRows = db.all("SELECT id FROM email_connections");
        const gmailConnected = gmailRows.length > 0;

        // Check if WhatsApp is connected
        const whatsappRows = db.all("SELECT id FROM whatsapp_connections");
        const whatsappConnected = whatsappRows.length > 0;

        // Check if any voice agent is created in the database
        const allAgents = db.all("SELECT id FROM mazeway_agents");
        const voiceAgentCreated = allAgents.length > 0;

        // Live Supabase License & VoIP/Vobiz Check
        let liveLicensePlan = settings.license_plan || 'Free';
        let liveLicenseStatus = settings.license_status || 'Active';
        let liveLicenseCreatedAt = null;
        let vobizLicense = null;
        let licenseEmail = settings.email || '';

        const licenseKey = settings.license_key || '';
        if (licenseKey) {
            const { data: licenseData, error: licenseErr } = await supabase
                .from('licenses')
                .select('*')
                .eq('license_key', licenseKey)
                .maybeSingle();

            if (!licenseErr && licenseData) {
                licenseEmail = licenseData.email || licenseEmail;
                liveLicenseCreatedAt = licenseData.created_at;
                
                // Expiry Check (30 Days)
                const expiryDate = new Date(licenseData.created_at);
                expiryDate.setDate(expiryDate.getDate() + 30);
                
                if (new Date() > expiryDate) {
                    liveLicensePlan = 'Free';
                    liveLicenseStatus = 'Expired';
                } else {
                    liveLicensePlan = licenseData.plan;
                    liveLicenseStatus = licenseData.status;
                }

                // Keep local SQLite settings in sync with live status
                db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_plan', ?)", [liveLicensePlan]);
                db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_status', ?)", [liveLicenseStatus]);
            }
        }

        // Query Vobiz VoIP license from Supabase matching active user's email
        if (licenseEmail) {
            const { data: voipData, error: voipErr } = await supabase
                .from('licenses')
                .select('*')
                .eq('email', licenseEmail)
                .eq('plan', 'VoIP')
                .maybeSingle();

            if (!voipErr && voipData) {
                vobizLicense = voipData;
            }
        }

        // Determine if VoIP phone number is purchased & active based on Vobiz subscription status
        let phoneNumberPurchased = false;
        let phoneNumberDetails = '';
        
        if (vobizLicense) {
            const voipExpiryDate = new Date(vobizLicense.created_at);
            voipExpiryDate.setDate(voipExpiryDate.getDate() + 30);
            
            // VoIP number active as long as we are within 2 days of expiration
            const releaseCutoff = new Date(voipExpiryDate);
            releaseCutoff.setDate(releaseCutoff.getDate() + 2);

            if (new Date() <= releaseCutoff) {
                phoneNumberPurchased = true;
                phoneNumberDetails = vobizLicense.invoice_id || '+91 99990 12345';
            }
        }

        res.json({
            paymentMethodAdded: false, // Card payment is obsolete
            paymentMethodAutopay: false,
            paymentMethodBrand: 'N/A',
            paymentMethodLast4: 'N/A',
            paymentMethodExpiry: 'N/A',
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
            creditBalance,
            creditLedger,
            licensePlan: liveLicensePlan,
            licenseStatus: liveLicenseStatus,
            licenseKey,
            licenseCreatedAt: liveLicenseCreatedAt,
            vobizLicense,
            syncId: settings.online_sync_id || '',
            email: licenseEmail
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
