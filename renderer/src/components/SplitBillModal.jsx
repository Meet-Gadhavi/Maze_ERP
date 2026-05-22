import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import SButton from './SButton';
import { Icons } from './Icons';
import { toast } from 'sonner';

export default function SplitBillModal({ isOpen, onClose, cart, total, onConfirm }) {
    const [splitType, setSplitType] = useState('equal'); // 'equal', 'item', 'payment'

    // Equal Split State
    const [numShares, setNumShares] = useState(2);
    const [shareMethods, setShareMethods] = useState([]); // Array of methods: ['Cash', 'UPI', ...]

    // Item Split State
    const [buyers, setBuyers] = useState([
        { id: 1, name: 'Customer A', method: 'Cash' },
        { id: 2, name: 'Customer B', method: 'UPI' }
    ]);
    const [assignments, setAssignments] = useState({}); // { [productId]: { [buyerId]: qty } }

    // Payment Split State
    const [paymentSplit, setPaymentSplit] = useState({
        Cash: 0,
        UPI: 0,
        Card: 0
    });

    // Initialize/sync equal split shares and methods
    useEffect(() => {
        const n = Math.max(2, parseInt(numShares) || 2);
        setShareMethods(prev => {
            const next = [...prev];
            while (next.length < n) next.push('Cash');
            if (next.length > n) next.splice(n);
            return next;
        });
    }, [numShares]);

    // Initialize assignments on open or cart change
    useEffect(() => {
        if (!isOpen) return;
        const initial = {};
        cart.forEach(item => {
            initial[item.product_id] = {};
            // Assign everything to the first buyer initially
            if (buyers.length > 0) {
                initial[item.product_id][buyers[0].id] = item.quantity;
            }
        });
        setAssignments(initial);
    }, [isOpen, cart, buyers.length]);

    // Split Calculations
    const getEqualShares = () => {
        const n = Math.max(2, parseInt(numShares) || 2);
        const base = Math.floor((total / n) * 100) / 100;
        const shares = Array(n).fill(base);
        const sum = shares.reduce((a, b) => a + b, 0);
        const diff = Math.round((total - sum) * 100) / 100;
        if (diff !== 0 && shares.length > 0) {
            shares[shares.length - 1] = Math.round((shares[shares.length - 1] + diff) * 100) / 100;
        }
        return shares;
    };

    const getBuyerSubtotal = (buyerId) => {
        let subtotal = 0;
        cart.forEach(item => {
            const qty = assignments[item.product_id]?.[buyerId] || 0;
            subtotal += qty * item.price;
        });
        return Math.round(subtotal * 100) / 100;
    };

    // Handlers
    const handleAddBuyer = () => {
        if (buyers.length >= 8) {
            toast.error("Maximum 8 buyers supported");
            return;
        }
        const nextId = buyers.length > 0 ? Math.max(...buyers.map(b => b.id)) + 1 : 1;
        const letter = String.fromCharCode(65 + buyers.length); // A, B, C, D...
        setBuyers([...buyers, { id: nextId, name: `Customer ${letter}`, method: 'Cash' }]);
    };

    const handleRemoveBuyer = (id) => {
        if (buyers.length <= 2) {
            toast.error("At least 2 buyers required for split");
            return;
        }
        setBuyers(buyers.filter(b => b.id !== id));
        // Reset assignments: reassignment logic is handled by useEffect sync on length changes
    };

    const changeAssignment = (productId, buyerId, delta) => {
        const item = cart.find(i => i.product_id === productId);
        if (!item) return;

        const currentAssigned = assignments[productId] || {};
        const assignedSum = Object.values(currentAssigned).reduce((a, b) => a + b, 0);

        const currentVal = currentAssigned[buyerId] || 0;
        let newVal = currentVal + delta;

        if (newVal < 0) newVal = 0;
        if (delta > 0 && assignedSum >= item.quantity) {
            toast.error(`All ${item.quantity} units of this item are already assigned.`);
            return;
        }

        setAssignments(prev => ({
            ...prev,
            [productId]: {
                ...(prev[productId] || {}),
                [buyerId]: newVal
            }
        }));
    };

    const handleConfirm = () => {
        let paymentsList = [];

        if (splitType === 'equal') {
            const shares = getEqualShares();
            shares.forEach((amt, idx) => {
                const method = shareMethods[idx] || 'Cash';
                if (amt > 0) {
                    paymentsList.push({ method, amount: amt, transaction_id: '' });
                }
            });
        } else if (splitType === 'item') {
            // Verify all items are fully assigned
            for (const item of cart) {
                const assigned = assignments[item.product_id] || {};
                const sum = Object.values(assigned).reduce((a, b) => a + b, 0);
                if (sum !== item.quantity) {
                    toast.error(`Please allocate all quantities of "${item.name}" (Assigned: ${sum}/${item.quantity})`);
                    return;
                }
            }

            // Collect buyer totals
            buyers.forEach(b => {
                const sub = getBuyerSubtotal(b.id);
                if (sub > 0) {
                    paymentsList.push({ method: b.method, amount: sub, transaction_id: '' });
                }
            });
        } else if (splitType === 'payment') {
            const { Cash, UPI, Card } = paymentSplit;
            const sum = Number(Cash || 0) + Number(UPI || 0) + Number(Card || 0);
            if (Math.abs(sum - total) > 0.02) {
                toast.error(`Split payments total (₹${sum.toFixed(2)}) must equal bill total (₹${total.toFixed(2)}).`);
                return;
            }

            if (Number(Cash) > 0) paymentsList.push({ method: 'Cash', amount: Number(Cash), transaction_id: '' });
            if (Number(UPI) > 0) paymentsList.push({ method: 'UPI', amount: Number(UPI), transaction_id: '' });
            if (Number(Card) > 0) paymentsList.push({ method: 'Card', amount: Number(Card), transaction_id: '' });
        }

        // Aggregate by method so we pass simplified payment modes to API
        const aggregated = {};
        paymentsList.forEach(p => {
            if (!aggregated[p.method]) {
                aggregated[p.method] = 0;
            }
            aggregated[p.method] += p.amount;
        });

        const finalPayments = Object.entries(aggregated).map(([method, amount]) => ({
            method,
            amount: Math.round(amount * 100) / 100,
            transaction_id: ''
        }));

        onConfirm(finalPayments);
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            heading="Split Bill Checkout"
            size="large"
            primaryAction={
                <SButton variant="primary" onClick={handleConfirm}>
                    Confirm & Complete Checkout
                </SButton>
            }
            secondaryActions={
                <SButton onClick={onClose}>Cancel</SButton>
            }
        >
            <div className="split-bill-modal-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                    <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
                        Total Bill: <strong style={{ color: 'var(--text-primary)', fontSize: '18px' }}>₹{total.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            className={`crm-tab-btn ${splitType === 'equal' ? 'active' : ''}`}
                            onClick={() => setSplitType('equal')}
                            style={{ padding: '6px 12px', fontSize: '13px' }}
                        >
                            🟢 Equal Split
                        </button>
                        <button 
                            className={`crm-tab-btn ${splitType === 'item' ? 'active' : ''}`}
                            onClick={() => setSplitType('item')}
                            style={{ padding: '6px 12px', fontSize: '13px' }}
                        >
                            🔵 Item Split
                        </button>
                        <button 
                            className={`crm-tab-btn ${splitType === 'payment' ? 'active' : ''}`}
                            onClick={() => setSplitType('payment')}
                            style={{ padding: '6px 12px', fontSize: '13px' }}
                        >
                            🟣 Payment Split
                        </button>
                    </div>
                </div>

                {/* EQUAL SPLIT VIEW */}
                {splitType === 'equal' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontWeight: 600 }}>Number of People:</span>
                            <input 
                                type="number" 
                                min={2} 
                                max={50} 
                                value={numShares} 
                                onChange={e => setNumShares(Math.max(2, parseInt(e.target.value) || 2))}
                                className="form-control"
                                style={{ width: '80px', padding: '6px 10px' }}
                            />
                        </div>

                        <div className="equal-shares-list" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxHeight: '300px', overflowY: 'auto', padding: '4px' }}>
                            {getEqualShares().map((amt, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', gap: '10px' }}>
                                    <span style={{ fontWeight: 600, flexGrow: 1 }}>Person {idx + 1}: ₹{amt.toFixed(2)}</span>
                                    <select 
                                        value={shareMethods[idx] || 'Cash'}
                                        onChange={e => {
                                            const updated = [...shareMethods];
                                            updated[idx] = e.target.value;
                                            setShareMethods(updated);
                                        }}
                                        className="form-control"
                                        style={{ width: '90px', padding: '4px 6px', height: '32px' }}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Card">Card</option>
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ITEM SPLIT VIEW */}
                {splitType === 'item' && (
                    <div style={{ display: 'flex', gap: '20px', height: '360px' }}>
                        {/* Left Side: Items & Allocations */}
                        <div style={{ flex: '1 1 55%', overflowY: 'auto', borderRight: '1px solid var(--border-light)', paddingRight: '16px' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Allocate Items</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {cart.map(item => {
                                    const currentAssigned = assignments[item.product_id] || {};
                                    const sum = Object.values(currentAssigned).reduce((a, b) => a + b, 0);
                                    return (
                                        <div key={item.product_id} style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ fontWeight: 600 }}>{item.name}</span>
                                                <span style={{ fontSize: '12px', color: sum === item.quantity ? 'var(--success)' : 'var(--danger)' }}>
                                                    Allocated: {sum}/{item.quantity}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {buyers.map(b => {
                                                    const val = currentAssigned[b.id] || 0;
                                                    return (
                                                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '2px 6px' }}>
                                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{b.name}:</span>
                                                            <button 
                                                                onClick={() => changeAssignment(item.product_id, b.id, -1)}
                                                                style={{ padding: '2px 6px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                                                            >
                                                                -
                                                            </button>
                                                            <span style={{ fontSize: '12px', fontWeight: 600 }}>{val}</span>
                                                            <button 
                                                                onClick={() => changeAssignment(item.product_id, b.id, 1)}
                                                                style={{ padding: '2px 6px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Side: Buyer list & subtotals */}
                        <div style={{ flex: '1 1 45%', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Customer Summary</h4>
                                <SButton variant="secondary" size="slim" onClick={handleAddBuyer}>
                                    <Icons.Plus size={14} /> Add Cust
                                </SButton>
                            </div>
                            <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                                {buyers.map((b, idx) => {
                                    const sub = getBuyerSubtotal(b.id);
                                    return (
                                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                                            <input 
                                                type="text" 
                                                value={b.name} 
                                                onChange={e => {
                                                    const updated = [...buyers];
                                                    updated[idx].name = e.target.value;
                                                    setBuyers(updated);
                                                }}
                                                className="form-control"
                                                style={{ width: '90px', padding: '4px 6px', height: '28px', fontSize: '12px' }}
                                            />
                                            <span style={{ fontWeight: 600, flexGrow: 1, fontSize: '13px', textAlign: 'right' }}>
                                                ₹{sub.toFixed(2)}
                                            </span>
                                            <select 
                                                value={b.method}
                                                onChange={e => {
                                                    const updated = [...buyers];
                                                    updated[idx].method = e.target.value;
                                                    setBuyers(updated);
                                                }}
                                                className="form-control"
                                                style={{ width: '80px', padding: '2px 4px', height: '28px', fontSize: '12px' }}
                                            >
                                                <option value="Cash">Cash</option>
                                                <option value="UPI">UPI</option>
                                                <option value="Card">Card</option>
                                            </select>
                                            <button 
                                                onClick={() => handleRemoveBuyer(b.id)}
                                                style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                                                title="Delete Customer"
                                            >
                                                <Icons.X size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* PAYMENT SPLIT VIEW */}
                {splitType === 'payment' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px', margin: '0 auto', padding: '20px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: '16px' }}>
                            <span style={{ fontWeight: 600, width: '80px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Icons.Banknote size={16} /> Cash:
                            </span>
                            <input 
                                type="number" 
                                min={0} 
                                value={paymentSplit.Cash || ''} 
                                placeholder="0.00"
                                onChange={e => setPaymentSplit({ ...paymentSplit, Cash: parseFloat(e.target.value) || 0 })}
                                className="form-control"
                                style={{ flexGrow: 1, padding: '8px 12px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: '16px' }}>
                            <span style={{ fontWeight: 600, width: '80px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Icons.Smartphone size={16} /> UPI:
                            </span>
                            <input 
                                type="number" 
                                min={0} 
                                value={paymentSplit.UPI || ''} 
                                placeholder="0.00"
                                onChange={e => setPaymentSplit({ ...paymentSplit, UPI: parseFloat(e.target.value) || 0 })}
                                className="form-control"
                                style={{ flexGrow: 1, padding: '8px 12px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: '16px' }}>
                            <span style={{ fontWeight: 600, width: '80px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Icons.CreditCard size={16} /> Card:
                            </span>
                            <input 
                                type="number" 
                                min={0} 
                                value={paymentSplit.Card || ''} 
                                placeholder="0.00"
                                onChange={e => setPaymentSplit({ ...paymentSplit, Card: parseFloat(e.target.value) || 0 })}
                                className="form-control"
                                style={{ flexGrow: 1, padding: '8px 12px' }}
                            />
                        </div>

                        {(() => {
                            const sum = Number(paymentSplit.Cash || 0) + Number(paymentSplit.UPI || 0) + Number(paymentSplit.Card || 0);
                            const remaining = total - sum;
                            const isMatched = Math.abs(remaining) < 0.02;
                            return (
                                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', marginTop: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Entered: <strong>₹{sum.toFixed(2)}</strong></span>
                                    <span style={{ color: isMatched ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                                        {isMatched ? 'Matched! ✅' : `Remaining: ₹${remaining.toFixed(2)}`}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </Modal>
    );
}
