import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Icons } from './Icons';
import SButton from './SButton';
import './QuickSaleView.css';

export default function QuickSaleView({ 
    products, 
    cart, 
    setCart, 
    addToCart, 
    handleCreateInvoice, 
    settings 
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const searchInputRef = useRef(null);
    const gridRef = useRef(null);

    // Auto-focus search input to be ready for barcode scanner
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    // Extract unique categories from products
    const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

    const filteredProducts = products.filter(p => {
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (p.product_code && p.product_code.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    // Reset focus when filters change
    useEffect(() => {
        setFocusedIndex(-1);
    }, [searchTerm, selectedCategory]);

    // Keyboard Navigation Logic
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (filteredProducts.length === 0) return;

            // Don't interfere if user is typing a lot, but allow navigation
            const isInputFocused = document.activeElement === searchInputRef.current;
            
            if (e.key === 'ArrowRight') {
                setFocusedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
                if (isInputFocused) e.preventDefault();
            } else if (e.key === 'ArrowLeft') {
                setFocusedIndex(prev => Math.max(prev - 1, 0));
                if (isInputFocused) e.preventDefault();
            } else if (e.key === 'ArrowDown') {
                // Approximate columns (grid is 140px min)
                const cols = gridRef.current ? Math.floor(gridRef.current.offsetWidth / 150) : 4;
                setFocusedIndex(prev => Math.min(prev + cols, filteredProducts.length - 1));
                e.preventDefault();
            } else if (e.key === 'ArrowUp') {
                const cols = gridRef.current ? Math.floor(gridRef.current.offsetWidth / 150) : 4;
                setFocusedIndex(prev => Math.max(prev - cols, 0));
                e.preventDefault();
            } else if (e.key === 'Enter') {
                if (focusedIndex >= 0 && focusedIndex < filteredProducts.length) {
                    addToCart(filteredProducts[focusedIndex]);
                    setSearchTerm('');
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredProducts, focusedIndex, addToCart]);

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Removed redundant Customer Display sync to avoid conflicts with SalesPage.jsx sync logic
    // which handles both Standard and Quick Sale interfaces.

    const updateCartQty = (index, delta) => {
        const newCart = [...cart];
        const item = newCart[index];
        const newQty = item.quantity + delta;
        if (newQty <= 0) {
            newCart.splice(index, 1);
        } else {
            // Check stock if not flexible
            if (settings.flexible_inventory !== 'true' && newQty > item.stock_quantity) {
                toast.error(`Only ${item.stock_quantity} available`);
                return;
            }
            newCart[index].quantity = newQty;
            newCart[index].total = newQty * item.price;
        }
        setCart(newCart);
    };

    const handleQuickPayment = async (method) => {
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }

        // Setup the required data for handleCreateInvoice
        // We simulate a walk-in customer for Quick Sale
        const mockEvent = { preventDefault: () => {} };
        
        // Temporarily set payments in the parent (or pass it in the event object if possible, 
        // but handleCreateInvoice relies on state. We'll need to pass override parameters 
        // to handleCreateInvoice if we modify SalesPage.jsx to accept them).
        // Let's assume handleCreateInvoice can take an options object.
        await handleCreateInvoice(mockEvent, {
            isQuickSale: true,
            walkInName: 'Quick Sale',
            paymentsOverride: [{ method, amount: cartTotal, transaction_id: '' }]
        });
    };

    return (
        <div className="quick-sale-container">
            <div className="quick-sale-left">
                <div className="quick-sale-search">
                    <Icons.Search size={20} className="search-icon" />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        placeholder="Scan Barcode or Search Product..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                // If exact match by code, add it
                                const exactMatch = products.find(p => p.product_code === searchTerm);
                                if (exactMatch) {
                                    addToCart(exactMatch);
                                    setSearchTerm('');
                                } else if (filteredProducts.length === 1) {
                                    addToCart(filteredProducts[0]);
                                    setSearchTerm('');
                                }
                            }
                        }}
                    />
                </div>

                <div className="quick-sale-cart">
                    {cart.length === 0 ? (
                        <div className="empty-cart">
                            <Icons.ShoppingCart size={48} />
                            <p>Cart is empty. Scan an item or tap a product.</p>
                        </div>
                    ) : (
                        <div className="cart-items">
                            {cart.map((item, index) => (
                                <div key={index} className="cart-item">
                                    <div className="cart-item-details">
                                        <h4>{item.name}</h4>
                                        <span>₹{item.price.toFixed(2)}</span>
                                    </div>
                                    <div className="cart-item-actions">
                                        <button onClick={() => updateCartQty(index, -1)}><Icons.Minus size={16} /></button>
                                        <span className="qty">{item.quantity}</span>
                                        <button onClick={() => updateCartQty(index, 1)}><Icons.Plus size={16} /></button>
                                        <span className="total">₹{item.total.toFixed(2)}</span>
                                        <button className="remove-btn" onClick={() => {
                                            const newCart = [...cart];
                                            newCart.splice(index, 1);
                                            setCart(newCart);
                                        }}><Icons.X size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="quick-sale-summary">
                    <div className="summary-row total-row">
                        <span>Total Amount</span>
                        <span>₹{cartTotal.toFixed(2)}</span>
                    </div>
                </div>

                <div className="quick-sale-payments">
                    <SButton variant="primary" size="large" className="pay-btn cash" onClick={() => handleQuickPayment('Cash')} style={{ display: 'flex', flexDirection: 'column', height: 'auto', gap: '8px' }}>
                        <Icons.Banknote size={24} />
                        Exact Cash (F4)
                    </SButton>
                    <SButton variant="primary" size="large" className="pay-btn upi" onClick={() => handleQuickPayment('UPI')} style={{ display: 'flex', flexDirection: 'column', height: 'auto', gap: '8px' }}>
                        <Icons.Smartphone size={24} />
                        UPI
                    </SButton>
                    <SButton variant="primary" size="large" className="pay-btn card" onClick={() => handleQuickPayment('Card')} style={{ display: 'flex', flexDirection: 'column', height: 'auto', gap: '8px' }}>
                        <Icons.CreditCard size={24} />
                        Card
                    </SButton>
                </div>
            </div>

            <div className="quick-sale-right">
                <div className="quick-sale-categories">
                    {categories.map(cat => (
                        <SButton 
                            key={cat} 
                            variant={selectedCategory === cat ? 'primary' : 'secondary'}
                            size="slim"
                            onClick={() => setSelectedCategory(cat)}
                            className="cat-btn"
                        >
                            {cat}
                        </SButton>
                    ))}
                </div>
                
                <div className="quick-sale-grid" ref={gridRef}>
                    {filteredProducts.map((p, index) => (
                        <div 
                            key={p.id} 
                            className={`product-tile ${focusedIndex === index ? 'focused' : ''}`} 
                            onClick={() => addToCart(p)}
                            style={focusedIndex === index ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent-light)' } : {}}
                        >
                            <div className="tile-content">
                                <div className="product-icon-wrap" style={{ marginBottom: '10px', color: 'var(--accent)', opacity: 0.8 }}>
                                    <Icons.Package size={28} />
                                </div>
                                <h5>{p.name}</h5>
                                <span className="price">₹{Number(p.selling_price || 0).toFixed(2)}</span>
                                <span className={`stock ${p.stock_quantity <= 0 ? 'out' : ''}`}>
                                    {p.stock_quantity} {p.unit || 'pcs'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
