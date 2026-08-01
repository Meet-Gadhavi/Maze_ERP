const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://waywrispbgbtnppusikg.supabase.co';
const supabaseAnonKey = 'sb_publishable_J4ZoFCETv9sy_gh6m9hZlg_qrTElZDV';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to generate 16-character Branch Pairing Token (e.g., STR2-98F1-44A2-KL89)
function generatePairKey() {
    const raw = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `STR-${raw.substring(0, 4)}-${raw.substring(4, 8)}-${raw.substring(8, 12)}`;
}

// GET /api/stores - List all connected store branches
router.get('/', (req, res) => {
    try {
        const stores = db.all('SELECT * FROM stores ORDER BY is_hq DESC, id ASC');
        res.json({ success: true, stores });
    } catch (err) {
        console.error('[Stores] Fetch error:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch stores' });
    }
});

// POST /api/stores - Add new child branch & generate pairing key
router.post('/', (req, res) => {
    try {
        const { name, address, phone, email, gstin, place_of_supply, invoice_prefix, terms_and_conditions, bank_details, upi_vpa, logo_url } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Store branch name is required' });
        }

        // Generate store code (STR-002, STR-003...)
        const maxStore = db.get('SELECT MAX(id) as maxId FROM stores');
        const nextId = (maxStore?.maxId || 0) + 1;
        const store_code = `STR-${String(nextId).padStart(3, '0')}`;
        const cloud_store_id = `store_${crypto.randomBytes(6).toString('hex')}`;
        const pair_key = generatePairKey();

        const stmt = db.run(`
            INSERT INTO stores (
                cloud_store_id, store_code, parent_store_id, name, address, phone, email, gstin, place_of_supply,
                invoice_prefix, terms_and_conditions, bank_details, upi_vpa, logo_url, is_hq, pair_key_hash, status
            ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'ACTIVE')
        `, [
            cloud_store_id,
            store_code,
            name.trim(),
            address || '',
            phone || '',
            email || '',
            gstin || '',
            place_of_supply || '',
            invoice_prefix || `INV-B${nextId}-`,
            terms_and_conditions || '',
            bank_details || '',
            upi_vpa || '',
            logo_url || '',
            pair_key
        ]);

        db.persist();

        const createdStore = db.get('SELECT * FROM stores WHERE id = ?', [stmt.lastInsertRowid]);

        // Background Cloud Sync to Supabase PostgreSQL DB
        supabase.from('stores').upsert({
            cloud_store_id: createdStore.cloud_store_id,
            store_code: createdStore.store_code,
            name: createdStore.name,
            address: createdStore.address,
            phone: createdStore.phone,
            email: createdStore.email,
            gstin: createdStore.gstin,
            place_of_supply: createdStore.place_of_supply,
            invoice_prefix: createdStore.invoice_prefix,
            is_hq: false,
            pair_key_hash: createdStore.pair_key_hash,
            status: 'ACTIVE'
        }).then(({ data, error }) => {
            if (error) console.error('[Supabase Store Sync] Error syncing branch:', error);
            else console.log('[Supabase Store Sync] Branch synced to Supabase PostgreSQL successfully.');
        }).catch(e => console.error('[Supabase Store Sync] Catch error:', e));

        res.json({
            success: true,
            store: createdStore,
            pair_key: pair_key,
            message: `Branch ${name} registered! Pair key generated: ${pair_key}`
        });
    } catch (err) {
        console.error('[Stores] Add branch error:', err);
        res.status(500).json({ error: err.message || 'Failed to add store branch' });
    }
});

// POST /api/stores/pair - Pair child terminal with 16-character token
router.post('/pair', async (req, res) => {
    try {
        const { pair_key } = req.body;

        if (!pair_key) {
            return res.status(400).json({ error: '16-character Pairing Key token is required' });
        }

        const targetKey = pair_key.trim().toUpperCase();
        let store = db.get('SELECT * FROM stores WHERE pair_key_hash = ? AND status = "ACTIVE"', [targetKey]);

        // Fallback: Check Supabase PostgreSQL Cloud DB if not found in local SQLite DB
        if (!store) {
            try {
                const { data: cloudStore, error: cloudErr } = await supabase
                    .from('stores')
                    .select('*')
                    .eq('pair_key_hash', targetKey)
                    .eq('status', 'ACTIVE')
                    .maybeSingle();

                if (cloudStore && !cloudErr) {
                    // Sync cloud store into local SQLite DB
                    db.run(`
                        INSERT OR REPLACE INTO stores (
                            cloud_store_id, store_code, name, address, phone, email, gstin, place_of_supply, is_hq, pair_key_hash, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'ACTIVE')
                    `, [
                        cloudStore.cloud_store_id || `store_${crypto.randomBytes(4).toString('hex')}`,
                        cloudStore.store_code || 'STR-CHILD',
                        cloudStore.name,
                        cloudStore.address || '',
                        cloudStore.phone || '',
                        cloudStore.email || '',
                        cloudStore.gstin || '',
                        cloudStore.place_of_supply || '',
                        targetKey
                    ]);
                    db.persist();
                    store = db.get('SELECT * FROM stores WHERE pair_key_hash = ?', [targetKey]);
                }
            } catch (supErr) {
                console.error('[Stores Pair] Supabase fallback search failed:', supErr);
            }
        }

        if (!store) {
            return res.status(404).json({ error: 'Invalid or expired Branch Pairing Token' });
        }

        // Record terminal handshake connection on Supabase
        supabase.from('store_terminal_connections').insert({
            store_id: store.id,
            pair_key: targetKey,
            terminal_name: 'Child Terminal Handshake',
            is_online: true
        }).then(() => console.log('[Supabase Handshake] Registered terminal handshake connection.'))
        .catch(e => console.error('[Supabase Handshake] Error recording connection:', e));

        res.json({
            success: true,
            store,
            message: `Terminal successfully paired with ${store.name} (${store.store_code})!`
        });
    } catch (err) {
        console.error('[Stores] Pair error:', err);
        res.status(500).json({ error: err.message || 'Pairing failed' });
    }
});

