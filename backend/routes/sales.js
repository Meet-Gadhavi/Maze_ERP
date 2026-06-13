const express = require('express');
const router = express.Router();
const db = require('../db');
const { z } = require('zod');
const EmailConnection = require('../models/EmailConnection');
const gmailSender = require('../services/email/gmailSender');
const whatsappSender = require('../services/whatsappSender');
const { generateInvoicePDF } = require('../services/pdfGenerator');
const hostedInvoiceService = require('../services/hostedInvoiceService');
const loyaltyService = require('../services/loyaltyService');

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

function deductProductStock(productId, variantId, qtyToDeduct, invoiceId, notes) {
    const product = db.get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) return;
    
    if (variantId) {
        db.run('UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?', [qtyToDeduct, variantId]);
        db.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [qtyToDeduct, productId]);
    } else {
        db.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [qtyToDeduct, productId]);
    }
    
    // Batch tracking
    let batchId = null;
    if (product.track_batches) {
        const batches = db.all('SELECT * FROM product_batches WHERE product_id = ? AND current_quantity > 0 ORDER BY expiry_date ASC, created_at ASC', [productId]);
        let remaining = qtyToDeduct;
        for (const batch of batches) {
            if (remaining <= 0) break;
            const deduct = Math.min(batch.current_quantity, remaining);
            db.run('UPDATE product_batches SET current_quantity = current_quantity - ? WHERE id = ?', [deduct, batch.id]);
            remaining -= deduct;
            if (!batchId) batchId = batch.id;
        }
        if (remaining > 0) {
            const latest = db.get('SELECT * FROM product_batches WHERE product_id = ? ORDER BY id DESC LIMIT 1', [productId]);
            if (latest) {
                db.run('UPDATE product_batches SET current_quantity = current_quantity - ? WHERE id = ?', [remaining, latest.id]);
                batchId = latest.id;
            }
        }
    }
    
    // Serial tracking
    if (product.track_serials) {
        const serials = db.all('SELECT * FROM product_serials WHERE product_id = ? AND status = "Available" ORDER BY id ASC LIMIT ?', [productId, Math.ceil(qtyToDeduct)]);
        for (const serial of serials) {
            db.run("UPDATE product_serials SET status = 'Sold', invoice_id = ? WHERE id = ?", [invoiceId, serial.id]);
        }
    }
    
    db.run(
        'INSERT INTO stock_movements (product_id, variant_id, type, quantity, reference_type, reference_id, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [productId, variantId || null, 'OUT', qtyToDeduct, 'Invoice', invoiceId, batchId, notes]
    );
}

function restoreProductStock(productId, variantId, qtyToRestore, invoiceId, notes) {
    const product = db.get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) return;
    
    if (variantId) {
        db.run('UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?', [qtyToRestore, variantId]);
        db.run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [qtyToRestore, productId]);
    } else {
        db.run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [qtyToRestore, productId]);
    }
    
    // Batch tracking
    let batchId = null;
    if (product.track_batches) {
        const latest = db.get('SELECT * FROM product_batches WHERE product_id = ? ORDER BY id DESC LIMIT 1', [productId]);
        if (latest) {
            db.run('UPDATE product_batches SET current_quantity = current_quantity + ? WHERE id = ?', [qtyToRestore, latest.id]);
            batchId = latest.id;
        }
    }
    
    // Serial tracking
    if (product.track_serials) {
        const serials = db.all('SELECT * FROM product_serials WHERE product_id = ? AND status = "Sold" AND invoice_id = ? ORDER BY id DESC LIMIT ?', [productId, invoiceId, Math.ceil(qtyToRestore)]);
        for (const serial of serials) {
            db.run("UPDATE product_serials SET status = 'Available', invoice_id = NULL, invoice_item_id = NULL WHERE id = ?", [serial.id]);
        }
    }
    
    db.run(
        'INSERT INTO stock_movements (product_id, variant_id, type, quantity, reference_type, reference_id, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [productId, variantId || null, 'RETURN', qtyToRestore, 'Invoice Return', invoiceId, batchId, notes]
    );
}

// Auto-sync helper for hosted invoices when updated in ERP
async function syncInvoiceIfShared(invoiceId) {
    try {
        const tokenRow = db.get("SELECT token FROM invoice_tokens WHERE invoice_id = ?", [invoiceId]);
        if (tokenRow) {
            console.log(`[Sync Helper] Auto-syncing updated invoice #${invoiceId} to cloud DB...`);
            await hostedInvoiceService.generateHostedInvoice(invoiceId);
        }
    } catch (e) {
        console.error(`[Sync Helper] Background auto-sync failed for invoice #${invoiceId}:`, e.message);
    }
}

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
    payment_method: z.string().optional(),
    coupon_code: z.string().optional().nullable(),
    coupon_discount_amount: z.number().min(0).optional(),
    mazeway_order_id: z.union([z.number(), z.string()]).nullable().optional(),
    redeem_loyalty_points: z.number().min(0).optional(),
    pricelist_id: z.number().int().positive().nullable().optional()
});

