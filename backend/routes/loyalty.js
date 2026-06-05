const express = require('express');
const router = express.Router();
const db = require('../db');
const loyaltyService = require('../services/loyaltyService');

// GET /api/loyalty/:customerId
router.get('/:customerId', async (req, res, next) => {
    try {
        await db.ready;
        const customerId = Number(req.params.customerId);
        
        const customer = db.get('SELECT id, name, loyalty_points FROM customers WHERE id = ?', [customerId]);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Run the points expiration Sweep
        loyaltyService.checkAndExpirePoints(customerId);

        // Fetch updated customer points
        const updatedCustomer = db.get('SELECT loyalty_points FROM customers WHERE id = ?', [customerId]);
        const points = updatedCustomer ? updatedCustomer.loyalty_points : 0;

        // Fetch Settings for conversion rate
        const settingsRows = db.all('SELECT key, value FROM settings');
        const settings = {};
        settingsRows.forEach(r => { settings[r.key] = r.value; });

        const redeemRate = parseFloat(settings.loyalty_points_redeem_rate || '100');
        const minRedeem = parseFloat(settings.loyalty_min_redeem_points || '100');
        const cashValue = points / redeemRate;

        // Fetch transaction history
        const history = db.all(`
            SELECT * FROM loyalty_transactions 
            WHERE customer_id = ? 
            ORDER BY created_at DESC, id DESC
        `, [customerId]);

        res.json({
            customerId,
            customerName: customer.name,
            points,
            cashValue,
            minRedeem,
            redeemRate,
            history
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/loyalty/adjust
router.post('/adjust', async (req, res, next) => {
    try {
        await db.ready;
        const { customerId, points, note } = req.body;

        const custId = Number(customerId);
        const pts = parseInt(points, 10);

        if (!custId || isNaN(pts)) {
            return res.status(400).json({ error: 'Customer ID and points adjustment are required.' });
        }

        const customer = db.get('SELECT loyalty_points FROM customers WHERE id = ?', [custId]);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const currentPoints = customer.loyalty_points || 0;
        const newPoints = Math.max(0, currentPoints + pts);
        const actualAdjustment = newPoints - currentPoints; // Clamped adjustment

        if (actualAdjustment === 0) {
            return res.json({
                message: 'No adjustment made (points clamp to 0).',
                points: currentPoints
            });
        }

        db.transaction(() => {
            // Update customer points
            db.run('UPDATE customers SET loyalty_points = ? WHERE id = ?', [newPoints, custId]);

            // Handle points_remaining adjustments
            if (actualAdjustment > 0) {
                // Manual addition: insert ADJUST transaction with points_remaining = actualAdjustment, no expiry
                db.run(`
                    INSERT INTO loyalty_transactions (customer_id, type, points, balance_after, note, points_remaining, expiry_date)
                    VALUES (?, 'ADJUST', ?, ?, ?, ?, NULL)
                `, [custId, actualAdjustment, newPoints, note || 'Manual adjustment', actualAdjustment]);
            } else {
                // Manual deduction: consume points_remaining from active transactions using FIFO
                const activeTx = db.all(`
                    SELECT * FROM loyalty_transactions
                    WHERE customer_id = ?
                      AND points_remaining > 0
                      AND (expiry_date IS NULL OR expiry_date >= date('now', 'localtime'))
                    ORDER BY created_at ASC
                `, [custId]);

                let remaining = Math.abs(actualAdjustment);
                for (const tx of activeTx) {
                    if (remaining <= 0) break;
                    const deduct = Math.min(tx.points_remaining, remaining);
                    db.run('UPDATE loyalty_transactions SET points_remaining = points_remaining - ? WHERE id = ?', [deduct, tx.id]);
                    remaining -= deduct;
                }

                // Insert ADJUST transaction
                db.run(`
                    INSERT INTO loyalty_transactions (customer_id, type, points, balance_after, note, points_remaining, expiry_date)
                    VALUES (?, 'ADJUST', ?, ?, ?, 0, NULL)
                `, [custId, actualAdjustment, newPoints, note || 'Manual adjustment']);
            }
        });

        res.json({
            message: 'Points adjusted successfully',
            customerId: custId,
            points: newPoints
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
