const db = require('./backend/db.js');

async function run() {
    await db.ready;
    console.log('Database ready.');

    try {
        const subcategories = db.all('SELECT * FROM sub_categories');
        console.log('SUBCATEGORIES:');
        console.log(JSON.stringify(subcategories, null, 2));

        const categories = db.all('SELECT * FROM categories');
        console.log('CATEGORIES:');
        console.log(JSON.stringify(categories, null, 2));

        const products = db.all('SELECT id, name, category, subcategory_id FROM products LIMIT 20');
        console.log('PRODUCTS (limit 20):');
        console.log(JSON.stringify(products, null, 2));
    } catch (e) {
        console.error('Error running query:', e);
    }
    process.exit(0);
}

run();
