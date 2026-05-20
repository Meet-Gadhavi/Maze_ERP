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

module.exports = router;
