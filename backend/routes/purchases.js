const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/purchases
router.get('/', async (req, res, next) => {
    try {
        await db.ready;
        // M052: Support pagination via ?limit=&offset= query params
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const offset = parseInt(req.query.offset, 10) || 0;
        const purchases = db.all(`
            SELECT p.*, s.name as supplier_name
            FROM purchases p
            JOIN suppliers s ON p.supplier_id = s.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);
        res.json(purchases);
    } catch (err) {
        next(err);
    }
});

// GET /api/purchases/:id
router.get('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const purchaseId = Number(req.params.id);
        const purchase = db.get(`
            SELECT p.*, s.name as supplier_name
            FROM purchases p
            JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.id = ?
        `, [purchaseId]);

        if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

        purchase.items = db.all('SELECT * FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
        res.json(purchase);
    } catch (err) {
        next(err);
    }
});

// POST /api/purchases
router.post('/', async (req, res, next) => {
    try {
        await db.ready;
        const {
            supplier_id,
            bill_number,
            purchase_date,
            due_date,
            items,
            payment_status, // Paid, Partial, Unpaid
            paid_amount,
            payment_mode,
            is_draft
        } = req.body;

        if (!supplier_id) return res.status(400).json({ error: 'Supplier is required' });
        if (!items || !items.length) return res.status(400).json({ error: 'At least one item is required' });

        let resultObj;
        try {
        db.transaction(() => {
        const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', [supplier_id]);
        if (!supplier) {
            res.status(400).json({ error: 'Invalid supplier' });
            const err = new Error('Abort');
            err.apiResponse = true;
            throw err;
        }

        let subtotal = 0;
        let gst_total = 0;
        let discount_total = 0;
        let grand_total = 0;

        // 1. Create Purchase Header
        const initialStatus = is_draft ? 'Draft' : (payment_status || 'Unpaid');
        const purchaseResult = db.run(
            `INSERT INTO purchases (supplier_id, bill_number, purchase_date, due_date, status, payment_mode, is_draft)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [supplier_id, bill_number || '', purchase_date || null, due_date || null, initialStatus, payment_mode || 'Cash', is_draft ? 1 : 0]
        );
        const purchaseId = purchaseResult.lastInsertRowid;

        for (const item of items) {
            let productId = item.product_id;

            // 2. Handle New Product Creation
            if (!productId && item.is_new_product) {
                const prodResult = db.run(
                    `INSERT INTO products (name, category, cost_price, selling_price, stock_quantity, product_code, unit)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        item.product_name,
                        item.category || 'General',
                        item.purchase_price || 0,
                        item.selling_price || 0,
                        0, // Initial stock 0, will be increased below
                        item.product_code || '',
                        item.unit || 'PCS'
                    ]
                );
                productId = prodResult.lastInsertRowid;
            }

            const qty = Number(item.quantity || 0);
            const price = Number(item.purchase_price || 0);
            const discPer = Number(item.discount_percent || 0);
            const gstPer = Number(item.gst_percent || 0);

            const lineSubtotal = qty * price;
            const lineDiscount = lineSubtotal * (discPer / 100);
            const lineAfterDiscount = lineSubtotal - lineDiscount;

            // M037: GST routing — check if interstate (supplier state vs shop state from settings)
            const shopState = db.get("SELECT value FROM settings WHERE key = 'default_place_of_supply'")?.value || '';
            const shopStateCode = shopState.split('-')[0].trim();
            const supplierStateCode = (supplier.state || '').split('-')[0].trim();
            const isInterstate = shopStateCode && supplierStateCode && shopStateCode !== supplierStateCode;

            const lineGst = lineAfterDiscount * (gstPer / 100);
            const cgst = isInterstate ? 0 : lineGst / 2;
            const sgst = isInterstate ? 0 : lineGst / 2;
            const igst = isInterstate ? lineGst : 0;

            const lineTotal = lineAfterDiscount + lineGst;

            subtotal += lineSubtotal;
            gst_total += lineGst;
            discount_total += lineDiscount;
            grand_total += lineTotal;

            // 3. Insert Purchase Item
            const pItemRes = db.run(
                `INSERT INTO purchase_items (purchase_id, product_id, product_name, hsn_code, quantity, unit, purchase_price, discount_percent, gst_percent, cgst, sgst, igst, line_total)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [purchaseId, productId, item.product_name, item.hsn_code || '', qty, item.unit || 'PCS', price, discPer, gstPer, cgst, sgst, igst, lineTotal]
            );
            const pItemId = pItemRes.lastInsertRowid;

            // 4. Update Inventory (ONLY IF NOT DRAFT)
            if (!is_draft && productId) {
                const product = db.get('SELECT * FROM products WHERE id = ?', [productId]);
                if (product) {
                    const oldStock = Number(product.stock_quantity || 0);
                    const oldCost = Number(product.cost_price || 0);
                    const newStock = oldStock + qty;

                    // Average Cost Calculation
                    let newAvgCost = price;
                    if (newStock > 0) {
                        newAvgCost = ((oldStock * oldCost) + (qty * price)) / newStock;
                    }

                    db.run(
                        'UPDATE products SET stock_quantity = ?, cost_price = ? WHERE id = ?',
                        [newStock, newAvgCost, productId]
                    );

                    let batchId = null;
                    if (item.batch_number) {
                        const bRes = db.run(
                            'INSERT INTO product_batches (product_id, batch_number, expiry_date, purchase_id, initial_quantity, current_quantity, cost_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [productId, item.batch_number, item.expiry_date || null, purchaseId, qty, qty, price]
                        );
                        batchId = bRes.lastInsertRowid;
                        db.run('UPDATE purchase_items SET batch_id = ? WHERE id = ?', [batchId, pItemId]);
                    }

                    if (product.track_serials) {
                        const serials = item.serials || [];
                        if (serials.length !== qty) {
                            res.status(400).json({ error: `Product "${product.name}" requires exactly ${qty} serial number(s) (received: ${serials.length})` });
                            const err = new Error('Abort'); err.apiResponse = true; throw err;
                        }
                        const uniqueSerials = new Set(serials.map(s => s.trim().toUpperCase()));
                        if (uniqueSerials.size !== serials.length) {
                            res.status(400).json({ error: `Duplicate serial numbers entered for product "${product.name}"` });
                            const err = new Error('Abort'); err.apiResponse = true; throw err;
                        }
                        for (const sn of serials) {
                            const trimmedSn = sn.trim().toUpperCase();
                            const existingSerial = db.get('SELECT id FROM product_serials WHERE product_id = ? AND UPPER(serial_number) = ?', [productId, trimmedSn]);
                            if (existingSerial) {
                                res.status(400).json({ error: `Serial number "${sn}" already exists for product "${product.name}"` });
                                const err = new Error('Abort'); err.apiResponse = true; throw err;
                            }
                        }
                        for (const sn of serials) {
                            db.run(
                                'INSERT INTO product_serials (product_id, serial_number, status, purchase_id, purchase_item_id) VALUES (?, ?, ?, ?, ?)',
                                [productId, sn.trim().toUpperCase(), 'Available', purchaseId, pItemId]
                            );
                        }
                    }

                    db.run(
                        'INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [productId, 'IN', qty, 'Purchase', purchaseId, batchId, 'Purchase Receipt']
                    );
                }
            }
        }

        // 5. Update Purchase Totals & Due
        const finalPaid = Number(paid_amount || 0);
        const finalDue = Math.max(0, grand_total - finalPaid);

        let finalStatus = initialStatus;
        if (!is_draft) {
            if (finalPaid >= grand_total) finalStatus = 'Paid';
            else if (finalPaid > 0) finalStatus = 'Partial';
            else finalStatus = 'Unpaid';
        }

        db.run(
            `UPDATE purchases SET subtotal = ?, gst_total = ?, grand_total = ?, paid_amount = ?, due_amount = ?, discount_total = ?, status = ? WHERE id = ?`,
            [subtotal, gst_total, grand_total, finalPaid, finalDue, discount_total, finalStatus, purchaseId]
        );

        // 6. Update Supplier Balance (ONLY IF NOT DRAFT)
        if (!is_draft) {
            db.run(
                'UPDATE suppliers SET due_balance = due_balance + ? WHERE id = ?',
                [finalDue, supplier_id]
            );
        }

        resultObj = { id: purchaseId, grand_total, due_amount: finalDue, status: finalStatus };
        }); // End transaction
        
        res.status(201).json(resultObj);
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
    } catch (err) {
        next(err);
    }
});

