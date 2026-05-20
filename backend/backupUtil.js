const fs = require('fs');
const path = require('path');
const db = require('./db');

const backupDir = path.join(process.env.MAZE_USER_DATA || path.join(__dirname, '..', 'data'), 'Backups');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

async function exportData() {
    await db.ready;
    const tables = [
        'settings', 'categories', 'sub_categories', 'brands',
        'suppliers', 'customers', 'products', 'product_variants',
        'product_batches', 'purchases', 'purchase_items', 'purchase_returns',
        'supplier_payments', 'invoices', 'invoice_items', 'invoice_payments',
        'invoice_returns', 'expense_categories', 'expenses', 'stock_movements', 
        'audit_logs', 'mazeway_orders', 'mazeway_agents'
    ];
    const data = {};
    for (const table of tables) {
        try {
            data[table] = await db.all(`SELECT * FROM ${table}`);
        } catch (e) {
            console.warn(`[Backup] Table ${table} not found or inaccessible: ${e.message}`);
            data[table] = [];
        }
    }
    return data;
}

async function runBackup() {
    const data = await exportData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(backupDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    return { filename, path: filepath };
}

function getBackups() {
    if (!fs.existsSync(backupDir)) return [];
    return fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.json'))
        .map(file => {
            const stat = fs.statSync(path.join(backupDir, file));
            return {
                filename: file,
                size: stat.size,
                created_at: stat.birthtime
            };
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 50); // Cap at 50 most recent to keep the list fast
}

function getBackupContent(filename) {
    const safeFilename = path.basename(filename);
    const filepath = path.join(backupDir, safeFilename);
    if (!fs.existsSync(filepath)) throw new Error('Backup file not found');
    const content = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(content);
}

function deleteBackup(filename) {
    const safeFilename = path.basename(filename);
    const filepath = path.join(backupDir, safeFilename);
    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        return true;
    }
    return false;
}

module.exports = { runBackup, getBackups, getBackupContent, deleteBackup, backupDir };