// GET /api/invoices — sales history
router.get('/', async (_req, res, next) => {
    try {
        await db.ready;

        const invoices = db.all(`
      SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
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
      SELECT i.*, c.name AS customer_name, c.gstin AS customer_gstin, c.email AS customer_email, c.phone AS customer_phone
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
        invoice.returns = db.all('SELECT * FROM invoice_returns WHERE invoice_id = ? ORDER BY id ASC', [invoice.id]);
        res.json(invoice);
    } catch (err) {
        next(err);
    }
});

// GET /api/invoices/:id/logs — Fetch change logs (audit logs) for a specific invoice
router.get('/:id/logs', async (req, res, next) => {
    try {
        await db.ready;
        const invoiceId = Number(req.params.id);
        const logs = db.all('SELECT * FROM audit_logs WHERE invoice_id = ? ORDER BY id DESC', [invoiceId]);
        res.json(logs);
    } catch (err) {
        next(err);
    }
});

// GET /api/invoices/:id/share-link — Generate secure hosted link and sync to cloud DB
router.get('/:id/share-link', async (req, res, next) => {
    try {
        await db.ready;
        const invoiceId = Number(req.params.id);
        const result = await hostedInvoiceService.generateHostedInvoice(invoiceId);
        res.json(result);
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

        const { mazeway_order_id = null } = validatedData;
        let invoice;
        try {
        db.transaction(() => {
            const {
                customer_id,
                pricelist_id = null,
                items,
                discount_rate = 0,
                gst_rate = 0,
                walk_in_name = '',
                walk_in_phone = '',
                p_credit_amount = 0,
                use_p_credit = false,
                is_advance = false,
                advance_amount = 0,
                payments = [],
                coupon_code = null,
                coupon_discount_amount = 0
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

            // Deduct from p_credit_balance if Wallet method is used
            let totalWalletPaymentAmount = 0;
            paymentRecords.forEach(p => {
                if (p.method === 'Wallet') {
                    totalWalletPaymentAmount += p.amount;
                }
            });

            const legacyCreditAmount = use_p_credit ? p_credit_amount : 0;
            const totalRequestedCredit = totalWalletPaymentAmount + legacyCreditAmount;

            if (totalRequestedCredit > 0) {
                if (!customer_id) {
                    res.status(400).json({ error: 'Wallet or P-Credit payment is only available for registered customers.' });
                    const err = new Error('Abort'); err.apiResponse = true; throw err;
                }
                const customer = db.get('SELECT p_credit_balance, credit_limit FROM customers WHERE id = ?', [customer_id]);
                const availableCredit = (customer?.p_credit_balance || 0) + (customer?.credit_limit || 0);
                if (!customer || availableCredit < totalRequestedCredit) {
                    res.status(400).json({ error: 'Customer does not have sufficient balance in P-Credit to pay.' });
                    const err = new Error('Abort'); err.apiResponse = true; throw err;
                }
            }

            if (totalWalletPaymentAmount > 0) {
                db.run('UPDATE customers SET p_credit_balance = p_credit_balance - ? WHERE id = ?', [totalWalletPaymentAmount, customer_id]);
            }

            if (coupon_code) {
                const coupon = db.get('SELECT * FROM coupons WHERE UPPER(code) = ?', [coupon_code.trim().toUpperCase()]);
                if (coupon) {
                    // Check expiry
                    if (coupon.expiry_date) {
                        const today = new Date().toISOString().slice(0, 10);
                        if (coupon.expiry_date < today) {
                            res.status(400).json({ error: 'Applied coupon has expired.' });
                            const err = new Error('Abort'); err.apiResponse = true; throw err;
                        }
                    }
                    // Check usage limit
                    if (coupon.usage_limit_type === 'custom' && coupon.times_used >= coupon.usage_limit) {
                        res.status(400).json({ error: 'Applied coupon usage limit has been reached.' });
                        const err = new Error('Abort'); err.apiResponse = true; throw err;
                    }
                    // Increment times_used
                    db.run('UPDATE coupons SET times_used = times_used + 1 WHERE id = ?', [coupon.id]);
                } else {
                    const pricelist = db.get('SELECT * FROM pricelists WHERE UPPER(coupon_code) = ?', [coupon_code.trim().toUpperCase()]);
                    if (!pricelist) {
                        res.status(400).json({ error: 'Applied coupon or price list is invalid or does not exist.' });
                        const err = new Error('Abort'); err.apiResponse = true; throw err;
                    }
                    if (pricelist.active === 0) {
                        res.status(400).json({ error: 'Applied price list is inactive.' });
                        const err = new Error('Abort'); err.apiResponse = true; throw err;
                    }
                    if (pricelist.max_uses > 0 && pricelist.uses_count >= pricelist.max_uses) {
        res.status(400).json({ error: 'Applied price list usage limit has been reached.' });
                        const err = new Error('Abort'); err.apiResponse = true; throw err;
                    }
                    db.run('UPDATE pricelists SET uses_count = uses_count + 1 WHERE id = ?', [pricelist.id]);
                }
            }

            const invResult = db.run(
                'INSERT INTO invoices (customer_id, total, gst_rate, discount_rate, paid_amount, payment_status, walk_in_name, walk_in_phone, financial_status, is_advance, advance_amount, is_stock_deducted, coupon_code, coupon_discount_amount, pricelist_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [customer_id || null, 0, gst_rate, discount_rate, 0, is_advance ? 'ADVANCE' : 'UNPAID', walk_in_name, walk_in_phone, is_advance ? 'ADVANCE' : 'UNPAID', is_advance ? 1 : 0, Number(advance_amount), is_advance ? 0 : 1, coupon_code || null, coupon_discount_amount || 0, pricelist_id]
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
            
            if (product.is_bundle === 1) {
                product.stock_quantity = resolveBundleStock(product);
            }
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
                    if (product.is_bundle === 1) {
                        const components = db.all('SELECT * FROM product_bundle_items WHERE bundle_id = ?', [product.id]);
                        for (const comp of components) {
                            const requiredQty = comp.quantity * baseQuantity;
                            const compProduct = db.get('SELECT * FROM products WHERE id = ?', [comp.component_id]);
                            const compStock = compProduct ? compProduct.stock_quantity : 0;
                            if (compStock < requiredQty) {
                                res.status(400).json({ error: `Insufficient stock for bundle component: ${compProduct ? compProduct.name : 'Unknown'}. Required: ${requiredQty}, Available: ${compStock}` });
                                const err = new Error('Abort'); err.apiResponse = true; throw err;
                            }
                        }
                    } else {
                        if (currentStock < baseQuantity) {
                            res.status(400).json({ error: `Insufficient stock for product: ${product.name}. Required: ${requestedQty} ${unit}, Available: ${variant ? variant.stock_quantity : product.stock_quantity}` });
                            const err = new Error('Abort'); err.apiResponse = true; throw err;
                        }
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
            const chargeQty = (settings.include_pending_price === 'false') ? deliveredQty : requestedQty;
            const lineTotal = price * chargeQty;
            
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
                if (product.is_bundle === 1) {
                    const components = db.all('SELECT * FROM product_bundle_items WHERE bundle_id = ?', [product.id]);
                    for (const comp of components) {
                        const requiredQty = comp.quantity * reduceBy;
                        deductProductStock(comp.component_id, null, requiredQty, invoiceId, `Bundle component deduction for bundle product: ${product.name}`);
                    }
                } else {
                    if (variant) {
                        db.run('UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?', [reduceBy, variant.id]);
                        db.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [reduceBy, product.id]);
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

        // Calculate loyalty points discount
        let loyaltyDiscountAmount = 0;
        let pointsToRedeem = 0;
        if (settings.enable_loyalty_points === 'true' && customer_id && validatedData.redeem_loyalty_points) {
            const requestedPoints = parseInt(validatedData.redeem_loyalty_points, 10) || 0;
            if (requestedPoints > 0) {
                const redeemRate = parseFloat(settings.loyalty_points_redeem_rate || '100');
                pointsToRedeem = requestedPoints;
                loyaltyDiscountAmount = requestedPoints / redeemRate;
            }
        }

        const totalAfterDiscountAndCoupon = Math.max(0, subtotal - discountAmount - (coupon_discount_amount || 0) - loyaltyDiscountAmount);
        const gstAmount = totalAfterDiscountAndCoupon * (gst_rate / 100);
        const finalTotal = totalAfterDiscountAndCoupon + gstAmount;

        // Deduct/redeem customer points if they are actually used
        let pointsRedeemedActual = 0;
        if (pointsToRedeem > 0) {
            pointsRedeemedActual = loyaltyService.redeemPoints(customer_id, invoiceId, pointsToRedeem, settings);
            const redeemRate = parseFloat(settings.loyalty_points_redeem_rate || '100');
            loyaltyDiscountAmount = pointsRedeemedActual / redeemRate;
        }

        // Earn loyalty points on net purchase total
        let pointsEarned = 0;
        if (settings.enable_loyalty_points === 'true' && customer_id && !is_advance) {
            pointsEarned = loyaltyService.earnPoints(customer_id, invoiceId, finalTotal, settings);
        }

        // M039: Handle P-Credit Usage AFTER final total is calculated, capped properly
        let appliedCredit = 0;
        if (customer_id && use_p_credit && p_credit_amount > 0) {
            const customer = db.get('SELECT p_credit_balance, credit_limit FROM customers WHERE id = ?', [customer_id]);
            const availableCredit = (customer?.p_credit_balance || 0) + (customer?.credit_limit || 0);
            // Cap credit to: available balance + credit limit, requested amount, and the final total (not more than owed)
            appliedCredit = Math.min(
                Number(availableCredit),
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
        db.run('UPDATE invoices SET total = ?, paid_amount = ?, payment_status = ?, financial_status = ?, delivery_status = ?, fulfillment_status = ?, is_pending_product = ?, is_stock_deducted = ?, redeemed_loyalty_points = ?, loyalty_discount_amount = ?, earned_loyalty_points = ? WHERE id = ?',
            [finalTotal, finalPaid, finalPaymentStatus, finalPaymentStatus, is_advance ? 'Pending' : invoiceDeliveryStatus, is_advance ? 'PENDING_PRODUCT' : fulfillmentStatus, is_advance ? 1 : isPendingProduct, is_advance ? 0 : 1, pointsRedeemedActual, loyaltyDiscountAmount, pointsEarned, invoiceId]);

        // Log initiation
        db.run('INSERT INTO audit_logs (invoice_id, action, details) VALUES (?, ?, ?)',
            [invoiceId, 'Invoice Created', `Invoice created. Fulfillment: ${fulfillmentStatus}, Payment: ${finalPaymentStatus}`]);

        invoice = db.get(`
            SELECT i.*, c.name AS customer_name, c.email AS customer_email
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE i.id = ?
        `, [invoiceId]);
        if (invoice) {
            invoice.items = db.all(`
                SELECT ii.*, p.product_code, p.category
                FROM invoice_items ii
                LEFT JOIN products p ON ii.product_id = p.id
                WHERE ii.invoice_id = ?
            `, [invoiceId]);
            invoice.payments = db.all('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC', [invoiceId]);
        }
        }); // End transaction
        
        if (!invoice) {
            // Invoice was created but could not be fetched back — fetch it now
            invoice = db.get('SELECT i.*, c.name AS customer_name, c.email AS customer_email FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id ORDER BY i.id DESC LIMIT 1');
            if (invoice) {
                invoice.items = db.all(`
                    SELECT ii.*, p.product_code, p.category
                    FROM invoice_items ii
                    LEFT JOIN products p ON ii.product_id = p.id
                    WHERE ii.invoice_id = ?
                `, [invoice.id]);
                invoice.payments = db.all('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC', [invoice.id]);
            }
        }
        
        if (invoice) {
            triggerAutoEmail(invoice.id, false);

            if (mazeway_order_id) {
                console.log(`[Sales Confirmation] Converting AI Order ID ${mazeway_order_id} to invoice #${invoice.id}...`);
                db.run("UPDATE mazeway_orders SET status = 'CONFIRMED' WHERE id = ?", [mazeway_order_id]);

                // Asynchronously trigger WhatsApp Order Confirmation
                (async () => {
                    try {
                        const recipientPhone = invoice.customer_phone || invoice.walk_in_phone;
                        if (recipientPhone) {
                            const pdfBuffer = await generateInvoicePDF(invoice, settings);
                            const filename = `Invoice_${String(invoice.id).padStart(4, '0')}.pdf`;
                            const caption = `Dear ${invoice.customer_name || 'Customer'}, your order has been confirmed! Here is your invoice #${invoice.invoice_number || invoice.id} for ₹${invoice.total}.`;

                            await whatsappSender.sendInvoicePDF(recipientPhone, pdfBuffer, filename, caption, {
                                customerName: invoice.customer_name || invoice.walk_in_name || 'Customer',
                                invoiceNumber: invoice.invoice_number || `#${invoice.id}`,
                                companyName: settings.company_name || 'Maze ERP',
                                invoiceId: invoice.id
                            });

                            db.run(
                                "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'SMS', ?)",
                                [invoice.customer_id || null, `WhatsApp order confirmation sent for invoice #${invoice.invoice_number || invoice.id} (Converted from AI Order)`]
                            );
                        }
                    } catch (e) {
                        console.error('[AI Order Confirm] WhatsApp notification failed:', e.message);
                    }
                })();
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
        const invoiceId = Number(req.params.id);

        let resultObj;
        try {
            db.transaction(() => {
                const invoice = db.get("SELECT * FROM invoices WHERE id = ?", [invoiceId]);
                if (!invoice) {
                    res.status(404).json({ error: 'Invoice not found' });
                    const err = new Error('Abort'); err.apiResponse = true; throw err;
                }

                // Reverse earned points and refund redeemed points on invoice deletion
                if (invoice.customer_id) {
                    if (invoice.earned_loyalty_points > 0) {
                        loyaltyService.reverseEarnedPoints(invoice.customer_id, invoiceId, invoice.earned_loyalty_points, `Reversed points for deletion of Invoice #${invoiceId}`);
                    }
                    if (invoice.redeemed_loyalty_points > 0) {
                        db.run('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?', [invoice.redeemed_loyalty_points, invoice.customer_id]);
                        db.run(`
                            INSERT INTO loyalty_transactions (customer_id, invoice_id, type, points, balance_after, note, points_remaining, expiry_date)
                            VALUES (?, ?, 'ADJUST', ?, (SELECT loyalty_points FROM customers WHERE id = ?), ?, ?, NULL)
                        `, [invoice.customer_id, invoiceId, invoice.redeemed_loyalty_points, invoice.customer_id, `Refunded redeemed points on invoice deletion`, invoice.redeemed_loyalty_points]);
                    }
                }

                // 1. Fetch all items on this invoice to restore stock
                const items = db.all("SELECT * FROM invoice_items WHERE invoice_id = ?", [invoiceId]);
                for (const item of items) {
                    const qtyToRestore = Number(item.qty_delivered || 0);
                    if (qtyToRestore > 0) {
                        if (item.variant_id) {
                            db.run(
                                'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
                                [qtyToRestore, item.variant_id]
                            );
                            db.run(
                                'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
                                [qtyToRestore, item.product_id]
                            );
                        } else {
                            db.run(
                                'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
                                [qtyToRestore, item.product_id]
                            );
                        }

                        if (item.batch_id) {
                            db.run(
                                'UPDATE product_batches SET current_quantity = current_quantity + ? WHERE id = ?',
                                [qtyToRestore, item.batch_id]
                            );
                        }

                        // Record stock movement
                        db.run(
                            'INSERT INTO stock_movements (product_id, variant_id, type, quantity, reference_type, reference_id, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                            [item.product_id, item.variant_id || null, 'RETURN', qtyToRestore, 'Invoice Cancelled', invoiceId, item.batch_id || null, 'Invoice Deleted']
                        );
                    }

                    // Restore serial status if serial numbers are tracked
                    const product = db.get("SELECT track_serials FROM products WHERE id = ?", [item.product_id]);
                    if (product && product.track_serials) {
                        db.run(
                            "UPDATE product_serials SET status = 'Available', invoice_id = NULL, invoice_item_id = NULL WHERE invoice_id = ?",
                            [invoiceId]
                        );
                    }
                }

                // 2. Refund P-Credit/Wallet payments to customer balance
                if (invoice.customer_id) {
                    const payments = db.all("SELECT * FROM invoice_payments WHERE invoice_id = ?", [invoiceId]);
                    let totalRefundCredit = 0;
                    payments.forEach(p => {
                        if (p.method === 'Wallet' || p.method === 'P-Credit' || p.method === 'Wallet (P-Credit)') {
                            totalRefundCredit += Number(p.amount || 0);
                        }
                    });
                    
                    if (invoice.p_credit_amount > 0) {
                        totalRefundCredit += Number(invoice.p_credit_amount);
                    }

                    if (totalRefundCredit > 0) {
                        db.run(
                            'UPDATE customers SET p_credit_balance = p_credit_balance + ? WHERE id = ?',
                            [totalRefundCredit, invoice.customer_id]
                        );
                    }
                }

                // 3. Restore coupon or pricelist usage count
                if (invoice.coupon_code) {
                    const coupon = db.get('SELECT * FROM coupons WHERE UPPER(code) = ?', [invoice.coupon_code.trim().toUpperCase()]);
                    if (coupon) {
                        db.run(
                            'UPDATE coupons SET times_used = MAX(0, times_used - 1) WHERE UPPER(code) = ?',
                            [invoice.coupon_code.trim().toUpperCase()]
                        );
                    } else {
                        db.run(
                            'UPDATE pricelists SET uses_count = MAX(0, uses_count - 1) WHERE UPPER(coupon_code) = ?',
                            [invoice.coupon_code.trim().toUpperCase()]
                        );
                    }
                }

                // 4. Remote hosted invoice sync cleanup
                const tokenRow = db.get("SELECT token FROM invoice_tokens WHERE invoice_id = ?", [invoiceId]);
                if (tokenRow) {
                    const DB_URL = "https://mazeway-db.vercel.app";
                    const DB_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJncm91cCI6ImFub24iLCJpYXQiOjE3Nzk3MDA0Mzh9.mazeway_db_anon_5KUWRlLbhAarPceBoTlDGMTjNn8hvXtgSTCAGH7CSCOMxgwcZNojTpcYiqqUc3Ma";
                    
                    fetch(`${DB_URL}/api/v1/tables/hosted_invoices/rows`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': DB_ANON_KEY,
                            'Authorization': `Bearer ${DB_ANON_KEY}`
                        },
                        body: JSON.stringify({
                            match: { invoice_id: invoiceId }
                        })
                    }).catch(e => console.error(`[Delete Sync] Failed to delete hosted invoice #${invoiceId} from cloud DB:`, e.message));

                    db.run('DELETE FROM invoice_tokens WHERE invoice_id = ?', [invoiceId]);
                }

                // 5. Delete records
                db.run('DELETE FROM invoices WHERE id = ?', [invoiceId]);
                db.run('DELETE FROM invoice_payments WHERE invoice_id = ?', [invoiceId]);
                db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
            }); // End transaction
            res.json({ success: true });
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
    } catch (err) {
        next(err);
    }
});

