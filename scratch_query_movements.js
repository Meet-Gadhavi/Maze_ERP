const db = require('./backend/db.js');

async function run() {
    await db.ready;
    try {
        const movements = db.all('SELECT * FROM stock_movements');
        console.log('STOCK_MOVEMENTS:');
        console.log(JSON.stringify(movements, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}

run();
