const express = require('express');
const router = express.Router();
const db = require('../db');
const { z } = require('zod');

// Zod schema for Price List
const pricelistSchema = z.object({
    name: z.string().min(1, "Price list name is required").max(100),
    coupon_code: z.string().min(1, "Coupon code is required").max(50),
    description: z.string().optional().nullable().or(z.literal('')),
    discount_type: z.enum(['Percentage', 'Fixed']),
    discount_value: z.number().min(0, "Discount value must be positive"),
    min_order_amount: z.number().min(0, "Minimum order amount must be positive").default(0),
    max_uses: z.number().int().min(0).default(0),
    active: z.number().int().min(0).max(1).default(1)
});

// GET /api/pricelists
router.get('/', async (req, res, next) => {
    try {
        await db.ready;
        const pricelists = db.all('SELECT * FROM pricelists ORDER BY created_at DESC');
        res.json(pricelists);
    } catch (err) {
        next(err);
    }
});

// POST /api/pricelists
router.post('/', async (req, res, next) => {
    try {
        await db.ready;
        const validated = pricelistSchema.parse(req.body);
        const codeUpper = validated.coupon_code.trim().toUpperCase();

        // Check if coupon_code already exists in pricelists
        const existingPl = db.get('SELECT id FROM pricelists WHERE UPPER(coupon_code) = ?', [codeUpper]);
        if (existingPl) {
            return res.status(400).json({ error: `Price list coupon code "${codeUpper}" already exists.` });
        }

        // Also check if coupon_code already exists in coupons
        const existingCoupon = db.get('SELECT id FROM coupons WHERE UPPER(code) = ?', [codeUpper]);
        if (existingCoupon) {
            return res.status(400).json({ error: `Coupon code "${codeUpper}" already exists in the coupons list.` });
        }

        const result = db.run(
            'INSERT INTO pricelists (name, coupon_code, description, discount_type, discount_value, min_order_amount, max_uses, uses_count, active) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
            [
                validated.name.trim(),
                codeUpper,
                validated.description || '',
                validated.discount_type,
                validated.discount_value,
                validated.min_order_amount,
                validated.max_uses,
                validated.active
            ]
        );

        const newPl = db.get('SELECT * FROM pricelists WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(newPl);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: err.errors[0].message });
        }
        next(err);
    }
});

// PUT /api/pricelists/:id
router.put('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const id = Number(req.params.id);
        const validated = pricelistSchema.parse(req.body);
        const codeUpper = validated.coupon_code.trim().toUpperCase();

        const existing = db.get('SELECT id FROM pricelists WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Price list not found.' });
        }

        // Check uniqueness of coupon_code
        const duplicatePl = db.get('SELECT id FROM pricelists WHERE UPPER(coupon_code) = ? AND id != ?', [codeUpper, id]);
        if (duplicatePl) {
            return res.status(400).json({ error: `Another price list already uses code "${codeUpper}".` });
        }

        const duplicateCoupon = db.get('SELECT id FROM coupons WHERE UPPER(code) = ?', [codeUpper]);
        if (duplicateCoupon) {
            return res.status(400).json({ error: `Coupon code "${codeUpper}" already exists in the coupons list.` });
        }

        db.run(
            'UPDATE pricelists SET name = ?, coupon_code = ?, description = ?, discount_type = ?, discount_value = ?, min_order_amount = ?, max_uses = ?, active = ? WHERE id = ?',
            [
                validated.name.trim(),
                codeUpper,
                validated.description || '',
                validated.discount_type,
                validated.discount_value,
                validated.min_order_amount,
                validated.max_uses,
                validated.active,
                id
            ]
        );

        const updatedPl = db.get('SELECT * FROM pricelists WHERE id = ?', [id]);
        res.json(updatedPl);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: err.errors[0].message });
        }
        next(err);
    }
});

// DELETE /api/pricelists/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const id = Number(req.params.id);
        const existing = db.get('SELECT id FROM pricelists WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Price list not found.' });
        }

        db.run('DELETE FROM pricelists WHERE id = ?', [id]);
        res.json({ success: true, message: 'Price list deleted successfully' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
