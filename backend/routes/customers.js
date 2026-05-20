const express = require('express');
const router = express.Router();
const db = require('../db');
const { z } = require('zod');

// C005: Zod validation schema for customer data
const customerSchema = z.object({
    name: z.string().min(1, "Customer name is required").max(100),
    phone: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, "Invalid phone format").optional().or(z.literal('')),
    email: z.string().email("Invalid email format").optional().or(z.literal('')),
    address: z.string().max(500).optional().or(z.literal('')),
    gstin: z.string().max(20).optional().or(z.literal(''))
});

/**
 * M007: Shared helper to build validated customer fields from request body.
 * Merges incoming values with existing record (for partial updates).
 */
function buildCustomerFields(body, existing = {}) {
    // Validate with Zod first
    const validated = customerSchema.parse({
        name: (body.name ?? existing.name ?? '').trim(),
        phone: (body.phone ?? existing.phone ?? '').trim(),
        email: (body.email ?? existing.email ?? '').trim(),
        address: (body.address ?? existing.address ?? '').trim(),
        gstin: (body.gstin ?? existing.gstin ?? '').trim()
    });

    return validated;
}

// GET /api/customers
router.get('/', async (req, res, next) => {
    try {
        await db.ready;
        const { search } = req.query;
        let sql = 'SELECT * FROM customers';
        const params = [];

        if (search) {
            sql += ' WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        sql += ' ORDER BY created_at DESC';

        const customers = db.all(sql, params);
        res.json(customers);
    } catch (err) {
        next(err);
    }
});

// GET /api/customers/:id
router.get('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const customer = db.get('SELECT * FROM customers WHERE id = ?', [Number(req.params.id)]);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        res.json(customer);
    } catch (err) {
        next(err);
    }
});

// GET /api/customers/:id/purchases
router.get('/:id/purchases', async (req, res, next) => {
    try {
        await db.ready;
        const invoices = db.all(
            'SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC',
            [Number(req.params.id)]
        );

        const result = invoices.map(inv => ({
            ...inv,
            items: db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [inv.id])
        }));

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// POST /api/customers
router.post('/', async (req, res, next) => {
    try {
        await db.ready;
        const fields = buildCustomerFields(req.body);
        if (!fields.name) return res.status(400).json({ error: 'Customer name is required' });

        const result = db.run(
            'INSERT INTO customers (name, phone, email, address, gstin) VALUES (?, ?, ?, ?, ?)',
            [fields.name, fields.phone, fields.email, fields.address, fields.gstin]
        );

        const customer = db.get('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(customer);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        next(err);
    }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const existing = db.get('SELECT * FROM customers WHERE id = ?', [Number(req.params.id)]);
        if (!existing) return res.status(404).json({ error: 'Customer not found' });

        const fields = buildCustomerFields(req.body, existing);
        if (!fields.name) return res.status(400).json({ error: 'Customer name is required' });

        db.run(
            'UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, gstin = ? WHERE id = ?',
            [fields.name, fields.phone, fields.email, fields.address, fields.gstin, Number(req.params.id)]
        );

        const customer = db.get('SELECT * FROM customers WHERE id = ?', [Number(req.params.id)]);
        res.json(customer);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        next(err);
    }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const existing = db.get('SELECT * FROM customers WHERE id = ?', [Number(req.params.id)]);
        if (!existing) return res.status(404).json({ error: 'Customer not found' });

        db.run('DELETE FROM customers WHERE id = ?', [Number(req.params.id)]);
        res.json({ message: 'Customer deleted', id: Number(req.params.id) });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
