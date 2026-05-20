const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/dashboard
router.get('/', async (req, res, next) => {
    try {
        await db.ready;
        const { range = '7days' } = req.query;

        const totalProducts = db.get('SELECT COUNT(*) AS count FROM products').count;
        const totalCustomers = db.get('SELECT COUNT(*) AS count FROM customers').count;

        const today = new Date().toISOString().slice(0, 10);
        const salesToday = db.get(
            'SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE date = ?', [today]
        ).total;

        const lowStockCount = db.get(
            'SELECT COUNT(*) AS count FROM products WHERE stock_quantity <= 5'
        ).count;

        // --- NEW GRAPH DATA ---
        let rangeSql = "'-6 days'"; // default 7 days
        if (range === '2months') rangeSql = "'-60 days'";
        if (range === '6months') rangeSql = "'-180 days'";
        if (range === '12months') rangeSql = "'-365 days'";

        // 1. Sales over the selected range
        const salesOverTime = db.all(`
            WITH RECURSIVE days(date) AS (
                SELECT date('now', 'localtime', ${rangeSql})
                UNION ALL
                SELECT date(date, '+1 day') FROM days WHERE date < date('now', 'localtime')
            )
            SELECT d.date, COALESCE(SUM(i.total), 0) AS total
            FROM days d
            LEFT JOIN invoices i ON d.date = i.date
            GROUP BY d.date
            ORDER BY d.date ASC
        `);

        // 2. Category distribution
        const categoryDistribution = db.all(`
            SELECT category AS name, COUNT(*) AS value
            FROM products
            GROUP BY category
        `);

        // 3. Top selling products
        const topSellingProducts = db.all(`
            SELECT product_name AS name, SUM(quantity) AS value
            FROM invoice_items
            GROUP BY product_id
            ORDER BY value DESC
            LIMIT 10
        `);

        const recentTransactions = db.all(`
      SELECT i.id, i.total, i.date, i.created_at,
             c.name AS customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC
      LIMIT 10
    `);

        res.json({
            totalProducts,
            totalCustomers,
            salesToday,
            lowStockCount,
            salesOverTime,
            categoryDistribution,
            topSellingProducts,
            recentTransactions
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
