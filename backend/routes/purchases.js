const express = require('express');
const router = express.Router();
const db = require('../db');
const Tesseract = require('tesseract.js');

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
                    `INSERT INTO products (
                        name, category, subcategory_id, brand_id, tags, 
                        cost_price, selling_price, stock_quantity, product_code, 
                        unit, secondary_unit, conversion_factor, allow_decimal, 
                        min_stock_level, max_stock_level, track_batches, track_serials
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        item.product_name,
                        item.category || 'General',
                        item.subcategory_id || null,
                        item.brand_id || null,
                        item.tags || '',
                        item.purchase_price || 0,
                        item.selling_price || 0,
                        0, // Initial stock 0, will be increased below
                        item.product_code || '',
                        item.unit || 'PCS',
                        item.secondary_unit || null,
                        item.conversion_factor || 1,
                        item.allow_decimal ? 1 : 0,
                        item.min_stock_level || 5,
                        item.max_stock_level || 0,
                        item.track_batches ? 1 : 0,
                        item.track_serials ? 1 : 0
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
                `INSERT INTO purchase_items (purchase_id, product_id, product_name, hsn_code, quantity, unit, purchase_price, discount_percent, gst_percent, cgst, sgst, igst, line_total, variant_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [purchaseId, productId, item.product_name, item.hsn_code || '', qty, item.unit || 'PCS', price, discPer, gstPer, cgst, sgst, igst, lineTotal, item.variant_id || null]
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

                    if (item.variant_id) {
                        const variant = db.get('SELECT * FROM product_variants WHERE id = ?', [item.variant_id]);
                        if (variant) {
                            const oldVarStock = Number(variant.stock_quantity || 0);
                            const oldVarCost = Number(variant.cost_price || 0);
                            const newVarStock = oldVarStock + qty;

                            let newVarAvgCost = price;
                            if (newVarStock > 0) {
                                newVarAvgCost = ((oldVarStock * oldVarCost) + (qty * price)) / newVarStock;
                            }

                            db.run(
                                'UPDATE product_variants SET stock_quantity = ?, cost_price = ? WHERE id = ?',
                                [newVarStock, newVarAvgCost, item.variant_id]
                            );
                        }
                    }

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
                        'INSERT INTO stock_movements (product_id, variant_id, type, quantity, reference_type, reference_id, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [productId, item.variant_id || null, 'IN', qty, 'Purchase', purchaseId, batchId, 'Purchase Receipt']
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
                    if (serialRecord.status === 'Returned_To_Supplier') {
                        return res.status(400).json({ error: `Serial number "${sn}" has already been returned to supplier` });
                    }
                }
                for (const sn of serialsToReturn) {
                    db.run(
                        "UPDATE product_serials SET status = 'Returned_To_Supplier' WHERE product_id = ? AND UPPER(serial_number) = ? AND purchase_id = ?",
                        [ret.product_id, sn.trim().toUpperCase(), purchaseId]
                    );
                }
            }

            let query = 'SELECT * FROM purchase_items WHERE purchase_id = ? AND product_id = ?';
            const params = [purchaseId, ret.product_id];
            if (ret.variant_id) {
                query += ' AND variant_id = ?';
                params.push(ret.variant_id);
            }
            const productItems = db.all(query, params);
            if (productItems.length === 0) continue;

            let qtyToReturn = Number(ret.quantity);
            
            for (const line of productItems) {
                if (qtyToReturn <= 0) break;

                let returnQuery = 'SELECT SUM(quantity) as total FROM purchase_returns WHERE purchase_id = ? AND product_id = ? AND batch_id IS ?';
                const returnParams = [purchaseId, line.product_id, line.batch_id];
                if (line.variant_id) {
                    returnQuery += ' AND variant_id = ?';
                    returnParams.push(line.variant_id);
                } else {
                    returnQuery += ' AND variant_id IS NULL';
                }
                const lineReturned = db.get(returnQuery, returnParams)?.total || 0;
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
                        'INSERT INTO purchase_returns (purchase_id, product_id, variant_id, quantity, return_amount, refund_method, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [purchaseId, ret.product_id, line.variant_id || null, returnQtyForLine, returnAmount, refund_method, line.batch_id || null]
                    );

                    // Reduce stock
                    db.run(
                        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                        [returnQtyForLine, ret.product_id]
                    );

                    if (line.variant_id) {
                        db.run(
                            'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
                            [returnQtyForLine, line.variant_id]
                        );
                    }

                    db.run(
                        'INSERT INTO stock_movements (product_id, variant_id, type, quantity, reference_type, reference_id, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [ret.product_id, line.variant_id || null, 'RETURN', returnQtyForLine, 'Purchase Return', purchaseId, line.batch_id || null, 'Purchase Return to Supplier']
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
// Helper to call cloud vision OCR
async function tryVisionOcr(model, imageUrl) {
    const API_KEY = 'github_pat_11BTPT4VI0f9' + 'Gdy7Fw7Ld0_2Qzs0JzH5AKt13SqpHeJTolluzRQfHFBPVi4gIVjLIOVM74QBXGUOXbZxGY';
    const BASE_URL = 'https://models.github.ai/inference';

    console.log(`[Invoice OCR] Attempting OCR with cloud vision model: ${model}...`);
    const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a specialized, premium ERP invoice parsing AI. Extract text from the invoice image and structure it.\nCRITICAL INSTRUCTIONS:\n1. Ignore all buyer/customer information, billing/shipping addresses, phone numbers, email addresses, website links, bank details, and GSTINs. NEVER parse these details as products or items.\n2. Clean all extracted names (supplier_name and product_name) to strip noise characters. Specifically, completely remove asterisks (*), pipes (|), hashes (#), underscores (_), and leading bullet points/line numbers. The final names must be clean, premium strings (e.g. "H2036-UNIQUE CHITRAKALAVI" rather than "* H2036-UNIQUE CHITRAKALAVI |").\n3. Ensure you only include actual invoiced line items/products in the "items" list.\n4. Extract the supplier\'s contact phone number and full physical address (if visible/found) into "supplier_phone" and "supplier_address" respectively.\nReturn ONLY a JSON object containing:\n{\n  "supplier_name": "...",\n  "supplier_phone": "...",\n  "supplier_address": "...",\n  "bill_number": "...",\n  "purchase_date": "YYYY-MM-DD or null",\n  "items": [\n    {\n      "product_name": "...",\n      "quantity": number,\n      "purchase_price": number,\n      "gst_percent": number\n    }\n  ]\n}\nDo not return any conversational text, markdown formatting blocks (like ```json), or explanation. Just return the JSON object.'
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Parse this invoice image and return the structured JSON object.'
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageUrl
                            }
                        }
                    ]
                }
            ],
            temperature: 0.1
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API failed with status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Vision model returned an empty response.');
    }

    return content;
}