// POST /api/invoices/:id/return — process returns
router.post('/:id/return', async (req, res, next) => {
    try {
        await db.ready;
        const invoiceId = Number(req.params.id);
        const { items: returns, refund_method } = req.body; // Array of { product_id, invoice_item_id?, quantity }, refund_method: 'refund' | 'p_credit'

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
        const returnDetails = [];

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

            // If invoice_item_id is provided, filter to just that specific line; otherwise all lines with this product
            const productItems = ret.invoice_item_id
                ? originalItems.filter(i => i.id === Number(ret.invoice_item_id))
                : originalItems.filter(i => i.product_id === ret.product_id);
            if (productItems.length === 0) {
                res.status(400).json({ error: `Product ${ret.product_id} was not in this invoice` });
                const err = new Error('Abort');
                err.apiResponse = true;
                throw err;
            }

            const totalOriginalQty = productItems.reduce((acc, curr) => acc + curr.qty_delivered, 0);
            // Track already returned per item-id if we have it, else per product
            const alreadyReturned = ret.invoice_item_id
                ? (db.get('SELECT SUM(return_qty) as total FROM invoice_returns WHERE invoice_id = ? AND invoice_item_id = ?', [invoiceId, Number(ret.invoice_item_id)])?.total || 0)
                : (invoiceReturnedRecords.find(r => r.product_id === ret.product_id)?.total_returned || 0);
            if (ret.quantity + alreadyReturned > totalOriginalQty) {
                res.status(400).json({ error: `Cannot return more than delivered for this product` });
                const err = new Error('Abort');
                err.apiResponse = true;
                throw err;
            }

            let qtyToReturn = ret.quantity;
            for (const line of productItems) {
                if (qtyToReturn <= 0) break;
                
                // For this specific batch line, how much has been returned?
                const lineReturned = db.get('SELECT SUM(return_qty) as total FROM invoice_returns WHERE invoice_id = ? AND product_id = ? AND batch_id IS ?', [invoiceId, line.product_id, line.batch_id])?.total || 0;
                const returnableForLine = line.qty_delivered - lineReturned;

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

                    // Log return record (store invoice_item_id for precise tracking)
                    db.run(
                        'INSERT INTO invoice_returns (invoice_id, product_id, invoice_item_id, return_qty, return_amount, refund_method, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [invoiceId, ret.product_id, line.id || null, returnQtyForLine, lineFinalReturnAmount, 'pending', line.batch_id || null]
                    );

                    const prodName = line.product_name || (product ? product.name : `Product ID ${ret.product_id}`);
                    returnDetails.push(`${returnQtyForLine}x ${prodName} (₹${lineFinalReturnAmount.toFixed(2)})`);

                    // Restore product stock (always restore parent product for non-variant items)
                    if (product && product.is_bundle === 1) {
                        const components = db.all('SELECT * FROM product_bundle_items WHERE bundle_id = ?', [product.id]);
                        for (const comp of components) {
                            const restoreQty = comp.quantity * returnQtyForLine;
                            restoreProductStock(comp.component_id, null, restoreQty, invoiceId, `Bundle component restore for returned bundle: ${product.name}`);
                        }
                    } else {
                        if (line.variant_id) {
                            // Item was sold as a variant — restore variant stock
                            db.run(
                                'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
                                [returnQtyForLine, line.variant_id]
                            );
                            db.run(
                                'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
                                [returnQtyForLine, ret.product_id]
                            );
                        } else {
                            // No variant — restore parent product stock directly
                            db.run(
                                'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
                                [returnQtyForLine, ret.product_id]
                            );
                        }

                        // Record stock movement for return (include variant_id for audit trail)
                        db.run(
                            'INSERT INTO stock_movements (product_id, variant_id, type, quantity, reference_type, reference_id, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                            [ret.product_id, line.variant_id || null, 'RETURN', returnQtyForLine, 'Invoice Return', invoiceId, line.batch_id || null, 'Sale Return']
                        );

                        if (line.batch_id) {
                            db.run('UPDATE product_batches SET current_quantity = current_quantity + ? WHERE id = ?', [returnQtyForLine, line.batch_id]);
                        }
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
        const totalItemsQty = allItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalReturnedQty = db.get('SELECT COALESCE(SUM(return_qty), 0) AS total FROM invoice_returns WHERE invoice_id = ?', [invoiceId]).total;
        const isFullReturn = totalReturnedQty === totalItemsQty;

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
                financialStatus = (refund_method === 'p_credit') ? 'P-Credited' : 'Partially Returned';
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
        } else if (refund_method === 'direct_cash') {
            const cashRefund = Math.min(totalReturnAmount, currentPaid);
            if (cashRefund > 0) {
                db.run('UPDATE invoices SET paid_amount = paid_amount - ? WHERE id = ?', [cashRefund, invoiceId]);
                currentPaid -= cashRefund;
                effectiveDue = effectiveTotal - currentPaid;
                
                if (isFullReturn) {
                    paymentStatus = 'Returned';
                    financialStatus = 'Returned';
                } else {
                    if (currentPaid === 0) {
                        paymentStatus = 'UNPAID';
                    } else if (currentPaid < effectiveTotal) {
                        paymentStatus = 'PARTIAL';
                    } else {
                        paymentStatus = 'PAID';
                    }
                    financialStatus = 'Cash Refunded';
                }
            }
        }

        // Points reversal for returned invoice
        if (invoice.customer_id && invoice.earned_loyalty_points > 0) {
            const pointsToReverse = isFullReturn 
                ? invoice.earned_loyalty_points 
                : Math.min(invoice.earned_loyalty_points, Math.floor(invoice.earned_loyalty_points * (totalReturnAmount / invoice.total)));
            if (pointsToReverse > 0) {
                loyaltyService.reverseEarnedPoints(invoice.customer_id, invoiceId, pointsToReverse, `Reversed points for return on Invoice #${invoiceId}`);
                // Also update the invoice's earned_loyalty_points to reflect the new net points earned!
                const newEarnedPoints = Math.max(0, invoice.earned_loyalty_points - pointsToReverse);
                db.run('UPDATE invoices SET earned_loyalty_points = ? WHERE id = ?', [newEarnedPoints, invoiceId]);
            }
        }

        db.run('UPDATE invoices SET total_returned_amount = ?, return_type = ?, financial_status = ?, payment_status = ? WHERE id = ?',
            [newTotalReturned, returnType, financialStatus, paymentStatus, invoiceId]);

        if (returnDetails.length > 0) {
            db.run('INSERT INTO audit_logs (invoice_id, action, details) VALUES (?, ?, ?)',
                [invoiceId, 'Product Refund', `Refunded: ${returnDetails.join(', ')}. Method: ${refund_method === 'p_credit' ? 'P-Credit' : refund_method === 'direct_cash' ? 'Direct Cash' : 'Cash/Refund'}`]);
        }
        if (refundBalance > 0 && refund_method !== 'direct_cash') {
            db.run('INSERT INTO audit_logs (invoice_id, action, details) VALUES (?, ?, ?)',
                [invoiceId, 'Refund Balance', `Returned ₹${refundBalance.toFixed(2)} to customer via ${refund_method === 'p_credit' ? 'P-Credit Balance' : 'Direct Cash/Refund'}`]);
        }
        if (refund_method === 'direct_cash') {
            const cashRefund = Math.min(totalReturnAmount, invoice.paid_amount || 0);
            if (cashRefund > 0) {
                db.run('INSERT INTO audit_logs (invoice_id, action, details) VALUES (?, ?, ?)',
                    [invoiceId, 'Direct Cash Refund', `Directly refunded ₹${cashRefund.toFixed(2)} cash back to customer (Outstanding due was not adjusted)`]);
            }
        }

        updatedInvoice = db.get(`
            SELECT i.*, c.name AS customer_name, c.email AS customer_email
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE i.id = ?
        `, [invoiceId]);
        updatedInvoice.items = allItems;
        updatedInvoice.returns = db.all('SELECT * FROM invoice_returns WHERE invoice_id = ?', [invoiceId]);
        }); // End transaction

        triggerAutoEmail(invoiceId, true);
        syncInvoiceIfShared(invoiceId);
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

        const walletAmount = payment_method === 'Wallet' ? cashAmount : 0;
        const totalRequestedCredit = walletAmount + pCreditUsed;

        if (totalRequestedCredit > 0) {
            if (!invoice.customer_id) {
                res.status(400).json({ error: 'Wallet or P-Credit payment is only available for registered customers.' });
                const err = new Error('Abort'); err.apiResponse = true; throw err;
            }
            const customer = db.get('SELECT p_credit_balance, credit_limit FROM customers WHERE id = ?', [invoice.customer_id]);
            const availableCredit = (customer?.p_credit_balance || 0) + (customer?.credit_limit || 0);
            if (!customer || availableCredit < totalRequestedCredit) {
                res.status(400).json({ error: 'Customer does not have sufficient balance in P-Credit to pay.' });
                const err = new Error('Abort'); err.apiResponse = true; throw err;
            }
        }

        if (cashAmount > 0) {
            if (payment_method === 'Wallet') {
                db.run('UPDATE customers SET p_credit_balance = p_credit_balance - ? WHERE id = ?', [cashAmount, invoice.customer_id]);
            }

            db.run(
                'INSERT INTO invoice_payments (invoice_id, amount, method, transaction_id, notes) VALUES (?, ?, ?, ?, ?)',
                [invoiceId, cashAmount, payment_method || 'Cash', transaction_id || null, notes || 'Direct payment update']
            );
        }

        if (pCreditUsed > 0) {
            // Deduct from customer and track on invoice
            db.run('UPDATE customers SET p_credit_balance = p_credit_balance - ? WHERE id = ?', [pCreditUsed, invoice.customer_id]);
            db.run('UPDATE invoices SET p_credit_amount = IFNULL(p_credit_amount, 0) + ? WHERE id = ?', [pCreditUsed, invoiceId]);
            
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

        const paymentNotes = [];
        if (cashAmount > 0) {
            paymentNotes.push(`₹${cashAmount.toFixed(2)} via ${payment_method || 'Cash'}`);
        }
        if (pCreditUsed > 0) {
            paymentNotes.push(`₹${pCreditUsed.toFixed(2)} via P-Credit`);
        }
        if (paymentNotes.length > 0) {
            db.run('INSERT INTO audit_logs (invoice_id, action, details) VALUES (?, ?, ?)',
                [invoiceId, 'Payment Received', `Added payment: ${paymentNotes.join(', ')}. Notes: ${notes || 'Direct payment update'}`]);
        }
        }); // End transaction

        const updated = db.get(`
            SELECT i.*, c.name AS customer_name, c.email AS customer_email
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE i.id = ?
        `, [invoiceId]);

        if (updated) {
            updated.items = db.all(`
                SELECT ii.*, p.product_code, p.category
                FROM invoice_items ii
                LEFT JOIN products p ON ii.product_id = p.id
                WHERE ii.invoice_id = ?
            `, [invoiceId]);
        }

        triggerAutoEmail(invoiceId, true);
        syncInvoiceIfShared(invoiceId);
        res.json(updated);
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
    } catch (err) {
        next(err);
    }
});

