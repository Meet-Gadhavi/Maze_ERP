const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/suppliers
router.get('/', async (req, res, next) => {
    try {
        await db.ready;
        const { search } = req.query;
        let sql = 'SELECT * FROM suppliers';
        const params = [];

        if (search) {
            sql += ' WHERE name LIKE ? OR phone LIKE ? OR gstin LIKE ?';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        sql += ' ORDER BY created_at DESC';

        const suppliers = db.all(sql, params);
        res.json(suppliers);
    } catch (err) {
        next(err);
    }
});

// GET /api/suppliers/:id
router.get('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', [Number(req.params.id)]);
        if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
        res.json(supplier);
    } catch (err) {
        next(err);
    }
});

// POST /api/suppliers
router.post('/', async (req, res, next) => {
    try {
        await db.ready;
        const { name, phone, gstin, address, opening_balance, notes } = req.body;
        if (!name) return res.status(400).json({ error: 'Supplier name is required' });

        const openBal = Number(opening_balance || 0);
        const result = db.run(
            'INSERT INTO suppliers (name, phone, gstin, address, opening_balance, due_balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, phone || '', gstin || '', address || '', openBal, openBal, notes || '']
        );

        const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(supplier);
    } catch (err) {
        next(err);
    }
});

// PUT /api/suppliers/:id
router.put('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const { name, phone, gstin, address, notes } = req.body;
        const existing = db.get('SELECT * FROM suppliers WHERE id = ?', [Number(req.params.id)]);
        if (!existing) return res.status(404).json({ error: 'Supplier not found' });

        db.run(
            'UPDATE suppliers SET name = ?, phone = ?, gstin = ?, address = ?, notes = ? WHERE id = ?',
            [
                name ?? existing.name,
                phone ?? existing.phone,
                gstin ?? existing.gstin,
                address ?? existing.address,
                notes ?? existing.notes,
                Number(req.params.id)
            ]
        );

        const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', [Number(req.params.id)]);
        res.json(supplier);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/suppliers/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const existing = db.get('SELECT * FROM suppliers WHERE id = ?', [Number(req.params.id)]);
        if (!existing) return res.status(404).json({ error: 'Supplier not found' });

        // Check if supplier has purchases before deleting
        const hasPurchases = db.get('SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?', [Number(req.params.id)]);
        if (hasPurchases.count > 0) {
            return res.status(400).json({ error: 'Cannot delete supplier with existing purchase records' });
        }

        db.run('DELETE FROM suppliers WHERE id = ?', [Number(req.params.id)]);
        res.json({ message: 'Supplier deleted', id: Number(req.params.id) });
    } catch (err) {
        next(err);
    }
});

// --- Supplier Price Lists ---

// GET /api/suppliers/:id/price-lists
router.get('/:id/price-lists', async (req, res, next) => {
    try {
        await db.ready;
        const supplierId = Number(req.params.id);
        const lists = db.all(`
            SELECT spl.*, p.name as product_name, p.product_code
            FROM supplier_price_lists spl
            JOIN products p ON spl.product_id = p.id
            WHERE spl.supplier_id = ?
            ORDER BY spl.created_at DESC
        `, [supplierId]);
        res.json(lists);
    } catch (err) {
        next(err);
    }
});

// POST /api/suppliers/:id/price-lists
router.post('/:id/price-lists', async (req, res, next) => {
    try {
        await db.ready;
        const supplierId = Number(req.params.id);
        const { product_id, variant_id, price } = req.body;

        if (!product_id) return res.status(400).json({ error: 'Product is required' });
        if (price === undefined || price === null || price < 0) {
            return res.status(400).json({ error: 'Valid price is required' });
        }

        // Check if a price list entry already exists for this supplier and product/variant
        const existing = db.get(
            'SELECT id FROM supplier_price_lists WHERE supplier_id = ? AND product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))',
            [supplierId, product_id, variant_id, variant_id]
        );

        if (existing) {
            db.run(
                'UPDATE supplier_price_lists SET price = ? WHERE id = ?',
                [Number(price), existing.id]
            );
        } else {
            db.run(
                'INSERT INTO supplier_price_lists (supplier_id, product_id, variant_id, price) VALUES (?, ?, ?, ?)',
                [supplierId, product_id, variant_id || null, Number(price)]
            );
        }

        res.json({ success: true, message: 'Price list updated' });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/suppliers/price-lists/:id
router.delete('/price-lists/:id', async (req, res, next) => {
    try {
        await db.ready;
        const id = Number(req.params.id);
        db.run('DELETE FROM supplier_price_lists WHERE id = ?', [id]);
        res.json({ success: true, message: 'Price list entry deleted' });
    } catch (err) {
        next(err);
    }
});

// --- Supplier Performance Reports ---

// GET /api/suppliers/reports/performance
router.get('/reports/performance', async (req, res, next) => {
    try {
        await db.ready;
        
        // Calculate spend per supplier
        const spendData = db.all(`
            SELECT s.id as supplier_id, s.name as supplier_name, 
                   COALESCE(SUM(p.grand_total), 0) as total_spend,
                   COUNT(p.id) as total_orders
            FROM suppliers s
            LEFT JOIN purchases p ON s.id = p.supplier_id AND p.is_draft = 0
            GROUP BY s.id
        `);

        // Calculate fulfillment stats from GRNs
        const grnStats = db.all(`
            SELECT g.supplier_id,
                   SUM(gi.quantity_ordered) as total_qty_ordered,
                   SUM(gi.quantity_received) as total_qty_received,
                   SUM(gi.quantity_accepted) as total_qty_accepted,
                   SUM(gi.quantity_rejected) as total_qty_rejected
            FROM grns g
            JOIN grn_items gi ON g.id = gi.grn_id
            WHERE g.status = 'Quality Checked'
            GROUP BY g.supplier_id
        `);

        // Compute average delivery delay from GRNs (received_date vs purchase_date)
        const delayStats = db.all(`
            SELECT g.supplier_id,
                   AVG(julianday(g.received_date) - julianday(p.purchase_date)) as avg_lead_time_days
            FROM grns g
            JOIN purchases p ON g.purchase_id = p.id
            WHERE g.status IN ('Received', 'Quality Checked')
            GROUP BY g.supplier_id
        `);

        // Merge performance records
        const performance = spendData.map(s => {
            const grnInfo = grnStats.find(g => g.supplier_id === s.supplier_id) || {
                total_qty_ordered: 0,
                total_qty_received: 0,
                total_qty_accepted: 0,
                total_qty_rejected: 0
            };
            const delayInfo = delayStats.find(d => d.supplier_id === s.supplier_id) || {
                avg_lead_time_days: 0
            };

            const fulfillmentRate = grnInfo.total_qty_ordered > 0
                ? (grnInfo.total_qty_accepted / grnInfo.total_qty_ordered) * 100
                : 100;

            return {
                ...s,
                total_qty_ordered: grnInfo.total_qty_ordered,
                total_qty_received: grnInfo.total_qty_received,
                total_qty_accepted: grnInfo.total_qty_accepted,
                total_qty_rejected: grnInfo.total_qty_rejected,
                fulfillment_rate: Number(fulfillmentRate.toFixed(1)),
                avg_lead_time_days: Number((delayInfo.avg_lead_time_days || 0).toFixed(1))
            };
        });

        res.json(performance);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
