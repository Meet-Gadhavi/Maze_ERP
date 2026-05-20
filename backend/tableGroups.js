const TABLE_GROUPS = {
    inventory: ['products', 'categories'],
    customers: ['customers'],
    sales: ['invoices', 'invoice_items', 'invoice_returns', 'audit_logs'],
    purchases: ['purchases', 'purchase_items', 'purchase_returns', 'suppliers', 'supplier_payments']
};

module.exports = { TABLE_GROUPS };
