import re

filepath = 'backend/routes/inventory.js'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. PUT /api/products/:id
put_start = """
        const existing = db.get('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);
"""
put_start_replacement = """
        let product;
        try {
        db.transaction(() => {
        const existing = db.get('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);
"""

put_end = """
        const product = db.get('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);
        res.json(product);
"""
put_end_replacement = """
        product = db.get('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);
        }); // End transaction
        res.json(product);
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
"""
code = code.replace(put_start, put_start_replacement)
code = code.replace(put_end, put_end_replacement)
code = code.replace("return res.status(404).json({ error: 'Product not found' });",
                    "res.status(404).json({ error: 'Product not found' }); const err = new Error('Abort'); err.apiResponse = true; throw err;")

# 2. POST /api/products/:id/adjust
adjust_original = """
        db.run('BEGIN TRANSACTION');
        try {
            db.run('UPDATE products SET stock_quantity = ? WHERE id = ?', [Number(quantity), productId]);
            db.run(
                'INSERT INTO stock_movements (product_id, type, quantity, reference_type, notes) VALUES (?, ?, ?, ?, ?)',
                [productId, 'ADJUSTMENT', diff, 'Manual', notes || 'Manual adjustment']
            );
            db.run('COMMIT');
            
            const updatedProduct = db.get('SELECT * FROM products WHERE id = ?', [productId]);
            res.json(updatedProduct);
        } catch (e) {
            db.run('ROLLBACK');
            throw e;
        }
"""
adjust_replacement = """
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
"""
code = code.replace(adjust_original, adjust_replacement)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Added transactions to inventory.js")
