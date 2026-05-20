import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';
import CustomSelect from '../components/CustomSelect';
import { jsPDF } from 'jspdf';
import Modal from '../components/Modal';
import SButton from '../components/SButton';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import { Icons } from '../components/Icons';
import { formatDate } from '../utils';
import QuickSaleView from '../components/QuickSaleView';
import './SalesPage.css';

const DEFAULT_PAYMENT_METHOD = 'Cash';

export default function SalesPage() {
    const [tab, setTab] = useState('new');
    const [mazewayOrders, setMazewayOrders] = useState([]);
    const [aiSearch, setAiSearch] = useState('');
    const [aiChannelFilter, setAiChannelFilter] = useState('All');
    const [aiStatusFilter, setAiStatusFilter] = useState('All');

    const filteredOrders = useMemo(() => {
        return (mazewayOrders || []).filter(order => {
            const matchesSearch = !aiSearch || 
                (order.customer_name && order.customer_name.toLowerCase().includes(aiSearch.toLowerCase())) ||
                (order.customer_phone && order.customer_phone.includes(aiSearch));
            
            const matchesChannel = aiChannelFilter === 'All' || order.type === aiChannelFilter;
            const matchesStatus = aiStatusFilter === 'All' || order.status === aiStatusFilter;
            
            return matchesSearch && matchesChannel && matchesStatus;
        });
    }, [mazewayOrders, aiSearch, aiChannelFilter, aiStatusFilter]);

    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [invoices, setInvoices] = useState([]);

    // Invoice builder state
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [step, setStep] = useState('customer'); // steps: 'customer', 'products'
    const [customerSearch, setCustomerSearch] = useState('');
    const [walkInName, setWalkInName] = useState('');
    const [walkInPhone, setWalkInPhone] = useState('');
    const [cart, setCart] = useState([]);
    const [gstEnabled, setGstEnabled] = useState(false);
    const [gstRate, setGstRate] = useState(18);
    const [discountEnabled, setDiscountEnabled] = useState(false);
    const [discountRate, setDiscountRate] = useState(0);
    const [productSearch, setProductSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [previewInvoice, setPreviewInvoice] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const [historySearch, setHistorySearch] = useState('');
    const [returningInvoice, setReturningInvoice] = useState(null);
    const [returnQuantities, setReturnQuantities] = useState({}); // { product_id: qty }
    const [fulfillingInvoice, setFulfillingInvoice] = useState(null);
    const [fulfillmentQtys, setFulfillmentQtys] = useState({}); // { product_id: qty }

    // Payment Status State
    const [paymentStatus, setPaymentStatus] = useState('PAID'); // 'PAID', 'PARTIAL', 'UNPAID'
    const [paymentMethod, setPaymentMethod] = useState(DEFAULT_PAYMENT_METHOD); 
    const [payments, setPayments] = useState([{ method: DEFAULT_PAYMENT_METHOD, amount: '', transaction_id: '' }]);
    const [paymentFilter, setPaymentFilter] = useState('All');
    const [updatingPaymentInvoice, setUpdatingPaymentInvoice] = useState(null);
    const [newPaymentAmount, setNewPaymentAmount] = useState('');
    const [usePCreditInPayment, setUsePCreditInPayment] = useState(false);
    const [pCreditToUseInPayment, setPCreditToUseInPayment] = useState('');
    const [usePCredit, setUsePCredit] = useState(false);
    const [pCreditToApply, setPCreditToApply] = useState('');

    const [showFreePerkModal, setShowFreePerkModal] = useState(false);
    const [promoExpenseEnabled, setPromoExpenseEnabled] = useState(false);

    // Advance Payment States
    const [isAdvance, setIsAdvance] = useState(false);
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [cartPulse, setCartPulse] = useState(false);

    // Variant Selection Modal
    const [variantModalProduct, setVariantModalProduct] = useState(null);
    const [variantModalVariants, setVariantModalVariants] = useState([]);
    const [variantModalLoading, setVariantModalLoading] = useState(false);
    
    // Batch Selection Modal State
    const [batchModalItem, setBatchModalItem] = useState(null);
    const [showBatchModal, setShowBatchModal] = useState(false);

    const [settings, setSettings] = useState({});

    useEffect(() => {
        api.getSettings().then(setSettings).catch(console.error);
        api.getCustomers().then(setCustomers).catch(() => { });
        api.getProducts().then(setProducts).catch(() => { });
        loadHistory();
        if (tab === 'new') setStep('customer');
        if (tab === 'ai-sales') loadMazewayOrders();
    }, [tab]);

    async function loadMazewayOrders() {
        try {
            const data = await api.getMazewayOrders();
            setMazewayOrders(data);
        } catch (err) {
            console.error('Failed to load Mazeway orders', err);
        }
    }

    // M018: Keyboard shortcuts — F2=new invoice, Esc=cancel/back, F4=save
    useEffect(() => {
        function handleKeyDown(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.key === 'F2') {
                e.preventDefault();
                setTab('new');
                setStep('customer');
                setCart([]);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (step === 'products') setStep('customer');
                else setTab('history');
            } else if (e.key === 'F4') {
                e.preventDefault();
                document.getElementById('sales-save-btn')?.click();
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [step, tab]);

    // Barcode Scanner Listener
    useEffect(() => {
        if (settings.enable_barcode_scanner !== 'true') return;

        let barcodeBuffer = '';
        let lastKeyTime = Date.now();

        function handleBarcodeScan(e) {
            // Ignore if user is already typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            const currentTime = Date.now();
            
            // If more than 50ms since last keystroke, reset buffer (not a scanner)
            if (currentTime - lastKeyTime > 50) {
                barcodeBuffer = '';
            }
            
            lastKeyTime = currentTime;

            if (e.key === 'Enter') {
                if (barcodeBuffer.length > 2) {
                    const scannedCode = barcodeBuffer;
                    barcodeBuffer = ''; // Reset
                    
                    // Process scanned code
                    const product = products.find(p => p.product_code === scannedCode || p.name === scannedCode || String(p.id) === scannedCode);
                    if (product) {
                        if (tab === 'new' && step === 'customer' && !selectedCustomer) {
                            toast.error("Please select a customer first.");
                        } else {
                            addToCart(product);
                            toast.success(`Added ${product.name} to cart.`);
                        }
                    } else {
                        toast.error(`Product not found for barcode: ${scannedCode}`);
                    }
                }
            } else if (e.key.length === 1) { // Normal character
                barcodeBuffer += e.key;
            }
        }

        window.addEventListener('keydown', handleBarcodeScan);
        return () => window.removeEventListener('keydown', handleBarcodeScan);
    }, [settings.enable_barcode_scanner, products, tab, step, selectedCustomer, addToCart]);

    useEffect(() => {
        const configuredMethod = settings.default_payment_method || DEFAULT_PAYMENT_METHOD;
        setPaymentMethod(configuredMethod);
        setPayments(currentPayments => currentPayments.map((payment, index) => (
            index === 0 && (!payment.method || payment.method === DEFAULT_PAYMENT_METHOD)
                ? { ...payment, method: configuredMethod }
                : payment
        )));
    }, [settings.default_payment_method]);
    
    // Customer Display Sync Logic
    useEffect(() => {
        if (settings.enable_customer_display !== 'true') return;

        const subtotalValue = cart.reduce((s, i) => {
            const base = (Number(i.price) || 0) * (Number(i.quantity) || 0);
            if (settings.enable_gst_per_item === 'true' || settings.enable_discount_per_item === 'true') {
                const d = Number(i.discount_rate) || 0;
                const g = Number(i.gst_rate) || 0;
                const afterD = base - (base * (d / 100));
                const afterG = afterD + (afterD * (g / 100));
                return s + afterG;
            }
            return s + base;
        }, 0);

        const dRate = discountEnabled ? (parseFloat(discountRate) || 0) : 0;
        const gRate = gstEnabled ? (parseFloat(gstRate) || 0) : 0;

        const discountAmountValue = (settings.enable_discount_per_item === 'true') ? 0 : (subtotalValue * (dRate / 100));
        const afterDiscountValue = subtotalValue - discountAmountValue;
        const gstAmountValue = (settings.enable_gst_per_item === 'true') ? 0 : (afterDiscountValue * (gRate / 100));
        const finalTotalValue = afterDiscountValue + gstAmountValue;

        const syncData = {
            cart: cart.map(item => {
                const baseTotal = (Number(item.quantity) || 0) * (Number(item.price) || 0);
                const diskRate = Number(item.discount_rate) || 0;
                const gRate = Number(item.gst_rate) || 0;
                const afterDisk = baseTotal - (baseTotal * (diskRate / 100));
                const withGst = afterDisk + (afterDisk * (gRate / 100));
                
                return {
                    name: item.name,
                    price: Number(item.price),
                    quantity: Number(item.quantity),
                    unit: item.unit,
                    total: withGst
                };
            }),
            subtotal: subtotalValue,
            discount: discountAmountValue,
            gst: gstAmountValue,
            total: finalTotalValue,
            status: cart.length > 0 ? 'active' : 'idle',
            customerName: selectedCustomer ? (customers.find(c => String(c.id) === selectedCustomer)?.name || '') : (walkInName || (tab === 'quick' ? 'Quick Sale Guest' : 'Walk-in Guest'))
        };

        window.maze?.updateCustomerDisplay(syncData);
    }, [cart, discountRate, gstRate, discountEnabled, gstEnabled, settings, selectedCustomer, walkInName, customers]);


    async function loadHistory() {
        try {
            const data = await api.getInvoices();
            setInvoices(data);
        } catch (err) {
            console.error(err);
        }
    }

    async function handleViewInvoice(id) {
        try {
            const data = await api.getInvoice(id);
            setPreviewInvoice(data);
        } catch (err) {
            console.error('Failed to load invoice', err);
        }
    }

    async function handleDeleteInvoice() {
        if (!deleteId) return;

        const promise = api.deleteInvoice(deleteId);

        toast.promise(promise, {
            loading: 'Deleting invoice record...',
            success: () => {
                setDeleteId(null);
                loadHistory();
                return 'Invoice deleted successfully';
            },
            error: (err) => err.message || 'Failed to delete invoice'
        });
    }

    async function addToCart(product, isFree = false) {
        // Check for variants first
        try {
            setVariantModalLoading(true);
            const variants = await api.getVariants(product.id);
            setVariantModalLoading(false);

            if (variants && variants.length > 0) {
                setVariantModalProduct(product);
                setVariantModalVariants(variants);
                return; // Wait for variant selection
            }
        } catch (err) {
            console.error('Failed to check variants', err);
            setVariantModalLoading(false);
        }

        addFinalToCart(product, null, isFree);
    }

    async function addFinalToCart(product, variant = null, isFree = false) {
        const productId = product.id;
        const variantId = variant ? variant.id : null;
        const price = variant ? Number(variant.selling_price) : Number(product.selling_price);

        // If product tracks batches and FIFO is enabled, we will apply FIFO splitting right away (even for qty 1)
        let batches = [];
        if (settings.enable_batch_system === 'true') {
            try {
                batches = await api.getProductBatches(productId);
            } catch (e) { console.error('Failed to load batches'); }
        }

        const isFifo = settings.auto_batch_selection_method === 'FIFO' && batches.length > 0;

        // If not track_batches or not FIFO, just group by product/variant/isFree/batch
        // Wait, for manual mode, we also group by batch_id

        // Let's recalculate the entire quantity for this product in the cart
        const existingItems = cart.filter(c =>
            c.product_id === productId &&
            c.variant_id === variantId &&
            !!c.is_free === isFree
        );

        let currentTotalQty = existingItems.reduce((sum, item) => sum + item.quantity, 0);
        let newTotalQty = currentTotalQty + 1;

        // Check for flexible inventory
        const availableStock = variant ? Number(variant.stock_quantity || 0) : Number(product.stock_quantity || 0);
        if (settings.flexible_inventory === 'false' && newTotalQty > availableStock) {
            toast.error(`Insufficient stock! Only ${availableStock} ${product.unit || 'PCS'} available.`);
            return;
        }

        if (isFifo) {
            // Remove existing, recalculate splits
            const otherItems = cart.filter(c => !(c.product_id === productId && c.variant_id === variantId && !!c.is_free === isFree));
            const newSplits = calculateFifoSplits(product, variant, isFree, newTotalQty, batches, price);
            setCart([...otherItems, ...newSplits]);
        } else {
            // Manual mode or no batches
            // Just increment the first one with no batch_id, or create a new row
            const baseIndex = cart.findIndex(c =>
                c.product_id === productId &&
                c.variant_id === variantId &&
                !!c.is_free === isFree &&
                (!c.batch_id) // Group by empty batch id in manual
            );

            if (baseIndex > -1) {
                setCart(cart.map((c, i) =>
                    i === baseIndex
                        ? { ...c, quantity: c.quantity + 1, total: isFree ? 0 : (c.quantity + 1) * c.price }
                        : c
                ));
            } else {
                setCart([...cart, {
                    cartRowId: Date.now().toString() + Math.random().toString(),
                    product_id: productId,
                    variant_id: variantId,
                    name: variant ? `${product.name} - ${variant.name}` : product.name,
                    price: isFree ? 0 : price,
                    original_price: price,
                    quantity: 1,
                    total: isFree ? 0 : price,
                    maxStock: variant ? variant.stock_quantity : product.stock_quantity,
                    unit: product.unit || 'PCS',
                    baseUnit: product.unit || 'PCS',
                    secondaryUnit: product.secondary_unit || null,
                    conversionFactor: product.conversion_factor || 1,
                    allowDecimal: !!product.allow_decimal,
                    is_free: isFree,
                    gst_rate: 0,
                    discount_rate: 0,
                    track_batches: settings.enable_batch_system === 'true',
                    batch_id: batches.length === 1 ? batches[0].id : '',
                    available_batches: batches
                }]);
            }
        }

        toast.success(`${product.name} added to cart`, { duration: 1500 });
        setProductSearch('');
        setCartPulse(true);
        setTimeout(() => setCartPulse(false), 500);
        setVariantModalProduct(null);
    }

    function calculateFifoSplits(product, variant, isFree, totalQty, batches, price) {
        const splits = [];
        let qtyToFulfill = totalQty;

        // Sort batches by expiry date ASC
        const sortedBatches = [...batches].sort((a, b) => {
            if (!a.expiry_date) return 1;
            if (!b.expiry_date) return -1;
            return new Date(a.expiry_date) - new Date(b.expiry_date);
        });

        for (const batch of sortedBatches) {
            if (qtyToFulfill <= 0) break;
            if (batch.current_quantity > 0) {
                const takeQty = Math.min(qtyToFulfill, batch.current_quantity);
                qtyToFulfill -= takeQty;

                splits.push({
                    cartRowId: Date.now().toString() + Math.random().toString(),
                    product_id: product.id,
                    variant_id: variant ? variant.id : null,
                    name: variant ? `${product.name} - ${variant.name}` : product.name,
                    price: isFree ? 0 : price,
                    original_price: price,
                    quantity: takeQty,
                    total: isFree ? 0 : takeQty * price,
                    maxStock: variant ? variant.stock_quantity : product.stock_quantity,
                    unit: product.unit || 'PCS',
                    baseUnit: product.unit || 'PCS',
                    secondaryUnit: product.secondary_unit || null,
                    conversionFactor: product.conversion_factor || 1,
                    allowDecimal: !!product.allow_decimal,
                    is_free: isFree,
                    gst_rate: 0,
                    discount_rate: 0,
                    track_batches: true,
                    batch_id: batch.id,
                    available_batches: batches
                });
            }
        }

        // If there's still quantity to fulfill (not enough stock across all batches)
        // We add a line for the remaining (it will be backordered or flag as no stock)
        if (qtyToFulfill > 0) {
            splits.push({
                cartRowId: Date.now().toString() + Math.random().toString(),
                product_id: product.id,
                variant_id: variant ? variant.id : null,
                name: variant ? `${product.name} - ${variant.name}` : product.name,
                price: isFree ? 0 : price,
                original_price: price,
                quantity: qtyToFulfill,
                total: isFree ? 0 : qtyToFulfill * price,
                maxStock: variant ? variant.stock_quantity : product.stock_quantity,
                unit: product.unit || 'PCS',
                baseUnit: product.unit || 'PCS',
                secondaryUnit: product.secondary_unit || null,
                conversionFactor: product.conversion_factor || 1,
                allowDecimal: !!product.allow_decimal,
                is_free: isFree,
                gst_rate: 0,
                discount_rate: 0,
                track_batches: true,
                batch_id: '', // Unassigned
                available_batches: batches
            });
        }

        return splits;
    }

    function updateQty(cartRowId, qty) {
        const existingIndex = cart.findIndex(c => c.cartRowId === cartRowId);
        if (existingIndex === -1) return;

        const item = cart[existingIndex];

        // Handle decimal validation
        let newQty = Math.max(0.001, qty);
        if (!item.allowDecimal) {
            newQty = Math.floor(newQty);
            if (newQty < 1) newQty = 1;
        }

        const isFifo = settings.auto_batch_selection_method === 'FIFO' && item.available_batches?.length > 0;

        if (isFifo) {
            // Find all items of this exact product/variant/isFree to rebuild their total qty
            const groupItems = cart.filter(c =>
                c.product_id === item.product_id &&
                c.variant_id === item.variant_id &&
                !!c.is_free === item.is_free
            );

            // Recompute total qty for this product group by replacing this row's qty
            let totalQtyForGroup = 0;
            groupItems.forEach(c => {
                if (c.cartRowId === cartRowId) totalQtyForGroup += newQty;
                else totalQtyForGroup += c.quantity;
            });

            const otherItems = cart.filter(c => !(
                c.product_id === item.product_id &&
                c.variant_id === item.variant_id &&
                !!c.is_free === item.is_free
            ));

            const product = products.find(p => p.id === item.product_id); // Basic mock for product
            if (!product) return;

            const newSplits = calculateFifoSplits({ id: item.product_id, name: product.name, unit: item.baseUnit, secondary_unit: item.secondaryUnit, conversion_factor: item.conversionFactor, allow_decimal: item.allowDecimal, stock_quantity: item.maxStock }, item.variant_id ? { id: item.variant_id, name: item.name.split(' - ')[1], stock_quantity: item.maxStock } : null, item.is_free, totalQtyForGroup, item.available_batches, item.original_price);

            // Carry over any custom GST/Discount that they might have manually changed (simplification: apply to all splits)
            newSplits.forEach(s => {
                s.gst_rate = item.gst_rate;
                s.discount_rate = item.discount_rate;
            });

            setCart([...otherItems, ...newSplits]);
        } else {
            // Manual flow: just update this specific cart row
            setCart(cart.map(c =>
                c.cartRowId === cartRowId
                    ? { ...c, quantity: newQty, total: c.is_free ? 0 : newQty * c.price }
                    : c
            ));
        }
    }

    function toggleUnit(cartRowId) {
        setCart(cart.map(c => {
            if (c.cartRowId === cartRowId && c.secondaryUnit) {
                const isNowSecondary = c.unit === c.baseUnit;
                const newUnit = isNowSecondary ? c.secondaryUnit : c.baseUnit;
                const newPrice = isNowSecondary ? (c.original_price * c.conversionFactor) : c.original_price;
                return { ...c, unit: newUnit, price: newPrice, total: c.is_free ? 0 : c.quantity * newPrice };
            }
            return c;
        }));
    }

    function removeFromCart(cartRowId) {
        setCart(cart.filter(c => c.cartRowId !== cartRowId));
    }

    function updateProductTotalQty(product, newTotalQty) {
        if (newTotalQty <= 0) {
            setCart(cart.filter(c => c.product_id !== product.id));
            return;
        }
        const itemTemplate = cart.find(c => c.product_id === product.id && !c.is_free && !c.variant_id);
        if (!itemTemplate) return;

        // Handle decimal validation
        let validQty = Math.max(0.001, newTotalQty);
        if (!itemTemplate.allowDecimal) {
            validQty = Math.floor(validQty);
            if (validQty < 1) validQty = 1;
        }

        // Check for flexible inventory
        if (settings.flexible_inventory === 'false' && validQty > itemTemplate.maxStock) {
            toast.error(`Insufficient stock! Only ${itemTemplate.maxStock} ${itemTemplate.baseUnit || 'PCS'} available.`);
            return;
        }

        if (settings.auto_batch_selection_method === 'FIFO' && itemTemplate.available_batches?.length > 0) {
            const otherItems = cart.filter(c => c.product_id !== product.id || !!c.is_free || c.variant_id);
            const newSplits = calculateFifoSplits(
                { id: product.id, name: product.name, unit: itemTemplate.baseUnit, secondary_unit: itemTemplate.secondaryUnit, conversion_factor: itemTemplate.conversionFactor, allow_decimal: itemTemplate.allowDecimal, stock_quantity: itemTemplate.maxStock },
                null, false, validQty, itemTemplate.available_batches, itemTemplate.original_price
            );
            newSplits.forEach(s => { s.gst_rate = itemTemplate.gst_rate; s.discount_rate = itemTemplate.discount_rate; });
            setCart([...otherItems, ...newSplits]);
        } else {
            // Manual: adjust first row
            setCart(cart.map((c, i) => c.cartRowId === itemTemplate.cartRowId ? { ...c, quantity: validQty, total: validQty * c.price } : c));
        }
    }

    // M051: Memoize derived product/customer lists to avoid recomputing on every render
    const allFiltered = useMemo(() => (products || []).filter(p =>
        (productSearch === '' ||
            (p.name && p.name.toLowerCase().includes(productSearch.toLowerCase())) ||
            (p.product_code && p.product_code.toLowerCase().includes(productSearch.toLowerCase())))
    ), [products, productSearch]);

    const categorizedProducts = useMemo(() => {
        const cats = Array.from(new Set(allFiltered.map(p => p.category || 'General')));
        return cats.reduce((acc, cat) => {
            acc[cat] = allFiltered.filter(p => (p.category || 'General') === cat) || [];
            return acc;
        }, {});
    }, [allFiltered]);

    // Derive category list so it's available in JSX (was accidentally inside the closure)
    const categories = useMemo(() => Object.keys(categorizedProducts), [categorizedProducts]);

    const filteredCustomers = useMemo(() => (customers || []).filter(c =>
        (c.name && c.name.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.phone && c.phone.includes(customerSearch)) ||
        (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase()))
    ), [customers, customerSearch]);

    // M043: Memoize subtotal to avoid recomputing on every render
    const subtotalNum = useMemo(() => cart.reduce((sum, c) => {
        const itemBase = Number(c.total || 0) || 0;
        if (settings.enable_discount_per_item === 'true' || settings.enable_gst_per_item === 'true') {
            const diskRate = Number(c.discount_rate || 0) || 0;
            const gRate = Number(c.gst_rate || 0) || 0;
            const afterDisk = itemBase - (itemBase * (diskRate / 100));
            const withGst = afterDisk + (afterDisk * (gRate / 100));
            return sum + (Number(withGst) || 0);
        }
        return sum + itemBase;
    }, 0) || 0, [cart, settings.enable_discount_per_item, settings.enable_gst_per_item]);

    const subtotal = Number(subtotalNum) || 0;
    const discountAmount = (settings.enable_discount_per_item !== 'true' && discountEnabled) ? subtotal * (Number(discountRate || 0) / 100) : 0;
    const afterDiscount = subtotal - (Number(discountAmount) || 0);
    const gstAmount = (settings.enable_gst_per_item !== 'true' && gstEnabled) ? afterDiscount * (Number(gstRate || 0) / 100) : 0;
    const finalTotal = (Number(afterDiscount) || 0) + (Number(gstAmount) || 0);

    // Auto-fill payment amount for walk-in customers to match grand total
    useEffect(() => {
        if (!selectedCustomer && step === 'products' && payments.length === 1) {
            const currentAmount = parseFloat(payments[0].amount) || 0;
            // If amount is 0 or matches the previous total (meaning it hasn't been manually diverged significantly)
            // Or if it's just empty string, we sync it.
            if (payments[0].amount === '' || currentAmount === 0) {
                setPayments([{ ...payments[0], amount: finalTotal > 0 ? finalTotal.toFixed(2) : '' }]);
            }
        }
    }, [finalTotal, selectedCustomer, step]);

    async function handleCreateInvoice(e, options = {}) {
        if (e && e.preventDefault) e.preventDefault();
        if (cart.length === 0) return;

        const isQuickSale = options.isQuickSale || false;
        const currentSelectedCustomer = selectedCustomer ? parseInt(selectedCustomer) : null;

        const payload = {
            customer_id: isQuickSale ? null : currentSelectedCustomer,
            walk_in_name: isQuickSale ? (options.walkInName || 'Walk-in') : (!currentSelectedCustomer ? walkInName : ''),
            walk_in_phone: isQuickSale ? '' : (!currentSelectedCustomer ? walkInPhone : ''),
            gst_rate: gstEnabled ? Number(gstRate || 0) : 0,
            discount_rate: discountEnabled ? Number(discountRate || 0) : 0,
            items: cart.map(c => ({
                product_id: Number(c.product_id),
                variant_id: c.variant_id ? Number(c.variant_id) : null,
                quantity: Number(c.quantity || 0),
                unit: c.unit,
                is_free: !!c.is_free,
                price: Number(c.price || 0),
                item_gst_rate: Number(c.gst_rate || 0),
                item_discount_rate: Number(c.discount_rate || 0),
                batch_id: c.batch_id ? Number(c.batch_id) : null
            })),
            payment_status: isAdvance ? 'ADVANCE' : (isQuickSale ? 'PAID' : paymentStatus),
            payments: options.paymentsOverride ? options.paymentsOverride : ((paymentStatus === 'UNPAID' && !isAdvance) ? [] : (isAdvance ? [{ method: paymentMethod, amount: Number(advanceAmount || 0) }] : payments.filter(p => Number(p.amount) > 0).map(p => ({
                ...p,
                amount: Number(p.amount)
            })))),
            use_p_credit: usePCredit,
            p_credit_amount: usePCredit ? Number(pCreditToApply || 0) : 0,
            is_advance: isAdvance,
            advance_amount: isAdvance ? Number(advanceAmount || 0) : 0
        };

        setSaving(true);
        const toastId = toast.loading('Generating invoice and updating stock...');
        try {
            const res = await api.createInvoice(payload);

            // Reset state on success
            setCart([]);
            setGstEnabled(false);
            setDiscountEnabled(false);
            setSelectedCustomer('');
            setWalkInName('');
            setWalkInPhone('');
            setPaymentStatus('PAID');
            setPayments([{ method: settings.default_payment_method || DEFAULT_PAYMENT_METHOD, amount: '', transaction_id: '' }]);
            setStep('customer');
            setUsePCredit(false);
            setPCreditToApply('');
            setPromoExpenseEnabled(false);
            setIsAdvance(false);
            setAdvanceAmount('');

            // Refresh products and history
            api.getProducts().then(setProducts).catch(() => {});
            api.getCustomers().then(setCustomers).catch(() => {});
            loadHistory();

            toast.success('Invoice created successfully!', { id: toastId });

            // Send completion status to customer display
            if (settings.enable_customer_display === 'true') {
                window.maze?.updateCustomerDisplay({
                    status: 'completed',
                    total: payload.items.reduce((sum, item) => {
                        const baseTotal = item.quantity * item.price;
                        const afterDisk = baseTotal - (baseTotal * (item.item_discount_rate / 100));
                        const withGst = afterDisk + (afterDisk * (item.item_gst_rate / 100));
                        return sum + withGst;
                    }, 0) * (1 - (payload.discount_rate / 100)) * (1 + (payload.gst_rate / 100))
                });
                
                // Reset to idle after 10 seconds
                setTimeout(() => {
                    window.maze?.updateCustomerDisplay({ status: 'idle', cart: [] });
                }, 10000);
            }

            // Open preview
            if (res) {
                setPreviewInvoice(res);
            }
        } catch (err) {
            toast.error(err.message || 'Failed to create invoice', { id: toastId });
            // Even if there's an error, refresh history in case invoice was partially created
            loadHistory();
        } finally {
            setSaving(false);
        }
    }

    async function handleProcessReturn(refundMethod = 'refund') {
        if (!returningInvoice) return;
        const itemsToReturn = Object.entries(returnQuantities)
            .filter(([_, qty]) => Number(qty) > 0)
            .map(([pid, qty]) => ({ product_id: Number(pid), quantity: Number(qty) }));

        if (itemsToReturn.length === 0) return;

        const promise = api.returnInvoice(returningInvoice.id, {
            items: itemsToReturn,
            refund_method: refundMethod
        });

        setSaving(true);
        toast.promise(promise, {
            loading: 'Processing sales return...',
            success: () => {
                setReturningInvoice(null);
                setReturnQuantities({});
                loadHistory();
                api.getProducts().then(setProducts).catch(() => { });
                api.getCustomers().then(setCustomers).catch(() => { });
                return 'Return processed successfully!';
            },
            error: (err) => err.message || 'Failed to process return',
            finally: () => setSaving(false)
        });
    }

    async function handleUpdatePayment() {
        if (!updatingPaymentInvoice) return;

        const cashAmount = Number(newPaymentAmount || 0);
        const creditAmount = usePCreditInPayment ? Number(pCreditToUseInPayment || 0) : 0;

        if (cashAmount <= 0 && creditAmount <= 0) {
            toast.error('Please enter a payment or credit amount.');
            return;
        }

        const promise = api.updateInvoicePayment(updatingPaymentInvoice.id, {
            amount: cashAmount,
            use_p_credit: usePCreditInPayment,
            p_credit_amount: creditAmount,
            payment_method: paymentMethod
        });

        setSaving(true);
        toast.promise(promise, {
            loading: 'Recording payment...',
            success: () => {
                setUpdatingPaymentInvoice(null);
                setNewPaymentAmount('');
                setPaymentMethod(settings.default_payment_method || DEFAULT_PAYMENT_METHOD);
                setUsePCreditInPayment(false);
                setPCreditToUseInPayment('');
                loadHistory();
                api.getCustomers().then(setCustomers).catch(() => { });
                return 'Payment updated successfully!';
            },
            error: (err) => err.message || 'Failed to update payment',
            finally: () => setSaving(false)
        });
    }

    async function handleFulfill() {
        if (!fulfillingInvoice) return;

        const isUnpaid = fulfillingInvoice.payment_status === 'UNPAID' || fulfillingInvoice.financial_status === 'UNPAID';
        if (isUnpaid) {
            const confirmPayment = window.confirm('This invoice is UNPAID. Would you like to record a payment before fulfilling?');
            if (confirmPayment) {
                setFulfillingInvoice(null);
                setUpdatingPaymentInvoice(fulfillingInvoice);
                return;
            }
        }

        const fulfillments = Object.entries(fulfillmentQtys)
            .filter(([_, qty]) => Number(qty) > 0)
            .map(([pid, qty]) => ({ product_id: Number(pid), deliver_qty: Number(qty) }));

        if (fulfillments.length === 0) return;

        const promise = api.fulfillInvoice(fulfillingInvoice.id, { fulfillments });

        setSaving(true);
        toast.promise(promise, {
            loading: 'Fulfilling items from stock...',
            success: () => {
                setFulfillingInvoice(null);
                setFulfillmentQtys({});
                loadHistory();
                api.getProducts().then(setProducts).catch(() => { });
                return 'Items fulfilled successfully!';
            },
            error: (err) => err.message || 'Failed to fulfill items',
            finally: () => setSaving(false)
        });
    }

    async function handleProcessAdvance(invoiceId) {
        if (!window.confirm('Are you sure you want to process this advance invoice? This will deduct products from inventory.')) return;

        const promise = api.processAdvance(invoiceId);

        setSaving(true);
        toast.promise(promise, {
            loading: 'Deducting stock for advance order...',
            success: () => {
                loadHistory();
                api.getProducts().then(setProducts).catch(() => { });
                return 'Stock deducted and status updated!';
            },
            error: (err) => err.message || 'Failed to process advance',
            finally: () => setSaving(false)
        });
    }

    async function handleUpdateMazewayStatus(id, status) {
        const promise = api.updateMazewayOrderStatus(id, status);
        toast.promise(promise, {
            loading: `${status === 'CONFIRMED' ? 'Confirming' : 'Rejecting'} order...`,
            success: () => {
                loadMazewayOrders();
                return `Order ${status.toLowerCase()} successfully`;
            },
            error: 'Failed to update order status'
        });
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Sales</h1>
                    <p className="text-secondary">Create standard invoices, track customer purchase history, and manage AI sales</p>
                </div>
            </div>

            <div className="tabs">
                {settings.enable_quick_sale === 'true' && (
                    <button className={`tab-item ${tab === 'quick' ? 'active' : ''}`} onClick={() => setTab('quick')}>Quick Sale</button>
                )}
                <button className={`tab-item ${tab === 'new' ? 'active' : ''}`} onClick={() => { setTab('new'); setStep('customer'); }}>Standard Invoice</button>
                <button className={`tab-item ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>Sales History</button>
                <button className={`tab-item ${tab === 'ai-sales' ? 'active' : ''}`} onClick={() => setTab('ai-sales')}>
                    AI Sales
                    {mazewayOrders.filter(o => o.status === 'NEW').length > 0 && (
                        <span className="tab-badge" style={{ background: 'var(--danger)', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', marginLeft: '6px' }}>
                            {mazewayOrders.filter(o => o.status === 'NEW').length}
                        </span>
                    )}
                </button>
            </div>

            {tab === 'quick' && settings.enable_quick_sale === 'true' && (
                <QuickSaleView 
                    products={products}
                    cart={cart}
                    setCart={setCart}
                    addToCart={addToCart}
                    handleCreateInvoice={handleCreateInvoice}
                    settings={settings}
                />
            )}

            {tab === 'new' && (
                <div className="invoice-container">
                    {step === 'customer' ? (
                        <div className="customer-selection-view">
                            <div className="view-header">
                                <h2>Select Customer</h2>
                                <p>Choose a customer to start the invoice</p>
                            </div>

                            <div className="search-bar customer-search">
                                <Icons.Search size={20} />
                                <input
                                    placeholder="Search customers by name or phone…"
                                    value={customerSearch}
                                    onChange={e => setCustomerSearch(e.target.value)}
                                />
                            </div>

                            <div className="customer-list-grid">
                                <div className="customer-card walk-in" onClick={() => { setSelectedCustomer(''); setStep('products'); setPaymentStatus('PAID'); }}>
                                    <div className="customer-icon">
                                        <Icons.Users size={24} />
                                    </div>
                                    <div className="customer-info">
                                        <span className="customer-name">New Walk-in Customer</span>
                                        <span className="customer-type">Default Guest</span>
                                    </div>
                                    <div className="customer-action">
                                        <Icons.ChevronRight size={20} />
                                    </div>
                                </div>

                                {filteredCustomers.map(c => (
                                    <div key={c.id} className="customer-card" onClick={() => { setSelectedCustomer(String(c.id)); setStep('products'); }}>
                                        <div className="customer-icon">
                                            <Icons.User size={24} />
                                        </div>
                                        <div className="customer-info">
                                            <span className="customer-name">{c.name}</span>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                <span className="customer-details">
                                                    {c.phone || 'No Phone'}
                                                </span>
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    {(() => {
                                                        const custInvoices = invoices.filter(inv => inv.customer_id === c.id);
                                                        const totalOutstanding = custInvoices.reduce((sum, inv) => {
                                                            const effectiveTotal = Math.max(0, (inv.total || 0) - (inv.total_returned_amount || 0));
                                                            return sum + Math.max(0, effectiveTotal - (inv.paid_amount || 0));
                                                        }, 0);
                                                        return totalOutstanding > 0 && (
                                                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                                Due: ₹{totalOutstanding.toLocaleString('en-IN')}
                                                            </span>
                                                        );
                                                    })()}
                                                    {Number(c.p_credit_balance || 0) > 0 && (
                                                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--accent)', background: 'rgba(var(--accent-rgb), 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                            Credit: ₹{Number(c.p_credit_balance).toLocaleString('en-IN')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="customer-action">
                                            <Icons.ChevronRight size={20} />
                                        </div>
                                    </div>
                                ))}

                                {filteredCustomers.length === 0 && customerSearch && (
                                    <div className="empty-state mini" style={{ gridColumn: '1 / -1' }}>
                                        <p>No customers matching "{customerSearch}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="invoice-layout">
                            <div className="invoice-products-section">
                                <div className="section-header-inline" style={{ marginBottom: '24px' }}>
                                    <SButton variant="secondary" onClick={() => setStep('customer')}>
                                        <Icons.ChevronLeft size={14} strokeWidth={2.5} />
                                        Back to Customers
                                    </SButton>
                                </div>

                                <div className="search-bar">
                                    <Icons.Search size={20} />
                                    <input
                                        placeholder="Search products to add…"
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div className="categorized-product-picker">
                                    {categories.map(cat => (
                                        <div key={cat} className="category-group">
                                            <h4 className="category-title">{cat}</h4>
                                            <div className="category-products">
                                                {categorizedProducts[cat].map(p => {
                                                    const cartItemInfo = cart.filter(c => c.product_id === p.id && !c.is_free && !c.variant_id);
                                                    const totalQty = cartItemInfo.reduce((sum, c) => sum + c.quantity, 0);
                                                    const firstItem = cartItemInfo[0];
                                                    return (
                                                        <div key={p.id} className={`product-picker-item ${p.stock_quantity <= 0 ? 'unavailable' : ''}`}>
                                                            <div className="p-main">
                                                                <span className="p-name">{p.name}</span>
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                    <span className="p-stock">In Stock: {p.stock_quantity}</span>
                                                                    {settings.enable_sku === 'true' && p.product_code && (
                                                                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--bg-primary)', padding: '1px 4px', borderRadius: '3px', border: '1px solid var(--border-light)' }}>
                                                                            Code: {p.product_code}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="p-side">
                                                                <span className="p-price">₹{Number(p.selling_price).toLocaleString('en-IN')}</span>

                                                                {firstItem ? (
                                                                    <div className="p-qty-control">
                                                                        <button onClick={() => {
                                                                            if (totalQty > 1) {
                                                                                updateProductTotalQty(p, totalQty - 1);
                                                                            } else {
                                                                                updateProductTotalQty(p, 0);
                                                                            }
                                                                        }}>-</button>
                                                                        <input
                                                                            className="p-qty-num"
                                                                            type="number"
                                                                            step={firstItem.allowDecimal ? "0.01" : "1"}
                                                                            value={totalQty}
                                                                            onChange={e => updateProductTotalQty(p, parseFloat(e.target.value) || 0)}
                                                                            style={{ width: '50px', border: 'none', background: 'transparent', textAlign: 'center', fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}
                                                                        />
                                                                        <button
                                                                            onClick={() => updateProductTotalQty(p, totalQty + 1)}
                                                                        >+</button>
                                                                    </div>
                                                                ) : (
                                                                    <button className="p-add-icon" onClick={() => addToCart(p)} title="Add to Cart">
                                                                        <Icons.Plus size={14} strokeWidth={3} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                                    <SButton
                                        variant="secondary"
                                        style={{ width: '100%', gap: '8px', justifyContent: 'center', background: 'var(--bg-primary)', border: '1px dashed var(--accent)', color: 'var(--accent)' }}
                                        onClick={() => setShowFreePerkModal(true)}
                                    >
                                        <Icons.Plus size={16} strokeWidth={3} />
                                        Add Free Perk
                                    </SButton>
                                </div>
                            </div>

                            <div className="invoice-summary">
                                <h3>Invoice Details</h3>

                                <div className="summary-customer-info">
                                    <div className="info-label">Customer</div>
                                    <div className="info-value">
                                        {selectedCustomer ? (
                                            <>
                                                <span className="customer-name-sm">{customers.find(c => String(c.id) === selectedCustomer)?.name}</span>
                                                <SButton variant="secondary" onClick={() => setStep('customer')}>Change</SButton>
                                            </>
                                        ) : (
                                            <div style={{ width: '100%' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <span className="customer-name-sm">Walk-in Customer</span>
                                                    <SButton variant="secondary" onClick={() => setStep('customer')}>Change</SButton>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {!selectedCustomer && (
                                                            <>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Name (Optional)"
                                                                    value={walkInName}
                                                                    onChange={e => setWalkInName(e.target.value)}
                                                                    style={{ width: '100%', padding: '6px 8px', fontSize: 'var(--font-size-xs)', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Phone (Optional)"
                                                                    value={walkInPhone}
                                                                    onChange={e => setWalkInPhone(e.target.value)}
                                                                    style={{ width: '100%', padding: '6px 8px', fontSize: 'var(--font-size-xs)', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                                                                />
                                                            </>
                                                        )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="cart-table" style={{ marginTop: '20px' }}>
                                    <h4 style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '10px', textTransform: 'uppercase' }}>Items in Cart</h4>
                                    <table style={{ width: '100%', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                                                <th>Product</th>
                                                {settings.enable_sku === 'true' && <th>SKU</th>}
                                                <th style={{ textAlign: 'center' }}>Unit</th>
                                                <th style={{ textAlign: 'center' }}>Batch</th>
                                                <th style={{ textAlign: 'center' }}>Qty</th>
                                                <th style={{ textAlign: 'right' }}>Price</th>
                                                {settings.enable_gst_per_item === 'true' && <th style={{ textAlign: 'center' }}>GST</th>}
                                                {settings.enable_discount_per_item === 'true' && <th style={{ textAlign: 'center' }}>Disc</th>}
                                                <th style={{ textAlign: 'right' }}>Total</th>
                                                <th style={{ textAlign: 'right' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cart.filter(c => !c.is_free).length === 0 && (
                                                <tr>
                                                    <td colSpan={7 + (settings.enable_sku === 'true' ? 1 : 0) + (settings.enable_gst_per_item === 'true' ? 1 : 0) + (settings.enable_discount_per_item === 'true' ? 1 : 0)} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                                        No items added yet. Click "+" on products to add.
                                                    </td>
                                                </tr>
                                            )}
                                            {cart.filter(c => !c.is_free).map(item => (
                                                <tr key={item.cartRowId} style={{ borderTop: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: '10px 0' }}>
                                                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                                                    </td>
                                                    {settings.enable_sku === 'true' && (
                                                        <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                            {products.find(p => p.id === item.product_id)?.product_code || '—'}
                                                        </td>
                                                    )}
                                                    <td style={{ textAlign: 'center' }}>
                                                        {item.secondaryUnit ? (
                                                            <SButton
                                                                variant="secondary"
                                                                onClick={() => toggleUnit(item.cartRowId)}
                                                                style={{ color: 'var(--accent)', padding: '0 8px', height: '24px', fontSize: '11px', border: '1px solid var(--accent)', borderRadius: '4px' }}
                                                                title="Switch Unit"
                                                            >
                                                                {item.unit}
                                                            </SButton>
                                                        ) : (
                                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>{item.unit}</span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {item.track_batches ? (
                                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                                <span style={{ fontSize: '10px', color: item.batch_id ? 'var(--accent)' : 'var(--danger)', fontWeight: 600, background: item.batch_id ? 'rgba(var(--accent-rgb), 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid currentColor' }}>
                                                                    {item.batch_id ? ((item.available_batches || []).find(b => String(b.id) === String(item.batch_id))?.batch_number || 'B-Selected') : 'None'}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>—</span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div className="qty-display" style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>
                                                            {item.quantity}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 600 }}>₹{Number(item.price).toLocaleString('en-IN')}</div>
                                                    </td>
                                                    {settings.enable_gst_per_item === 'true' && (
                                                        <td style={{ textAlign: 'center' }}>
                                                            <div className="input-with-suffix" style={{ width: '85px', margin: '0 auto' }}>
                                                                <input
                                                                    type="number"
                                                                    value={item.gst_rate || 0}
                                                                    onChange={e => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        setCart(cart.map(c => (c.product_id === item.product_id && c.variant_id === item.variant_id && !c.is_free) ? { ...c, gst_rate: val } : c));
                                                                    }}
                                                                    style={{ width: '100%', padding: '6px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '4px', fontSize: 'var(--font-size-sm)' }}
                                                                />
                                                                <span className="suffix">%</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {settings.enable_discount_per_item === 'true' && (
                                                        <td style={{ textAlign: 'center' }}>
                                                            <div className="input-with-suffix" style={{ width: '85px', margin: '0 auto' }}>
                                                                <input
                                                                    type="number"
                                                                    value={item.discount_rate || 0}
                                                                    onChange={e => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        setCart(cart.map(c => (c.product_id === item.product_id && c.variant_id === item.variant_id && !c.is_free) ? { ...c, discount_rate: val } : c));
                                                                    }}
                                                                    style={{ width: '100%', padding: '6px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '4px', fontSize: 'var(--font-size-sm)' }}
                                                                />
                                                                <span className="suffix">%</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 600 }}>₹{(() => {
                                                            const baseTotal = item.quantity * item.price;
                                                            const diskRate = item.discount_rate || 0;
                                                            const gRate = item.gst_rate || 0;
                                                            const afterDisk = baseTotal - (baseTotal * (diskRate / 100));
                                                            const withGst = afterDisk + (afterDisk * (gRate / 100));
                                                            return withGst.toLocaleString('en-IN');
                                                        })()}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                            {item.track_batches && (
                                                                <SButton 
                                                                    variant="secondary"
                                                                    onClick={() => { setBatchModalItem(item); setShowBatchModal(true); }}
                                                                    title="Select Batch"
                                                                >
                                                                    <Icons.Layers size={14} />
                                                                </SButton>
                                                            )}
                                                            <SButton variant="secondary" tone="critical" onClick={() => removeFromCart(item.cartRowId)} title="Remove from Cart" aria-label={`Remove ${item.name} from cart`}>
                                                                <Icons.Trash size={14} />
                                                            </SButton>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="invoice-extras">
                                    {settings.enable_discount_per_item !== 'true' && (
                                        <div className={`extra-row ${discountEnabled ? 'active' : ''}`}>
                                            <div className="extra-label" onClick={() => setDiscountEnabled(!discountEnabled)}>
                                                <div className="toggle-switch">
                                                    <div className={`toggle-track ${discountEnabled ? 'on' : ''}`}></div>
                                                </div>
                                                <span>Discount (%)</span>
                                            </div>
                                            {discountEnabled && (
                                                <div className="input-with-suffix">
                                                    <input
                                                        type="number"
                                                        className="extra-input"
                                                        value={discountRate}
                                                        onChange={e => setDiscountRate(e.target.value)}
                                                    />
                                                    <span className="suffix">%</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {settings.enable_gst_per_item !== 'true' && (
                                        <div className={`extra-row ${gstEnabled ? 'active' : ''}`}>
                                            <div className="extra-label" onClick={() => setGstEnabled(!gstEnabled)}>
                                                <div className="toggle-switch">
                                                    <div className={`toggle-track ${gstEnabled ? 'on' : ''}`}></div>
                                                </div>
                                                <span>GST (%)</span>
                                            </div>
                                            {gstEnabled && (
                                                <div className="input-with-suffix">
                                                    <input
                                                        type="number"
                                                        className="extra-input"
                                                        value={gstRate}
                                                        onChange={e => setGstRate(e.target.value)}
                                                    />
                                                    <span className="suffix">%</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className={`extra-row ${promoExpenseEnabled ? 'active' : ''}`}>
                                        <div className="extra-label" onClick={() => setPromoExpenseEnabled(!promoExpenseEnabled)}>
                                            <div className="toggle-switch">
                                                <div className={`toggle-track ${promoExpenseEnabled ? 'on' : ''}`}></div>
                                            </div>
                                            <span>Promo Expense</span>
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: '500' }}>Count as marketing</div>
                                    </div>

                                    <div className={`extra-row ${isAdvance ? 'active' : ''}`}>
                                        <div className="extra-label" onClick={() => { setIsAdvance(!isAdvance); if (!isAdvance) setPaymentStatus('PAID'); }}>
                                            <div className="toggle-switch">
                                                <div className={`toggle-track ${isAdvance ? 'on' : ''}`}></div>
                                            </div>
                                            <span>Advance Payment?</span>
                                        </div>
                                        {isAdvance && (
                                            <div className="input-with-suffix">
                                                <input
                                                    type="number"
                                                    className="extra-input"
                                                    placeholder="Amount"
                                                    value={advanceAmount}
                                                    onChange={e => setAdvanceAmount(e.target.value)}
                                                    style={{ width: `${Math.max(120, (String(advanceAmount).length || 6) * 11)}px`, transition: 'width 0.1s ease' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {cart.some(c => c.is_free) && (
                                    <div className="free-items-summary" style={{ marginTop: '16px', padding: '12px', background: 'rgba(34, 197, 94, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '700', color: 'var(--success)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Icons.Package size={12} />
                                            FREE PERKS:
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {cart.filter(c => c.is_free).map(c => (
                                                <div key={c.cartRowId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)' }}>
                                                    <span style={{ fontWeight: '500' }}>{c.name} x {c.quantity}</span>
                                                    <SButton variant="secondary" tone="critical" style={{ padding: '2px' }} onClick={() => removeFromCart(c.cartRowId)} title="Remove Perk">
                                                        <Icons.X size={12} strokeWidth={2.5} />
                                                    </SButton>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="calculation-breakdown">
                                    <div className="break-item">
                                        <span>Subtotal</span>
                                        <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    {discountEnabled && (
                                        <div className="break-item discount">
                                            <span>Discount ({discountRate}%)</span>
                                            <span>-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {gstEnabled && (
                                        <div className="break-item">
                                            <span>GST ({gstRate}%)</span>
                                            <span>+₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                </div>

                                <div className={`invoice-total ${cartPulse ? 'pulse' : ''}`}>
                                    <span className="label">Grand Total</span>
                                    <span className="amount">₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>

                                {selectedCustomer && customers.find(c => String(c.id) === selectedCustomer)?.p_credit_balance > 0 && (
                                    <div className="p-credit-usage-box" style={{ marginTop: '10px', padding: '12px', background: 'rgba(var(--accent-rgb), 0.1)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--accent)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--accent)' }}>
                                                Available P-Credit: ₹{Number(customers.find(c => String(c.id) === selectedCustomer).p_credit_balance).toLocaleString('en-IN')}
                                            </div>
                                            <div className="toggle-switch" onClick={() => setUsePCredit(!usePCredit)}>
                                                <div className={`toggle-track ${usePCredit ? 'on' : ''}`}></div>
                                            </div>
                                        </div>
                                        {usePCredit && (
                                            <div className="form-group" style={{ marginTop: '10px', marginBottom: 0 }}>
                                                <label style={{ fontSize: 'var(--font-size-xs)' }}>Credit amount to use (₹)</label>
                                                <input
                                                    type="number"
                                                    value={pCreditToApply}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        const maxAvail = customers.find(c => String(c.id) === selectedCustomer).p_credit_balance;
                                                        if (val === '') setPCreditToApply('');
                                                        else if (Number(val) > maxAvail) setPCreditToApply(maxAvail);
                                                        else if (Number(val) > finalTotal) setPCreditToApply(finalTotal);
                                                        else setPCreditToApply(val);
                                                    }}
                                                    style={{ height: '32px', fontSize: 'var(--font-size-xs)' }}
                                                    placeholder="Enter amount..."
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="payment-selection-box" style={{ marginTop: '10px', padding: '12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', marginBottom: '8px' }}>Payment Status</div>
                                    {isAdvance ? (
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)', fontWeight: '600', padding: '8px', background: 'var(--bg-card)', borderRadius: '4px', textAlign: 'center' }}>
                                            ADVANCE MODE
                                        </div>
                                    ) : !selectedCustomer ? (
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success)', fontWeight: '700', padding: '10px', background: 'rgba(34, 197, 94, 0.08)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid rgba(34, 197, 94, 0.2)', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <Icons.Check size={14} strokeWidth={3} />
                                                WALK-IN: ALWAYS PAID
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="payment-options" style={{ display: 'flex', gap: '8px' }}>
                                            {['PAID', 'PARTIAL', 'UNPAID'].map(status => (
                                                <SButton
                                                    key={status}
                                                    variant={paymentStatus === status ? 'primary' : 'secondary'}
                                                    onClick={() => setPaymentStatus(status)}
                                                    style={{ flex: 1 }}
                                                >
                                                    {status.charAt(0) + status.slice(1).toLowerCase()}
                                                </SButton>
                                            ))}
                                        </div>
                                    )}

                                    {((paymentStatus !== 'UNPAID' || isAdvance) && !isAdvance) && (
                                        <div style={{ marginTop: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600' }}>Payments</label>
                                                <SButton 
                                                    variant="secondary"
                                                    onClick={() => setPayments([...payments, { method: settings.default_payment_method || DEFAULT_PAYMENT_METHOD, amount: '', transaction_id: '' }])}
                                                    style={{ color: 'var(--accent)', border: '1px dashed var(--accent)', padding: '2px 8px' }}
                                                >
                                                    + Add Mode
                                                </SButton>
                                            </div>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {payments.map((p, idx) => (
                                                    <div key={idx} style={{ background: 'var(--bg-card)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                            <div style={{ flex: 1 }}>
                                                                <select
                                                                    value={p.method}
                                                                    onChange={e => {
                                                                        const newPayments = [...payments];
                                                                        newPayments[idx] = { ...newPayments[idx], method: e.target.value };
                                                                        setPayments(newPayments);
                                                                    }}
                                                                    style={{ width: '100%', height: '42px', padding: '0 12px', fontSize: 'var(--font-size-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: '#fff', fontWeight: '500', outline: 'none' }}
                                                                >
                                                                    <option value="Cash">Cash</option>
                                                                    <option value="UPI">UPI</option>
                                                                    <option value="Card">Card</option>
                                                                    <option value="Cheque">Cheque</option>
                                                                    <option value="Wallet">Wallet</option>
                                                                </select>
                                                            </div>
                                                            <input 
                                                                type="number"
                                                                placeholder="Amount"
                                                                value={p.amount}
                                                                onChange={e => {
                                                                    const newPayments = [...payments];
                                                                    newPayments[idx].amount = e.target.value;
                                                                    setPayments(newPayments);
                                                                }}
                                                                style={{ flex: 2, height: '42px', padding: '0 12px', fontSize: 'var(--font-size-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: '#fff', fontWeight: '700' }}
                                                            />
                                                            {payments.length > 1 && (
                                                                <SButton 
                                                                    size="slim"
                                                                    tone="critical"
                                                                    onClick={() => setPayments(payments.filter((_, i) => i !== idx))}
                                                                    style={{ padding: '4px' }}
                                                                >
                                                                    <Icons.X size={14} />
                                                                </SButton>
                                                            )}
                                                        </div>
                                                        <input 
                                                            type="text"
                                                            placeholder="Transaction ID / Note (Optional)"
                                                            value={p.transaction_id}
                                                            onChange={e => {
                                                                const newPayments = [...payments];
                                                                newPayments[idx].transaction_id = e.target.value;
                                                                setPayments(newPayments);
                                                            }}
                                                            style={{ width: '100%', padding: '4px 8px', fontSize: '10px', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'transparent' }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>

                                            <div style={{ marginTop: '10px', padding: '6px', background: 'rgba(var(--accent-rgb), 0.05)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                <span style={{ color: 'var(--text-tertiary)' }}>Total Paid:</span>
                                                <span style={{ fontWeight: '700', color: 'var(--accent)' }}>₹{payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toLocaleString('en-IN')}</span>
                                            </div>
                                            {paymentStatus === 'PARTIAL' && (
                                                <div style={{ padding: '0 6px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}>
                                                    <span style={{ color: 'var(--text-tertiary)' }}>Remaining Due:</span>
                                                    <span style={{ fontWeight: '700', color: 'var(--danger)' }}>₹{(finalTotal - (payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0))).toLocaleString('en-IN')}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {isAdvance && (
                                        <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
                                            <label style={{ fontSize: 'var(--font-size-xs)' }}>Payment Method</label>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                {['Cash', 'UPI', 'Card', 'Bank'].map(method => (
                                                    <SButton
                                                        key={method}
                                                        variant={paymentMethod === method ? 'primary' : 'secondary'}
                                                        size="slim"
                                                        onClick={() => setPaymentMethod(method)}
                                                        style={{ flex: 1 }}
                                                    >
                                                        {method}
                                                    </SButton>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {paymentStatus === 'UNPAID' && (
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)', marginTop: '8px', fontWeight: '500' }}>
                                            Total balance will be added to Credit.
                                        </div>
                                    )}
                                </div>

                                <SButton
                                    variant="primary"
                                    style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: '12px' }}
                                    onClick={handleCreateInvoice}
                                    disabled={cart.length === 0 || saving}
                                    loading={saving}
                                >
                                    {saving ? 'Creating…' : 'Create Invoice'}
                                </SButton>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === 'ai-sales' && (
                <div className="ai-sales-dashboard">
                    <div className="view-header">
                        <h2>AI Agent Sales</h2>
                        <p>Orders pushed from Mazeway Voice and WhatsApp agents</p>
                    </div>

                    <div className="page-toolbar">
                        <div className="search-bar">
                            <Icons.Search size={20} />
                            <input
                                placeholder="Search AI orders by customer name or phone…"
                                value={aiSearch}
                                onChange={e => setAiSearch(e.target.value)}
                            />
                        </div>
                        <div className="page-toolbar-actions">
                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--text-secondary)' }}>CHANNEL:</span>
                            <CustomSelect
                                value={aiChannelFilter}
                                onChange={val => setAiChannelFilter(val)}
                                options={[
                                    { value: 'All', label: 'All Channels' },
                                    { value: 'Voice', label: 'Voice Agent' },
                                    { value: 'WhatsApp', label: 'WhatsApp Agent' }
                                ]}
                            />
                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--text-secondary)', marginLeft: '12px' }}>STATUS:</span>
                            <CustomSelect
                                value={aiStatusFilter}
                                onChange={val => setAiStatusFilter(val)}
                                options={[
                                    { value: 'All', label: 'All Status' },
                                    { value: 'NEW', label: 'Pending Confirmation' },
                                    { value: 'CONFIRMED', label: 'Confirmed' },
                                    { value: 'REJECTED', label: 'Rejected' }
                                ]}
                            />
                        </div>
                    </div>

                    <div className="ai-orders-grid">
                        {mazewayOrders.length === 0 ? (
                            <div className="empty-state-premium" style={{ gridColumn: '1 / -1' }}>
                                <div className="empty-icon-wrapper">
                                    <Icons.Activity size={40} strokeWidth={1.5} />
                                </div>
                                <h3>No AI Orders Yet</h3>
                                <p>Once your agents start making sales, they will appear here.</p>
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="empty-state-premium" style={{ gridColumn: '1 / -1' }}>
                                <div className="empty-icon-wrapper">
                                    <Icons.Search size={40} strokeWidth={1.5} />
                                </div>
                                <h3>No matching orders found</h3>
                                <p>Try adjusting your search keywords or filter selections.</p>
                            </div>
                        ) : (
                            filteredOrders.map(order => (
                                <div key={order.id} className={`ai-order-card glass ${order.status.toLowerCase()}`}>
                                    <div className="order-badge">
                                        {order.type === 'Voice' ? <Icons.Smartphone size={14} /> : <Icons.MessageSquare size={14} />}
                                        {order.type} Order
                                    </div>
                                    <div className="order-header">
                                        <div className="customer-info">
                                            <h4>{order.customer_name}</h4>
                                            <span>{order.customer_phone}</span>
                                        </div>
                                        <div className="order-total">₹{order.total.toLocaleString('en-IN')}</div>
                                    </div>
                                    <div className="order-items">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="order-item">
                                                <span>{item.name} x {item.quantity}</span>
                                                <span>₹{item.price * item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {order.notes && <div className="order-notes">"{order.notes}"</div>}
                                    <div className="order-footer">
                                        {order.status === 'NEW' ? (
                                            <>
                                                <SButton variant="secondary" tone="critical" onClick={() => handleUpdateMazewayStatus(order.id, 'REJECTED')}>Reject</SButton>
                                                <SButton variant="primary" onClick={() => handleUpdateMazewayStatus(order.id, 'CONFIRMED')}>Confirm</SButton>
                                            </>
                                        ) : (
                                            <div className={`status-pill ${order.status.toLowerCase()}`}>
                                                {order.status === 'CONFIRMED' ? <Icons.Check size={14} /> : <Icons.X size={14} />}
                                                {order.status}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {tab === 'history' && (
                <div className="history-view">
                    <div className="page-toolbar">
                        <div className="search-bar">
                            <Icons.Search size={20} />
                            <input
                                placeholder="Search by Invoice # or Customer name…"
                                value={historySearch}
                                onChange={e => setHistorySearch(e.target.value)}
                            />
                        </div>
                        <div className="page-toolbar-actions">
                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--text-tertiary)' }}>STATUS:</span>
                            <CustomSelect
                                value={paymentFilter}
                                onChange={val => setPaymentFilter(val)}
                                options={[
                                    { value: 'All', label: 'All Status' },
                                    { value: 'PAID', label: 'Paid Only' },
                                    { value: 'PARTIAL', label: 'Partial Dues' },
                                    { value: 'UNPAID', label: 'Unpaid (Credit)' }
                                ]}
                            />
                        </div>
                    </div>

                    <div className="history-table-wrap">
                        {invoices.length === 0 ? (
                            <div className="empty-state-premium">
                                <div className="empty-icon-wrapper">
                                    <Icons.History size={48} strokeWidth={1.5} />
                                </div>
                                <h3>No Sales Yet</h3>
                                <p>Start creating invoices to record your sales.</p>
                                <SButton variant="primary" onClick={() => setTab('new')} style={{ marginTop: '16px' }}>
                                    Create Invoice
                                </SButton>
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Invoice #</th>
                                        <th>Customer</th>
                                        <th>Total</th>
                                        <th>Paid</th>
                                        <th>Due</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices
                                        .filter(inv => {
                                            const searchLower = historySearch.toLowerCase();
                                            const invId = `INV-${String(inv.id).padStart(4, '0')}`.toLowerCase();
                                            const custName = (inv.customer_name || 'Walk-in').toLowerCase();
                                            const matchesSearch = invId.includes(searchLower) || custName.includes(searchLower);
                                            const matchesFilter = paymentFilter === 'All' || inv.payment_status === paymentFilter;
                                            return matchesSearch && matchesFilter;
                                        })
                                        .map(inv => {
                                            const originalTotal = Number(inv.total || 0);
                                            const returnedAmount = Number(inv.total_returned_amount || 0);
                                            const effectiveTotal = Math.max(0, originalTotal - returnedAmount);
                                            const paidAmount = Number(inv.paid_amount || 0);
                                            const effectiveDue = Math.max(0, effectiveTotal - paidAmount);

                                            // Determine display name for customer
                                            let displayName = inv.customer_name;
                                            if (!displayName) {
                                                if (inv.walk_in_name && inv.walk_in_phone) {
                                                    displayName = `${inv.walk_in_name} • ${inv.walk_in_phone}`;
                                                } else if (inv.walk_in_name) {
                                                    displayName = inv.walk_in_name;
                                                } else if (inv.walk_in_phone) {
                                                    displayName = inv.walk_in_phone;
                                                } else {
                                                    displayName = 'Walk-in';
                                                }
                                            }

                                            return (
                                                <tr key={inv.id}>
                                                    <td className="fw-500">INV-{String(inv.id).padStart(4, '0')}</td>
                                                    <td>{displayName}</td>
                                                    <td className="fw-600">₹{effectiveTotal.toLocaleString('en-IN')}</td>
                                                    <td className="text-secondary">₹{paidAmount.toLocaleString('en-IN')}</td>
                                                    <td className={effectiveDue > 0 ? 'text-danger fw-500' : 'text-success'}>₹{effectiveDue.toLocaleString('en-IN')}</td>
                                                    <td>
                                                        <div className="status-row">
                                                            {/* Fulfillment Status (Primary) */}
                                                            <span className={`payment-badge badge-${(inv.fulfillment_status || 'CONFIRMED').toLowerCase().replace(/_/g, '-')}`}>
                                                                {inv.payment_status === 'ADVANCE' ? '🟠 Advance' :
                                                                    inv.fulfillment_status === 'PENDING_PRODUCT' ? '🟣 Pending Product' :
                                                                        inv.fulfillment_status === 'CONFIRMED' ? '🔵 Confirmed' :
                                                                            inv.fulfillment_status === 'COMPLETED' ? '🟢 Completed' : inv.fulfillment_status}
                                                            </span>
                                                            {/* Payment Status (Secondary) */}
                                                            <span className={`secondary-badge badge-${(inv.financial_status || 'PAID').toLowerCase().replace(/_/g, '-').replace(/ /g, '-')}`}>
                                                                {inv.financial_status}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="text-secondary">{formatDate(inv.date)}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                            {inv.is_advance === 1 && inv.is_stock_deducted === 0 && (
                                                                <SButton 
                                                                    variant="primary"
                                                                    tone="success"
                                                                    title="Process Advance (Deduct Stock)"
                                                                    onClick={() => handleProcessAdvance(inv.id)}
                                                                >
                                                                    Confirm Stock Deduction
                                                                </SButton>
                                                            )}
                                                            {effectiveDue > 0 && (
                                                                <SButton
                                                                    variant="primary"
                                                                    onClick={() => {
                                                                        setUpdatingPaymentInvoice(inv);
                                                                        setNewPaymentAmount('');
                                                                        setUsePCreditInPayment(false);
                                                                        setPCreditToUseInPayment('');
                                                                    }}
                                                                    title="Add Payment"
                                                                >
                                                                    Pay
                                                                </SButton>
                                                            )}
                                                            {(inv.fulfillment_status === 'PENDING_PRODUCT' || inv.fulfillment_status === 'Partial') && (
                                                                <SButton
                                                                    variant="secondary"
                                                                    onClick={() => {
                                                                        setFulfillingInvoice(inv);
                                                                        const initialFulfillments = {};
                                                                        inv.items.forEach(item => {
                                                                            if (item.pending_qty > 0) initialFulfillments[item.product_id] = 0;
                                                                        });
                                                                        setFulfillmentQtys(initialFulfillments);
                                                                    }}
                                                                    title="Give Product"
                                                                >
                                                                    Give Product
                                                                </SButton>
                                                            )}
                                                            <SButton variant="secondary" onClick={() => handleViewInvoice(inv.id)} title="View Invoice">
                                                                <Icons.Eye size={14} />
                                                            </SButton>
                                                            {(inv.items && inv.items.length > 0) && (
                                                                <SButton variant="secondary" onClick={() => {
                                                                    setReturningInvoice(inv);
                                                                    const initialQtys = {};
                                                                    inv.items.forEach(item => initialQtys[item.product_id] = 0);
                                                                    setReturnQuantities(initialQtys);
                                                                }} title="Return Items">
                                                                    <Icons.RotateCcw size={14} />
                                                                </SButton>
                                                            )}
                                                            <SButton variant="secondary" tone="critical" onClick={() => setDeleteId(inv.id)} title="Delete Invoice" aria-label={`Delete invoice INV-${String(inv.id).padStart(4, '0')}`}>
                                                                <Icons.Trash size={14} />
                                                            </SButton>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )
            }

            {
                previewInvoice && (
                    <InvoicePreviewModal
                        invoice={previewInvoice}
                        onClose={() => setPreviewInvoice(null)}
                    />
                )
            }

            <Modal
                open={!!returningInvoice}
                onClose={() => setReturningInvoice(null)}
                heading={`Process Return (INV-${String(returningInvoice?.id).padStart(4, '0')})`}
                size="small"
            >
                <p style={{ marginBottom: 16 }}>Select the quantity of each product to return to stock.</p>
                <table className="return-table" style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '8px 0' }}>Product</th>
                            <th style={{ padding: '8px 0' }}>Sold</th>
                            <th style={{ padding: '8px 0' }}>Returning</th>
                        </tr>
                    </thead>
                    <tbody>
                        {returningInvoice?.items.map(item => (
                            <tr key={item.product_id} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '12px 0' }}>{item.product_name}</td>
                                <td style={{ padding: '12px 0' }}>{item.qty_delivered || item.quantity}</td>
                                <td style={{ padding: '12px 0' }}>
                                    <input
                                        type="number"
                                        className="modal-qty-input"
                                        min="0"
                                        max={item.qty_delivered || item.quantity}
                                        value={returnQuantities[item.product_id] || 0}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === '') {
                                                setReturnQuantities({ ...returnQuantities, [item.product_id]: '' });
                                            } else {
                                                setReturnQuantities({
                                                    ...returnQuantities,
                                                    [item.product_id]: Math.min((item.qty_delivered || item.quantity), Math.max(0, parseInt(val) || 0))
                                                });
                                            }
                                        }}
                                        style={{ width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)' }}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="mt-20" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
                    {(() => {
                        if (!returningInvoice) return null;
                        const subtotal = Object.entries(returnQuantities).reduce((sum, [pid, qty]) => {
                            const original = returningInvoice.items.find(i => String(i.product_id) === pid);
                            return sum + (Number(original?.price || 0) * (Number(qty) || 0));
                        }, 0);
                        const discount = subtotal * (returningInvoice.discount_rate / 100);
                        const afterDiscount = subtotal - discount;
                        const gst = afterDiscount * (returningInvoice.gst_rate / 100);
                        const totalReturnVal = afterDiscount + gst;

                        const currentPaid = Number(returningInvoice.paid_amount || 0);
                        const originalTotal = Number(returningInvoice.total || 0);
                        const returnedAmountSoFar = Number(returningInvoice.total_returned_amount || 0);
                        const currentEffectiveTotal = Math.max(0, originalTotal - returnedAmountSoFar);
                        const currentDue = Math.max(0, currentEffectiveTotal - currentPaid);

                        const isFullReturnNow = returningInvoice.items.every(item => {
                            const qtyRet = Number(returnQuantities[item.product_id] || 0);
                            return qtyRet === item.quantity;
                        });

                        const isPartialReturn = Object.values(returnQuantities).some(v => Number(v) > 0);

                        return isPartialReturn && (
                            <div style={{ width: '100%', textAlign: 'right', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>
                                    Return Amount: <span style={{ color: 'var(--accent)' }}>₹{totalReturnVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>

                                {isFullReturnNow ? (
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success)', marginTop: '4px' }}>
                                        {currentPaid > 0
                                            ? `Full Invoice Return. Entire ₹${currentPaid.toLocaleString('en-IN')} will be refunded.`
                                            : 'Full Invoice Return. No refund needed (Unpaid).'}
                                    </div>
                                ) : (
                                    <>
                                        {currentDue >= totalReturnVal ? (
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--warning)', marginTop: '4px' }}>
                                                Amount will be adjusted against outstanding due of ₹{currentDue.toLocaleString('en-IN')}.
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success)', marginTop: '4px' }}>
                                                ₹{currentDue.toLocaleString('en-IN')} will adjust due, ₹{(totalReturnVal - currentDue).toLocaleString('en-IN')} will be refunded.
                                            </div>
                                        )}
                                    </>
                                )}

                                <div style={{ width: '100%', display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                                    <SButton onClick={() => setReturningInvoice(null)}>Cancel</SButton>
                                    {totalReturnVal === 0 ? (
                                        <SButton variant="primary" onClick={() => handleProcessReturn('refund')} loading={saving}>
                                            Thank You
                                        </SButton>
                                    ) : currentDue < totalReturnVal ? (
                                        <>
                                            <SButton variant="primary" onClick={() => handleProcessReturn('refund')} loading={saving}>
                                                Refund Back
                                            </SButton>
                                            {returningInvoice.customer_id && (
                                                <SButton variant="primary" style={{ background: 'var(--accent)' }} onClick={() => handleProcessReturn('p_credit')} loading={saving}>
                                                    Convert to P-Credit
                                                </SButton>
                                            )}
                                        </>
                                    ) : (
                                        <SButton variant="primary" onClick={() => handleProcessReturn('refund')} loading={saving}>
                                            Confirm Return
                                        </SButton>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {!Object.values(returnQuantities).some(v => Number(v) > 0) && (
                        <div style={{ width: '100%', display: 'flex', gap: '8px', marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px', justifyContent: 'flex-end' }}>
                            <SButton onClick={() => setReturningInvoice(null)}>Cancel</SButton>
                            <SButton variant="primary" disabled={true}>Confirm Return</SButton>
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                open={!!updatingPaymentInvoice}
                onClose={() => setUpdatingPaymentInvoice(null)}
                heading={`Update Payment (INV-${String(updatingPaymentInvoice?.id).padStart(4, '0')})`}
                size="small"
                primaryAction={
                    <SButton
                        variant="primary"
                        onClick={handleUpdatePayment}
                        disabled={saving || (!newPaymentAmount && (!usePCreditInPayment || !pCreditToUseInPayment))}
                        loading={saving}
                    >
                        Confirm Payment
                    </SButton>
                }
                secondaryAction={
                    <SButton onClick={() => setUpdatingPaymentInvoice(null)}>Cancel</SButton>
                }
            >
                {(() => {
                    if (!updatingPaymentInvoice) return null;
                    const originalTotal = Number(updatingPaymentInvoice.total || 0);
                    const returnedAmount = Number(updatingPaymentInvoice.total_returned_amount || 0);
                    const effectiveTotal = Math.max(0, originalTotal - returnedAmount);
                    const paidAmount = Number(updatingPaymentInvoice.paid_amount || 0);
                    const effectiveDue = Math.max(0, effectiveTotal - paidAmount);

                    return (
                        <div className="payment-summary-small" style={{ marginBottom: '20px', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span className="text-secondary">Expected Total:</span>
                                <span className="fw-600">₹{effectiveTotal.toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span className="text-secondary">Already Paid:</span>
                                <span className="text-success fw-500">₹{paidAmount.toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                                <span className="text-secondary">Outstanding Due:</span>
                                <span className="text-danger fw-600">₹{effectiveDue.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    );
                })()}

                {(() => {
                    if (!updatingPaymentInvoice?.customer_id) return null;
                    const customer = customers.find(c => c.id === updatingPaymentInvoice.customer_id);
                    if (!customer || Number(customer.p_credit_balance || 0) <= 0) return null;

                    return (
                        <div className="p-credit-usage-box" style={{ marginBottom: '20px', padding: '16px', borderRadius: '8px', background: 'var(--accent-light)', border: '1px solid var(--accent)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: usePCreditInPayment ? '12px' : '0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icons.CreditCard size={18} style={{ color: 'var(--accent)' }} />
                                    <span style={{ fontWeight: '600', color: 'var(--accent)', fontSize: 'var(--font-size-sm)' }}>
                                        Customer P-Credit: ₹{Number(customer.p_credit_balance).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div className={`toggle-switch ${usePCreditInPayment ? 'active' : ''}`}
                                    onClick={() => {
                                        const newState = !usePCreditInPayment;
                                        setUsePCreditInPayment(newState);
                                        if (newState) {
                                            const originalTotal = Number(updatingPaymentInvoice.total || 0);
                                            const returnedAmount = Number(updatingPaymentInvoice.total_returned_amount || 0);
                                            const effectiveTotal = Math.max(0, originalTotal - returnedAmount);
                                            const paidAmount = Number(updatingPaymentInvoice.paid_amount || 0);
                                            const effectiveDue = Math.max(0, effectiveTotal - paidAmount);
                                            const maxUse = Math.min(effectiveDue, customer.p_credit_balance);
                                            setPCreditToUseInPayment(maxUse > 0 ? maxUse : '');
                                        } else {
                                            setPCreditToUseInPayment('');
                                        }
                                    }}
                                    style={{ cursor: 'pointer' }}>
                                    <div className={`toggle-track ${usePCreditInPayment ? 'on' : ''}`}></div>
                                </div>
                            </div>

                            {usePCreditInPayment && (
                                <div style={{ animation: 'slideDown 0.2s ease-out' }}>
                                    <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Credit Amount to Use</label>
                                    <div className="input-with-suffix">
                                        <input
                                            type="number"
                                            className="extra-input"
                                            style={{ width: '100%', textAlign: 'left', height: '36px' }}
                                            placeholder={`Enter amount (Max: ₹${customer.p_credit_balance.toLocaleString('en-IN')})`}
                                            value={pCreditToUseInPayment}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '') {
                                                    setPCreditToUseInPayment('');
                                                    return;
                                                }
                                                const numVal = Number(val);
                                                if (numVal > customer.p_credit_balance) {
                                                    setPCreditToUseInPayment(customer.p_credit_balance);
                                                } else {
                                                    setPCreditToUseInPayment(val);
                                                }
                                            }}
                                        />
                                        <span className="suffix">₹</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                <div className="form-group">
                    <label>Enter Cash/Online Payment (₹)</label>
                    <input
                        type="number"
                        value={newPaymentAmount}
                        onChange={e => {
                            const val = e.target.value;
                            if (val === '') setNewPaymentAmount('');
                            else setNewPaymentAmount(val);
                        }}
                        placeholder="Enter amount user is paying now..."
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label>Payment Method</label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        {['Cash', 'UPI', 'Card', 'Bank'].map(method => (
                            <SButton
                                key={method}
                                variant={paymentMethod === method ? 'primary' : 'secondary'}
                                onClick={() => setPaymentMethod(method)}
                                style={{ flex: 1 }}
                            >
                                {method}
                            </SButton>
                        ))}
                    </div>
                </div>
            </Modal>

            <Modal
                open={!!fulfillingInvoice}
                onClose={() => setFulfillingInvoice(null)}
                heading={`Fulfill Pending Items (INV-${String(fulfillingInvoice?.id).padStart(4, '0')})`}
                size="medium"
                primaryAction={
                    <SButton variant="primary" onClick={handleFulfill} loading={saving}>
                        Fulfill Items
                    </SButton>
                }
                secondaryAction={
                    <SButton onClick={() => setFulfillingInvoice(null)}>Cancel</SButton>
                }
            >
                <p style={{ marginBottom: 16 }}>Enter the quantity of each product to deliver from current stock.</p>
                <table className="return-table" style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '8px 0' }}>Product</th>
                            <th style={{ padding: '8px 0' }}>Pending</th>
                            <th style={{ padding: '8px 0' }}>In Stock</th>
                            <th style={{ padding: '8px 0' }}>Fulfill</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fulfillingInvoice?.items.filter(i => i.pending_qty > 0).map(item => {
                            const product = products.find(p => p.id === item.product_id);
                            const stock = product ? product.stock_quantity : 0;
                            return (
                                <tr key={item.product_id} style={{ borderTop: '1px solid var(--border)' }}>
                                    <td style={{ padding: '12px 0' }}>{item.product_name}</td>
                                    <td style={{ padding: '12px 0' }}>{item.pending_qty}</td>
                                    <td style={{ padding: '12px 0', color: stock === 0 ? 'var(--danger)' : 'inherit' }}>{stock}</td>
                                    <td style={{ padding: '12px 0' }}>
                                        <input
                                            type="number"
                                            className="modal-qty-input"
                                            min="0"
                                            max={Math.min(item.pending_qty, stock)}
                                            value={fulfillmentQtys[item.product_id] || 0}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val === '') {
                                                    setFulfillmentQtys({ ...fulfillmentQtys, [item.product_id]: '' });
                                                } else {
                                                    const num = parseFloat(val) || 0;
                                                    setFulfillmentQtys({
                                                        ...fulfillmentQtys,
                                                        [item.product_id]: Math.min(item.pending_qty, Math.max(0, num))
                                                    });
                                                }
                                            }}
                                            style={{ width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)' }}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Modal>

            <Modal
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                heading="Delete Invoice"
                size="small"
                variant="critical"
                primaryAction={
                    <SButton variant="primary" tone="critical" onClick={handleDeleteInvoice}>Delete</SButton>
                }
                secondaryAction={
                    <SButton onClick={() => setDeleteId(null)}>Cancel</SButton>
                }
            >
                <div style={{ padding: '8px 0' }}>
                    <p style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', marginBottom: '8px' }}>Are you sure?</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '8px' }}>
                        Are you sure you want to delete this invoice? This action <strong style={{ color: 'var(--danger)' }}>cannot be undone</strong>.
                    </p>
                    <p style={{ color: 'var(--danger)', fontSize: 'var(--font-size-xs)', fontWeight: '500' }}>
                        Warning: Products will not be returned to inventory, and unpaid amounts will no longer be tracked.
                    </p>
                </div>
            </Modal>
            <Modal
                open={showFreePerkModal}
                onClose={() => setShowFreePerkModal(false)}
                heading="Select Free Perk"
                size="medium"
                secondaryAction={
                    <SButton onClick={() => setShowFreePerkModal(false)}>Cancel</SButton>
                }
            >
                <div className="search-bar" style={{ width: '100%', marginBottom: '16px' }}>
                    <Icons.Search size={20} />
                    <input
                        placeholder="Search product for free perk…"
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        autoFocus
                    />
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    {allFiltered.map(p => (
                        <div key={p.id} className="product-picker-item" style={{ border: 'none', borderBottom: '1px solid var(--border-light)', borderRadius: 0 }}>
                            <div className="p-main">
                                <span className="p-name">{p.name}</span>
                                <span className="p-stock">Stock: {p.stock_quantity}</span>
                            </div>
                            <div className="p-side">
                                <SButton variant="primary" size="small" onClick={() => {
                                    if (p.stock_quantity <= 0) {
                                        alert("Insufficient stock for free item.");
                                        return;
                                    }
                                    addToCart(p, true);
                                    setShowFreePerkModal(false);
                                }}>
                                    Add Free
                                </SButton>
                            </div>
                        </div>
                    ))}
                    {allFiltered.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No products found</div>
                    )}
                </div>
            </Modal>

            <Modal
                open={!!variantModalProduct}
                onClose={() => setVariantModalProduct(null)}
                heading={`Select Variant: ${variantModalProduct?.name}`}
                size="small"
                secondaryAction={
                    <SButton onClick={() => setVariantModalProduct(null)}>Cancel</SButton>
                }
            >
                <div className="variants-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                    {variantModalVariants.map(v => (
                        <div
                            key={v.id}
                            className={`variant-card ${v.stock_quantity <= 0 ? 'unavailable' : ''}`}
                            onClick={() => v.stock_quantity > 0 && addFinalToCart(variantModalProduct, v)}
                            style={{
                                padding: '12px 16px',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                cursor: v.stock_quantity > 0 ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: v.stock_quantity <= 0 ? '#f8f9fa' : '#fff',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 600, color: v.stock_quantity <= 0 ? '#999' : 'inherit' }}>{v.name}</div>
                                <div style={{ fontSize: '12px', color: '#666' }}>SKU: {v.sku || 'N/A'} • Stock: {v.stock_quantity}</div>
                            </div>
                            <div style={{ fontWeight: 700, color: 'var(--accent)' }}>₹{Number(v.selling_price).toLocaleString('en-IN')}</div>
                        </div>
                    ))}
                </div>
            </Modal>

            <Modal
                open={showBatchModal && !!batchModalItem}
                onClose={() => { setShowBatchModal(false); setBatchModalItem(null); }}
                heading="Select Batch"
                size="medium"
                secondaryAction={
                    <SButton onClick={() => { setShowBatchModal(false); setBatchModalItem(null); }}>Close</SButton>
                }
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(var(--accent-rgb), 0.1)', color: 'var(--accent)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icons.Layers size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{batchModalItem?.name}</p>
                    </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-primary)', position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ textAlign: 'left', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <th style={{ padding: '12px 16px' }}>Batch Number</th>
                            <th style={{ padding: '12px 16px' }}>Expiry</th>
                            <th style={{ padding: '12px 16px' }}>In Stock</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(batchModalItem?.available_batches || []).length === 0 ? (
                            <tr><td colSpan="4" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No batches available for this product.</td></tr>
                        ) : (
                            batchModalItem?.available_batches.map(batch => (
                                <tr key={batch.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                    <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{batch.batch_number}</td>
                                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>{batch.expiry_date || '—'}</td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{ fontWeight: 700, borderRadius: '4px', fontSize: '13px' }}>
                                            {batch.current_quantity} {batchModalItem?.unit}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <SButton 
                                            variant={String(batchModalItem?.batch_id) === String(batch.id) ? 'primary' : 'secondary'}
                                            size="small"
                                            onClick={() => {
                                                setCart(cart.map(c => 
                                                    c.cartRowId === batchModalItem.cartRowId ? { ...c, batch_id: batch.id } : c
                                                ));
                                                setShowBatchModal(false);
                                                setBatchModalItem(null);
                                                toast.success(`Batch ${batch.batch_number} selected`);
                                            }}
                                        >
                                            {String(batchModalItem?.batch_id) === String(batch.id) ? 'Selected' : 'Select'}
                                        </SButton>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Modal>
        </div>
    );
}
