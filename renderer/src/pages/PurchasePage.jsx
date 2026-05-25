import React, { useState, useEffect } from 'react';
import api from '../api';
import { toast } from 'sonner';
import CustomSelect from '../components/CustomSelect';
import { FormGroup, Input } from '../components/FormComponents';
import Modal from '../components/Modal';
import SButton from '../components/SButton';
import Icons from '../components/Icons';
import { formatDate, amountToWords } from '../utils';
import { EMPTY_SUPPLIER, EMPTY_EXPENSE } from '../constants';
import './PurchasePage.css';

export default function PurchasePage() {
    const [activeTab, setActiveTab] = useState('bill'); // 'bill', 'history', 'suppliers', 'payments', 'returns'
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [categories, setCategories] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [expenseCategories, setExpenseCategories] = useState([]);

    // Create Bill States
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [billNumber, setBillNumber] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const [cart, setCart] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [paymentStatus, setPaymentStatus] = useState('Unpaid');
    const [paidAmount, setPaidAmount] = useState(0);
    const [settings, setSettings] = useState({});
    const [cartPulse, setCartPulse] = useState(false);

    // Supplier State
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [supplierBalanceFilter, setSupplierBalanceFilter] = useState('All');
    const [deleteSupplier, setDeleteSupplier] = useState(null); // supplier to confirm-delete

    const [showProductModal, setShowProductModal] = useState(false);
    const [newProductForm, setNewProductForm] = useState({ name: '', category: 'General', purchase_price: 0, selling_price: 0, product_code: '', unit: 'PCS' });

    // Serial/IMEI modal states for purchases
    const [showSerialModal, setShowSerialModal] = useState(false);
    const [currentCartIndex, setCurrentCartIndex] = useState(null);
    const [serialInputText, setSerialInputText] = useState('');

    // Expense Form States
    const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE);
    const [expenseSearch, setExpenseSearch] = useState('');

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        try {
            const [sData, pData, purData, catData, expData, expCatData, setts] = await Promise.all([
                api.getSuppliers(),
                api.getProducts(),
                api.getPurchases(),
                api.getCategories(),
                api.getExpenses(),
                api.getExpenseCategories(),
                api.getSettings()
            ]);
            setSuppliers(sData);
            setProducts(pData);
            setPurchases(purData);
            setCategories(catData);
            setExpenses(expData);
            setExpenseCategories(expCatData);
            setSettings(setts);
        } catch (err) {
            console.error('Failed to load purchase system data', err);
        }
    };

    // --- Supplier Actions ---
    const handleSaveSupplier = async (e) => {
        e.preventDefault();
        
        const promise = editingSupplier 
            ? api.updateSupplier(editingSupplier.id, supplierForm)
            : api.createSupplier(supplierForm);
            
        toast.promise(promise, {
            loading: editingSupplier ? 'Updating supplier details...' : 'Adding new supplier...',
            success: () => {
                setShowSupplierModal(false);
                setEditingSupplier(null);
                setSupplierForm(EMPTY_SUPPLIER);
                loadData();
                return editingSupplier ? 'Supplier updated successfully' : 'Supplier added successfully';
            },
            error: (err) => err.message || 'Failed to save supplier'
        });
    };

    // --- Bill Actions ---
    const addToCart = (product) => {
        const exists = cart.find(item => item.product_id === product.id);
        if (exists) return; // or increment qty

        setCart([...cart, {
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit: product.unit || 'PCS',
            purchase_price: product.cost_price || 0,
            discount_percent: 0,
            gst_percent: 18,
            is_new_product: false,
            track_batches: !!product.track_batches,
            batch_number: '',
            expiry_date: '',
            track_serials: !!product.track_serials,
            serials: []
        }]);
        setProductSearch('');
        setCartPulse(true);
        setTimeout(() => setCartPulse(false), 500);
    };

    const handleInlineProductCreate = () => {
        const tempId = `new-${Date.now()}`;
        setCart([...cart, {
            product_id: null,
            product_name: newProductForm.name,
            quantity: 1,
            unit: newProductForm.unit,
            purchase_price: newProductForm.purchase_price,
            selling_price: newProductForm.selling_price,
            category: newProductForm.category,
            product_code: newProductForm.product_code,
            discount_percent: 0,
            gst_percent: 18,
            is_new_product: true,
            track_batches: false,
            batch_number: '',
            expiry_date: '',
            track_serials: false,
            serials: [],
            tempId
        }]);
        setShowProductModal(false);
        setNewProductForm({ name: '', category: 'General', purchase_price: 0, selling_price: 0, product_code: '', unit: 'PCS' });
        setProductSearch('');
        setCartPulse(true);
        setTimeout(() => setCartPulse(false), 500);
    };

    const updateCartItem = (index, field, value) => {
        const newCart = [...cart];
        newCart[index][field] = value;
        setCart(newCart);
    };

    const removeFromCart = (index) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const openSerialInputModal = (index) => {
        const item = cart[index];
        setCurrentCartIndex(index);
        setSerialInputText((item.serials || []).join('\n'));
        setShowSerialModal(true);
    };

    const saveSerials = () => {
        if (currentCartIndex === null) return;
        const rawSerials = serialInputText
            .split(/[\n,]+/)
            .map(s => s.trim())
            .filter(Boolean);

        // Check duplicates in user input
        const duplicates = rawSerials.filter((item, idx) => rawSerials.indexOf(item) !== idx);
        if (duplicates.length > 0) {
            return toast.error(`Duplicate serial numbers found in your input: ${[...new Set(duplicates)].join(', ')}`);
        }

        updateCartItem(currentCartIndex, 'serials', rawSerials);
        setShowSerialModal(false);
        toast.success(`${rawSerials.length} serial number(s) saved`);
    };

    const calculateTotals = () => {
        let subtotal = 0;
        let gstTotal = 0;
        let discountTotal = 0;

        cart.forEach(item => {
            const lineSub = (item.quantity || 0) * (item.purchase_price || 0);
            const lineDisc = lineSub * ((item.discount_percent || 0) / 100);
            const lineAfterDisc = lineSub - lineDisc;
            const lineGst = lineAfterDisc * ((item.gst_percent || 0) / 100);

            subtotal += lineSub;
            discountTotal += lineDisc;
            gstTotal += lineGst;
        });

        const grandTotal = subtotal - discountTotal + gstTotal;
        return { subtotal, discountTotal, gstTotal, grandTotal };
    };

    const totals = calculateTotals();

    const handleSaveBill = async () => {
        if (!selectedSupplier) return toast.error('Select a supplier');
        if (cart.length === 0) return toast.error('Cart is empty');

        if (settings.enable_batch_system === 'true') {
            for (const item of cart) {
                if (item.track_batches) {
                    if (settings.require_batch_number === 'true' && (!item.batch_number || !item.batch_number.trim())) {
                        return toast.error(`Batch Number is required for ${item.product_name}`);
                    }
                    if (settings.enable_expiry_tracking === 'true' && !item.expiry_date) {
                        return toast.error(`Expiry date is required for ${item.product_name} (Batch: ${item.batch_number || 'N/A'})`);
                    }
                }
            }
        }

        for (const item of cart) {
            if (settings.enable_serial_tracking === 'true' && item.track_serials) {
                const serials = item.serials || [];
                if (serials.length !== item.quantity) {
                    return toast.error(`Product "${item.product_name}" requires exactly ${item.quantity} serial number(s). You have entered ${serials.length}.`);
                }
            }
        }

        const actualPaidAmount = 
            paymentStatus === 'Paid' 
                ? totals.grandTotal 
                : (paymentStatus === 'Unpaid' ? 0 : Number(paidAmount || 0));

        const payload = {
            supplier_id: parseInt(selectedSupplier),
            bill_number: billNumber,
            purchase_date: purchaseDate,
            due_date: dueDate,
            items: cart,
            payment_status: paymentStatus,
            paid_amount: actualPaidAmount
        };

        const promise = api.createPurchase(payload);
        
        toast.promise(promise, {
            loading: 'Saving purchase bill and updating stock...',
            success: () => {
                setCart([]);
                setBillNumber('');
                setSelectedSupplier('');
                setPaymentStatus('Unpaid');
                setPaidAmount(0);
                setActiveTab('history');
                return 'Purchase bill saved successfully';
            },
            error: (err) => err.message || 'Failed to save bill'
        });
    };

    // --- Renderers ---
    const renderSuppliers = () => {
        const searchFiltered = suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || s.phone.includes(supplierSearch));
        const filtered = searchFiltered.filter(s => {
            if (supplierBalanceFilter === 'Due') return Number(s.due_balance) > 0;
            if (supplierBalanceFilter === 'Clear') return Number(s.due_balance) <= 0;
            return true;
        });
        return (
            <div className="tab-content">
                <div className="page-toolbar">
                    <div className="search-bar">
                        <Icons.Search size={18} />
                        <input
                            type="text"
                            placeholder="Search suppliers..."
                            value={supplierSearch}
                            onChange={(e) => setSupplierSearch(e.target.value)}
                        />
                    </div>
                    <div className="page-toolbar-actions">
                        <CustomSelect
                            value={supplierBalanceFilter}
                            onChange={val => setSupplierBalanceFilter(val)}
                            options={[
                                { value: 'All', label: 'All Suppliers' },
                                { value: 'Due', label: 'With Balance Due' },
                                { value: 'Clear', label: 'No Balance Due' }
                            ]}
                        />
                    </div>
                </div>
                {suppliers.length === 0 ? (
                    <div className="empty-state-premium">
                        <div className="empty-icon-wrapper">
                            <Icons.Users size={40} />
                        </div>
                        <h3>No Suppliers Found</h3>
                        <p>Add your suppliers to easily manage bills and outstanding payments.</p>
                        <SButton variant="primary" onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', phone: '', gstin: '', address: '', opening_balance: 0, notes: '' }); setShowSupplierModal(true); }}>
                            Add Supplier
                        </SButton>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <Icons.UserX size={32} />
                        <p>No suppliers matching your search or filters</p>
                    </div>
                ) : (
                    <div className="premium-table-wrap">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Supplier Name</th>
                                    <th>Phone</th>
                                    <th>GSTIN</th>
                                    <th className="text-right">Balance Due</th>
                                    <th>Joined</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(s => (
                                    <tr key={s.id}>
                                        <td className="fw-600 color-primary">{s.name}</td>
                                        <td>{s.phone}</td>
                                        <td>{s.gstin || '-'}</td>
                                        <td className={`text-right fw-700 ${s.due_balance > 0 ? 'color-danger' : 'color-success'}`}>
                                            ₹{Number(s.due_balance).toLocaleString()}
                                        </td>
                                        <td className="text-secondary size-12">{formatDate(s.created_at)}</td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-8">
                                                <SButton title="Edit" variant="secondary" onClick={() => { setEditingSupplier(s); setSupplierForm(s); setShowSupplierModal(true); }}>
                                                    <Icons.Edit2 size={14} />
                                                </SButton>
                                                <SButton title="Delete" variant="secondary" tone="critical" onClick={() => setDeleteSupplier(s)}>
                                                    <Icons.Trash2 size={14} />
                                                </SButton>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const renderBillForm = () => {
        const filteredProducts = productSearch
            ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.product_code && p.product_code.toLowerCase().includes(productSearch.toLowerCase())))
            : [];

        return (
            <div className="bill-form">
                <div className="bill-main">
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Supplier *</label>
                            <CustomSelect 
                                value={selectedSupplier} 
                                onChange={(val) => setSelectedSupplier(val)}
                                options={suppliers.map(s => ({ value: s.id.toString(), label: s.name }))}
                                placeholder="Select Supplier"
                            />
                        </div>
                        <div className="form-group">
                            <label>Bill Number</label>
                            <input type="text" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} placeholder="e.g. PUR-101" />
                        </div>
                        <div className="form-group">
                            <label>Date</label>
                            <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Due Date</label>
                            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="product-search-container">
                        <input
                            type="text"
                            className="search-input"
                            style={{ width: '100%' }}
                            placeholder="Type product name or code..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                        />
                        {productSearch && (
                            <div className="search-results">
                                {filteredProducts.map(p => (
                                    <div key={p.id} className="search-item" onClick={() => addToCart(p)}>
                                        {p.name} - ₹{p.cost_price} ({p.stock_quantity} {p.unit})
                                    </div>
                                ))}
                                <div className="create-new-prompt" onClick={() => { setNewProductForm({ ...newProductForm, name: productSearch }); setShowProductModal(true); }}>
                                    + Product NOT found? Create & Add to Inventory
                                </div>
                            </div>
                        )}
                    </div>

                    <table className="purchase-items-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Qty</th>
                                <th>Unit</th>
                                <th>Price</th>
                                <th>Disc %</th>
                                <th>GST %</th>
                                <th>Total</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '40px 0' }}>
                                        <div className="empty-state-premium" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                                            <div className="empty-icon-wrapper" style={{ width: 48, height: 48, margin: '0 auto 16px' }}>
                                                <Icons.ShoppingCart size={24} strokeWidth={1.5} />
                                            </div>
                                            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Cart is Empty</h3>
                                            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Search and add products to start creating the bill.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : cart.map((item, idx) => {
                                const lineSub = (item.quantity || 0) * (item.purchase_price || 0);
                                const lineFinal = lineSub - (lineSub * (item.discount_percent / 100)) + (lineSub * (1 - item.discount_percent / 100) * (item.gst_percent / 100));
                                return (
                                    <tr key={idx}>
                                        <td>
                                            {item.product_name} {item.is_new_product && <span className="badge" style={{ background: '#e3f2fd', color: '#1976d2' }}>NEW</span>}
                                            {item.track_batches && settings.enable_batch_system === 'true' && (
                                                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                                    <input type="text" placeholder={settings.require_batch_number === 'true' ? "Batch # *" : "Batch #"} value={item.batch_number} onChange={(e) => updateCartItem(idx, 'batch_number', e.target.value)} style={{ width: settings.enable_expiry_tracking === 'true' ? '50%' : '100%', padding: '2px 4px', fontSize: '0.8em', border: '1px solid var(--border)', borderRadius: '4px' }} />
                                                    {settings.enable_expiry_tracking === 'true' && (
                                                        <input type="date" value={item.expiry_date || ''} onChange={(e) => updateCartItem(idx, 'expiry_date', e.target.value)} style={{ width: '50%', padding: '2px 4px', fontSize: '0.8em', border: '1px solid var(--border)', borderRadius: '4px' }} />
                                                    )}
                                                </div>
                                            )}
                                            {settings.enable_serial_tracking === 'true' && item.track_serials && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                    <span style={{ fontSize: '0.8em', fontWeight: 600, color: (item.serials || []).length === item.quantity ? 'var(--success)' : 'var(--danger)' }}>
                                                        Serials ({(item.serials || []).length} of {item.quantity})
                                                    </span>
                                                    <s-button 
                                                        variant="secondary" 
                                                        style={{ padding: '2px 6px', fontSize: '10px', height: '22px' }}
                                                        onClick={() => openSerialInputModal(idx)}
                                                    >
                                                        Enter Serials
                                                    </s-button>
                                                </div>
                                            )}
                                        </td>
                                        <td><input type="number" className="qty-input" value={item.quantity} onChange={(e) => updateCartItem(idx, 'quantity', parseFloat(e.target.value))} /></td>
                                        <td>{item.unit}</td>
                                        <td><input type="number" className="price-input" value={item.purchase_price} onChange={(e) => updateCartItem(idx, 'purchase_price', parseFloat(e.target.value))} /></td>
                                        <td><input type="number" style={{ width: 60 }} value={item.discount_percent} onChange={(e) => updateCartItem(idx, 'discount_percent', parseFloat(e.target.value))} /></td>
                                        <td>
                                            <CustomSelect 
                                                value={item.gst_percent} 
                                                onChange={(val) => updateCartItem(idx, 'gst_percent', parseInt(val))}
                                                options={[0, 5, 12, 18, 28].map(g => ({ value: g, label: `${g}%` }))}
                                            />
                                        </td>
                                        <td>₹{lineFinal.toFixed(2)}</td>
                                        <td><SButton variant="secondary" tone="critical" onClick={() => removeFromCart(idx)} title="Remove from cart"><Icons.Trash size={14} /></SButton></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="bill-sidebar">
                    <h3>Bill Summary</h3>
                    
                    <div className="calculation-breakdown" style={{ marginBottom: '20px' }}>
                        <div className="summary-row"><span>Subtotal:</span> ₹{totals.subtotal.toFixed(2)}</div>
                        <div className="summary-row" style={{ color: 'var(--danger)' }}><span>Discount:</span> -₹{totals.discountTotal.toFixed(2)}</div>
                        <div className="summary-row"><span>GST:</span> +₹{totals.gstTotal.toFixed(2)}</div>
                        <div className="gst-breakup">
                        {/* M029: Show correct GST type based on interstate flag */}
                        {(() => {
                            const isInterstate = suppliers.find(s => s.id === parseInt(selectedSupplier))?.state_id !== undefined &&
                                settings.shop_state !== suppliers.find(s => s.id === parseInt(selectedSupplier))?.state_id;
                            if (isInterstate) {
                                return `IGST: ₹${totals.gstTotal.toFixed(2)}`;
                            }
                            return `CGST: ₹${(totals.gstTotal / 2).toFixed(2)} | SGST: ₹${(totals.gstTotal / 2).toFixed(2)}`;
                        })()}
                    </div>
                    </div>

                    <div className={`summary-row total ${cartPulse ? 'pulse' : ''}`} style={{ borderTop: '2px solid var(--border)', paddingTop: '16px' }}>
                        <span>Grand Total:</span> 
                        <span className="amount" style={{ fontSize: 'var(--font-size-xl)', color: 'var(--accent)' }}>₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="form-group" style={{ marginTop: 20 }}>
                        <label>Payment Status</label>
                        <CustomSelect 
                            value={paymentStatus} 
                            onChange={(val) => setPaymentStatus(val)}
                            options={[
                                { value: 'Unpaid', label: 'Unpaid' },
                                { value: 'Partial', label: 'Partial' },
                                { value: 'Paid', label: 'Paid' }
                            ]}
                        />
                    </div>

                    {paymentStatus === 'Partial' && (
                        <div className="form-group">
                            <label>Paid Amount</label>
                            <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value))} />
                        </div>
                    )}

                    <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <SButton variant="primary" style={{ width: '100%' }} onClick={handleSaveBill}>
                            Save Purchase
                        </SButton>
                    </div>
                </div>
            </div>
        );
    };

    // M023: Export purchase history as CSV
    const handleExportCSV = () => {
        if (!purchases.length) return;
        const headers = ['Bill #', 'Supplier', 'Date', 'Grand Total', 'Paid', 'Due', 'Status'];
        const rows = purchases.map(p => [
            p.bill_number || `P-${p.id}`,
            p.supplier_name,
            p.purchase_date,
            p.grand_total.toFixed(2),
            p.paid_amount.toFixed(2),
            p.due_amount.toFixed(2),
            p.status
        ]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `purchases_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Purchase history exported as CSV');
    };

    const renderHistory = () => {
        return (
            <div className="tab-content">
                {/* M023: CSV Export button */}
                {purchases.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                        <SButton variant="secondary" onClick={handleExportCSV}>
                            Export CSV
                        </SButton>
                    </div>
                )}
                {purchases.length === 0 ? (
                    <div className="empty-state-premium">
                        <div className="empty-icon-wrapper">
                            <Icons.FileText size={40} />
                        </div>
                        <h3>No Bills Found</h3>
                        <p>Get started by recording your first purchase bill from a supplier.</p>
                        <SButton variant="primary" onClick={() => setActiveTab('bill')}>
                            Add New Bill
                        </SButton>
                    </div>
                ) : (
                    <div className="premium-table-wrap">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Bill #</th>
                                    <th>Supplier</th>
                                    <th>Date</th>
                                    <th className="text-right">Total</th>
                                    <th className="text-right">Paid</th>
                                    <th className="text-right">Due</th>
                                    <th className="text-center">Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchases.map(p => (
                                    <tr key={p.id}>
                                        <td className="fw-600">#{p.bill_number || `P-${p.id}`}</td>
                                        <td className="color-primary">{p.supplier_name}</td>
                                        <td className="text-secondary size-13">{formatDate(p.purchase_date)}</td>
                                        <td className="text-right fw-500">₹{p.grand_total.toFixed(2)}</td>
                                        <td className="text-right color-success">₹{p.paid_amount.toFixed(2)}</td>
                                        <td className="text-right color-danger">₹{p.due_amount.toFixed(2)}</td>
                                        <td className="text-center"><span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span></td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-8">
                                                <SButton title="View Details" variant="secondary" onClick={() => handleViewDetails(p.id)}>
                                                    <Icons.Eye size={14} />
                                                </SButton>
                                                {p.status !== 'Draft' && (
                                                    <SButton title="Process Return" variant="secondary" onClick={() => handleInitiateReturn(p.id)}>
                                                        <Icons.RotateCcw size={14} />
                                                    </SButton>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const [returnBill, setReturnBill] = useState(null);
    const [returnItems, setReturnItems] = useState({}); // { product_id: qty }
    const [refundMethod, setRefundMethod] = useState('Refund');

    const handleInitiateReturn = async (id) => {
        try {
            const data = await api.getPurchase(id);
            setReturnBill(data);
            setReturnItems({});
            setActiveTab('returns');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleViewDetails = async (id) => {
        try {
            const data = await api.getPurchase(id);
            setPreviewPurchase(data);
        } catch (err) {
            alert(err.message);
        }
    };
    const [previewPurchase, setPreviewPurchase] = useState(null);

    const renderReturns = () => {
        if (!returnBill) {
            return (
                <div className="tab-content">
                    <div className="empty-state-premium">
                        <div className="empty-icon-wrapper">
                            <Icons.RotateCcw size={40} />
                        </div>
                        <h3>Initiate a Return</h3>
                        <p>Select a bill from your purchase history to start the return process.</p>
                        <SButton variant="primary" onClick={() => setActiveTab('history')}>
                            Go to History
                        </SButton>
                    </div>
                </div>
            );
        }

        return (
            <div className="tab-content">
                <div className="flex align-center gap-12 mb-20">
                    <SButton variant="secondary" onClick={() => setReturnBill(null)} title="Back to History">
                        <Icons.ArrowLeft size={16} />
                    </SButton>
                    <h3 className="m-0">Return Items for Bill: <span className="color-accent">#{returnBill.bill_number || returnBill.id}</span></h3>
                </div>

                <div className="bill-form">
                    <div className="bill-main">
                        <div className="premium-table-wrap">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th className="text-center">Purchased Qty</th>
                                        <th className="text-center">Return Qty</th>
                                        <th className="text-right">Return Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {returnBill.items?.map(item => {
                                        const retQty = returnItems[item.product_id] || 0;
                                        const unitPrice = item.line_total / item.quantity;
                                        return (
                                            <tr key={item.product_id}>
                                                <td className="fw-500">{item.product_name}</td>
                                                <td className="text-center text-secondary">{item.quantity} {item.unit}</td>
                                                <td className="text-center">
                                                    <input 
                                                        type="number" 
                                                        className="qty-input"
                                                        value={retQty} 
                                                        onChange={e => setReturnItems({...returnItems, [item.product_id]: parseInt(e.target.value) || 0})}
                                                        max={item.quantity}
                                                        min={0}
                                                        style={{ width: '80px', textAlign: 'center' }}
                                                    />
                                                </td>
                                                <td className="text-right fw-600 color-danger">₹{(retQty * unitPrice).toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bill-sidebar">
                        <h3>Return Summary</h3>
                        <div className="summary-row">
                            <span>Supplier:</span>
                            <span className="fw-600">{returnBill.supplier_name}</span>
                        </div>
                        <div className="summary-row">
                            <span>Refund Method:</span>
                            <CustomSelect 
                                value={refundMethod}
                                onChange={setRefundMethod}
                                options={[
                                    { value: 'Refund', label: 'Cash/Bank Refund' },
                                    { value: 'Credit', label: 'Supplier Credit (Adjust Balance)' }
                                ]}
                            />
                        </div>
                        <div className="summary-row total" style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                            <span>Total Refund:</span>
                            <span className="amount color-danger">
                                ₹{Object.entries(returnItems).reduce((sum, [pid, qty]) => {
                                    const itm = returnBill.items.find(i => i.product_id == pid);
                                    return sum + (qty * (itm.line_total / itm.quantity));
                                }, 0).toFixed(2)}
                            </span>
                        </div>
                        <SButton variant="primary" tone="critical" style={{ width: '100%', marginTop: '24px' }} onClick={async () => {
                                const payload = {
                                    items: Object.entries(returnItems)
                                        .filter(([_, qty]) => qty > 0)
                                        .map(([pid, qty]) => ({ product_id: parseInt(pid), quantity: qty })),
                                    refund_method: refundMethod
                                };
                                if (payload.items.length === 0) return toast.error('Select items to return');
                                
                                const promise = api.returnPurchase(returnBill.id, payload);
                                
                                toast.promise(promise, {
                                    loading: 'Processing purchase return...',
                                    success: () => {
                                        setReturnBill(null);
                                        setReturnItems({});
                                        loadData();
                                        setActiveTab('history');
                                        return 'Return processed successfully';
                                    },
                                    error: (err) => err.message || 'Failed to process return'
                                });
                            }}>Process Return</SButton>
                        </div>
                    </div>
                </div>
        );
    };

    const [paymentSupplier, setPaymentSupplier] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [payMode, setPayMode] = useState('Cash');
    const [payPhase, setPayPhase] = useState('idle'); // idle | processing | done
    const [payStep, setPayStep] = useState(0); // 0,1,2 during processing

    const PAYMENT_STEPS = [
        { label: 'Validating payment details…', icon: '🔐' },
        { label: 'Recording transaction…', icon: '📝' },
        { label: 'Updating supplier balance…', icon: '⚡' },
    ];

    const handleSubmitPayment = async () => {
        if (!paymentAmount || parseFloat(paymentAmount) <= 0) return toast.error('Enter valid amount');

        const promise = api.paySupplier(paymentSupplier, { amount: paymentAmount, payment_mode: payMode });

        toast.promise(promise, {
            loading: 'Recording supplier payment...',
            success: () => {
                setPayPhase('done');
                loadData();
                setTimeout(() => {
                    setPayPhase('idle');
                    setPaymentAmount('');
                    setPaymentSupplier('');
                }, 2500);
                return 'Payment recorded successfully';
            },
            error: (err) => {
                setPayPhase('idle');
                return err.message || 'Failed to process payment';
            }
        });
    };

    const renderPayments = () => {
        const selectedS = suppliers.find(s => s.id === parseInt(paymentSupplier));
        const isDone = payPhase === 'done';
        const isProcessing = payPhase === 'processing';
        const suppliersWithDue = suppliers.filter(s => Number(s.due_balance) > 0);

        return (
            <div className="tab-content">
                <div className="payments-container">
                    {/* Left: Payment Form */}
                    <div className="payment-card">
                        <div className="payment-header">
                            <div className="payment-icon-box">
                                <Icons.CreditCard size={20} />
                            </div>
                            <div>
                                <h3>Record Payment</h3>
                                <p>Pay off outstanding supplier balances</p>
                            </div>
                        </div>

                        <div className="flex-column gap-16">
                            <FormGroup label="Select Supplier">
                                <CustomSelect 
                                    value={paymentSupplier} 
                                    onChange={val => { setPaymentSupplier(val); setPayPhase('idle'); }} 
                                    disabled={isProcessing || isDone}
                                    options={suppliersWithDue.map(s => ({ value: s.id.toString(), label: `${s.name} (Due: ₹${Number(s.due_balance).toLocaleString()})` }))}
                                    placeholder="Select Supplier"
                                />
                            </FormGroup>

                            {selectedS && (
                                <div className="animate-fade-in">
                                    <div className="balance-alert">
                                        <div className="label">Outstanding Balance</div>
                                        <div className="value">₹{Number(selectedS.due_balance).toLocaleString()}</div>
                                    </div>

                                    <div className="form-grid">
                                        <FormGroup label="Amount (₹)">
                                            <Input 
                                                type="number" 
                                                value={paymentAmount} 
                                                onChange={e => setPaymentAmount(e.target.value)} 
                                                placeholder="0.00" 
                                                disabled={isProcessing || isDone}
                                                autoFocus
                                            />
                                        </FormGroup>
                                        <FormGroup label="Payment Mode">
                                            <CustomSelect 
                                                value={payMode} 
                                                onChange={val => setPayMode(val)} 
                                                disabled={isProcessing || isDone}
                                                options={[
                                                    { value: 'Cash', label: 'Cash' },
                                                    { value: 'Bank Transfer', label: 'Bank Transfer' },
                                                    { value: 'Cheque', label: 'Cheque' },
                                                    { value: 'UPI', label: 'UPI' }
                                                ]}
                                            />
                                        </FormGroup>
                                    </div>

                                    <SButton
                                        variant={isDone ? 'primary' : 'primary'}
                                        tone={isDone ? 'success' : undefined}
                                        style={{ width: '100%', marginTop: '12px' }}
                                        disabled={isProcessing || isDone || !paymentAmount}
                                        loading={isProcessing}
                                        onClick={handleSubmitPayment}
                                    >
                                        {isDone ? (
                                            <span>Payment Recorded Successfully</span>
                                        ) : (
                                            <span>Confirm & Record Payment</span>
                                        )}
                                    </SButton>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Due Suppliers List */}
                    <div className="supplier-dues-sidebar">
                        <h4 className="sidebar-title">
                            Suppliers with Dues ({suppliersWithDue.length})
                        </h4>
                        {suppliersWithDue.length === 0 ? (
                            <div className="empty-state-small" style={{ textAlign: 'center', padding: '40px 0' }}>
                                <div className="empty-icon-wrapper" style={{ margin: '0 auto 16px', background: 'var(--success-bg)', color: 'var(--success)' }}>
                                    <Icons.CheckCircle size={28} />
                                </div>
                                <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-secondary)' }}>All clear! No pending dues.</p>
                            </div>
                        ) : (
                            <div className="due-supplier-list">
                                {suppliersWithDue.map(s => (
                                    <div 
                                        key={s.id} 
                                        className={`due-supplier-item ${parseInt(paymentSupplier) === s.id ? 'active' : ''}`}
                                        onClick={() => { setPaymentSupplier(s.id.toString()); setPayPhase('idle'); }}
                                    >
                                        <div>
                                            <div className="name">{s.name}</div>
                                            <div className="phone">{s.phone || 'No contact info'}</div>
                                        </div>
                                        <div className="amount">₹{Number(s.due_balance).toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderExpenses = () => {
        const filtered = expenses.filter(e => 
            (e.description || '').toLowerCase().includes(expenseSearch.toLowerCase()) || 
            (e.category_name || '').toLowerCase().includes(expenseSearch.toLowerCase())
        );

        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const monthlyTotal = expenses
            .filter(e => e.date.startsWith(currentMonth))
            .reduce((sum, e) => sum + e.amount, 0);

        const handleSaveExpense = async (e) => {
            e.preventDefault();
            if (!expenseForm.amount || !expenseForm.category_id) return toast.error('Category and Amount are required');
            
            const promise = api.createExpense(expenseForm);
            toast.promise(promise, {
                loading: 'Recording expense...',
                success: () => {
                    setExpenseForm(EMPTY_EXPENSE);
                    loadData();
                    return 'Expense recorded successfully';
                },
                error: (err) => err.message || 'Failed to save expense'
            });
        };

        const handleDeleteExpense = async (id) => {
            const promise = api.deleteExpense(id);
            toast.promise(promise, {
                loading: 'Deleting expense...',
                success: () => {
                    loadData();
                    return 'Expense deleted successfully';
                },
                error: (err) => err.message || 'Failed to delete expense'
            });
        };

        return (
            <div className="tab-content">
                <div className="expense-container">
                    <div className="expense-form-card">
                        <h3>Record Expense</h3>
                        
                        <div className="expense-stats-row">
                            <div className="expense-stat-card">
                                <span className="expense-stat-label">Monthly Total ({new Date().toLocaleString('default', { month: 'short' })})</span>
                                <div className="expense-stat-value">₹{monthlyTotal.toLocaleString()}</div>
                            </div>
                        </div>

                        <form onSubmit={handleSaveExpense} className="flex-column gap-16">
                            <FormGroup label="Category *">
                                <CustomSelect 
                                    value={expenseForm.category_id} 
                                    onChange={val => setExpenseForm({...expenseForm, category_id: val})}
                                    options={expenseCategories.map(c => ({ value: c.id.toString(), label: c.name }))}
                                    placeholder="Select Category"
                                />
                            </FormGroup>
                            <FormGroup label="Amount *">
                                <Input 
                                    type="number" 
                                    value={expenseForm.amount} 
                                    onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} 
                                    placeholder="0.00"
                                    suffix="₹"
                                />
                            </FormGroup>
                            <FormGroup label="Date">
                                <Input 
                                    type="date" 
                                    value={expenseForm.date} 
                                    onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} 
                                />
                            </FormGroup>
                            <FormGroup label="Description">
                                <textarea 
                                    className="form-control"
                                    value={expenseForm.description} 
                                    onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} 
                                    placeholder="e.g. Electricity Bill, Tea/Cofee..." 
                                    rows="3"
                                />
                            </FormGroup>
                            <FormGroup label="Payment Mode">
                                <CustomSelect 
                                    value={expenseForm.payment_mode} 
                                    onChange={val => setExpenseForm({...expenseForm, payment_mode: val})}
                                    options={[
                                        { value: 'Cash', label: 'Cash' },
                                        { value: 'Bank Transfer', label: 'Bank Transfer' },
                                        { value: 'UPI', label: 'UPI' },
                                        { value: 'Cheque', label: 'Cheque' }
                                    ]}
                                />
                            </FormGroup>
                            <SButton variant="primary" type="submit" style={{ width: '100%', marginTop: '8px' }}>
                                Record Expense
                            </SButton>
                        </form>
                    </div>

                    <div className="expense-list-section">
                        <div className="page-toolbar">
                            <div className="search-bar">
                                <Icons.Search size={18} />
                                <input
                                    type="text"
                                    placeholder="Search expenses by category or description..."
                                    value={expenseSearch}
                                    onChange={(e) => setExpenseSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="expense-table-wrap">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Category</th>
                                        <th>Description</th>
                                        <th>Mode</th>
                                        <th className="text-right">Amount</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan="6" className="text-center p-40 text-tertiary italic">No expenses recorded yet matching your search.</td></tr>
                                    ) : (
                                        filtered.map(e => (
                                            <tr key={e.id}>
                                                <td className="fw-500 whitespace-nowrap">{formatDate(e.date)}</td>
                                                <td><span className="badge badge-neutral">{e.category_name}</span></td>
                                                <td className="size-13 color-secondary">{e.description || '—'}</td>
                                                <td className="size-13">{e.payment_mode}</td>
                                                <td className="text-right fw-700 color-danger">₹{e.amount.toLocaleString()}</td>
                                                <td className="text-right">
                                                    <SButton variant="secondary" tone="critical" title="Delete" onClick={() => handleDeleteExpense(e.id)}>
                                                        <Icons.Trash2 size={14} />
                                                    </SButton>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="purchase-page">
            <div className="page-header">
                <div>
                    <h1>Purchases</h1>
                    <p className="text-secondary size-12 mt-4 ml-4">Manage suppliers, purchase bills and expenses</p>
                </div>
                <div className="header-actions">
                    <SButton variant="secondary" onClick={() => setActiveTab('suppliers')}>
                        Suppliers
                    </SButton>
                    {activeTab === 'suppliers' && (
                        <SButton variant="primary" onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', phone: '', gstin: '', address: '', opening_balance: 0, notes: '' }); setShowSupplierModal(true); }}>
                            Add Supplier
                        </SButton>
                    )}
                    {activeTab !== 'suppliers' && (
                        <SButton variant="primary" onClick={() => setActiveTab('bill')}>
                            New Bill
                        </SButton>
                    )}
                </div>
            </div>

            <div className="tabs">
                <button className={`tab-item ${activeTab === 'bill' ? 'active' : ''}`} onClick={() => setActiveTab('bill')}>Bill Center</button>
                <button className={`tab-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Purchase History</button>
                <button className={`tab-item ${activeTab === 'suppliers' ? 'active' : ''}`} onClick={() => setActiveTab('suppliers')}>Suppliers</button>
                <button className={`tab-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>Payments</button>
                <button className={`tab-item ${activeTab === 'returns' ? 'active' : ''}`} onClick={() => setActiveTab('returns')}>Returns</button>
                <button className={`tab-item ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>Expenses</button>
            </div>

            {activeTab === 'bill' && renderBillForm()}
            {activeTab === 'history' && renderHistory()}
            {activeTab === 'suppliers' && renderSuppliers()}
            {activeTab === 'payments' && renderPayments()}
            {activeTab === 'returns' && renderReturns()}
            {activeTab === 'expenses' && renderExpenses()}
            <Modal
                open={!!previewPurchase}
                onClose={() => setPreviewPurchase(null)}
                heading={`Purchase Bill: ${previewPurchase?.bill_number || `P-${previewPurchase?.id}`}`}
                size="large"
            >
                {(() => {
                    const supplierObj = suppliers.find(s => s.id === previewPurchase?.supplier_id);
                    
                    // Calculate totals on the fly
                    let subtotal = 0;
                    let discountTotal = 0;
                    let gstTotal = 0;
                    
                    if (previewPurchase?.items) {
                        previewPurchase.items.forEach(item => {
                            const qty = Number(item.quantity || 0);
                            const price = Number(item.purchase_price || 0);
                            const discPer = Number(item.discount_percent || 0);
                            const gstPer = Number(item.gst_percent || 0);
                            
                            const itemSubtotal = qty * price;
                            const itemDiscount = itemSubtotal * (discPer / 100);
                            const lineAfterDiscount = itemSubtotal - itemDiscount;
                            const itemGst = lineAfterDiscount * (gstPer / 100);
                            
                            subtotal += itemSubtotal;
                            discountTotal += itemDiscount;
                            gstTotal += itemGst;
                        });
                    }

                    return (
                        <div className="purchase-invoice-preview formal-invoice-container">
                            {/* Header Section */}
                            <div className="formal-header">
                                <div className="company-logo-section">
                                    {settings?.logo_url ? (
                                        <img src={settings.logo_url} alt="Logo" />
                                    ) : (
                                        <div className="logo-placeholder">{settings?.company_name?.substring(0, 2).toUpperCase() || 'MZ'}</div>
                                    )}
                                </div>
                                <div className="company-details-section">
                                    <h1>{settings?.company_name || 'Maze ERP'}</h1>
                                    {settings?.address && <p>{settings.address}</p>}
                                    {settings?.phone && <p>Phone: {settings.phone}</p>}
                                    {settings?.email && <p>Email: {settings.email}</p>}
                                    {settings?.gstin && <p>GSTIN: <strong>{settings.gstin}</strong></p>}
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="formal-info-grid">
                                <div className="info-box bill-to">
                                    <div className="box-label">Supplier / Vendor</div>
                                    <div className="box-content">
                                        <strong>{supplierObj?.name || previewPurchase?.supplier_name || '—'}</strong>
                                        {(supplierObj?.phone || previewPurchase?.supplier_phone) && (
                                            <p>Phone: {supplierObj?.phone || previewPurchase?.supplier_phone}</p>
                                        )}
                                        {supplierObj?.address && (
                                            <p style={{ whiteSpace: 'pre-line', fontSize: '11px', margin: '4px 0 0 0', color: '#475569' }}>{supplierObj.address}</p>
                                        )}
                                        {supplierObj?.gstin && (
                                            <p style={{ margin: '4px 0 0 0' }}>GSTIN: <strong>{supplierObj.gstin}</strong></p>
                                        )}
                                    </div>
                                </div>
                                <div className="info-box invoice-details">
                                    <div className="box-label">Bill Info</div>
                                    <div className="box-content">
                                        <div className="detail-row">
                                            <span>Bill Number:</span>
                                            <strong>{previewPurchase?.bill_number || `P-${previewPurchase?.id}`}</strong>
                                        </div>
                                        <div className="detail-row">
                                            <span>Purchase Date:</span>
                                            <strong>{formatDate(previewPurchase?.purchase_date)}</strong>
                                        </div>
                                        {previewPurchase?.due_date && (
                                            <div className="detail-row">
                                                <span>Due Date:</span>
                                                <strong>{formatDate(previewPurchase?.due_date)}</strong>
                                            </div>
                                        )}
                                        <div className="detail-row" style={{ marginTop: '6px' }}>
                                            <span>Payment Status:</span>
                                            <span className={`badge badge-${previewPurchase?.status?.toLowerCase()}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                                {previewPurchase?.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div style={{ borderBottom: '1px solid #334155' }}>
                                <table className="formal-items-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '50px' }}>#</th>
                                            <th className="text-left">Product Name</th>
                                            <th style={{ width: '100px' }}>HSN Code</th>
                                            <th style={{ width: '70px' }}>Qty</th>
                                            <th style={{ width: '60px' }}>Unit</th>
                                            <th className="text-right" style={{ width: '100px' }}>Unit Price</th>
                                            <th style={{ width: '70px' }}>Disc %</th>
                                            <th style={{ width: '70px' }}>GST %</th>
                                            <th className="text-right" style={{ width: '110px' }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewPurchase?.items?.map((item, i) => (
                                            <tr key={i}>
                                                <td>{i + 1}</td>
                                                <td className="text-left fw-500">{item.product_name}</td>
                                                <td>{item.hsn_code || '—'}</td>
                                                <td>{item.quantity}</td>
                                                <td>{item.unit || 'PCS'}</td>
                                                <td className="text-right text-secondary">₹{Number(item.purchase_price || 0).toFixed(2)}</td>
                                                <td>{item.discount_percent ? `${item.discount_percent}%` : '—'}</td>
                                                <td>{item.gst_percent ? `${item.gst_percent}%` : '0%'}</td>
                                                <td className="text-right fw-600">₹{Number(item.line_total || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Bottom Summary Section */}
                            <div className="formal-bottom-section">
                                <div className="left-column" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div className="box-content" style={{ borderBottom: '1px solid #334155', padding: '12px' }}>
                                        <div className="box-label" style={{ background: 'transparent', padding: 0, fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Amount in Words:</div>
                                        <div style={{ fontSize: '12px', fontWeight: 500, fontStyle: 'italic', textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                                            {amountToWords(previewPurchase?.grand_total || 0)}
                                        </div>
                                    </div>
                                    <div className="box-content" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flex: 1, minHeight: '100px' }}>
                                        <div style={{ textAlign: 'center', width: '45%' }}>
                                            <div style={{ height: '40px', borderBottom: '1px dashed #cbd5e1', marginBottom: '8px' }}></div>
                                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Prepared By</span>
                                        </div>
                                        <div style={{ textAlign: 'center', width: '45%' }}>
                                            <div style={{ height: '40px', borderBottom: '1px dashed #cbd5e1', marginBottom: '8px' }}></div>
                                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Authorized Signatory</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="summary-totals-box" style={{ background: '#f8fafc' }}>
                                    <div className="summary-row">
                                        <span>Subtotal</span>
                                        <span>:</span>
                                        <strong className="text-right">₹{subtotal.toFixed(2)}</strong>
                                    </div>
                                    {discountTotal > 0 && (
                                        <div className="summary-row" style={{ color: 'var(--danger)' }}>
                                            <span>Discount Total</span>
                                            <span>:</span>
                                            <strong className="text-right">-₹{discountTotal.toFixed(2)}</strong>
                                        </div>
                                    )}
                                    {gstTotal > 0 && (
                                        <div className="summary-row">
                                            <span>GST Total</span>
                                            <span>:</span>
                                            <strong className="text-right">+₹{gstTotal.toFixed(2)}</strong>
                                        </div>
                                    )}
                                    <div className="invoice-totals-divider" />
                                    <div className="summary-row" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)', marginTop: '8px' }}>
                                        <span>Grand Total</span>
                                        <span>:</span>
                                        <strong className="text-right">₹{previewPurchase?.grand_total?.toFixed(2)}</strong>
                                    </div>
                                    <div className="summary-row" style={{ color: 'var(--success)' }}>
                                        <span>Paid Amount</span>
                                        <span>:</span>
                                        <strong className="text-right">₹{previewPurchase?.paid_amount?.toFixed(2)}</strong>
                                    </div>
                                    <div className="summary-row" style={{ color: 'var(--danger)', borderTop: '1px solid #cbd5e1', paddingTop: '6px', marginTop: '6px' }}>
                                        <span>Balance Due</span>
                                        <span>:</span>
                                        <strong className="text-right">₹{previewPurchase?.due_amount?.toFixed(2)}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            <Modal
                open={showSupplierModal}
                onClose={() => setShowSupplierModal(false)}
                heading={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
                primaryAction={
                    <SButton variant="primary" onClick={handleSaveSupplier}>
                        <Icons.Save size={18} />
                        Save Supplier
                    </SButton>
                }
                secondaryAction={
                    <SButton onClick={() => setShowSupplierModal(false)}>Cancel</SButton>
                }
            >
                <form onSubmit={handleSaveSupplier} className="flex-column gap-16">
                    <div className="form-grid">
                        <FormGroup label="Name *">
                            <Input required value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} placeholder="Enter supplier name" />
                        </FormGroup>
                        <FormGroup label="Phone">
                            <Input value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} placeholder="Phone number" />
                        </FormGroup>
                        <FormGroup label="GSTIN">
                            <Input value={supplierForm.gstin} onChange={e => setSupplierForm({ ...supplierForm, gstin: e.target.value })} placeholder="GST number" />
                        </FormGroup>
                        <FormGroup label="Opening Balance">
                            <Input type="number" value={supplierForm.opening_balance} onChange={e => setSupplierForm({ ...supplierForm, opening_balance: parseFloat(e.target.value) })} placeholder="0" suffix="₹" />
                        </FormGroup>
                    </div>
                    <FormGroup label="Address">
                        <textarea className="form-control" value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} placeholder="Full address..." rows="2" />
                    </FormGroup>
                    <FormGroup label="Notes">
                        <textarea className="form-control" value={supplierForm.notes} onChange={e => setSupplierForm({ ...supplierForm, notes: e.target.value })} placeholder="Internal notes..." rows="2" />
                    </FormGroup>
                </form>
            </Modal>

            <Modal
                open={showProductModal}
                onClose={() => setShowProductModal(false)}
                heading="Quick Add Product"
                primaryAction={
                    <SButton variant="primary" onClick={handleInlineProductCreate}>Confirm & Add</SButton>
                }
                secondaryAction={
                    <SButton onClick={() => setShowProductModal(false)}>Cancel</SButton>
                }
            >
                <div className="form-grid mb-24">
                    <FormGroup label="Name">
                        <Input value={newProductForm.name} onChange={e => setNewProductForm({ ...newProductForm, name: e.target.value })} />
                    </FormGroup>
                    <FormGroup label="Category">
                        <CustomSelect
                            value={newProductForm.category}
                            onChange={val => setNewProductForm({ ...newProductForm, category: val })}
                            options={categories.map(c => ({ value: c, label: c }))}
                        />
                    </FormGroup>
                    <FormGroup label="Purchase Price">
                        <Input type="number" value={newProductForm.purchase_price} onChange={e => setNewProductForm({ ...newProductForm, purchase_price: parseFloat(e.target.value) })} suffix="₹" />
                    </FormGroup>
                    <FormGroup label="Selling Price">
                        <Input type="number" value={newProductForm.selling_price} onChange={e => setNewProductForm({ ...newProductForm, selling_price: parseFloat(e.target.value) })} suffix="₹" />
                    </FormGroup>
                    <FormGroup label="Unit">
                        <Input value={newProductForm.unit} onChange={e => setNewProductForm({ ...newProductForm, unit: e.target.value })} placeholder="PCS, KG..." />
                    </FormGroup>
                    <FormGroup label="Item Code">
                        <Input value={newProductForm.product_code} onChange={e => setNewProductForm({ ...newProductForm, product_code: e.target.value })} placeholder="SKU001" />
                    </FormGroup>
                </div>
            </Modal>

            <Modal
                open={!!deleteSupplier}
                onClose={() => setDeleteSupplier(null)}
                heading="Delete Supplier"
                variant="critical"
                size="small"
                primaryAction={
                    <SButton variant="primary" tone="critical"
                        onClick={() => {
                            const promise = api.deleteSupplier(deleteSupplier.id);
                            toast.promise(promise, {
                                loading: `Deleting supplier "${deleteSupplier.name}"...`,
                                success: () => {
                                    setDeleteSupplier(null);
                                    loadData();
                                    return 'Supplier deleted successfully';
                                },
                                error: (err) => err.message || 'Cannot delete this supplier.'
                            });
                        }}>
                        <Icons.Trash2 size={16} />
                        Delete Supplier
                    </SButton>
                }
                secondaryAction={
                    <SButton onClick={() => setDeleteSupplier(null)}>Cancel</SButton>
                }
            >
                <div className="flex align-start gap-16 mb-24">
                    <div className="alert-icon-wrapper color-danger">
                        <Icons.AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="fw-600 size-16 m-0">
                            Delete <span className="color-danger">{deleteSupplier?.name}</span>?
                        </p>
                        <p className="text-secondary size-14 mt-4">
                            This action is permanent and cannot be undone. Suppliers with existing purchase records cannot be deleted.
                        </p>
                    </div>
                </div>
            </Modal>

            <Modal
                open={showSerialModal}
                onClose={() => setShowSerialModal(false)}
                heading={`Enter Serial / IMEI Numbers for ${currentCartIndex !== null ? cart[currentCartIndex]?.product_name : ''}`}
                primaryAction={
                    <SButton variant="primary" onClick={saveSerials}>Save Serials</SButton>
                }
                secondaryAction={
                    <SButton onClick={() => setShowSerialModal(false)}>Cancel</SButton>
                }
            >
                <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginBottom: 12 }}>
                        Please enter unique serial or IMEI numbers for this product. Enter each serial number on a new line or separate them with commas.
                    </p>
                    {currentCartIndex !== null && (
                        <div style={{ padding: '8px 12px', background: 'rgba(0, 113, 227, 0.05)', color: 'var(--accent)', borderRadius: '6px', fontSize: '0.9em', fontWeight: 600, marginBottom: 16 }}>
                            Required: {cart[currentCartIndex]?.quantity} serials | Entered: {serialInputText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).length}
                        </div>
                    )}
                    <FormGroup label="Serial Numbers / IMEI">
                        <textarea
                            className="form-control"
                            rows={8}
                            value={serialInputText}
                            onChange={(e) => setSerialInputText(e.target.value)}
                            placeholder="e.g.&#10;SN987654321&#10;SN987654322&#10;SN987654323"
                            style={{ 
                                fontFamily: 'monospace', 
                                fontSize: '1.1em', 
                                width: '100%', 
                                border: '1px solid var(--border)', 
                                borderRadius: '8px', 
                                padding: '10px', 
                                background: 'var(--bg-main)', 
                                color: 'var(--text-primary)' 
                            }}
                        />
                    </FormGroup>
                </div>
            </Modal>
        </div>
    );
}
