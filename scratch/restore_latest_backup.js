const db = require('../backend/db');
const fs = require('fs');
const path = require('path');

async function restoreLatest() {
  await db.ready;
  
  const backupFile = 'Maze_ERP_AutoBackup_2026-04-26T07-05-15-502Z.json';
  const backupPath = path.join(__dirname, '..', 'backups', backupFile);
  
  if (!fs.existsSync(backupPath)) {
    console.error('Backup file not found:', backupPath);
    return;
  }
  
  console.log('Restoring from:', backupFile);
  const content = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const data = content.data || content;
  
  db.transaction(() => {
    // Parent tables first to avoid FK issues
    const tables = [
      'settings', 'categories', 'sub_categories', 'brands', 'suppliers',
      'customers', 'products', 'product_variants', 'product_batches',
      'purchases', 'purchase_items', 'purchase_returns', 'supplier_payments',
      'invoices', 'invoice_items', 'invoice_payments', 'invoice_returns',
      'expenses', 'stock_movements', 'audit_logs'
    ];
    
    for (const table of tables) {
      const rows = data[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      
      console.log(`Restoring table: ${table} (${rows.length} rows)`);
      
      // Get valid columns for this table
      const tableInfo = db.all(`PRAGMA table_info(${table})`);
      const validColumns = tableInfo.map(c => c.name);
      
      const firstRowColumns = Object.keys(rows[0]);
      const columnsToInsert = firstRowColumns.filter(c => validColumns.includes(c));
      
      if (columnsToInsert.length === 0) {
        console.warn(`No valid columns found for table: ${table}`);
        continue;
      }

      const placeholders = columnsToInsert.map(() => '?').join(', ');
      const sql = `INSERT OR REPLACE INTO ${table} (${columnsToInsert.join(', ')}) VALUES (${placeholders})`;
      
      for (const row of rows) {
        const values = columnsToInsert.map(col => row[col]);
        db.run(sql, values);
      }
    }
  });
  
  console.log('Restore completed successfully!');
}

restoreLatest().catch(console.error);
