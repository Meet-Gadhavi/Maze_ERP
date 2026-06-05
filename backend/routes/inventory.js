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

function resolveBundleStock(product) {
    if (!product || product.is_bundle !== 1) return product ? product.stock_quantity : 0;
    try {
        const components = db.all(`
            SELECT bi.quantity as component_qty, p.stock_quantity 
            FROM product_bundle_items bi 
            JOIN products p ON bi.component_id = p.id 
            WHERE bi.bundle_id = ?
        `, [product.id]);
        if (components.length === 0) return 0;
        let minStock = Infinity;
        for (const comp of components) {
            const stockRatio = Math.floor((comp.stock_quantity || 0) / (comp.component_qty || 1));
            if (stockRatio < minStock) {
                minStock = stockRatio;
            }
        }
        return minStock === Infinity ? 0 : minStock;
    } catch (err) {
        console.error('Failed to resolve bundle stock:', err);
        return 0;
    }
}

// GET /api/products
router.get('/', async (req, res, next) => {
    try {
        await db.ready;
        const { search, category, subcategory_id, brand_id } = req.query;
        let sql = `
            SELECT p.*, c.name as category_name, sc.name as subcategory_name, b.name as brand_name,
                   (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) as variants_count,
                   (SELECT SUM(stock_quantity) FROM product_variants WHERE product_id = p.id) as variants_stock
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
        for (const p of products) {
            if (p.is_bundle === 1) {
                p.stock_quantity = resolveBundleStock(p);
            }
        }
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
        const allProducts = db.all('SELECT * FROM products');
        for (const p of allProducts) {
            if (p.is_bundle === 1) {
                p.stock_quantity = resolveBundleStock(p);
            }
        }
        const outOfStock = allProducts.filter(p => p.stock_quantity <= 0);
        const lowStock = allProducts.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_level);
        const overStock = allProducts.filter(p => p.max_stock_level > 0 && p.stock_quantity > p.max_stock_level);
        
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

// GET /api/products/valuation
router.get('/valuation', async (req, res, next) => {
    try {
        await db.ready;
        const products = db.all('SELECT * FROM products');
        
        let totalFifoValue = 0;
        let totalLifoValue = 0;
        let totalWacValue = 0;
        const itemsValuation = [];
        
        for (const p of products) {
            if (p.is_bundle === 1) {
                p.stock_quantity = resolveBundleStock(p);
            }
            
            const currentStock = Number(p.stock_quantity || 0);
            if (currentStock <= 0) {
                itemsValuation.push({
                    id: p.id,
                    name: p.name,
                    product_code: p.product_code,
                    category: p.category,
                    stock_quantity: currentStock,
                    fifo_value: 0,
                    lifo_value: 0,
                    wac_value: 0,
                    cost_price: p.cost_price,
                    avg_purchase_price: p.cost_price
                });
                continue;
            }
            
            const purchases = db.all(`
                SELECT pi.quantity, pi.purchase_price, p.purchase_date, pi.id
                FROM purchase_items pi
                JOIN purchases p ON pi.purchase_id = p.id
                WHERE pi.product_id = ? AND p.is_draft = 0
                ORDER BY p.purchase_date ASC, pi.id ASC
            `, [p.id]);
            
            let remainingFifo = currentStock;
            let fifoValue = 0;
            const purchasesDesc = [...purchases].reverse();
            for (const layer of purchasesDesc) {
                if (remainingFifo <= 0) break;
                const qty = Math.min(layer.quantity, remainingFifo);
                fifoValue += qty * layer.purchase_price;
                remainingFifo -= qty;
            }
            if (remainingFifo > 0) {
                fifoValue += remainingFifo * p.cost_price;
            }
            
            let remainingLifo = currentStock;
            let lifoValue = 0;
            for (const layer of purchases) {
                if (remainingLifo <= 0) break;
                const qty = Math.min(layer.quantity, remainingLifo);
                lifoValue += qty * layer.purchase_price;
                remainingLifo -= qty;
            }
            if (remainingLifo > 0) {
                lifoValue += remainingLifo * p.cost_price;
            }
            
            let totalPurchasedQty = 0;
            let totalPurchasedCost = 0;
            for (const layer of purchases) {
                totalPurchasedQty += layer.quantity;
                totalPurchasedCost += layer.quantity * layer.purchase_price;
            }
            
            let wacPrice = p.cost_price;
            if (totalPurchasedQty > 0) {
                wacPrice = totalPurchasedCost / totalPurchasedQty;
            }
            const wacValue = currentStock * wacPrice;
            
            totalFifoValue += fifoValue;
            totalLifoValue += lifoValue;
            totalWacValue += wacValue;
            
            itemsValuation.push({
                id: p.id,
                name: p.name,
                product_code: p.product_code,
                category: p.category,
                stock_quantity: currentStock,
                fifo_value: fifoValue,
                lifo_value: lifoValue,
                wac_value: wacValue,
                cost_price: p.cost_price,
                avg_purchase_price: totalPurchasedQty > 0 ? (totalPurchasedCost / totalPurchasedQty) : p.cost_price
            });
        }
        
        res.json({
            totals: {
                fifo: totalFifoValue,
                lifo: totalLifoValue,
                wac: totalWacValue
            },
            items: itemsValuation
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/products/reorders
router.get('/reorders', async (req, res, next) => {
    try {
        await db.ready;
        const products = db.all('SELECT * FROM products');
        const suggestions = [];
        
        for (const p of products) {
            if (p.is_bundle === 1) {
                p.stock_quantity = resolveBundleStock(p);
            }
            
            const currentStock = Number(p.stock_quantity || 0);
            const minStock = Number(p.min_stock_level || 0);
            
            if (currentStock <= minStock) {
                const lastPurchase = db.get(`
                    SELECT p.supplier_id, s.name as supplier_name, pi.purchase_price
                    FROM purchase_items pi
                    JOIN purchases p ON pi.purchase_id = p.id
                    JOIN suppliers s ON p.supplier_id = s.id
                    WHERE pi.product_id = ? AND p.is_draft = 0
                    ORDER BY p.purchase_date DESC, pi.id DESC
                    LIMIT 1
                `, [p.id]);
                
                const reorderQty = Number(p.reorder_quantity || 0) || Math.max(10, minStock * 2);
                const estimatedCost = lastPurchase ? lastPurchase.purchase_price : p.cost_price;
                
                suggestions.push({
                    product_id: p.id,
                    name: p.name,
                    product_code: p.product_code,
                    category: p.category,
                    stock_quantity: currentStock,
                    min_stock_level: minStock,
                    reorder_quantity: reorderQty,
                    last_supplier_id: lastPurchase ? lastPurchase.supplier_id : null,
                    last_supplier_name: lastPurchase ? lastPurchase.supplier_name : 'No Last Supplier',
                    last_price: estimatedCost
                });
            }
        }
        
        res.json(suggestions);
    } catch (err) {
        next(err);
    }
});

// POST /api/products/reorders/create-bills
router.post('/reorders/create-bills', async (req, res, next) => {
    try {
        await db.ready;
        const { items } = req.body;
        
        if (!items || !items.length) {
            return res.status(400).json({ error: 'No items selected' });
        }
        
        const groups = {};
        for (const item of items) {
            const sId = item.supplier_id || 'unassigned';
            if (!groups[sId]) groups[sId] = [];
            groups[sId].push(item);
        }
        
        const createdPurchaseIds = [];
        
        db.transaction(() => {
            for (const [supplierIdStr, groupItems] of Object.entries(groups)) {
                let supplierId = supplierIdStr === 'unassigned' ? null : Number(supplierIdStr);
                
                if (!supplierId) {
                    const firstSupplier = db.get('SELECT id FROM suppliers ORDER BY id LIMIT 1');
                    if (firstSupplier) {
                        supplierId = firstSupplier.id;
                    } else {
                        res.status(400).json({ error: 'No suppliers registered in system. Please create a supplier first.' });
                        const err = new Error('Abort'); err.apiResponse = true; throw err;
                    }
                }
                
                const billNumber = `DRAFT-REORDER-${Date.now()}`;
                const purchaseResult = db.run(
                    `INSERT INTO purchases (supplier_id, bill_number, purchase_date, status, payment_mode, is_draft, grand_total, subtotal, due_amount)
                     VALUES (?, ?, date('now', 'localtime'), 'Draft', 'Cash', 1, 0, 0, 0)`,
                    [supplierId, billNumber]
                );
                const purchaseId = purchaseResult.lastInsertRowid;
                createdPurchaseIds.push(purchaseId);
                
                let grand_total = 0;
                for (const item of groupItems) {
                    const qty = Number(item.quantity);
                    const price = Number(item.price);
                    const lineTotal = qty * price;
                    grand_total += lineTotal;
                    
                    const product = db.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
                    const pName = product ? product.name : (item.product_name || 'Unknown Item');
                    
                    db.run(
                        `INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, purchase_price, line_total)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [purchaseId, item.product_id, pName, qty, price, lineTotal]
                    );
                }
                
                db.run(
                    'UPDATE purchases SET subtotal = ?, grand_total = ? WHERE id = ?',
                    [grand_total, grand_total, purchaseId]
                );
            }
        });
        
        res.status(201).json({ success: true, purchase_ids: createdPurchaseIds });
    } catch (err) {
        if (err.apiResponse) return;
        next(err);
    }
});

