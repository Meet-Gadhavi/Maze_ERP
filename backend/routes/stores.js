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
router.get('/', async (req, res) => {
    try {
        let stores = db.all('SELECT * FROM stores ORDER BY is_hq DESC, id ASC');

        // Check Supabase for updated cloud pairing statuses if online
        try {
            const { data: cloudStores } = await supabase.from('stores').select('id, pair_key_hash, is_paired, status');
            if (cloudStores && cloudStores.length > 0) {
                let updatedAny = false;
                for (const cs of cloudStores) {
                    if (cs.pair_key_hash) {
                        const local = stores.find(s => s.pair_key_hash === cs.pair_key_hash);
                        if (local && (cs.is_paired || cs.status === 'CONNECTED') && (!local.is_paired || local.status !== 'CONNECTED')) {
                            db.run("UPDATE stores SET is_paired = 1, status = 'CONNECTED' WHERE id = ?", [local.id]);
                            updatedAny = true;
                        }
                    }
                }
                if (updatedAny) {
                    db.persist();
                    stores = db.all('SELECT * FROM stores ORDER BY is_hq DESC, id ASC');
                }
            }
        } catch (cloudCheckErr) {
            // Silently ignore offline error
        }

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
                invoice_prefix, terms_and_conditions, bank_details, upi_vpa, logo_url, is_hq, pair_key_hash, is_paired, status
            ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 'ACTIVE')
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
            is_paired: false,
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
        const { pair_key, email } = req.body;

        if (!pair_key) {
            return res.status(400).json({ error: '16-character Pairing Key token is required' });
        }
        if (!email) {
            return res.status(400).json({ error: 'User email is required for terminal pairing authorization' });
        }

        let isAuthorized = false;
        try {
            // Check if registered as an employee in staff_profiles on Supabase
            const { data: staffMember } = await supabase
                .from('staff_profiles')
                .select('id')
                .eq('email', email.trim().toLowerCase())
                .maybeSingle();

            if (staffMember) {
                isAuthorized = true;
            } else {
                // Check if registered as the active license owner on Supabase
                const { data: licenseRecord } = await supabase
                    .from('licenses')
                    .select('id')
                    .eq('email', email.trim().toLowerCase())
                    .eq('status', 'Active')
                    .maybeSingle();

                if (licenseRecord) {
                    isAuthorized = true;
                }
            }
        } catch (authChkErr) {
            console.error('[Stores Pair] Authority check failed:', authChkErr);
        }

        if (!isAuthorized) {
            return res.status(403).json({ error: `Authorization Failed: The email "${email}" is not registered as an employee or owner in the HQ system.` });
        }

        const targetKey = pair_key.trim().toUpperCase();
        let store = db.get('SELECT * FROM stores WHERE pair_key_hash = ?', [targetKey]);

        // Fallback: Check Supabase PostgreSQL Cloud DB if not found in local SQLite DB
        if (!store) {
            try {
                const { data: cloudStore, error: cloudErr } = await supabase
                    .from('stores')
                    .select('*')
                    .eq('pair_key_hash', targetKey)
                    .maybeSingle();

                if (cloudStore && !cloudErr) {
                    // Sync cloud store into local SQLite DB
                    db.run(`
                        INSERT OR REPLACE INTO stores (
                            cloud_store_id, store_code, name, address, phone, email, gstin, place_of_supply, is_hq, pair_key_hash, is_paired, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, 'CONNECTED')
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

        // Mark store as paired and connected in local SQLite DB
        db.run("UPDATE stores SET is_paired = 1, status = 'CONNECTED', updated_at = datetime('now','localtime') WHERE id = ?", [store.id]);
        db.persist();
        store = db.get('SELECT * FROM stores WHERE id = ?', [store.id]);

        // Update pairing status on Supabase
        supabase.from('stores').update({
            is_paired: true,
            status: 'CONNECTED'
        }).eq('pair_key_hash', targetKey).then(() => console.log('[Supabase Store Pair] Marked store as paired & connected.')).catch(e => console.error(e));

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