router.post('/:id/fulfill', async (req, res, next) => {
    try {
        await db.ready;
        const settingsRows = db.all('SELECT key, value FROM settings');
        const settings = {};
        settingsRows.forEach(r => { settings[r.key] = r.value; });

        const invoiceId = Number(req.params.id);
        const { fulfillments } = req.body; // Array of { product_id, deliver_qty }

        if (!fulfillments || !fulfillments.length) {
            return res.status(400).json({ error: 'No fulfillment data provided' });
        }

        let resultObj;
        let newGrandTotal;
        let invoiceDeliveryStatus;
        let fulfillmentStatus;
        let newPaymentStatus;
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
            if (product.is_bundle === 1) {
                const components = db.all('SELECT * FROM product_bundle_items WHERE bundle_id = ?', [product.id]);
                for (const comp of components) {
                    const requiredQty = comp.quantity * deliverQty;
                    const compProduct = db.get('SELECT * FROM products WHERE id = ?', [comp.component_id]);
                    const compStock = compProduct ? compProduct.stock_quantity : 0;
                    if (compStock < requiredQty) {
                        return res.status(400).json({ error: `Insufficient stock for bundle component: ${compProduct ? compProduct.name : 'Unknown'}. Required: ${requiredQty}, Available: ${compStock}` });
                    }
                }
                for (const comp of components) {
                    const requiredQty = comp.quantity * deliverQty;
                    deductProductStock(comp.component_id, null, requiredQty, invoiceId, `Bundle component deduction for bundle product: ${product.name} (Fulfillment)`);
                }
            } else {
                if (deliverQty > product.stock_quantity) {
                    return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
                }

                if (item.variant_id) {
                    db.run(
                        'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
                        [deliverQty, item.variant_id]
                    );
                }

                db.run(
                    'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                    [deliverQty, product.id]
                );

                db.run(
                    'INSERT INTO stock_movements (product_id, variant_id, type, quantity, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [product.id, item.variant_id || null, 'OUT', deliverQty, 'Invoice Fulfillment', invoiceId, 'Fulfillment Delivery']
                );
                
                // M035: Verify batch availability before deducting
                if (f.batch_id) {
                    const batch = db.get('SELECT current_quantity FROM product_batches WHERE id = ?', [f.batch_id]);
                    if (!batch || batch.current_quantity < deliverQty) {
                        return res.status(400).json({ error: `Insufficient batch stock for ${item.product_name}. Available: ${batch?.current_quantity ?? 0}` });
                    }
                }
            }
            const newDelivered = item.qty_delivered + deliverQty;
            const newPending = item.qty_requested - newDelivered;
            const newStatus = newPending === 0 ? 'Delivered' : 'Partial';
            const chargeQty = (settings.include_pending_price === 'false') ? newDelivered : item.qty_requested;
            const newLineTotal = item.price * chargeQty;

            db.run(
                'UPDATE invoice_items SET qty_delivered = ?, pending_qty = ?, delivery_status = ?, total = ? WHERE id = ?',
                [newDelivered, newPending, newStatus, newLineTotal, item.id]
            );

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
        newGrandTotal = afterDiscount + gstAmount;

        // Delivery Status
        const statuses = refreshedItems.map(i => i.delivery_status);
        invoiceDeliveryStatus = 'Delivered';
        if (statuses.every(s => s === 'Delivered')) invoiceDeliveryStatus = 'Delivered';
        else if (statuses.every(s => s === 'Pending')) invoiceDeliveryStatus = 'Pending';
        else invoiceDeliveryStatus = 'Partial';

        fulfillmentStatus = invoiceDeliveryStatus === 'Delivered' ? 'COMPLETED' : 'PENDING_PRODUCT';
        let isPendingProduct = invoiceDeliveryStatus === 'Delivered' ? 0 : 1;

        // Payment logic
        const returnedAmount = Number(invoice.total_returned_amount || 0);
        const effectiveTotal = Math.max(0, newGrandTotal - returnedAmount);
        const paidAmount = Number(invoice.paid_amount || 0);

        newPaymentStatus = 'PAID';
        if (paidAmount === 0) newPaymentStatus = 'UNPAID';
        else if (paidAmount < effectiveTotal) newPaymentStatus = 'PARTIAL';
        else newPaymentStatus = 'PAID';

        db.run('UPDATE invoices SET total = ?, delivery_status = ?, fulfillment_status = ?, is_pending_product = ?, payment_status = ?, financial_status = ? WHERE id = ?',
            [newGrandTotal, invoiceDeliveryStatus, fulfillmentStatus, isPendingProduct, newPaymentStatus, newPaymentStatus, invoiceId]);

        }); // End transaction
        triggerAutoEmail(invoiceId, true);
        syncInvoiceIfShared(invoiceId);
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
        const settingsRows = db.all('SELECT key, value FROM settings');
        const settings = {};
        settingsRows.forEach(r => { settings[r.key] = r.value; });

        const invoiceId = Number(req.params.id);
        let resultObj;
        let newPaymentStatus;
        let newGrandTotal;
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

            let currentStock = Number(product.stock_quantity || 0);
            if (product.is_bundle === 1) {
                const components = db.all('SELECT * FROM product_bundle_items WHERE bundle_id = ?', [product.id]);
                let bundleStock = Infinity;
                for (const comp of components) {
                    const compProduct = db.get('SELECT * FROM products WHERE id = ?', [comp.component_id]);
                    const compStock = compProduct ? compProduct.stock_quantity : 0;
                    const possible = Math.floor(compStock / comp.quantity);
                    if (possible < bundleStock) {
                        bundleStock = possible;
                    }
                }
                currentStock = bundleStock === Infinity ? 0 : bundleStock;
            }

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

            const chargeQty = (settings.include_pending_price === 'false') ? newDelivered : item.qty_requested;
            const newLineTotal = item.price * chargeQty;

            db.run(
                'UPDATE invoice_items SET qty_delivered = ?, pending_qty = ?, delivery_status = ?, total = ? WHERE id = ?',
                [newDelivered, newPending, status, newLineTotal, item.id]
            );

            if (reduceBy > 0) {
                if (product.is_bundle === 1) {
                    const components = db.all('SELECT * FROM product_bundle_items WHERE bundle_id = ?', [product.id]);
                    for (const comp of components) {
                        const requiredQty = comp.quantity * reduceBy;
                        deductProductStock(comp.component_id, null, requiredQty, invoiceId, `Bundle component deduction for bundle product: ${product.name} (Advance Fulfillment)`);
                    }
                } else {
                    if (item.variant_id) {
                        db.run(
                            'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
                            [reduceBy, item.variant_id]
                        );
                    }

                    db.run(
                        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                        [reduceBy, product.id]
                    );
                    
                    db.run(
                        'INSERT INTO stock_movements (product_id, variant_id, type, quantity, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [product.id, item.variant_id || null, 'OUT', reduceBy, 'Advance Invoice', invoiceId, 'Advance Delivery']
                    );
                }
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

        // Recalculate Invoice totals
        const refreshedItems = db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        let newSubtotal = 0;
        refreshedItems.forEach(i => newSubtotal += i.total);

        const discountAmount = newSubtotal * (invoice.discount_rate / 100);
        const afterDiscount = newSubtotal - discountAmount;
        const gstAmount = afterDiscount * (invoice.gst_rate / 100);
        newGrandTotal = afterDiscount + gstAmount;

        // Payment status logic after advance is processed
        const paidAmount = Number(invoice.paid_amount || 0);
        const returnedAmount = Number(invoice.total_returned_amount || 0);
        const effectiveTotal = Math.max(0, newGrandTotal - returnedAmount);

        newPaymentStatus = 'PAID';
        if (paidAmount === 0) newPaymentStatus = 'UNPAID';
        else if (paidAmount < effectiveTotal) newPaymentStatus = 'PARTIAL';
        else newPaymentStatus = 'PAID';

        db.run('UPDATE invoices SET total = ?, is_stock_deducted = 1, payment_status = ?, financial_status = ?, delivery_status = ?, fulfillment_status = ?, is_pending_product = ? WHERE id = ?',
            [newGrandTotal, newPaymentStatus, newPaymentStatus, invoiceDeliveryStatus, fulfillmentStatus, isPendingProduct, invoiceId]);

        db.run('INSERT INTO audit_logs (invoice_id, action, details) VALUES (?, ?, ?)',
            [invoiceId, 'Advance Processed', `Processed advance invoice. Stock deducted. Fulfillment: ${fulfillmentStatus}, Payment: ${newPaymentStatus}`]);
        }); // End transaction
        triggerAutoEmail(invoiceId, true);
        syncInvoiceIfShared(invoiceId);
        res.json({ success: true, payment_status: newPaymentStatus, grand_total: newGrandTotal });
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
    } catch (err) {
        next(err);
    }
});

