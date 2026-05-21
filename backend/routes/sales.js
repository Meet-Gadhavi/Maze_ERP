const express = require('express');
const router = express.Router();
const db = require('../db');
const { z } = require('zod');

// C004: Zod validation schema for invoice items
const invoiceItemSchema = z.object({
    product_id: z.number().int().positive("Product ID must be a positive integer"),
    variant_id: z.number().int().positive().nullable().optional(),
    quantity: z.number().positive("Quantity must be positive"),
    unit: z.string().optional(),
    price: z.number().min(0).optional(),
    is_free: z.boolean().optional(),
    item_gst_rate: z.number().min(0).optional(),
    item_discount_rate: z.number().min(0).optional(),
    batch_id: z.number().int().positive().nullable().optional(),
    serials: z.array(z.string()).optional()
});

const invoiceSchema = z.object({
    customer_id: z.number().int().positive().nullable().optional(),
    items: z.array(invoiceItemSchema).min(1, "Invoice must have at least one item"),
    discount_rate: z.number().min(0).optional(),
    gst_rate: z.number().min(0).optional(),
    walk_in_name: z.string().optional(),
    walk_in_phone: z.string().optional(),
    p_credit_amount: z.number().min(0).optional(),
    use_p_credit: z.boolean().optional(),
    is_advance: z.boolean().optional(),
    advance_amount: z.number().min(0).optional(),
    payments: z.array(z.object({
        amount: z.number().min(0),
        method: z.string(),
        transaction_id: z.string().nullable().optional(),
        notes: z.string().nullable().optional()
    })).optional(),
    paid_amount: z.number().min(0).optional(),
    payment_method: z.string().optional()
});

