const crypto = require('crypto');
const db = require('../db');

// Remote Mazeway Database config
const DB_URL = "https://mazeway-db.onrender.com";
const DB_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJncm91cCI6ImFub24iLCJpYXQiOjE3Nzk3MDA0Mzh9.mazeway_db_anon_5KUWRlLbhAarPceBoTlDGMTjNn8hvXtgSTCAGH7CSCOMxgwcZNojTpcYiqqUc3Ma";
const PUBLIC_DOMAIN = "https://billing-mazelab.netlify.app";

/**
 * Generates a secure hosted invoice link and synchronizes details to the cloud DB.
 * @param {number} invoiceId 
 * @returns {Promise<{token: string, url: string}>}
 */
async function generateHostedInvoice(invoiceId) {
    await db.ready;

    // 1. Fetch or generate the secure token
    let tokenRow = db.get("SELECT token FROM invoice_tokens WHERE invoice_id = ?", [invoiceId]);
    let token;
    if (tokenRow) {
        token = tokenRow.token;
    } else {
        token = crypto.randomBytes(24).toString('hex');
        db.run("INSERT INTO invoice_tokens (invoice_id, token) VALUES (?, ?)", [invoiceId, token]);
    }

    // 2. Fetch local invoice data
    const invoice = db.get(`
        SELECT i.*, c.name AS customer_name, c.gstin AS customer_gstin, c.email AS customer_email, c.phone AS customer_phone
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.id = ?
    `, [invoiceId]);

    if (!invoice) {
        throw new Error(`Invoice with ID ${invoiceId} not found locally.`);
    }

    // Fetch items
    const items = db.all(`
        SELECT ii.*, p.product_code, p.category
        FROM invoice_items ii
        LEFT JOIN products p ON ii.product_id = p.id
        WHERE ii.invoice_id = ?
    `, [invoiceId]);

    // Fetch serials and attach to items
    const serials = db.all('SELECT * FROM product_serials WHERE invoice_id = ?', [invoiceId]);
    items.forEach(item => {
        item.serials = serials.filter(s => s.invoice_item_id === item.id).map(s => s.serial_number);
    });

    // Fetch settings key-value pairs (only sync keys required by the public viewer to keep payload size minimal)
    const settingsRows = db.all('SELECT key, value FROM settings');
    const settings = {};
    const allowedSettingsKeys = [
        'company_name',
        'address',
        'phone',
        'email',
        'gstin',
        'upi_id',
        'payment_qr_url',
        'bank_name',
        'account_number',
        'ifsc_code',
        'account_holder_name',
        'terms_and_conditions',
        'invoice_style',
        'company_logo',
        'logo_url',
        'show_category_in_invoice'
    ];
    settingsRows.forEach(r => {
        if (allowedSettingsKeys.includes(r.key)) {
            settings[r.key] = r.value;
        }
    });

    // Ensure company_logo and logo_url are backward/forward compatible
    let finalLogo = settings.logo_url || settings.company_logo;
    if (finalLogo) {
        // If the logo is a base64 data URL and exceeds 100,000 chars (~75KB), omit it from the sync payload
        // to prevent database "Payload Too Large" (HTTP 413) errors
        if (finalLogo.startsWith('data:image/') && finalLogo.length > 100000) {
            console.warn(`[Sync Service] Logo is base64 and too large (${Math.round(finalLogo.length/1024)}KB). Omitting from cloud payload to avoid HTTP 413.`);
            finalLogo = null;
        }
    }
    if (finalLogo) {
        settings.company_logo = finalLogo;
        settings.logo_url = finalLogo;
    } else {
        delete settings.company_logo;
        delete settings.logo_url;
    }

    // Fetch payments
    const payments = db.all('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC', [invoiceId]);

    // Fetch returns
    const returns = db.all('SELECT * FROM invoice_returns WHERE invoice_id = ?', [invoiceId]);

    // 3. Prepare full payload for synchronization
    const invoicePayload = {
        invoice,
        items,
        settings,
        payments,
        returns
    };

    // 4. Synchronize to public dbmz endpoint
    console.log(`[Sync Service] Checking if invoice #${invoiceId} already exists in cloud DB...`);
    let exists = false;
    try {
        const checkResponse = await fetch(`${DB_URL}/api/v1/tables/hosted_invoices/rows`, {
            headers: {
                'apikey': DB_ANON_KEY,
                'Authorization': `Bearer ${DB_ANON_KEY}`
            }
        });
        if (checkResponse.ok) {
            const allRecords = await checkResponse.json();
            exists = allRecords.some(r => Number(r.invoice_id) === Number(invoiceId));
        }
    } catch (e) {
        console.warn(`[Sync Service] Pre-check failed, assuming it doesn't exist:`, e.message);
    }

    let response;
    if (exists) {
        console.log(`[Sync Service] Invoice #${invoiceId} already exists in cloud DB. Updating...`);
        response = await fetch(`${DB_URL}/api/v1/tables/hosted_invoices/rows`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': DB_ANON_KEY,
                'Authorization': `Bearer ${DB_ANON_KEY}`
            },
            body: JSON.stringify({
                match: { invoice_id: invoiceId },
                update: {
                    invoice_data: invoicePayload,
                    token: token
                }
            })
        });
    } else {
        console.log(`[Sync Service] Invoice #${invoiceId} does not exist in cloud DB. Inserting...`);
        response = await fetch(`${DB_URL}/api/v1/tables/hosted_invoices/rows`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': DB_ANON_KEY,
                'Authorization': `Bearer ${DB_ANON_KEY}`
            },
            body: JSON.stringify({
                invoice_id: invoiceId,
                token: token,
                invoice_data: invoicePayload
            })
        });
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Sync Service] Cloud DB sync failed with status ${response.status}:`, errorText);
        throw new Error(`Cloud DB synchronization failed: ${response.statusText}`);
    }

    console.log(`[Sync Service] Successfully synced invoice #${invoiceId}`);

    return {
        token,
        url: `${PUBLIC_DOMAIN}/invoice/${invoiceId}?token=${token}`
    };
}

/**
 * Returns the hosted invoice URL for an invoice, generating it if it doesn't exist.
 * @param {number} invoiceId 
 * @returns {Promise<string>}
 */
async function getHostedInvoiceUrl(invoiceId) {
    await db.ready;
    let tokenRow = db.get("SELECT token FROM invoice_tokens WHERE invoice_id = ?", [invoiceId]);
    if (tokenRow) {
        return `${PUBLIC_DOMAIN}/invoice/${invoiceId}?token=${tokenRow.token}`;
    }
    // Generate and sync if not present
    const result = await generateHostedInvoice(invoiceId);
    return result.url;
}

/**
 * Iterates through all shared invoice tokens and triggers a sync to update settings or logos.
 */
async function syncAllSharedInvoices() {
    await db.ready;
    const tokens = db.all("SELECT invoice_id FROM invoice_tokens");
    if (!tokens || tokens.length === 0) return;
    
    console.log(`[Sync Service] Re-syncing settings for ${tokens.length} shared invoices...`);
    for (const row of tokens) {
        try {
            await generateHostedInvoice(row.invoice_id);
        } catch (e) {
            console.error(`[Sync Service] Failed to re-sync invoice #${row.invoice_id}:`, e.message);
        }
    }
    console.log(`[Sync Service] Completed re-syncing of settings for all shared invoices.`);
}

module.exports = {
    generateHostedInvoice,
    getHostedInvoiceUrl,
    syncAllSharedInvoices
};
