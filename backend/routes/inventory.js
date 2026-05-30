const express = require('express');
const router = express.Router();
const db = require('../db');

// M050: Ensure search indexes exist for product lookup performance
db.ready.then(() => {
    try {
        db.run('CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)');
        db.run('CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code)');
        db.run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)');
    } catch (_) { /* indexes may already exist */ }
});

// GET /api/products
router.get('/', async (req, res, next) => {
    try {
        await db.ready;
        const { search, category, subcategory_id, brand_id } = req.query;
        let sql = `
            SELECT p.*, c.name as category_name, sc.name as subcategory_name, b.name as brand_name 
            FROM products p
            LEFT JOIN categories c ON p.category = c.name
            LEFT JOIN sub_categories sc ON p.subcategory_id = sc.id
            LEFT JOIN brands b ON p.brand_id = b.id
        `;
        const conditions = [];
        const params = [];

        if (search) {
            conditions.push("(p.name LIKE ? OR p.product_code LIKE ? OR p.tags LIKE ?)");
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (category && category !== 'All') {
            conditions.push('p.category = ?');
            params.push(category);
        }
        if (subcategory_id) {
            conditions.push('p.subcategory_id = ?');
            params.push(Number(subcategory_id));
        }
        if (brand_id) {
            conditions.push('p.brand_id = ?');
            params.push(Number(brand_id));
        }
        if (conditions.length) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY p.created_at DESC';

        const products = db.all(sql, params);
        res.json(products);
    } catch (err) {
        next(err);
    }
});

// GET /api/products/categories
router.get('/categories', async (_req, res, next) => {
    try {
        await db.ready;
        const rows = db.all('SELECT name FROM categories ORDER BY name');
        res.json(rows.map(r => r.name));
    } catch (err) {
        next(err);
    }
});

// POST /api/products/categories
router.post('/categories', async (req, res, next) => {
    try {
        await db.ready;
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Category name is required' });

        db.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', [name.trim()]);
        res.status(201).json({ name: name.trim() });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/products/categories/:name
router.delete('/categories/:name', async (req, res, next) => {
    try {
        await db.ready;
        const { name } = req.params;

        // Check if any products use this category
        const productCount = db.get('SELECT COUNT(*) as count FROM products WHERE category = ?', [name]).count;
        if (productCount > 0) {
            return res.status(400).json({ error: 'Cannot delete category with existing products' });
        }

        db.run('DELETE FROM categories WHERE name = ?', [name]);
        res.json({ message: 'Category deleted', name });
    } catch (err) {
        next(err);
    }
});

// PUT /api/products/categories/:name
router.put('/categories/:name', async (req, res, next) => {
    try {
        await db.ready;
        const oldName = req.params.name;
        const { newName } = req.body;
        if (!newName) return res.status(400).json({ error: 'New category name is required' });

        // Check if new name already exists
        const exists = db.get('SELECT id FROM categories WHERE name = ?', [newName.trim()]);
        if (exists && exists.name !== oldName) {
            return res.status(400).json({ error: 'A category with this name already exists' });
        }

        db.run('BEGIN TRANSACTION');
        try {
            // Update the category name
            db.run('UPDATE categories SET name = ? WHERE name = ?', [newName.trim(), oldName]);
            // Update all products holding this category name
            db.run('UPDATE products SET category = ? WHERE category = ?', [newName.trim(), oldName]);
            db.run('COMMIT');
            res.json({ oldName, newName: newName.trim() });
        } catch (e) {
            db.run('ROLLBACK');
            throw e;
        }
    } catch (err) {
        next(err);
    }
});

// SUB-CATEGORIES
router.get('/subcategories', async (req, res, next) => {
    try {
        await db.ready;
        const { category_id } = req.query;
        let sql = `
            SELECT sc.*, c.name as category_name 
            FROM sub_categories sc
            LEFT JOIN categories c ON sc.category_id = c.id
        `;
        const conditions = [];
        const params = [];
        if (category_id) {
            conditions.push('sc.category_id = ?');
            params.push(Number(category_id));
        }
        if (conditions.length) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        const rows = db.all(sql + ' ORDER BY sc.name', params);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

router.post('/subcategories', async (req, res, next) => {
    try {
        await db.ready;
        const { name, category_id, category_name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        
        let finalCategoryId = Number(category_id);
        if (category_name) {
            const catRow = db.get('SELECT id FROM categories WHERE name = ?', [category_name.trim()]);
            if (catRow) {
                finalCategoryId = catRow.id;
            }
        }
        
        if (!finalCategoryId) {
            return res.status(400).json({ error: 'Category ID or category name is required' });
        }

        const result = db.run('INSERT INTO sub_categories (name, category_id) VALUES (?, ?)', [name.trim(), finalCategoryId]);
        res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), category_id: finalCategoryId });
    } catch (err) {
        next(err);
    }
});

router.delete('/subcategories/:id', async (req, res, next) => {
    try {
        await db.ready;
        db.run('DELETE FROM sub_categories WHERE id = ?', [Number(req.params.id)]);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// PUT /api/products/subcategories/:id
router.put('/subcategories/:id', async (req, res, next) => {
    try {
        await db.ready;
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Sub-category name is required' });
        
        db.run('UPDATE sub_categories SET name = ? WHERE id = ?', [name.trim(), Number(req.params.id)]);
        res.json({ success: true, id: Number(req.params.id), name: name.trim() });
    } catch (err) {
        next(err);
    }
});

// BRANDS
router.get('/brands', async (_req, res, next) => {
    try {
        await db.ready;
        const rows = db.all('SELECT * FROM brands ORDER BY name');
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

router.post('/brands', async (req, res, next) => {
    try {
        await db.ready;
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Brand name is required' });
        const result = db.run('INSERT OR IGNORE INTO brands (name) VALUES (?)', [name.trim()]);
        res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
    } catch (err) {
        next(err);
    }
});

router.delete('/brands/:id', async (req, res, next) => {
    try {
        await db.ready;
        db.run('DELETE FROM brands WHERE id = ?', [Number(req.params.id)]);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// GET /api/products/alerts/stock
router.get('/alerts/stock', async (req, res, next) => {
    try {
        await db.ready;
        const outOfStock = db.all('SELECT * FROM products WHERE stock_quantity <= 0');
        const lowStock = db.all('SELECT * FROM products WHERE stock_quantity > 0 AND stock_quantity <= min_stock_level');
        const overStock = db.all('SELECT * FROM products WHERE max_stock_level > 0 AND stock_quantity > max_stock_level');
        
        const settingsRows = db.all('SELECT key, value FROM settings');
        const settings = {};
        settingsRows.forEach(row => settings[row.key] = row.value);
        
        let expired = [];
        let expiringSoon = [];
        
        if (settings.enable_expiry_tracking === 'true') {
            const expiryDays = parseInt(settings.expiry_alert_days) || 30;
            
            expired = db.all(`
               SELECT pb.*, p.name as product_name, p.product_code, p.category 
               FROM product_batches pb 
               JOIN products p ON pb.product_id = p.id 
               WHERE pb.current_quantity > 0 AND DATE(pb.expiry_date) < DATE('now')
            `);
            
            expiringSoon = db.all(`
               SELECT pb.*, p.name as product_name, p.product_code, p.category 
               FROM product_batches pb 
               JOIN products p ON pb.product_id = p.id 
               WHERE pb.current_quantity > 0 
               AND DATE(pb.expiry_date) >= DATE('now')
               AND DATE(pb.expiry_date) <= DATE('now', '+' || ? || ' days')
            `, [expiryDays]);
        }

        // M036: Also pull in variant-level stock to catch low-variant alerts
        const variantAlerts = db.all(`
            SELECT pv.*, p.name as product_name, p.category, p.min_stock_level
            FROM product_variants pv
            JOIN products p ON pv.product_id = p.id
            WHERE pv.stock_quantity <= p.min_stock_level AND pv.stock_quantity > 0
        `);

        res.json({ outOfStock, lowStock, overStock, expired, expiringSoon, lowVariantStock: variantAlerts });
    } catch (err) {
        next(err);
    }
});

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const product = db.get('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);
        if (!product) {
            res.status(404).json({ error: 'Product not found' });
            const err = new Error('Abort');
            err.apiResponse = true;
            throw err;
        }
        res.json(product);
    } catch (err) {
        next(err);
    }
});

// POST /api/products
router.post('/', async (req, res, next) => {
    try {
        await db.ready;
        const { name, category, subcategory_id, brand_id, tags, cost_price, selling_price, stock_quantity, product_code, unit, secondary_unit, conversion_factor, allow_decimal, conversion_rate, min_stock_level, max_stock_level, track_batches, track_serials } = req.body;
        if (!name) return res.status(400).json({ error: 'Product name is required' });

        // M006: Check for duplicate product (by product_code if provided, else by name+category)
        if (product_code && product_code.trim()) {
            const byCode = db.get('SELECT id FROM products WHERE product_code = ?', [product_code.trim()]);
            if (byCode) return res.status(400).json({ error: `A product with code "${product_code.trim()}" already exists` });
        } else {
            const byName = db.get('SELECT id FROM products WHERE name = ? AND category = ?', [name.trim(), category || 'General']);
            if (byName) return res.status(400).json({ error: `A product named "${name.trim()}" already exists in this category` });
        }

        const result = db.run(
            `INSERT INTO products (name, category, subcategory_id, brand_id, tags, cost_price, selling_price, stock_quantity, product_code, unit, secondary_unit, conversion_factor, allow_decimal, conversion_rate, min_stock_level, max_stock_level, track_batches, track_serials) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                category || 'General',
                subcategory_id || null,
                brand_id || null,
                tags || '',
                cost_price || 0,
                selling_price || 0,
                stock_quantity || 0,
                product_code || '',
                unit || 'PCS',
                secondary_unit || null,
                conversion_factor || 1,
                allow_decimal ? 1 : 0,
                conversion_rate || 1,
                min_stock_level !== undefined ? min_stock_level : 5,
                max_stock_level || 0,
                track_batches ? 1 : 0,
                track_serials ? 1 : 0
            ]
        );

        // If initial stock > 0, we can also optionally log this as an 'IN' or 'ADJUSTMENT' movement. 
        // For simplicity and traceability, let's log initial stock setting:
        if (stock_quantity > 0) {
            db.run(
                'INSERT INTO stock_movements (product_id, type, quantity, reference_type, notes) VALUES (?, ?, ?, ?, ?)',
                [result.lastInsertRowid, 'IN', stock_quantity, 'Manual', 'Initial Stock Entry']
            );
        }

        const product = db.get('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(product);
    } catch (err) {
        next(err);
    }
});

// PUT /api/products/:id
router.put('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const { name, category, subcategory_id, brand_id, tags, cost_price, selling_price, stock_quantity, product_code, unit, secondary_unit, conversion_factor, allow_decimal, conversion_rate, min_stock_level, max_stock_level, track_batches, track_serials } = req.body;
        let product;
        try {
        db.transaction(() => {
        const existing = db.get('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);
        if (!existing) {
            res.status(404).json({ error: 'Product not found' });
            const err = new Error('Abort');
            err.apiResponse = true;
            throw err;
        }

        db.run(
            `UPDATE products SET name = ?, category = ?, subcategory_id = ?, brand_id = ?, tags = ?, cost_price = ?, selling_price = ?, stock_quantity = ?, product_code = ?, unit = ?, secondary_unit = ?, conversion_factor = ?, allow_decimal = ?, conversion_rate = ?, min_stock_level = ?, max_stock_level = ?, track_batches = ?, track_serials = ? WHERE id = ?`,
            [
                name ?? existing.name,
                category ?? existing.category,
                subcategory_id !== undefined ? subcategory_id : existing.subcategory_id,
                brand_id !== undefined ? brand_id : existing.brand_id,
                tags ?? existing.tags,
                cost_price ?? existing.cost_price,
                selling_price ?? existing.selling_price,
                stock_quantity ?? existing.stock_quantity,
                product_code ?? existing.product_code,
                unit ?? existing.unit,
                secondary_unit !== undefined ? secondary_unit : existing.secondary_unit,
                conversion_factor ?? existing.conversion_factor,
                (allow_decimal !== undefined) ? (allow_decimal ? 1 : 0) : existing.allow_decimal,
                conversion_rate ?? existing.conversion_rate,
                min_stock_level !== undefined ? min_stock_level : existing.min_stock_level,
                max_stock_level !== undefined ? max_stock_level : existing.max_stock_level,
                (track_batches !== undefined) ? (track_batches ? 1 : 0) : existing.track_batches,
                (track_serials !== undefined) ? (track_serials ? 1 : 0) : existing.track_serials,
                Number(req.params.id)
            ]
        );

        if (stock_quantity !== undefined && Number(stock_quantity) !== Number(existing.stock_quantity)) {
            const diff = Number(stock_quantity) - Number(existing.stock_quantity);
            const type = diff > 0 ? 'IN' : 'OUT';
            db.run(
                'INSERT INTO stock_movements (product_id, type, quantity, reference_type, notes) VALUES (?, ?, ?, ?, ?)',
                [Number(req.params.id), type, Math.abs(diff), 'Manual', 'Stock manually updated during product edit']
            );
        }

        product = db.get('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);

        // M060: Check if real-time price sync toggle is on, and update 0-price invoice items
        const syncToggle = db.get("SELECT value FROM settings WHERE key = 'enable_realtime_price_update'");
        if (syncToggle && syncToggle.value === 'true' && selling_price !== undefined && Number(selling_price) > 0) {
            const productId = Number(req.params.id);
            const zeroPriceItems = db.all("SELECT id, invoice_id, quantity FROM invoice_items WHERE product_id = ? AND price = 0", [productId]);
            if (zeroPriceItems && zeroPriceItems.length > 0) {
                for (const item of zeroPriceItems) {
                    const newTotal = Number(item.quantity) * Number(selling_price);
                    db.run("UPDATE invoice_items SET price = ?, total = ? WHERE id = ?", [Number(selling_price), newTotal, item.id]);
                    recalculateInvoiceTotalsInline(item.invoice_id);
                }
            }
        }
        }); // End transaction
        res.json(product);
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
    } catch (err) {
        next(err);
    }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const existing = db.get('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);
        if (!existing) return res.status(404).json({ error: 'Product not found' });

        db.run('DELETE FROM products WHERE id = ?', [Number(req.params.id)]);
        res.json({ message: 'Product deleted', id: Number(req.params.id) });
    } catch (err) {
        next(err);
    }
});

// GET /api/products/:id/movements
router.get('/:id/movements', async (req, res, next) => {
    try {
        await db.ready;
        const movements = db.all(
            'SELECT * FROM stock_movements WHERE product_id = ? ORDER BY date DESC, id DESC',
            [Number(req.params.id)]
        );
        res.json(movements);
    } catch (err) {
        next(err);
    }
});

// POST /api/products/:id/adjust
router.post('/:id/adjust', async (req, res, next) => {
    try {
        await db.ready;
        const { quantity, notes } = req.body; // absolute new quantity
        const productId = Number(req.params.id);
        
        const product = db.get('SELECT * FROM products WHERE id = ?', [productId]);
        if (!product) {
            res.status(404).json({ error: 'Product not found' });
            const err = new Error('Abort');
            err.apiResponse = true;
            throw err;
        }
        
        const diff = Number(quantity) - Number(product.stock_quantity);
        if (diff === 0) return res.json(product);
        
        let updatedProduct;
        db.transaction(() => {
            db.run('UPDATE products SET stock_quantity = ? WHERE id = ?', [Number(quantity), productId]);
            db.run(
                'INSERT INTO stock_movements (product_id, type, quantity, reference_type, notes) VALUES (?, ?, ?, ?, ?)',
                [productId, 'ADJUSTMENT', diff, 'Manual', notes || 'Manual adjustment']
            );
            updatedProduct = db.get('SELECT * FROM products WHERE id = ?', [productId]);
        });
        res.json(updatedProduct);
    } catch (err) {
        next(err);
    }
});

// GET /api/products/:id/batches
router.get('/:id/batches', async (req, res, next) => {
    try {
        await db.ready;
        const batches = db.all(
            'SELECT * FROM product_batches WHERE product_id = ? AND current_quantity > 0 ORDER BY expiry_date ASC, created_at ASC',
            [Number(req.params.id)]
        );
        res.json(batches);
    } catch (err) {
        next(err);
    }
});

// VARIANTS
router.get('/:id/variants', async (req, res, next) => {
    try {
        await db.ready;
        const rows = db.all('SELECT * FROM product_variants WHERE product_id = ?', [Number(req.params.id)]);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

router.post('/:id/variants', async (req, res, next) => {
    try {
        await db.ready;
        const { name, sku, cost_price, selling_price, stock_quantity, attributes } = req.body;
        const result = db.run(
            'INSERT INTO product_variants (product_id, name, sku, cost_price, selling_price, stock_quantity, attributes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [Number(req.params.id), name, sku || '', cost_price || 0, selling_price || 0, stock_quantity || 0, JSON.stringify(attributes || {})]
        );
        res.status(201).json({ id: result.lastInsertRowid, product_id: Number(req.params.id), name, sku, cost_price, selling_price, stock_quantity, attributes });
    } catch (err) {
        next(err);
    }
});

router.put('/variants/:id', async (req, res, next) => {
    try {
        await db.ready;
        const { name, sku, cost_price, selling_price, stock_quantity, attributes } = req.body;
        db.run(
            'UPDATE product_variants SET name = ?, sku = ?, cost_price = ?, selling_price = ?, stock_quantity = ?, attributes = ? WHERE id = ?',
            [name, sku, cost_price, selling_price, stock_quantity, JSON.stringify(attributes || {}), Number(req.params.id)]
        );
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

router.delete('/variants/:id', async (req, res, next) => {
    try {
        await db.ready;
        db.run('DELETE FROM product_variants WHERE id = ?', [Number(req.params.id)]);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// GET /api/products/:id/serials
router.get('/:id/serials', async (req, res, next) => {
    try {
        await db.ready;
        const { status } = req.query;
        let query = "SELECT * FROM product_serials WHERE product_id = ?";
        const params = [Number(req.params.id)];
        if (status) {
            query += " AND status = ?";
            params.push(status);
        }
        query += " ORDER BY serial_number ASC";
        const serials = db.all(query, params);
        res.json(serials);
    } catch (err) {
        next(err);
    }
});

// POST /api/products/:id/serials
router.post('/:id/serials', async (req, res, next) => {
    try {
        await db.ready;
        const productId = Number(req.params.id);
        const { serial_number } = req.body;
        if (!serial_number || !serial_number.trim()) {
            return res.status(400).json({ error: 'Serial number is required' });
        }
        const trimmedSerial = serial_number.trim();

        // Verify if the serial number already exists in product_serials before adding
        const existing = db.get('SELECT * FROM product_serials WHERE serial_number = ?', [trimmedSerial]);
        if (existing) {
            return res.status(400).json({ error: 'Serial number already exists' });
        }

        // Insert serial number
        const insertResult = db.run(
            'INSERT INTO product_serials (product_id, serial_number, status) VALUES (?, ?, ?)',
            [productId, trimmedSerial, 'Available']
        );

        // Increment product stock quantity by 1
        db.run('UPDATE products SET stock_quantity = stock_quantity + 1 WHERE id = ?', [productId]);

        // Record an IN stock movement
        db.run(
            'INSERT INTO stock_movements (product_id, type, quantity, reference_type, notes) VALUES (?, ?, ?, ?, ?)',
            [productId, 'IN', 1, 'Manual', `Manually added serial number: ${trimmedSerial}`]
        );

        res.status(201).json({ id: insertResult.lastInsertRowid, product_id: productId, serial_number: trimmedSerial, status: 'Available' });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/products/serials/:serialId
router.delete('/serials/:serialId', async (req, res, next) => {
    try {
        await db.ready;
        const serialId = Number(req.params.serialId);

        // Verify that the serial number exists and is 'Available'
        const serial = db.get('SELECT * FROM product_serials WHERE id = ?', [serialId]);
        if (!serial) {
            return res.status(404).json({ error: 'Serial number not found' });
        }
        if (serial.status !== 'Available') {
            return res.status(400).json({ error: 'Only Available serial numbers can be deleted' });
        }

        // Delete the serial number
        db.run('DELETE FROM product_serials WHERE id = ?', [serialId]);

        // Decrement product stock quantity by 1 (using MAX(0, stock_quantity - 1))
        db.run('UPDATE products SET stock_quantity = MAX(0, stock_quantity - 1) WHERE id = ?', [serial.product_id]);

        // Record an OUT stock movement
        db.run(
            'INSERT INTO stock_movements (product_id, type, quantity, reference_type, notes) VALUES (?, ?, ?, ?, ?)',
            [serial.product_id, 'OUT', 1, 'Manual', `Manually deleted serial number: ${serial.serial_number}`]
        );

        res.json({ message: 'Serial number deleted successfully', serial_id: serialId });
    } catch (err) {
        next(err);
    }
});

function recalculateInvoiceTotalsInline(invoiceId) {
    const invoice = db.get("SELECT * FROM invoices WHERE id = ?", [invoiceId]);
    if (!invoice) return;

    const items = db.all("SELECT price, quantity FROM invoice_items WHERE invoice_id = ?", [invoiceId]);
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

    const discountRate = Number(invoice.discount_rate || 0);
    const discountAmount = invoice.discount_amount || (subtotal * (discountRate / 100));
    const couponDiscountAmount = Number(invoice.coupon_discount_amount || 0);
    const paidAmount = Number(invoice.paid_amount || 0);
    const returnedAmount = Number(invoice.total_returned_amount || 0);

    const calculatedTotal = subtotal - discountAmount - couponDiscountAmount;
    const gstRate = Number(invoice.gst_rate || 0);
    const gstAmount = calculatedTotal * (gstRate / 100);
    const finalTotal = Math.max(0, calculatedTotal + gstAmount);
    const effectiveTotal = Math.max(0, finalTotal - returnedAmount);

    let paymentStatus = 'PAID';
    if (paidAmount === 0) paymentStatus = 'UNPAID';
    else if (paidAmount < effectiveTotal) paymentStatus = 'PARTIAL';
    else paymentStatus = 'PAID';

    db.run(
        "UPDATE invoices SET total = ?, payment_status = ?, financial_status = ? WHERE id = ?",
        [finalTotal, paymentStatus, paymentStatus, invoiceId]
    );

    // Sync cloud DB asynchronously if shared
    const tokenRow = db.get("SELECT token FROM invoice_tokens WHERE invoice_id = ?", [invoiceId]);
    if (tokenRow) {
        const { generateHostedInvoice } = require('../services/hostedInvoiceService');
        generateHostedInvoice(invoiceId).catch(e => console.error('[Realtime Sync] Failed to sync updated invoice:', e.message));
    }
}

module.exports = router;
