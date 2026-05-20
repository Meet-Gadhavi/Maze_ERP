import re

filepath = 'backend/routes/purchases.js'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. POST / (Create Purchase)
purchase_start = """
        const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', [supplier_id]);
"""
purchase_start_replacement = """
        let resultObj;
        try {
        db.transaction(() => {
        const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', [supplier_id]);
"""

purchase_end = """
        res.status(201).json({ id: purchaseId, grand_total, due_amount: finalDue, status: finalStatus });
"""
purchase_end_replacement = """
        resultObj = { id: purchaseId, grand_total, due_amount: finalDue, status: finalStatus };
        }); // End transaction
        
        res.status(201).json(resultObj);
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
"""
code = code.replace(purchase_start, purchase_start_replacement)
code = code.replace(purchase_end, purchase_end_replacement)

# Helper to throw inside transaction
code = code.replace("return res.status(400).json({ error: 'Invalid supplier' });",
                    "res.status(400).json({ error: 'Invalid supplier' }); const err = new Error('Abort'); err.apiResponse = true; throw err;")


# 2. POST /suppliers/:id/pay
pay_start = """
        const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
"""
pay_start_replacement = """
        let resultObj;
        try {
        db.transaction(() => {
        const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
"""

pay_end = """
        res.json({ success: true, remaining_credit: paymentRemaining });
"""
pay_end_replacement = """
        resultObj = { success: true, remaining_credit: paymentRemaining };
        }); // End transaction
        res.json(resultObj);
        } catch (txnErr) {
            if (txnErr.apiResponse) return;
            throw txnErr;
        }
"""
code = code.replace(pay_start, pay_start_replacement)
code = code.replace(pay_end, pay_end_replacement)

code = code.replace("return res.status(404).json({ error: 'Supplier not found' });",
                    "res.status(404).json({ error: 'Supplier not found' }); const err = new Error('Abort'); err.apiResponse = true; throw err;")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Added transactions to purchases.js")