// GET /api/products/adjustments
router.get('/adjustments', async (req, res, next) => {
    try {
        await db.ready;
        const adjustments = db.all('SELECT * FROM stock_adjustments ORDER BY created_at DESC');
        for (const adj of adjustments) {
            adj.items = db.all(`
                SELECT ai.*, p.name as product_name, p.product_code, pv.name as variant_name, pb.batch_number
                FROM stock_adjustment_items ai
                JOIN products p ON ai.product_id = p.id
                LEFT JOIN product_variants pv ON ai.variant_id = pv.id
                LEFT JOIN product_batches pb ON ai.batch_id = pb.id
                WHERE ai.adjustment_id = ?
            `, [adj.id]);
        }
        res.json(adjustments);
    } catch (err) {
        next(err);
    }
});

// POST /api/products/adjustments
router.post('/adjustments', async (req, res, next) => {
    try {
        await db.ready;
        const { reason, notes, type, items } = req.body;
        
        if (!items || !items.length) {
            return res.status(400).json({ error: 'No items provided for adjustment' });
        }
        
        const adjustmentNumber = `ADJ-${Date.now()}`;
        let resultObj;
        
        db.transaction(() => {
            const adjResult = db.run(
                'INSERT INTO stock_adjustments (adjustment_number, reason, type, notes) VALUES (?, ?, ?, ?)',
                [adjustmentNumber, reason || 'Stock Take', type || 'Manual', notes || '']
            );
            const adjustmentId = adjResult.lastInsertRowid;
            
            for (const item of items) {
                const qty = Number(item.quantity);
                if (qty === 0) continue;
                
                db.run(
                    'INSERT INTO stock_adjustment_items (adjustment_id, product_id, variant_id, batch_id, quantity, serials) VALUES (?, ?, ?, ?, ?, ?)',
                    [adjustmentId, item.product_id, item.variant_id || null, item.batch_id || null, qty, item.serials ? item.serials.join(',') : null]
                );
                
                if (item.variant_id) {
                    db.run('UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?', [qty, item.variant_id]);
                    db.run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [qty, item.product_id]);
                } else {
                    db.run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [qty, item.product_id]);
                }
                
                if (item.batch_id) {
                    db.run('UPDATE product_batches SET current_quantity = current_quantity + ? WHERE id = ?', [qty, item.batch_id]);
                }
                
                if (item.serials && item.serials.length > 0) {
                    for (const sn of item.serials) {
                        const trimmedSn = sn.trim().toUpperCase();
                        if (qty > 0) {
                            const existingSerial = db.get('SELECT id FROM product_serials WHERE product_id = ? AND UPPER(serial_number) = ?', [item.product_id, trimmedSn]);
                            if (existingSerial) {
                                db.run("UPDATE product_serials SET status = 'Available' WHERE id = ?", [existingSerial.id]);
                            } else {
                                db.run(
                                    'INSERT INTO product_serials (product_id, serial_number, status) VALUES (?, ?, ?)',
                                    [item.product_id, trimmedSn, 'Available']
                                );
                            }
                        } else {
                            db.run("DELETE FROM product_serials WHERE product_id = ? AND UPPER(serial_number) = ?", [item.product_id, trimmedSn]);
                        }
                    }
                }
                
                db.run(
                    'INSERT INTO stock_movements (product_id, variant_id, type, quantity, reference_type, reference_id, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [item.product_id, item.variant_id || null, qty > 0 ? 'IN' : 'OUT', Math.abs(qty), 'Adjustment', adjustmentId, item.batch_id || null, notes || `Stock Adjustment: ${reason}`]
                );
            }
            
            resultObj = { id: adjustmentId, adjustment_number: adjustmentNumber };
        });
        
        res.status(201).json(resultObj);
    } catch (err) {
        next(err);
    }
});

