const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/dashboard?range=7days|2months|6months|12months
router.get('/', async (req, res, next) => {
    try {
        await db.ready;
        const { range = '7days' } = req.query;

        // Date range setup
        let rangeSql = "'-6 days'";
        if (range === '2months') rangeSql = "'-60 days'";
        if (range === '6months') rangeSql = "'-180 days'";
        if (range === '12months') rangeSql = "'-365 days'";

        // ─────────────────────────────────────────────
        // KPI CARDS (top row)
        // ─────────────────────────────────────────────
        const totalProducts = db.get('SELECT COUNT(*) AS count FROM products').count;
        const totalCustomers = db.get('SELECT COUNT(*) AS count FROM customers').count;

        const today = new Date().toISOString().slice(0, 10);
        const salesToday = db.get(
            'SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE date = ?', [today]
        ).total;

        const lowStockCount = db.get(
            'SELECT COUNT(*) AS count FROM products WHERE stock_quantity <= min_stock_level AND stock_quantity > 0'
        ).count;

        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        const monthStr = currentMonthStart.toISOString().slice(0, 10);
        const monthlyRevenue = db.get(
            'SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE date >= ?', [monthStr]
        ).total;

        const totalOrders = db.get(
            `SELECT COUNT(*) AS count FROM invoices WHERE date >= date('now', 'localtime', ${rangeSql})`
        ).count;

        const outstandingRow = db.get(
            `SELECT COALESCE(SUM(total - paid_amount), 0) AS total, COUNT(*) AS count
             FROM invoices WHERE payment_status NOT IN ('Paid','PAID','Returned') AND (total - paid_amount) > 0`
        );
        const outstandingDues = { total: outstandingRow.total || 0, count: outstandingRow.count || 0 };

        const aiOrdersCount = (() => {
            try {
                return db.get('SELECT COUNT(*) AS count FROM mazeway_orders').count;
            } catch (e) { return 0; }
        })();

        // ─────────────────────────────────────────────
        // SALES ANALYTICS
        // ─────────────────────────────────────────────

        // 1. Sales over time (area chart)
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

        // 2. Orders vs Revenue (bar chart dual axis)
        const ordersVsRevenue = db.all(`
            WITH RECURSIVE days(date) AS (
                SELECT date('now', 'localtime', ${rangeSql})
                UNION ALL
                SELECT date(date, '+1 day') FROM days WHERE date < date('now', 'localtime')
            )
            SELECT d.date,
                   COALESCE(COUNT(i.id), 0) AS orders,
                   COALESCE(SUM(i.total), 0) AS revenue
            FROM days d
            LEFT JOIN invoices i ON d.date = i.date
            GROUP BY d.date
            ORDER BY d.date ASC
        `);

        // 3. Top Selling Products (by units sold)
        const topSellingProducts = db.all(`
            SELECT ii.product_name AS name, SUM(ii.quantity) AS value
            FROM invoice_items ii
            JOIN invoices inv ON ii.invoice_id = inv.id
            WHERE inv.date >= date('now', 'localtime', ${rangeSql})
            GROUP BY ii.product_id
            ORDER BY value DESC
            LIMIT 10
        `);

        // 4. Category Distribution (by product count in inventory)
        const categoryDistribution = db.all(`
            SELECT category AS name, COUNT(*) AS value
            FROM products
            GROUP BY category
        `);

        // 5. Category Sales (by revenue in period)
        const categorySales = db.all(`
            SELECT p.category AS name, COALESCE(SUM(ii.total), 0) AS value
            FROM invoice_items ii
            JOIN invoices inv ON ii.invoice_id = inv.id
            LEFT JOIN products p ON ii.product_id = p.id
            WHERE inv.date >= date('now', 'localtime', ${rangeSql})
              AND p.category IS NOT NULL AND p.category != ''
            GROUP BY p.category
            ORDER BY value DESC
        `);

        // 6. Peak Selling Hours
        const peakSellingHours = (() => {
            try {
                return db.all(`
                    SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour,
                           COALESCE(SUM(total), 0) AS revenue,
                           COUNT(*) AS orders
                    FROM invoices
                    WHERE date >= date('now', 'localtime', ${rangeSql})
                    GROUP BY hour
                    ORDER BY hour ASC
                `);
            } catch (e) { return []; }
        })();

        // 7. Return Analytics
        const returnAnalytics = (() => {
            try {
                return db.all(`
                    SELECT date(return_date) AS date,
                           COUNT(*) AS count,
                           COALESCE(SUM(total_returned_amount), 0) AS amount
                    FROM invoice_returns
                    WHERE return_date >= date('now', 'localtime', ${rangeSql})
                    GROUP BY date(return_date)
                    ORDER BY date ASC
                `);
            } catch (e) { return []; }
        })();

        // 8. Recent Transactions
        const recentTransactions = db.all(`
            SELECT i.id, i.total, i.date, i.created_at,
                   COALESCE(c.name, i.walk_in_name, 'Walk-in Customer') AS customer_name,
                   i.payment_status, i.paid_amount
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            ORDER BY i.created_at DESC
            LIMIT 10
        `);

        // ─────────────────────────────────────────────
        // INVENTORY ANALYTICS
        // ─────────────────────────────────────────────

        // 9. Inventory Value
        const inventoryValue = db.get(
            'SELECT COALESCE(SUM(cost_price * stock_quantity), 0) AS total FROM products'
        ).total;

        // 10. Low Stock Products list
        const lowStockProducts = db.all(`
            SELECT name, stock_quantity, min_stock_level, unit
            FROM products
            WHERE stock_quantity <= min_stock_level AND stock_quantity >= 0
            ORDER BY (stock_quantity * 1.0 / NULLIF(min_stock_level, 0)) ASC
            LIMIT 10
        `);

        // 11. Fast vs Slow Moving Products
        const fastMoving = db.all(`
            SELECT ii.product_name AS name, SUM(ii.quantity) AS sold
            FROM invoice_items ii
            JOIN invoices inv ON ii.invoice_id = inv.id
            WHERE inv.date >= date('now', 'localtime', ${rangeSql})
            GROUP BY ii.product_id
            ORDER BY sold DESC
            LIMIT 5
        `);

        const slowMoving = db.all(`
            SELECT p.name, COALESCE(SUM(ii.quantity), 0) AS sold
            FROM products p
            LEFT JOIN invoice_items ii ON ii.product_id = p.id
            LEFT JOIN invoices inv ON ii.invoice_id = inv.id
                AND inv.date >= date('now', 'localtime', ${rangeSql})
            GROUP BY p.id
            ORDER BY sold ASC
            LIMIT 5
        `);

        // 12. Stock Movement Trend
        const stockMovementTrend = (() => {
            try {
                return db.all(`
                    WITH RECURSIVE days(date) AS (
                        SELECT date('now', 'localtime', ${rangeSql})
                        UNION ALL
                        SELECT date(date, '+1 day') FROM days WHERE date < date('now', 'localtime')
                    )
                    SELECT d.date,
                           COALESCE(SUM(CASE WHEN sm.type='IN' THEN sm.quantity ELSE 0 END), 0) AS stock_in,
                           COALESCE(SUM(CASE WHEN sm.type='OUT' THEN sm.quantity ELSE 0 END), 0) AS stock_out
                    FROM days d
                    LEFT JOIN stock_movements sm ON d.date = sm.date
                    GROUP BY d.date
                    ORDER BY d.date ASC
                `);
            } catch (e) { return []; }
        })();

        // 12b. Category-wise Selling (customer counts per category in period)
        const categoryCustomerCount = db.all(`
            SELECT p.category AS name, 
                   COUNT(DISTINCT COALESCE(inv.customer_id, NULLIF(inv.walk_in_name, ''), 'walk-in-' || inv.id)) AS customer_count
            FROM invoice_items ii
            JOIN invoices inv ON ii.invoice_id = inv.id
            LEFT JOIN products p ON ii.product_id = p.id
            WHERE inv.date >= date('now', 'localtime', ${rangeSql})
              AND p.category IS NOT NULL AND p.category != ''
            GROUP BY p.category
            ORDER BY customer_count DESC
        `);

        // 12c. Subcategory-wise Selling (customer counts per subcategory in period)
        const subcategoryCustomerCount = db.all(`
            SELECT p.category AS category_name,
                   COALESCE(sc.name, 'Uncategorized') AS name, 
                   COUNT(DISTINCT COALESCE(inv.customer_id, NULLIF(inv.walk_in_name, ''), 'walk-in-' || inv.id)) AS customer_count
            FROM invoice_items ii
            JOIN invoices inv ON ii.invoice_id = inv.id
            LEFT JOIN products p ON ii.product_id = p.id
            LEFT JOIN sub_categories sc ON p.subcategory_id = sc.id
            WHERE inv.date >= date('now', 'localtime', ${rangeSql})
              AND p.category IS NOT NULL AND p.category != ''
            GROUP BY p.category, COALESCE(sc.name, 'Uncategorized')
            ORDER BY customer_count DESC
        `);

        // ─────────────────────────────────────────────
        // CUSTOMER ANALYTICS
        // ─────────────────────────────────────────────

        // 13. Top Customers by Revenue
        const topCustomers = db.all(`
            SELECT COALESCE(c.name, i.walk_in_name, 'Walk-in') AS name,
                   COALESCE(SUM(i.total), 0) AS total_spent,
                   COUNT(i.id) AS invoice_count
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE i.date >= date('now', 'localtime', ${rangeSql})
            GROUP BY i.customer_id
            ORDER BY total_spent DESC
            LIMIT 8
        `);

        // 14. Customer Growth
        const customerGrowth = db.all(`
            WITH RECURSIVE days(date) AS (
                SELECT date('now', 'localtime', ${rangeSql})
                UNION ALL
                SELECT date(date, '+1 day') FROM days WHERE date < date('now', 'localtime')
            )
            SELECT d.date, COUNT(c.id) AS new_customers
            FROM days d
            LEFT JOIN customers c ON date(c.created_at) = d.date
            GROUP BY d.date
            ORDER BY d.date ASC
        `);

        // 15. Repeat vs New Customers
        const repeatVsNew = (() => {
            const repeatCount = db.get(`
                SELECT COUNT(*) AS count FROM (
                    SELECT customer_id FROM invoices
                    WHERE customer_id IS NOT NULL
                    GROUP BY customer_id
                    HAVING COUNT(*) > 1
                )
            `).count;
            const newCount = db.get(`
                SELECT COUNT(*) AS count FROM (
                    SELECT customer_id FROM invoices
                    WHERE customer_id IS NOT NULL
                    GROUP BY customer_id
                    HAVING COUNT(*) = 1
                )
            `).count;
            return { repeat: repeatCount, new: newCount };
        })();

        // 16. Dues by Payment Status
        const duesByStatus = (() => {
            const rows = db.all(`
                SELECT payment_status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
                FROM invoices
                WHERE date >= date('now', 'localtime', ${rangeSql})
                GROUP BY payment_status
            `);
            const result = { Paid: 0, Partial: 0, Unpaid: 0 };
            rows.forEach(r => {
                const s = (r.payment_status || '').toLowerCase();
                if (s === 'paid') result.Paid += r.count;
                else if (s === 'partial') result.Partial += r.count;
                else result.Unpaid += r.count;
            });
            return result;
        })();

        // ─────────────────────────────────────────────
        // PAYMENT ANALYTICS
        // ─────────────────────────────────────────────

        // 17. Payment Method Breakdown
        const paymentMethodBreakdown = (() => {
            try {
                return db.all(`
                    SELECT method, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
                    FROM invoice_payments
                    WHERE payment_date >= date('now', 'localtime', ${rangeSql})
                    GROUP BY method
                    ORDER BY total DESC
                `);
            } catch (e) {
                // Fallback to invoices.payment_method if invoice_payments table doesn't have data
                return db.all(`
                    SELECT payment_method AS method,
                           COALESCE(SUM(paid_amount), 0) AS total,
                           COUNT(*) AS count
                    FROM invoices
                    WHERE date >= date('now', 'localtime', ${rangeSql})
                      AND payment_method IS NOT NULL AND payment_method != ''
                    GROUP BY payment_method
                    ORDER BY total DESC
                `);
            }
        })();

        // 18. Advance Invoice Count
        const advanceCount = (() => {
            try {
                return db.get(`SELECT COUNT(*) AS count FROM invoices WHERE is_advance = 1`).count;
            } catch (e) { return 0; }
        })();

        // ─────────────────────────────────────────────
        // AI / AUTOMATION ANALYTICS
        // ─────────────────────────────────────────────

        const aiStats = (() => {
            try {
                const total = db.get('SELECT COUNT(*) AS count FROM mazeway_orders').count;
                const confirmed = db.get(
                    "SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue FROM mazeway_orders WHERE status = 'CONFIRMED'"
                );
                const voice = db.get("SELECT COUNT(*) AS count FROM mazeway_orders WHERE type = 'Voice'").count;
                const whatsapp = db.get("SELECT COUNT(*) AS count FROM mazeway_orders WHERE type = 'WhatsApp'").count;
                return {
                    totalOrders: total,
                    confirmedRevenue: confirmed.revenue || 0,
                    confirmedOrders: confirmed.count || 0,
                    voiceCount: voice,
                    whatsappCount: whatsapp
                };
            } catch (e) {
                return { totalOrders: 0, confirmedRevenue: 0, confirmedOrders: 0, voiceCount: 0, whatsappCount: 0 };
            }
        })();

        const aiVsManual = (() => {
            try {
                const aiOrders = db.get(
                    `SELECT COUNT(*) AS count FROM mazeway_orders WHERE date(created_at) >= date('now', 'localtime', ${rangeSql})`
                ).count;
                const manualOrders = db.get(
                    `SELECT COUNT(*) AS count FROM invoices WHERE date >= date('now', 'localtime', ${rangeSql})`
                ).count;
                return { aiOrders, manualOrders };
            } catch (e) { return { aiOrders: 0, manualOrders: 0 }; }
        })();

        const aiOrdersByDay = (() => {
            try {
                return db.all(`
                    WITH RECURSIVE days(date) AS (
                        SELECT date('now', 'localtime', ${rangeSql})
                        UNION ALL
                        SELECT date(date, '+1 day') FROM days WHERE date < date('now', 'localtime')
                    )
                    SELECT d.date, COALESCE(COUNT(m.id), 0) AS count
                    FROM days d
                    LEFT JOIN mazeway_orders m ON date(m.created_at) = d.date
                    GROUP BY d.date
                    ORDER BY d.date ASC
                `);
            } catch (e) { return []; }
        })();

        // ─────────────────────────────────────────────
        // FINANCIAL ANALYTICS
        // ─────────────────────────────────────────────

        // 19. Total Expenses for period
        const totalExpenses = (() => {
            try {
                return db.get(
                    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE date >= date('now', 'localtime', ${rangeSql})`
                ).total;
            } catch (e) { return 0; }
        })();

        // 20. Estimated Gross Profit
        const estimatedProfit = (() => {
            try {
                return db.get(`
                    SELECT COALESCE(SUM((ii.price - COALESCE(ii.cost_price, p.cost_price, 0)) * ii.quantity), 0) AS profit
                    FROM invoice_items ii
                    JOIN invoices inv ON ii.invoice_id = inv.id
                    LEFT JOIN products p ON ii.product_id = p.id
                    WHERE inv.date >= date('now', 'localtime', ${rangeSql})
                `).profit;
            } catch (e) { return 0; }
        })();

        // 21. Revenue vs Expenses trend
        const revenueVsExpenses = (() => {
            try {
                const revRows = db.all(`
                    WITH RECURSIVE days(date) AS (
                        SELECT date('now', 'localtime', ${rangeSql})
                        UNION ALL
                        SELECT date(date, '+1 day') FROM days WHERE date < date('now', 'localtime')
                    )
                    SELECT d.date, COALESCE(SUM(i.total), 0) AS revenue
                    FROM days d
                    LEFT JOIN invoices i ON d.date = i.date
                    GROUP BY d.date
                    ORDER BY d.date ASC
                `);
                const expRows = db.all(`
                    SELECT date, COALESCE(SUM(amount), 0) AS expenses
                    FROM expenses
                    WHERE date >= date('now', 'localtime', ${rangeSql})
                    GROUP BY date
                `);
                const expMap = {};
                expRows.forEach(r => { expMap[r.date] = r.expenses; });
                return revRows.map(r => ({ date: r.date, revenue: r.revenue, expenses: expMap[r.date] || 0 }));
            } catch (e) { return []; }
        })();

        // 22. Purchase Total for period
        const purchaseTotal = (() => {
            try {
                return db.get(
                    `SELECT COALESCE(SUM(grand_total), 0) AS total FROM purchases WHERE date(purchase_date) >= date('now', 'localtime', ${rangeSql})`
                ).total;
            } catch (e) { return 0; }
        })();

        // 23. Expenses by Category
        const expensesByCategory = (() => {
            try {
                return db.all(`
                    SELECT ec.name, COALESCE(SUM(e.amount), 0) AS amount
                    FROM expenses e
                    LEFT JOIN expense_categories ec ON e.category_id = ec.id
                    WHERE e.date >= date('now', 'localtime', ${rangeSql})
                    GROUP BY e.category_id
                    ORDER BY amount DESC
                `);
            } catch (e) { return []; }
        })();

        // ─────────────────────────────────────────────
        // SEND RESPONSE
        // ─────────────────────────────────────────────
        res.json({
            // Core KPIs
            totalProducts,
            totalCustomers,
            salesToday,
            lowStockCount,
            monthlyRevenue,
            totalOrders,
            outstandingDues,
            aiOrdersCount,

            // Sales
            salesOverTime,
            ordersVsRevenue,
            topSellingProducts,
            categoryDistribution,
            categorySales,
            peakSellingHours,
            returnAnalytics,
            recentTransactions,

            // Inventory
            inventoryValue,
            lowStockProducts,
            fastMoving,
            slowMoving,
            stockMovementTrend,
            categoryCustomerCount,
            subcategoryCustomerCount,

            // Customers
            topCustomers,
            customerGrowth,
            repeatVsNew,
            duesByStatus,

            // Payment
            paymentMethodBreakdown,
            advanceCount,

            // AI
            aiStats,
            aiVsManual,
            aiOrdersByDay,

            // Financial
            totalExpenses,
            estimatedProfit,
            revenueVsExpenses,
            purchaseTotal,
            expensesByCategory
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