// GET /api/invoices — sales history
router.get('/', async (_req, res, next) => {
    try {
        await db.ready;

        const invoices = db.all(`
      SELECT i.*, c.name AS customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC
    `);

        const result = invoices.map(inv => {
            const items = db.all(`
                SELECT ii.*, p.category 
                FROM invoice_items ii
                LEFT JOIN products p ON ii.product_id = p.id
                WHERE ii.invoice_id = ?
            `, [inv.id]);
            const payments = db.all('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC', [inv.id]);
            const serials = db.all('SELECT * FROM product_serials WHERE invoice_id = ?', [inv.id]);
            
            items.forEach(item => {
                item.serials = serials.filter(s => s.invoice_item_id === item.id).map(s => s.serial_number);
            });

            return {
                ...inv,
                items,
                payments
            };
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// Get all pending items (backorders) for Inventory tab
router.get('/pending-items', async (req, res) => {
    try {
        await db.ready;
        const items = db.all(`
            SELECT
                MAX(ii.id) as id,
                ii.product_id,
                CASE 
                    WHEN ii.variant_name IS NOT NULL AND ii.variant_name != '' 
                    THEN ii.product_name || ' (' || ii.variant_name || ')' 
                    ELSE ii.product_name 
                END as product_name,
                SUM(ii.qty_requested) as qty_requested,
                SUM(ii.qty_delivered) as qty_delivered,
                SUM(ii.pending_qty) as pending_qty,
                ii.unit,
                GROUP_CONCAT(COALESCE(c.phone, i.walk_in_phone), ', ') as customer_phone,
                p.category,
                p.product_code
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN products p ON ii.product_id = p.id
            WHERE ii.pending_qty > 0
            GROUP BY COALESCE(ii.product_id, ii.product_name), COALESCE(ii.variant_id, ii.variant_name, 0), ii.unit
            ORDER BY MAX(i.created_at) DESC
        `);
        res.json(items);
    } catch (error) {
        console.error('Error fetching pending items:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/invoices/:id — M048: fetch items via JOIN rather than a separate query
router.get('/:id', async (req, res, next) => {
    try {
        await db.ready;

        const invoice = db.get(`
      SELECT i.*, c.name AS customer_name, c.gstin AS customer_gstin
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `, [Number(req.params.id)]);

        if (!invoice) {
            res.status(404).json({ error: 'Invoice not found' });
            const err = new Error('Abort');
            err.apiResponse = true;
            throw err;
        }

        // M048: Fetch items and payments in one pass each (already indexed by invoice_id)
        invoice.items = db.all(`
            SELECT ii.*, p.product_code, p.category
            FROM invoice_items ii
            LEFT JOIN products p ON ii.product_id = p.id
            WHERE ii.invoice_id = ?
        `, [invoice.id]);
        
        const serials = db.all('SELECT * FROM product_serials WHERE invoice_id = ?', [invoice.id]);
        invoice.items.forEach(item => {
            item.serials = serials.filter(s => s.invoice_item_id === item.id).map(s => s.serial_number);
        });

        invoice.payments = db.all('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC', [invoice.id]);
        res.json(invoice);
    } catch (err) {
        next(err);
    }
});

// POST /api/invoices — create invoice + reduce stock
router.post('/', async (req, res, next) => {
    try {
        await db.ready;

        let validatedData;
        try {
            // C004: Validate incoming payload
            validatedData = invoiceSchema.parse(req.body);
        } catch (zodError) {
            const firstError = zodError.errors[0];
            const field = firstError.path.join('.');
            return res.status(400).json({ error: `Validation failed: ${field} - ${firstError.message}`, details: zodError.errors });
        }

        const settingsRows = db.all('SELECT key, value FROM settings');
        const settings = {};
        settingsRows.forEach(r => { settings[r.key] = r.value; });

        let invoice;
        try {
        db.transaction(() => {
            const {
                customer_id,
                items,
                discount_rate = 0,
                gst_rate = 0,
                walk_in_name = '',
                walk_in_phone = '',
                p_credit_amount = 0,
                use_p_credit = false,
                is_advance = false,
                advance_amount = 0,
                payments = []
            } = validatedData;

            // Determine initial paid amount from multiple payments or fallback to legacy paid_amount
            let totalPaymentsAmount = 0;
            const paymentRecords = [];

            if (payments && Array.isArray(payments) && payments.length > 0) {
                payments.forEach(p => {
                    const amt = parseFloat(p.amount || 0);
                    if (amt > 0) {
                        totalPaymentsAmount += amt;
                        paymentRecords.push({
                            amount: amt,
                            method: p.method || 'Cash',
                            transaction_id: p.transaction_id || null,
                            notes: p.notes || null
                        });
                    }
                });
            } else {
                const legacyPaidAmount = parseFloat(req.body.paid_amount || 0);
                if (legacyPaidAmount > 0) {
                    totalPaymentsAmount = legacyPaidAmount;
                    paymentRecords.push({
                        amount: legacyPaidAmount,
                        method: req.body.payment_method || 'Cash',
                        transaction_id: null,
                        notes: 'Legacy single payment'
                    });
                }
            }

            const invResult = db.run(
                'INSERT INTO invoices (customer_id, total, gst_rate, discount_rate, paid_amount, payment_status, walk_in_name, walk_in_phone, financial_status, is_advance, advance_amount, is_stock_deducted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [customer_id || null, 0, gst_rate, discount_rate, 0, is_advance ? 'ADVANCE' : 'UNPAID', walk_in_name, walk_in_phone, is_advance ? 'ADVANCE' : 'UNPAID', is_advance ? 1 : 0, Number(advance_amount), is_advance ? 0 : 1]
            );
        const invoiceId = invResult.lastInsertRowid;

        // Record individual payments
        paymentRecords.forEach(p => {
            db.run(
                'INSERT INTO invoice_payments (invoice_id, amount, method, transaction_id, notes) VALUES (?, ?, ?, ?, ?)',
                [invoiceId, p.amount, p.method, p.transaction_id, p.notes]
            );
        });

        let subtotal = 0;
        let invoiceDeliveryStatus = 'Delivered';

        // Insert items and handle stock
        for (const item of items) {
            const product = db.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
            if (!product) continue;

            const variantId = item.variant_id || null;
            const variant = variantId ? db.get('SELECT * FROM product_variants WHERE id = ?', [variantId]) : null;

            const isFree = !!item.is_free;
            const originalPrice = variant ? Number(variant.selling_price) : Number(product.selling_price || 0);
            const price = isFree ? 0 : (item.price || originalPrice); // Use provided price if any
            const requestedQty = Number(item.quantity || 0);
            
            // Multi-unit conversion
            const isSecondary = item.unit === product.secondary_unit && product.secondary_unit;
            const conversionFactor = isSecondary ? (product.conversion_factor || 1) : 1;
            const baseQuantity = requestedQty * conversionFactor;
            
            const currentStock = variant ? Number(variant.stock_quantity || 0) : Number(product.stock_quantity || 0);
            const unit = item.unit || product.unit || 'PCS';
            const promoExpense = isFree ? (requestedQty * originalPrice) : 0;

            let deliveredQty = 0;
            let status = 'Pending';
            let reduceBy = 0; // This will be in base units

            if (is_advance) {
                deliveredQty = 0;
                status = 'Pending';
                reduceBy = 0;
                invoiceDeliveryStatus = 'Pending';
            } else {
                if (settings.flexible_inventory === 'false') {
                    if (currentStock < baseQuantity) {
                        res.status(400).json({ error: `Insufficient stock for product: ${product.name}. Required: ${requestedQty} ${unit}, Available: ${variant ? variant.stock_quantity : product.stock_quantity}` });
                        const err = new Error('Abort'); err.apiResponse = true; throw err;
                    }
                }

                if (currentStock >= baseQuantity) {
                deliveredQty = requestedQty;
                status = 'Delivered';
                reduceBy = baseQuantity;
            } else if (currentStock > 0) {
                // For simplicity in partial delivery with units:
                // If it's secondary unit, we deliver floor(stock / factor) in secondary units
                if (isSecondary) {
                    const maxSecondary = Math.floor(currentStock / conversionFactor);
                    deliveredQty = maxSecondary;
                    reduceBy = maxSecondary * conversionFactor;
                } else {
                    deliveredQty = currentStock;
                    reduceBy = currentStock;
                }
                status = deliveredQty > 0 ? 'Partial' : 'Pending';
                if (deliveredQty < requestedQty) invoiceDeliveryStatus = 'Partial';
            } else {
                deliveredQty = 0;
                status = 'Pending';
                reduceBy = 0;
                invoiceDeliveryStatus = 'Pending';
            }
            }

            // Adjust invoiceDeliveryStatus if one item is partial/pending
            if (status === 'Partial' || status === 'Pending') {
                if (invoiceDeliveryStatus === 'Delivered') {
                    invoiceDeliveryStatus = status;
                } else if (invoiceDeliveryStatus === 'Delivered' || (invoiceDeliveryStatus === 'Pending' && status === 'Partial')) {
                    invoiceDeliveryStatus = 'Partial';
                }
            }

            if (product.track_serials && !is_advance && deliveredQty > 0) {
                const serials = item.serials || [];
                if (serials.length !== deliveredQty) {
                    res.status(400).json({ error: `Product "${product.name}" requires exactly ${deliveredQty} serial number(s) (received: ${serials.length})` });
                    const err = new Error('Abort'); err.apiResponse = true; throw err;
                }
                const uniqueSerials = new Set(serials.map(s => s.trim().toUpperCase()));
                if (uniqueSerials.size !== serials.length) {
                    res.status(400).json({ error: `Duplicate serial numbers entered for product "${product.name}"` });
                    const err = new Error('Abort'); err.apiResponse = true; throw err;
                }
                for (const sn of serials) {
                    const trimmedSn = sn.trim().toUpperCase();
                    const serialRecord = db.get(
                        "SELECT id, status FROM product_serials WHERE product_id = ? AND UPPER(serial_number) = ?",
                        [product.id, trimmedSn]
                    );
                    if (!serialRecord) {
                        res.status(400).json({ error: `Serial number "${sn}" is not registered in the system for product "${product.name}"` });
                        const err = new Error('Abort'); err.apiResponse = true; throw err;
                    }
                    if (serialRecord.status !== 'Available') {
                        res.status(400).json({ error: `Serial number "${sn}" is not available (current status: ${serialRecord.status})` });
                        const err = new Error('Abort'); err.apiResponse = true; throw err;
                    }
                }
            }

            const itemGstRate = Number(item.item_gst_rate || 0);
            const itemDiscountRate = Number(item.item_discount_rate || 0);
            const variantName = variant ? variant.name : '';

            const pendingQty = requestedQty - deliveredQty;
            const lineTotal = price * requestedQty;
            
            // Per-item logic for subtotal
            const afterDisk = lineTotal - (lineTotal * (itemDiscountRate / 100));
            const withGst = afterDisk + (afterDisk * (itemGstRate / 100));
            subtotal += withGst;

            const itemRes = db.run(
                'INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit, price, total, qty_requested, qty_delivered, delivery_status, pending_qty, is_free, original_price, promo_expense, variant_id, variant_name, item_gst_rate, item_discount_rate, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [invoiceId, product.id, product.name, requestedQty, unit, price, lineTotal, requestedQty, deliveredQty, status, pendingQty, isFree ? 1 : 0, originalPrice, promoExpense, variantId, variantName, itemGstRate, itemDiscountRate, item.batch_id || null]
            );
            const invoiceItemId = itemRes.lastInsertRowid;

            if (product.track_serials && !is_advance && deliveredQty > 0) {
                const serials = item.serials || [];
                for (const sn of serials) {
                    db.run(
                        "UPDATE product_serials SET status = 'Sold', invoice_id = ?, invoice_item_id = ? WHERE product_id = ? AND UPPER(serial_number) = ?",
                        [invoiceId, invoiceItemId, product.id, sn.trim().toUpperCase()]
                    );
                }
            }

            if (!is_advance && reduceBy > 0) {
                if (variant) {
                    db.run('UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?', [reduceBy, variant.id]);
                } else {
                    db.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [reduceBy, product.id]);
                }

                db.run(
                    'INSERT INTO stock_movements (product_id, variant_id, type, quantity, reference_type, reference_id, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [product.id, variant ? variant.id : null, 'OUT', reduceBy, 'Invoice', invoiceId, item.batch_id || null, 'Sale']
                );

                if (item.batch_id) {
                    db.run('UPDATE product_batches SET current_quantity = current_quantity - ? WHERE id = ?', [reduceBy, item.batch_id]);
                }
            }
        }

        // Logic to refine invoiceDeliveryStatus: if any item is NOT Delivered, the invoice is not Delivered.
        // If all are Pending -> Pending. If mixed -> Partial.
        const allItems = db.all('SELECT delivery_status FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        const statuses = allItems.map(i => i.delivery_status);
        if (statuses.every(s => s === 'Delivered')) invoiceDeliveryStatus = 'Delivered';
        else if (statuses.every(s => s === 'Pending')) invoiceDeliveryStatus = 'Pending';
        else invoiceDeliveryStatus = 'Partial';

        // Calculate final total
        const discountAmount = subtotal * (discount_rate / 100);
        const totalAfterDiscount = subtotal - discountAmount;
        const gstAmount = totalAfterDiscount * (gst_rate / 100);
        const finalTotal = totalAfterDiscount + gstAmount;

        // M039: Handle P-Credit Usage AFTER final total is calculated, capped properly
        let appliedCredit = 0;
        if (customer_id && use_p_credit && p_credit_amount > 0) {
            const customer = db.get('SELECT p_credit_balance FROM customers WHERE id = ?', [customer_id]);
            // Cap credit to: available balance, requested amount, and the final total (not more than owed)
            appliedCredit = Math.min(
                Number(customer?.p_credit_balance || 0),
                Number(p_credit_amount),
                finalTotal  // M039: finalTotal is now guaranteed to be computed before this block
            );

            if (appliedCredit > 0) {
                db.run('UPDATE customers SET p_credit_balance = p_credit_balance - ? WHERE id = ?', [appliedCredit, customer_id]);
                // Applied credit counts as part of paid amount for status determination
            }
        }

        // FINAL CALCULATION FOR STATUSES
        const returnedAmount = 0; // New invoice
        const effectiveTotal = Math.max(0, finalTotal - returnedAmount);
        let finalPaid = totalPaymentsAmount + (appliedCredit || 0);

        // Ensure walk-in is always counted as PAID (auto-balance if needed)
        if (!customer_id && !is_advance && finalPaid < effectiveTotal) {
            const balance = effectiveTotal - finalPaid;
            const defaultMethod = settings.default_payment_method || 'Cash';
            db.run(
                'INSERT INTO invoice_payments (invoice_id, amount, method, notes) VALUES (?, ?, ?, ?)',
                [invoiceId, balance, defaultMethod, 'Auto-balance for walk-in']
            );
            finalPaid = effectiveTotal;
        }

        let finalPaymentStatus = 'PAID';
        if (finalPaid === 0) finalPaymentStatus = 'UNPAID';
        else if (finalPaid < effectiveTotal) finalPaymentStatus = 'PARTIAL';
        else finalPaymentStatus = 'PAID';

        // Special case: if all items are pending (total=0), and they haven't paid, the user explicitly wants UNPAID
        if (effectiveTotal === 0 && finalPaid === 0 && (invoiceDeliveryStatus === 'Pending' || invoiceDeliveryStatus === 'Partial')) {
            finalPaymentStatus = 'UNPAID';
        }

        if (is_advance) {
            finalPaymentStatus = 'ADVANCE';
        }

        let fulfillmentStatus = 'CONFIRMED';
        let isPendingProduct = 0;

        if (invoiceDeliveryStatus === 'Pending' || invoiceDeliveryStatus === 'Partial') {
            fulfillmentStatus = 'PENDING_PRODUCT';
            isPendingProduct = 1;
        } else {
            fulfillmentStatus = 'CONFIRMED';
            isPendingProduct = 0;
        }

        // Update invoice total AND payment info
        db.run('UPDATE invoices SET total = ?, paid_amount = ?, payment_status = ?, financial_status = ?, delivery_status = ?, fulfillment_status = ?, is_pending_product = ?, is_stock_deducted = ? WHERE id = ?',
            [finalTotal, finalPaid, finalPaymentStatus, finalPaymentStatus, is_advance ? 'Pending' : invoiceDeliveryStatus, is_advance ? 'PENDING_PRODUCT' : fulfillmentStatus, is_advance ? 1 : isPendingProduct, is_advance ? 0 : 1, invoiceId]);

        // Log initiation
        db.run('INSERT INTO audit_logs (invoice_id, action, details) VALUES (?, ?, ?)',
            [invoiceId, 'Invoice Created', `Invoice created. Fulfillment: ${fulfillmentStatus}, Payment: ${finalPaymentStatus}`]);

        invoice = db.get(`
            SELECT i.*, c.name AS customer_name
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE i.id = ?
        `, [invoiceId]);
        if (invoice) {
            invoice.items = db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
            invoice.payments = db.all('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC', [invoiceId]);
        }
        }); // End transaction
        
        if (!invoice) {
            // Invoice was created but could not be fetched back — fetch it now
            invoice = db.get('SELECT i.*, c.name AS customer_name FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id ORDER BY i.id DESC LIMIT 1');
            if (invoice) {
                invoice.items = db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoice.id]);
                invoice.payments = db.all('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC', [invoice.id]);
            }
        }
        
        res.status(201).json(invoice);
        } catch (txnErr) {
            if (txnErr.apiResponse) return; // Already handled
            console.error('[Invoice Creation Error]', txnErr);
            throw txnErr;
        }
    } catch (err) {
        next(err);
    }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await db.ready;
        db.run('DELETE FROM invoices WHERE id = ?', [Number(req.params.id)]);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// POST /api/invoices/:id/return — process returns
router.post('/:id/return', async (req, res, next) => {
    try {
        await db.ready;
        const invoiceId = Number(req.params.id);
        const { items: returns, refund_method } = req.body; // Array of { product_id, quantity }, refund_method: 'refund' | 'p_credit'

        if (!returns || !returns.length) {
            return res.status(400).json({ error: 'No items provided for return' });
        }

        let resultObj;
        try {
        db.transaction(() => {
        const invoice = db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
        if (!invoice) {
            res.status(404).json({ error: 'Invoice not found' });
            const err = new Error('Abort');
            err.apiResponse = true;
            throw err;
        }

        const originalItems = db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        const invoiceReturnedRecords = db.all('SELECT product_id, SUM(return_qty) as total_returned FROM invoice_returns WHERE invoice_id = ? GROUP BY product_id', [invoiceId]);

        let totalReturnAmount = 0;

        for (const ret of returns) {
            const product = db.get('SELECT * FROM products WHERE id = ?', [ret.product_id]);
            if (product && product.track_serials) {
                const serialsToReturn = ret.serials || [];
                const expectedQty = Number(ret.quantity);
                if (serialsToReturn.length !== expectedQty) {
                    res.status(400).json({ error: `Please provide exactly ${expectedQty} serial number(s) to return for product "${product.name}"` });
                    const err = new Error('Abort'); err.apiResponse = true; throw err;
                }
                for (const sn of serialsToReturn) {
                    const trimmedSn = sn.trim().toUpperCase();
                    const serialRecord = db.get(
                        "SELECT id, status FROM product_serials WHERE product_id = ? AND UPPER(serial_number) = ? AND invoice_id = ?",
                        [ret.product_id, trimmedSn, invoiceId]
                    );
                    if (!serialRecord) {
                        res.status(400).json({ error: `Serial number "${sn}" was not sold in this invoice for "${product.name}"` });
                        const err = new Error('Abort'); err.apiResponse = true; throw err;
                    }
                    if (serialRecord.status !== 'Sold') {
                        res.status(400).json({ error: `Serial number "${sn}" is not in 'Sold' status (current status: ${serialRecord.status})` });
                        const err = new Error('Abort'); err.apiResponse = true; throw err;
                    }
                }
                for (const sn of serialsToReturn) {
                    db.run(
                        "UPDATE product_serials SET status = 'Available', invoice_id = NULL, invoice_item_id = NULL WHERE product_id = ? AND UPPER(serial_number) = ? AND invoice_id = ?",
                        [ret.product_id, sn.trim().toUpperCase(), invoiceId]
                    );
                }
            }

            const productItems = originalItems.filter(i => i.product_id === ret.product_id);
            if (productItems.length === 0) {
                res.status(400).json({ error: `Product ${ret.product_id} was not in this invoice` });
                const err = new Error('Abort');
                err.apiResponse = true;
                throw err;
            }

            const totalOriginalQty = productItems.reduce((acc, curr) => acc + curr.quantity, 0);
            const alreadyReturned = invoiceReturnedRecords.find(r => r.product_id === ret.product_id)?.total_returned || 0;
            if (ret.quantity + alreadyReturned > totalOriginalQty) {
                res.status(400).json({ error: `Cannot return more than sold for this product` });
                const err = new Error('Abort');
                err.apiResponse = true;
                throw err;
            }

            let qtyToReturn = ret.quantity;
            for (const line of productItems) {
                if (qtyToReturn <= 0) break;
                
                // For this specific batch line, how much has been returned?
                const lineReturned = db.get('SELECT SUM(return_qty) as total FROM invoice_returns WHERE invoice_id = ? AND product_id = ? AND batch_id IS ?', [invoiceId, line.product_id, line.batch_id])?.total || 0;
                const returnableForLine = line.quantity - lineReturned;

                if (returnableForLine > 0) {
                    const returnQtyForLine = Math.min(qtyToReturn, returnableForLine);
                    qtyToReturn -= returnQtyForLine;

                    // Calculate proportional return amount (including GST and Discount)
                    const lineSubtotal = line.price * returnQtyForLine;
                    const lineDiscount = lineSubtotal * (invoice.discount_rate / 100);
                    const lineAfterDiscount = lineSubtotal - lineDiscount;
                    const lineGst = lineAfterDiscount * (invoice.gst_rate / 100);
                    const lineFinalReturnAmount = lineAfterDiscount + lineGst;

                    totalReturnAmount += lineFinalReturnAmount;

                    // Log return record
                    db.run(
                        'INSERT INTO invoice_returns (invoice_id, product_id, return_qty, return_amount, refund_method, batch_id) VALUES (?, ?, ?, ?, ?, ?)',
                        [invoiceId, ret.product_id, returnQtyForLine, lineFinalReturnAmount, 'pending', line.batch_id || null]
                    );

                    // Restore product stock
                    db.run(
                        'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
                        [returnQtyForLine, ret.product_id]
                    );

                    // Record stock movement for return
                    db.run(
                        'INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [ret.product_id, 'RETURN', returnQtyForLine, 'Invoice Return', invoiceId, line.batch_id || null, 'Sale Return']
                    );

                    if (line.batch_id) {
                        db.run('UPDATE product_batches SET current_quantity = current_quantity + ? WHERE id = ?', [returnQtyForLine, line.batch_id]);
                    }
                }
            }
        }

        // Financial Logic (Dynamic Calculations)
        const newTotalReturned = Number(invoice.total_returned_amount || 0) + totalReturnAmount;
        const originalTotal = Number(invoice.total || 0);
        const effectiveTotal = Math.max(0, originalTotal - newTotalReturned);
        let currentPaid = Number(invoice.paid_amount || 0);

        // effective_due = effective_total - paid_amount
        let effectiveDue = effectiveTotal - currentPaid;
        let refundBalance = 0;

        if (effectiveDue < 0) {
            refundBalance = Math.abs(effectiveDue);
            effectiveDue = 0;
            // Note: paid_amount remains as is until many types of "Refund Back" are processed, 
            // but for system logic, the "excess" is the refund balance.
        }

        // Determine Financial Status and Payment Status
        let paymentStatus = 'Paid';
        let financialStatus = 'Returned';
        let returnType = 'partial';

        // Check if fully returned
        const allItems = db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        const allReturns = db.all('SELECT product_id, SUM(return_qty) as total_returned FROM invoice_returns WHERE invoice_id = ? GROUP BY product_id', [invoiceId]);
        const isFullReturn = allItems.every(item => {
            const retRecord = allReturns.find(r => r.product_id === item.product_id);
            return retRecord && retRecord.total_returned === item.quantity;
        });

        if (isFullReturn) {
            returnType = 'full';
            financialStatus = 'Returned';
            paymentStatus = 'Returned';
            effectiveDue = 0;
            // For full return, refund balance is the entire paid amount (initially)
            // But we already calculated it via effectiveDue < 0 above if they paid anything.
        } else {
            returnType = 'partial';
            if (currentPaid === 0) {
                paymentStatus = 'UNPAID';
                financialStatus = 'Partially Returned';
            } else if (currentPaid < effectiveTotal) {
                paymentStatus = 'PARTIAL';
                financialStatus = 'Partially Returned';
            } else {
                paymentStatus = 'PAID';
                financialStatus = 'Partially Returned';
            }

            // Refined financial status based on return impact
            if (refundBalance > 0) {
                financialStatus = (refund_method === 'p_credit') ? 'P-Credited' : 'Returned';
            } else if (effectiveDue < (originalTotal - currentPaid)) {
                // If the new due is less than the old due, it was adjusted
                financialStatus = (effectiveDue === 0) ? 'Settled' : 'Credit Adjusted';
            }
        }

        // Handle P-Credit conversion if requested
        if (refund_method === 'p_credit' && refundBalance > 0 && invoice.customer_id) {
            db.run('UPDATE customers SET p_credit_balance = p_credit_balance + ? WHERE id = ?', [refundBalance, invoice.customer_id]);
            // If converting to P-Credit, we treat it as if the user "withdrew" the cash from the invoice
            db.run('UPDATE invoices SET paid_amount = paid_amount - ? WHERE id = ?', [refundBalance, invoiceId]);
        } else if (refund_method === 'refund' && refundBalance > 0) {
            // Reduce paid amount after refund back (cash given back)
            // This ensures effective_due = (Total - returned) - (Paid - refunded) = 0
            db.run('UPDATE invoices SET paid_amount = paid_amount - ? WHERE id = ?', [refundBalance, invoiceId]);
        }

        db.run('UPDATE invoices SET total_returned_amount = ?, return_type = ?, financial_status = ?, payment_status = ? WHERE id = ?',
            [newTotalReturned, returnType, financialStatus, paymentStatus, invoiceId]);

        updatedInvoice = db.get(`
            SELECT i.*, c.name AS customer_name
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE i.id = ?
        `, [invoiceId]);
        updatedInvoice.items = allItems;
        updatedInvoice.returns = db.all('SELECT * FROM invoice_returns WHERE invoice_id = ?', [invoiceId]);
        }); // End transaction

        res.json(updatedInvoice);
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
    } catch (err) {
        next(err);
    }
});

// PUT /api/invoices/:id/payment — update payment amount
router.put('/:id/payment', async (req, res, next) => {
    try {
        await db.ready;
        const invoiceId = Number(req.params.id);
        const { amount, use_p_credit, p_credit_amount, payment_method, transaction_id, notes } = req.body;
        const cashAmount = Number(amount || 0);
        const pCreditUsed = (use_p_credit === true || use_p_credit === 'true') ? Number(p_credit_amount || 0) : 0;

        if (cashAmount < 0 || pCreditUsed < 0 || (cashAmount === 0 && pCreditUsed === 0)) {
            return res.status(400).json({ error: 'Please enter a valid cash or credit amount to proceed.' });
        }

        let resultObj;
        try {
        db.transaction(() => {
        const invoice = db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
        if (!invoice) {
            res.status(404).json({ error: 'Invoice not found' });
            const err = new Error('Abort');
            err.apiResponse = true;
            throw err;
        }

        if (cashAmount > 0) {
            db.run(
                'INSERT INTO invoice_payments (invoice_id, amount, method, transaction_id, notes) VALUES (?, ?, ?, ?, ?)',
                [invoiceId, cashAmount, payment_method || 'Cash', transaction_id || null, notes || 'Direct payment update']
            );
        }

        if (pCreditUsed > 0) {
            if (!invoice.customer_id) return res.status(400).json({ error: 'P-Credit can only be used for registered customers' });
            const customer = db.get('SELECT * FROM customers WHERE id = ?', [invoice.customer_id]);
            if (!customer || customer.p_credit_balance < pCreditUsed) {
                return res.status(400).json({ error: 'Insufficient P-Credit balance' });
            }
            // Deduct from customer and track on invoice
            db.run('UPDATE customers SET p_credit_balance = p_credit_balance - ? WHERE id = ?', [pCreditUsed, invoice.customer_id]);
            db.run('UPDATE invoices SET p_credit_amount = IFNULL(p_credit_amount, 0) + ? WHERE id = ?', [pCreditUsed, invoiceId]);
            
            // Also record P-Credit as a payment record for history? 
            // In many ERPs, credit is a payment method.
            db.run(
                'INSERT INTO invoice_payments (invoice_id, amount, method, notes) VALUES (?, ?, ?, ?)',
                [invoiceId, pCreditUsed, 'P-Credit', 'Applied from customer balance']
            );
        }

        const newPaidAmount = Number(invoice.paid_amount || 0) + cashAmount + pCreditUsed;
        const originalTotal = Number(invoice.total || 0);
        const returnedAmount = Number(invoice.total_returned_amount || 0);
        const effectiveTotal = Math.max(0, originalTotal - returnedAmount);

        let newStatus = 'PARTIAL';
        let finalPaid = newPaidAmount;

        if (newPaidAmount >= effectiveTotal) {
            newStatus = 'PAID';
            finalPaid = effectiveTotal;
        }

        if (invoice.is_advance && !invoice.is_stock_deducted) {
            newStatus = 'ADVANCE';
        }

        // Finalize Financial Status based on new state and returns
        let newFinancialStatus = newStatus;
        if (returnedAmount > 0) {
            newFinancialStatus = (newStatus === 'PAID') ? 'Settled' : 'Partially Returned';
            // 'Settled' indicates it was returned and the remaining was paid.
            // 'Partially Returned' indicates there are still dues.
        }

        // Determine fulfillment status based on returns
        const isFullyReturned = (originalTotal - returnedAmount) <= 0;
        let newFulfillmentStatus = invoice.fulfillment_status; // Keep existing if not fully returned
        if (isFullyReturned) {
            newFulfillmentStatus = 'RETURNED';
        }

        db.run(
            'UPDATE invoices SET paid_amount = ?, payment_status = ?, financial_status = ?, fulfillment_status = ? WHERE id = ?',
            [finalPaid, newStatus, newFinancialStatus, newFulfillmentStatus, invoiceId]
        );

        let updated;
        updated = db.get(`
            SELECT i.*, c.name AS customer_name
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE i.id = ?
        `, [invoiceId]);

        updated.items = db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        }); // End transaction

        res.json(updated);
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
    } catch (err) {
        next(err);
    }
});

// POST /api/invoices/:id/fulfill — fulfill pending items
router.post('/:id/fulfill', async (req, res, next) => {
    try {
        await db.ready;
        const invoiceId = Number(req.params.id);
        const { fulfillments } = req.body; // Array of { product_id, deliver_qty }

        if (!fulfillments || !fulfillments.length) {
            return res.status(400).json({ error: 'No fulfillment data provided' });
        }

        let resultObj;
        try {
        db.transaction(() => {
        const invoice = db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
        if (!invoice) {
            res.status(404).json({ error: 'Invoice not found' });
            const err = new Error('Abort');
            err.apiResponse = true;
            throw err;
        }

        for (const f of fulfillments) {
            const item = db.get('SELECT * FROM invoice_items WHERE invoice_id = ? AND product_id = ?', [invoiceId, f.product_id]);
            if (!item) continue;

            const product = db.get('SELECT * FROM products WHERE id = ?', [f.product_id]);
            const deliverQty = Number(f.deliver_qty);

            if (product && product.track_serials && deliverQty > 0) {
                const serials = f.serials || [];
                if (serials.length !== deliverQty) {
                    res.status(400).json({ error: `Product "${product.name}" requires exactly ${deliverQty} serial number(s) (received: ${serials.length})` });
                    const err = new Error('Abort'); err.apiResponse = true; throw err;
                }
                const uniqueSerials = new Set(serials.map(s => s.trim().toUpperCase()));
                if (uniqueSerials.size !== serials.length) {
                    res.status(400).json({ error: `Duplicate serial numbers entered for product "${product.name}"` });
                    const err = new Error('Abort'); err.apiResponse = true; throw err;
                }
                for (const sn of serials) {
                    const trimmedSn = sn.trim().toUpperCase();
                    const serialRecord = db.get(
                        "SELECT id, status FROM product_serials WHERE product_id = ? AND UPPER(serial_number) = ?",
                        [product.id, trimmedSn]
                    );
                    if (!serialRecord) {
                        res.status(400).json({ error: `Serial number "${sn}" is not registered in the system for product "${product.name}"` });
                        const err = new Error('Abort'); err.apiResponse = true; throw err;
                    }
                    if (serialRecord.status !== 'Available') {
                        res.status(400).json({ error: `Serial number "${sn}" is not available (current status: ${serialRecord.status})` });
                        const err = new Error('Abort'); err.apiResponse = true; throw err;
                    }
                }
                // Save serials
                for (const sn of serials) {
                    db.run(
                        "UPDATE product_serials SET status = 'Sold', invoice_id = ?, invoice_item_id = ? WHERE product_id = ? AND UPPER(serial_number) = ?",
                        [invoiceId, item.id, product.id, sn.trim().toUpperCase()]
                    );
                }
            }

            if (deliverQty > item.pending_qty) {
                return res.status(400).json({ error: `Cannot deliver more than pending for ${item.product_name}` });
            }
            if (deliverQty > product.stock_quantity) {
                return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
            }

            const newDelivered = item.qty_delivered + deliverQty;
            const newPending = item.qty_requested - newDelivered;
            const newStatus = newPending === 0 ? 'Delivered' : 'Partial';
            const newLineTotal = item.price * newDelivered;

            db.run(
                'UPDATE invoice_items SET qty_delivered = ?, pending_qty = ?, delivery_status = ?, total = ? WHERE id = ?',
                [newDelivered, newPending, newStatus, newLineTotal, item.id]
            );

            db.run(
                'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                [deliverQty, product.id]
            );

            db.run(
                'INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
                [product.id, 'OUT', deliverQty, 'Invoice Fulfillment', invoiceId, 'Fulfillment Delivery']
            );
            
            // M035: Verify batch availability before deducting
            if (f.batch_id) {
                const batch = db.get('SELECT current_quantity FROM product_batches WHERE id = ?', [f.batch_id]);
                if (!batch || batch.current_quantity < deliverQty) {
                    return res.status(400).json({ error: `Insufficient batch stock for ${item.product_name}. Available: ${batch?.current_quantity ?? 0}` });
                }
                db.run('UPDATE product_batches SET current_quantity = current_quantity - ? WHERE id = ?', [deliverQty, f.batch_id]);
            }

            db.run('INSERT INTO audit_logs (invoice_id, action, details) VALUES (?, ?, ?)',
                [invoiceId, 'Fulfillment', `Delivered ${deliverQty} units of ${item.product_name}`]);
        }

        // Recalculate Invoice totals
        const refreshedItems = db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        let newSubtotal = 0;
        refreshedItems.forEach(i => newSubtotal += i.total);

        const discountAmount = newSubtotal * (invoice.discount_rate / 100);
        const afterDiscount = newSubtotal - discountAmount;
        const gstAmount = afterDiscount * (invoice.gst_rate / 100);
        const newGrandTotal = afterDiscount + gstAmount;

        // Delivery Status
        const statuses = refreshedItems.map(i => i.delivery_status);
        let invoiceDeliveryStatus = 'Delivered';
        if (statuses.every(s => s === 'Delivered')) invoiceDeliveryStatus = 'Delivered';
        else if (statuses.every(s => s === 'Pending')) invoiceDeliveryStatus = 'Pending';
        else invoiceDeliveryStatus = 'Partial';

        let fulfillmentStatus = invoiceDeliveryStatus === 'Delivered' ? 'COMPLETED' : 'PENDING_PRODUCT';
        let isPendingProduct = invoiceDeliveryStatus === 'Delivered' ? 0 : 1;

        // Payment logic
        const returnedAmount = Number(invoice.total_returned_amount || 0);
        const effectiveTotal = Math.max(0, newGrandTotal - returnedAmount);
        const paidAmount = Number(invoice.paid_amount || 0);

        let newPaymentStatus = 'PAID';
        if (paidAmount === 0) newPaymentStatus = 'UNPAID';
        else if (paidAmount < effectiveTotal) newPaymentStatus = 'PARTIAL';
        else newPaymentStatus = 'PAID';

        db.run('UPDATE invoices SET total = ?, delivery_status = ?, fulfillment_status = ?, is_pending_product = ?, payment_status = ?, financial_status = ? WHERE id = ?',
            [newGrandTotal, invoiceDeliveryStatus, fulfillmentStatus, isPendingProduct, newPaymentStatus, newPaymentStatus, invoiceId]);

        }); // End transaction
        res.json({ success: true, grand_total: newGrandTotal, delivery_status: invoiceDeliveryStatus, fulfillment_status: fulfillmentStatus, payment_status: newPaymentStatus });
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
    } catch (err) {
        next(err);
    }
});

// POST /api/invoices/:id/process-advance — deduct stock for advance invoices
router.post('/:id/process-advance', async (req, res, next) => {
    try {
        await db.ready;
        const invoiceId = Number(req.params.id);
        let resultObj;
        try {
        db.transaction(() => {
        const invoice = db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
        if (!invoice) {
            res.status(404).json({ error: 'Invoice not found' });
            const err = new Error('Abort');
            err.apiResponse = true;
            throw err;
        }
        if (invoice.is_stock_deducted) return res.status(400).json({ error: 'Stock already deducted for this invoice' });

        const items = db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        let invoiceDeliveryStatus = 'Delivered';

        for (const item of items) {
            const product = db.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
            if (!product) continue;

            const pendingQtyBefore = Number(item.pending_qty || 0);
            if (pendingQtyBefore <= 0) continue;

            let deliverNow = 0;
            let status = item.delivery_status;
            let reduceBy = 0;

            const currentStock = Number(product.stock_quantity || 0);
            if (currentStock >= pendingQtyBefore) {
                deliverNow = pendingQtyBefore;
                status = 'Delivered';
                reduceBy = pendingQtyBefore;
            } else if (currentStock > 0) {
                deliverNow = currentStock;
                status = 'Partial';
                reduceBy = currentStock;
                invoiceDeliveryStatus = 'Partial';
            } else {
                deliverNow = 0;
                status = 'Pending';
                reduceBy = 0;
                invoiceDeliveryStatus = 'Pending';
            }

            const newDelivered = Number(item.qty_delivered || 0) + deliverNow;
            const newPending = pendingQtyBefore - deliverNow;

            db.run(
                'UPDATE invoice_items SET qty_delivered = ?, pending_qty = ?, delivery_status = ? WHERE id = ?',
                [newDelivered, newPending, status, item.id]
            );

            if (reduceBy > 0) {
                db.run(
                    'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                    [reduceBy, product.id]
                );
                
                db.run(
                    'INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
                    [product.id, 'OUT', reduceBy, 'Advance Invoice', invoiceId, 'Advance Delivery']
                );
            }
        }

        // Delivery Status logic
        const allItems = db.all('SELECT delivery_status FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        const statuses = allItems.map(i => i.delivery_status);
        if (statuses.every(s => s === 'Delivered')) invoiceDeliveryStatus = 'Delivered';
        else if (statuses.every(s => s === 'Pending')) invoiceDeliveryStatus = 'Pending';
        else invoiceDeliveryStatus = 'Partial';

        let fulfillmentStatus = invoiceDeliveryStatus === 'Delivered' ? 'COMPLETED' : 'PENDING_PRODUCT';
        let isPendingProduct = invoiceDeliveryStatus === 'Delivered' ? 0 : 1;

        // Payment status logic after advance is processed
        const paidAmount = Number(invoice.paid_amount || 0);
        const total = Number(invoice.total || 0);
        const returnedAmount = Number(invoice.total_returned_amount || 0);
        const effectiveTotal = Math.max(0, total - returnedAmount);

        let newPaymentStatus = 'PAID';
        if (paidAmount === 0) newPaymentStatus = 'UNPAID';
        else if (paidAmount < effectiveTotal) newPaymentStatus = 'PARTIAL';
        else newPaymentStatus = 'PAID';

        db.run('UPDATE invoices SET is_stock_deducted = 1, payment_status = ?, financial_status = ?, delivery_status = ?, fulfillment_status = ?, is_pending_product = ? WHERE id = ?',
            [newPaymentStatus, newPaymentStatus, invoiceDeliveryStatus, fulfillmentStatus, isPendingProduct, invoiceId]);

        }); // End transaction
        res.json({ success: true, payment_status: newPaymentStatus });
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
    } catch (err) {
        next(err);
    }
});

module.exports = router;