async function triggerAutoEmail(invoiceId, isEdit) {
    try {
        await db.ready;
        // 1. Fetch settings
        const settingsRows = db.all('SELECT key, value FROM settings');
        const settings = {};
        settingsRows.forEach(r => { settings[r.key] = r.value; });
        const companyName = settings.company_name || 'Maze ERP';

        // 2. Fetch invoice details
        const invoice = db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
        if (!invoice) {
            console.log('[Auto-Notification] Invoice not found:', invoiceId);
            return;
        }

        // Fetch invoice items
        const items = db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        invoice.items = items;

        // 3. Resolve customer details
        let recipientEmail = '';
        let recipientPhone = '';
        let customerName = invoice.customer_name;
        if (invoice.customer_id) {
            const customer = db.get('SELECT name, email, phone FROM customers WHERE id = ?', [invoice.customer_id]);
            if (customer) {
                if (!customerName) customerName = customer.name;
                recipientEmail = (customer.email || '').trim();
                recipientPhone = (customer.phone || '').trim();
            }
        }
        if (!customerName) {
            customerName = invoice.walk_in_name || 'Valued Customer';
        }
        if (!recipientPhone) {
            recipientPhone = (invoice.walk_in_phone || invoice.customer_phone || '').trim();
        }

        // 4. Fetch active Gmail sender if needed
        const connections = await EmailConnection.getConnections();
        const activeConn = connections.find(c => c.status === 'Active');

        // Check payment status
        const isPaid = (invoice.payment_status || '').toUpperCase() === 'PAID';

        if (!isEdit) {
            // --- INVOICE CREATION ---
            // Gmail Auto Invoicing
            if (settings.auto_email_invoice_created === 'true' && recipientEmail && activeConn) {
                try {
                    const htmlBody = gmailSender.generateInvoiceTemplate(invoice, settings, settings.invoice_style || 'classic');
                    const subject = `Invoice #${invoice.invoice_number || invoice.id} from ${companyName}`;
                    await gmailSender.sendMail({
                        senderEmail: activeConn.email,
                        to: recipientEmail,
                        subject,
                        htmlBody,
                        textBody: `Dear ${customerName}, please find your invoice #${invoice.invoice_number || invoice.id} for ₹${invoice.total}.`
                    });
                    db.run(
                        "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'Email', ?)",
                        [invoice.customer_id || null, `Auto-sent invoice #${invoice.invoice_number || invoice.id} via Gmail (${activeConn.email})`]
                    );
                } catch (e) {
                    console.error('[Auto-Notification] Gmail invoice created send failed:', e.message);
                }
            }

            // Gmail Order Confirmation
            if (settings.auto_email_order_confirmation === 'true' && recipientEmail && activeConn) {
                try {
                    const orderDetails = `
                        <p><strong>Customer Name:</strong> ${customerName}</p>
                        <p><strong>Invoice ID:</strong> #${invoice.invoice_number || invoice.id}</p>
                        <p><strong>Total Amount:</strong> ₹${invoice.total.toLocaleString('en-IN')}</p>
                    `;
                    const htmlBody = gmailSender.generateOrderConfirmationTemplate(customerName, orderDetails, settings);
                    const subject = `Order Confirmed: Invoice #${invoice.invoice_number || invoice.id}`;
                    await gmailSender.sendMail({
                        senderEmail: activeConn.email,
                        to: recipientEmail,
                        subject,
                        htmlBody,
                        textBody: `Dear ${customerName}, your order has been confirmed. Invoice #${invoice.invoice_number || invoice.id}.`
                    });
                    db.run(
                        "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'Email', ?)",
                        [invoice.customer_id || null, `Auto-sent order confirmation #${invoice.invoice_number || invoice.id} via Gmail`]
                    );
                } catch (e) {
                    console.error('[Auto-Notification] Gmail order confirmation send failed:', e.message);
                }
            }

            // WhatsApp Auto Invoicing
            if (settings.auto_whatsapp_invoice_created === 'true' && recipientPhone) {
                try {
                    const pdfBuffer = await generateInvoicePDF(invoice, settings);
                    const filename = `Invoice_${String(invoice.id).padStart(4, '0')}.pdf`;
                    const caption = `Dear ${customerName}, please find attached invoice #${invoice.invoice_number || invoice.id} for ₹${invoice.total}. Thank you!`;
                    await whatsappSender.sendInvoicePDF(recipientPhone, pdfBuffer, filename, caption);
                    db.run(
                        "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'SMS', ?)",
                        [invoice.customer_id || null, `Auto-sent invoice #${invoice.invoice_number || invoice.id} via WhatsApp (${recipientPhone})`]
                    );
                } catch (e) {
                    console.error('[Auto-Notification] WhatsApp invoice created send failed:', e.message);
                }
            }

            // WhatsApp Order Confirmation
            if (settings.auto_whatsapp_order_confirmation === 'true' && recipientPhone) {
                try {
                    const msgText = `Order Confirmed!\n\nDear ${customerName},\n\nWe are happy to confirm your order details:\nInvoice: #${invoice.invoice_number || invoice.id}\nTotal: ₹${invoice.total.toLocaleString('en-IN')}\n\nThank you for choosing ${companyName}!`;
                    await whatsappSender.sendText(recipientPhone, msgText);
                    db.run(
                        "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'SMS', ?)",
                        [invoice.customer_id || null, `Auto-sent WhatsApp order confirmation #${invoice.invoice_number || invoice.id}`]
                    );
                } catch (e) {
                    console.error('[Auto-Notification] WhatsApp order confirmation send failed:', e.message);
                }
            }
        } else {
            // --- INVOICE EDITED / PAYMENT RECEIVED ---
            if (isPaid) {
                // Payment Received
                if (settings.auto_email_payment_received === 'true' && recipientEmail && activeConn) {
                    try {
                        const htmlBody = gmailSender.generateInvoiceTemplate(invoice, settings, settings.invoice_style || 'classic');
                        const subject = `Payment Received Receipt: Invoice #${invoice.invoice_number || invoice.id}`;
                        await gmailSender.sendMail({
                            senderEmail: activeConn.email,
                            to: recipientEmail,
                            subject,
                            htmlBody,
                            textBody: `Dear ${customerName}, we have successfully received your payment for Invoice #${invoice.invoice_number || invoice.id}.`
                        });
                        db.run(
                            "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'Email', ?)",
                            [invoice.customer_id || null, `Auto-sent payment receipt #${invoice.invoice_number || invoice.id} via Gmail`]
                        );
                    } catch (e) {
                        console.error('[Auto-Notification] Gmail payment received send failed:', e.message);
                    }
                }

                if (settings.auto_whatsapp_payment_received === 'true' && recipientPhone) {
                    try {
                        const pdfBuffer = await generateInvoicePDF(invoice, settings);
                        const filename = `Invoice_${String(invoice.id).padStart(4, '0')}.pdf`;
                        const caption = `Dear ${customerName}, thank you for your payment! Here is your invoice receipt #${invoice.invoice_number || invoice.id}.`;
                        await whatsappSender.sendInvoicePDF(recipientPhone, pdfBuffer, filename, caption);
                        db.run(
                            "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'SMS', ?)",
                            [invoice.customer_id || null, `Auto-sent payment receipt #${invoice.invoice_number || invoice.id} via WhatsApp`]
                        );
                    } catch (e) {
                        console.error('[Auto-Notification] WhatsApp payment received send failed:', e.message);
                    }
                }
            } else {
                // Standard Invoice Edited
                if (settings.auto_email_invoice_edited === 'true' && recipientEmail && activeConn) {
                    try {
                        const htmlBody = gmailSender.generateInvoiceTemplate(invoice, settings, settings.invoice_style || 'classic');
                        const subject = `Updated Invoice #${invoice.invoice_number || invoice.id} from ${companyName}`;
                        await gmailSender.sendMail({
                            senderEmail: activeConn.email,
                            to: recipientEmail,
                            subject,
                            htmlBody,
                            textBody: `Dear ${customerName}, please find your updated invoice #${invoice.invoice_number || invoice.id} for ₹${invoice.total}.`
                        });
                        db.run(
                            "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'Email', ?)",
                            [invoice.customer_id || null, `Auto-sent updated invoice #${invoice.invoice_number || invoice.id} via Gmail`]
                        );
                    } catch (e) {
                        console.error('[Auto-Notification] Gmail invoice edited send failed:', e.message);
                    }
                }

                if (settings.auto_whatsapp_invoice_edited === 'true' && recipientPhone) {
                    try {
                        const pdfBuffer = await generateInvoicePDF(invoice, settings);
                        const filename = `Invoice_${String(invoice.id).padStart(4, '0')}.pdf`;
                        const caption = `Dear ${customerName}, please find your updated invoice #${invoice.invoice_number || invoice.id}.`;
                        await whatsappSender.sendInvoicePDF(recipientPhone, pdfBuffer, filename, caption);
                        db.run(
                            "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'SMS', ?)",
                            [invoice.customer_id || null, `Auto-sent updated invoice #${invoice.invoice_number || invoice.id} via WhatsApp`]
                        );
                    } catch (e) {
                        console.error('[Auto-Notification] WhatsApp invoice edited send failed:', e.message);
                    }
                }
            }
        }
    } catch (err) {
        console.error('[Auto-Notification] Error running triggers:', err.message);
    }
}

