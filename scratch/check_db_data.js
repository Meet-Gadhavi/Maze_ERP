const db = require('../backend/db');

async function checkData() {
  await db.ready;
  const tables = [
    'products', 'customers', 'invoices', 'invoice_items', 'settings'
  ];
  
  console.log('--- Database Status ---');
  for (const table of tables) {
    const res = db.get(`SELECT COUNT(*) as count FROM ${table}`);
    console.log(`${table}: ${res ? res.count : 'Error'}`);
  }
}

checkData().catch(console.error);
