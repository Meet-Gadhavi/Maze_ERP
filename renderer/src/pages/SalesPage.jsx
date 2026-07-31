import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';
import CustomSelect from '../components/CustomSelect';
import { jsPDF } from 'jspdf';
import Modal from '../components/Modal';
import SButton from '../components/SButton';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import QuotationPreviewModal from '../components/QuotationPreviewModal';
import { Icons } from '../components/Icons';
import { formatDate } from '../utils';
import QuickSaleView from '../components/QuickSaleView';
import { LineChart } from '@mui/x-charts/LineChart';
import './SalesPage.css';

const DEFAULT_PAYMENT_METHOD = 'Cash';

export default function SalesPage() {
    const [tab, setTab] = useState('new');
    const [mazewayOrders, setMazewayOrders] = useState([]);
    const [aiSearch, setAiSearch] = useState('');
    const [aiChannelFilter, setAiChannelFilter] = useState('All');
    const [aiStatusFilter, setAiStatusFilter] = useState('All');
    const [convertedOrderId, setConvertedOrderId] = useState(null);

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

    // Coupon States
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [couponCode, setCouponCode] = useState('');
    const [loadingCoupon, setLoadingCoupon] = useState(false);

    // Pricelist States
    const [pricelists, setPricelists] = useState([]);
    const [selectedPricelistId, setSelectedPricelistId] = useState('');
    const [showPricelistDropdown, setShowPricelistDropdown] = useState(false);

    // Payment Status State
    const [paymentStatus, setPaymentStatus] = useState('PAID'); // 'PAID', 'PARTIAL', 'UNPAID'
    const [paymentMethod, setPaymentMethod] = useState(DEFAULT_PAYMENT_METHOD); 
    const [payments, setPayments] = useState([{ method: DEFAULT_PAYMENT_METHOD, amount: '', transaction_id: '' }]);
    const [paymentFilter, setPaymentFilter] = useState('All');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [updatingPaymentInvoice, setUpdatingPaymentInvoice] = useState(null);
    const [newPaymentAmount, setNewPaymentAmount] = useState('');
    const [usePCreditInPayment, setUsePCreditInPayment] = useState(false);
    const [pCreditToUseInPayment, setPCreditToUseInPayment] = useState('');
    const [usePCredit, setUsePCredit] = useState(false);
    const [pCreditToApply, setPCreditToApply] = useState('');
    const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
    const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState('');

    const [showFreePerkModal, setShowFreePerkModal] = useState(false);
    const [promoExpenseEnabled, setPromoExpenseEnabled] = useState(false);

    // Advance Payment States
    const [isAdvance, setIsAdvance] = useState(false);
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [cartPulse, setCartPulse] = useState(false);

    // Variant Selection Modal
    const [variantModalProduct, setVariantModalProduct] = useState(null);
    const [variantModalVariants, setVariantModalVariants] = useState([]);
    const [variantModalSource, setVariantModalSource] = useState('cart'); // 'cart' or 'quotation'

    // Invoice logs states
    const [viewingLogsInvoiceId, setViewingLogsInvoiceId] = useState(null);
    const [invoiceLogs, setInvoiceLogs] = useState([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [variantModalLoading, setVariantModalLoading] = useState(false);
    
    // Batch Selection Modal State
    const [batchModalItem, setBatchModalItem] = useState(null);
    const [showBatchModal, setShowBatchModal] = useState(false);

    // Serial/IMEI Selection Modal States
    const [showSerialSelectModal, setShowSerialSelectModal] = useState(false);
    const [serialSelectCartRowId, setSerialSelectCartRowId] = useState(null);
    const [availableSerials, setAvailableSerials] = useState([]);
    const [selectedSerials, setSelectedSerials] = useState([]);
    const [serialSelectLoading, setSerialSelectLoading] = useState(false);
    const [serialSearchQuery, setSerialSearchQuery] = useState('');

    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
    const lastSelectedInvoiceCount = React.useRef(0);
    if (selectedInvoiceIds.length > 0) {
        lastSelectedInvoiceCount.current = selectedInvoiceIds.length;
    }
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [mergeCustomer, setMergeCustomer] = useState('');
    const [mergeWalkInName, setMergeWalkInName] = useState('');
    const [mergeWalkInPhone, setMergeWalkInPhone] = useState('');
    const [merging, setMerging] = useState(false);

    // Quotations State
    const [quotations, setQuotations] = useState([]);
    const [quotationMode, setQuotationMode] = useState('list'); // 'list' or 'create'
    const [quotationName, setQuotationName] = useState('');
    const [quotationCart, setQuotationCart] = useState([]);
    const [quotationCustomer, setQuotationCustomer] = useState(null); // null, or customer object
    const [quotationWalkInName, setQuotationWalkInName] = useState('');
    const [quotationWalkInPhone, setQuotationWalkInPhone] = useState('');
    const [quotationGstEnabled, setQuotationGstEnabled] = useState(false);
    const [quotationGstRate, setQuotationGstRate] = useState(18);
    const [quotationDiscountEnabled, setQuotationDiscountEnabled] = useState(false);
    const [quotationDiscountRate, setQuotationDiscountRate] = useState(0);
    const [quotationProductSearch, setQuotationProductSearch] = useState('');
    const [selectedQuotation, setSelectedQuotation] = useState(null); // for preview modal
    const [loadingQuotationTemplate, setLoadingQuotationTemplate] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [templateSearch, setTemplateSearch] = useState('');
    const [showCustomerSelectForConvert, setShowCustomerSelectForConvert] = useState(null); // quotation object being converted
    const [selectedCustomerForConvert, setSelectedCustomerForConvert] = useState(''); // customer id
    const [walkInNameForConvert, setWalkInNameForConvert] = useState('');
    const [walkInPhoneForConvert, setWalkInPhoneForConvert] = useState('');
    const [quotationSearch, setQuotationSearch] = useState('');

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const searchLower = historySearch.toLowerCase();
            const invId = `INV-${String(inv.id).padStart(4, '0')}`.toLowerCase();
            const custName = (inv.customer_name || 'Walk-in').toLowerCase();
            const matchesSearch = invId.includes(searchLower) || custName.includes(searchLower);
            const matchesFilter = paymentFilter === 'All' || inv.payment_status === paymentFilter;
            const matchesCategory = categoryFilter === 'All' || (inv.items && inv.items.some(item => (item.category || 'General') === categoryFilter));
            return matchesSearch && matchesFilter && matchesCategory;
        });
    }, [invoices, historySearch, paymentFilter, categoryFilter]);

    const [historyPage, setHistoryPage] = useState(1);
    const HISTORY_PAGE_SIZE = 50;
    const totalHistoryPages = Math.max(1, Math.ceil(filteredInvoices.length / HISTORY_PAGE_SIZE));
    const paginatedInvoices = useMemo(() => {
        return filteredInvoices.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);
    }, [filteredInvoices, historyPage]);

    useEffect(() => {
        setHistoryPage(1);
    }, [historySearch, paymentFilter, categoryFilter]);

    const [settings, setSettings] = useState({});

    useEffect(() => {
        api.getSettings().then(setSettings).catch(console.error);
        api.getCustomers().then(setCustomers).catch(() => { });
        api.getProducts().then(setProducts).catch(() => { });
        api.getPricelists().then(data => setPricelists((data || []).filter(pl => pl.active === 1))).catch(() => { });
        loadHistory();
        loadQuotations();
        setSelectedInvoiceIds([]);
        if (tab === 'new') setStep('customer');
        if (tab === 'ai-sales') loadMazewayOrders();
        if (tab === 'quotation') loadQuotations();
    }, [tab]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''));
        const previewId = params.get('preview');
        if (previewId) {
            const cleanHash = window.location.hash.split('?')[0];
            window.history.replaceState(null, '', window.location.pathname + cleanHash);
            handleViewInvoice(Number(previewId));
        }
    }, [invoices]);

    // Session Recovery: Restore saved sales session on load if recovery requested or saved session exists
    useEffect(() => {
        const isRestorePending = localStorage.getItem('quantro_restore_pending') === 'true';
        const savedSessionStr = localStorage.getItem('quantro_sales_cart_session');

        if ((isRestorePending || savedSessionStr) && savedSessionStr) {
            try {
                const sessionData = JSON.parse(savedSessionStr);
                if (sessionData) {
                    if (Array.isArray(sessionData.cart) && sessionData.cart.length > 0) {
                        setCart(sessionData.cart);
                    }
                    if (sessionData.selectedCustomer !== undefined) setSelectedCustomer(String(sessionData.selectedCustomer));
                    if (sessionData.step) setStep(sessionData.step);
                    if (sessionData.walkInName !== undefined) setWalkInName(sessionData.walkInName);
                    if (sessionData.walkInPhone !== undefined) setWalkInPhone(sessionData.walkInPhone);
                    if (sessionData.gstEnabled !== undefined) setGstEnabled(sessionData.gstEnabled);
                    if (sessionData.gstRate !== undefined) setGstRate(sessionData.gstRate);
                    if (sessionData.discountEnabled !== undefined) setDiscountEnabled(sessionData.discountEnabled);
                    if (sessionData.discountRate !== undefined) setDiscountRate(sessionData.discountRate);
                    if (sessionData.selectedPricelistId !== undefined) setSelectedPricelistId(sessionData.selectedPricelistId);
                    if (sessionData.selectedTemplateId !== undefined) setSelectedTemplateId(sessionData.selectedTemplateId);

                    if (isRestorePending) {
                        toast.success('Session restored! Cart items and customer configuration recovered.', { duration: 4000 });
                        localStorage.removeItem('quantro_restore_pending');
                    }
                }
            } catch (err) {
                console.error('[SessionRecovery] Failed to restore session data:', err);
            }
        }
    }, []);

    // Session Recovery: Auto-persist active cart and customer state for recovery
    useEffect(() => {
        if (cart.length > 0 || (selectedCustomer && selectedCustomer !== '') || step === 'products') {
            const sessionData = {
                cart,
                selectedCustomer,
                step,
                walkInName,
                walkInPhone,
                gstEnabled,
                gstRate,
                discountEnabled,
                discountRate,
                selectedPricelistId,
                selectedTemplateId,
                timestamp: Date.now()
            };
            localStorage.setItem('quantro_sales_cart_session', JSON.stringify(sessionData));
        } else if (cart.length === 0 && !selectedCustomer && step === 'customer') {
            localStorage.removeItem('quantro_sales_cart_session');
        }
    }, [cart, selectedCustomer, step, walkInName, walkInPhone, gstEnabled, gstRate, discountEnabled, discountRate, selectedPricelistId, selectedTemplateId]);

    const handleSelectCustomer = (customer) => {
        setCart([]);
        setSelectedTemplateId(null);
        if (!customer) {
            setSelectedCustomer('');
            setDiscountRate(0);
            setDiscountEnabled(false);
            setStep('products');
            setPaymentStatus('PAID');
        } else {
            setSelectedCustomer(String(customer.id));
            setStep('products');
            const tier = customer.tier || 'C';
            const discountKey = `tier_${tier.toLowerCase()}_discount`;
            const pct = parseFloat(settings[discountKey] ?? '0');
            if (pct > 0) {
                setDiscountRate(pct);
                setDiscountEnabled(true);
                toast.success(`Tier ${tier} Customer: Auto-applied default ${pct}% discount`);
            } else {
                setDiscountRate(0);
                setDiscountEnabled(false);
            }
        }
    };

    const handleBackToCustomers = () => {
        setCart([]);
        setSelectedTemplateId(null);
        setGstEnabled(false);
        setDiscountEnabled(false);
        setDiscountRate(0);
        setSelectedCustomer('');
        setWalkInName('');
        setWalkInPhone('');
        setStep('customer');
        localStorage.removeItem('quantro_sales_cart_session');
    };

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
            const availableStock = i.unit === i.secondaryUnit ? Math.floor(i.maxStock / i.conversionFactor) : i.maxStock;
            const chargeQty = (settings.include_pending_price === 'false')
                ? (isAdvance ? 0 : (availableStock <= 0 ? 0 : Math.min(i.quantity, availableStock)))
                : i.quantity;
            const base = (Number(i.price) || 0) * chargeQty;
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
                const availableStock = item.unit === item.secondaryUnit ? Math.floor(item.maxStock / item.conversionFactor) : item.maxStock;
                const chargeQty = (settings.include_pending_price === 'false')
                    ? (isAdvance ? 0 : (availableStock <= 0 ? 0 : Math.min(item.quantity, availableStock)))
                    : item.quantity;
                const baseTotal = chargeQty * (Number(item.price) || 0);
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
    }, [cart, discountRate, gstRate, discountEnabled, gstEnabled, settings, selectedCustomer, walkInName, customers, isAdvance]);


    async function loadHistory() {
        try {
            const data = await api.getInvoices();
            setInvoices(data);
        } catch (err) {
            console.error(err);
        }
    }

    async function loadQuotations() {
        try {
            const data = await api.getQuotations();
            setQuotations(data || []);
        } catch (err) {
            console.error('Failed to load quotations', err);
        }
    }

    async function handleDeleteQuotation(id) {
        if (!window.confirm('Are you sure you want to delete this quotation?')) return;
        try {
            await api.deleteQuotation(id);
            toast.success('Quotation deleted successfully');
            loadQuotations();
        } catch (err) {
            toast.error(err.message || 'Failed to delete quotation');
        }
    }

    async function handleCreateQuotation() {
        if (!quotationName.trim()) {
            toast.error('Quotation Name/Title is required');
            return;
        }
        if (quotationCart.length === 0) {
            toast.error('Quotation must contain at least one item');
            return;
        }

        const subtotal = quotationCart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
        const discountAmount = quotationDiscountEnabled ? (subtotal * (Number(quotationDiscountRate) / 100)) : 0;
        const gstAmount = quotationGstEnabled ? ((subtotal - discountAmount) * (Number(quotationGstRate) / 100)) : 0;
        const total = subtotal - discountAmount + gstAmount;

        const payload = {
            name: quotationName.trim(),
            customer_id: quotationCustomer ? Number(quotationCustomer.id) : null,
            discount_rate: quotationDiscountEnabled ? Number(quotationDiscountRate) : 0,
            gst_rate: quotationGstEnabled ? Number(quotationGstRate) : 0,
            walk_in_name: (quotationWalkInName || '').trim(),
            walk_in_phone: (quotationWalkInPhone || '').trim(),
            total: total,
            items: quotationCart.map(item => ({
                product_id: Number(item.product_id),
                product_name: item.name,
                quantity: Number(item.quantity),
                unit: item.unit || 'PCS',
                price: Number(item.price),
                total: Number(item.price) * Number(item.quantity)
            }))
        };

        try {
            await api.createQuotation(payload);
            toast.success('Quotation saved successfully');
            setQuotationName('');
            setQuotationCart([]);
            setQuotationCustomer(null);
            setQuotationWalkInName('');
            setQuotationWalkInPhone('');
            setQuotationGstEnabled(false);
            setQuotationDiscountEnabled(false);
            setQuotationDiscountRate(0);
            setQuotationMode('list');
            loadQuotations();
        } catch (err) {
            toast.error(err.message || 'Failed to save quotation');
        }
    }

    async function addToQuotationCart(product) {
        try {
            setVariantModalLoading(true);
            const variants = await api.getVariants(product.id);
            setVariantModalLoading(false);
            if (variants && variants.length > 0) {
                setVariantModalProduct(product);
                setVariantModalVariants(variants);
                setVariantModalSource('quotation');
                return; // Wait for variant selection
            }
        } catch (err) {
            console.error('Failed to check variants', err);
            setVariantModalLoading(false);
        }
        addFinalToQuotationCart(product, null);
    }

    function addFinalToQuotationCart(product, variant = null) {
        const productId = product.id;
        const variantId = variant ? variant.id : null;
        const price = variant ? Number(variant.selling_price) : Number(product.selling_price);

        const existingIdx = quotationCart.findIndex(c => c.product_id === productId && c.variant_id === variantId);
        if (existingIdx > -1) {
            setQuotationCart(quotationCart.map((c, idx) => 
                idx === existingIdx 
                    ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.price }
                    : c
            ));
        } else {
            setQuotationCart([...quotationCart, {
                product_id: productId,
                variant_id: variantId,
                name: variant ? `${product.name} - ${variant.name}` : product.name,
                price: price,
                quantity: 1,
                unit: product.unit || 'PCS',
                total: price
            }]);
        }
    }

    function updateQuotationProductTotalQty(product, newTotalQty) {
        if (newTotalQty <= 0) {
            setQuotationCart(quotationCart.filter(c => c.product_id !== product.id || c.variant_id));
            return;
        }
        const itemTemplate = quotationCart.find(c => c.product_id === product.id && !c.variant_id);
        if (!itemTemplate) return;

        let validQty = Math.max(0.001, newTotalQty);
        if (!product.allow_decimal) {
            validQty = Math.floor(validQty);
            if (validQty < 1) validQty = 1;
        }

        setQuotationCart(quotationCart.map(c => 
            (c.product_id === product.id && !c.variant_id)
                ? { ...c, quantity: validQty, total: validQty * c.price }
                : c
        ));
    }

    function handleQuotationConvert(q) {
        // Go directly to cart with the quotation's existing customer info
        if (q.customer_id) {
            proceedWithQuotationConvert(q, String(q.customer_id), '', '');
        } else {
            proceedWithQuotationConvert(q, 'walk-in', q.walk_in_name || 'Walk-in Customer', q.walk_in_phone || '');
        }
    }

    async function handleCreateQuotationAndConvert() {
        if (!quotationName.trim()) {
            toast.error('Quotation Name/Title is required');
            return;
        }
        if (quotationCart.length === 0) {
            toast.error('Quotation must contain at least one item');
            return;
        }

        const subtotal = quotationCart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
        const discountAmount = quotationDiscountEnabled ? (subtotal * (Number(quotationDiscountRate) / 100)) : 0;
        const gstAmount = quotationGstEnabled ? ((subtotal - discountAmount) * (Number(quotationGstRate) / 100)) : 0;
        const total = subtotal - discountAmount + gstAmount;

        const payload = {
            name: quotationName.trim(),
            customer_id: quotationCustomer ? Number(quotationCustomer.id) : null,
            discount_rate: quotationDiscountEnabled ? Number(quotationDiscountRate) : 0,
            gst_rate: quotationGstEnabled ? Number(quotationGstRate) : 0,
            walk_in_name: (quotationWalkInName || '').trim(),
            walk_in_phone: (quotationWalkInPhone || '').trim(),
            total: total,
            items: quotationCart.map(item => ({
                product_id: Number(item.product_id),
                product_name: item.name,
                quantity: Number(item.quantity),
                unit: item.unit || 'PCS',
                price: Number(item.price),
                total: Number(item.price) * Number(item.quantity)
            }))
        };

        try {
            const saved = await api.createQuotation(payload);
            toast.success('Quotation saved. Select a customer to create the order.');
            // Reset form
            setQuotationName('');
            setQuotationCart([]);
            setQuotationCustomer(null);
            setQuotationWalkInName('');
            setQuotationWalkInPhone('');
            setQuotationGstEnabled(false);
            setQuotationDiscountEnabled(false);
            setQuotationDiscountRate(0);
            setQuotationMode('list');
            loadQuotations();
            // Now trigger the convert flow with the saved quotation
            const savedQ = { ...payload, id: saved?.id, gst_rate: payload.gst_rate, discount_rate: payload.discount_rate, walk_in_name: payload.walk_in_name, walk_in_phone: payload.walk_in_phone, customer_id: payload.customer_id };
            handleQuotationConvert(savedQ);
        } catch (err) {
            toast.error(err.message || 'Failed to save quotation');
        }
    }

    async function proceedWithQuotationConvert(q, customerIdOrType, walkInNameVal, walkInPhoneVal) {
        const quotationDetails = await api.getQuotation(q.id);
        if (!quotationDetails || !quotationDetails.items) {
            toast.error('Failed to retrieve quotation details');
            return;
        }

        if (customerIdOrType === 'walk-in') {
            setSelectedCustomer('');
            setWalkInName(walkInNameVal);
            setWalkInPhone(walkInPhoneVal);
        } else {
            setSelectedCustomer(String(customerIdOrType));
            setWalkInName('');
            setWalkInPhone('');
        }

        const newCartItems = [];
        for (const item of quotationDetails.items) {
            const product = products.find(p => p.id === item.product_id);
            const price = Number(item.price);
            const qty = Number(item.quantity);

            newCartItems.push({
                cartRowId: Date.now().toString() + Math.random().toString() + item.id,
                product_id: item.product_id,
                variant_id: item.variant_id || null,
                name: item.product_name,
                subcategory_name: product ? (product.subcategory_name || '') : '',
                price: price,
                original_price: product ? Number(product.selling_price) : price,
                quantity: qty,
                total: price * qty,
                maxStock: product ? Number(product.stock_quantity) : qty,
                unit: item.unit || (product ? product.unit : 'PCS'),
                baseUnit: product ? (product.unit || 'PCS') : 'PCS',
                secondaryUnit: product ? product.secondary_unit : null,
                conversionFactor: product ? (product.conversion_factor || 1) : 1,
                allowDecimal: product ? !!product.allow_decimal : false,
                is_free: false,
                gst_rate: q.gst_rate || 0,
                discount_rate: q.discount_rate || 0,
                track_batches: settings.enable_batch_system === 'true',
                batch_id: '',
                available_batches: [],
                track_serials: product ? !!product.track_serials : false,
                serials: []
            });
        }

        setCart(newCartItems);
        
        if (q.gst_rate > 0) {
            setGstEnabled(true);
            setGstRate(q.gst_rate);
        } else {
            setGstEnabled(false);
        }

        if (q.discount_rate > 0) {
            setDiscountEnabled(true);
            setDiscountRate(q.discount_rate);
        } else {
            setDiscountEnabled(false);
            setDiscountRate(0);
        }

        setTab('new');
        setStep('products');
        setShowCustomerSelectForConvert(null);
        toast.success(`Quotation "${quotationDetails.name}" converted to order. Verify and finalize invoice below.`);
    }

    async function handleLoadQuotationTemplate(quotationId) {
        if (!quotationId) return;
        setLoadingQuotationTemplate(true);
        try {
            const q = await api.getQuotation(quotationId);
            if (!q || !q.items || q.items.length === 0) {
                toast.error('This quotation has no items.');
                return;
            }
            const newItems = [];
            for (const item of q.items) {
                const product = products.find(p => p.id === item.product_id);
                const price = Number(item.price);
                const qty = Number(item.quantity);
                newItems.push({
                    cartRowId: Date.now().toString() + Math.random().toString() + item.id,
                    product_id: item.product_id,
                    variant_id: item.variant_id || null,
                    name: item.product_name,
                    subcategory_name: product ? (product.subcategory_name || '') : '',
                    price: price,
                    original_price: product ? Number(product.selling_price) : price,
                    quantity: qty,
                    total: price * qty,
                    maxStock: product ? Number(product.stock_quantity) : qty,
                    unit: item.unit || (product ? product.unit : 'PCS'),
                    baseUnit: product ? (product.unit || 'PCS') : 'PCS',
                    secondaryUnit: product ? product.secondary_unit : null,
                    conversionFactor: product ? (product.conversion_factor || 1) : 1,
                    allowDecimal: product ? !!product.allow_decimal : false,
                    is_free: false,
                    gst_rate: q.gst_rate || 0,
                    discount_rate: q.discount_rate || 0,
                    track_batches: settings.enable_batch_system === 'true',
                    batch_id: '',
                    available_batches: [],
                    track_serials: product ? !!product.track_serials : false,
                    serials: []
                });
            }
            setCart(newItems);
            setSelectedTemplateId(quotationId);
            if (q.gst_rate > 0) { setGstEnabled(true); setGstRate(q.gst_rate); } else { setGstEnabled(false); }
            if (q.discount_rate > 0) { setDiscountEnabled(true); setDiscountRate(q.discount_rate); } else { setDiscountEnabled(false); setDiscountRate(0); }
            toast.success(`Loaded ${newItems.length} items from quotation template "${q.name}"`);
        } catch (err) {
            toast.error('Failed to load quotation template');
        } finally {
            setLoadingQuotationTemplate(false);
        }
    }

    async function handleBulkDeleteInvoices() {
        if (selectedInvoiceIds.length === 0) return;
        const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedInvoiceIds.length} selected invoices? This action is permanent and cannot be undone.`);
        if (!confirmDelete) return;

        try {
            const promises = selectedInvoiceIds.map(id => api.deleteInvoice(id));
            await Promise.all(promises);
            toast.success('Invoices deleted successfully');
            setSelectedInvoiceIds([]);
            loadHistory();
        } catch (err) {
            toast.error(err.message || 'Failed to delete some invoices');
            loadHistory();
        }
    }

    async function handleMergeInvoices() {
        if (selectedInvoiceIds.length < 2) {
            return toast.error('Please select at least two invoices to merge');
        }
        
        // Find if they all have the same customer_id to pre-select it
        const selectedInvs = invoices.filter(inv => selectedInvoiceIds.includes(inv.id));
        const firstCustId = selectedInvs[0]?.customer_id;
        const allSameCustomer = selectedInvs.every(inv => inv.customer_id === firstCustId);

        if (allSameCustomer && firstCustId) {
            setMergeCustomer(String(firstCustId));
            setMergeWalkInName('');
            setMergeWalkInPhone('');
        } else {
            setMergeCustomer('walk-in');
            setMergeWalkInName(selectedInvs[0]?.walk_in_name || '');
            setMergeWalkInPhone(selectedInvs[0]?.walk_in_phone || '');
        }

        setShowMergeModal(true);
    }

    async function submitMergeInvoices() {
        if (selectedInvoiceIds.length < 2) return;
        
        const payload = {
            invoice_ids: selectedInvoiceIds,
            customer_id: mergeCustomer === 'walk-in' ? null : Number(mergeCustomer),
            walk_in_name: mergeCustomer === 'walk-in' ? mergeWalkInName.trim() : '',
            walk_in_phone: mergeCustomer === 'walk-in' ? mergeWalkInPhone.trim() : ''
        };

        if (mergeCustomer === 'walk-in' && !payload.walk_in_name) {
            return toast.error('Walk-in name is required');
        }

        setMerging(true);
        try {
            const res = await api.mergeInvoices(payload);
            toast.success(`Invoices merged successfully! Merged Invoice: INV-${String(res.new_invoice_id).padStart(4, '0')}`);
            setShowMergeModal(false);
            setSelectedInvoiceIds([]);
            loadHistory();
        } catch (err) {
            toast.error(err.message || 'Failed to merge invoices');
        } finally {
            setMerging(false);
        }
    }

    const getLogIcon = (action) => {
        const act = (action || '').toLowerCase();
        if (act.includes('created')) return <Icons.Plus size={13} style={{ color: 'var(--success)' }} />;
        if (act.includes('fulfillment') || act.includes('fulfilled')) return <Icons.Package size={13} style={{ color: 'var(--accent)' }} />;
        if (act.includes('payment') || act.includes('received')) return <Icons.CreditCard size={13} style={{ color: 'var(--success)' }} />;
        if (act.includes('refund') || act.includes('return')) return <Icons.RotateCcw size={13} style={{ color: 'var(--danger)' }} />;
        if (act.includes('advance') || act.includes('convert')) return <Icons.Layers size={13} style={{ color: 'var(--warning)' }} />;
        return <Icons.Activity size={13} style={{ color: 'var(--text-secondary)' }} />;
    };

    async function handleViewLogs(id) {
        setViewingLogsInvoiceId(id);
        setIsLoadingLogs(true);
        try {
            const data = await api.getInvoiceLogs(id);
            setInvoiceLogs(data || []);
        } catch (err) {
            console.error('Failed to load invoice logs', err);
            toast.error('Failed to load activity logs');
            setViewingLogsInvoiceId(null);
        } finally {
            setIsLoadingLogs(false);
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

    async function addToCart(product, isFree = false, rewardQty = 1) {
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

        addFinalToCart(product, null, isFree, rewardQty);
    }

    async function addFinalToCart(product, variant = null, isFree = false, rewardQty = 1) {
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
        let newTotalQty = currentTotalQty + rewardQty;

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
                        ? { ...c, quantity: c.quantity + rewardQty, total: isFree ? 0 : (c.quantity + rewardQty) * c.price }
                        : c
                ));
            } else {
                setCart([...cart, {
                    cartRowId: Date.now().toString() + Math.random().toString(),
                    product_id: productId,
                    variant_id: variantId,
                    name: variant ? `${product.name} - ${variant.name}` : product.name,
                    subcategory_name: product.subcategory_name || '',
                    price: isFree ? 0 : price,
                    original_price: price,
                    quantity: rewardQty,
                    total: isFree ? 0 : price * rewardQty,
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
                    available_batches: batches,
                    track_serials: !!product.track_serials,
                    serials: []
                }]);
            }
        }

        toast.success(`${product.name} added to cart`, { duration: 1500 });
        setProductSearch('');
        setCartPulse(true);
        setTimeout(() => setCartPulse(false), 500);
        setVariantModalProduct(null);
    }

    async function addMultipleToCart(productsList) {
        if (!productsList || productsList.length === 0) {
            toast.error("No products to add!");
            return;
        }

        const toastId = toast.loading("Checking stock and variants...");

        try {
            // 1. Fetch variants for all products in the list
            const allVariantsRes = await Promise.all(productsList.map(async (p) => {
                try {
                    const vars = await api.getVariants(p.id);
                    return { productId: p.id, variants: vars || [] };
                } catch {
                    return { productId: p.id, variants: [] };
                }
            }));
            const variantsMap = new Map(allVariantsRes.map(v => [v.productId, v.variants]));

            // 2. Identify candidate products (all products in the list)
            const candidateProducts = productsList;

            if (candidateProducts.length === 0) {
                toast.dismiss(toastId);
                toast.error("No products to add in this group!");
                return;
            }

            // Update toast message
            toast.loading(`Adding ${candidateProducts.length} items to cart...`, { id: toastId });

            // 3. Fetch batches for the candidate products if batch system is enabled
            let batchesMap = new Map();
            if (settings.enable_batch_system === 'true') {
                const allBatchesRes = await Promise.all(candidateProducts.map(async (p) => {
                    try {
                        const b = await api.getProductBatches(p.id);
                        return { productId: p.id, batches: b || [] };
                    } catch {
                        return { productId: p.id, batches: [] };
                    }
                }));
                batchesMap = new Map(allBatchesRes.map(b => [b.productId, b.batches]));
            }

            let newCart = [...cart];

            for (const product of candidateProducts) {
                const variants = variantsMap.get(product.id) || [];
                const batches = batchesMap.get(product.id) || [];
                const isFifo = settings.auto_batch_selection_method === 'FIFO' && batches.length > 0;

                let selectedVariant = null;
                let price = Number(product.selling_price);
                let availableStock = Number(product.stock_quantity);

                if (variants.length > 0) {
                    const inStockVar = variants.find(v => v.stock_quantity > 0);
                    if (inStockVar) {
                        selectedVariant = inStockVar;
                        price = Number(inStockVar.selling_price);
                        availableStock = Number(inStockVar.stock_quantity);
                    } else {
                        if (settings.flexible_inventory === 'false') {
                            continue;
                        }
                        selectedVariant = variants[0];
                        price = Number(variants[0].selling_price);
                        availableStock = Number(variants[0].stock_quantity);
                    }
                }

                const productId = product.id;
                const variantId = selectedVariant ? selectedVariant.id : null;
                const isFree = false;

                const existingItems = newCart.filter(c =>
                    c.product_id === productId &&
                    c.variant_id === variantId &&
                    !c.is_free
                );
                let currentQty = existingItems.reduce((sum, item) => sum + item.quantity, 0);
                let newQty = currentQty + 1;

                if (settings.flexible_inventory === 'false' && newQty > availableStock) {
                    continue;
                }

                if (isFifo) {
                    newCart = newCart.filter(c => !(c.product_id === productId && c.variant_id === variantId && !c.is_free));
                    const newSplits = calculateFifoSplits(product, selectedVariant, isFree, newQty, batches, price);
                    newSplits.forEach(s => {
                        s.subcategory_name = product.subcategory_name || '';
                    });
                    newCart.push(...newSplits);
                } else {
                    const baseIndex = newCart.findIndex(c =>
                        c.product_id === productId &&
                        c.variant_id === variantId &&
                        !c.is_free &&
                        !c.batch_id
                    );

                    if (baseIndex > -1) {
                        newCart[baseIndex] = {
                            ...newCart[baseIndex],
                            quantity: newQty,
                            total: newQty * price
                        };
                    } else {
                        newCart.push({
                            cartRowId: Date.now().toString() + Math.random().toString(),
                            product_id: productId,
                            variant_id: variantId,
                            name: selectedVariant ? `${product.name} - ${selectedVariant.name}` : product.name,
                            subcategory_name: product.subcategory_name || '',
                            price: price,
                            original_price: price,
                            quantity: 1,
                            total: price,
                            maxStock: availableStock,
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
                            available_batches: batches,
                            track_serials: !!product.track_serials,
                            serials: []
                        });
                    }
                }
            }

            setCart(newCart);
            toast.success(`Successfully added items to cart`, { id: toastId });
            setCartPulse(true);
            setTimeout(() => setCartPulse(false), 500);
        } catch (err) {
            console.error('Failed batch addition to cart', err);
            toast.error(`Error adding items to cart: ${err.message || err}`, { id: toastId });
        }
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
                    subcategory_name: product.subcategory_name || '',
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
                    available_batches: batches,
                    track_serials: !!product.track_serials,
                    serials: []
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
                subcategory_name: product.subcategory_name || '',
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
                available_batches: batches,
                track_serials: !!product.track_serials,
                serials: []
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

            const newSplits = calculateFifoSplits({ id: item.product_id, name: product.name, subcategory_name: item.subcategory_name, unit: item.baseUnit, secondary_unit: item.secondaryUnit, conversion_factor: item.conversionFactor, allow_decimal: item.allowDecimal, stock_quantity: item.maxStock }, item.variant_id ? { id: item.variant_id, name: item.name.split(' - ')[1], stock_quantity: item.maxStock } : null, item.is_free, totalQtyForGroup, item.available_batches, item.original_price);

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

    const openSerialSelectModal = async (cartRowId) => {
        const item = cart.find(c => c.cartRowId === cartRowId);
        if (!item) return;
        setSerialSelectCartRowId(cartRowId);
        setSelectedSerials(item.serials || []);
        setSerialSelectLoading(true);
        setShowSerialSelectModal(true);
        setSerialSearchQuery('');
        try {
            const allSerials = await api.getProductSerials(item.product_id);
            // Include already selected serials for this row (if any) plus any available ones in the system
            const alreadySelected = new Set(item.serials || []);
            const filtered = (allSerials || []).filter(s => s.status === 'Available' || alreadySelected.has(s.serial_number));
            setAvailableSerials(filtered);
        } catch (err) {
            toast.error("Failed to load serial numbers: " + err.message);
        } finally {
            setSerialSelectLoading(false);
        }
    };

    const toggleSerialSelection = (serialNumber) => {
        if (selectedSerials.includes(serialNumber)) {
            setSelectedSerials(selectedSerials.filter(s => s !== serialNumber));
        } else {
            // Check if we already reached the quantity limit
            const item = cart.find(c => c.cartRowId === serialSelectCartRowId);
            if (item && selectedSerials.length >= item.quantity) {
                toast.error(`You can only select up to ${item.quantity} serial number(s). Increase quantity in cart first.`);
                return;
            }
            setSelectedSerials([...selectedSerials, serialNumber]);
        }
    };

    const saveSelectedSerials = () => {
        const item = cart.find(c => c.cartRowId === serialSelectCartRowId);
        if (!item) return;
        if (selectedSerials.length !== item.quantity) {
            toast.error(`Please select exactly ${item.quantity} serial number(s) (currently selected: ${selectedSerials.length})`);
            return;
        }
        setCart(cart.map(c => c.cartRowId === serialSelectCartRowId ? { ...c, serials: selectedSerials } : c));
        setShowSerialSelectModal(false);
        toast.success("Serial numbers updated");
    };

    const handleScanSerialInput = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const code = e.target.value.trim().toUpperCase();
            if (!code) return;
            
            // Find matching serial
            const match = availableSerials.find(s => s.serial_number.toUpperCase() === code);
            if (!match) {
                toast.error(`Serial number "${code}" is not available for this product.`);
                return;
            }
            
            if (selectedSerials.map(s => s.toUpperCase()).includes(code)) {
                toast.error(`Serial number "${code}" is already selected.`);
                e.target.value = '';
                return;
            }
            
            const item = cart.find(c => c.cartRowId === serialSelectCartRowId);
            if (item && selectedSerials.length >= item.quantity) {
                // Automatically increase quantity
                const newQty = item.quantity + 1;
                setCart(cart.map(c => c.cartRowId === serialSelectCartRowId ? { ...c, quantity: newQty } : c));
                setSelectedSerials([...selectedSerials, match.serial_number]);
                toast.success(`Selected "${match.serial_number}" (Quantity increased to ${newQty})`);
            } else {
                setSelectedSerials([...selectedSerials, match.serial_number]);
                toast.success(`Selected "${match.serial_number}"`);
            }
            e.target.value = '';
        }
    };

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
        const itemToRemove = cart.find(c => c.cartRowId === cartRowId);
        if (itemToRemove && itemToRemove.is_free && appliedCoupon && appliedCoupon.type === 'product') {
            try {
                if (typeof appliedCoupon.value === 'string' && appliedCoupon.value.trim().startsWith('[')) {
                    const items = JSON.parse(appliedCoupon.value);
                    const ids = items.map(x => Number(x.id));
                    if (ids.includes(Number(itemToRemove.product_id))) {
                        setAppliedCoupon(null);
                        setCouponCode('');
                    }
                } else {
                    const prodId = Number(appliedCoupon.value || appliedCoupon.product_id);
                    if (prodId === Number(itemToRemove.product_id)) {
                        setAppliedCoupon(null);
                        setCouponCode('');
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }
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
                { id: product.id, name: product.name, subcategory_name: product.subcategory_name, unit: itemTemplate.baseUnit, secondary_unit: itemTemplate.secondaryUnit, conversion_factor: itemTemplate.conversionFactor, allow_decimal: itemTemplate.allowDecimal, stock_quantity: itemTemplate.maxStock },
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
        const result = {};
        for (const p of allFiltered) {
            const cat = p.category || 'General';
            const subcat = p.subcategory_name || 'Uncategorized';
            if (!result[cat]) {
                result[cat] = {};
            }
            if (!result[cat][subcat]) {
                result[cat][subcat] = [];
            }
            result[cat][subcat].push(p);
        }
        return result;
    }, [allFiltered]);

    // Derive category list so it's available in JSX (was accidentally inside the closure)
    const categories = useMemo(() => Object.keys(categorizedProducts), [categorizedProducts]);

    const quotationAllFiltered = useMemo(() => (products || []).filter(p =>
        (quotationProductSearch === '' ||
            (p.name && p.name.toLowerCase().includes(quotationProductSearch.toLowerCase())) ||
            (p.product_code && p.product_code.toLowerCase().includes(quotationProductSearch.toLowerCase())))
    ), [products, quotationProductSearch]);

    const quotationCategorizedProducts = useMemo(() => {
        const result = {};
        for (const p of quotationAllFiltered) {
            const cat = p.category || 'General';
            const subcat = p.subcategory_name || 'Uncategorized';
            if (!result[cat]) {
                result[cat] = {};
            }
            if (!result[cat][subcat]) {
                result[cat][subcat] = [];
            }
            result[cat][subcat].push(p);
        }
        return result;
    }, [quotationAllFiltered]);

    const quotationCategories = useMemo(() => Object.keys(quotationCategorizedProducts), [quotationCategorizedProducts]);

    const historyCategories = useMemo(() => {
        const cats = Array.from(new Set((products || []).map(p => p.category || 'General')));
        return ['All', ...cats.filter(Boolean).sort()];
    }, [products]);

    const filteredCustomers = useMemo(() => (customers || []).filter(c =>
        (c.name && c.name.toLowerCase().includes(customerSearch.toLowerCase())) ||
        (c.phone && c.phone.includes(customerSearch)) ||
        (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase()))
    ), [customers, customerSearch]);

    // M043: Memoize subtotal to avoid recomputing on every render
    const subtotalNum = useMemo(() => cart.reduce((sum, c) => {
        const availableStock = c.unit === c.secondaryUnit ? Math.floor(c.maxStock / c.conversionFactor) : c.maxStock;
        const chargeQty = (settings.include_pending_price === 'false')
            ? (isAdvance ? 0 : (availableStock <= 0 ? 0 : Math.min(c.quantity, availableStock)))
            : c.quantity;
        const itemBase = chargeQty * Number(c.price || 0);
        if (settings.enable_discount_per_item === 'true' || settings.enable_gst_per_item === 'true') {
            const diskRate = Number(c.discount_rate || 0) || 0;
            const gRate = Number(c.gst_rate || 0) || 0;
            const afterDisk = itemBase - (itemBase * (diskRate / 100));
            const withGst = afterDisk + (afterDisk * (gRate / 100));
            return sum + (Number(withGst) || 0);
        }
        return sum + itemBase;
    }, 0) || 0, [cart, settings.enable_discount_per_item, settings.enable_gst_per_item, settings.include_pending_price, isAdvance]);

    const subtotal = Number(subtotalNum) || 0;
    const pricelist = pricelists.find(pl => String(pl.id) === String(selectedPricelistId));
    const pricelistDiscount = (pricelist && !appliedCoupon)
        ? (pricelist.discount_type === 'percentage'
            ? subtotal * (Number(pricelist.discount_value) / 100)
            : Number(pricelist.discount_value))
        : 0;

    const couponDiscount = (appliedCoupon && !selectedPricelistId)
        ? (appliedCoupon.type === 'discount' ? subtotal * (Number(appliedCoupon.value) / 100) : (appliedCoupon.type === 'currency' ? Number(appliedCoupon.value) : 0))
        : 0;

    const discountAmount = (settings.enable_discount_per_item !== 'true' && discountEnabled) ? subtotal * (Number(discountRate || 0) / 100) : 0;
    const loyaltyRedeemRate = parseFloat(settings.loyalty_points_redeem_rate || '100');
    const loyaltyPointsDiscount = (settings.enable_loyalty_points === 'true' && useLoyaltyPoints) ? (Number(loyaltyPointsToRedeem || 0) / loyaltyRedeemRate) : 0;

    const afterDiscountAndCoupon = Math.max(0, subtotal - (Number(discountAmount) || 0) - couponDiscount - pricelistDiscount - loyaltyPointsDiscount);
    const gstAmount = (settings.enable_gst_per_item !== 'true' && gstEnabled) ? afterDiscountAndCoupon * (Number(gstRate || 0) / 100) : 0;
    const finalTotal = (Number(afterDiscountAndCoupon) || 0) + (Number(gstAmount) || 0);

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

    async function handleApplyCouponCode() {
        if (!couponCode.trim()) return;
        setLoadingCoupon(true);
        try {
            const res = await api.applyCoupon({ code: couponCode.trim() });
            setSelectedPricelistId('');
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
                        addFinalToCart(prod, null, true, rewardQty);
                    } else {
                        addFinalToCart({
                            id: rewardProduct.id,
                            name: rewardProduct.name,
                            selling_price: rewardProduct.selling_price,
                            stock_quantity: rewardProduct.stock_quantity,
                            unit: rewardProduct.unit
                        }, null, true, rewardQty);
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

    async function handleCreateInvoice(e, options = {}) {
        if (e && e.preventDefault) e.preventDefault();
        if (cart.length === 0) return;

        if (!isAdvance) {
            const isQuickSale = options.isQuickSale || false;
            const currentSelectedCustomer = isQuickSale ? null : (selectedCustomer ? parseInt(selectedCustomer) : null);

            // Validation: payments must match grand total if walk-in customer or paid status
            if (!currentSelectedCustomer || paymentStatus === 'PAID') {
                const targetPayments = options.paymentsOverride || payments;
                const totalPaid = targetPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                if (Math.abs(totalPaid - finalTotal) > 0.01) {
                    toast.error(`Payment amount must exactly match the grand total of ₹${finalTotal.toFixed(2)}. Entered: ₹${totalPaid.toFixed(2)}`);
                    return;
                }
            }

            for (const item of cart) {
                if (settings.enable_serial_tracking === 'true' && item.track_serials) {
                    const serials = item.serials || [];
                    if (serials.length !== item.quantity) {
                        toast.error(`Product "${item.name}" requires exactly ${item.quantity} serial number(s). You have selected ${serials.length}.`);
                        return;
                    }
                }
            }
        }

        const isQuickSale = options.isQuickSale || false;
        const currentSelectedCustomer = selectedCustomer ? parseInt(selectedCustomer) : null;

        const payload = {
            customer_id: isQuickSale ? null : currentSelectedCustomer,
            walk_in_name: isQuickSale ? (options.walkInName || 'Walk-in') : (!currentSelectedCustomer ? walkInName : ''),
            walk_in_phone: isQuickSale ? (options.walkInPhone || '') : (!currentSelectedCustomer ? walkInPhone : ''),
            gst_rate: gstEnabled ? Number(gstRate || 0) : 0,
            discount_rate: discountEnabled ? Number(discountRate || 0) : 0,
            coupon_code: isQuickSale ? (options.couponCode || null) : (appliedCoupon ? appliedCoupon.code : (pricelist ? pricelist.coupon_code : null)),
            coupon_discount_amount: isQuickSale ? (options.couponDiscountAmount || 0) : (appliedCoupon ? couponDiscount : (pricelist ? pricelistDiscount : 0)),
            items: cart.map(c => ({
                product_id: Number(c.product_id),
                variant_id: c.variant_id ? Number(c.variant_id) : null,
                quantity: Number(c.quantity || 0),
                unit: c.unit,
                is_free: !!c.is_free,
                price: Number(c.price || 0),
                item_gst_rate: Number(c.gst_rate || 0),
                item_discount_rate: Number(c.discount_rate || 0),
                batch_id: c.batch_id ? Number(c.batch_id) : null,
                serials: c.serials || []
            })),
            payment_status: isAdvance ? 'ADVANCE' : (isQuickSale ? 'PAID' : paymentStatus),
            payments: options.paymentsOverride ? options.paymentsOverride : ((paymentStatus === 'UNPAID' && !isAdvance) ? [] : (isAdvance ? [{ method: paymentMethod, amount: Number(advanceAmount || 0) }] : payments.filter(p => Number(p.amount) > 0).map(p => ({
                ...p,
                amount: Number(p.amount)
            })))),
            use_p_credit: usePCredit,
            p_credit_amount: usePCredit ? Number(pCreditToApply || 0) : 0,
            redeem_loyalty_points: Number(loyaltyPointsToRedeem || 0),
            is_advance: isAdvance,
            advance_amount: isAdvance ? Number(advanceAmount || 0) : 0,
            mazeway_order_id: convertedOrderId,
            pricelist_id: isQuickSale ? null : (selectedPricelistId ? Number(selectedPricelistId) : null)
        };

        setSaving(true);
        const toastId = toast.loading('Generating invoice and updating stock...');
        try {
            const res = await api.createInvoice(payload);

            // Reset state on success
            setCart([]);
            localStorage.removeItem('quantro_sales_cart_session');
            setGstEnabled(false);
            setDiscountEnabled(false);
            setDiscountRate(0);
            setSelectedCustomer('');
            setWalkInName('');
            setWalkInPhone('');
            setPaymentStatus('PAID');
            setPayments([{ method: settings.default_payment_method || DEFAULT_PAYMENT_METHOD, amount: '', transaction_id: '' }]);
            setStep('customer');
            setUsePCredit(false);
            setPCreditToApply('');
            setUseLoyaltyPoints(false);
            setLoyaltyPointsToRedeem('');
            setPromoExpenseEnabled(false);
            setIsAdvance(false);
            setAdvanceAmount('');
            setAppliedCoupon(null);
            setCouponCode('');
            setSelectedPricelistId('');
            setConvertedOrderId(null);

            // Refresh products and history
            api.getProducts().then(setProducts).catch(() => {});
            api.getCustomers().then(setCustomers).catch(() => {});
            loadHistory();
            toast.success('Invoice created successfully!', { id: toastId });

            // Show auto-send feedback toasts if enabled
            if (settings.auto_whatsapp_invoice_created === 'true') {
                toast.success('WhatsApp auto-send done!');
            }
            if (settings.auto_email_invoice_created === 'true') {
                toast.success('Email auto-send done!');
            }

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
            .map(([itemId, qty]) => {
                // Find the invoice item by its row ID
                const invoiceItem = returningInvoice.items.find(i => String(i.id) === String(itemId));
                return {
                    product_id: invoiceItem ? Number(invoiceItem.product_id) : null,
                    invoice_item_id: Number(itemId),
                    quantity: Number(qty)
                };
            })
            .filter(r => r.product_id !== null);

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

    const handleConvertOrderToInvoice = async (order) => {
        // Find customer by phone or name
        const cleanOrderPhone = (order.customer_phone || '').replace(/\D/g, '');
        const matchedCustomer = customers.find(c => {
            const cleanPhone = (c.phone || '').replace(/\D/g, '');
            return cleanPhone && cleanOrderPhone && (cleanPhone === cleanOrderPhone || cleanPhone.endsWith(cleanOrderPhone) || cleanOrderPhone.endsWith(cleanPhone));
        });

        if (matchedCustomer) {
            setSelectedCustomer(String(matchedCustomer.id));
            const tier = matchedCustomer.tier || 'C';
            const discountKey = `tier_${tier.toLowerCase()}_discount`;
            const pct = parseFloat(settings[discountKey] ?? '0');
            if (pct > 0) {
                setDiscountRate(pct);
                setDiscountEnabled(true);
            } else {
                setDiscountRate(0);
                setDiscountEnabled(false);
            }
        } else {
            setSelectedCustomer('');
            setWalkInName(order.customer_name || '');
            setWalkInPhone(order.customer_phone || '');
        }

        // Map order items to cart
        const newCart = [];
        const toastId = toast.loading("Checking inventory stock & batches for order items...");
        try {
            for (const item of order.items) {
                const prod = products.find(p => p.name.toLowerCase() === item.name.toLowerCase() || p.id === item.product_id);
                if (prod) {
                    let batches = [];
                    if (settings.enable_batch_system === 'true') {
                        try {
                            batches = await api.getProductBatches(prod.id);
                        } catch (e) { console.error('Failed to load batches', e); }
                    }

                    newCart.push({
                        cartRowId: Date.now().toString() + Math.random().toString(),
                        product_id: prod.id,
                        variant_id: null,
                        name: prod.name,
                        subcategory_name: prod.subcategory_name || '',
                        price: Number(prod.selling_price),
                        original_price: Number(prod.selling_price),
                        quantity: Number(item.quantity || 1),
                        total: Number(prod.selling_price) * Number(item.quantity || 1),
                        maxStock: prod.stock_quantity,
                        unit: prod.unit || 'PCS',
                        baseUnit: prod.unit || 'PCS',
                        secondaryUnit: prod.secondary_unit || null,
                        conversionFactor: prod.conversion_factor || 1,
                        allowDecimal: !!prod.allow_decimal,
                        is_free: false,
                        gst_rate: 0,
                        discount_rate: 0,
                        track_batches: settings.enable_batch_system === 'true',
                        batch_id: batches.length === 1 ? batches[0].id : '',
                        available_batches: batches,
                        track_serials: !!prod.track_serials,
                        serials: []
                    });
                } else {
                    toast.error(`Product "${item.name}" not found in inventory catalog.`);
                }
            }

            if (newCart.length > 0) {
                setCart(newCart);
                setConvertedOrderId(order.id);
                setTab('new');
                setStep('products');
                toast.success(`Loaded order items for ${order.customer_name || 'Customer'}`, { id: toastId });
            } else {
                toast.error("Could not load any matching products from order into cart.", { id: toastId });
            }
        } catch (err) {
            toast.error("Failed to load order items: " + err.message, { id: toastId });
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Sales</h1>
                    <p className="text-secondary">Create standard invoices, track customer purchase history, and manage AI sales</p>
                </div>
                {tab === 'quotation' && quotationMode === 'list' && (
                    <SButton variant="primary" onClick={() => setQuotationMode('create')}>
                        <Icons.Plus size={16} style={{ marginRight: '6px' }} /> Create Quotation
                    </SButton>
                )}
            </div>

            <div className="tabs">
                {settings.enable_quick_sale === 'true' && (
                    <button className={`tab-item ${tab === 'quick' ? 'active' : ''}`} onClick={() => setTab('quick')}>Quick Sale</button>
                )}
                <button className={`tab-item ${tab === 'new' ? 'active' : ''}`} onClick={() => { setTab('new'); setStep('customer'); }}>Standard Invoice</button>
                <button className={`tab-item ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>Sales History</button>
                <button className={`tab-item ${tab === 'quotation' ? 'active' : ''}`} onClick={() => setTab('quotation')}>Quotations</button>
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
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                    <QuickSaleView 
                        products={products}
                        cart={cart}
                        setCart={setCart}
                        addToCart={addToCart}
                        handleCreateInvoice={handleCreateInvoice}
                        settings={settings}
                    />
                </div>
            )}

            {tab === 'new' && (
                <div className="invoice-container" key={step} style={{ animation: 'fadeIn 0.3s ease' }}>
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

                            <div className="customer-list-wrapper" style={{ position: 'relative' }}>
                                <div className="customer-list-grid">
                                    <div className="customer-card walk-in" onClick={() => handleSelectCustomer(null)}>
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
                                        <div key={c.id} className="customer-card" onClick={() => handleSelectCustomer(c)}>
                                            <div className="customer-icon">
                                                <Icons.User size={24} />
                                            </div>
                                            <div className="customer-info">
                                                <span className="customer-name">{c.name}</span>
                                                <span className="customer-details">
                                                    {c.phone || 'No Phone'}
                                                </span>
                                            </div>
                                            <div className="customer-action" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                {(() => {
                                                    const custInvoices = invoices.filter(inv => inv.customer_id === c.id);
                                                    const totalOutstanding = custInvoices.reduce((sum, inv) => {
                                                        const effectiveTotal = Math.max(0, (inv.total || 0) - (inv.total_returned_amount || 0));
                                                        return sum + Math.max(0, effectiveTotal - (inv.paid_amount || 0));
                                                    }, 0);
                                                    return totalOutstanding > 0 && (
                                                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                                                            Due: ₹{totalOutstanding.toLocaleString('en-IN')}
                                                        </span>
                                                    );
                                                })()}
                                                {settings.enable_loyalty_points === 'true' && Number(c.loyalty_points || 0) > 0 && (
                                                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--primary-color)', background: 'rgba(10, 110, 255, 0.1)', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                                                        {Number(c.loyalty_points).toLocaleString('en-IN')} pts
                                                    </span>
                                                )}
                                                {Number(c.p_credit_balance || 0) > 0 && (
                                                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--accent)', background: 'var(--accent-light)', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                                                        Credit: ₹{Number(c.p_credit_balance).toLocaleString('en-IN')}
                                                    </span>
                                                )}
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
                                {filteredCustomers.length > 4 && (
                                    <div className="list-fade-overlay"></div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="invoice-layout">
                            <div className="invoice-products-section">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Add Products</h3>
                                    <SButton variant="secondary" onClick={handleBackToCustomers}>
                                        <Icons.ChevronLeft size={14} strokeWidth={2.5} /> Back to Customers
                                    </SButton>
                                </div>

                                {/* Quotation Templates Section — Vertical Stack matching Product Picker (Double-click to load) */}
                                {(() => {
                                    if (!Array.isArray(quotations)) return null;
                                    const visibleTemplates = quotations.filter(q => {
                                        if (!q) return false;
                                        // Global: walk-in or no customer assigned
                                        const isGlobal = !q.customer_id;
                                        // Belongs strictly to currently selected customer
                                        const isForCurrentCustomer = selectedCustomer && q.customer_id && String(q.customer_id) === String(selectedCustomer);
                                        const matchesCustomer = isGlobal || isForCurrentCustomer;

                                        const qtnNum = `QTN-${String(q.id).padStart(4, '0')}`;
                                        const searchLower = (templateSearch || '').toLowerCase().trim();
                                        const matchesSearch = !searchLower ||
                                            (q.name && q.name.toLowerCase().includes(searchLower)) ||
                                            qtnNum.toLowerCase().includes(searchLower);

                                        return matchesCustomer && matchesSearch;
                                    });
                                    if (quotations.length === 0) return null;
                                    return (
                                        <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Icons.FileText size={16} style={{ color: 'var(--accent)' }} />
                                                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                        Quotation Templates <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 'normal', textTransform: 'none', marginLeft: '4px' }}>(Double-click to load)</span>
                                                    </h4>
                                                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'var(--bg-primary)', color: 'var(--text-tertiary)', border: '1px solid var(--border-light)' }}>
                                                        {visibleTemplates.length} available
                                                    </span>
                                                </div>
                                                {selectedTemplateId && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedTemplateId(null);
                                                            setCart([]);
                                                            toast.info('Template deselected & cart cleared');
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <Icons.X size={14} /> Clear Template
                                                    </button>
                                                )}
                                            </div>

                                            {/* Search Bar for Quotation Templates */}
                                            <div className="search-bar" style={{ marginBottom: '12px' }}>
                                                <Icons.Search size={16} style={{ color: 'var(--text-tertiary)' }} />
                                                <input
                                                    type="text"
                                                    placeholder="Search quotation templates by title or QTN number…"
                                                    value={templateSearch}
                                                    onChange={e => setTemplateSearch(e.target.value)}
                                                    style={{ width: '100%', fontSize: '12px' }}
                                                />
                                            </div>

                                            {/* Vertical Stack List */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {visibleTemplates.map(q => {
                                                    const isSelected = selectedTemplateId === q.id;
                                                    return (
                                                        <div
                                                            key={q.id}
                                                            onDoubleClick={() => handleLoadQuotationTemplate(q.id)}
                                                            title="Double-click to load this quotation template"
                                                            style={{
                                                                display: 'grid',
                                                                gridTemplateColumns: '1fr auto 90px',
                                                                alignItems: 'center',
                                                                padding: '10px 14px',
                                                                borderRadius: '8px',
                                                                border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-light)',
                                                                background: isSelected ? 'var(--accent-light, rgba(0, 166, 81, 0.08))' : 'var(--bg-primary)',
                                                                cursor: 'pointer',
                                                                userSelect: 'none',
                                                                transition: 'all 0.2s ease',
                                                                width: '100%',
                                                                boxSizing: 'border-box'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (!isSelected) {
                                                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (!isSelected) {
                                                                    e.currentTarget.style.borderColor = 'var(--border-light)';
                                                                }
                                                            }}
                                                        >
                                                            {/* Left Column: QTN Number + Title, and Pricing under the title */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                        QTN-{String(q.id).padStart(4, '0')}
                                                                    </span>
                                                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                                        {q.name}
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                                    ₹{(q.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                </div>
                                                            </div>

                                                            {/* Center Column: Item Count */}
                                                            <div style={{ textAlign: 'center', padding: '0 12px' }}>
                                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, background: 'var(--bg-card)', padding: '3px 8px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                                                                    {q.items?.length || 0} items
                                                                </span>
                                                            </div>

                                                            {/* Right Column: Client / Global tag at far right end */}
                                                            <div style={{ textAlign: 'right' }}>
                                                                <span style={{
                                                                    fontSize: '10px',
                                                                    color: !q.customer_id ? 'var(--text-secondary)' : 'var(--accent)',
                                                                    padding: '3px 8px',
                                                                    borderRadius: '4px',
                                                                    background: !q.customer_id ? 'var(--bg-card)' : 'var(--accent-light, rgba(0, 166, 81, 0.1))',
                                                                    border: '1px solid var(--border-light)',
                                                                    fontWeight: 700,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.5px',
                                                                    display: 'inline-block'
                                                                }}>
                                                                    {!q.customer_id ? 'Global' : 'Client'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}

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
                                    {categories.map(cat => {
                                        const subcatsMap = categorizedProducts[cat] || {};
                                        const subcatNames = Object.keys(subcatsMap);
                                        const allProductsInCat = subcatNames.flatMap(sub => subcatsMap[sub]);

                                        return (
                                            <div key={cat} className="category-group" style={{ marginBottom: '24px' }}>
                                                <h4
                                                    className="category-title"
                                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                                    onDoubleClick={() => addMultipleToCart(allProductsInCat)}
                                                    title="Double-click to add all in-stock items in this category"
                                                >
                                                    {cat} <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'none', marginLeft: '6px' }}>(Double-click to add all)</span>
                                                </h4>
                                                {subcatNames.map(subcat => {
                                                    const productsInSub = subcatsMap[subcat] || [];
                                                    return (
                                                        <div key={subcat} className="subcategory-group" style={{ marginBottom: '16px' }}>
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
                                                                onDoubleClick={() => addMultipleToCart(productsInSub)}
                                                                title="Double-click to add all in-stock items in this subcategory"
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
                                                                {subcat}
                                                                <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', fontWeight: 'normal', textTransform: 'none', marginLeft: '6px' }}>
                                                                    (Double-click to add)
                                                                </span>
                                                            </h5>
                                                            <div className="category-products">
                                                                {productsInSub.map(p => {
                                                                    const cartItemInfo = cart.filter(c => c.product_id === p.id && !c.is_free && !c.variant_id);
                                                                    const totalQty = cartItemInfo.reduce((sum, c) => sum + c.quantity, 0);
                                                                    const firstItem = cartItemInfo[0];
                                                                    const hasVariants = p.variants_count > 0;
                                                                    const stockQty = hasVariants ? (p.variants_stock || 0) : p.stock_quantity;
                                                                    const isUnavailable = stockQty <= 0;
                                                                    return (
                                                                        <div key={p.id} className={`product-picker-item ${isUnavailable ? 'unavailable' : ''}`}>
                                                                            <div className="p-main">
                                                                                <span className="p-name">{p.name}</span>
                                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                                    <span className="p-stock">
                                                                                        In Stock: {stockQty} {hasVariants && <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 'normal' }}>(Variants)</span>}
                                                                                    </span>
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
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
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
                                                <SButton variant="secondary" onClick={handleBackToCustomers}>Change</SButton>
                                            </>
                                        ) : (
                                            <div style={{ width: '100%' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <span className="customer-name-sm">Walk-in Customer</span>
                                                    <SButton variant="secondary" onClick={handleBackToCustomers}>Change</SButton>
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
                                    <table style={{ width: '100%', fontSize: '13px', tableLayout: 'fixed' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                                                <th style={{ width: 'auto' }}>Product</th>
                                                {settings.enable_sku === 'true' && <th style={{ width: '90px' }}>SKU</th>}
                                                <th style={{ width: '60px', textAlign: 'center' }}>Unit</th>
                                                <th style={{ width: '100px', textAlign: 'center' }}>Batch</th>
                                                <th style={{ width: '60px', textAlign: 'center' }}>Qty</th>
                                                <th style={{ width: '90px', textAlign: 'right' }}>Price</th>
                                                {settings.enable_gst_per_item === 'true' && <th style={{ width: '85px', textAlign: 'center' }}>GST</th>}
                                                {settings.enable_discount_per_item === 'true' && <th style={{ width: '85px', textAlign: 'center' }}>Disc</th>}
                                                <th style={{ width: '100px', textAlign: 'right' }}>Total</th>
                                                <th style={{ width: '90px', textAlign: 'right' }}>Action</th>
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
                                                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                            <span>{item.name}</span>
                                                            {(() => {
                                                                const isPending = item.maxStock <= 0 || item.quantity > item.maxStock;
                                                                if (!isPending) return null;
                                                                const pendingQty = item.maxStock <= 0 ? item.quantity : (item.quantity - item.maxStock);
                                                                return (
                                                                    <span style={{ 
                                                                        fontSize: '10px', 
                                                                        fontWeight: 700, 
                                                                        color: '#854D0E', 
                                                                        background: '#FEF9C3', 
                                                                        padding: '2px 6px', 
                                                                        borderRadius: '4px',
                                                                        border: '1px solid rgba(202, 138, 4, 0.3)'
                                                                    }}>
                                                                        Pending: {pendingQty}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                        {item.subcategory_name && (
                                                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                                Subcategory: {item.subcategory_name}
                                                            </div>
                                                        )}
                                                        {settings.enable_serial_tracking === 'true' && item.track_serials && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                                <span style={{ fontSize: '0.85em', fontWeight: 600, color: (item.serials || []).length === item.quantity ? 'var(--success)' : 'var(--danger)' }}>
                                                                    Serials ({(item.serials || []).length} of {item.quantity})
                                                                </span>
                                                                <SButton 
                                                                    variant="secondary" 
                                                                    style={{ padding: '2px 6px', fontSize: '10px', height: '22px' }}
                                                                    onClick={() => openSerialSelectModal(item.cartRowId)}
                                                                >
                                                                    Select Serials
                                                                </SButton>
                                                            </div>
                                                        )}
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
                                                            const availableStock = item.unit === item.secondaryUnit ? Math.floor(item.maxStock / item.conversionFactor) : item.maxStock;
                                                            const chargeQty = (settings.include_pending_price === 'false')
                                                                ? (isAdvance ? 0 : (availableStock <= 0 ? 0 : Math.min(item.quantity, availableStock)))
                                                                : item.quantity;
                                                            const baseTotal = chargeQty * item.price;
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

                                    {/* Price List Selection Row */}
                                    <div className="extra-row active" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch', position: 'relative' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                            <Icons.Award size={14} style={{ color: selectedPricelistId ? 'var(--primary)' : 'var(--text-tertiary)' }} />
                                            <span>Price List (Discount)</span>
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            <div
                                                onClick={() => setShowPricelistDropdown(!showPricelistDropdown)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '0 12px',
                                                    height: '32px',
                                                    background: 'var(--bg-card)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    cursor: 'pointer',
                                                    fontSize: 'var(--font-size-sm)',
                                                    color: selectedPricelistId ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                                    userSelect: 'none'
                                                }}
                                            >
                                                <span>
                                                    {selectedPricelistId 
                                                        ? pricelists.find(p => String(p.id) === String(selectedPricelistId))?.name || 'Selected Price List'
                                                        : 'SELECT PRICE LIST'
                                                    }
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {selectedPricelistId && (
                                                        <Icons.X
                                                            size={14}
                                                            style={{ color: 'var(--text-tertiary)', cursor: 'pointer' }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedPricelistId('');
                                                            }}
                                                        />
                                                    )}
                                                    <Icons.ChevronDown size={14} style={{ transform: showPricelistDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                                </div>
                                            </div>

                                            {showPricelistDropdown && (
                                                <>
                                                    <div 
                                                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} 
                                                        onClick={() => setShowPricelistDropdown(false)} 
                                                    />
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            top: '36px',
                                                            left: 0,
                                                            right: 0,
                                                            zIndex: 100,
                                                            background: 'var(--bg-card, #fff)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
                                                            maxHeight: '180px',
                                                            overflowY: 'auto',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '2px',
                                                            padding: '4px'
                                                        }}
                                                    >
                                                        {(!pricelists || pricelists.length === 0) ? (
                                                            <div style={{ padding: '8px 12px', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                                                {"No active price lists. Create one in Customers > Price Lists."}
                                                            </div>
                                                        ) : (
                                                            pricelists.map(plist => (
                                                                <div
                                                                    key={plist.id}
                                                                    onClick={() => {
                                                                        setSelectedPricelistId(String(plist.id));
                                                                        setShowPricelistDropdown(false);
                                                                        setAppliedCoupon(null);
                                                                        setCouponCode('');
                                                                    }}
                                                                    style={{
                                                                        padding: '6px 8px',
                                                                        borderRadius: 'var(--radius-xs)',
                                                                        cursor: 'pointer',
                                                                        fontSize: 'var(--font-size-xs)',
                                                                        background: String(selectedPricelistId) === String(plist.id) ? 'var(--primary-subtle)' : 'transparent',
                                                                        color: String(selectedPricelistId) === String(plist.id) ? 'var(--primary)' : 'var(--text-primary)',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center'
                                                                    }}
                                                                >
                                                                    <span style={{ fontWeight: '500' }}>{plist.name}</span>
                                                                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '2px 6px', borderRadius: '4px' }}>
                                                                        {plist.discount_type === 'percentage' ? `${plist.discount_value}% Off` : `₹${plist.discount_value} Off`}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Coupon Row */}
                                    <div className="extra-row active" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                            <Icons.Tag size={14} style={{ color: appliedCoupon ? 'var(--success)' : 'var(--text-tertiary)' }} />
                                            <span>Coupon Code</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                className="extra-input"
                                                placeholder="ENTER CODE"
                                                value={couponCode}
                                                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                                disabled={appliedCoupon || loadingCoupon}
                                                style={{ flex: 1, textTransform: 'uppercase', height: '32px', minWidth: 0 }}
                                            />
                                            {appliedCoupon ? (
                                                <SButton
                                                    variant="secondary"
                                                    tone="critical"
                                                    style={{ padding: '0 12px', height: '32px' }}
                                                    onClick={() => {
                                                        if (appliedCoupon.type === 'product') {
                                                            try {
                                                                if (typeof appliedCoupon.value === 'string' && appliedCoupon.value.trim().startsWith('[')) {
                                                                    const items = JSON.parse(appliedCoupon.value);
                                                                    const idsToRemove = items.map(item => Number(item.id));
                                                                    const freeRowsToRemove = cart.filter(item => item.is_free && idsToRemove.includes(Number(item.product_id)));
                                                                    for (const row of freeRowsToRemove) {
                                                                        removeFromCart(row.cartRowId);
                                                                    }
                                                                } else {
                                                                    const prodId = Number(appliedCoupon.value || appliedCoupon.product_id);
                                                                    const freeProductInCart = cart.find(item => item.product_id === prodId && item.is_free);
                                                                    if (freeProductInCart) {
                                                                        removeFromCart(freeProductInCart.cartRowId);
                                                                    }
                                                                }
                                                            } catch (e) {
                                                                console.error('Failed to remove applied coupon rewards', e);
                                                            }
                                                        }
                                                        setAppliedCoupon(null);
                                                        setCouponCode('');
                                                    }}
                                                >
                                                    Remove
                                                </SButton>
                                            ) : (
                                                <SButton
                                                    variant="secondary"
                                                    style={{ padding: '0 12px', height: '32px' }}
                                                    onClick={handleApplyCouponCode}
                                                    disabled={loadingCoupon || !couponCode.trim()}
                                                >
                                                    {loadingCoupon ? 'Applying...' : 'Apply'}
                                                </SButton>
                                            )}
                                        </div>
                                        {appliedCoupon && (
                                            <div style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Icons.CheckCircle size={10} />
                                                <span>
                                                    Applied: {appliedCoupon.code} (
                                                    {appliedCoupon.type === 'discount' && `${appliedCoupon.value}% Off`}
                                                    {appliedCoupon.type === 'currency' && `₹${appliedCoupon.value} Off`}
                                                    {appliedCoupon.type === 'product' && 'Free Item added'}
                                                    )
                                                </span>
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
                                                    <span style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span>{c.name} x {c.quantity}</span>
                                                        {(() => {
                                                            const isPending = c.maxStock <= 0 || c.quantity > c.maxStock;
                                                            if (!isPending) return null;
                                                            const pendingQty = c.maxStock <= 0 ? c.quantity : (c.quantity - c.maxStock);
                                                            return (
                                                                <span style={{ 
                                                                    fontSize: '9px', 
                                                                    fontWeight: 700, 
                                                                    color: '#854D0E', 
                                                                    background: '#FEF9C3', 
                                                                    padding: '1px 4px', 
                                                                    borderRadius: '3px',
                                                                    border: '1px solid rgba(202, 138, 4, 0.3)'
                                                                }}>
                                                                    Pending: {pendingQty}
                                                                </span>
                                                            );
                                                        })()}
                                                    </span>
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
                                    {pricelist && pricelistDiscount > 0 && (
                                        <div className="break-item discount">
                                            <span>Pricelist ({pricelist.name})</span>
                                            <span>-₹{pricelistDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {appliedCoupon && (appliedCoupon.type === 'discount' || appliedCoupon.type === 'currency') && (
                                        <div className="break-item discount">
                                            <span>Coupon ({appliedCoupon.code})</span>
                                            <span>-₹{couponDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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

                                {settings.enable_loyalty_points === 'true' && selectedCustomer && (
                                    (() => {
                                        const customerObj = customers.find(c => String(c.id) === selectedCustomer);
                                        const availablePoints = customerObj?.loyalty_points || 0;
                                        if (availablePoints === 0) return null;

                                        const minRedeemPoints = parseInt(settings.loyalty_min_redeem_points || '100', 10);
                                        const isEligible = availablePoints >= minRedeemPoints;
                                        const redeemRate = parseFloat(settings.loyalty_points_redeem_rate || '100');

                                        const totalBeforeLoyalty = (Number(afterDiscountAndCoupon) || 0) + (Number(gstAmount) || 0) + loyaltyPointsDiscount;
                                        const maxPointsNeeded = Math.ceil(totalBeforeLoyalty * redeemRate);
                                        const maxRedeemablePoints = Math.min(availablePoints, maxPointsNeeded);

                                        return (
                                            <div className="loyalty-usage-box" style={{ marginTop: '10px', padding: '12px', background: 'rgba(10, 110, 255, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--accent)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--accent)' }}>
                                                            Available Loyalty Points: {availablePoints.toLocaleString('en-IN')} pts
                                                        </div>
                                                        {!isEligible && (
                                                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                                Min. {minRedeemPoints} pts required to redeem
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isEligible && (
                                                        <div className="toggle-switch" onClick={() => {
                                                            if (useLoyaltyPoints) {
                                                                setLoyaltyPointsToRedeem('');
                                                            } else {
                                                                setLoyaltyPointsToRedeem(maxRedeemablePoints);
                                                            }
                                                            setUseLoyaltyPoints(!useLoyaltyPoints);
                                                        }}>
                                                            <div className={`toggle-track ${useLoyaltyPoints ? 'on' : ''}`}></div>
                                                        </div>
                                                    )}
                                                </div>
                                                {useLoyaltyPoints && isEligible && (
                                                    <div className="form-group" style={{ marginTop: '10px', marginBottom: 0 }}>
                                                        <label style={{ fontSize: 'var(--font-size-xs)' }}>Points to redeem (Max: {maxRedeemablePoints})</label>
                                                        <input
                                                            type="number"
                                                            value={loyaltyPointsToRedeem}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                if (val === '') setLoyaltyPointsToRedeem('');
                                                                else if (Number(val) > maxRedeemablePoints) setLoyaltyPointsToRedeem(maxRedeemablePoints);
                                                                else setLoyaltyPointsToRedeem(Math.max(0, parseInt(val, 10)));
                                                            }}
                                                            style={{ height: '32px', fontSize: 'var(--font-size-xs)' }}
                                                            placeholder="Enter points..."
                                                        />
                                                        {Number(loyaltyPointsToRedeem) > 0 && (
                                                            <div style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '500', marginTop: '4px' }}>
                                                                Discount Value: ₹{(Number(loyaltyPointsToRedeem) / redeemRate).toFixed(2)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()
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
                                                                <CustomSelect
                                                                    value={p.method}
                                                                    onChange={val => {
                                                                        const newPayments = [...payments];
                                                                        newPayments[idx] = { ...newPayments[idx], method: val };
                                                                        setPayments(newPayments);
                                                                    }}
                                                                    options={[
                                                                        { value: 'Cash', label: 'Cash' },
                                                                        { value: 'UPI', label: 'UPI' },
                                                                        { value: 'Card', label: 'Card' },
                                                                        { value: 'Cheque', label: 'Cheque' },
                                                                        { value: 'Wallet', label: 'Wallet (P-Credit)' }
                                                                    ]}
                                                                />
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
                                                {['Cash', 'UPI', 'Card', 'Wallet'].map(method => (
                                                    <SButton
                                                        key={method}
                                                        variant={paymentMethod === method ? 'primary' : 'secondary'}
                                                        size="slim"
                                                        onClick={() => setPaymentMethod(method)}
                                                        style={{ flex: 1 }}
                                                    >
                                                        {method === 'Wallet' ? 'Wallet (P-Credit)' : method}
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

            {tab === 'quotation' && (
                <div className="quotation-tab-view" key={quotationMode} style={{ animation: 'fadeIn 0.3s ease' }}>
                    {quotationMode === 'list' ? (
                        <div className="quotation-list-view">
                            <div style={{ marginBottom: '20px' }}>
                                <div className="search-bar" style={{ maxWidth: '400px', marginBottom: 0 }}>
                                    <Icons.Search />
                                    <input
                                        placeholder="Search quotations by template name or customer..."
                                        value={quotationSearch}
                                        onChange={e => setQuotationSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="history-table-wrap">
                                {quotations.length === 0 ? (
                                    <div className="empty-state-premium">
                                        <div className="empty-icon-wrapper">
                                            <Icons.FileText size={40} />
                                        </div>
                                        <h3>No Quotations Yet</h3>
                                        <p>Create global quotation templates or drafts for your customers.</p>
                                        <SButton variant="primary" onClick={() => setQuotationMode('create')}>
                                            Create First Quotation
                                        </SButton>
                                    </div>
                                ) : (
                                    <table className="premium-table">
                                        <thead>
                                            <tr>
                                                <th>QTN #</th>
                                                <th>Quotation Name</th>
                                                <th>Assigned Customer</th>
                                                <th>Tax (GST %)</th>
                                                <th>Discount %</th>
                                                <th>Total Value</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {quotations.filter(q => {
                                                const searchLower = quotationSearch.toLowerCase();
                                                const qtnNo = `QTN-${String(q.id).padStart(4, '0')}`.toLowerCase();
                                                const name = (q.name || '').toLowerCase();
                                                const custName = (q.customer_name || q.walk_in_name || 'Global Template').toLowerCase();
                                                return qtnNo.includes(searchLower) || name.includes(searchLower) || custName.includes(searchLower);
                                            }).map(q => (
                                                <tr key={q.id}>
                                                    <td>
                                                        <span className="premium-badge badge-secondary" style={{ fontStyle: 'monospace' }}>
                                                            QTN-{String(q.id).padStart(4, '0')}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{q.name}</span>
                                                    </td>
                                                    <td>
                                                        {q.customer_name ? (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <Icons.User size={14} style={{ color: 'var(--accent)' }} /> {q.customer_name}
                                                            </span>
                                                        ) : q.walk_in_name ? (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                                                                <Icons.User size={14} /> {q.walk_in_name} (Walk-in)
                                                            </span>
                                                        ) : (
                                                            <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
                                                                Global Template
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>{q.gst_rate > 0 ? `${q.gst_rate}%` : 'Exempted'}</td>
                                                    <td>{q.discount_rate > 0 ? `${q.discount_rate}%` : 'None'}</td>
                                                    <td>
                                                        <span style={{ fontWeight: '700', color: 'var(--accent)' }}>
                                                            ₹{(q.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                                                            <SButton
                                                                variant="secondary"
                                                                size="sm"
                                                                title="View Quotation"
                                                                onClick={async () => {
                                                                    try {
                                                                        const res = await api.getQuotation(q.id);
                                                                        setSelectedQuotation(res);
                                                                    } catch (err) {
                                                                        toast.error('Failed to load quotation details');
                                                                    }
                                                                }}
                                                            >
                                                                <Icons.Eye size={14} /> View
                                                            </SButton>
                                                            <SButton
                                                                variant="secondary"
                                                                size="sm"
                                                                tone="critical"
                                                                title="Delete Quotation"
                                                                onClick={() => handleDeleteQuotation(q.id)}
                                                            >
                                                                <Icons.Trash2 size={14} />
                                                            </SButton>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="invoice-layout">
                            <div className="invoice-products-section">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Add Products</h3>
                                    <SButton variant="secondary" onClick={() => setQuotationMode('list')}>
                                        <Icons.ChevronLeft size={14} strokeWidth={2.5} /> Back to List
                                    </SButton>
                                </div>
                                <div className="search-bar">
                                    <Icons.Search size={20} />
                                    <input
                                        placeholder="Search products to add..."
                                        value={quotationProductSearch}
                                        onChange={e => setQuotationProductSearch(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div className="categorized-product-picker">
                                    {quotationCategories.map(cat => {
                                        const subcatsMap = quotationCategorizedProducts[cat] || {};
                                        const subcatNames = Object.keys(subcatsMap);

                                        return (
                                            <div key={cat} className="category-group" style={{ marginBottom: '24px' }}>
                                                <h4 className="category-title">
                                                    {cat}
                                                </h4>
                                                {subcatNames.map(subcat => {
                                                    const productsInSub = subcatsMap[subcat] || [];
                                                    return (
                                                        <div key={subcat} className="subcategory-group" style={{ marginBottom: '16px' }}>
                                                            <h5
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
                                                            >
                                                                <Icons.ChevronRight size={12} strokeWidth={3} />
                                                                {subcat}
                                                            </h5>
                                                            <div className="category-products">
                                                                {productsInSub.map(p => {
                                                                    const cartItemInfo = quotationCart.filter(c => c.product_id === p.id && !c.variant_id);
                                                                    const totalQty = cartItemInfo.reduce((sum, c) => sum + c.quantity, 0);
                                                                    const firstItem = cartItemInfo[0];
                                                                    const hasVariants = p.variants_count > 0;
                                                                    const stockQty = hasVariants ? (p.variants_stock || 0) : p.stock_quantity;
                                                                    const isUnavailable = stockQty <= 0;
                                                                    return (
                                                                        <div key={p.id} className={`product-picker-item ${isUnavailable ? 'unavailable' : ''}`}>
                                                                            <div className="p-main">
                                                                                <span className="p-name">{p.name}</span>
                                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                                    <span className="p-stock">
                                                                                        In Stock: {stockQty} {hasVariants && <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 'normal' }}>(Variants)</span>}
                                                                                    </span>
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
                                                                                                updateQuotationProductTotalQty(p, totalQty - 1);
                                                                                            } else {
                                                                                                updateQuotationProductTotalQty(p, 0);
                                                                                            }
                                                                                        }}>-</button>
                                                                                        <input
                                                                                            className="p-qty-num"
                                                                                            type="number"
                                                                                            step={p.allow_decimal ? "0.01" : "1"}
                                                                                            value={totalQty}
                                                                                            onChange={e => updateQuotationProductTotalQty(p, parseFloat(e.target.value) || 0)}
                                                                                            style={{ width: '50px', border: 'none', background: 'transparent', textAlign: 'center', fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}
                                                                                        />
                                                                                        <button
                                                                                            onClick={() => updateQuotationProductTotalQty(p, totalQty + 1)}
                                                                                        >+</button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <button className="p-add-icon" onClick={() => addToQuotationCart(p)} title="Add to Cart">
                                                                                        <Icons.Plus size={14} strokeWidth={3} />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="invoice-summary">
                                <h3>Quotation Template Details</h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Quotation Name / Title *</label>
                                        <input
                                            placeholder="e.g. Summer Special Deal"
                                            value={quotationName}
                                            onChange={e => setQuotationName(e.target.value)}
                                            style={{ width: '100%', boxSizing: 'border-box' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Customer Assignment</label>
                                        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px' }}>
                                                <input
                                                    type="radio"
                                                    name="customerType"
                                                    checked={!quotationCustomer && !quotationWalkInName}
                                                    onChange={() => { setQuotationCustomer(null); setQuotationWalkInName(''); setQuotationWalkInPhone(''); }}
                                                />
                                                Global Template
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px' }}>
                                                <input
                                                    type="radio"
                                                    name="customerType"
                                                    checked={!!quotationCustomer}
                                                    onChange={() => { setQuotationCustomer(customers[0] || null); setQuotationWalkInName(''); setQuotationWalkInPhone(''); }}
                                                />
                                                Existing Customer
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px' }}>
                                                <input
                                                    type="radio"
                                                    name="customerType"
                                                    checked={!!quotationWalkInName}
                                                    onChange={() => { setQuotationCustomer(null); setQuotationWalkInName('Walk-in Client'); }}
                                                />
                                                Walk-in Customer
                                            </label>
                                        </div>

                                        {!!quotationCustomer && (
                                            <CustomSelect
                                                value={quotationCustomer ? String(quotationCustomer.id) : ''}
                                                onChange={val => setQuotationCustomer(customers.find(c => String(c.id) === val) || null)}
                                                options={customers.map(c => ({ value: String(c.id), label: `${c.name} (${c.phone || 'No Phone'})` }))}
                                                style={{ width: '100%' }}
                                            />
                                        )}

                                        {!quotationCustomer && !!quotationWalkInName && (
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                                <input
                                                    placeholder="Client Name"
                                                    value={quotationWalkInName}
                                                    onChange={e => setQuotationWalkInName(e.target.value)}
                                                    style={{ flex: 1 }}
                                                />
                                                <input
                                                    placeholder="Client Phone"
                                                    value={quotationWalkInPhone}
                                                    onChange={e => setQuotationWalkInPhone(e.target.value)}
                                                    style={{ flex: 1 }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ flex: 1, minHeight: '180px', display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Quotation Cart</label>
                                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: '250px', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px', background: 'var(--bg-secondary)' }}>
                                        {quotationCart.length === 0 ? (
                                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', fontStyle: 'italic' }}>Quotation cart is empty. Click products on the left to add.</div>
                                        ) : (
                                            quotationCart.map((item, idx) => (
                                                <div key={`${item.product_id}-${item.variant_id || idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                                        <span style={{ fontSize: '13px', fontWeight: '600' }}>{item.name}</span>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>₹{item.price.toLocaleString('en-IN')} / {item.unit}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <button 
                                                            style={{ border: 'none', background: 'transparent', padding: '2px', cursor: 'pointer' }}
                                                            onClick={() => {
                                                                if (item.quantity <= 1) {
                                                                    setQuotationCart(quotationCart.filter((_, i) => i !== idx));
                                                                } else {
                                                                    setQuotationCart(quotationCart.map((c, i) => i === idx ? { ...c, quantity: c.quantity - 1 } : c));
                                                                }
                                                            }}
                                                        >
                                                            <Icons.MinusCircle size={16} style={{ color: 'var(--text-secondary)' }} />
                                                        </button>
                                                        <span style={{ fontSize: '13px', fontWeight: '700', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                                                        <button 
                                                            style={{ border: 'none', background: 'transparent', padding: '2px', cursor: 'pointer' }}
                                                            onClick={() => setQuotationCart(quotationCart.map((c, i) => i === idx ? { ...c, quantity: c.quantity + 1 } : c))}
                                                        >
                                                            <Icons.PlusCircle size={16} style={{ color: 'var(--accent)' }} />
                                                        </button>
                                                        <button 
                                                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: '6px' }}
                                                            onClick={() => setQuotationCart(quotationCart.filter((_, i) => i !== idx))}
                                                        >
                                                            <Icons.X size={14} style={{ color: 'var(--danger)' }} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span>Subtotal</span>
                                        <span style={{ fontWeight: '600' }}>₹{quotationCart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString('en-IN')}</span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={quotationDiscountEnabled}
                                                onChange={e => {
                                                    setQuotationDiscountEnabled(e.target.checked);
                                                    if (!e.target.checked) setQuotationDiscountRate(0);
                                                }}
                                            />
                                            Discount (%)
                                        </label>
                                        {quotationDiscountEnabled && (
                                            <input
                                                type="number"
                                                value={quotationDiscountRate}
                                                onChange={e => setQuotationDiscountRate(Math.max(0, Math.min(100, Number(e.target.value))))}
                                                style={{ width: '60px', padding: '4px', textAlign: 'right' }}
                                            />
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={quotationGstEnabled}
                                                onChange={e => {
                                                    setQuotationGstEnabled(e.target.checked);
                                                    if (!e.target.checked) setQuotationGstRate(18);
                                                }}
                                            />
                                            Apply GST (%)
                                        </label>
                                        {quotationGstEnabled && (
                                            <input
                                                type="number"
                                                value={quotationGstRate}
                                                onChange={e => setQuotationGstRate(Math.max(0, Number(e.target.value)))}
                                                style={{ width: '60px', padding: '4px', textAlign: 'right' }}
                                            />
                                        )}
                                    </div>

                                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold' }}>
                                        <span>Quotation Estimate</span>
                                        <span style={{ color: 'var(--accent)' }}>
                                            {(() => {
                                                const subtotal = quotationCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                                                const discount = quotationDiscountEnabled ? (subtotal * (quotationDiscountRate / 100)) : 0;
                                                const gst = quotationGstEnabled ? ((subtotal - discount) * (quotationGstRate / 100)) : 0;
                                                return `₹${(subtotal - discount + gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                                            })()}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <SButton variant="secondary" style={{ flex: 1 }} onClick={() => setQuotationMode('list')}>
                                        Cancel
                                    </SButton>
                                    <SButton variant="primary" style={{ flex: 1.5 }} onClick={handleCreateQuotation}>
                                        Save Quotation
                                    </SButton>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Customer Selector Modal for Convert to Order */}
            {showCustomerSelectForConvert && (
                <div className="premium-modal-backdrop" style={{ display: 'flex', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="premium-modal" style={{ width: '400px', background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Assign Customer to Order</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>Choose a customer to populate the invoice data for this order.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Selection Mode</label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px' }}>
                                        <input
                                            type="radio"
                                            name="convertCustType"
                                            checked={selectedCustomerForConvert !== 'walk-in'}
                                            onChange={() => {
                                                setSelectedCustomerForConvert(customers[0]?.id || '');
                                            }}
                                        />
                                        Existing Customer
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px' }}>
                                        <input
                                            type="radio"
                                            name="convertCustType"
                                            checked={selectedCustomerForConvert === 'walk-in'}
                                            onChange={() => {
                                                setSelectedCustomerForConvert('walk-in');
                                                setWalkInNameForConvert('Walk-in Customer');
                                            }}
                                        />
                                        Walk-in Customer
                                    </label>
                                </div>
                            </div>

                            {selectedCustomerForConvert !== 'walk-in' ? (
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Select Customer</label>
                                    <CustomSelect
                                        value={String(selectedCustomerForConvert)}
                                        onChange={val => setSelectedCustomerForConvert(val)}
                                        options={customers.map(c => ({ value: String(c.id), label: `${c.name} (${c.phone || 'No Phone'})` }))}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Customer Name</label>
                                        <input
                                            placeholder="Client Name"
                                            value={walkInNameForConvert}
                                            onChange={e => setWalkInNameForConvert(e.target.value)}
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Customer Phone (Optional)</label>
                                        <input
                                            placeholder="Client Phone"
                                            value={walkInPhoneForConvert}
                                            onChange={e => setWalkInPhoneForConvert(e.target.value)}
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <SButton variant="secondary" style={{ flex: 1 }} onClick={() => setShowCustomerSelectForConvert(null)}>
                                    Cancel
                                </SButton>
                                <SButton variant="primary" style={{ flex: 1.5 }} onClick={() => {
                                    if (selectedCustomerForConvert === 'walk-in') {
                                        if (!walkInNameForConvert.trim()) {
                                            toast.error('Please enter a name for the walk-in customer');
                                            return;
                                        }
                                        proceedWithQuotationConvert(showCustomerSelectForConvert, 'walk-in', walkInNameForConvert.trim(), walkInPhoneForConvert.trim());
                                    } else {
                                        if (!selectedCustomerForConvert) {
                                            toast.error('Please select an existing customer');
                                            return;
                                        }
                                        proceedWithQuotationConvert(showCustomerSelectForConvert, selectedCustomerForConvert, '', '');
                                    }
                                }}>
                                    Proceed to Cart
                                </SButton>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'ai-sales' && (
                <div className="ai-sales-dashboard" style={{ animation: 'fadeIn 0.3s ease' }}>
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
                                            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                                <SButton variant="secondary" tone="critical" style={{ flex: 1 }} onClick={() => handleUpdateMazewayStatus(order.id, 'REJECTED')}>Reject</SButton>
                                                <SButton variant="primary" style={{ flex: 1 }} onClick={() => handleConvertOrderToInvoice(order)}>Convert to Invoice</SButton>
                                            </div>
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
                <div className="history-view" style={{ animation: 'fadeIn 0.3s ease' }}>
                    {/* Sales Trend Sparkline */}
                    {invoices.length > 0 && (() => {
                        const last30 = Array.from({ length: 30 }, (_, i) => {
                            const d = new Date();
                            d.setDate(d.getDate() - (29 - i));
                            const year = d.getFullYear();
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            return `${year}-${month}-${day}`;
                        });
                        const salesByDay = last30.map(dateStr => {
                            const total = invoices
                                .filter(inv => inv.date === dateStr)
                                .reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
                            return total;
                        });
                        const labels = last30.map(d => {
                            const [, m, day] = d.split('-');
                            return `${parseInt(day)}/${parseInt(m)}`;
                        });
                        return (
                            <div style={{
                                background: 'var(--bg-card, #ffffff)',
                                border: '1px solid var(--border-light)',
                                borderRadius: '16px',
                                padding: '14px 24px 4px 24px',
                                marginBottom: '18px',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Daily Sales Trend — Last 30 Days</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>₹{salesByDay.reduce((a, b) => a + b, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} total</span>
                                </div>
                                <LineChart
                                    height={240}
                                    margin={{ left: 60, right: 20, top: 12, bottom: 24 }}
                                    xAxis={[{ data: labels, scaleType: 'point', tickInterval: (_, i) => i % 5 === 0 }]}
                                    series={[{ data: salesByDay, color: 'var(--accent, #6366f1)', valueFormatter: v => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` }]}
                                    slotProps={{ legend: { hidden: true } }}
                                    sx={{ '& .MuiChartsAxis-tickLabel': { fontSize: '11px', fill: 'var(--text-secondary)' }, '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: 'var(--border-light)' } }}
                                />
                            </div>
                        );
                    })()}
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
                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--text-tertiary)' }}>CATEGORY:</span>
                            <CustomSelect
                                value={categoryFilter}
                                onChange={val => setCategoryFilter(val)}
                                options={historyCategories.map(cat => ({
                                    value: cat,
                                    label: cat === 'All' ? 'All Categories' : cat
                                }))}
                            />
                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--text-tertiary)', marginLeft: '8px' }}>STATUS:</span>
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

                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.85)',
                        backdropFilter: 'blur(8px)',
                        border: selectedInvoiceIds.length > 0 ? '1px solid var(--border-light)' : '0px solid transparent',
                        padding: selectedInvoiceIds.length > 0 ? '12px 24px' : '0px 24px',
                        borderRadius: '12px',
                        marginBottom: selectedInvoiceIds.length > 0 ? '16px' : '0px',
                        boxShadow: selectedInvoiceIds.length > 0 ? '0 8px 30px rgba(0, 0, 0, 0.08)' : 'none',
                        maxHeight: selectedInvoiceIds.length > 0 ? '80px' : '0px',
                        opacity: selectedInvoiceIds.length > 0 ? 1 : 0,
                        transform: selectedInvoiceIds.length > 0 ? 'translateY(0)' : 'translateY(-10px)',
                        pointerEvents: selectedInvoiceIds.length > 0 ? 'auto' : 'none',
                        overflow: 'hidden',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                                background: 'var(--accent)',
                                color: '#fff',
                                padding: '2px 8px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}>{selectedInvoiceIds.length > 0 ? selectedInvoiceIds.length : lastSelectedInvoiceCount.current}</span>
                            <span style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>Invoices Selected</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <SButton 
                                variant="primary" 
                                onClick={handleMergeInvoices} 
                                disabled={selectedInvoiceIds.length < 2}
                            >
                                Merge Invoices
                            </SButton>
                            <SButton 
                                variant="primary" 
                                tone="critical" 
                                onClick={handleBulkDeleteInvoices}
                            >
                                Delete Selected
                            </SButton>
                            <SButton 
                                variant="secondary" 
                                onClick={() => setSelectedInvoiceIds([])}
                            >
                                Clear Selection
                            </SButton>
                        </div>
                    </div>

                    <div className="history-table-wrap">
                        {invoices.length === 0 ? (
                            <div className="empty-state-premium">
                                <div className="empty-icon-wrapper">
                                    <Icons.History size={40} />
                                </div>
                                <h3>No Sales Yet</h3>
                                <p>Start creating invoices to record your sales.</p>
                                <SButton variant="primary" onClick={() => setTab('new')}>
                                    Create Invoice
                                </SButton>
                            </div>
                        ) : (
                            <>
                                <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px', textAlign: 'center' }}>
                                            <div 
                                                onClick={() => {
                                                    const allVisibleChecked = paginatedInvoices.length > 0 && paginatedInvoices.every(inv => selectedInvoiceIds.includes(inv.id));
                                                    if (allVisibleChecked) {
                                                        setSelectedInvoiceIds(selectedInvoiceIds.filter(id => !paginatedInvoices.some(inv => inv.id === id)));
                                                    } else {
                                                        const newSelected = new Set([...selectedInvoiceIds, ...paginatedInvoices.map(inv => inv.id)]);
                                                        setSelectedInvoiceIds(Array.from(newSelected));
                                                    }
                                                }}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: '18px',
                                                    height: '18px',
                                                    borderRadius: '4px',
                                                    border: '1.5px solid ' + (paginatedInvoices.length > 0 && paginatedInvoices.every(inv => selectedInvoiceIds.includes(inv.id)) ? 'var(--accent)' : 'var(--text-tertiary)'),
                                                    background: paginatedInvoices.length > 0 && paginatedInvoices.every(inv => selectedInvoiceIds.includes(inv.id)) ? 'var(--accent)' : 'transparent',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    transform: paginatedInvoices.length > 0 && paginatedInvoices.every(inv => selectedInvoiceIds.includes(inv.id)) ? 'scale(1.05)' : 'scale(1)',
                                                    userSelect: 'none',
                                                    margin: '0 auto',
                                                    boxShadow: paginatedInvoices.length > 0 && paginatedInvoices.every(inv => selectedInvoiceIds.includes(inv.id)) ? '0 2px 6px rgba(10, 110, 255, 0.2)' : 'none'
                                                }}
                                            >
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    opacity: paginatedInvoices.length > 0 && paginatedInvoices.every(inv => selectedInvoiceIds.includes(inv.id)) ? 1 : 0,
                                                    transform: paginatedInvoices.length > 0 && paginatedInvoices.every(inv => selectedInvoiceIds.includes(inv.id)) ? 'scale(1)' : 'scale(0.5)',
                                                    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                                }}>
                                                    <Icons.Check size={12} color="#fff" strokeWidth={3} />
                                                </div>
                                            </div>
                                        </th>
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
                                    {paginatedInvoices
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
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div 
                                                            onClick={() => {
                                                                const isChecked = selectedInvoiceIds.includes(inv.id);
                                                                if (isChecked) {
                                                                    setSelectedInvoiceIds(selectedInvoiceIds.filter(id => id !== inv.id));
                                                                } else {
                                                                    setSelectedInvoiceIds([...selectedInvoiceIds, inv.id]);
                                                                }
                                                            }}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                width: '18px',
                                                                height: '18px',
                                                                borderRadius: '4px',
                                                                border: '1.5px solid ' + (selectedInvoiceIds.includes(inv.id) ? 'var(--accent)' : 'var(--text-tertiary)'),
                                                                background: selectedInvoiceIds.includes(inv.id) ? 'var(--accent)' : 'transparent',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                transform: selectedInvoiceIds.includes(inv.id) ? 'scale(1.05)' : 'scale(1)',
                                                                userSelect: 'none',
                                                                margin: '0 auto',
                                                                boxShadow: selectedInvoiceIds.includes(inv.id) ? '0 2px 6px rgba(10, 110, 255, 0.2)' : 'none'
                                                            }}
                                                        >
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                opacity: selectedInvoiceIds.includes(inv.id) ? 1 : 0,
                                                                transform: selectedInvoiceIds.includes(inv.id) ? 'scale(1)' : 'scale(0.5)',
                                                                transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                                            }}>
                                                                <Icons.Check size={12} color="#fff" strokeWidth={3} />
                                                            </div>
                                                        </div>
                                                    </td>
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
                                                            <SButton variant="secondary" onClick={() => { handleViewInvoice(inv.id); }} title="View Invoice">
                                                                <Icons.Eye size={14} />
                                                            </SButton>
                                                            <SButton variant="secondary" onClick={() => handleViewLogs(inv.id)} title="View Invoice Log">
                                                                <Icons.Clock size={14} />
                                                            </SButton>
                                                            {(inv.items && inv.items.length > 0) && (() => {
                                                                const isFullyReturned =
                                                                    inv.return_type === 'full' ||
                                                                    (inv.financial_status || '').toUpperCase() === 'RETURNED';
                                                                if (isFullyReturned) return null;
                                                                return (
                                                                    <SButton variant="secondary" onClick={() => {
                                                                        setReturningInvoice(inv);
                                                                        const initialQtys = {};
                                                                        inv.items.forEach(item => initialQtys[item.id] = 0);
                                                                        setReturnQuantities(initialQtys);
                                                                    }} title="Return Items">
                                                                        <Icons.RotateCcw size={14} />
                                                                    </SButton>
                                                                );
                                                            })()}
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
                            {filteredInvoices.length > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-light)', marginTop: 8 }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        Showing <strong style={{ color: 'var(--accent)', fontWeight: '600' }}>{(historyPage - 1) * HISTORY_PAGE_SIZE + 1}</strong> to <strong style={{ color: 'var(--accent)', fontWeight: '600' }}>{Math.min(historyPage * HISTORY_PAGE_SIZE, filteredInvoices.length)}</strong> of <strong style={{ color: 'var(--accent)', fontWeight: '600' }}>{filteredInvoices.length}</strong> records
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button 
                                            disabled={historyPage === 1} 
                                            onClick={() => setHistoryPage(p => p - 1)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--text-primary)',
                                                cursor: historyPage === 1 ? 'not-allowed' : 'pointer',
                                                fontSize: '16px',
                                                padding: '4px 8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                outline: 'none',
                                                opacity: historyPage === 1 ? 0.3 : 0.8,
                                                transition: 'opacity 0.2s'
                                            }}
                                            onMouseEnter={(e) => { if (historyPage !== 1) e.currentTarget.style.opacity = '1'; }}
                                            onMouseLeave={(e) => { if (historyPage !== 1) e.currentTarget.style.opacity = '0.8'; }}
                                        >
                                            &lt;
                                        </button>
                                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', minWidth: '45px', textAlign: 'center' }}>
                                            {historyPage} / {totalHistoryPages}
                                        </span>
                                        <button 
                                            disabled={historyPage === totalHistoryPages} 
                                            onClick={() => setHistoryPage(p => p + 1)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--text-primary)',
                                                cursor: historyPage === totalHistoryPages ? 'not-allowed' : 'pointer',
                                                fontSize: '16px',
                                                padding: '4px 8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                outline: 'none',
                                                opacity: historyPage === totalHistoryPages ? 0.3 : 0.8,
                                                transition: 'opacity 0.2s'
                                            }}
                                            onMouseEnter={(e) => { if (historyPage !== totalHistoryPages) e.currentTarget.style.opacity = '1'; }}
                                            onMouseLeave={(e) => { if (historyPage !== totalHistoryPages) e.currentTarget.style.opacity = '0.8'; }}
                                        >
                                            &gt;
                                        </button>
                                    </div>
                                </div>
                            )}
                            </>
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

            {selectedQuotation && (
                <QuotationPreviewModal
                    quotation={selectedQuotation}
                    onClose={() => setSelectedQuotation(null)}
                    onConvert={handleQuotationConvert}
                />
            )}

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
                            <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '12px 0' }}>
                                    {item.product_name}
                                    {item.variant_name ? <span style={{ fontSize: '0.82em', color: 'var(--text-secondary)', marginLeft: 6 }}>({item.variant_name})</span> : null}
                                </td>
                                <td style={{ padding: '12px 0' }}>{item.qty_delivered || item.quantity}</td>
                                <td style={{ padding: '12px 0' }}>
                                    <input
                                        type="number"
                                        className="modal-qty-input"
                                        min="0"
                                        max={item.qty_delivered || item.quantity}
                                        value={returnQuantities[item.id] || 0}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === '') {
                                                setReturnQuantities({ ...returnQuantities, [item.id]: '' });
                                            } else {
                                                setReturnQuantities({
                                                    ...returnQuantities,
                                                    [item.id]: Math.min((item.qty_delivered || item.quantity), Math.max(0, parseInt(val) || 0))
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
                        const subtotal = Object.entries(returnQuantities).reduce((sum, [itemId, qty]) => {
                            const original = returningInvoice.items.find(i => String(i.id) === String(itemId));
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
                            const qtyRet = Number(returnQuantities[item.id] || 0);
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
                                        {returningInvoice.paid_amount > 0 && (
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '6px', borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                                                Tip: Select <strong>Direct Cash Refund</strong> to pay back directly without reducing the customer's outstanding due.
                                            </div>
                                        )}
                                    </>
                                )}

                                <div style={{ width: '100%', display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px', flexWrap: 'wrap' }}>
                                    <SButton onClick={() => setReturningInvoice(null)}>Cancel</SButton>
                                    {totalReturnVal === 0 ? (
                                        <SButton variant="primary" onClick={() => handleProcessReturn('refund')} loading={saving}>
                                            Thank You
                                        </SButton>
                                    ) : (
                                        <>
                                            {currentDue < totalReturnVal ? (
                                                <>
                                                    <SButton variant="primary" onClick={() => handleProcessReturn('refund')} loading={saving}>
                                                        Refund Back (Adjust Due)
                                                    </SButton>
                                                    {returningInvoice.customer_id && (
                                                        <SButton variant="primary" style={{ background: 'var(--accent)' }} onClick={() => handleProcessReturn('p_credit')} loading={saving}>
                                                            Convert to P-Credit
                                                        </SButton>
                                                    )}
                                                </>
                                            ) : (
                                                <SButton variant="primary" onClick={() => handleProcessReturn('refund')} loading={saving}>
                                                    Confirm Return (Reduce Due)
                                                </SButton>
                                            )}
                                            {returningInvoice.paid_amount > 0 && (
                                                <SButton variant="primary" style={{ background: 'var(--warning)', borderColor: 'var(--warning)' }} onClick={() => handleProcessReturn('direct_cash')} loading={saving}>
                                                    Direct Cash Refund
                                                </SButton>
                                            )}
                                        </>
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
                    />
                </div>

                <div className="form-group">
                    <label>Payment Method</label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        {['Cash', 'UPI', 'Card', 'Wallet'].map(method => (
                            <SButton
                                key={method}
                                variant={paymentMethod === method ? 'primary' : 'secondary'}
                                onClick={() => setPaymentMethod(method)}
                                style={{ flex: 1 }}
                            >
                                {method === 'Wallet' ? 'Wallet (P-Credit)' : method}
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
                                            max={item.pending_qty}
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
                        Warning: Products will be returned to inventory, and unpaid amounts will no longer be tracked.
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
                    />
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    {allFiltered.map(p => {
                        const hasVariants = p.variants_count > 0;
                        const stockQty = hasVariants ? (p.variants_stock || 0) : p.stock_quantity;
                        return (
                            <div key={p.id} className="product-picker-item" style={{ border: 'none', borderBottom: '1px solid var(--border-light)', borderRadius: 0 }}>
                                <div className="p-main">
                                    <span className="p-name">{p.name}</span>
                                    <span className="p-stock">Stock: {stockQty} {hasVariants && <span style={{ fontSize: '10px', color: 'var(--accent)' }}>(Variants)</span>}</span>
                                </div>
                                <div className="p-side">
                                    <SButton variant="primary" size="small" onClick={() => {
                                        if (stockQty <= 0) {
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
                        );
                    })}
                    {allFiltered.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No products found</div>
                    )}
                </div>
            </Modal>

            <Modal
                open={!!variantModalProduct}
                onClose={() => { setVariantModalProduct(null); setVariantModalSource('cart'); }}
                heading={`Select Variant: ${variantModalProduct?.name}`}
                size="small"
                secondaryAction={
                    <SButton onClick={() => { setVariantModalProduct(null); setVariantModalSource('cart'); }}>Cancel</SButton>
                }
            >
                <div className="variants-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                    {variantModalVariants.map(v => (
                        <div
                            key={v.id}
                            className={`variant-card ${v.stock_quantity <= 0 ? 'unavailable' : ''}`}
                            onClick={() => {
                                if (v.stock_quantity <= 0) return;
                                if (variantModalSource === 'quotation') {
                                    addFinalToQuotationCart(variantModalProduct, v);
                                } else {
                                    addFinalToCart(variantModalProduct, v);
                                }
                                setVariantModalProduct(null);
                                setVariantModalSource('cart');
                            }}
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

            <Modal
                open={showSerialSelectModal}
                onClose={() => { setShowSerialSelectModal(false); setSerialSelectCartRowId(null); }}
                heading="Select Serial/IMEI Numbers"
                size="medium"
                primaryAction={
                    <SButton variant="primary" onClick={saveSelectedSerials}>Save & Apply</SButton>
                }
                secondaryAction={
                    <SButton onClick={() => { setShowSerialSelectModal(false); setSerialSelectCartRowId(null); }}>Cancel</SButton>
                }
            >
                {serialSelectLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}>
                        <div className="spinner" style={{ borderTopColor: 'var(--accent)', width: '30px', height: '30px' }}></div>
                    </div>
                ) : (
                    <div>
                        {/* Scan Serial Input Section */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                Scan Serial / IMEI Barcode:
                            </label>
                            <input
                                type="text"
                                placeholder="Scan or type serial number and press Enter..."
                                onKeyDown={handleScanSerialInput}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    outline: 'none',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)'
                                }}
                            />
                        </div>

                        {/* Search Query Filter */}
                        <div style={{ marginBottom: '16px' }}>
                            <input
                                type="text"
                                placeholder="Search serial numbers..."
                                value={serialSearchQuery}
                                onChange={(e) => setSerialSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    outline: 'none',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)'
                                }}
                            />
                        </div>

                        {/* Items Selection Counters */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '13px', fontWeight: 600 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Available Serials:</span>
                            <span style={{ color: selectedSerials.length === (cart.find(c => c.cartRowId === serialSelectCartRowId)?.quantity || 0) ? 'var(--success)' : 'var(--danger)' }}>
                                Selected: {selectedSerials.length} of {cart.find(c => c.cartRowId === serialSelectCartRowId)?.quantity || 0}
                            </span>
                        </div>

                        {/* Checklist Section */}
                        <div style={{
                            maxHeight: '250px',
                            overflowY: 'auto',
                            border: '1px solid var(--border-light)',
                            borderRadius: '8px',
                            background: 'var(--bg-secondary)'
                        }}>
                            {availableSerials.filter(s => 
                                s.serial_number.toLowerCase().includes(serialSearchQuery.toLowerCase())
                            ).length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontStyle: 'italic', fontSize: '13px' }}>
                                    No serial numbers match your search or are available.
                                </div>
                            ) : (
                                availableSerials.filter(s => 
                                    s.serial_number.toLowerCase().includes(serialSearchQuery.toLowerCase())
                                ).map((serial) => {
                                    const isChecked = selectedSerials.includes(serial.serial_number);
                                    return (
                                        <label
                                            key={serial.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '12px 16px',
                                                borderBottom: '1px solid var(--border-light)',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                transition: 'background 0.15s ease',
                                                background: isChecked ? 'rgba(var(--accent-rgb), 0.04)' : 'transparent',
                                                fontSize: '13px',
                                                color: 'var(--text-primary)'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleSerialSelection(serial.serial_number)}
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    accentColor: 'var(--accent)',
                                                    cursor: 'pointer'
                                                }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600 }}>{serial.serial_number}</div>
                                                {serial.status !== 'Available' && (
                                                    <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                                                        (Selected for this item)
                                                    </span>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                open={showMergeModal}
                onClose={() => setShowMergeModal(false)}
                heading="Merge Invoices"
                size="base"
                primaryAction={
                    <SButton variant="primary" onClick={submitMergeInvoices} disabled={merging} loading={merging}>
                        {merging ? 'Merging...' : 'Merge Invoices'}
                    </SButton>
                }
                secondaryAction={
                    <SButton variant="secondary" onClick={() => setShowMergeModal(false)}>
                        Cancel
                    </SButton>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        You are merging <strong>{selectedInvoiceIds.length}</strong> invoices:
                    </p>
                    <div style={{
                        maxHeight: '120px',
                        overflowY: 'auto',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        padding: '8px',
                        background: 'var(--bg-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                    }}>
                        {invoices
                            .filter(inv => selectedInvoiceIds.includes(inv.id))
                            .map(inv => (
                                <div key={inv.id} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span>INV-{String(inv.id).padStart(4, '0')} ({inv.customer_name || inv.walk_in_name || 'Walk-in'})</span>
                                    <span className="fw-600">₹{Number(inv.total || 0).toLocaleString('en-IN')}</span>
                                </div>
                            ))
                        }
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            Select Customer for Merged Invoice:
                        </label>
                        <CustomSelect
                            value={mergeCustomer}
                            onChange={val => {
                                setMergeCustomer(val);
                                if (val !== 'walk-in') {
                                    setMergeWalkInName('');
                                    setMergeWalkInPhone('');
                                }
                            }}
                            options={[
                                { value: 'walk-in', label: 'Walk-in Guest' },
                                ...customers.map(c => ({
                                    value: String(c.id),
                                    label: `${c.name} (${c.phone || 'No Phone'})`
                                }))
                            ]}
                        />
                    </div>

                    {mergeCustomer === 'walk-in' && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                    Walk-in Name:
                                </label>
                                <input
                                    type="text"
                                    placeholder="Customer Name"
                                    value={mergeWalkInName}
                                    onChange={e => setMergeWalkInName(e.target.value)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-light)',
                                        fontSize: '13px',
                                        outline: 'none',
                                        background: 'var(--card-bg)'
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                    Walk-in Phone:
                                </label>
                                <input
                                    type="text"
                                    placeholder="Phone (Optional)"
                                    value={mergeWalkInPhone}
                                    onChange={e => setMergeWalkInPhone(e.target.value)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-light)',
                                        fontSize: '13px',
                                        outline: 'none',
                                        background: 'var(--card-bg)'
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                open={viewingLogsInvoiceId !== null}
                onClose={() => setViewingLogsInvoiceId(null)}
                heading={`Invoice Activity Log - INV-${String(viewingLogsInvoiceId || '').padStart(4, '0')}`}
                size="medium"
                secondaryAction={
                    <SButton onClick={() => setViewingLogsInvoiceId(null)}>Close</SButton>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0', minHeight: '150px' }}>
                    {isLoadingLogs ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '32px 0' }}>
                            <Icons.Activity size={24} className="spin" style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
                            <span style={{ marginLeft: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>Loading activity logs...</span>
                        </div>
                    ) : invoiceLogs.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 0', color: 'var(--text-secondary)' }}>
                            <Icons.Info size={32} style={{ marginBottom: '8px', color: 'var(--text-tertiary)' }} />
                            <p style={{ fontSize: '13px' }}>No logs found for this invoice.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                            {invoiceLogs.map((log) => (
                                <div key={log.id} style={{ 
                                    padding: '12px 16px', 
                                    borderRadius: '8px', 
                                    background: 'var(--bg-light)', 
                                    border: '1px solid var(--border-light)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ 
                                            fontWeight: '700', 
                                            fontSize: '13px', 
                                            color: 'var(--text-primary)',
                                            background: 'var(--card-bg)',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            border: '1px solid var(--border-light)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            {getLogIcon(log.action)}
                                            {log.action}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Icons.Clock size={11} />
                                            {log.created_at}
                                        </span>
                                    </div>
                                    <p style={{ 
                                        margin: 0, 
                                        fontSize: '12.5px', 
                                        color: 'var(--text-secondary)',
                                        lineHeight: '1.4',
                                        wordBreak: 'break-word'
                                    }}>
                                        {log.details}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
