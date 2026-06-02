const express = require('express');
const router = express.Router();
const db = require('../db');
const campaignSyncService = require('../services/email/campaignSyncService');

// Whitelist of permitted settings keys — any key not listed here is silently ignored.
const ALLOWED_SETTINGS_KEYS = new Set([
    'company_name', 'address', 'phone', 'email', 'logo_url', 'gstin',
    'bank_name', 'account_number', 'ifsc_code', 'account_holder_name',
    'upi_id', 'payment_qr_url', 'declaration', 'terms_and_conditions',
    'invoice_style', 'default_place_of_supply',
    'enable_batch_system', 'require_batch_number', 'enable_expiry_tracking',
    'auto_batch_selection_method', 'expiry_alert_days', 'allow_negative_batch_stock',
    'enable_gst_per_item', 'enable_discount_per_item', 'enable_sku', 'show_category_in_invoice', 'enable_realtime_price_update',
    'include_pending_price',
    'default_payment_method', 'backup_cycle', 'last_backup_date',
    'low_stock_threshold', 'flexible_inventory', 'enable_quick_sale',
    'enable_barcode_scanner', 'enable_customer_display', 'enable_cash_drawer',
    'mazeway_cloud_enabled', 'mazeway_api_key', 'mazeway_webhook_url', 'cloud_backups_enabled',
    'auto_push_to_ai', 'auto_update_enabled', 'default_currency', 'invoice_language',
    'tier_a_discount', 'tier_b_discount', 'tier_c_discount', 'enable_serial_tracking',
    'auto_email_invoice_created', 'auto_email_invoice_edited', 'auto_email_voice_request',
    'auto_email_order_confirmation', 'auto_email_payment_received', 'auto_email_due_reminder', 'auto_email_due_reminder_days',
    'auto_whatsapp_invoice_created', 'auto_whatsapp_invoice_edited', 'auto_whatsapp_order_confirmation',
    'auto_whatsapp_voice_request', 'auto_whatsapp_payment_received', 'auto_whatsapp_due_reminder', 'auto_whatsapp_due_reminder_days',
    'whatsapp_app_id', 'whatsapp_app_secret', 'whatsapp_token', 'whatsapp_phone_number_id', 'whatsapp_business_account_id', 'whatsapp_webhook_verify_token',
    'billing_payment_method_added', 'billing_phone_number_purchased', 'billing_phone_number_details',
    'billing_whatsapp_non_csw_count', 'billing_voice_agent_seconds', 'billing_email_sent_count',
    'billing_email_package_active', 'billing_email_package_due', 'billing_simulated_day',
    'license_key', 'license_plan', 'license_status', 'license_user_id'
]);

// GET /api/settings
router.get('/', async (_req, res, next) => {
    try {
        await db.ready;
        const rows = db.all('SELECT key, value FROM settings');
        const settings = {};
        rows.forEach(r => {
            if (r.key === 'whatsapp_token' || r.key === 'whatsapp_app_secret') {
                settings[r.key] = r.value ? '••••••••••••••••' : '';
            } else {
                settings[r.key] = r.value;
            }
        });
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
            
            // Skip overwriting sensitive keys if they are returned as masked
            if ((key === 'whatsapp_token' || key === 'whatsapp_app_secret') && value === '••••••••••••••••') {
                continue;
            }
            
            db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
        }

        // Trigger background sync for all shared invoices to update settings or logo in cloud DB
        const { syncAllSharedInvoices } = require('../services/hostedInvoiceService');
        syncAllSharedInvoices().catch(e => console.error('[Settings Sync] Failed to sync settings for all shared invoices:', e.message));

        // Sync metadata (settings) to cloud
        campaignSyncService.pushMetadata().catch(err => console.error('[Sync] Failed to push metadata on settings update:', err.message));

        res.json({ message: 'Settings updated' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