// PUT /api/stores/:id - Update store branch settings
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, phone, email, gstin, place_of_supply, invoice_prefix, terms_and_conditions, bank_details, upi_vpa, logo_url, status } = req.body;

        const existing = db.get('SELECT * FROM stores WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Store branch not found' });
        }

        db.run(`
            UPDATE stores SET
                name = ?,
                address = ?,
                phone = ?,
                email = ?,
                gstin = ?,
                place_of_supply = ?,
                invoice_prefix = ?,
                terms_and_conditions = ?,
                bank_details = ?,
                upi_vpa = ?,
                logo_url = ?,
                status = ?,
                updated_at = datetime('now','localtime')
            WHERE id = ?
        `, [
            name || existing.name,
            address !== undefined ? address : existing.address,
            phone !== undefined ? phone : existing.phone,
            email !== undefined ? email : existing.email,
            gstin !== undefined ? gstin : existing.gstin,
            place_of_supply !== undefined ? place_of_supply : existing.place_of_supply,
            invoice_prefix !== undefined ? invoice_prefix : existing.invoice_prefix,
            terms_and_conditions !== undefined ? terms_and_conditions : existing.terms_and_conditions,
            bank_details !== undefined ? bank_details : existing.bank_details,
            upi_vpa !== undefined ? upi_vpa : existing.upi_vpa,
            logo_url !== undefined ? logo_url : existing.logo_url,
            status || existing.status,
            id
        ]);

        db.persist();

        const updated = db.get('SELECT * FROM stores WHERE id = ?', [id]);
        res.json({ success: true, store: updated });
    } catch (err) {
        console.error('[Stores] Update error:', err);
        res.status(500).json({ error: err.message || 'Failed to update store branch' });
    }
});

// DELETE /api/stores/:id - Disconnect / Remove a child store branch
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const store = db.get('SELECT * FROM stores WHERE id = ?', [id]);
        if (!store) {
            return res.status(404).json({ error: 'Store branch not found' });
        }

        if (store.is_hq) {
            return res.status(400).json({ error: 'Cannot disconnect or delete the Primary HQ Store' });
        }

        db.run('DELETE FROM stores WHERE id = ?', [id]);
        db.persist();

        res.json({ success: true, message: `Branch ${store.name} disconnected successfully` });
    } catch (err) {
        console.error('[Stores] Delete error:', err);
        res.status(500).json({ error: err.message || 'Failed to disconnect store branch' });
    }
});

// GET /api/stores/consolidated-analytics - Aggregated multi-store performance matrix
router.get('/consolidated-analytics', (req, res) => {
    try {
        const stores = db.all('SELECT * FROM stores WHERE status = "ACTIVE"');

        const matrix = stores.map(st => {
            const sales = db.get('SELECT COALESCE(SUM(total), 0) as totalSales, COUNT(id) as count FROM invoices WHERE store_id = ? OR (store_id IS NULL AND ? = 1)', [st.id, st.id]);
            const purchases = db.get('SELECT COALESCE(SUM(total_amount), 0) as totalPurchases FROM purchases WHERE store_id = ? OR (store_id IS NULL AND ? = 1)', [st.id, st.id]);
            const stockVal = db.get('SELECT COALESCE(SUM(selling_price * stock_quantity), 0) as stockVal FROM products');

            return {
                store_id: st.id,
                store_code: st.store_code,
                name: st.name,
                is_hq: st.is_hq,
                total_sales: sales.totalSales,
                total_invoices: sales.count,
                total_purchases: purchases.totalPurchases,
                stock_value: stockVal.stockVal,
                sync_status: st.is_hq ? '🟢 Live (HQ Master)' : '🟢 Synced'
            };
        });

        const overallSales = matrix.reduce((acc, curr) => acc + curr.total_sales, 0);
        const overallInvoices = matrix.reduce((acc, curr) => acc + curr.total_invoices, 0);

        res.json({
            success: true,
            summary: {
                total_outlets: stores.length,
                network_revenue: overallSales,
                network_invoices: overallInvoices
            },
            stores_matrix: matrix
        });
    } catch (err) {
        console.error('[Stores] Consolidated Analytics error:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch consolidated analytics' });
    }
});

module.exports = router;