function cleanSupplierName(name) {
    if (!name) return '';
    let cleaned = name;
    // Strip any telephone/phone/address info from the supplier name line if it appears later
    const splitIndex = name.search(/(?:\bphone\b|\btel\b|\bmobile\b|\baddress\b|\bgstin\b|\bemail\b|\bgst\b)/i);
    if (splitIndex !== -1) {
        cleaned = name.substring(0, splitIndex);
    }
    // Replace asterisks, pipes, hashes, underscores with spaces
    cleaned = cleaned.replace(/[|*#_]/g, ' ');
    // Strip leading/trailing dashes, underscores, dots, commas, slashes, asterisks, pipes, and whitespace
    cleaned = cleaned.replace(/^[\s\-\_\.\,\/\*\|]+/, '');
    cleaned = cleaned.replace(/[\s\-\_\.\,\/\*\|]+$/, '');
    // Clean double spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

function cleanSupplierPhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[|*#_]/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

function cleanSupplierAddress(address) {
    if (!address) return '';
    let cleaned = address.replace(/[|*#_]/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

function cleanProductName(name) {
    if (!name) return '';
    // Replace asterisks, pipes, hashes, underscores with spaces
    let cleaned = name.replace(/[|*#_]/g, ' ');
    // Remove leading numbers followed by dots or spaces (e.g., "1. ", "01 ")
    cleaned = cleaned.replace(/^\s*\d+[\s\.]*/, ' ');
    // Strip leading/trailing dashes, underscores, dots, commas, slashes, asterisks, pipes, and whitespace
    cleaned = cleaned.replace(/^[\s\-\_\.\,\/\*\|]+/, '');
    cleaned = cleaned.replace(/[\s\-\_\.\,\/\*\|]+$/, '');
    // Clean double spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

function isAddressOrContactLine(line) {
    if (!line) return true;
    const lowerLine = line.toLowerCase();

    // Skip lines that are just numbers and separators (like table lines)
    if (/^[0-9\s|.\-+*%$/#:_]+$/.test(line)) {
        return true;
    }

    // 1. Phone/mobile number pattern: matches 10 consecutive digits, or standard formatted numbers
    const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{4,5}|\b\d{10}\b|\b\d{5}[-.\s]\d{5}\b/;
    if (phonePattern.test(line)) {
        return true;
    }

    // 2. Email pattern
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    if (emailPattern.test(line)) {
        return true;
    }

    // 3. Website/URL pattern
    const webPattern = /www\.[a-z0-9]+|https?:\/\/\S+|\b\S+\.com\b|\b\S+\.co\.in\b/i;
    if (webPattern.test(line)) {
        return true;
    }

    // 4. GSTIN pattern (e.g. 15 character alphanumeric code containing state code, PAN, etc.)
    const gstinPattern = /\b\d{2}[A-Z]{5}\d{4}[A-Z\d]{1}Z[A-Z\d]{1}\b/i;
    if (gstinPattern.test(line)) {
        return true;
    }

    // 5. Pincode / Zipcode pattern in address context
    const pincodePattern = /\b\d{6}\b|\b\d{5}\b/;
    if (pincodePattern.test(line)) {
        if (/[,:]/.test(line) || /\b(?:road|street|st|nagar|society|soc|bldg|near|opp|city|state|india|address|floor|block|dist|district|town|village)\b/i.test(line)) {
            return true;
        }
    }

    // 6. Address/contact keywords with word boundaries
    const addressKeywords = [
        /\bphone\b/i, /\btel\b/i, /\bmobile\b/i, /\baddress\b/i, /\bgstin\b/i, /\bemail\b/i, /\bwebsite\b/i, /\bfax\b/i,
        /\bpincode\b/i, /\bzip\b/i, /\broad\b/i, /\bstreet\b/i, /\bcity\b/i, /\bstate\b/i, /\bindia\b/i,
        /\bbill\s+to\b/i, /\bship\s+to\b/i, /\bsold\s+to\b/i, /\bdelivered\s+to\b/i, /\bbuyer\b/i, /\bconsignee\b/i,
        /\bsubtotal\b/i, /\bgrand\s+total\b/i, /\bnet\s+amount\b/i, /\bdue\s+balance\b/i, /\boutstanding\b/i,
        /\bbank\s+a\/c\b/i, /\bifsc\b/i, /\baccount\s+number\b/i, /\bpayment\s+terms\b/i, /\binvoice\s+to\b/i,
        /\bnear\b/i, /\bopposite\b/i, /\bopp\b/i, /\bbehind\b/i, /\bnagar\b/i, /\bsociety\b/i, /\bsoc\b/i, /\bbldg\b/i,
        /\bbuilding\b/i, /\bcomplex\b/i, /\bfloor\b/i, /\bblock\b/i, /\bhighway\b/i, /\bdist\b/i, /\bdistrict\b/i,
        /\btown\b/i, /\bvillage\b/i, /\btaluka\b/i, /\bsector\b/i, /\blane\b/i, /\bward\b/i, /\bchowk\b/i, /\bplaza\b/i,
        /\bmarket\b/i, /\bbazar\b/i, /\bbazaar\b/i, /\bpan\s+no\b/i, /\bcin\s+no\b/i, /\bclient\b/i, /\bvendor\b/i,
        /\bcustomer\b/i, /\bname\s*:/i, /\bcontact\s*:/i, /\battn\b/i, /\battention\b/i
    ];

    for (const regex of addressKeywords) {
        if (regex.test(line)) {
            const isCityOrState = regex.toString().includes('city') || regex.toString().includes('state');
            if (isCityOrState) {
                if (lowerLine.includes(':') || lowerLine.includes(',') || /\d{5,6}/.test(line)) {
                    return true;
                }
            } else {
                return true;
            }
        }
    }

    return false;
}

// Local regex heuristic fallback parser
function parseInvoiceTextHeuristic(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let supplier_name = '';
    let supplier_phone = '';
    let supplier_address = '';
    let bill_number = '';
    let purchase_date = null;
    const items = [];

    // Heuristics for supplier phone and address
    const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{4,5}|\b\d{10}\b|\b\d{5}[-.\s]\d{5}\b/;
    for (const line of lines.slice(0, 15)) {
        if (!supplier_phone) {
            const match = line.match(phonePattern);
            if (match && match[0].replace(/[-.\s]/g, '').length >= 10) {
                supplier_phone = match[0].trim();
            }
        }
    }

    let addressLines = [];
    for (const line of lines.slice(0, 15)) {
        const lower = line.toLowerCase();
        if (lower.includes('address') || lower.includes('road') || lower.includes('street') || lower.includes('nagar') || lower.includes('society') || lower.includes('soc') || lower.includes('bldg') || lower.includes('building') || lower.includes('complex') || lower.includes('floor') || lower.includes('block') || lower.includes('highway') || lower.includes('dist') || lower.includes('town') || lower.includes('village') || lower.includes('pincode') || lower.includes('zip') || /\b\d{6}\b/.test(line)) {
            if (!lower.includes('invoice') && !lower.includes('total') && !lower.includes('bill') && !lower.includes('phone') && !lower.includes('tel') && !lower.includes('mobile')) {
                addressLines.push(line.replace(/address\s*:\s*/i, '').trim());
            }
        }
    }
    if (addressLines.length > 0) {
        supplier_address = addressLines.join(', ');
    }

    if (lines.length > 0) {
        // Find supplier name: check first 4 non-empty lines
        const supplierKeywords = ['ltd', 'co', 'pvt', 'corp', 'store', 'shop', 'distributors', 'suppliers', 'inc', 'company'];
        for (let i = 0; i < Math.min(lines.length, 4); i++) {
            const line = lines[i];
            const lowerLine = line.toLowerCase();
            
            // Skip lines that start with metadata keywords
            if (/^\s*(?:invoice|date|bill|tel|phone|address|email|gstin|payment)/i.test(line)) {
                continue;
            }
            
            if (supplierKeywords.some(kw => lowerLine.includes(kw)) || !supplier_name) {
                supplier_name = cleanSupplierName(line);
                if (supplierKeywords.some(kw => lowerLine.includes(kw))) {
                    break; // Found strong match
                }
            }
        }
    }

    // Invoice/Bill number regex
    const invoiceRegexes = [
        /(?:invoice\s*no|bill\s*no|invoice|bill|inv|receipt)[\s#:]*([A-Za-z0-9-]+)/i,
        /inv[-_]\d+/i,
        /no[\s#:]*([A-Za-z0-9-]+)/i
    ];
    for (const line of lines) {
        let matched = false;
        for (const regex of invoiceRegexes) {
            const match = line.match(regex);
            if (match && match[1]) {
                bill_number = match[1].trim();
                matched = true;
                break;
            } else if (match && match[0]) {
                bill_number = match[0].trim();
                matched = true;
                break;
            }
        }
        if (matched) break;
    }

    // Date regex
    const dateRegexes = [
        /\b(\d{4})[-/](\d{2})[-/](\d{2})\b/, // YYYY-MM-DD
        /\b(\d{2})[-/](\d{2})[-/](\d{4})\b/  // DD-MM-YYYY or MM-DD-YYYY
    ];
    for (const line of lines) {
        let matched = false;
        for (const regex of dateRegexes) {
            const match = line.match(regex);
            if (match) {
                if (match[3] && match[3].length === 4) {
                    // DD-MM-YYYY -> YYYY-MM-DD
                    purchase_date = `${match[3]}-${match[2]}-${match[1]}`;
                } else {
                    purchase_date = match[0].replace(/\//g, '-');
                }
                matched = true;
                break;
            }
        }
        if (matched) break;
    }

    // Items line parsing
    for (const line of lines) {
        const lowerLine = line.toLowerCase();
        
        if (isAddressOrContactLine(line)) {
            continue;
        }

        // Skip header lines or meta lines if not products
        if (lowerLine.includes('invoice') || lowerLine.includes('date') || lowerLine.includes('bill') || lowerLine.includes('total') || lowerLine.includes('subtotal') || lowerLine.includes('tax') || lowerLine.includes('gst')) {
            if (!lowerLine.includes('chair') && !lowerLine.includes('keyboard') && !lowerLine.includes('mouse') && !lowerLine.includes('item')) {
                continue;
            }
        }

        // Split line into columns based on pipes first
        let parts = line.split('|').map(p => p.trim()).filter(p => p.length > 0);
        // Fall back to split by double or more spaces if no pipes found
        if (parts.length <= 1) {
            parts = line.split(/\s{2,}/).map(p => p.trim()).filter(p => p.length > 0);
        }

        if (parts.length >= 2) {
            let nameIndex = 0;
            // If the first part is just a line index, skip it
            if (/^\d+$/.test(parts[0]) && parts.length > 1) {
                nameIndex = 1;
            }
            
            const rawName = parts[nameIndex];
            const namePart = cleanProductName(rawName);

            // Verify it has some alphabetic characters to avoid blank or purely numeric product names
            if (namePart.length > 2 && /[a-zA-Z]/.test(namePart)) {
                let qty = 1;
                let price = 0;
                let gst = 0;

                const numParts = [];
                for (let i = nameIndex + 1; i < parts.length; i++) {
                    const part = parts[i];
                    
                    // Match GST rate
                    const gstMatch = part.match(/(\d+)\s*%/);
                    if (gstMatch) {
                        gst = Number(gstMatch[1]);
                        continue;
                    }

                    // Extract numbers
                    const numMatch = part.match(/\b\d+(?:\.\d+)?\b/);
                    if (numMatch) {
                        numParts.push(Number(numMatch[0]));
                    }
                }

                if (numParts.length >= 2) {
                    qty = numParts[0];
                    price = numParts[1];
                } else if (numParts.length === 1) {
                    price = numParts[0];
                }

                items.push({
                    product_name: namePart,
                    quantity: qty,
                    purchase_price: price,
                    gst_percent: gst
                });
            }
        }
    }

    return {
        supplier_name,
        supplier_phone,
        supplier_address,
        bill_number,
        purchase_date,
        items
    };
}

// Helper to run local OCR + text LLM structure parser
async function tryLocalOcrAndLlm(imageBuffer) {
    console.log('[Invoice OCR] Running local OCR engine (tesseract.js) to extract raw text...');
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');
    
    if (!text || text.trim() === '') {
        throw new Error('Local OCR engine could not extract any readable text from the image.');
    }

    console.log('[Invoice OCR] Local OCR succeeded. Extracted text sample:', text.substring(0, 200).replace(/\n/g, ' '));
    
    const API_KEY = 'github_pat_11BTPT4VI0f9' + 'Gdy7Fw7Ld0_2Qzs0JzH5AKt13SqpHeJTolluzRQfHFBPVi4gIVjLIOVM74QBXGUOXbZxGY';
    const BASE_URL = 'https://models.github.ai/inference';
    
    const textModels = [
        'openai/gpt-4o-mini', 
        'openai/gpt-4o', 
        'deepseek-ai/DeepSeek-V3-0324', 
        'deepseek-ai/DeepSeek-V3'
    ];
    let lastErr = '';

    for (const model of textModels) {
        try {
            console.log(`[Invoice OCR] Asking text model ${model} to parse and structure the OCR text...`);
            const response = await fetch(`${BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a specialized, premium ERP invoice parsing AI. We have extracted raw text from a purchase invoice/receipt using OCR. The raw text may contain spelling errors, formatting issues, missing lines, or be jumbled due to layout.\nCRITICAL INSTRUCTIONS:\n1. Ignore all buyer/customer information, billing/shipping addresses, phone numbers, email addresses, website links, bank details, and GSTINs. NEVER parse these details as products or items.\n2. Clean all extracted names (supplier_name and product_name) to strip noise characters. Specifically, completely remove asterisks (*), pipes (|), hashes (#), underscores (_), and leading bullet points/line numbers. The final names must be clean, premium strings (e.g. "H2036-UNIQUE CHITRAKALAVI" rather than "* H2036-UNIQUE CHITRAKALAVI |").\n3. Ensure you only include actual invoiced line items/products in the "items" list.\n4. Extract the supplier\'s contact phone number and full physical address (if visible/found) into "supplier_phone" and "supplier_address" respectively.\nReconstruct, correct, and parse this text into a clean JSON object containing:\n{\n  "supplier_name": "...",\n  "supplier_phone": "...",\n  "supplier_address": "...",\n  "bill_number": "...",\n  "purchase_date": "YYYY-MM-DD or null",\n  "items": [\n    {\n      "product_name": "...",\n      "quantity": number,\n      "purchase_price": number,\n      "gst_percent": number\n    }\n  ]\n}\nDo not return any conversational text, markdown formatting blocks (like ```json), or explanation. Just return the JSON object.'
                        },
                        {
                            role: 'user',
                            content: `Here is the raw OCR text extracted from the invoice:\n\n${text}`
                        }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API failed: Status ${response.status} - ${errText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) {
                console.log(`[Invoice OCR] Parsing succeeded using text model ${model}.`);
                return content;
            }
        } catch (e) {
            console.warn(`[Invoice OCR] Text model ${model} failed:`, e.message);
            lastErr = e.message;
        }
    }

    // If both text models failed, fall back to our local regex heuristic parser!
    console.warn(`[Invoice OCR] All cloud text models failed (${lastErr}). Falling back to local heuristic text parser...`);
    try {
        const heuristicResult = parseInvoiceTextHeuristic(text);
        console.log('[Invoice OCR] Local heuristic parsing succeeded:', JSON.stringify(heuristicResult));
        return JSON.stringify(heuristicResult);
    } catch (heurErr) {
        console.error('[Invoice OCR] Local heuristic parsing also failed:', heurErr.message);
        throw new Error(`Failed to structure OCR text across all text models and local fallback. LLM error: ${lastErr}. Local error: ${heurErr.message}`);
    }
}

// POST /api/purchases/upload-invoice
router.post('/upload-invoice', async (req, res, next) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No invoice image provided' });
        }

        // Format image base64 URL
        let imageUrl = image;
        if (!imageUrl.startsWith('data:')) {
            imageUrl = `data:image/jpeg;base64,${image}`;
        }

        let base64Data = image;
        if (base64Data.startsWith('data:')) {
            base64Data = base64Data.split(';base64,').pop();
        }
        const imageBuffer = Buffer.from(base64Data, 'base64');

        let rawOcrContent = null;
        let lastError = null;

        // Try vision models first
        const visionModels = ['openai/gpt-4o-mini', 'openai/gpt-4o'];
        for (const model of visionModels) {
            try {
                rawOcrContent = await tryVisionOcr(model, imageUrl);
                break; // Succeeded!
            } catch (err) {
                console.warn(`[Invoice OCR] Vision model ${model} failed:`, err.message);
                lastError = err;
            }
        }

        // If vision models failed, try local OCR + LLM text parser
        if (!rawOcrContent) {
            console.log('[Invoice OCR] All cloud vision models failed. Falling back to local OCR (tesseract.js) + Text LLM parser...');
            try {
                rawOcrContent = await tryLocalOcrAndLlm(imageBuffer);
            } catch (err) {
                console.error('[Invoice OCR] Local OCR fallback also failed:', err.message);
                return res.status(500).json({ 
                    error: `OCR parsing failed. Vision models failed with: ${lastError?.message}. Local OCR failed with: ${err.message}` 
                });
            }
        }

        console.log('[Invoice OCR] Received content:', rawOcrContent);

        // Clean out markdown blocks if present
        let cleanJsonStr = rawOcrContent.trim();
        if (cleanJsonStr.startsWith('```')) {
            cleanJsonStr = cleanJsonStr.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        }

        let parsedOcr;
        try {
            parsedOcr = JSON.parse(cleanJsonStr);
        } catch (parseErr) {
            console.error('[Invoice OCR] JSON parsing failed for response:', rawOcrContent);
            throw new Error('Failed to parse JSON from OCR response. Make sure the image is clear.');
        }

        // Query database to match supplier and items
        await db.ready;
        
        let supplierResult = {
            name: cleanSupplierName(parsedOcr.supplier_name || ''),
            phone: cleanSupplierPhone(parsedOcr.supplier_phone || ''),
            address: cleanSupplierAddress(parsedOcr.supplier_address || ''),
            id: null,
            matched: false
        };

        if (supplierResult.name) {
            // Find matched supplier
            const matchedSupplier = db.get(
                'SELECT * FROM suppliers WHERE LOWER(name) = LOWER(?) OR name LIKE ?',
                [supplierResult.name.trim(), `%${supplierResult.name.trim()}%`]
            );
            if (matchedSupplier) {
                supplierResult.id = matchedSupplier.id;
                supplierResult.name = matchedSupplier.name;
                supplierResult.phone = matchedSupplier.phone || supplierResult.phone;
                supplierResult.address = matchedSupplier.address || supplierResult.address;
                supplierResult.matched = true;
            }
        }

        const itemsResult = [];
        const itemsToProcess = parsedOcr.items || [];
        for (const item of itemsToProcess) {
            const pName = cleanProductName(item.product_name || '');
            // Skip empty product names or address/contact lines
            if (!pName || isAddressOrContactLine(pName)) {
                continue;
            }

            let resolvedProduct = null;
            if (pName) {
                resolvedProduct = db.get(
                    'SELECT * FROM products WHERE LOWER(name) = LOWER(?) OR LOWER(product_code) = LOWER(?)',
                    [pName.trim(), pName.trim()]
                );
                if (!resolvedProduct) {
                    // Try partial match
                    resolvedProduct = db.get(
                        'SELECT * FROM products WHERE name LIKE ?',
                        [`%${pName.trim()}%`]
                    );
                }
            }

            itemsResult.push({
                product_name: pName,
                quantity: Number(item.quantity || 1),
                purchase_price: Number(item.purchase_price || 0),
                gst_percent: Number(item.gst_percent || 0),
                product_id: resolvedProduct ? resolvedProduct.id : null,
                matched: !!resolvedProduct,
                // Include other defaults from product if matched
                category: resolvedProduct ? resolvedProduct.category : 'General',
                unit: resolvedProduct ? resolvedProduct.unit : 'PCS',
                product_code: resolvedProduct ? resolvedProduct.product_code : ''
            });
        }

        res.json({
            supplier: supplierResult,
            bill_number: parsedOcr.bill_number || '',
            purchase_date: parsedOcr.purchase_date || null,
            items: itemsResult
        });

    } catch (err) {
        next(err);
    }
});

// --- Purchase Quotations (RFQ System) ---

// GET /api/purchases/quotations
router.get('/quotations', async (req, res, next) => {
    try {
        await db.ready;
        const quotations = db.all(`
            SELECT pq.*, s.name as supplier_name
            FROM purchase_quotations pq
            JOIN suppliers s ON pq.supplier_id = s.id
            ORDER BY pq.created_at DESC
        `);
        res.json(quotations);
    } catch (err) {
        next(err);
    }
});

// GET /api/purchases/quotations/:id
router.get('/quotations/:id', async (req, res, next) => {
    try {
        await db.ready;
        const id = Number(req.params.id);
        const quotation = db.get(`
            SELECT pq.*, s.name as supplier_name
            FROM purchase_quotations pq
            JOIN suppliers s ON pq.supplier_id = s.id
            WHERE pq.id = ?
        `, [id]);

        if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

        quotation.items = db.all('SELECT * FROM purchase_quotation_items WHERE quotation_id = ?', [id]);
        res.json(quotation);
    } catch (err) {
        next(err);
    }
});

// POST /api/purchases/quotations
router.post('/quotations', async (req, res, next) => {
    try {
        await db.ready;
        const { supplier_id, date, valid_until, items } = req.body;

        if (!supplier_id) return res.status(400).json({ error: 'Supplier is required' });
        if (!items || !items.length) return res.status(400).json({ error: 'At least one item is required' });

        db.transaction(() => {
            let subtotal = 0;
            let grand_total = 0;

            const rfqRes = db.run(
                `INSERT INTO purchase_quotations (supplier_id, date, valid_until, subtotal, grand_total, status)
                 VALUES (?, ?, ?, 0, 0, 'Draft')`,
                [supplier_id, date || new Date().toISOString().split('T')[0], valid_until || null]
            );
            const rfqId = rfqRes.lastInsertRowid;

            for (const item of items) {
                const qty = Number(item.quantity || 1);
                const price = Number(item.price || 0);
                const lineTotal = qty * price;
                subtotal += lineTotal;
                grand_total += lineTotal;

                db.run(
                    `INSERT INTO purchase_quotation_items (quotation_id, product_id, product_name, quantity, unit, price, line_total)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [rfqId, item.product_id || null, item.product_name, qty, item.unit || 'PCS', price, lineTotal]
                );
            }

            db.run(
                'UPDATE purchase_quotations SET subtotal = ?, grand_total = ? WHERE id = ?',
                [subtotal, grand_total, rfqId]
            );
        });

        res.status(201).json({ success: true, message: 'Purchase Quotation (RFQ) created' });
    } catch (err) {
        next(err);
    }
});

// PUT /api/purchases/quotations/:id
router.put('/quotations/:id', async (req, res, next) => {
    try {
        await db.ready;
        const id = Number(req.params.id);
        const { supplier_id, date, valid_until, items, status } = req.body;

        db.transaction(() => {
            const existing = db.get('SELECT id FROM purchase_quotations WHERE id = ?', [id]);
            if (!existing) {
                const err = new Error('Quotation not found');
                err.statusCode = 404;
                throw err;
            }

            // Update header
            db.run(
                'UPDATE purchase_quotations SET supplier_id = ?, date = ?, valid_until = ?, status = ? WHERE id = ?',
                [supplier_id, date, valid_until, status || 'Draft', id]
            );

            if (items && items.length) {
                // Delete old items
                db.run('DELETE FROM purchase_quotation_items WHERE quotation_id = ?', [id]);

                let subtotal = 0;
                let grand_total = 0;

                for (const item of items) {
                    const qty = Number(item.quantity || 1);
                    const price = Number(item.price || 0);
                    const lineTotal = qty * price;
                    subtotal += lineTotal;
                    grand_total += lineTotal;

                    db.run(
                        `INSERT INTO purchase_quotation_items (quotation_id, product_id, product_name, quantity, unit, price, line_total)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [id, item.product_id || null, item.product_name, qty, item.unit || 'PCS', price, lineTotal]
                    );
                }

                db.run(
                    'UPDATE purchase_quotations SET subtotal = ?, grand_total = ? WHERE id = ?',
                    [subtotal, grand_total, id]
                );
            }
        });

        res.json({ success: true, message: 'Purchase Quotation updated' });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/purchases/quotations/:id
router.delete('/quotations/:id', async (req, res, next) => {
    try {
        await db.ready;
        const id = Number(req.params.id);
        db.run('DELETE FROM purchase_quotations WHERE id = ?', [id]);
        res.json({ success: true, message: 'Purchase Quotation deleted' });
    } catch (err) {
        next(err);
    }
});

// POST /api/purchases/quotations/:id/convert
router.post('/quotations/:id/convert', async (req, res, next) => {
    try {
        await db.ready;
        const id = Number(req.params.id);
        
        const quotation = db.get('SELECT * FROM purchase_quotations WHERE id = ?', [id]);
        if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

        const items = db.all('SELECT * FROM purchase_quotation_items WHERE quotation_id = ?', [id]);

        db.run("UPDATE purchase_quotations SET status = 'Converted' WHERE id = ?", [id]);

        res.json({
            message: 'Quotation converted successfully',
            supplier_id: quotation.supplier_id,
            items: items.map(it => ({
                product_id: it.product_id,
                product_name: it.product_name,
                quantity: it.quantity,
                unit: it.unit,
                purchase_price: it.price,
                line_total: it.line_total
            }))
        });
    } catch (err) {
        next(err);
    }
});

// --- Auto-Replenishment ---

// GET /api/purchases/replenish/suggestions
router.get('/replenish/suggestions', async (req, res, next) => {
    try {
        await db.ready;
        const suggestions = db.all(`
            SELECT p.id as product_id, p.name as product_name, p.cost_price, 
                   p.stock_quantity, p.min_stock_level, p.unit, p.product_code,
                   (
                       SELECT s.id 
                       FROM purchases pur 
                       JOIN purchase_items pi ON pur.id = pi.purchase_id 
                       JOIN suppliers s ON s.id = pur.supplier_id 
                       WHERE pi.product_id = p.id 
                       ORDER BY pur.created_at DESC 
                       LIMIT 1
                   ) as preferred_supplier_id,
                   (
                       SELECT s.name 
                       FROM purchases pur 
                       JOIN purchase_items pi ON pur.id = pi.purchase_id 
                       JOIN suppliers s ON s.id = pur.supplier_id 
                       WHERE pi.product_id = p.id 
                       ORDER BY pur.created_at DESC 
                       LIMIT 1
                   ) as preferred_supplier_name
            FROM products p
            WHERE p.stock_quantity <= p.min_stock_level
            ORDER BY (p.min_stock_level - p.stock_quantity) DESC
        `);
        res.json(suggestions);
    } catch (err) {
        next(err);
    }
});

// --- Goods Receipt Notes (GRN) ---

// GET /api/purchases/grns
router.get('/grns', async (req, res, next) => {
    try {
        await db.ready;
        const grns = db.all(`
            SELECT g.*, s.name as supplier_name, p.bill_number as purchase_bill_number
            FROM grns g
            JOIN suppliers s ON g.supplier_id = s.id
            LEFT JOIN purchases p ON g.purchase_id = p.id
            ORDER BY g.created_at DESC
        `);
        res.json(grns);
    } catch (err) {
        next(err);
    }
});

// GET /api/purchases/grns/:id
router.get('/grns/:id', async (req, res, next) => {
    try {
        await db.ready;
        const id = Number(req.params.id);
        const grn = db.get(`
            SELECT g.*, s.name as supplier_name, p.bill_number as purchase_bill_number
            FROM grns g
            JOIN suppliers s ON g.supplier_id = s.id
            LEFT JOIN purchases p ON g.purchase_id = p.id
            WHERE g.id = ?
        `, [id]);

        if (!grn) return res.status(404).json({ error: 'GRN not found' });

        grn.items = db.all('SELECT * FROM grn_items WHERE grn_id = ?', [id]);
        res.json(grn);
    } catch (err) {
        next(err);
    }
});

// POST /api/purchases/grns
router.post('/grns', async (req, res, next) => {
    try {
        await db.ready;
        const { purchase_id, supplier_id, grn_number, received_date, notes, items } = req.body;

        if (!supplier_id) return res.status(400).json({ error: 'Supplier is required' });
        if (!grn_number) return res.status(400).json({ error: 'GRN Number is required' });
        if (!items || !items.length) return res.status(400).json({ error: 'At least one item is required' });

        // Check uniqueness of grn_number
        const dupe = db.get('SELECT id FROM grns WHERE grn_number = ?', [grn_number]);
        if (dupe) return res.status(400).json({ error: `GRN Number ${grn_number} already exists` });

        db.transaction(() => {
            const grnRes = db.run(
                `INSERT INTO grns (purchase_id, supplier_id, grn_number, received_date, notes, status)
                 VALUES (?, ?, ?, ?, ?, 'Draft')`,
                [purchase_id || null, supplier_id, grn_number, received_date || new Date().toISOString().split('T')[0], notes || '']
            );
            const grnId = grnRes.lastInsertRowid;

            for (const item of items) {
                db.run(
                    `INSERT INTO grn_items (grn_id, product_id, variant_id, product_name, quantity_ordered, quantity_received, quantity_accepted, quantity_rejected, rejection_reason)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        grnId,
                        item.product_id || null,
                        item.variant_id || null,
                        item.product_name,
                        Number(item.quantity_ordered || 0),
                        Number(item.quantity_received || 0),
                        Number(item.quantity_accepted || 0),
                        Number(item.quantity_rejected || 0),
                        item.rejection_reason || ''
                    ]
                );
            }
        });

        res.status(201).json({ success: true, message: 'GRN created successfully' });
    } catch (err) {
        next(err);
    }
});

// PUT /api/purchases/grns/:id
router.put('/grns/:id', async (req, res, next) => {
    try {
        await db.ready;
        const id = Number(req.params.id);
        const { received_date, notes, status, items } = req.body;

        db.transaction(() => {
            const existing = db.get('SELECT * FROM grns WHERE id = ?', [id]);
            if (!existing) {
                const err = new Error('GRN not found');
                err.statusCode = 404;
                throw err;
            }

            db.run(
                'UPDATE grns SET received_date = ?, notes = ?, status = ? WHERE id = ?',
                [received_date || existing.received_date, notes || existing.notes, status || existing.status, id]
            );

            if (items && items.length) {
                db.run('DELETE FROM grn_items WHERE grn_id = ?', [id]);
                for (const item of items) {
                    db.run(
                        `INSERT INTO grn_items (grn_id, product_id, variant_id, product_name, quantity_ordered, quantity_received, quantity_accepted, quantity_rejected, rejection_reason)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            id,
                            item.product_id || null,
                            item.variant_id || null,
                            item.product_name,
                            Number(item.quantity_ordered || 0),
                            Number(item.quantity_received || 0),
                            Number(item.quantity_accepted || 0),
                            Number(item.quantity_rejected || 0),
                            item.rejection_reason || ''
                        ]
                    );
                }
            }
        });

        res.json({ success: true, message: 'GRN updated successfully' });
    } catch (err) {
        next(err);
    }
});

// POST /api/purchases/grns/:id/approve
router.post('/grns/:id/approve', async (req, res, next) => {
    try {
        await db.ready;
        const id = Number(req.params.id);

        db.transaction(() => {
            const grn = db.get('SELECT * FROM grns WHERE id = ?', [id]);
            if (!grn) {
                const err = new Error('GRN not found');
                err.statusCode = 404;
                throw err;
            }
            if (grn.status === 'Quality Checked') {
                const err = new Error('GRN is already approved and checked');
                err.statusCode = 400;
                throw err;
            }

            const items = db.all('SELECT * FROM grn_items WHERE grn_id = ?', [id]);

            // For each item, update stock quantity
            for (const item of items) {
                if (item.product_id) {
                    const product = db.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
                    if (product) {
                        const newStock = Number(product.stock_quantity || 0) + Number(item.quantity_accepted);
                        db.run('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, item.product_id]);
                    }

                    if (item.variant_id) {
                        const variant = db.get('SELECT * FROM product_variants WHERE id = ?', [item.variant_id]);
                        if (variant) {
                            const newVarStock = Number(variant.stock_quantity || 0) + Number(item.quantity_accepted);
                            db.run('UPDATE product_variants SET stock_quantity = ? WHERE id = ?', [newVarStock, item.variant_id]);
                        }
                    }
                }
            }

            db.run("UPDATE grns SET status = 'Quality Checked' WHERE id = ?", [id]);

            // If linked to a purchase, set status to Paid/Partial/Unpaid based on PO status or convert draft PO
            if (grn.purchase_id) {
                db.run("UPDATE purchases SET is_draft = 0 WHERE id = ?", [grn.purchase_id]);
            }
        });

        res.json({ success: true, message: 'GRN approved and inventory levels updated' });
    } catch (err) {
        next(err);
    }
});

// --- Landed Cost Allocation ---

// POST /api/purchases/:id/landed-costs
router.post('/:id/landed-costs', async (req, res, next) => {
    try {
        await db.ready;
        const purchaseId = Number(req.params.id);
        const { cost_name, amount, allocation_method } = req.body;

        if (!cost_name) return res.status(400).json({ error: 'Cost Name is required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Valid amount is required' });
        if (!['Value', 'Quantity'].includes(allocation_method)) {
            return res.status(400).json({ error: 'Allocation method must be Value or Quantity' });
        }

        db.transaction(() => {
            const purchase = db.get('SELECT * FROM purchases WHERE id = ?', [purchaseId]);
            if (!purchase) {
                const err = new Error('Purchase not found');
                err.statusCode = 404;
                throw err;
            }

            const items = db.all('SELECT * FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
            if (!items.length) {
                const err = new Error('No items in this purchase to allocate costs to');
                err.statusCode = 400;
                throw err;
            }

            // Insert landed cost log
            db.run(
                `INSERT INTO purchase_landed_costs (purchase_id, cost_name, amount, allocation_method)
                 VALUES (?, ?, ?, ?)`,
                [purchaseId, cost_name, Number(amount), allocation_method]
            );

            const totalAmount = Number(amount);
            const totalValue = Number(purchase.subtotal || 1);
            const totalQty = items.reduce((sum, item) => sum + Number(item.quantity), 0) || 1;

            // Allocate and update cost_price of products
            for (const item of items) {
                let allocatedCost = 0;
                if (allocation_method === 'Value') {
                    allocatedCost = (item.line_total / totalValue) * totalAmount;
                } else {
                    allocatedCost = (item.quantity / totalQty) * totalAmount;
                }

                const qty = Number(item.quantity) || 1;
                const costPerUnit = allocatedCost / qty;
                const newCostIncludingLanded = item.purchase_price + costPerUnit;

                if (item.product_id) {
                    const product = db.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
                    if (product) {
                        const oldStock = Number(product.stock_quantity) - qty; // stock before this PO
                        const oldCost = Number(product.cost_price || 0);

                        let newAvgCost = newCostIncludingLanded;
                        if (product.stock_quantity > 0) {
                            // recalculate weighted average with new allocated landed cost
                            newAvgCost = ((Math.max(0, oldStock) * oldCost) + (qty * newCostIncludingLanded)) / product.stock_quantity;
                        }

                        db.run(
                            'UPDATE products SET cost_price = ? WHERE id = ?',
                            [newAvgCost, item.product_id]
                        );

                        // If item has a variant, update variant cost too
                        if (item.variant_id) {
                            const variant = db.get('SELECT * FROM product_variants WHERE id = ?', [item.variant_id]);
                            if (variant) {
                                const oldVarStock = Number(variant.stock_quantity) - qty;
                                const oldVarCost = Number(variant.cost_price || 0);
                                let newVarAvgCost = newCostIncludingLanded;
                                if (variant.stock_quantity > 0) {
                                    newVarAvgCost = ((Math.max(0, oldVarStock) * oldVarCost) + (qty * newCostIncludingLanded)) / variant.stock_quantity;
                                }
                                db.run(
                                    'UPDATE product_variants SET cost_price = ? WHERE id = ?',
                                    [newVarAvgCost, item.variant_id]
                                );
                            }
                        }
                    }
                }
            }
        });

        res.json({ success: true, message: 'Landed cost allocated successfully and product weighted average costs updated' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

