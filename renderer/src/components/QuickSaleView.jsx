import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Icons } from './Icons';
import SButton from './SButton';
import CustomSelect from './CustomSelect';
import SplitBillModal from './SplitBillModal';
import Modal from './Modal';
import { supabase } from '../supabase';
import api from '../api';
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
    const [showScannerModal, setShowScannerModal] = useState(false);

    const syncId = settings?.online_sync_id;
    const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && import.meta.env.DEV;
    // Always use the production web URL so phone scanners can access the site online
    const webBaseUrl = 'https://quantro-web.onrender.com';
    const scanUrl = syncId ? `${webBaseUrl}/?page=scanner&syncId=${syncId}` : '';

    // Subscribe to wireless mobile scanner events via Supabase Broadcast
    useEffect(() => {
        if (!syncId) return;

        console.log(`[Quick Scanner] Subscribing to broadcast channel scanner:${syncId}`);
        const channel = supabase.channel(`scanner:${syncId}`, {
            config: {
                broadcast: { self: false }
            }
        });

        channel
            .on('broadcast', { event: 'scan' }, (payload) => {
                const barcode = payload?.payload?.barcode;
                console.log('[Quick Scanner] Scanned barcode received:', barcode);
                if (barcode) {
                    const exactMatch = products.find(p => p.product_code === barcode);
                    if (exactMatch) {
                        addToCart(exactMatch);
                        toast.success(`Scanned: ${exactMatch.name} added to cart!`);
                    } else {
                        toast.error(`Scanned barcode "${barcode}" not found in inventory.`);
                    }
                }
            })
            .subscribe((status) => {
                console.log(`[Quick Scanner] Realtime subscription status:`, status);
            });

        return () => {
            channel.unsubscribe();
        };
    }, [syncId, products, addToCart]);
    const [groupBy, setGroupBy] = useState('none'); // 'none', 'subcategory', 'brand'
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [discountValue, setDiscountValue] = useState('');
    const [discountType, setDiscountType] = useState('%'); // '%' or '₹'
    const [viewLayout, setViewLayout] = useState('grid'); // 'grid' or 'list'
    const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [walkInName, setWalkInName] = useState('Walk-in');
    const [walkInPhone, setWalkInPhone] = useState('');
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [loadingCoupon, setLoadingCoupon] = useState(false);
    
    const searchInputRef = useRef(null);
    const gridRef = useRef(null);
    const categoriesRef = useRef(null);
    const holdTimeoutRef = useRef(null);
    const holdIntervalRef = useRef(null);

    // Keep a ref to the latest addToCart to avoid stale closures during continuous additions
    const addToCartRef = useRef(addToCart);
    useEffect(() => {
        addToCartRef.current = addToCart;
    }, [addToCart]);



    // Update categories scroll indicators
    const updateScrollState = () => {
        const el = categoriesRef.current;
        if (el) {
            const canScrollLeft = el.scrollLeft > 2;
            const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 2;
            setScrollState({ canScrollLeft, canScrollRight });
        }
    };

    useEffect(() => {
        const el = categoriesRef.current;
        if (el) {
            el.addEventListener('scroll', updateScrollState);
            updateScrollState();
            window.addEventListener('resize', updateScrollState);
        }
        return () => {
            if (el) el.removeEventListener('scroll', updateScrollState);
            window.removeEventListener('resize', updateScrollState);
        };
    }, [products]);

    useEffect(() => {
        const timer = setTimeout(updateScrollState, 100);
        return () => clearTimeout(timer);
    }, [selectedCategory, products]);

    // Categories drag to scroll
    useEffect(() => {
        const el = categoriesRef.current;
        if (!el) return;

        let isDown = false;
        let hasDragged = false;
        let startX;
        let scrollLeft;
        const DRAG_THRESHOLD = 5; // px moved before treating as drag

        const handleMouseDown = (e) => {
            isDown = true;
            hasDragged = false;
            startX = e.pageX - el.offsetLeft;
            scrollLeft = el.scrollLeft;
        };

        const handleMouseLeave = () => {
            isDown = false;
            hasDragged = false;
            el.classList.remove('grabbing');
        };

        const handleMouseUp = () => {
            isDown = false;
            hasDragged = false;
            el.classList.remove('grabbing');
        };

        const handleMouseMove = (e) => {
            if (!isDown) return;
            const x = e.pageX - el.offsetLeft;
            const walk = (x - startX) * 2;

            // Only start drag mode once the mouse has moved beyond threshold
            if (!hasDragged && Math.abs(x - startX) < DRAG_THRESHOLD) return;

            if (!hasDragged) {
                hasDragged = true;
                el.classList.add('grabbing');
            }

            e.preventDefault();
            el.scrollLeft = scrollLeft - walk;
            updateScrollState();
        };

        el.addEventListener('mousedown', handleMouseDown);
        el.addEventListener('mouseleave', handleMouseLeave);
        el.addEventListener('mouseup', handleMouseUp);
        el.addEventListener('mousemove', handleMouseMove);

        return () => {
            el.removeEventListener('mousedown', handleMouseDown);
            el.removeEventListener('mouseleave', handleMouseLeave);
            el.removeEventListener('mouseup', handleMouseUp);
            el.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    // Clean up timers on unmount
    useEffect(() => {
        return () => {
            if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
            if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        };
    }, []);

    // Reset payment selection, customer details, and coupons when cart is cleared
    useEffect(() => {
        if (cart.length === 0) {
            setSelectedPaymentMethod(null);
            setWalkInName('Walk-in');
            setWalkInPhone('');
            setCouponCode('');
            setAppliedCoupon(null);
        }
    }, [cart.length]);

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
    const couponDiscount = appliedCoupon
        ? (appliedCoupon.type === 'discount' ? cartTotal * (Number(appliedCoupon.value) / 100) : (appliedCoupon.type === 'currency' ? Number(appliedCoupon.value) : 0))
        : 0;
    const finalTotal = Math.max(0, cartTotal - discountAmount - couponDiscount);

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

    const handleConfirmSplitBill = async (paymentsList) => {
        setShowSplitModal(false);
        const mockEvent = { preventDefault: () => {} };
        await handleCreateInvoice(mockEvent, {
            isQuickSale: true,
            walkInName: walkInName.trim() || 'Walk-in',
            walkInPhone: walkInPhone.trim(),
            discount: discountAmount,
            couponCode: appliedCoupon ? appliedCoupon.code : null,
            couponDiscountAmount: couponDiscount,
            paymentsOverride: paymentsList
        });
    };

    async function handleApplyCouponCode() {
        if (!couponCode.trim()) return;
        setLoadingCoupon(true);
        try {
            const res = await api.applyCoupon({ code: couponCode.trim() });
            if (res.coupon.type === 'product') {
                const productsList = res.productsList || [];
                if (productsList.length === 0) {
                    toast.error('No reward products found for this coupon.');
                    setLoadingCoupon(false);
                    return;
                }
                let addedNames = [];
                for (const rewardProduct of productsList) {
                    const exists = cart.find(c => c.product_id === rewardProduct.id && c.is_free);
                    if (exists) {
                        continue;
                    }
                    const prod = products.find(p => p.id === rewardProduct.id);
                    const rewardQty = rewardProduct.reward_quantity || 1;
                    if (prod) {
                        addToCart(prod, true, rewardQty);
                    } else {
                        addToCart({
                            id: rewardProduct.id,
                            name: rewardProduct.name,
                            selling_price: rewardProduct.selling_price,
                            stock_quantity: rewardProduct.stock_quantity,
                            unit: rewardProduct.unit
                        }, true, rewardQty);
                    }
                    addedNames.push(`"${rewardProduct.name}" (x${rewardQty})`);
                }
                setAppliedCoupon(res.coupon);
                if (addedNames.length > 0) {
                    toast.success(`Coupon applied! Free product(s) ${addedNames.join(', ')} added to cart.`);
                } else {
                    toast.success('Coupon applied! Reward products were already in the cart.');
                }
            } else {
                setAppliedCoupon(res.coupon);
                toast.success(`Coupon "${res.coupon.code}" applied successfully!`);
            }
        } catch (err) {
            toast.error(err.message || 'Failed to apply coupon');
        } finally {
            setLoadingCoupon(false);
        }
    }

    const handleRemoveCoupon = () => {
        if (appliedCoupon && appliedCoupon.type === 'product') {
            try {
                if (typeof appliedCoupon.value === 'string' && appliedCoupon.value.trim().startsWith('[')) {
                    const items = JSON.parse(appliedCoupon.value);
                    const idsToRemove = items.map(item => Number(item.id));
                    setCart(prev => prev.filter(c => !(c.is_free && idsToRemove.includes(Number(c.product_id)))));
                } else {
                    const prodId = Number(appliedCoupon.value || appliedCoupon.product_id);
                    setCart(prev => prev.filter(c => !(c.is_free && Number(c.product_id) === prodId)));
                }
            } catch (e) {
                console.error('Failed to remove applied coupon rewards', e);
            }
        }
        setAppliedCoupon(null);
        setCouponCode('');
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
                    <div className="quick-sale-search" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                            <Icons.Search size={20} className="search-icon" style={{ marginLeft: '12px', marginRight: '8px', color: 'var(--text-tertiary)' }} />
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
                                style={{ flex: 1, border: 'none', background: 'transparent', height: '40px', color: 'var(--text-primary)', outline: 'none' }}
                            />
                        </div>
                        <SButton 
                            variant="secondary"
                            onClick={() => setShowScannerModal(true)}
                            title="Connect Wireless Phone Scanner"
                            style={{ height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Icons.Scan size={18} />
                            <span>Quick Scanner</span>
                        </SButton>
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
                                    <div key={index} className="cart-item" style={item.is_free ? { borderLeft: '3px solid var(--success)', background: 'rgba(34, 197, 94, 0.03)' } : {}}>
                                        <div className="cart-item-details">
                                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {item.name}
                                                {item.is_free && <span style={{ fontSize: '9px', background: 'var(--success)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>FREE PERK</span>}
                                            </h4>
                                            <span>{item.is_free ? '₹0.00' : `₹${item.price.toFixed(2)}`}</span>
                                        </div>
                                        <div className="cart-item-actions">
                                            <button onClick={() => updateCartQty(index, -1)}><Icons.Minus size={16} /></button>
                                            <span className="qty">{item.quantity}</span>
                                            <button onClick={() => updateCartQty(index, 1)} disabled={item.is_free}><Icons.Plus size={16} /></button>
                                            <span className="total">{item.is_free ? 'FREE' : `₹${item.total.toFixed(2)}`}</span>
                                            <button className="remove-btn" onClick={() => {
                                                 if (item.is_free && appliedCoupon && appliedCoupon.type === 'product') {
                                                     try {
                                                         if (typeof appliedCoupon.value === 'string' && appliedCoupon.value.trim().startsWith('[')) {
                                                             const items = JSON.parse(appliedCoupon.value);
                                                             const ids = items.map(x => Number(x.id));
                                                             if (ids.includes(Number(item.product_id))) {
                                                                 setAppliedCoupon(null);
                                                                 setCouponCode('');
                                                             }
                                                         } else if (Number(appliedCoupon.value || appliedCoupon.product_id) === Number(item.product_id)) {
                                                             setAppliedCoupon(null);
                                                             setCouponCode('');
                                                         }
                                                     } catch (e) {
                                                         console.error(e);
                                                     }
                                                 }
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
                <div className="quick-sale-categories-header" style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-primary)' }}>
                    <div style={{ flex: 1, minWidth: 0, position: 'relative' }} className={`quick-sale-categories-wrapper ${scrollState.canScrollLeft ? 'can-scroll-left' : ''} ${scrollState.canScrollRight ? 'can-scroll-right' : ''}`}>
                        <div className="quick-sale-categories" ref={categoriesRef} style={{ borderBottom: 'none' }}>
                            {categories.map(cat => {
                                const allProductsInCat = products.filter(p => p.category === cat);
                                return (
                                    <span 
                                        key={cat} 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedCategory(cat);
                                        }}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            const productsToUse = cat === 'All' ? products : allProductsInCat;
                                            addAllProductsInGroup(productsToUse);
                                        }}
                                        style={{ display: 'inline-block', cursor: 'pointer' }}
                                    >
                                        <SButton 
                                            variant="secondary"
                                            size="slim"
                                            className="cat-btn"
                                            title={cat === 'All' ? "Double-click to add all products" : `Double-click to add all ${cat} products`}
                                            selected={selectedCategory === cat}
                                            style={{ pointerEvents: 'none' }}
                                        >
                                            {cat}
                                        </SButton>
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                    {/* Grid / List View Toggle Switch */}
                    <div className="view-toggle-container">
                        <SButton 
                            variant="secondary"
                            size="slim"
                            onClick={() => setViewLayout('grid')}
                            title="Box/Grid View"
                            selected={viewLayout === 'grid'}
                        >
                            <Icons.Grid size={16} />
                        </SButton>
                        <SButton 
                            variant="secondary"
                            size="slim"
                            onClick={() => setViewLayout('list')}
                            title="List View"
                            selected={viewLayout === 'list'}
                        >
                            <Icons.List size={16} />
                        </SButton>
                    </div>
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
                        <div className={viewLayout === 'grid' ? "quick-sale-grid" : "quick-sale-list"} ref={gridRef}>
                            {filteredProducts.map((p, index) => (
                                <div 
                                    key={p.id} 
                                    className={viewLayout === 'grid' ? `product-tile ${focusedIndex === index ? 'focused' : ''}` : `product-list-row ${focusedIndex === index ? 'focused' : ''}`}
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
                                    {viewLayout === 'grid' ? (
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
                                    ) : (
                                        <>
                                            <div className="list-row-left">
                                                <div style={{ color: 'var(--accent)', opacity: 0.8, flexShrink: 0 }}>
                                                    <Icons.Package size={20} />
                                                </div>
                                                <div className="list-row-info">
                                                    <h5>{p.name}</h5>
                                                    <div className="list-row-meta">
                                                        <span>{p.brand_name || 'Generic'}</span>
                                                        <span>•</span>
                                                        <span>{p.subcategory_name || 'General'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="list-row-right">
                                                <span className="price">₹{Number(p.selling_price || 0).toFixed(2)}</span>
                                                <span className={`stock ${p.stock_quantity <= 0 ? 'out' : ''}`}>
                                                    {p.stock_quantity} {p.unit || 'pcs'}
                                                </span>
                                            </div>
                                        </>
                                    )}
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
                                    
                                    <div className={viewLayout === 'grid' ? "quick-sale-grid" : "quick-sale-list"} style={{ padding: 0 }}>
                                        {items.map((p) => (
                                            <div 
                                                key={p.id} 
                                                className={viewLayout === 'grid' ? "product-tile" : "product-list-row"}
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
                                                {viewLayout === 'grid' ? (
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
                                                ) : (
                                                    <>
                                                        <div className="list-row-left">
                                                            <div style={{ color: 'var(--accent)', opacity: 0.8, flexShrink: 0 }}>
                                                                <Icons.Package size={20} />
                                                            </div>
                                                            <div className="list-row-info">
                                                                <h5>{p.name}</h5>
                                                                <div className="list-row-meta">
                                                                    <span>{p.brand_name || 'Generic'}</span>
                                                                    <span>•</span>
                                                                    <span>{p.subcategory_name || 'General'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="list-row-right">
                                                            <span className="price">₹{Number(p.selling_price || 0).toFixed(2)}</span>
                                                            <span className={`stock ${p.stock_quantity <= 0 ? 'out' : ''}`}>
                                                                {p.stock_quantity} {p.unit || 'pcs'}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
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

                <div className="qs-card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '16px', padding: '16px 20px', background: 'var(--bg-secondary)' }}>
                    {/* Row 1: Customer Details & Coupon */}
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        {/* Customer Name */}
                        <div className="qs-field-group" style={{ flex: '1 1 200px' }}>
                            <span className="qs-field-label">Customer Name</span>
                            <input 
                                type="text"
                                className="qs-disc-input"
                                style={{ width: '100%', textAlign: 'left', height: '34px', boxSizing: 'border-box' }}
                                placeholder="Walk-in"
                                value={walkInName}
                                onChange={e => setWalkInName(e.target.value)}
                            />
                        </div>
                        {/* Customer Phone */}
                        <div className="qs-field-group" style={{ flex: '1 1 180px' }}>
                            <span className="qs-field-label">Customer Phone</span>
                            <input 
                                type="text"
                                className="qs-disc-input"
                                style={{ width: '100%', textAlign: 'left', height: '34px', boxSizing: 'border-box' }}
                                placeholder="Customer Phone"
                                value={walkInPhone}
                                onChange={e => setWalkInPhone(e.target.value)}
                            />
                        </div>
                        {/* Coupon Code */}
                        <div className="qs-field-group" style={{ flex: '1 1 250px' }}>
                            <span className="qs-field-label">Coupon Code</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                                <input 
                                    type="text"
                                    className="qs-disc-input"
                                    style={{ flex: 1, textAlign: 'left', height: '34px', textTransform: 'uppercase', boxSizing: 'border-box' }}
                                    placeholder="ENTER CODE"
                                    value={couponCode}
                                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                    disabled={appliedCoupon || loadingCoupon}
                                />
                                {appliedCoupon ? (
                                    <SButton 
                                        variant="secondary" 
                                        tone="critical" 
                                        style={{ height: '34px', padding: '0 12px' }}
                                        onClick={handleRemoveCoupon}
                                    >
                                        Remove
                                    </SButton>
                                ) : (
                                    <SButton 
                                        variant="secondary" 
                                        style={{ height: '34px', padding: '0 12px' }}
                                        onClick={handleApplyCouponCode}
                                        disabled={loadingCoupon || !couponCode.trim()}
                                    >
                                        {loadingCoupon ? 'Applying...' : 'Apply'}
                                    </SButton>
                                )}
                            </div>
                            {appliedCoupon && (
                                <div style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '600', marginTop: '2px' }}>
                                    Applied: {appliedCoupon.code} (
                                    {appliedCoupon.type === 'discount' && `${appliedCoupon.value}% Off`}
                                    {appliedCoupon.type === 'currency' && `₹${appliedCoupon.value} Off`}
                                    {appliedCoupon.type === 'product' && 'Free item added'}
                                    )
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Row 2: Discount & Payment Methods */}
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        {/* Discount */}
                        <div className="qs-field-group" style={{ flex: '0 0 auto' }}>
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
                                        style={{ height: '34px', boxSizing: 'border-box' }}
                                    />
                                    <button className={`qs-disc-type ${discountType === '%' ? 'active' : ''}`} style={{ height: '34px' }} onClick={() => setDiscountType('%')}>%</button>
                                    <button className={`qs-disc-type ${discountType === '₹' ? 'active' : ''}`} style={{ height: '34px' }} onClick={() => setDiscountType('₹')}>₹</button>
                                    {discountValue && (
                                        <button className="qs-disc-clear" onClick={() => setDiscountValue('')}><Icons.X size={13} /></button>
                                    )}
                                </div>
                                {discountAmount > 0 && (
                                    <span className="qs-disc-saved">saves ₹{discountAmount.toFixed(2)}</span>
                                )}
                            </div>
                        </div>

                        {/* Payments Selection */}
                        <div className="qs-field-group" style={{ flex: '1 1 400px' }}>
                            <span className="qs-field-label">Select Payment Method & Checkout</span>
                            <div className="qs-pay-row" style={{ display: 'flex', gap: '6px' }}>
                                <span 
                                    onClick={() => setSelectedPaymentMethod('Cash')} 
                                    style={{ flex: 1, display: 'inline-block', cursor: 'pointer' }}
                                >
                                    <SButton 
                                        variant="secondary"
                                        size="large"
                                        fullWidth
                                        className={`qs-sbtn ${selectedPaymentMethod === 'Cash' ? 'selected' : ''}`}
                                        selected={selectedPaymentMethod === 'Cash'}
                                        style={{
                                            pointerEvents: 'none',
                                            height: '42px'
                                        }}
                                    >
                                        <Icons.Banknote size={17} />
                                        <span className="qs-sbtn-text">
                                            <span className="qs-sbtn-label">Cash</span>
                                        </span>
                                    </SButton>
                                </span>
                                <span 
                                    onClick={() => setSelectedPaymentMethod('UPI')} 
                                    style={{ flex: 1, display: 'inline-block', cursor: 'pointer' }}
                                >
                                    <SButton 
                                        variant="secondary"
                                        size="large"
                                        fullWidth
                                        className={`qs-sbtn ${selectedPaymentMethod === 'UPI' ? 'selected' : ''}`}
                                        selected={selectedPaymentMethod === 'UPI'}
                                        style={{
                                            pointerEvents: 'none',
                                            height: '42px'
                                        }}
                                    >
                                        <Icons.Smartphone size={17} />
                                        <span className="qs-sbtn-text">
                                            <span className="qs-sbtn-label">UPI</span>
                                        </span>
                                    </SButton>
                                </span>
                                <span 
                                    onClick={() => setSelectedPaymentMethod('Card')} 
                                    style={{ flex: 1, display: 'inline-block', cursor: 'pointer' }}
                                >
                                    <SButton 
                                        variant="secondary"
                                        size="large"
                                        fullWidth
                                        className={`qs-sbtn ${selectedPaymentMethod === 'Card' ? 'selected' : ''}`}
                                        selected={selectedPaymentMethod === 'Card'}
                                        style={{
                                            pointerEvents: 'none',
                                            height: '42px'
                                        }}
                                    >
                                        <Icons.CreditCard size={17} />
                                        <span className="qs-sbtn-text">
                                            <span className="qs-sbtn-label">Card</span>
                                        </span>
                                    </SButton>
                                </span>
                                <span 
                                    onClick={() => setShowSplitModal(true)} 
                                    style={{ flex: 1, display: 'inline-block', cursor: 'pointer' }}
                                >
                                    <SButton 
                                        variant="secondary"
                                        size="large"
                                        fullWidth
                                        className="qs-sbtn"
                                        style={{ pointerEvents: 'none', background: '#f1f2f4', color: '#202223', height: '42px' }}
                                    >
                                        <Icons.Layers size={17} />
                                        <span className="qs-sbtn-text">
                                            <span className="qs-sbtn-label">Split Bill</span>
                                        </span>
                                    </SButton>
                                </span>
                                <span 
                                    onClick={async () => {
                                        if (cart.length === 0) { toast.error('Cart is empty'); return; }
                                        if (!selectedPaymentMethod) { toast.error('Please select a payment method'); return; }
                                        
                                        const mockEvent = { preventDefault: () => {} };
                                        await handleCreateInvoice(mockEvent, {
                                            isQuickSale: true,
                                            walkInName: walkInName.trim() || 'Walk-in',
                                            walkInPhone: walkInPhone.trim(),
                                            discount: discountAmount,
                                            couponCode: appliedCoupon ? appliedCoupon.code : null,
                                            couponDiscountAmount: couponDiscount,
                                            paymentsOverride: [{ method: selectedPaymentMethod, amount: finalTotal, transaction_id: '' }]
                                        });
                                    }}
                                    style={{ flex: 1.4, display: 'inline-block', cursor: 'pointer' }}
                                >
                                    <SButton
                                        variant="primary"
                                        size="large"
                                        fullWidth
                                        className="qs-sbtn qs-invoice-btn"
                                        style={{ pointerEvents: 'none', height: '42px' }}
                                    >
                                        <Icons.FileText size={17} />
                                        <span className="qs-sbtn-text">
                                            <span className="qs-sbtn-label">Create Invoice</span>
                                        </span>
                                    </SButton>
                                </span>
                            </div>
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

            {/* Wireless Barcode Scanner Modal */}
            <Modal
                open={showScannerModal}
                onClose={() => setShowScannerModal(false)}
                heading="Wireless Mobile Barcode Scanner"
                size="base"
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                        Turn your mobile phone into a wireless barcode scanner for this cart. Just scan the QR code below or click the link.
                    </p>
                    
                    {syncId ? (
                        <>
                            <div style={{ 
                                background: '#ffffff', 
                                padding: '12px', 
                                borderRadius: '12px', 
                                border: '1px solid var(--border-light)', 
                                display: 'inline-block',
                                boxShadow: 'var(--shadow-sm)'
                            }}>
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(scanUrl)}`} 
                                    alt="QR Scanner Link" 
                                    style={{ display: 'block', width: '220px', height: '220px' }} 
                                />
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600', textTransform: 'uppercase' }}>Scan Link</span>
                                <a 
                                    href={scanUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ 
                                        fontSize: '13px', 
                                        color: 'var(--accent)', 
                                        wordBreak: 'break-all', 
                                        textDecoration: 'underline',
                                        fontWeight: '500'
                                    }}
                                >
                                    {scanUrl}
                                </a>
                            </div>

                            <div style={{ 
                                marginTop: '12px', 
                                padding: '8px 12px', 
                                background: 'rgba(34, 197, 94, 0.05)', 
                                border: '1px solid rgba(34, 197, 94, 0.2)', 
                                borderRadius: '8px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                fontSize: '12px', 
                                color: 'var(--success)' 
                            }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
                                <span>Realtime Sync Channel Active</span>
                            </div>
                        </>
                    ) : (
                        <div style={{ 
                            padding: '16px', 
                            background: 'rgba(239, 68, 68, 0.05)', 
                            border: '1px solid rgba(239, 68, 68, 0.2)', 
                            borderRadius: '8px', 
                            fontSize: '13px', 
                            color: 'var(--critical)' 
                        }}>
                            <strong>Online Sync ID Missing!</strong> Please make sure you have Online Sync enabled in Settings to obtain a sync connection ID.
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
