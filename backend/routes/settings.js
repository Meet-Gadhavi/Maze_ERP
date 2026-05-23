const express = require('express');
const router = express.Router();
const db = require('../db');

// Whitelist of permitted settings keys — any key not listed here is silently ignored.
const ALLOWED_SETTINGS_KEYS = new Set([
    'company_name', 'address', 'phone', 'email', 'logo_url', 'gstin',
    'bank_name', 'account_number', 'ifsc_code', 'account_holder_name',
    'upi_id', 'payment_qr_url', 'declaration', 'terms_and_conditions',
    'invoice_style', 'default_place_of_supply',
    'enable_batch_system', 'require_batch_number', 'enable_expiry_tracking',
    'auto_batch_selection_method', 'expiry_alert_days', 'allow_negative_batch_stock',
    'enable_gst_per_item', 'enable_discount_per_item', 'enable_sku',
    'default_payment_method', 'backup_cycle', 'last_backup_date',
    'low_stock_threshold', 'flexible_inventory', 'enable_quick_sale',
    'enable_barcode_scanner', 'enable_customer_display', 'enable_cash_drawer',
    'mazeway_cloud_enabled', 'mazeway_api_key', 'mazeway_webhook_url', 'cloud_backups_enabled',
    'auto_push_to_ai', 'auto_update_enabled', 'default_currency', 'invoice_language',
    'tier_a_discount', 'tier_b_discount', 'tier_c_discount', 'enable_serial_tracking'
]);

// GET /api/settings
router.get('/', async (_req, res, next) => {
    try {
        await db.ready;
        const rows = db.all('SELECT key, value FROM settings');
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        res.json(settings);
    } catch (err) {
        next(err);
    }
});

// POST /api/settings
router.post('/', async (req, res, next) => {
    try {
        await db.ready;
        const incoming = req.body;

        for (const [key, value] of Object.entries(incoming)) {
            if (!ALLOWED_SETTINGS_KEYS.has(key)) continue; // skip unknown keys
            db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
        }

        res.json({ message: 'Settings updated' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
