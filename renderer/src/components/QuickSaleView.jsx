import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Icons } from './Icons';
import SButton from './SButton';
import CustomSelect from './CustomSelect';
import SplitBillModal from './SplitBillModal';
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
    const [groupBy, setGroupBy] = useState('none'); // 'none', 'subcategory', 'brand'
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [discountValue, setDiscountValue] = useState('');
    const [discountType, setDiscountType] = useState('%'); // '%' or '₹'
    
    const searchInputRef = useRef(null);
    const gridRef = useRef(null);
    const holdTimeoutRef = useRef(null);
    const holdIntervalRef = useRef(null);

    // Keep a ref to the latest addToCart to avoid stale closures during continuous additions
    const addToCartRef = useRef(addToCart);
    useEffect(() => {
        addToCartRef.current = addToCart;
    }, [addToCart]);

    // Auto-focus search input to be ready for barcode scanner
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    // Clean up timers on unmount
    useEffect(() => {
        return () => {
            if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
            if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        };
    }, []);

    // Continuous Click-and-Hold Addition Handler
    const startContinuousAdd = (product, e) => {
        if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);

        holdTimeoutRef.current = setTimeout(() => {
            holdIntervalRef.current = setInterval(() => {
                addToCartRef.current(product);
            }, 120); // repeat additions every 120ms
        }, 400); // start repeating if held >400ms
    };

    const stopContinuousAdd = () => {
        if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
        }
        if (holdIntervalRef.current) {
            clearInterval(holdIntervalRef.current);
            holdIntervalRef.current = null;
        }
    };

    // Helper to add multiple products (used for category, subcategory, brand adds)
    const addAllProductsInGroup = (productList) => {
        const availableProducts = productList;
        if (availableProducts.length === 0) {
            toast.error("No products to add");
            return;
        }

        const newCart = [...cart];
        availableProducts.forEach(p => {
            const index = newCart.findIndex(item => item.product_id === p.id && !item.is_free && !item.variant_id);
            if (index >= 0) {
                const newQty = newCart[index].quantity + 1;
                if (settings.flexible_inventory !== 'true' && newQty > p.stock_quantity) {
                    newCart[index].quantity = Math.max(0, p.stock_quantity);
                    newCart[index].total = Math.max(0, p.stock_quantity) * newCart[index].price;
                } else {
                    newCart[index].quantity = newQty;
                    newCart[index].total = newQty * newCart[index].price;
                }
            } else {
                if (settings.flexible_inventory !== 'true' && p.stock_quantity <= 0) {
                    return;
                }
                newCart.push({
                    product_id: p.id,
                    name: p.name,
                    price: Number(p.selling_price || 0),
                    quantity: 1,
                    total: Number(p.selling_price || 0),
                    stock_quantity: p.stock_quantity,
                    unit: p.unit || 'PCS'
                });
            }
        });
        setCart(newCart);
        toast.success(`Added ${availableProducts.length} items to cart`);
    };

    // Extract unique categories from products
    const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

    // Filter products based on selected category and search term
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

            const isInputFocused = document.activeElement === searchInputRef.current;
            
            if (e.key === 'ArrowRight') {
                setFocusedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
                if (isInputFocused) e.preventDefault();
            } else if (e.key === 'ArrowLeft') {
                setFocusedIndex(prev => Math.max(prev - 1, 0));
                if (isInputFocused) e.preventDefault();
            } else if (e.key === 'ArrowDown') {
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

    // Compute discount and final total
    const discountAmount = (() => {
        const val = parseFloat(discountValue) || 0;
        if (discountType === '%') {
            return Math.min(cartTotal, (cartTotal * val) / 100);
        }
        return Math.min(cartTotal, val);
    })();
    const finalTotal = Math.max(0, cartTotal - discountAmount);

    const updateCartQty = (index, delta) => {
        const newCart = [...cart];
        const item = newCart[index];
        const newQty = item.quantity + delta;
        if (newQty <= 0) {
            newCart.splice(index, 1);
        } else {
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

        const mockEvent = { preventDefault: () => {} };
        await handleCreateInvoice(mockEvent, {
            isQuickSale: true,
            walkInName: 'Quick Sale',
            discount: discountAmount,
            paymentsOverride: [{ method, amount: finalTotal, transaction_id: '' }]
        });
    };

    const handleConfirmSplitBill = async (paymentsList) => {
        setShowSplitModal(false);
        const mockEvent = { preventDefault: () => {} };
        await handleCreateInvoice(mockEvent, {
            isQuickSale: true,
            walkInName: 'Quick Sale Split',
            discount: discountAmount,
            paymentsOverride: paymentsList
        });
    };

    // Grouping calculations
    const getGroupedProducts = () => {
        if (groupBy === 'none') return null;

        const groups = {};
        filteredProducts.forEach(p => {
            const key = groupBy === 'subcategory' 
                ? (p.subcategory_name || 'Uncategorized')
                : (p.brand_name || 'Generic');
            
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(p);
        });
        return groups;
    };

    const groupedData = getGroupedProducts();

    return (
        <div className="quick-sale-container">
            {/* ─── Top: Cart + Catalog side by side ─── */}
            <div className="quick-sale-main">
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
            </div>{/* end quick-sale-left */}

            <div className="quick-sale-right">
                <div className="quick-sale-categories">
                    {categories.map(cat => {
                        const allProductsInCat = products.filter(p => p.category === cat);
                        return (
                            <SButton 
                                key={cat}
                                variant={selectedCategory === cat ? 'primary' : 'secondary'}
                                size="slim"
                                onClick={() => setSelectedCategory(cat)}
                                onDoubleClick={() => {
                                    const productsToUse = cat === 'All' ? products : allProductsInCat;
                                    addAllProductsInGroup(productsToUse);
                                }}
                                className="cat-btn"
                                title={cat === 'All' ? "Double-click to add all products" : `Double-click to add all ${cat} products`}
                            >
                                {cat}
                            </SButton>
                        );
                    })}
                </div>

                <div className="quick-sale-grid-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-secondary)' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Showing {filteredProducts.length} Products
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Group by:</span>
                        <CustomSelect 
                            value={groupBy} 
                            onChange={setGroupBy}
                            options={[
                                { value: 'none', label: 'No Grouping' },
                                { value: 'subcategory', label: 'Subcategory' },
                                { value: 'brand', label: 'Brand' }
                            ]}
                            className="groupBy-select"
                        />
                    </div>
                </div>
                
                <div className="quick-sale-grid-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                    {groupBy === 'none' ? (
                        <div className="quick-sale-grid" ref={gridRef}>
                            {filteredProducts.map((p, index) => (
                                <div 
                                    key={p.id} 
                                    className={`product-tile ${focusedIndex === index ? 'focused' : ''}`}
                                    style={focusedIndex === index ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent-light)' } : {}}
                                    onMouseDown={(e) => {
                                        if (e.button !== 0) return;
                                        addToCartRef.current(p);
                                        startContinuousAdd(p, e);
                                    }}
                                    onMouseUp={stopContinuousAdd}
                                    onMouseLeave={stopContinuousAdd}
                                    onTouchStart={(e) => {
                                        addToCartRef.current(p);
                                        startContinuousAdd(p, e);
                                    }}
                                    onTouchEnd={stopContinuousAdd}
                                    onTouchCancel={stopContinuousAdd}
                                    onClick={(e) => {
                                        if (e.detail === 0) addToCartRef.current(p); // keyboard trigger
                                    }}
                                >
                                    <div className="tile-content">
                                        <div className="product-metadata" style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                            <span>{p.brand_name || 'Generic'}</span>
                                            <span>•</span>
                                            <span>{p.subcategory_name || 'General'}</span>
                                        </div>
                                        <div className="product-icon-wrap" style={{ marginBottom: '6px', color: 'var(--accent)', opacity: 0.8 }}>
                                            <Icons.Package size={24} />
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
                    ) : (
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {Object.entries(groupedData || {}).map(([groupName, items]) => (
                                <div key={groupName} className="group-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <h5
                                        className="subcategory-title"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            color: 'var(--accent)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.03em',
                                            padding: '8px 14px',
                                            background: 'var(--bg-card)',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--border-light)',
                                            marginBottom: '10px',
                                            marginTop: '8px',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            transition: 'all 0.2s ease',
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                        onDoubleClick={() => addAllProductsInGroup(items)}
                                        title={`Double-click to add all products in this ${groupBy === 'subcategory' ? 'subcategory' : 'brand'}`}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'var(--accent-light)';
                                            e.currentTarget.style.transform = 'translateX(2px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'var(--bg-card)';
                                            e.currentTarget.style.transform = 'none';
                                        }}
                                    >
                                        <Icons.ChevronRight size={12} strokeWidth={3} />
                                        {groupBy === 'subcategory' ? 'Subcategory' : 'Brand'}: {groupName}
                                        <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', fontWeight: 'normal', textTransform: 'none', marginLeft: '6px' }}>
                                            (Double-click to add all)
                                        </span>
                                    </h5>
                                    
                                    <div className="quick-sale-grid" style={{ padding: 0 }}>
                                        {items.map((p) => (
                                            <div 
                                                key={p.id} 
                                                className="product-tile"
                                                onMouseDown={(e) => {
                                                    if (e.button !== 0) return;
                                                    addToCartRef.current(p);
                                                    startContinuousAdd(p, e);
                                                }}
                                                onMouseUp={stopContinuousAdd}
                                                onMouseLeave={stopContinuousAdd}
                                                onTouchStart={(e) => {
                                                    addToCartRef.current(p);
                                                    startContinuousAdd(p, e);
                                                }}
                                                onTouchEnd={stopContinuousAdd}
                                                onTouchCancel={stopContinuousAdd}
                                                onClick={(e) => {
                                                    if (e.detail === 0) addToCartRef.current(p);
                                                }}
                                            >
                                                <div className="tile-content">
                                                    <div className="product-metadata" style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                        <span>{p.brand_name || 'Generic'}</span>
                                                        <span>•</span>
                                                        <span>{p.subcategory_name || 'General'}</span>
                                                    </div>
                                                    <div className="product-icon-wrap" style={{ marginBottom: '6px', color: 'var(--accent)', opacity: 0.8 }}>
                                                        <Icons.Package size={24} />
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
                            ))}
                        </div>
                    )}
                </div>
            </div>{/* end quick-sale-right */}
            </div>{/* end quick-sale-main */}

            {/* ─── Standalone Checkout Card (separate from panels above) ─── */}
            <div className="qs-checkout-card">

                {/* Grand Total Row */}
                <div className="qs-grand-total-row">
                    <span className="qs-grand-label">Grand Total</span>
                    <span className="qs-grand-amount">₹{finalTotal.toFixed(2)}</span>
                </div>

                <div className="qs-card-body">

                    {/* Payment Status */}
                    <div className="qs-field-group">
                        <span className="qs-field-label">Payment Status</span>
                        <div className="qs-status-banner">
                            <Icons.CheckCircle size={14} />
                            WALK-IN: ALWAYS PAID
                        </div>
                    </div>

                    {/* Discount */}
                    <div className="qs-field-group">
                        <span className="qs-field-label">Discount</span>
                        <div className="qs-disc-container">
                            <div className="qs-disc-input-wrap">
                                <input
                                    type="number"
                                    min="0"
                                    className="qs-disc-input"
                                    placeholder="0"
                                    value={discountValue}
                                    onChange={e => setDiscountValue(e.target.value)}
                                />
                                <button className={`qs-disc-type ${discountType === '%' ? 'active' : ''}`} onClick={() => setDiscountType('%')}>%</button>
                                <button className={`qs-disc-type ${discountType === '₹' ? 'active' : ''}`} onClick={() => setDiscountType('₹')}>₹</button>
                                {discountValue && (
                                    <button className="qs-disc-clear" onClick={() => setDiscountValue('')}><Icons.X size={13} /></button>
                                )}
                            </div>
                            {discountAmount > 0 && (
                                <span className="qs-disc-saved">saves ₹{discountAmount.toFixed(2)}</span>
                            )}
                        </div>
                    </div>

                    {/* Payments */}
                    <div className="qs-field-group">
                        <span className="qs-field-label">Payments</span>
                        <div className="qs-pay-row">
                            <SButton variant="primary" size="large" className="qs-sbtn" onClick={() => handleQuickPayment('Cash')}>
                                <Icons.Banknote size={17} />
                                <span className="qs-sbtn-text">
                                    <span className="qs-sbtn-label">Cash</span>
                                </span>
                            </SButton>
                            <SButton variant="primary" size="large" className="qs-sbtn" onClick={() => handleQuickPayment('UPI')}>
                                <Icons.Smartphone size={17} />
                                <span className="qs-sbtn-text">
                                    <span className="qs-sbtn-label">UPI</span>
                                </span>
                            </SButton>
                            <SButton variant="primary" size="large" className="qs-sbtn" onClick={() => handleQuickPayment('Card')}>
                                <Icons.CreditCard size={17} />
                                <span className="qs-sbtn-text">
                                    <span className="qs-sbtn-label">Card</span>
                                </span>
                            </SButton>
                            <SButton variant="secondary" size="large" className="qs-sbtn" onClick={() => setShowSplitModal(true)}>
                                <Icons.Layers size={17} />
                                <span className="qs-sbtn-text">
                                    <span className="qs-sbtn-label">Split Bill</span>
                                </span>
                            </SButton>
                            <SButton
                                variant="primary"
                                size="large"
                                className="qs-sbtn qs-invoice-btn"
                                onClick={async () => {
                                    if (cart.length === 0) { toast.error('Cart is empty'); return; }
                                    const mockEvent = { preventDefault: () => {} };
                                    await handleCreateInvoice(mockEvent, {
                                        isQuickSale: true,
                                        walkInName: 'Quick Sale',
                                        discount: discountAmount,
                                        skipAutoPayment: true,
                                    });
                                }}
                            >
                                <Icons.FileText size={17} />
                                <span className="qs-sbtn-text">
                                    <span className="qs-sbtn-label">Create Invoice</span>
                                </span>
                            </SButton>
                        </div>
                    </div>

                </div>
            </div>

            {/* Split Bill Modal */}
            <SplitBillModal
                isOpen={showSplitModal}
                onClose={() => setShowSplitModal(false)}
                cart={cart}
                total={cartTotal}
                onConfirm={handleConfirmSplitBill}
            />
        </div>
    );
}
