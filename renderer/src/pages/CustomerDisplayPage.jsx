import { useState, useEffect } from 'react';
import { Icons } from '../components/Icons';
import './CustomerDisplayPage.css';

export default function CustomerDisplayPage() {
    const [data, setData] = useState({
        cart: [],
        subtotal: 0,
        discount: 0,
        gst: 0,
        total: 0,
        status: 'idle', // idle, active, completed
        customerName: ''
    });

    useEffect(() => {
        if (window.maze && window.maze.onCustomerDisplayUpdate) {
            const unsubscribe = window.maze.onCustomerDisplayUpdate((update) => {
                setData(prev => ({ ...prev, ...update }));
            });
            return unsubscribe;
        }
    }, []);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(val);
    };

    if (data.status === 'completed') {
        return (
            <div className="customer-display-container">
                <div className="thank-you-view">
                    <Icons.CheckCircle className="thank-you-icon" />
                    <h2>Thank You!</h2>
                    <p>Your transaction was successful.</p>
                    <p style={{ marginTop: '20px', color: '#30d158', fontSize: '48px', fontWeight: 'bold' }}>
                        Paid: {formatCurrency(data.total)}
                    </p>
                    <p style={{ marginTop: '40px', fontSize: '20px' }}>Please visit again soon!</p>
                </div>
            </div>
        );
    }

    if (data.status === 'idle' || data.cart.length === 0) {
        return (
            <div className="customer-display-container">
                <div className="welcome-section">
                    <img src="./icons/Appicon.ico" alt="Quantro" className="welcome-logo" style={{ width: '120px', height: '120px', marginBottom: '24px' }} />
                    <h2 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.02em' }}>Quantro POS</h2>
                    <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginTop: '8px' }}>Ready for your next transaction</p>
                </div>
            </div>
        );
    }

    return (
        <div className="customer-display-container">
            <div className="customer-display-header">
                <div className="brand-section" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img src="./icons/Appicon.ico" alt="Quantro" style={{ width: '48px', height: '48px' }} />
                    <h1>Quantro</h1>
                </div>
                {data.status === 'active' && (
                    <div className="status-indicator">
                        <span className="dot pulse"></span>
                        LIVE CHECKOUT
                    </div>
                )}
            </div>

            <div className="active-cart-view quick-interface">
                <div className="cart-items-section">
                    <div className="cart-items-list">
                        {data.cart.map((item, idx) => (
                            <div key={idx} className="display-item compact">
                                <div className="item-main-info">
                                    <h4>{item.name}</h4>
                                    {item.subcategory_name && (
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                            {item.subcategory_name}
                                        </span>
                                    )}
                                    <p>{item.quantity} {item.unit || ''} × {formatCurrency(item.price)}</p>
                                </div>
                                <div className="item-total-price">
                                    {formatCurrency(item.total)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="cart-summary-section">
                    <div className="summary-card primary">
                        <div className="summary-label">TOTAL AMOUNT</div>
                        <div className="total-amount-hero">
                            {formatCurrency(data.total)}
                        </div>
                        
                        <div className="summary-details">
                            <div className="detail-line">
                                <span>Items:</span>
                                <span>{data.cart.length}</span>
                            </div>
                            {data.discount > 0 && (
                                <div className="detail-line savings">
                                    <span>Savings:</span>
                                    <span>-{formatCurrency(data.discount)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="quick-pay-indicator">
                        <Icons.CreditCard size={32} />
                        <span>PROCEEDING TO PAYMENT</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
