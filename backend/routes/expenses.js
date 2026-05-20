const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/expenses - List with optional filters
router.get('/', async (req, res, next) => {
    try {
        await db.ready;
        let { startDate, endDate, date, categoryId } = req.query;
        
        if (date) {
            startDate = date;
            endDate = date;
        }

        let query = `
            SELECT e.*, c.name as category_name
            FROM expenses e
            LEFT JOIN expense_categories c ON e.category_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (startDate) {
            query += ` AND e.date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND e.date <= ?`;
            params.push(endDate);
        }
        if (categoryId) {
            query += ` AND e.category_id = ?`;
            params.push(categoryId);
        }

        query += ` ORDER BY e.date DESC, e.id DESC`;
        
        const expenses = db.all(query, params);
        res.json(expenses);
    } catch (err) {
        next(err);
    }
});

// GET /api/expenses/categories
router.get('/categories', async (req, res, next) => {
    try {
        await db.ready;
        const categories = db.all('SELECT * FROM expense_categories ORDER BY name ASC');
        res.json(categories);
    } catch (err) {
        next(err);
    }
});

// POST /api/expenses
router.post('/', async (req, res, next) => {
    try {
        await db.ready;
        const { category_id, amount, date, description, payment_mode, reference } = req.body;

        if (!amount || isNaN(amount)) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        const result = db.run(
            `INSERT INTO expenses (category_id, amount, date, description, payment_mode, reference)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [category_id || null, Number(amount), date || null, description || '', payment_mode || 'Cash', reference || '']
        );

        res.status(201).json({ id: result.lastInsertRowid, message: 'Expense recorded successfully' });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const result = db.run('DELETE FROM expenses WHERE id = ?', [req.params.id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        res.json({ message: 'Expense deleted successfully' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
