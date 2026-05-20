import re

filepath = 'backend/routes/sales.js'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. POST /api/invoices
post_invoice_start = """
        const { customer_id, items, discount_rate, gst_rate, walk_in_name, walk_in_phone, p_credit_amount, use_p_credit, is_advance, advance_amount, payments } = validatedData;
"""

post_invoice_start_replacement = """
        let invoice;
        try {
        db.transaction(() => {
            const { customer_id, items, discount_rate, gst_rate, walk_in_name, walk_in_phone, p_credit_amount, use_p_credit, is_advance, advance_amount, payments } = validatedData;
"""

post_invoice_end = """
        const invoice = db.get(`
            SELECT i.*, c.name AS customer_name
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE i.id = ?
        `, [invoiceId]);
        invoice.items = db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        invoice.payments = db.all('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC', [invoiceId]);

        res.status(201).json(invoice);
"""

post_invoice_end_replacement = """
        invoice = db.get(`
            SELECT i.*, c.name AS customer_name
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE i.id = ?
        `, [invoiceId]);
        invoice.items = db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        invoice.payments = db.all('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC', [invoiceId]);
        }); // End transaction
        
        res.status(201).json(invoice);
        } catch (txnErr) {
            if (txnErr.apiResponse) return; // Already handled
            throw txnErr;
        }
"""

code = code.replace(post_invoice_start, post_invoice_start_replacement)
code = code.replace(post_invoice_end, post_invoice_end_replacement)

# Helper for early returns
code = code.replace("return res.status(400).json({ error: 'Invoice must have at least one item' });", 
                    "res.status(400).json({ error: 'Invoice must have at least one item' }); const err = new Error('Abort'); err.apiResponse = true; throw err;")

# 2. POST /api/invoices/:id/return
return_start = """
        const invoice = db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
"""

return_start_replacement = """
        let resultObj;
        try {
        db.transaction(() => {
        const invoice = db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
"""

return_end = """
        res.json({
            message: 'Return processed',
            invoice_id: invoiceId,
            refund_amount: returnType === 'full' ? refundBalance : totalReturnAmount,
            refund_method,
            financial_status: financialStatus
        });
"""

return_end_replacement = """
        resultObj = {
            message: 'Return processed',
            invoice_id: invoiceId,
            refund_amount: returnType === 'full' ? refundBalance : totalReturnAmount,
            refund_method,
            financial_status: financialStatus
        };
        }); // End transaction
        
        res.json(resultObj);
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
"""

code = code.replace(return_start, return_start_replacement)
code = code.replace(return_end, return_end_replacement)

# Update all `return res.status(...)` inside the return route block
# We know the block starts around line 380 and goes to line 550.
# We'll just replace specific known ones.
code = code.replace("return res.status(404).json({ error: 'Invoice not found' });",
                    "res.status(404).json({ error: 'Invoice not found' }); const err = new Error('Abort'); err.apiResponse = true; throw err;")
code = code.replace("return res.status(400).json({ error: `Product ${ret.product_id} was not in this invoice` });",
                    "res.status(400).json({ error: `Product ${ret.product_id} was not in this invoice` }); const err = new Error('Abort'); err.apiResponse = true; throw err;")
code = code.replace("return res.status(400).json({ error: `Cannot return more than sold for this product` });",
                    "res.status(400).json({ error: `Cannot return more than sold for this product` }); const err = new Error('Abort'); err.apiResponse = true; throw err;")


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Added transactions to sales.js")