// GET /api/products/:id/bundle-items
router.get('/:id/bundle-items', async (req, res, next) => {
    try {
        await db.ready;
        const bundleId = Number(req.params.id);
        const items = db.all(`
            SELECT bi.*, p.name as component_name, p.product_code as component_code, p.stock_quantity as component_stock
            FROM product_bundle_items bi
            JOIN products p ON bi.component_id = p.id
            WHERE bi.bundle_id = ?
        `, [bundleId]);
        res.json(items);
    } catch (err) {
        next(err);
    }
});

// POST /api/products/:id/bundle-items
router.post('/:id/bundle-items', async (req, res, next) => {
    try {
        await db.ready;
        const bundleId = Number(req.params.id);
        const { items } = req.body;
        
        db.transaction(() => {
            db.run('DELETE FROM product_bundle_items WHERE bundle_id = ?', [bundleId]);
            for (const item of items) {
                db.run(
                    'INSERT INTO product_bundle_items (bundle_id, component_id, quantity) VALUES (?, ?, ?)',
                    [bundleId, item.component_id, item.quantity]
                );
            }
            db.run('UPDATE products SET is_bundle = 1 WHERE id = ?', [bundleId]);
        });
        res.json({ success: true });
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
        if (product.is_bundle === 1) {
            product.stock_quantity = resolveBundleStock(product);
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
        const { name, category, subcategory_id, brand_id, tags, cost_price, selling_price, stock_quantity, product_code, unit, secondary_unit, conversion_factor, allow_decimal, conversion_rate, min_stock_level, max_stock_level, track_batches, track_serials, is_bundle, reorder_quantity } = req.body;
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
            `INSERT INTO products (name, category, subcategory_id, brand_id, tags, cost_price, selling_price, stock_quantity, product_code, unit, secondary_unit, conversion_factor, allow_decimal, conversion_rate, min_stock_level, max_stock_level, track_batches, track_serials, is_bundle, reorder_quantity) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                track_serials ? 1 : 0,
                is_bundle ? 1 : 0,
                reorder_quantity || 0
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
        const { name, category, subcategory_id, brand_id, tags, cost_price, selling_price, stock_quantity, product_code, unit, secondary_unit, conversion_factor, allow_decimal, conversion_rate, min_stock_level, max_stock_level, track_batches, track_serials, is_bundle, reorder_quantity } = req.body;
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
            `UPDATE products SET name = ?, category = ?, subcategory_id = ?, brand_id = ?, tags = ?, cost_price = ?, selling_price = ?, stock_quantity = ?, product_code = ?, unit = ?, secondary_unit = ?, conversion_factor = ?, allow_decimal = ?, conversion_rate = ?, min_stock_level = ?, max_stock_level = ?, track_batches = ?, track_serials = ?, is_bundle = ?, reorder_quantity = ? WHERE id = ?`,
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
                (is_bundle !== undefined) ? (is_bundle ? 1 : 0) : existing.is_bundle,
                reorder_quantity !== undefined ? reorder_quantity : existing.reorder_quantity,
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

        // M060: Check if real-time price sync toggle is on, and update invoice items
        const syncToggle = db.get("SELECT value FROM settings WHERE key = 'enable_realtime_price_update'");
        if (syncToggle && syncToggle.value === 'true' && selling_price !== undefined && Number(selling_price) > 0) {
            const productId = Number(req.params.id);
            const restrictToggle = db.get("SELECT value FROM settings WHERE key = 'restrict_realtime_price_sync'");
            const isRestricted = restrictToggle && restrictToggle.value === 'true';

            let query = `
                SELECT ii.id, ii.invoice_id, ii.quantity
                FROM invoice_items ii
                JOIN invoices inv ON ii.invoice_id = inv.id
                WHERE ii.product_id = ?
                AND (ii.variant_id IS NULL OR ii.variant_id = 0)
            `;
            const params = [productId];

            if (isRestricted) {
                query += ` AND UPPER(inv.payment_status) = 'UNPAID' AND ii.price = 0`;
            }

            const affectedItems = db.all(query, params);
            if (affectedItems && affectedItems.length > 0) {
                for (const item of affectedItems) {
                    const newPrice = Number(selling_price);
                    const newTotal = Number(item.quantity) * newPrice;
                    db.run("UPDATE invoice_items SET price = ?, total = ? WHERE id = ?", [newPrice, newTotal, item.id]);
                    recalculateInvoiceTotalsInline(item.invoice_id);
                    console.log(`[Realtime Sync] Updated invoice #${item.invoice_id} item #${item.id} price → ₹${newPrice}`);
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

            // Synchronize serial tracking
            if (product.track_serials) {
                if (diff > 0) {
                    const serialPrefix = `SN-${product.product_code || product.id}-`;
                    for (let i = 0; i < diff; i++) {
                        let serialNumber = `${serialPrefix}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                        db.run(
                            'INSERT INTO product_serials (product_id, serial_number, status) VALUES (?, ?, ?)',
                            [productId, serialNumber, 'Available']
                        );
                    }
                } else if (diff < 0) {
                    const deleteCount = Math.abs(diff);
                    const availableSerials = db.all(
                        "SELECT id FROM product_serials WHERE product_id = ? AND status = 'Available' ORDER BY id DESC LIMIT ?",
                        [productId, deleteCount]
                    );
                    for (const s of availableSerials) {
                        db.run('DELETE FROM product_serials WHERE id = ?', [s.id]);
                    }
                }
            }

            // Synchronize batch tracking
            let batchId = null;
            if (product.track_batches) {
                if (diff > 0) {
                    const latestBatch = db.get(
                        'SELECT * FROM product_batches WHERE product_id = ? ORDER BY id DESC LIMIT 1',
                        [productId]
                    );
                    if (latestBatch) {
                        db.run(
                            'UPDATE product_batches SET initial_quantity = initial_quantity + ?, current_quantity = current_quantity + ? WHERE id = ?',
                            [diff, diff, latestBatch.id]
                        );
                        batchId = latestBatch.id;
                    } else {
                        const batchNumber = `BAT-ADJ-${productId}-${Date.now()}`;
                        const bRes = db.run(
                            'INSERT INTO product_batches (product_id, batch_number, initial_quantity, current_quantity, cost_price) VALUES (?, ?, ?, ?, ?)',
                            [productId, batchNumber, diff, diff, product.cost_price || 0]
                        );
                        batchId = bRes.lastInsertRowid;
                    }
                } else if (diff < 0) {
                    let remainingToDeduct = Math.abs(diff);
                    const activeBatches = db.all(
                        'SELECT * FROM product_batches WHERE product_id = ? AND current_quantity > 0 ORDER BY id DESC',
                        [productId]
                    );
                    for (const batch of activeBatches) {
                        if (remainingToDeduct <= 0) break;
                        const deductQty = Math.min(batch.current_quantity, remainingToDeduct);
                        db.run(
                            'UPDATE product_batches SET current_quantity = current_quantity - ? WHERE id = ?',
                            [deductQty, batch.id]
                        );
                        remainingToDeduct -= deductQty;
                    }
                    if (remainingToDeduct > 0) {
                        // Deduct from latest batch anyway (could go negative)
                        const latestBatch = db.get(
                            'SELECT * FROM product_batches WHERE product_id = ? ORDER BY id DESC LIMIT 1',
                            [productId]
                        );
                        if (latestBatch) {
                            db.run(
                                'UPDATE product_batches SET current_quantity = current_quantity - ? WHERE id = ?',
                                [remainingToDeduct, latestBatch.id]
                            );
                            batchId = latestBatch.id;
                        }
                    }
                }
            }

            db.run(
                'INSERT INTO stock_movements (product_id, type, quantity, reference_type, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
                [productId, 'ADJUSTMENT', diff, 'Manual', batchId, notes || 'Manual adjustment']
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
            'SELECT * FROM product_batches WHERE product_id = ? ORDER BY current_quantity DESC, expiry_date ASC, created_at ASC',
            [Number(req.params.id)]
        );
        res.json(batches);
    } catch (err) {
        next(err);
    }
});

// POST /api/products/:id/batches
router.post('/:id/batches', async (req, res, next) => {
    try {
        await db.ready;
        const productId = Number(req.params.id);
        const { batch_number, current_quantity, cost_price, expiry_date } = req.body;
        if (!batch_number || !batch_number.trim()) {
            return res.status(400).json({ error: 'Batch number is required' });
        }
        const trimmedBatch = batch_number.trim();
        const qty = parseFloat(current_quantity) || 0;
        const cost = parseFloat(cost_price) || 0;

        // Verify if batch number already exists for this product
        const existing = db.get('SELECT * FROM product_batches WHERE product_id = ? AND batch_number = ?', [productId, trimmedBatch]);
        if (existing) {
            return res.status(400).json({ error: 'Batch number already exists for this product' });
        }

        let insertResult;
        db.transaction(() => {
            insertResult = db.run(
                'INSERT INTO product_batches (product_id, batch_number, initial_quantity, current_quantity, cost_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?)',
                [productId, trimmedBatch, qty, qty, cost, expiry_date || null]
            );

            if (qty > 0) {
                // Increment product stock
                db.run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [qty, productId]);
                
                // Record stock movement
                db.run(
                    'INSERT INTO stock_movements (product_id, type, quantity, reference_type, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
                    [productId, 'IN', qty, 'Manual', insertResult.lastInsertRowid, `Manually created batch: ${trimmedBatch}`]
                );
            }
        });

        res.status(201).json({ id: insertResult.lastInsertRowid, product_id: productId, batch_number: trimmedBatch, initial_quantity: qty, current_quantity: qty, cost_price: cost, expiry_date });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/products/:id/batches/:batchId
router.delete('/:id/batches/:batchId', async (req, res, next) => {
    try {
        await db.ready;
        const productId = Number(req.params.id);
        const batchId = Number(req.params.batchId);

        const batch = db.get('SELECT * FROM product_batches WHERE id = ? AND product_id = ?', [batchId, productId]);
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        db.transaction(() => {
            // Deduct product stock
            if (batch.current_quantity > 0) {
                db.run('UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?', [batch.current_quantity, productId]);
                
                // Record stock movement
                db.run(
                    'INSERT INTO stock_movements (product_id, type, quantity, reference_type, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
                    [productId, 'OUT', batch.current_quantity, 'Manual', batchId, `Manually deleted batch: ${batch.batch_number}`]
                );
            }
            db.run('DELETE FROM product_batches WHERE id = ?', [batchId]);
        });

        res.json({ message: 'Batch deleted successfully', batch_id: batchId });
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
        const productId = Number(req.params.id);
        const { name, sku, cost_price, selling_price, stock_quantity, min_stock_level, max_stock_level, attributes } = req.body;
        let resultId;
        db.transaction(() => {
            const result = db.run(
                'INSERT INTO product_variants (product_id, name, sku, cost_price, selling_price, stock_quantity, min_stock_level, max_stock_level, attributes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [productId, name, sku || '', cost_price || 0, selling_price || 0, stock_quantity || 0, min_stock_level || 0, max_stock_level || 0, JSON.stringify(attributes || {})]
            );
            resultId = result.lastInsertRowid;

            // Sync parent product stock
            const sumRow = db.get('SELECT SUM(stock_quantity) as total FROM product_variants WHERE product_id = ?', [productId]);
            const total = sumRow ? (sumRow.total || 0) : 0;
            db.run('UPDATE products SET stock_quantity = ? WHERE id = ?', [total, productId]);
        });
        res.status(201).json({ id: resultId, product_id: productId, name, sku, cost_price, selling_price, stock_quantity, min_stock_level, max_stock_level, attributes });
    } catch (err) {
        next(err);
    }
});

router.put('/variants/:id', async (req, res, next) => {
    try {
        await db.ready;
        const { name, sku, cost_price, selling_price, stock_quantity, min_stock_level, max_stock_level, attributes } = req.body;
        const variantId = Number(req.params.id);

        db.transaction(() => {
            const existing = db.get('SELECT * FROM product_variants WHERE id = ?', [variantId]);
            if (!existing) {
                res.status(404).json({ error: 'Variant not found' });
                const err = new Error('Abort');
                err.apiResponse = true;
                throw err;
            }

            db.run(
                'UPDATE product_variants SET name = ?, sku = ?, cost_price = ?, selling_price = ?, stock_quantity = ?, min_stock_level = ?, max_stock_level = ?, attributes = ? WHERE id = ?',
                [
                    name !== undefined ? name : existing.name,
                    sku !== undefined ? sku : existing.sku,
                    cost_price !== undefined ? cost_price : existing.cost_price,
                    selling_price !== undefined ? selling_price : existing.selling_price,
                    stock_quantity !== undefined ? stock_quantity : existing.stock_quantity,
                    min_stock_level !== undefined ? min_stock_level : existing.min_stock_level,
                    max_stock_level !== undefined ? max_stock_level : existing.max_stock_level,
                    attributes !== undefined ? JSON.stringify(attributes || {}) : existing.attributes,
                    variantId
                ]
            );

            // M060: Check if real-time price sync toggle is on, and update variant invoice items
            const syncToggle = db.get("SELECT value FROM settings WHERE key = 'enable_realtime_price_update'");
            if (syncToggle && syncToggle.value === 'true' && selling_price !== undefined && Number(selling_price) > 0) {
                const restrictToggle = db.get("SELECT value FROM settings WHERE key = 'restrict_realtime_price_sync'");
                const isRestricted = restrictToggle && restrictToggle.value === 'true';

                let query = `
                    SELECT ii.id, ii.invoice_id, ii.quantity
                    FROM invoice_items ii
                    JOIN invoices inv ON ii.invoice_id = inv.id
                    WHERE ii.variant_id = ?
                `;
                const params = [variantId];

                if (isRestricted) {
                    query += ` AND UPPER(inv.payment_status) = 'UNPAID' AND ii.price = 0`;
                }

                const affectedItems = db.all(query, params);
                if (affectedItems && affectedItems.length > 0) {
                    for (const item of affectedItems) {
                        const newPrice = Number(selling_price);
                        const newTotal = Number(item.quantity) * newPrice;
                        db.run("UPDATE invoice_items SET price = ?, total = ? WHERE id = ?", [newPrice, newTotal, item.id]);
                        recalculateInvoiceTotalsInline(item.invoice_id);
                        console.log(`[Realtime Sync Variant] Updated invoice #${item.invoice_id} item #${item.id} price → ₹${newPrice}`);
                    }
                }
            }

            // Sync parent product stock
            const sumRow = db.get('SELECT SUM(stock_quantity) as total FROM product_variants WHERE product_id = ?', [existing.product_id]);
            const total = sumRow ? (sumRow.total || 0) : 0;
            db.run('UPDATE products SET stock_quantity = ? WHERE id = ?', [total, existing.product_id]);
        });

        res.json({ success: true });
    } catch (err) {
        if (err.apiResponse) return;
        next(err);
    }
});

router.delete('/variants/:id', async (req, res, next) => {
    try {
        await db.ready;
        const variantId = Number(req.params.id);
        const existing = db.get('SELECT product_id FROM product_variants WHERE id = ?', [variantId]);
        if (existing) {
            db.transaction(() => {
                db.run('DELETE FROM product_variants WHERE id = ?', [variantId]);
                // Sync parent product stock
                const sumRow = db.get('SELECT SUM(stock_quantity) as total FROM product_variants WHERE product_id = ?', [existing.product_id]);
                const total = sumRow ? (sumRow.total || 0) : 0;
                db.run('UPDATE products SET stock_quantity = ? WHERE id = ?', [total, existing.product_id]);
            });
        }
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
