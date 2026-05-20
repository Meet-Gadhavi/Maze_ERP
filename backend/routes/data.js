const express = require('express');
const router = express.Router();
const db = require('../db');
const { TABLE_GROUPS } = require('../tableGroups');
const { z } = require('zod');

// Allowed tables from the database schema
const ALLOWED_TABLES = [
    'settings', 'categories', 'sub_categories', 'brands', 'products', 'product_variants', 
    'product_batches', 'customers', 'invoices', 'invoice_items', 'invoice_payments', 
    'invoice_returns', 'suppliers', 'purchases', 'purchase_items', 'supplier_payments', 
    'purchase_returns', 'stock_movements', 'expense_categories', 'expenses', 'audit_logs'
];

// Zod schema for import data structure
const importSchema = z.record(
    z.string().refine(val => ALLOWED_TABLES.includes(val), { message: "Invalid table name" }),
    z.array(z.record(z.string().regex(/^[a-zA-Z0-9_]+$/, "Invalid column name"), z.any()))
);

// GET /api/data/export
router.get('/export', async (req, res, next) => {
    try {
        await db.ready;
        const { startDate, endDate, categories } = req.query;
        const selectedCategories = categories ? categories.split(',') : Object.keys(TABLE_GROUPS);
        
        const exportData = {};
        
        for (const cat of selectedCategories) {
            const tables = TABLE_GROUPS[cat];
            if (!tables) continue;
            
            for (const table of tables) {
                let query = `SELECT * FROM ${table}`;
                const params = [];
                
                // Add date filtering if applicable
                if (startDate && endDate) {
                    if (table === 'invoices' || table === 'purchases') {
                        query += ` WHERE date BETWEEN ? AND ?`;
                        params.push(startDate, endDate);
                    } else if (table === 'invoice_returns' || table === 'purchase_returns' || table === 'supplier_payments' || table === 'audit_logs') {
                        query += ` WHERE created_at BETWEEN ? AND ?`;
                        params.push(startDate + ' 00:00:00', endDate + ' 23:59:59');
                    }
                }
                
                exportData[table] = db.all(query, params);
            }
        }
        
        // M045: Define import order (parent tables first) to avoid FK constraint errors on restore
        const EXPORT_ORDER = [
            'settings',
            'categories', 'subcategories', 'brands',
            'suppliers',
            'customers',
            'products', 'product_variants', 'product_batches',
            'purchases', 'purchase_items', 'purchase_returns', 'supplier_payments',
            'invoices', 'invoice_items', 'invoice_payments', 'invoice_returns',
            'expenses', 'stock_movements', 'audit_logs'
        ];

        res.json({
            version: '1.0.0',
            exported_at: new Date().toISOString(),
            _export_order: EXPORT_ORDER,
            data: exportData
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/data/import
router.post('/import', async (req, res, next) => {
    try {
        await db.ready;
        const { data } = req.body;
        
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        // C006: Zod validation for import data
        try {
            importSchema.parse(data);
        } catch (zodError) {
            return res.status(400).json({ error: 'Data validation failed', details: zodError.errors });
        }
        
        // Use a transaction for bulk import if possible, 
        // but sql.js doesn't support structured transactions easily via db.run
        // We will just loop and run inserts.
        
        for (const [table, rows] of Object.entries(data)) {
            if (!Array.isArray(rows) || rows.length === 0) continue;
            
            // Get valid columns for this table to avoid schema mismatch errors
            const tableInfo = db.all(`PRAGMA table_info(${table})`);
            const validColumns = tableInfo.map(c => c.name);
            
            const firstRowColumns = Object.keys(rows[0]);
            const columnsToInsert = firstRowColumns.filter(c => validColumns.includes(c));
            
            if (columnsToInsert.length === 0) continue;

            const placeholders = columnsToInsert.map(() => '?').join(', ');
            const sql = `INSERT OR REPLACE INTO ${table} (${columnsToInsert.join(', ')}) VALUES (${placeholders})`;
            
            for (const row of rows) {
                const values = columnsToInsert.map(col => row[col]);
                db.run(sql, values);
            }
        }
        
        res.json({ message: 'Data imported successfully' });
    } catch (err) {
        next(err);
    }
});

const backupUtil = require('../backupUtil');

// GET /api/data/backups
router.get('/backups', (req, res) => {
    try {
        const backups = backupUtil.getBackups();
        res.json(backups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/data/backup-cycle
router.post('/backup-cycle', async (req, res, next) => {
    try {
        await db.ready;
        const { cycle } = req.body;
        db.run("UPDATE settings SET value = ? WHERE key = 'backup_cycle'", [cycle]);
        res.json({ message: 'Backup cycle updated' });
    } catch (err) {
        next(err);
    }
});

// POST /api/data/backup-now
router.post('/backup-now', async (req, res, next) => {
    try {
        const { filename } = await backupUtil.runBackup();
        res.json({ message: 'Backup created', filename });
    } catch (err) {
        next(err);
    }
});

// POST /api/data/restore-backup
router.post('/restore-backup', async (req, res, next) => {
    try {
        await db.ready;
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ error: 'Filename is required' });
        
        const content = backupUtil.getBackupContent(filename);
        const data = content.data || content;
        
        // Loop and run inserts (similar to import logic)
        for (const [table, rows] of Object.entries(data)) {
            if (!Array.isArray(rows) || rows.length === 0) continue;
            
            // Get valid columns for this table to avoid schema mismatch errors
            const tableInfo = db.all(`PRAGMA table_info(${table})`);
            const validColumns = tableInfo.map(c => c.name);
            
            const firstRowColumns = Object.keys(rows[0]);
            const columnsToInsert = firstRowColumns.filter(c => validColumns.includes(c));
            
            if (columnsToInsert.length === 0) continue;

            const placeholders = columnsToInsert.map(() => '?').join(', ');
            const sql = `INSERT OR REPLACE INTO ${table} (${columnsToInsert.join(', ')}) VALUES (${placeholders})`;
            
            for (const row of rows) {
                const values = columnsToInsert.map(col => row[col]);
                db.run(sql, values);
            }
        }
        
        res.json({ message: 'Backup restored successfully' });
    } catch (err) {
        next(err);
    }
});

// POST /api/data/delete-backup
router.post('/delete-backup', async (req, res, next) => {
    try {
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ error: 'Filename is required' });
        
        const success = backupUtil.deleteBackup(filename);
        res.json({ success });
    } catch (err) {
        next(err);
    }
});

// GET /api/data/backup-content
router.get('/backup-content', (req, res) => {
    try {
        const { filename } = req.query;
        if (!filename) return res.status(400).json({ error: 'Filename is required' });
        const content = backupUtil.getBackupContent(filename);
        res.json(content);
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// GET /api/data/paths
router.get('/paths', (req, res) => {
    try {
        const { dbDir } = require('../db');
        res.json({
            dbDir: dbDir || path.join(process.env.MAZE_USER_DATA || path.join(__dirname, '..', 'data'), 'Live'),
            backupDir: backupUtil.backupDir
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