// POST /api/suppliers/:id/pay — Supplier Payments (FIFO)
router.post('/suppliers/:id/pay', async (req, res, next) => {
    try {
        await db.ready;
        const supplierId = Number(req.params.id);
        const { amount, payment_mode, notes, payment_date } = req.body;
        let paymentRemaining = Number(amount || 0);

        if (paymentRemaining <= 0) return res.status(400).json({ error: 'Valid amount required' });

        let resultObj;
        try {
        db.transaction(() => {
        const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
        if (!supplier) {
            res.status(404).json({ error: 'Supplier not found' });
            const err = new Error('Abort');
            err.apiResponse = true;
            throw err;
        }

        // Record the payment
        db.run(
            'INSERT INTO supplier_payments (supplier_id, amount, payment_mode, notes, payment_date) VALUES (?, ?, ?, ?, ?)',
            [supplierId, paymentRemaining, payment_mode || 'Cash', notes || '', payment_date || new Date().toISOString()]
        );

        // Update supplier balance
        db.run('UPDATE suppliers SET due_balance = CASE WHEN due_balance - ? < 0 THEN 0 ELSE due_balance - ? END WHERE id = ?', [paymentRemaining, paymentRemaining, supplierId]);

        // FIFO: Deduct from oldest unpaid purchases
        const unpaidPurchases = db.all(
            'SELECT * FROM purchases WHERE supplier_id = ? AND due_amount > 0 AND is_draft = 0 ORDER BY purchase_date ASC, id ASC',
            [supplierId]
        );

        for (const purchase of unpaidPurchases) {
            if (paymentRemaining <= 0) break;

            const due = purchase.due_amount;
            const payToThis = Math.min(due, paymentRemaining);
            const newDue = due - payToThis;
            const newPaid = purchase.paid_amount + payToThis;
            const newStatus = newDue <= 0 ? 'Paid' : 'Partial';

            db.run(
                'UPDATE purchases SET paid_amount = ?, due_amount = ?, status = ? WHERE id = ?',
                [newPaid, newDue, newStatus, purchase.id]
            );

            paymentRemaining -= payToThis;
        }

        resultObj = { success: true, remaining_credit: paymentRemaining };
        }); // End transaction
        res.json(resultObj);
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
    } catch (err) {
        next(err);
    }
});

// POST /api/purchases/:id/return
router.post('/:id/return', async (req, res, next) => {
    try {
        await db.ready;
        const purchaseId = Number(req.params.id);
        const { items: returns, refund_method } = req.body; // Array of { product_id, quantity }

        const purchase = db.get('SELECT * FROM purchases WHERE id = ?', [purchaseId]);
        if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

        let totalReturnAmount = 0;

        for (const ret of returns) {
            const product = db.get('SELECT * FROM products WHERE id = ?', [ret.product_id]);
            if (product && product.track_serials) {
                const serialsToReturn = ret.serials || [];
                const expectedQty = Number(ret.quantity);
                if (serialsToReturn.length !== expectedQty) {
                    return res.status(400).json({ error: `Please provide exactly ${expectedQty} serial number(s) to return for product "${product.name}"` });
                }
                for (const sn of serialsToReturn) {
                    const trimmedSn = sn.trim().toUpperCase();
                    const serialRecord = db.get(
                        "SELECT id, status FROM product_serials WHERE product_id = ? AND UPPER(serial_number) = ? AND purchase_id = ?",
                        [ret.product_id, trimmedSn, purchaseId]
                    );
                    if (!serialRecord) {
                        return res.status(400).json({ error: `Serial number "${sn}" was not purchased in this receipt for "${product.name}"` });
                    }
                    if (serialRecord.status === 'Sold') {
                        return res.status(400).json({ error: `Serial number "${sn}" has already been sold and cannot be returned to supplier` });
                    }
                }
                for (const sn of serialsToReturn) {
                    db.run(
                        "UPDATE product_serials SET status = 'Returned_To_Supplier' WHERE product_id = ? AND UPPER(serial_number) = ? AND purchase_id = ?",
                        [ret.product_id, sn.trim().toUpperCase(), purchaseId]
                    );
                }
            }

            const productItems = db.all(
                'SELECT * FROM purchase_items WHERE purchase_id = ? AND product_id = ?',
                [purchaseId, ret.product_id]
            );
            if (productItems.length === 0) continue;

            let qtyToReturn = Number(ret.quantity);
            
            for (const line of productItems) {
                if (qtyToReturn <= 0) break;

                const lineReturned = db.get('SELECT SUM(quantity) as total FROM purchase_returns WHERE purchase_id = ? AND product_id = ? AND batch_id IS ?', [purchaseId, line.product_id, line.batch_id])?.total || 0;
                const returnableForLine = line.quantity - lineReturned;

                if (returnableForLine > 0) {
                    const returnQtyForLine = Math.min(qtyToReturn, returnableForLine);
                    qtyToReturn -= returnQtyForLine;

                    // Proportional return amount
                    const unitPriceWithGst = line.line_total / line.quantity;
                    const returnAmount = unitPriceWithGst * returnQtyForLine;
                    totalReturnAmount += returnAmount;

                    // Record return
                    db.run(
                        'INSERT INTO purchase_returns (purchase_id, product_id, quantity, return_amount, refund_method, batch_id) VALUES (?, ?, ?, ?, ?, ?)',
                        [purchaseId, ret.product_id, returnQtyForLine, returnAmount, refund_method, line.batch_id || null]
                    );

                    // Reduce stock
                    db.run(
                        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                        [returnQtyForLine, ret.product_id]
                    );

                    db.run(
                        'INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [ret.product_id, 'RETURN', returnQtyForLine, 'Purchase Return', purchaseId, line.batch_id || null, 'Purchase Return to Supplier']
                    );

                    if (line.batch_id) {
                        db.run('UPDATE product_batches SET current_quantity = current_quantity - ? WHERE id = ?', [returnQtyForLine, line.batch_id]);
                    }
                }
            }
        }

        // Adjust supplier due or add credit
        if (refund_method === 'Supplier Credit') {
            db.run('UPDATE suppliers SET credit_balance = credit_balance + ? WHERE id = ?', [totalReturnAmount, purchase.supplier_id]);
        } else {
            // Reduction of due
            db.run('UPDATE suppliers SET due_balance = CASE WHEN due_balance - ? < 0 THEN 0 ELSE due_balance - ? END WHERE id = ?', [totalReturnAmount, totalReturnAmount, purchase.supplier_id]);
            
            // ALSO update the specific purchase's due amount
            const newPurchaseDue = Math.max(0, (purchase.due_amount || 0) - totalReturnAmount);
            let newStatus = purchase.status;
            if (newPurchaseDue === 0 && purchase.grand_total > 0) {
                newStatus = 'Paid';
            } else if (newPurchaseDue < purchase.grand_total && newPurchaseDue > 0) {
                newStatus = 'Partial';
            }

            db.run(
                'UPDATE purchases SET due_amount = ?, status = ? WHERE id = ?',
                [newPurchaseDue, newStatus, purchaseId]
            );
        }

        res.json({ success: true, return_amount: totalReturnAmount });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
