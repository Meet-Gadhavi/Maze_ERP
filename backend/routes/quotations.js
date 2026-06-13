const express = require('express');
const router = express.Router();
const db = require('../db');
const { z } = require('zod');

// Schema for Quotation Item validation
const quotationItemSchema = z.object({
    product_id: z.number().int().nullable().optional(),
    product_name: z.string().min(1),
    quantity: z.number().min(0.0001),
    unit: z.string().default('PCS'),
    price: z.number().min(0),
    total: z.number().min(0),
    batch_id: z.number().int().nullable().optional()
});

// Schema for Quotation validation
const quotationSchema = z.object({
    name: z.string().min(1, "Quotation name/title is required"),
    customer_id: z.number().int().nullable().optional(),
    pricelist_id: z.number().int().nullable().optional(),
    discount_rate: z.number().min(0).max(100).default(0),
    gst_rate: z.number().min(0).max(100).default(0),
    walk_in_name: z.string().optional().default(''),
    walk_in_phone: z.string().optional().default(''),
    total: z.number().min(0),
    items: z.array(quotationItemSchema).min(1, "At least one item is required")
});

// GET /api/quotations - List all quotations
router.get('/', async (req, res, next) => {
    try {
        await db.ready;
        const query = `
            SELECT q.*, c.name AS customer_name, c.phone AS customer_phone 
            FROM quotations q 
            LEFT JOIN customers c ON q.customer_id = c.id 
            ORDER BY q.created_at DESC
        `;
        const quotations = db.all(query);
        res.json(quotations);
    } catch (err) {
        next(err);
    }
});

// GET /api/quotations/:id - Get details of a single quotation
router.get('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const id = Number(req.params.id);
        const quotationQuery = `
            SELECT q.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email, c.address AS customer_address, c.gstin AS customer_gstin
            FROM quotations q 
            LEFT JOIN customers c ON q.customer_id = c.id 
            WHERE q.id = ?
        `;
        const quotation = db.get(quotationQuery, [id]);
        if (!quotation) {
            return res.status(404).json({ error: 'Quotation not found' });
        }

        const items = db.all('SELECT * FROM quotation_items WHERE quotation_id = ?', [id]);
        quotation.items = items;

        res.json(quotation);
    } catch (err) {
        next(err);
    }
});

// POST /api/quotations - Create new quotation
router.post('/', async (req, res, next) => {
    try {
        await db.ready;
        const validated = quotationSchema.parse(req.body);

        let newQuotationId = null;

        db.transaction(() => {
            const quotationResult = db.run(`
                INSERT INTO quotations (name, customer_id, pricelist_id, total, gst_rate, discount_rate, walk_in_name, walk_in_phone)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                validated.name.trim(),
                validated.customer_id || null,
                validated.pricelist_id || null,
                validated.total,
                validated.gst_rate,
                validated.discount_rate,
                validated.walk_in_name.trim(),
                validated.walk_in_phone.trim()
            ]);

            newQuotationId = quotationResult.lastInsertRowid;

            for (const item of validated.items) {
                db.run(`
                    INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit, price, total, batch_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    newQuotationId,
                    item.product_id || null,
                    item.product_name.trim(),
                    item.quantity,
                    item.unit,
                    item.price,
                    item.total,
                    item.batch_id || null
                ]);
            }
        });

        const newQuotation = db.get('SELECT * FROM quotations WHERE id = ?', [newQuotationId]);
        res.status(201).json(newQuotation);
    } catch (err) {
        if (err instanceof z.ZodError) {
            const firstError = err.errors[0];
            const field = firstError.path.join('.');
            return res.status(400).json({ error: `Validation failed: ${field} - ${firstError.message}` });
        }
        next(err);
    }
});

// DELETE /api/quotations/:id - Delete a quotation
router.delete('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const id = Number(req.params.id);
        const existing = db.get('SELECT id FROM quotations WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Quotation not found' });
        }

        db.run('DELETE FROM quotations WHERE id = ?', [id]);
        res.json({ success: true, message: 'Quotation deleted successfully' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
