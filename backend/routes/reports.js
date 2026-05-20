const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/reports/daily?date=YYYY-MM-DD
router.get('/daily', async (req, res, next) => {
    try {
        await db.ready;
        const date = req.query.date || new Date().toISOString().slice(0, 10);

        // 1. Sales Summary
        const salesSummary = db.get(`
            SELECT 
                COUNT(*) as total_invoices,
                COALESCE(SUM(total), 0) as total_sales,
                COALESCE(SUM(paid_amount), 0) as total_collected,
                COALESCE(SUM(total - paid_amount), 0) as total_due
            FROM invoices 
            WHERE date = ?
        `, [date]);

        // 2. Payment Breakdown
        const payments = db.all(`
            SELECT 
                method, 
                SUM(amount) as total 
            FROM invoice_payments 
            WHERE DATE(payment_date) = ?
            GROUP BY method
        `, [date]);

        // 3. Product Sales
        const productSales = db.all(`
            SELECT 
                product_name, 
                SUM(quantity) as quantity, 
                SUM(total) as total
            FROM invoice_items
            WHERE invoice_id IN (SELECT id FROM invoices WHERE date = ?)
            GROUP BY product_id
            ORDER BY quantity DESC
        `, [date]);

        // 4. Returns Summary
        const returnsSummary = db.get(`
            SELECT 
                COALESCE(SUM(return_amount), 0) as total_returned
            FROM invoice_returns
            WHERE DATE(return_date) = ?
        `, [date]);

        res.json({
            date,
            salesSummary,
            payments,
            productSales,
            returnsSummary
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
