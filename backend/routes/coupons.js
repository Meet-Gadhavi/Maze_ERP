const express = require('express');
const router = express.Router();
const db = require('../db');
const { z } = require('zod');

// Zod schema for coupon creation
const couponSchema = z.object({
    code: z.string().min(1, "Coupon code is required").max(50),
    type: z.enum(['discount', 'currency', 'product']),
    value: z.union([z.number(), z.string()]),
    expiry_date: z.string().optional().nullable().or(z.literal('')),
    usage_limit_type: z.enum(['unlimited', 'custom']).default('unlimited'),
    usage_limit: z.number().int().min(1).optional().nullable(),
    reward_quantity: z.number().int().min(1).optional().nullable()
});

// GET /api/coupons
router.get('/', async (req, res, next) => {
    try {
        await db.ready;
        const coupons = db.all(`
            SELECT c.*, p.name AS product_name 
            FROM coupons c
            LEFT JOIN products p ON c.type = 'product' AND c.value NOT LIKE '[%' AND CAST(c.value AS INTEGER) = p.id
            ORDER BY c.created_at DESC
        `);

        // Format product_name for multiple products
        for (const c of coupons) {
            if (c.type === 'product' && typeof c.value === 'string' && c.value.trim().startsWith('[')) {
                try {
                    const items = JSON.parse(c.value);
                    const names = [];
                    for (const item of items) {
                        const product = db.get('SELECT name FROM products WHERE id = ?', [item.id]);
                        if (product) {
                            names.push(`${product.name} (x${item.qty})`);
                        }
                    }
                    c.product_name = names.join(', ');
                } catch (e) {
                    console.error('Failed to parse coupon list value', e);
                }
            }
        }

        res.json(coupons);
    } catch (err) {
        next(err);
    }
});

// POST /api/coupons
router.post('/', async (req, res, next) => {
    try {
        await db.ready;
        const validated = couponSchema.parse(req.body);
        const codeUpper = validated.code.trim().toUpperCase();

        if (validated.type !== 'product' && typeof validated.value === 'string') {
            return res.status(400).json({ error: 'Value must be a number for discount/currency coupons.' });
        }

        // Check if code already exists
        const existing = db.get('SELECT id FROM coupons WHERE UPPER(code) = ?', [codeUpper]);
        if (existing) {
            return res.status(400).json({ error: `Coupon code "${codeUpper}" already exists.` });
        }

        const expiry = validated.expiry_date ? validated.expiry_date : null;
        const limitVal = validated.usage_limit_type === 'custom' ? validated.usage_limit : null;
        const rewardQty = validated.type === 'product' ? (validated.reward_quantity || 1) : 1;

        const result = db.run(
            'INSERT INTO coupons (code, type, value, expiry_date, usage_limit_type, usage_limit, times_used, reward_quantity) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
            [codeUpper, validated.type, validated.value, expiry, validated.usage_limit_type, limitVal, rewardQty]
        );

        const newCoupon = db.get('SELECT * FROM coupons WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(newCoupon);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: err.errors[0].message });
        }
        next(err);
    }
});

// DELETE /api/coupons/:id
commandType = 'DELETE';
router.delete('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const couponId = Number(req.params.id);
        const existing = db.get('SELECT id FROM coupons WHERE id = ?', [couponId]);
        if (!existing) {
            return res.status(404).json({ error: 'Coupon not found.' });
        }

        db.run('DELETE FROM coupons WHERE id = ?', [couponId]);
        res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (err) {
        next(err);
    }
});

// POST /api/coupons/apply
router.post('/apply', async (req, res, next) => {
    try {
        await db.ready;
        const { code } = req.body;
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Coupon code is required.' });
        }

        const codeUpper = code.trim().toUpperCase();
        const coupon = db.get('SELECT * FROM coupons WHERE UPPER(code) = ?', [codeUpper]);
        if (!coupon) {
            return res.status(400).json({ error: 'Invalid coupon code.' });
        }

        // Validate expiry
        if (coupon.expiry_date) {
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            if (coupon.expiry_date < today) {
                return res.status(400).json({ error: 'This coupon has expired.' });
            }
        }

        // Validate usage limit
        if (coupon.usage_limit_type === 'custom' && coupon.times_used >= coupon.usage_limit) {
            return res.status(400).json({ error: 'Coupon usage limit has been reached.' });
        }

        // Return details
        if (coupon.type === 'product') {
            let productsList = [];
            try {
                if (typeof coupon.value === 'string' && coupon.value.trim().startsWith('[')) {
                    const items = JSON.parse(coupon.value);
                    for (const item of items) {
                        const product = db.get('SELECT id, name, selling_price, stock_quantity, unit FROM products WHERE id = ?', [item.id]);
                        if (product) {
                            productsList.push({
                                id: product.id,
                                name: product.name,
                                selling_price: product.selling_price,
                                stock_quantity: product.stock_quantity,
                                unit: product.unit || 'PCS',
                                reward_quantity: item.qty || 1
                            });
                        }
                    }
                } else {
                    const productId = parseInt(coupon.value);
                    const product = db.get('SELECT id, name, selling_price, stock_quantity, unit FROM products WHERE id = ?', [productId]);
                    if (product) {
                        productsList.push({
                            id: product.id,
                            name: product.name,
                            selling_price: product.selling_price,
                            stock_quantity: product.stock_quantity,
                            unit: product.unit || 'PCS',
                            reward_quantity: coupon.reward_quantity || 1
                        });
                    }
                }
            } catch (e) {
                console.error('Failed to parse coupon value JSON', e);
            }

            if (productsList.length === 0) {
                return res.status(400).json({ error: 'Associated reward product(s) do not exist anymore.' });
            }

            return res.json({
                coupon,
                productsList
            });
        }

        res.json({ coupon });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