// POST /api/invoices/merge
router.post('/merge', async (req, res, next) => {
    try {
        await db.ready;
        const { invoice_ids, customer_id, walk_in_name, walk_in_phone } = req.body;

        if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length < 2) {
            return res.status(400).json({ error: 'Please select at least two invoices to merge.' });
        }

        const settingsRows = db.all('SELECT key, value FROM settings');
        const settings = {};
        settingsRows.forEach(r => { settings[r.key] = r.value; });

        let newInvoiceId;
        try {
            db.transaction(() => {
                // 1. Fetch original invoices
                const placeholders = invoice_ids.map(() => '?').join(',');
                const originalInvoices = db.all(`SELECT * FROM invoices WHERE id IN (${placeholders})`, invoice_ids);
                if (originalInvoices.length !== invoice_ids.length) {
                    res.status(400).json({ error: 'One or more of the selected invoices do not exist.' });
                    const err = new Error('Abort'); err.apiResponse = true; throw err;
                }

                // Fetch original returns for these invoices
                const originalReturns = db.all(`SELECT * FROM invoice_returns WHERE invoice_id IN (${placeholders})`, invoice_ids);

                // 2. Fetch original items, payments, and serials
                const originalItems = db.all(`SELECT * FROM invoice_items WHERE invoice_id IN (${placeholders})`, invoice_ids);
                const originalPayments = db.all(`SELECT * FROM invoice_payments WHERE invoice_id IN (${placeholders})`, invoice_ids);
                const allSerials = db.all(`SELECT * FROM product_serials WHERE invoice_id IN (${placeholders})`, invoice_ids);

                // Group serials by product_id
                const serialsMap = {};
                allSerials.forEach(s => {
                    if (!serialsMap[s.product_id]) serialsMap[s.product_id] = [];
                    serialsMap[s.product_id].push(s.serial_number);
                });

                // 3. Restore Stock for original items if stock was deducted
                for (const item of originalItems) {
                    const inv = originalInvoices.find(i => i.id === item.invoice_id);
                    if (inv && inv.is_stock_deducted === 1) {
                        const product = db.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
                        if (product) {
                            const isSecondary = item.unit === product.secondary_unit && product.secondary_unit;
                            const conversionFactor = isSecondary ? (product.conversion_factor || 1) : 1;
                            const restoreQty = (item.qty_delivered || item.quantity) * conversionFactor;

                            if (item.variant_id) {
                                db.run('UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?', [restoreQty, item.variant_id]);
                                db.run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [restoreQty, item.product_id]);
                            } else {
                                db.run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [restoreQty, item.product_id]);
                            }

                            if (item.batch_id) {
                                db.run('UPDATE product_batches SET current_quantity = current_quantity + ? WHERE id = ?', [restoreQty, item.batch_id]);
                            }
                        }
                    }
                }

                // Delete stock movements for original invoices
                db.run(`DELETE FROM stock_movements WHERE reference_type = 'Invoice' AND reference_id IN (${placeholders})`, invoice_ids);

                // 4. Aggregate items
                // We group by product_id, variant_id, unit, price, is_free, item_gst_rate, item_discount_rate, batch_id
                const groupedItems = {};
                originalItems.forEach(item => {
                    const key = `${item.product_id}_${item.variant_id || 'null'}_${item.unit || 'PCS'}_${item.price || 0}_${item.is_free ? 1 : 0}_${item.item_gst_rate || 0}_${item.item_discount_rate || 0}_${item.batch_id || 'null'}`;
                    if (!groupedItems[key]) {
                        groupedItems[key] = {
                            product_id: item.product_id,
                            product_name: item.product_name,
                            quantity: 0,
                            unit: item.unit || 'PCS',
                            price: item.price || 0,
                            is_free: !!item.is_free,
                            item_gst_rate: item.item_gst_rate || 0,
                            item_discount_rate: item.item_discount_rate || 0,
                            batch_id: item.batch_id || null,
                            variant_id: item.variant_id || null,
                            variant_name: item.variant_name || '',
                            qty_requested: 0,
                            qty_delivered: 0,
                            pending_qty: 0,
                            original_price: item.original_price || 0,
                            original_item_ids: []
                        };
                    }
                    groupedItems[key].quantity += item.quantity;
                    groupedItems[key].qty_requested += item.qty_requested || item.quantity;
                    groupedItems[key].qty_delivered += item.qty_delivered || item.quantity;
                    groupedItems[key].pending_qty += item.pending_qty || 0;
                    groupedItems[key].original_item_ids.push(item.id);
                });

                // 5. Create new merged invoice row
                const insertInvResult = db.run(
                    'INSERT INTO invoices (customer_id, total, gst_rate, discount_rate, paid_amount, payment_status, walk_in_name, walk_in_phone, financial_status, is_advance, advance_amount, is_stock_deducted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [customer_id ? Number(customer_id) : null, 0, 0, 0, 0, 'UNPAID', walk_in_name || '', walk_in_phone || '', 'UNPAID', 0, 0, 1]
                );
                newInvoiceId = insertInvResult.lastInsertRowid;

                // 6. Insert new combined items and update stock & serials
                const oldItemIdToNewItemIdMap = {};
                let finalTotal = 0;
                for (const itemKey in groupedItems) {
                    const item = groupedItems[itemKey];
                    const product = db.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
                    if (!product) continue;

                    const variant = item.variant_id ? db.get('SELECT * FROM product_variants WHERE id = ?', [item.variant_id]) : null;
                    const isSecondary = item.unit === product.secondary_unit && product.secondary_unit;
                    const conversionFactor = isSecondary ? (product.conversion_factor || 1) : 1;

                    // Compute stock reduction for new combined quantities
                    const reduceQty = item.qty_delivered * conversionFactor;

                    if (reduceQty > 0) {
                        if (item.variant_id) {
                            db.run('UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?', [reduceQty, item.variant_id]);
                            db.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [reduceQty, product.id]);
                        } else {
                            db.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [reduceQty, product.id]);
                        }

                        if (item.batch_id) {
                            db.run('UPDATE product_batches SET current_quantity = current_quantity - ? WHERE id = ?', [reduceQty, item.batch_id]);
                        }

                        // Stock movement for merged invoice
                        db.run(
                            'INSERT INTO stock_movements (product_id, variant_id, type, quantity, reference_type, reference_id, batch_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                            [item.product_id, item.variant_id, 'OUT', reduceQty, 'Invoice', newInvoiceId, item.batch_id, 'Merged Invoice Sale']
                        );
                    }

                    // Calculate subtotal and tax/discount
                    const lineTotal = item.price * item.quantity;
                    const afterDisk = lineTotal - (lineTotal * (item.item_discount_rate / 100));
                    const withGst = afterDisk + (afterDisk * (item.item_gst_rate / 100));
                    finalTotal += withGst;

                    const promoExpense = item.is_free ? (item.quantity * item.original_price) : 0;

                    // Determine status for this combined item row
                    let itemDeliveryStatus = 'Delivered';
                    if (item.qty_delivered === 0) itemDeliveryStatus = 'Pending';
                    else if (item.qty_delivered < item.qty_requested) itemDeliveryStatus = 'Partial';

                    const insertItemResult = db.run(
                        'INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit, price, total, qty_requested, qty_delivered, delivery_status, pending_qty, is_free, original_price, promo_expense, variant_id, variant_name, item_gst_rate, item_discount_rate, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [newInvoiceId, item.product_id, item.product_name, item.quantity, item.unit, item.price, lineTotal, item.qty_requested, item.qty_delivered, itemDeliveryStatus, item.pending_qty, item.is_free ? 1 : 0, item.original_price, promoExpense, item.variant_id, item.variant_name, item.item_gst_rate, item.item_discount_rate, item.batch_id]
                    );
                    const newInvoiceItemId = insertItemResult.lastInsertRowid;

                    item.original_item_ids.forEach(oldId => {
                        oldItemIdToNewItemIdMap[oldId] = newInvoiceItemId;
                    });

                    // Relink Serials
                    if (product.track_serials && item.qty_delivered > 0) {
                        const productSerials = serialsMap[product.id] || [];
                        const itemSerials = productSerials.splice(0, item.qty_delivered);
                        for (const sn of itemSerials) {
                            db.run(
                                "UPDATE product_serials SET status = 'Sold', invoice_id = ?, invoice_item_id = ? WHERE product_id = ? AND UPPER(serial_number) = ?",
                                [newInvoiceId, newInvoiceItemId, product.id, sn.toUpperCase()]
                            );
                        }
                    }
                }

                // 7. Copy Payments
                let finalPaid = 0;
                originalPayments.forEach(p => {
                    db.run(
                        'INSERT INTO invoice_payments (invoice_id, amount, method, transaction_id, notes, payment_date) VALUES (?, ?, ?, ?, ?, ?)',
                        [newInvoiceId, p.amount, p.method, p.transaction_id, p.notes, p.payment_date]
                    );
                    finalPaid += p.amount;
                });

                // 8. Migrate Returns, Stock Movements, and Audit Logs
                let totalReturnedAmount = 0;
                originalReturns.forEach(ret => {
                    const newMappedItemId = ret.invoice_item_id ? (oldItemIdToNewItemIdMap[ret.invoice_item_id] || null) : null;
                    db.run(
                        'UPDATE invoice_returns SET invoice_id = ?, invoice_item_id = ? WHERE id = ?',
                        [newInvoiceId, newMappedItemId, ret.id]
                    );
                    totalReturnedAmount += ret.return_amount;
                });

                // Update stock movements of type 'Invoice Return' to point to the new merged invoice ID
                db.run(
                    `UPDATE stock_movements SET reference_id = ? WHERE reference_type = 'Invoice Return' AND reference_id IN (${placeholders})`,
                    [newInvoiceId, ...invoice_ids]
                );

                // Update audit logs to point to the new merged invoice ID
                db.run(
                    `UPDATE audit_logs SET invoice_id = ? WHERE invoice_id IN (${placeholders})`,
                    [newInvoiceId, ...invoice_ids]
                );

                // Recalculate payment status and delivery status
                let finalPaymentStatus = 'PAID';
                if (finalPaid === 0) finalPaymentStatus = 'UNPAID';
                else if (finalPaid < finalTotal) finalPaymentStatus = 'PARTIAL';
                else finalPaymentStatus = 'PAID';

                let allDelivered = true;
                let allPending = true;
                for (const itemKey in groupedItems) {
                    const item = groupedItems[itemKey];
                    if (item.qty_delivered < item.qty_requested) allDelivered = false;
                    if (item.qty_delivered > 0) allPending = false;
                }
                let invoiceDeliveryStatus = 'Delivered';
                if (allDelivered) invoiceDeliveryStatus = 'Delivered';
                else if (allPending) invoiceDeliveryStatus = 'Pending';
                else invoiceDeliveryStatus = 'Partial';

                let fulfillmentStatus = 'CONFIRMED';
                let isPendingProduct = 0;
                if (invoiceDeliveryStatus === 'Pending' || invoiceDeliveryStatus === 'Partial') {
                    fulfillmentStatus = 'PENDING_PRODUCT';
                    isPendingProduct = 1;
                }

                // Update invoice total, statuses, and returned amount
                db.run('UPDATE invoices SET total = ?, paid_amount = ?, payment_status = ?, financial_status = ?, delivery_status = ?, fulfillment_status = ?, is_pending_product = ?, total_returned_amount = ? WHERE id = ?',
                    [finalTotal, finalPaid, finalPaymentStatus, finalPaymentStatus, invoiceDeliveryStatus, fulfillmentStatus, isPendingProduct, totalReturnedAmount, newInvoiceId]);

                // Create Audit Log
                db.run('INSERT INTO audit_logs (invoice_id, action, details) VALUES (?, ?, ?)',
                    [newInvoiceId, 'Invoice Merged', `Merged original invoices (${invoice_ids.map(id => 'INV-' + String(id).padStart(4, '0')).join(', ')}) into merged invoice INV-${String(newInvoiceId).padStart(4, '0')}`]);

                // 9. Delete original invoices
                db.run(`DELETE FROM invoices WHERE id IN (${placeholders})`, invoice_ids);
            });
        } catch (txnErr) {
            console.error('[Invoice Merge Error]', txnErr);
            throw txnErr;
        }

        // Delete cloud hosted invoices and local tokens for merged invoices
        for (const oldId of invoice_ids) {
            const tokenRow = db.get("SELECT token FROM invoice_tokens WHERE invoice_id = ?", [oldId]);
            if (tokenRow) {
                const DB_URL = "https://mazeway-db.vercel.app";
                const DB_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJncm91cCI6ImFub24iLCJpYXQiOjE3Nzk3MDA0Mzh9.mazeway_db_anon_5KUWRlLbhAarPceBoTlDGMTjNn8hvXtgSTCAGH7CSCOMxgwcZNojTpcYiqqUc3Ma";
                
                fetch(`${DB_URL}/api/v1/tables/hosted_invoices/rows`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': DB_ANON_KEY,
                        'Authorization': `Bearer ${DB_ANON_KEY}`
                    },
                    body: JSON.stringify({
                        match: { invoice_id: oldId }
                    })
                }).catch(e => console.error(`[Delete Sync] Failed to delete hosted invoice #${oldId} from cloud DB:`, e.message));

                db.run('DELETE FROM invoice_tokens WHERE invoice_id = ?', [oldId]);
            }
        }

        res.json({ success: true, new_invoice_id: newInvoiceId });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

