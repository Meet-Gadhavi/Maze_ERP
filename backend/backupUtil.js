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

function formatToMarkdown(data) {
    let md = `# Quantro ERP - Business Database Snapshot\n\n`;
    md += `**Snapshot Timestamp:** ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n`;
    md += `**Target System Timezone:** Asia/Kolkata\n\n`;

    // 1. Products
    md += `## Products & Inventory\n\n`;
    if (data.products && data.products.length > 0) {
        md += `| Product ID | Code/SKU | Name | Category | Unit | Cost Price | Selling Price | Stock Qty | Min Level | Track Batches |\n`;
        md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        data.products.forEach(p => {
            md += `| ${p.id} | ${p.product_code || 'N/A'} | ${p.name || ''} | ${p.category || 'General'} | ${p.unit || 'PCS'} | ₹${p.cost_price || 0} | ₹${p.selling_price || 0} | ${p.stock_quantity || 0} | ${p.min_stock_level || 5} | ${p.track_batches ? 'Yes' : 'No'} |\n`;
        });
    } else {
        md += `No products found.\n`;
    }
    md += `\n`;

    // 2. Customers
    md += `## Customers & Credit Balances\n\n`;
    if (data.customers && data.customers.length > 0) {
        md += `| Customer ID | Name | Phone | Email | Address | GSTIN | Credit Limit | Credit Balance |\n`;
        md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        data.customers.forEach(c => {
            md += `| ${c.id} | ${c.name || ''} | ${c.phone || ''} | ${c.email || ''} | ${c.address || ''} | ${c.gstin || ''} | ₹${c.credit_limit || 0} | ₹${c.p_credit_balance || 0} |\n`;
        });
    } else {
        md += `No customers found.\n`;
    }
    md += `\n`;

    // 3. Recent Sales Invoices
    md += `## Recent Invoices (Sales)\n\n`;
    if (data.invoices && data.invoices.length > 0) {
        const sortedInvoices = [...data.invoices]
            .sort((a,b) => b.id - a.id)
            .slice(0, 50);
        md += `| Invoice ID | Date | Customer ID | Walk-in Name | Walk-in Phone | Total | Financial Status | Delivery Status |\n`;
        md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        sortedInvoices.forEach(inv => {
            md += `| ${inv.id} | ${inv.date || ''} | ${inv.customer_id || 'N/A'} | ${inv.walk_in_name || ''} | ${inv.walk_in_phone || ''} | ₹${inv.total || 0} | ${inv.financial_status || 'Paid'} | ${inv.delivery_status || 'Delivered'} |\n`;
        });
    } else {
        md += `No invoices found.\n`;
    }
    md += `\n`;

    // 4. Recent Invoice Items
    md += `## Recent Invoice Items\n\n`;
    if (data.invoice_items && data.invoice_items.length > 0) {
        const recentInvoiceIds = new Set((data.invoices || []).sort((a,b) => b.id - a.id).slice(0, 50).map(i => i.id));
        const filteredItems = data.invoice_items.filter(item => recentInvoiceIds.has(item.invoice_id));
        
        md += `| Item ID | Invoice ID | Product ID | Product Name | Quantity | Price | Total |\n`;
        md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        filteredItems.forEach(item => {
            md += `| ${item.id} | ${item.invoice_id} | ${item.product_id || 'N/A'} | ${item.product_name || ''} | ${item.quantity || 0} | ₹${item.price || 0} | ₹${item.total || 0} |\n`;
        });
    } else {
        md += `No invoice items found.\n`;
    }
    md += `\n`;

    // 5. Settings
    md += `## General Business Configuration\n\n`;
    if (data.settings && data.settings.length > 0) {
        md += `| Key | Value |\n`;
        md += `| :--- | :--- |\n`;
        data.settings.forEach(s => {
            if (s.key.includes('token') || s.key.includes('secret') || s.key.includes('key')) {
                md += `| ${s.key} | [REDACTED] |\n`;
            } else {
                md += `| ${s.key} | ${s.value || ''} |\n`;
            }
        });
    } else {
        md += `No settings found.\n`;
    }
    md += `\n`;

    return md;
}

async function generateMarkdownBackup(agentId) {
    const data = await exportData();
    const formattedMd = formatToMarkdown(data);
    
    const agentFolder = path.join(backupDir, agentId);
    if (!fs.existsSync(agentFolder)) {
        fs.mkdirSync(agentFolder, { recursive: true });
    }
    
    const filepath = path.join(agentFolder, 'ERP_Backup.md');
    fs.writeFileSync(filepath, formattedMd, 'utf8');
    
    return { filepath, content: formattedMd };
}

module.exports = { 
    runBackup, 
    getBackups, 
    getBackupContent, 
    deleteBackup, 
    backupDir,
    generateMarkdownBackup
};
