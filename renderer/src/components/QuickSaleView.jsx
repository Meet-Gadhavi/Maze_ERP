import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Icons } from './Icons';
import SButton from './SButton';
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
    
    const searchInputRef = useRef(null);
    const gridRef = useRef(null);
    const holdTimeoutRef = useRef(null);
    const holdIntervalRef = useRef(null);

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
                addToCart(product);
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
        const availableProducts = productList.filter(p => p.stock_quantity > 0 || settings.flexible_inventory === 'true');
        if (availableProducts.length === 0) {
            toast.error("No in-stock products to add");
            return;
        }

        const newCart = [...cart];
        availableProducts.forEach(p => {
            const index = newCart.findIndex(item => item.product_id === p.id && !item.is_free && !item.variant_id);
            if (index >= 0) {
                const newQty = newCart[index].quantity + 1;
                if (settings.flexible_inventory !== 'true' && newQty > p.stock_quantity) {
                    newCart[index].quantity = p.stock_quantity;
                    newCart[index].total = p.stock_quantity * newCart[index].price;
                } else {
                    newCart[index].quantity = newQty;
                    newCart[index].total = newQty * newCart[index].price;
                }
            } else {
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
            paymentsOverride: [{ method, amount: cartTotal, transaction_id: '' }]
        });
    };

    const handleConfirmSplitBill = async (paymentsList) => {
        setShowSplitModal(false);
        const mockEvent = { preventDefault: () => {} };
        await handleCreateInvoice(mockEvent, {
            isQuickSale: true,
            walkInName: 'Quick Sale Split',
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

                <div className="quick-sale-summary">
                    <div className="summary-row total-row">
                        <span>Total Amount</span>
                        <span>₹{cartTotal.toFixed(2)}</span>
                    </div>
                </div>

                <div className="quick-sale-payments">
                    <SButton variant="secondary" className="pay-btn cash" onClick={() => handleQuickPayment('Cash')}>
                        <Icons.Banknote size={20} />
                        Cash (F4)
                    </SButton>
                    <SButton variant="secondary" className="pay-btn upi" onClick={() => handleQuickPayment('UPI')}>
                        <Icons.Smartphone size={20} />
                        UPI
                    </SButton>
                    <SButton variant="secondary" className="pay-btn card" onClick={() => handleQuickPayment('Card')}>
                        <Icons.CreditCard size={20} />
                        Card
                    </SButton>
                    <SButton variant="secondary" className="pay-btn split" onClick={() => setShowSplitModal(true)}>
                        <Icons.Layers size={20} />
                        Split Bill
                    </SButton>
                </div>
            </div>

            <div className="quick-sale-right">
                <div className="quick-sale-categories">
                    {categories.map(cat => {
                        const allProductsInCat = products.filter(p => p.category === cat);
                        return (
                            <div key={cat} style={{ display: 'flex', alignItems: 'center', background: selectedCategory === cat ? 'var(--accent-light)' : 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '20px', padding: '2px 8px 2px 2px', gap: '4px' }}>
                                <SButton 
                                    variant={selectedCategory === cat ? 'primary' : 'secondary'}
                                    size="slim"
                                    onClick={() => setSelectedCategory(cat)}
                                    className="cat-btn"
                                    style={{ border: 'none', background: 'none', color: selectedCategory === cat ? 'white' : 'var(--text-primary)' }}
                                >
                                    {cat}
                                </SButton>
                                {cat !== 'All' && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            addAllProductsInGroup(allProductsInCat);
                                        }}
                                        title={`Add all ${cat} products to cart`}
                                        style={{ border: 'none', background: 'rgba(0,0,0,0.05)', cursor: 'pointer', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="quick-sale-grid-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-secondary)' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Showing {filteredProducts.length} Products
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Group by:</span>
                        <select 
                            value={groupBy} 
                            onChange={e => setGroupBy(e.target.value)}
                            className="form-control"
                            style={{ padding: '4px 8px', fontSize: '12px', height: '28px', width: '130px', background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', borderRadius: '6px' }}
                        >
                            <option value="none">No Grouping</option>
                            <option value="subcategory">Subcategory</option>
                            <option value="brand">Brand</option>
                        </select>
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
                                        addToCart(p);
                                        startContinuousAdd(p, e);
                                    }}
                                    onMouseUp={stopContinuousAdd}
                                    onMouseLeave={stopContinuousAdd}
                                    onTouchStart={(e) => {
                                        addToCart(p);
                                        startContinuousAdd(p, e);
                                    }}
                                    onTouchEnd={stopContinuousAdd}
                                    onTouchCancel={stopContinuousAdd}
                                    onClick={(e) => {
                                        if (e.detail === 0) addToCart(p); // keyboard trigger
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {groupBy === 'subcategory' ? 'Subcategory' : 'Brand'}: {groupName}
                                        </h4>
                                        <SButton 
                                            variant="secondary" 
                                            size="slim" 
                                            onClick={() => addAllProductsInGroup(items)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '2px 8px' }}
                                        >
                                            <Icons.Plus size={12} /> Add All ({items.length})
                                        </SButton>
                                    </div>
                                    
                                    <div className="quick-sale-grid" style={{ padding: 0 }}>
                                        {items.map((p) => (
                                            <div 
                                                key={p.id} 
                                                className="product-tile"
                                                onMouseDown={(e) => {
                                                    if (e.button !== 0) return;
                                                    addToCart(p);
                                                    startContinuousAdd(p, e);
                                                }}
                                                onMouseUp={stopContinuousAdd}
                                                onMouseLeave={stopContinuousAdd}
                                                onTouchStart={(e) => {
                                                    addToCart(p);
                                                    startContinuousAdd(p, e);
                                                }}
                                                onTouchEnd={stopContinuousAdd}
                                                onTouchCancel={stopContinuousAdd}
                                                onClick={(e) => {
                                                    if (e.detail === 0) addToCart(p);
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
            </div>

            {/* Split Bill Checkout Modal */}
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
