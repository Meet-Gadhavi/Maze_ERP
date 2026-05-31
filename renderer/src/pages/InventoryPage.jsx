import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { toast } from 'sonner';
import CustomSelect from '../components/CustomSelect';
import { Icons } from '../components/Icons';
import { FormGroup, Input } from '../components/FormComponents';
import Modal from '../components/Modal';
import SButton from '../components/SButton';
import { formatDate, formatCurrency, validateProduct } from '../utils';
import { EMPTY_PRODUCT, UNIT_CATEGORIES, DECIMAL_UNITS } from '../constants';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './InventoryPage.css';



export default function InventoryPage() {
    const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'pending', or 'alerts'
    const [products, setProducts] = useState([]);
    const [pendingItems, setPendingItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [search, setSearch] = useState('');
    // M034: Debounced search so we don't hit the API on every keystroke
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const debounceTimerRef = useRef(null);
    function handleSearchChange(val) {
        setSearch(val);
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => setDebouncedSearch(val), 300);
    }
    const [filterCat, setFilterCat] = useState('All');
    const [filterSubCat, setFilterSubCat] = useState('All');
    const [filterBrand, setFilterBrand] = useState('All');
    const [loading, setLoading] = useState(true);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [activeModalTab, setActiveModalTab] = useState('basic'); // 'basic' or 'variants'
    const [showCatModal, setShowCatModal] = useState(false);
    const [showSubCatModal, setShowSubCatModal] = useState(false);
    const [showBrandModal, setShowBrandModal] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [editingCatOldName, setEditingCatOldName] = useState(null);
    const [newSubCatName, setNewSubCatName] = useState('');
    const [newBrandName, setNewBrandName] = useState('');
    const [editingProduct, setEditingProduct] = useState(null);
    const [showManageSubCatModal, setShowManageSubCatModal] = useState(false);
    const [manageSubCatForCategory, setManageSubCatForCategory] = useState(null);
    const [editingSubCatId, setEditingSubCatId] = useState(null);
    const [form, setForm] = useState(EMPTY_PRODUCT);
    const [productVariants, setProductVariants] = useState([]);
    const [tempVariants, setTempVariants] = useState([]); // For new products
    const [variantForm, setVariantForm] = useState({ name: '', sku: '', selling_price: '', cost_price: '', stock_quantity: 0 });
    const [saving, setSaving] = useState(false);

    // Stock extensions
    const [alertsData, setAlertsData] = useState({ outOfStock: [], lowStock: [], overStock: [], expired: [], expiringSoon: [] });
    const [adjustModalProduct, setAdjustModalProduct] = useState(null);
    const [adjustQuantity, setAdjustQuantity] = useState('');
    const [adjustNotes, setAdjustNotes] = useState('');
    const [historyModalProduct, setHistoryModalProduct] = useState(null);
    const [stockHistory, setStockHistory] = useState([]);
    const [productSerials, setProductSerials] = useState([]);
    const [loadingSerials, setLoadingSerials] = useState(false);
    const [settings, setSettings] = useState({});
    const [newManualSerial, setNewManualSerial] = useState('');
    const [editingSubCatName, setEditingSubCatName] = useState('');

    async function loadSerials(productId) {
        try {
            setLoadingSerials(true);
            const data = await api.getProductSerials(productId);
            setProductSerials(data);
        } catch (err) {
            console.error('Failed to load serials', err);
            toast.error('Failed to load serial numbers');
        } finally {
            setLoadingSerials(false);
        }
    }

    async function handleManualAddSerial() {
        if (!newManualSerial || !newManualSerial.trim()) {
            toast.error('Please enter a serial number');
            return;
        }
        try {
            await api.addProductSerial(editingProduct.id, { serial_number: newManualSerial.trim() });
            toast.success('Serial number added successfully');
            setNewManualSerial('');
            loadSerials(editingProduct.id);
            loadProducts(); // reload products to update stock quantity
        } catch (err) {
            toast.error(err.message || 'Failed to add serial number');
        }
    }

    async function handleManualDeleteSerial(serialId, serialNumber) {
        if (!confirm(`Are you sure you want to delete the serial number "${serialNumber}"?`)) return;
        try {
            await api.deleteProductSerial(serialId);
            toast.success('Serial number deleted successfully');
            loadSerials(editingProduct.id);
            loadProducts(); // reload products to update stock quantity
        } catch (err) {
            toast.error(err.message || 'Failed to delete serial number');
        }
    }

    async function handleSaveSubCat(id) {
        if (!editingSubCatName.trim()) {
            toast.error('Sub-category name cannot be empty');
            return;
        }
        const promise = api.updateSubcategory(id, editingSubCatName.trim());
        toast.promise(promise, {
            loading: 'Saving...',
            success: () => {
                api.getSubcategories().then(setSubcategories).catch(() => { });
                setEditingSubCatId(null);
                setEditingSubCatName('');
                return 'Sub-category updated';
            },
            error: (err) => err.message || 'Failed to update sub-category'
        });
    }

    // Delete confirm
    const [deleteId, setDeleteId] = useState(null);
    const [deleteCatName, setDeleteCatName] = useState(null);
    const [activeCatMenu, setActiveCatMenu] = useState(null);
    const [pendingOrders, setPendingOrders] = useState([]); // { customer_name, invoice_no, qty_requested, qty_delivered, pending_qty }
    const inventoryCountLabel = `${products.length.toLocaleString('en-IN')} ${products.length === 1 ? 'product' : 'products'}`;

    const loadProducts = useCallback(async () => {
        try {
            setLoading(true);
            const params = {};
            if (search) params.search = search;
            if (filterCat && filterCat !== 'All') params.category = filterCat;
            if (filterSubCat && filterSubCat !== 'All') params.subcategory_id = filterSubCat;
            if (filterBrand && filterBrand !== 'All') params.brand_id = filterBrand;
            const data = await api.getProducts(params);
            setProducts(data);
        } catch (err) {
            console.error('Failed to load products', err);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, filterCat]);

    const loadPendingItems = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getPendingItems();
            setPendingItems(data);
        } catch (err) {
            console.error('Failed to load pending items', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'inventory') {
            loadProducts();
        } else if (activeTab === 'pending') {
            loadPendingItems();
        } else if (activeTab === 'alerts') {
            api.getStockAlerts().then(setAlertsData).catch(err => toast.error('Failed to load alerts'));
        }
    }, [activeTab, loadProducts, loadPendingItems]);

    // Close category menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (activeCatMenu && !e.target.closest('.cat-actions')) {
                setActiveCatMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeCatMenu]);

    useEffect(() => {
        // M049: Parallelize metadata fetches for faster initial load
        Promise.all([
            api.getCategories().catch(() => []),
            api.getSubcategories().catch(() => []),
            api.getBrands().catch(() => []),
            api.getSettings().catch(() => ({}))
        ]).then(([cats, subs, brds, sets]) => {
            setCategories(cats);
            setSubcategories(subs);
            setBrands(brds);
            setSettings(sets);
        });
    }, []);

    function openAdd() {
        setEditingProduct(null);
        // Use first available category or empty string as default
        const defaultCat = categories.length > 0 ? categories[0] : '';
        setForm({ ...EMPTY_PRODUCT, category: defaultCat });
        setTempVariants([]);
        setVariantForm({ name: '', sku: '', selling_price: '', cost_price: '', stock_quantity: 0 });
        setShowModal(true);
        setActiveModalTab('basic');
    }

    function openEdit(product) {
        setEditingProduct(product);
        setForm({
            name: product.name,
            category: product.category,
            subcategory_id: product.subcategory_id || '',
            brand_id: product.brand_id || '',
            tags: product.tags || '',
            cost_price: String(product.cost_price),
            selling_price: String(product.selling_price),
            stock_quantity: String(product.stock_quantity),
            product_code: product.product_code || '',
            unit: product.unit || 'PCS',
            secondary_unit: product.secondary_unit || '',
            conversion_factor: product.conversion_factor || 1,
            allow_decimal: !!product.allow_decimal,
            conversion_rate: product.conversion_rate || 1,
            min_stock_level: product.min_stock_level ?? 5,
            max_stock_level: product.max_stock_level ?? 0,
            track_batches: !!product.track_batches,
            track_serials: !!product.track_serials
        });
        setTempVariants([]);
        setVariantForm({ name: '', sku: '', selling_price: '', cost_price: '', stock_quantity: 0 });
        setShowModal(true);
        setActiveModalTab('basic');
        loadPendingOrders(product.id);
        loadProductVariants(product.id);
    }

    async function loadProductVariants(productId) {
        try {
            const variants = await api.getVariants(productId);
            setProductVariants(variants);
        } catch (err) {
            console.error('Failed to load variants', err);
        }
    }

    async function loadPendingOrders(productId) {
        try {
            const allInvoices = await api.getInvoices();
            const pending = [];
            allInvoices.forEach(inv => {
                inv.items.forEach(item => {
                    if (item.product_id === productId && item.pending_qty > 0) {
                        pending.push({
                            customer_name: inv.customer_name || inv.walk_in_name || 'Walk-in',
                            invoice_no: `INV-${String(inv.id).padStart(4, '0')}`,
                            qty_requested: item.qty_requested,
                            qty_delivered: item.qty_delivered,
                            pending_qty: item.pending_qty
                        });
                    }
                });
            });
            setPendingOrders(pending);
        } catch (err) {
            console.error('Failed to load pending orders', err);
        }
    }

    async function handleSave() {
        const errors = validateProduct(form);
        if (errors && errors.length > 0) {
            errors.forEach(err => toast.error(err));
            return;
        }

        const payload = {
            name: form.name.trim(),
            category: form.category.trim() || (categories.length > 0 ? categories[0] : 'General'),
            subcategory_id: form.subcategory_id || null,
            brand_id: form.brand_id || null,
            tags: form.tags.trim(),
            cost_price: parseFloat(form.cost_price) || 0,
            selling_price: parseFloat(form.selling_price) || 0,
            stock_quantity: parseFloat(form.stock_quantity) || 0,
            product_code: form.product_code.trim(),
            unit: form.unit,
            secondary_unit: form.secondary_unit || null,
            conversion_factor: parseFloat(form.conversion_factor) || 1,
            allow_decimal: form.allow_decimal,
            conversion_rate: parseFloat(form.conversion_rate) || 1,
            min_stock_level: parseFloat(form.min_stock_level) || 0,
            max_stock_level: parseFloat(form.max_stock_level) || 0,
            track_batches: form.track_batches,
            track_serials: form.track_serials
        };

        setSaving(true);
        try {
            const product = editingProduct
                ? await api.updateProduct(editingProduct.id, payload)
                : await api.createProduct(payload);

            // If new product and has temp variants, create them
            if (!editingProduct && tempVariants.length > 0) {
                for (const v of tempVariants) {
                    await api.createVariant(product.id, v);
                }
            }

            toast.success(editingProduct ? 'Product updated successfully' : 'Product added to inventory');
            setShowModal(false);
            loadProducts();
            api.getCategories().then(setCategories).catch(() => { });
            // Notify other pages (e.g. SalesPage) that product prices may have changed
            window.dispatchEvent(new CustomEvent('maze:product-price-updated', { detail: { productId: product.id } }));

        } catch (err) {
            toast.error(err.message || 'Failed to save product');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!deleteId) return;

        const promise = api.deleteProduct(deleteId);

        toast.promise(promise, {
            loading: 'Removing product from inventory...',
            success: () => {
                setDeleteId(null);
                loadProducts();
                return 'Product deleted successfully';
            },
            error: (err) => err.message || 'Failed to delete product'
        });
    }

    async function handleDeleteCategory() {
        if (!deleteCatName) return;

        const promise = api.deleteCategory(deleteCatName);

        toast.promise(promise, {
            loading: `Deleting category "${deleteCatName}"...`,
            success: () => {
                setDeleteCatName(null);
                api.getCategories().then(setCategories).catch(() => { });
                return 'Category deleted successfully';
            },
            error: (err) => err.message || 'Failed to delete category'
        });
    }

    async function handleExportPDF() {
        const promise = (async () => {
            const settings = await api.getSettings();
            const companyName = settings.company_name || 'Mazeweb';
            const companyPhone = settings.company_phone || '+91 8866115898';
            const logoUrl = settings.logo_url || ''; 
            const doc = new jsPDF();

            // Header Section: Left Side (Store Info)
            let logoY = 15;
            let textShiftX = 14;

            if (logoUrl) {
                try {
                    // Pre-load the image to check dimensions and avoid squishing/squeezing
                    const imgLoaded = await new Promise((resolve) => {
                        const img = new Image();
                        img.src = logoUrl;
                        img.onload = () => resolve(img);
                        img.onerror = () => resolve(null);
                    });

                    if (imgLoaded) {
                        const naturalWidth = imgLoaded.naturalWidth || imgLoaded.width || 1;
                        const naturalHeight = imgLoaded.naturalHeight || imgLoaded.height || 1;
                        const aspectRatio = naturalWidth / naturalHeight;

                        // Maximum allowable bounds
                        const maxW = 25;
                        const maxH = 10;

                        let finalW = maxW;
                        let finalH = maxH;

                        if (aspectRatio > maxW / maxH) {
                            // Very wide landscape: limit by width, scale down height
                            finalW = maxW;
                            finalH = maxW / aspectRatio;
                        } else {
                            // Square or portrait: limit by height, scale down width
                            finalH = maxH;
                            finalW = maxH * aspectRatio;
                        }

                        // Vertically center logo perfectly relative to text (middle at 21mm)
                        logoY = 21 - (finalH / 2);
                        textShiftX = 14 + finalW + 4; // Add 4mm gap between logo and text

                        doc.addImage(logoUrl, 'PNG', 14, logoY, finalW, finalH);
                    }
                } catch (_) {
                    textShiftX = 14;
                }
            }

            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(15, 23, 42); // Slate 900
            doc.text(companyName, textShiftX, 21.5);

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // Slate 500
            doc.text(companyPhone, textShiftX, 26.5);

            // Header Section: Right Side (Title & Meta)
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(26);
            doc.setTextColor(15, 23, 42); // Slate 900
            doc.text('REPORT', 196, 21.5, { align: 'right' });

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(11);
            doc.setTextColor(100, 116, 139); // Slate 500
            doc.text('#PENDING-ITEMS', 196, 26.5, { align: 'right' });
            doc.text(formatDate(new Date()), 196, 31.5, { align: 'right' });

            // Thick Slate Divider (border-bottom: 2px solid #0f172a)
            doc.setDrawColor(15, 23, 42); // Slate 900
            doc.setLineWidth(0.8);
            doc.line(14, 36, 196, 36);

            // Three-Column Section (Scope / Warehouse / Status Badge)
            // Column 1: Report Scope
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.text('REPORT SCOPE', 14, 45);
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(30, 41, 59); // Slate 800
            doc.text('Active Backorders', 14, 49.5);
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // Slate 500
            doc.text('Stock depletion fulfillment list', 14, 54);

            // Column 2: Inventory Source
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.text('INVENTORY SOURCE', 90, 45);
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59); // Slate 800
            doc.text('Main Warehouse / Store Live DB', 90, 49.5);
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // Slate 500
            doc.text(`Total SKU Items: ${pendingItems.length}`, 90, 54);

            // Column 3: Status Badge
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.text('STATUS', 160, 45);
            
            // Draw rounded status badge (Background #fef9c3, Text #854d0e)
            doc.setFillColor(254, 249, 195);
            doc.roundedRect(160, 47.5, 28, 5.5, 2.5, 2.5, 'F');
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(133, 77, 14);
            doc.text('PENDING', 174, 51.5, { align: 'center' });

            // Plain Premium Table matching HTML Template styles
            autoTable(doc, {
                startY: 61,
                head: [['#', 'Product', 'Category', 'Product Code', 'Qty']],
                body: pendingItems.map((item, idx) => [
                    idx + 1,
                    item.product_name,
                    item.category || 'General',
                    item.product_code || '—',
                    `${item.pending_qty} ${item.unit}`
                ]),
                theme: 'plain',
                headStyles: {
                    fillColor: [248, 250, 252], // Slate 50 (#f8fafc)
                    textColor: [71, 85, 105], // Slate 600 (#475569)
                    fontStyle: 'bold',
                    fontSize: 9.5,
                    lineColor: [226, 232, 240], // Slate 200 (#e2e8f0)
                    lineWidth: { bottom: 0.8 }
                },
                bodyStyles: {
                    fontSize: 9.5,
                    textColor: [30, 41, 59], // Slate 800 (#1e293b)
                    lineColor: [241, 245, 249], // Slate 100 (#f1f5f9)
                    lineWidth: { bottom: 0.5 }
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 8 },    // Index compact
                    1: { halign: 'left' },                     // Product auto
                    2: { halign: 'left' },                     // Category auto
                    3: { halign: 'left' },                     // Product Code auto
                    4: { halign: 'center', cellWidth: 25, fontStyle: 'bold' } // Qty center bold
                },
                margin: { left: 14, right: 14 },
                styles: {
                    lineColor: [241, 245, 249], // Very light borders
                    lineWidth: 0.1,
                    valign: 'middle', // Vertically center all columns
                    cellPadding: 3 // Balanced, thin padding to prevent extra height
                }
            });

            // Footer Section
            const pageHeight = doc.internal.pageSize.height || 297;
            
            // Draw thin border above footer
            doc.setDrawColor(226, 232, 240); // Slate 200
            doc.setLineWidth(0.5);
            doc.line(14, pageHeight - 25, 196, pageHeight - 25);

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184); // Slate 400 (#94a3b8)
            doc.text(`Thank you for using ${companyName}!`, 105, pageHeight - 18, { align: 'center' });
            doc.text('This is a computer-generated inventory report.', 105, pageHeight - 13, { align: 'center' });

            doc.save(`Pending_Products_${new Date().toISOString().split('T')[0]}.pdf`);
        })();
        toast.promise(promise, {
            loading: 'Generating PDF report...',
            success: 'Report exported successfully',
            error: (err) => 'Failed to export PDF: ' + err.message
        });
    }

    return (
        <div className="inventory-page">
            <div className="page-header">
                <div>
                    <h1>Inventory ({inventoryCountLabel})</h1>
                    <p className="text-secondary">Track warehouse stock, batches, variants, and product categories</p>
                </div>
                <div className="header-actions">
                    <s-button onClick={() => setShowCatModal(true)} aria-label="Create category">
                        Create Category
                    </s-button>
                    <s-button variant="primary" onClick={openAdd}>
                        + Add New Product
                    </s-button>
                </div>
            </div>

            <div className="tabs" style={{ marginBottom: 20 }}>
                {['inventory', 'pending', 'alerts'].map((tab, idx, arr) => (
                    <button
                        key={tab}
                        id={`tab-${tab}`}
                        className={`tab-item ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                        // M026: Arrow-key keyboard navigation between tabs
                        onKeyDown={e => {
                            if (e.key === 'ArrowRight') {
                                e.preventDefault();
                                const next = arr[(idx + 1) % arr.length];
                                setActiveTab(next);
                                document.getElementById(`tab-${next}`)?.focus();
                            } else if (e.key === 'ArrowLeft') {
                                e.preventDefault();
                                const prev = arr[(idx - 1 + arr.length) % arr.length];
                                setActiveTab(prev);
                                document.getElementById(`tab-${prev}`)?.focus();
                            }
                        }}
                    >
                        {tab === 'inventory' ? 'All products' : tab === 'pending' ? 'Pending Product' : 'Smart Alerts'}
                    </button>
                ))}
            </div>
            {activeTab === 'inventory' && (
                <>
                    <div className="page-toolbar">
                        <div className="search-bar">
                            <Icons.Search />
                            <input
                                placeholder="Search products by name, code or tags…"
                                value={search}
                                onChange={e => handleSearchChange(e.target.value)}
                            />
                        </div>
                        <div className="page-toolbar-actions">
                            <CustomSelect
                                value={filterCat}
                                onChange={val => {
                                    setFilterCat(val);
                                    setFilterSubCat('All');
                                }}
                                options={[
                                    { value: 'All', label: 'All Categories' },
                                    ...categories.map(c => ({ value: c, label: c }))
                                ]}
                            />
                            <CustomSelect
                                value={filterSubCat}
                                onChange={val => setFilterSubCat(val)}
                                options={[
                                    { value: 'All', label: 'All Sub-categories' },
                                    ...subcategories.filter(sc => filterCat === 'All' || sc.category_name === filterCat).map(sc => ({ value: sc.id, label: sc.name }))
                                ]}
                            />
                            <SButton variant="secondary" onClick={loadProducts} title="Refresh List"><Icons.RotateCcw size={18} /></SButton>
                        </div>
                    </div>

                    {products.length === 0 && !loading ? (
                        <div className="empty-state-premium">
                            <div className="empty-icon-wrapper">
                                <Icons.Package size={40} />
                            </div>
                            <h3>Your Inventory is Empty</h3>
                            <p>
                                Start building your product catalog. Add items, track stock levels, and organize your business by categories.
                            </p>
                            <SButton variant="primary" onClick={openAdd}>Add Your First Product</SButton>
                        </div>
                    ) : (
                        <div className="inventory-grid">
                            {categories.filter(c => filterCat === 'All' || c === filterCat).map(cat => {
                                const catProducts = products.filter(p => (p.category || 'General') === cat);
                                // Always show the category, even if empty
                                if (catProducts.length === 0 && search) {
                                    // If searching, we might still want to hide empty ones unless it matches search
                                    // but for now let's keep it visible as per user request
                                }

                                // Group by subcategory
                                const grouped = catProducts.reduce((acc, p) => {
                                    const sc = p.subcategory_name || 'Uncategorized';
                                    if (!acc[sc]) acc[sc] = [];
                                    acc[sc].push(p);
                                    return acc;
                                }, {});

                                return (
                                    <div key={cat} className="category-group-card">
                                        <div className="category-group-header">
                                            <div className="cat-info">
                                                <div className="cat-icon"><Icons.Package size={18} /></div>
                                                <h3 className="cat-title">{cat}</h3>
                                                <span className="cat-badge">{catProducts.length} Products</span>
                                            </div>
                                            <div className="cat-actions">
                                                <button className="icon-btn" onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveCatMenu(activeCatMenu === cat ? null : cat);
                                                }} title="Category Actions">
                                                    <Icons.MoreVertical size={18} />
                                                </button>
                                                {activeCatMenu === cat && (
                                                    <div className="cat-menu-dropdown">
                                                        <button className="edit" onClick={() => {
                                                            setEditingCatOldName(cat);
                                                            setNewCatName(cat);
                                                            setShowCatModal(true);
                                                            setActiveCatMenu(null);
                                                        }}>
                                                            <Icons.Edit size={14} />
                                                            Edit Category
                                                        </button>
                                                        <button className="dropdown-item" onClick={() => { setManageSubCatForCategory(cat); setShowManageSubCatModal(true); setActiveCatMenu(null); }}>
                                                            <Icons.Layers size={14} />
                                                            Manage sub categories
                                                        </button>
                                                        <button className="delete" onClick={() => {
                                                            setDeleteCatName(cat);
                                                            setActiveCatMenu(null);
                                                        }}>
                                                            <Icons.Trash size={14} />
                                                            Delete Category
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* M017: max-height + scroll so long product lists don't overflow the card */}
                                        <div className="category-items-list" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Product Name</th>
                                                        <th>Code / Brand</th>
                                                        <th style={{ textAlign: 'right' }}>Cost</th>
                                                        <th style={{ textAlign: 'right' }}>Selling</th>
                                                        <th>Stock</th>
                                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {catProducts.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                                                                <div style={{ opacity: 0.5, marginBottom: '8px' }}>
                                                                    <Icons.Package size={24} />
                                                                </div>
                                                                <div>No products in this category</div>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        Object.entries(grouped).map(([subName, subProducts]) => (
                                                            <React.Fragment key={subName}>
                                                                <tr className="subcategory-header-row">
                                                                    <td colSpan="6">
                                                                        <div className="subcategory-name-tag">
                                                                            <Icons.ChevronRight size={12} />
                                                                            {subName}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                                {subProducts.map(p => (
                                                                    <tr key={p.id} className="product-row">
                                                                        <td>
                                                                            <div className="fw-600">{p.name}</div>
                                                                            {p.tags && <div className="p-tags">{p.tags.split(',').map(t => <span key={t} className="tag-pill">{t.trim()}</span>)}</div>}
                                                                        </td>
                                                                        <td>
                                                                            <div className="text-sm fw-500">{p.product_code || '—'}</div>
                                                                            <div className="text-xs text-secondary">{p.brand_name || 'Generic'}</div>
                                                                        </td>
                                                                        <td style={{ textAlign: 'right' }}>₹{Number(p.cost_price).toLocaleString('en-IN')}</td>
                                                                        <td style={{ textAlign: 'right' }} className="color-accent fw-600">₹{Number(p.selling_price).toLocaleString('en-IN')}</td>
                                                                        <td>
                                                                            <span className={`stock-level ${p.stock_quantity <= p.min_stock_level ? 'low' : (p.stock_quantity <= 0 ? 'danger' : 'ok')}`}>
                                                                                {p.stock_quantity} {p.unit}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ textAlign: 'right' }}>
                                                                            <div className="action-row" style={{ justifyContent: 'flex-end', gap: '4px' }}>
                                                                                <SButton variant="secondary" onClick={() => { setAdjustModalProduct(p); setAdjustQuantity(p.stock_quantity); setAdjustNotes(''); }} title="Adjust Stock">
                                                                                    <Icons.Activity size={14} />
                                                                                </SButton>
                                                                                <SButton variant="secondary" onClick={() => openEdit(p)} title="Edit Product">
                                                                                    <Icons.Edit size={14} />
                                                                                </SButton>
                                                                                <SButton variant="secondary" tone="critical" onClick={() => setDeleteId(p.id)} title="Delete">
                                                                                    <Icons.Trash2 size={14} />
                                                                                </SButton>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </React.Fragment>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'pending' && (
                <div className="pending-products-view">
                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ fontSize: '1.1em', fontWeight: 600, color: 'var(--text-primary)' }}>Backordered Items</h2>
                        <SButton variant="secondary" onClick={handleExportPDF} disabled={pendingItems.length === 0}>
                            Export to PDF
                        </SButton>
                    </div>
                    <div className="product-table-wrap">
                        {loading ? (
                            <div className="loading">Loading pending items…</div>
                        ) : pendingItems.length === 0 ? (
                            <div className="empty-state-premium">
                                <div className="empty-icon-wrapper" style={{ color: 'var(--success)', background: 'var(--success-bg)', boxShadow: '0 8px 16px -4px rgba(40, 185, 78, 0.15)' }}>
                                    <Icons.CheckCircle size={40} />
                                </div>
                                <h3>All Clear!</h3>
                                <p>No pending products at the moment.</p>
                            </div>
                        ) : (
                            <div className="pending-items-table-wrap">
                                <table className="pending-items-table">
                                    <thead>
                                        <tr>
                                            <th>Product Name</th>
                                            <th>Pending Qty</th>
                                            <th>Category</th>
                                            <th>Code</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingItems.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="fw-600">{item.product_name}</td>
                                                <td className="fw-600 color-danger">{item.pending_qty} {item.unit}</td>
                                                <td>{item.category || 'General'}</td>
                                                <td style={{ color: '#888', fontSize: '0.9em' }}>{item.product_code || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'alerts' && (
                <div className="alerts-view" style={{ padding: '0 20px 20px 20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                        <div className="alert-card out-of-stock" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px' }}>
                            <h3 style={{ color: '#dc2626', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2em' }}>
                                <Icons.AlertCircle size={20} />
                                Out of Stock
                            </h3>
                            {alertsData.outOfStock.length === 0 ? (
                                <div className="empty-state-compact">
                                    <Icons.CheckCircle size={24} style={{ color: 'var(--success)', opacity: 0.6 }} />
                                    <p>No products out of stock</p>
                                </div>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {alertsData.outOfStock.map((p, i) => (
                                        <li key={i} style={{ padding: '12px 0', borderBottom: '1px solid #fee2e2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#333' }}>{p.name}</div>
                                                <div style={{ fontSize: '0.8em', color: '#888' }}>{p.product_code || 'No Code'} • {p.category}</div>
                                            </div>
                                            <span style={{ color: '#dc2626', fontWeight: 600, background: '#fee2e2', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9em' }}>{p.stock_quantity}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="alert-card low-stock" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px' }}>
                            <h3 style={{ color: '#d97706', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2em' }}>
                                <Icons.AlertTriangle size={20} />
                                Low Stock
                            </h3>
                            {alertsData.lowStock.length === 0 ? (
                                <div className="empty-state-compact">
                                    <Icons.CheckCircle size={24} style={{ color: 'var(--success)', opacity: 0.6 }} />
                                    <p>Stock levels are healthy</p>
                                </div>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {alertsData.lowStock.map((p, i) => (
                                        <li key={i} style={{ padding: '12px 0', borderBottom: '1px solid #fef3c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#333' }}>{p.name}</div>
                                                <div style={{ fontSize: '0.8em', color: '#888' }}>Min: {p.min_stock_level}</div>
                                            </div>
                                            <span style={{ color: '#d97706', fontWeight: 600, background: '#fef3c7', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9em' }}>{p.stock_quantity}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="alert-card over-stock" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px' }}>
                            <h3 style={{ color: '#16a34a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2em' }}>
                                <Icons.TrendingUp size={20} />
                                Over Stock
                            </h3>
                            {alertsData.overStock.length === 0 ? (
                                <div className="empty-state-compact">
                                    <Icons.CheckCircle size={24} style={{ color: 'var(--success)', opacity: 0.6 }} />
                                    <p>No overstocking detected</p>
                                </div>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {alertsData.overStock.map((p, i) => (
                                        <li key={i} style={{ padding: '12px 0', borderBottom: '1px solid #dcfce3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#333' }}>{p.name}</div>
                                                <div style={{ fontSize: '0.8em', color: '#888' }}>Max: {p.max_stock_level}</div>
                                            </div>
                                            <span style={{ color: '#16a34a', fontWeight: 600, background: '#dcfce3', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9em' }}>{p.stock_quantity}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {alertsData.expired && alertsData.expired.length > 0 && (
                            <div className="alert-card expired" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px' }}>
                                <h3 style={{ color: '#991b1b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2em' }}>
                                    <Icons.AlertCircle size={20} />
                                    Expired Batches
                                </h3>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {alertsData.expired.map((b, i) => (
                                        <li key={i} style={{ padding: '12px 0', borderBottom: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#333' }}>{b.product_name} <span style={{ fontSize: '0.8em', background: '#fee2e2', color: '#991b1b', padding: '2px 4px', borderRadius: 4 }}>{b.batch_number}</span></div>
                                                <div style={{ fontSize: '0.8em', color: '#888' }}>Expired: {formatDate(b.expiry_date)}</div>
                                            </div>
                                            <span style={{ color: '#991b1b', fontWeight: 600, background: '#fee2e2', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9em' }}>Qty: {b.current_quantity}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {alertsData.expiringSoon && alertsData.expiringSoon.length > 0 && (
                            <div className="alert-card expiring-soon" style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px' }}>
                                <h3 style={{ color: '#b45309', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2em' }}>
                                    <Icons.Clock size={20} />
                                    Expiring Soon
                                </h3>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {alertsData.expiringSoon.map((b, i) => (
                                        <li key={i} style={{ padding: '12px 0', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#333' }}>{b.product_name} <span style={{ fontSize: '0.8em', background: '#fef3c7', color: '#b45309', padding: '2px 4px', borderRadius: 4 }}>{b.batch_number}</span></div>
                                                <div style={{ fontSize: '0.8em', color: '#888' }}>Expires: {formatDate(b.expiry_date)}</div>
                                            </div>
                                            <span style={{ color: '#b45309', fontWeight: 600, background: '#fef3c7', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9em' }}>Qty: {b.current_quantity}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!!adjustModalProduct && (
            <s-modal
                id="adjust-stock-modal"
                heading={`Adjust Stock: ${adjustModalProduct?.name}`}
                size="small"
                ref={el => {
                    if (el && !el.dataset.init) {
                        el.dataset.init = '1';
                        setTimeout(() => {
                            let btn = document.getElementById('trigger-' + el.id);
                            if (btn) btn.remove();
                            
                            btn = document.createElement('s-button');
                            btn.id = 'trigger-' + el.id;
                            btn.setAttribute('commandFor', el.id);
                            btn.setAttribute('command', '--show');
                            btn.style.display = 'none';
                            document.body.appendChild(btn);
                            setTimeout(() => btn.click(), 100);
                        }, 10);
                        el.addEventListener('hide', () => setAdjustModalProduct(null));
                    }
                }}
            >
                <FormGroup label="Current Stock Level">
                    <Input disabled value={`${adjustModalProduct?.stock_quantity} ${adjustModalProduct?.unit || 'PCS'}`} style={{ background: 'var(--bg-primary)' }} />
                </FormGroup>
                <FormGroup label="New Stock Quantity" required>
                    <Input
                        type="number"
                        min="0"
                        value={adjustQuantity}
                        onChange={e => setAdjustQuantity(e.target.value)}
                        autoFocus
                        placeholder="0"
                    />
                </FormGroup>
                <FormGroup label="Reason / Notes">
                    <textarea
                        className="form-control"
                        rows={2}
                        value={adjustNotes}
                        onChange={e => setAdjustNotes(e.target.value)}
                        placeholder="e.g. Damage, Audit Correction..."
                    />
                </FormGroup>
                
                <s-button slot="secondary-actions" onClick={() => setAdjustModalProduct(null)}>Cancel</s-button>
                <s-button slot="primary-action" variant="primary" onClick={async () => {
                        const finalQty = parseFloat(adjustQuantity);
                        if (isNaN(finalQty) || finalQty < 0) return toast.error('Invalid quantity');
                        try {
                            await api.adjustStock(adjustModalProduct.id, { quantity: finalQty, notes: adjustNotes });
                            toast.success('Stock adjusted successfully');
                            setAdjustModalProduct(null);
                            loadProducts();
                        } catch (err) {
                            toast.error(err.message || 'Failed to adjust stock');
                        }
                    }}>Confirm Adjustment</s-button>
            </s-modal>
            )}

            {!!historyModalProduct && (
            <s-modal
                id="stock-history-modal"
                heading={`Stock History: ${historyModalProduct?.name}`}
                size="large"
                ref={el => {
                    if (el && !el.dataset.init) {
                        el.dataset.init = '1';
                        setTimeout(() => {
                            let btn = document.getElementById('trigger-' + el.id);
                            if (btn) btn.remove();
                            
                            btn = document.createElement('s-button');
                            btn.id = 'trigger-' + el.id;
                            btn.setAttribute('commandFor', el.id);
                            btn.setAttribute('command', '--show');
                            btn.style.display = 'none';
                            document.body.appendChild(btn);
                            setTimeout(() => btn.click(), 100);
                        }, 10);
                        el.addEventListener('hide', () => setHistoryModalProduct(null));
                    }
                }}
            >
                <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    {stockHistory.length === 0 ? (
                        <div className="empty-state-premium" style={{ padding: '32px' }}>
                            <Icons.History size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                            <p>No history found for this product.</p>
                        </div>
                    ) : (
                        <div className="premium-table-wrap">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date & Time</th>
                                        <th>Activity Type</th>
                                        <th style={{ textAlign: 'right' }}>Quantity</th>
                                        <th>Reference</th>
                                        <th>Notes / Batch</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stockHistory.map((sh, i) => (
                                        <tr key={i}>
                                            <td className="text-secondary">{formatDate(sh.created_at)}</td>
                                            <td>
                                                <span className={`badge badge-${sh.type === 'IN' || sh.type === 'RETURN' ? 'success' : (sh.type === 'OUT' ? 'danger' : 'warning')}`}>
                                                    {sh.type}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }} className={`fw-600 ${sh.type === 'OUT' ? 'color-danger' : 'color-success'}`}>
                                                {sh.type === 'OUT' ? '-' : (sh.type === 'IN' || sh.type === 'RETURN' ? '+' : '')}{sh.quantity}
                                            </td>
                                            <td className="text-secondary">{sh.reference_type} {sh.reference_id ? `#${sh.reference_id}` : ''}</td>
                                            <td>
                                                <div className="text-sm">{sh.notes || '—'}</div>
                                                {sh.batch_number && <div className="text-xs text-secondary">Batch: {sh.batch_number}</div>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                
                <s-button slot="secondary-actions" onClick={() => setHistoryModalProduct(null)}>Close</s-button>
            </s-modal>
            )}

            {showModal && (
            <s-modal
                id="product-modal"
                heading={editingProduct ? 'Edit Product' : 'Add New Product'}
                size="large"
                ref={el => {
                    if (el && !el.dataset.init) {
                        el.dataset.init = '1';
                        setTimeout(() => {
                            let btn = document.getElementById('trigger-' + el.id);
                            if (btn) btn.remove();
                            
                            btn = document.createElement('s-button');
                            btn.id = 'trigger-' + el.id;
                            btn.setAttribute('commandFor', el.id);
                            btn.setAttribute('command', '--show');
                            btn.style.display = 'none';
                            el.appendChild(btn);
                            setTimeout(() => btn.click(), 100);
                        }, 10);
                        el.addEventListener('hide', (e) => {
                            if (e.target === el) setShowModal(false);
                        });
                    }
                }}
            >
                <div className="modal-tabs" style={{ marginBottom: 20 }}>
                    <button className={`modal-tab ${activeModalTab === 'basic' ? 'active' : ''}`} onClick={() => setActiveModalTab('basic')}>Basic Details</button>
                    <button className={`modal-tab ${activeModalTab === 'variants' ? 'active' : ''}`} onClick={() => setActiveModalTab('variants')}>Variants & SKUs</button>
                    {editingProduct && settings.enable_serial_tracking === 'true' && form.track_serials && (
                        <button className={`modal-tab ${activeModalTab === 'serials' ? 'active' : ''}`} onClick={() => { setActiveModalTab('serials'); loadSerials(editingProduct.id); }}>Serial/IMEI Numbers</button>
                    )}
                </div>

                <div className="modal-body-scroll" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 20 }}>
                    {activeModalTab === 'basic' && (
                        <>
                            {/* - Section 1: Identity — */}
                            <div className="modal-section-title">Product Identity</div>
                            <div className="grid grid-2 gap-12" style={{ marginBottom: 14 }}>
                                <FormGroup label="Product Name" required>
                                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Engine Oil 1L" autoFocus />
                                </FormGroup>
                                <FormGroup label="Product Code / SKU">
                                    <Input value={form.product_code} onChange={e => setForm({ ...form, product_code: e.target.value })} placeholder="e.g. SKU-101" />
                                </FormGroup>
                            </div>

                            <FormGroup label="Tags" style={{ marginBottom: 20 }}>
                                <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="e.g. electronics, premium (comma separated)" />
                            </FormGroup>

                            {/* - Section 2: Classification — */}
                            <div className="modal-section-title">Classification</div>
                            <FormGroup label="Category">
                                <div className="field-with-add">
                                    <div className="flex-1">
                                        <CustomSelect
                                            value={form.category}
                                            onChange={val => setForm({ ...form, category: val, subcategory_id: '' })}
                                            options={[
                                                { value: 'General', label: 'General' },
                                                ...categories.filter(c => c !== 'General').map(c => ({ value: c, label: c }))
                                            ]}
                                        />
                                    </div>
                                    <SButton variant="secondary" onClick={(e) => { e.stopPropagation(); setShowCatModal(true); }} style={{ height: '42px', whiteSpace: 'nowrap' }}>
                                        + Add
                                    </SButton>
                                </div>
                            </FormGroup>

                            <div className="grid grid-2 gap-12" style={{ marginBottom: 20 }}>
                                <FormGroup label="Sub-category">
                                    <div className="field-with-add">
                                        <div className="flex-1">
                                            <CustomSelect
                                                value={form.subcategory_id}
                                                onChange={val => setForm({ ...form, subcategory_id: val })}
                                                options={[
                                                    { value: '', label: 'None' },
                                                    ...subcategories.filter(sc => form.category === 'All' || sc.category_name === form.category).map(sc => ({ value: sc.id, label: sc.name }))
                                                ]}
                                            />
                                        </div>
                                        <SButton variant="secondary" onClick={(e) => { e.stopPropagation(); setShowSubCatModal(true); }} style={{ height: '42px', whiteSpace: 'nowrap' }}>
                                            + Add
                                        </SButton>
                                    </div>
                                </FormGroup>
                                <FormGroup label="Brand">
                                    <div className="field-with-add">
                                        <div className="flex-1">
                                            <CustomSelect
                                                value={form.brand_id}
                                                onChange={val => setForm({ ...form, brand_id: val })}
                                                options={[
                                                    { value: '', label: 'None' },
                                                    ...brands.map(b => ({ value: b.id, label: b.name }))
                                                ]}
                                            />
                                        </div>
                                        <SButton variant="secondary" onClick={(e) => { e.stopPropagation(); setShowBrandModal(true); }} style={{ height: '42px', whiteSpace: 'nowrap' }}>
                                            + Add
                                        </SButton>
                                    </div>
                                </FormGroup>
                            </div>



                            {/* - Section 3: Measurement Units — */}
                            <div className="modal-section-title">Units & Measurement</div>
                            <div className="grid grid-3 gap-12" style={{ marginBottom: 20 }}>
                                <FormGroup label="Base Unit">
                                    <CustomSelect
                                        value={form.unit}
                                        onChange={val => {
                                            const unit = val;
                                            const allow_decimal = DECIMAL_UNITS.includes(unit);
                                            setForm({ ...form, unit, allow_decimal });
                                        }}
                                        options={Object.entries(UNIT_CATEGORIES).map(([cat, units]) => ({
                                            group: cat,
                                            items: units.map(u => ({ value: u, label: u }))
                                        }))}
                                    />
                                </FormGroup>
                                <FormGroup label="Secondary Unit">
                                    <CustomSelect
                                        value={form.secondary_unit}
                                        onChange={val => setForm({ ...form, secondary_unit: val })}
                                        options={[
                                            { value: '', label: 'None' },
                                            ...Object.values(UNIT_CATEGORIES).flat().map(u => ({ value: u, label: u }))
                                        ]}
                                    />
                                </FormGroup>
                                <FormGroup label="Conv. Factor">
                                    <Input
                                        type="number"
                                        min="1"
                                        value={form.conversion_factor}
                                        onFocus={e => e.target.select()}
                                        onChange={e => setForm({ ...form, conversion_factor: e.target.value })}
                                        disabled={!form.secondary_unit}
                                        placeholder="1"
                                    />
                                </FormGroup>
                            </div>

                            {/* - Section 4: Pricing & Stock — */}
                            <div className="modal-section-title">Pricing & Stock</div>
                            <div className="grid grid-2 gap-12">
                                <FormGroup label="Purchase Cost (₹)">
                                    <Input type="number" min="0" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} placeholder="0.00" />
                                </FormGroup>
                                <FormGroup label="Selling Price (₹)">
                                    <Input type="number" min="0" step="0.01" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} placeholder="0.00" />
                                </FormGroup>
                            </div>
                            <div className="grid grid-3 gap-12" style={{ marginBottom: 20 }}>
                                <FormGroup label="Current Stock">
                                    <Input type="number" min="0" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })} placeholder="0" />
                                </FormGroup>
                                <FormGroup label="Min Stock Alert">
                                    <Input type="number" min="0" value={form.min_stock_level} onChange={e => setForm({ ...form, min_stock_level: e.target.value })} placeholder="5" />
                                </FormGroup>
                                <FormGroup label="Max Stock Level">
                                    <Input type="number" min="0" value={form.max_stock_level} onChange={e => setForm({ ...form, max_stock_level: e.target.value })} placeholder="0" />
                                </FormGroup>
                            </div>

                            {/* - Section 5: Settings — */}
                            <div className="modal-section-title">Settings</div>
                            <div className="modal-section bg-tinted" style={{ marginBottom: 20 }}>
                                <label className="option-row">
                                    <input
                                        type="checkbox"
                                        checked={form.allow_decimal}
                                        onChange={e => setForm({ ...form, allow_decimal: e.target.checked })}
                                    />
                                    <div className="option-row-label">
                                        <span>Allow decimal quantities</span>
                                        <small>Enables fractional values in stock, sales and purchase entries</small>
                                    </div>
                                </label>
                                <label className="option-row">
                                    <input
                                        type="checkbox"
                                        checked={form.track_batches}
                                        onChange={e => setForm({ ...form, track_batches: e.target.checked })}
                                    />
                                    <div className="option-row-label">
                                        <span>Track Batches &amp; Expiry dates</span>
                                        <small>Assigns batch numbers and expiry tracking for this product</small>
                                    </div>
                                </label>
                                {settings.enable_serial_tracking === 'true' && (
                                    <label className="option-row">
                                        <input
                                            type="checkbox"
                                            checked={form.track_serials}
                                            onChange={e => setForm({ ...form, track_serials: e.target.checked })}
                                        />
                                        <div className="option-row-label">
                                            <span>Track Serial / IMEI Numbers</span>
                                            <small>Track unique individual serial numbers for this product</small>
                                        </div>
                                    </label>
                                )}
                            </div>

                            {editingProduct && pendingOrders.length > 0 && (
                                <div className="mt-20 p-16 bg-warning-light rounded-8 border-warning">
                                    <div className="flex items-center gap-8 mb-12 color-warning fw-600 size-13">
                                        <Icons.AlertTriangle size={16} />
                                        Pending Orders ({pendingOrders.length})
                                    </div>
                                    <table className="compact-table w-full size-11">
                                        <thead>
                                            <tr>
                                                <th className="text-left">Customer</th>
                                                <th className="text-left">Invoice</th>
                                                <th className="text-right">Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingOrders.map((po, idx) => (
                                                <tr key={idx} className="border-t">
                                                    <td>{po.customer_name}</td>
                                                    <td>{po.invoice_no}</td>
                                                    <td className="text-right fw-600">{po.pending_qty}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                    {activeModalTab === 'variants' && (
                        <div className="variants-section">
                            <div className="p-20 bg-secondary rounded-8 mb-24">
                                <h4 className="size-14 fw-600 mb-16">Quick Add Variant</h4>
                                <div className="grid grid-5 gap-12">
                                    <FormGroup label="Name" className="m-0">
                                        <Input 
                                            className="h-42"
                                            placeholder="Red, XL, etc." 
                                            value={variantForm.name}
                                            onChange={e => setVariantForm({ ...variantForm, name: e.target.value })}
                                        />
                                    </FormGroup>
                                    <FormGroup label="Price" className="m-0">
                                        <Input 
                                            type="number" 
                                            className="h-42"
                                            placeholder="0.00" 
                                            value={variantForm.selling_price}
                                            onChange={e => setVariantForm({ ...variantForm, selling_price: e.target.value })}
                                        />
                                    </FormGroup>
                                    <FormGroup label="Stock" className="m-0">
                                        <Input 
                                            type="number" 
                                            className="h-42"
                                            placeholder="0" 
                                            value={variantForm.stock_quantity}
                                            onChange={e => setVariantForm({ ...variantForm, stock_quantity: e.target.value })}
                                        />
                                    </FormGroup>
                                    <FormGroup label="Code" className="m-0">
                                        <Input 
                                            className="h-42"
                                            placeholder="Variant SKU" 
                                            value={variantForm.sku}
                                            onChange={e => setVariantForm({ ...variantForm, sku: e.target.value })}
                                        />
                                    </FormGroup>
                                    <FormGroup label="&nbsp;" className="m-0">
                                        <s-button 
                                            variant="primary"
                                            onClick={async () => {
                                                if (!variantForm.name.trim()) return toast.error('Variant name required');
                                                const newV = { 
                                                    ...variantForm, 
                                                    selling_price: parseFloat(variantForm.selling_price) || parseFloat(form.selling_price) || 0,
                                                    cost_price: parseFloat(form.cost_price) || 0,
                                                    stock_quantity: parseFloat(variantForm.stock_quantity) || 0
                                                };
                                                
                                                if (editingProduct) {
                                                    const promise = api.createVariant(editingProduct.id, newV);
                                                    toast.promise(promise, {
                                                        loading: 'Creating...',
                                                        success: () => {
                                                            loadProductVariants(editingProduct.id);
                                                            setVariantForm({ name: '', sku: '', selling_price: '', cost_price: '', stock_quantity: 0 });
                                                            return 'Variant added';
                                                        },
                                                        error: 'Failed'
                                                    });
                                                } else {
                                                    setTempVariants([...tempVariants, newV]);
                                                    setVariantForm({ name: '', sku: '', selling_price: '', cost_price: '', stock_quantity: 0 });
                                                    toast.success('Variant queued');
                                                }
                                            }}
                                        >
                                            Add Variant
                                        </s-button>
                                    </FormGroup>
                                </div>
                            </div>

                            <div className="premium-table-wrap">
                                <table className="premium-table compact">
                                    <thead>
                                        <tr>
                                            <th>Variant Name</th>
                                            <th>SKU/Code</th>
                                            <th>Price (₹)</th>
                                            <th>Stock</th>
                                            <th className="text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(editingProduct ? productVariants : tempVariants).length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center p-24 text-secondary italic">No variants defined</td>
                                            </tr>
                                        ) : (
                                            (editingProduct ? productVariants : tempVariants).map((v, idx) => (
                                                <tr key={idx}>
                                                    <td className="fw-600">{v.name}</td>
                                                    <td>
                                                        {editingProduct ? (
                                                            <input
                                                                className="table-input w-100"
                                                                defaultValue={v.sku}
                                                                onBlur={async (e) => {
                                                                    if (e.target.value !== v.sku) {
                                                                        await api.updateVariant(v.id, { ...v, sku: e.target.value });
                                                                        loadProductVariants(editingProduct.id);
                                                                    }
                                                                }}
                                                            />
                                                        ) : v.sku || '—'}
                                                    </td>
                                                    <td>
                                                        {editingProduct ? (
                                                            <input
                                                                type="number"
                                                                className="table-input w-80"
                                                                defaultValue={v.selling_price}
                                                                onBlur={async (e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    if (val !== v.selling_price) {
                                                                        await api.updateVariant(v.id, { ...v, selling_price: val });
                                                                        loadProductVariants(editingProduct.id);
                                                                    }
                                                                }}
                                                            />
                                                        ) : v.selling_price}
                                                    </td>
                                                    <td>
                                                        {editingProduct ? (
                                                            <input
                                                                type="number"
                                                                className="table-input w-60"
                                                                defaultValue={v.stock_quantity}
                                                                onBlur={async (e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    if (val !== v.stock_quantity) {
                                                                        await api.updateVariant(v.id, { ...v, stock_quantity: val });
                                                                        loadProductVariants(editingProduct.id);
                                                                    }
                                                                }}
                                                            />
                                                        ) : v.stock_quantity}
                                                    </td>
                                                    <td className="text-right">
                                                        <s-button tone="critical" onClick={async () => {
                                                            if (editingProduct) {
                                                                if (confirm('Delete variant?')) {
                                                                    await api.deleteVariant(v.id);
                                                                    loadProductVariants(editingProduct.id);
                                                                }
                                                            } else {
                                                                setTempVariants(tempVariants.filter((_, i) => i !== idx));
                                                            }
                                                        }}>
                                                            Delete
                                                        </s-button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeModalTab === 'serials' && (
                        <div>
                            <div className="modal-section-title">Serial / IMEI Tracking List</div>
                            
                            {loadingSerials ? (
                                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading serial numbers...</div>
                            ) : productSerials.length === 0 ? (
                                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                                    No serial numbers registered yet. Enter a serial below or purchase stock to register serials.
                                </div>
                            ) : (
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    <table className="compact-table w-full text-sm">
                                        <thead>
                                            <tr className="border-b" style={{ paddingBottom: '8px' }}>
                                                <th className="text-left" style={{ padding: '8px' }}>Serial / IMEI Number</th>
                                                <th className="text-left" style={{ padding: '8px' }}>Status</th>
                                                <th className="text-left" style={{ padding: '8px' }}>Created Date</th>
                                                <th className="text-right" style={{ padding: '8px' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {productSerials.map((s, idx) => (
                                                <tr key={s.id || idx} className="border-b hover:bg-tinted">
                                                    <td style={{ padding: '8px', fontWeight: 500 }}>{s.serial_number}</td>
                                                    <td style={{ padding: '8px' }}>
                                                        <span className={`badge ${s.status === 'Available' ? 'badge-success' : s.status === 'Sold' ? 'badge-info' : 'badge-warning'}`} style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '12px',
                                                            fontSize: '11px',
                                                            fontWeight: '600',
                                                            background: s.status === 'Available' ? 'rgba(52, 199, 89, 0.1)' : s.status === 'Sold' ? 'rgba(0, 122, 255, 0.1)' : 'rgba(255, 149, 0, 0.1)',
                                                            color: s.status === 'Available' ? 'var(--success)' : s.status === 'Sold' ? 'var(--accent)' : 'var(--warning-text, #b25e00)'
                                                        }}>
                                                            {s.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                                        {s.created_at ? formatDate(s.created_at) : '—'}
                                                    </td>
                                                    <td className="text-right" style={{ padding: '8px' }}>
                                                        {s.status === 'Available' ? (
                                                            <s-button
                                                                type="text"
                                                                style={{ color: 'var(--error)', padding: '4px 8px' }}
                                                                onClick={() => handleManualDeleteSerial(s.id, s.serial_number)}
                                                            >
                                                                Delete
                                                            </s-button>
                                                        ) : (
                                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Manual Serial Add Input */}
                            <div className="flex gap-8 items-end mb-16" style={{ marginTop: '16px', marginBottom: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <FormGroup label="Add Serial Number Manually">
                                        <Input
                                            value={newManualSerial}
                                            onChange={e => setNewManualSerial(e.target.value)}
                                            placeholder="Enter serial or IMEI number"
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleManualAddSerial();
                                                }
                                            }}
                                        />
                                    </FormGroup>
                                </div>
                                <s-button onClick={handleManualAddSerial} style={{ height: '36px', marginBottom: '4px' }}>Add Serial</s-button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Inner Modals for Category, Sub-category, and Brand - Placed outside the flex layout to prevent shrinking */}
                <div style={{ position: 'absolute' }}>
                    {showCatModal && (
                    <s-modal
                        id="inner-cat-modal"
                        heading="New Category"
                        size="small"
                        ref={el => {
                            if (el && !el.dataset.init) {
                                el.dataset.init = '1';
                                setTimeout(() => {
                                    let btn = document.getElementById('trigger-' + el.id);
                                    if (btn) btn.remove();
                                    btn = document.createElement('s-button');
                                    btn.id = 'trigger-' + el.id;
                                    btn.setAttribute('commandFor', el.id);
                                    btn.setAttribute('command', '--show');
                                    btn.style.display = 'none';
                                    el.appendChild(btn);
                                    setTimeout(() => btn.click(), 100);
                                }, 10);
                                el.addEventListener('hide', (e) => { if (e.target === el) setShowCatModal(false); });
                            }
                        }}
                    >
                        <FormGroup label="Category Name" required>
                            <Input
                                value={newCatName}
                                onChange={e => setNewCatName(e.target.value)}
                                placeholder="e.g. Spare Parts"
                                autoFocus
                            />
                        </FormGroup>
                        <s-button slot="secondary-actions" onClick={() => { setShowCatModal(false); setNewCatName(''); }}>Cancel</s-button>
                        <s-button slot="primary-action" variant="primary" onClick={async () => {
                            if (!newCatName.trim()) return;
                            try { await api.createCategory({ name: newCatName.trim() }); const cats = await api.getCategories(); setCategories(cats); setForm(f => ({ ...f, category: newCatName.trim() })); setNewCatName(''); setShowCatModal(false); toast.success('Category created'); } catch(err) { toast.error(err.message); }
                        }}>Create</s-button>
                    </s-modal>
                    )}

                    {showSubCatModal && (
                    <s-modal
                        id="inner-subcat-modal"
                        heading="New Sub-category"
                        size="small"
                        ref={el => {
                            if (el && !el.dataset.init) {
                                el.dataset.init = '1';
                                setTimeout(() => {
                                    let btn = document.getElementById('trigger-' + el.id);
                                    if (btn) btn.remove();
                                    btn = document.createElement('s-button');
                                    btn.id = 'trigger-' + el.id;
                                    btn.setAttribute('commandFor', el.id);
                                    btn.setAttribute('command', '--show');
                                    btn.style.display = 'none';
                                    el.appendChild(btn);
                                    setTimeout(() => btn.click(), 100);
                                }, 10);
                                el.addEventListener('hide', (e) => { if (e.target === el) setShowSubCatModal(false); });
                            }
                        }}
                    >
                        <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                            Parent Category: <strong style={{ color: 'var(--accent)' }}>{form.category || 'General'}</strong>
                        </div>
                        <FormGroup label="Sub-category Name" required>
                            <Input
                                value={newSubCatName}
                                onChange={e => setNewSubCatName(e.target.value)}
                                placeholder="e.g. Engine Oil"
                                autoFocus
                            />
                        </FormGroup>
                        <s-button slot="secondary-actions" onClick={() => { setShowSubCatModal(false); setNewSubCatName(''); }}>Cancel</s-button>
                        <s-button slot="primary-action" variant="primary" onClick={async () => {
                            if (!newSubCatName.trim()) return;
                            const catId = categories.findIndex(c => c === form.category) + 1;
                            try { const r = await api.createSubcategory({ name: newSubCatName.trim(), category_id: catId, category_name: form.category }); const subs = await api.getSubcategories(); setSubcategories(subs); setForm(f => ({ ...f, subcategory_id: r.id })); setNewSubCatName(''); setShowSubCatModal(false); toast.success('Sub-category created'); } catch(err) { toast.error(err.message); }
                        }}>Create</s-button>
                    </s-modal>
                    )}

                    {showBrandModal && (
                    <s-modal
                        id="inner-brand-modal"
                        heading="New Brand"
                        size="small"
                        ref={el => {
                            if (el && !el.dataset.init) {
                                el.dataset.init = '1';
                                setTimeout(() => {
                                    let btn = document.getElementById('trigger-' + el.id);
                                    if (btn) btn.remove();
                                    btn = document.createElement('s-button');
                                    btn.id = 'trigger-' + el.id;
                                    btn.setAttribute('commandFor', el.id);
                                    btn.setAttribute('command', '--show');
                                    btn.style.display = 'none';
                                    el.appendChild(btn);
                                    setTimeout(() => btn.click(), 100);
                                }, 10);
                                el.addEventListener('hide', (e) => { if (e.target === el) setShowBrandModal(false); });
                            }
                        }}
                    >
                        <FormGroup label="Brand Name" required>
                            <Input
                                value={newBrandName}
                                onChange={e => setNewBrandName(e.target.value)}
                                placeholder="e.g. Toyota, Honda..."
                                autoFocus
                            />
                        </FormGroup>
                        <s-button slot="secondary-actions" onClick={() => { setShowBrandModal(false); setNewBrandName(''); }}>Cancel</s-button>
                        <s-button slot="primary-action" variant="primary" onClick={async () => {
                            if (!newBrandName.trim()) return;
                            try { const r = await api.createBrand({ name: newBrandName.trim() }); const brs = await api.getBrands(); setBrands(brs); setForm(f => ({ ...f, brand_id: r.id })); setNewBrandName(''); setShowBrandModal(false); toast.success('Brand created'); } catch(err) { toast.error(err.message); }
                        }}>Create</s-button>
                    </s-modal>
                    )}
                </div>

                <s-button slot="secondary-actions" onClick={() => setShowModal(false)}>Cancel</s-button>
                <s-button slot="primary-action" variant="primary" onClick={handleSave}>{editingProduct ? 'Update Product' : 'Add Product'}</s-button>
            </s-modal>
            )}

            {!!deleteId && (
            <s-modal
                id="delete-product-modal"
                heading="Delete Product"
                size="small"
                ref={el => {
                    if (el && !el.dataset.init) {
                        el.dataset.init = '1';
                        setTimeout(() => {
                            let btn = document.getElementById('trigger-' + el.id);
                            if (btn) btn.remove();
                            
                            btn = document.createElement('s-button');
                            btn.id = 'trigger-' + el.id;
                            btn.setAttribute('commandFor', el.id);
                            btn.setAttribute('command', '--show');
                            btn.style.display = 'none';
                            document.body.appendChild(btn);
                            setTimeout(() => btn.click(), 100);
                        }, 10);
                        el.addEventListener('hide', () => setDeleteId(null));
                    }
                }}
            >
                <div style={{ padding: '8px 0' }}>
                    <p style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', marginBottom: '8px' }}>Are you sure?</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        This will permanently remove the product and all its transaction history. This action <strong style={{ color: 'var(--danger)' }}>cannot be undone</strong>.
                    </p>
                </div>
                
                <s-button slot="secondary-actions" onClick={() => setDeleteId(null)}>Cancel</s-button>
                <s-button slot="primary-action" variant="primary" tone="critical" onClick={handleDelete}>Delete Product</s-button>
            </s-modal>
            )}

            {!!deleteCatName && (
            <s-modal
                id="delete-cat-modal"
                heading="Delete Category"
                size="small"
                ref={el => {
                    if (el && !el.dataset.init) {
                        el.dataset.init = '1';
                        setTimeout(() => {
                            let btn = document.getElementById('trigger-' + el.id);
                            if (btn) btn.remove();
                            
                            btn = document.createElement('s-button');
                            btn.id = 'trigger-' + el.id;
                            btn.setAttribute('commandFor', el.id);
                            btn.setAttribute('command', '--show');
                            btn.style.display = 'none';
                            document.body.appendChild(btn);
                            setTimeout(() => btn.click(), 100);
                        }, 10);
                        el.addEventListener('hide', () => setDeleteCatName(null));
                    }
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '16px 8px' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '56px',
                        height: '56px',
                        backgroundColor: 'var(--warning-bg)',
                        color: 'var(--warning)',
                        borderRadius: '50%',
                        marginBottom: '16px'
                    }}>
                        <Icons.AlertTriangle size={28} />
                    </div>
                    <p style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                        Confirm Deletion
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                        Are you sure you want to delete the category <strong>{deleteCatName}</strong>?
                    </p>
                    <div style={{
                        backgroundColor: 'var(--bg-soft)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 12px',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-secondary)',
                        textAlign: 'left',
                        width: '100%',
                        boxSizing: 'border-box'
                    }}>
                        <strong style={{ color: 'var(--warning)', display: 'block', marginBottom: '4px' }}>⚠️ System Restriction</strong>
                        Only categories with no products can be deleted. If this category is currently assigned to any products, the deletion will be blocked.
                    </div>
                </div>
                
                <s-button slot="secondary-actions" onClick={() => setDeleteCatName(null)}>Cancel</s-button>
                <s-button slot="primary-action" variant="primary" tone="critical" onClick={handleDeleteCategory}>Delete Category</s-button>
            </s-modal>
            )}


            {/* Standalone Cat Modal — only used from page header / edit-category menu, not from inside product form */}
            {showCatModal && !showModal && (
            <s-modal
                id="cat-modal"
                heading={editingCatOldName ? 'Edit Category' : 'New Category'}
                size="small"
                ref={el => {
                    if (el && !el.dataset.init) {
                        el.dataset.init = '1';
                        setTimeout(() => {
                            let btn = document.getElementById('trigger-' + el.id);
                            if (btn) btn.remove();
                            
                            btn = document.createElement('s-button');
                            btn.id = 'trigger-' + el.id;
                            btn.setAttribute('commandFor', el.id);
                            btn.setAttribute('command', '--show');
                            btn.style.display = 'none';
                            document.body.appendChild(btn);
                            setTimeout(() => btn.click(), 100);
                        }, 10);
                        el.addEventListener('hide', () => { setShowCatModal(false); setEditingCatOldName(null); setNewCatName(''); });
                    }
                }}
            >
                <FormGroup label="Category Name" required>
                    <Input
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                        placeholder="e.g. Spare Parts"
                        autoFocus
                    />
                </FormGroup>
                
                <s-button slot="secondary-actions" onClick={() => { setShowCatModal(false); setEditingCatOldName(null); setNewCatName(''); }}>Cancel</s-button>
                <s-button slot="primary-action" variant="primary" onClick={async () => {
                    if (!newCatName.trim()) return;
                    const promise = editingCatOldName
                        ? api.updateCategory(editingCatOldName, newCatName.trim())
                        : api.createCategory({ name: newCatName.trim() });
                    toast.promise(promise, {
                        loading: editingCatOldName ? 'Updating...' : 'Creating...',
                        success: () => {
                            api.getCategories().then(setCategories).catch(() => {});
                            if (editingCatOldName) loadProducts();
                            setNewCatName('');
                            setEditingCatOldName(null);
                            setShowCatModal(false);
                            return editingCatOldName ? 'Category updated' : 'Category created';
                        },
                        error: (err) => err.message || 'Error occurred'
                    });
                }}>{editingCatOldName ? 'Update' : 'Create'}</s-button>
            </s-modal>
            )}
            {showManageSubCatModal && (
            <s-modal
                id="manage-subcat-modal"
                heading={`Sub-categories: ${manageSubCatForCategory}`}
                size="medium"
                ref={el => {
                    if (el && !el.dataset.init) {
                        el.dataset.init = '1';
                        setTimeout(() => {
                            let btn = document.getElementById('trigger-' + el.id);
                            if (btn) btn.remove();
                            
                            btn = document.createElement('s-button');
                            btn.id = 'trigger-' + el.id;
                            btn.setAttribute('commandFor', el.id);
                            btn.setAttribute('command', '--show');
                            btn.style.display = 'none';
                            document.body.appendChild(btn);
                            setTimeout(() => btn.click(), 100);
                        }, 10);
                        el.addEventListener('hide', () => setShowManageSubCatModal(false));
                    }
                }}
            >
                <div className="flex gap-8 mb-20">
                    <div className="flex-1">
                        <Input
                            value={newSubCatName}
                            onChange={e => setNewSubCatName(e.target.value)}
                            placeholder="New Sub-category Name"
                            onKeyDown={e => {
                                if (e.key === 'Enter' && newSubCatName.trim()) {
                                    const catId = categories.findIndex(c => c === manageSubCatForCategory) + 1;
                                    const promise = api.createSubcategory({ name: newSubCatName.trim(), category_id: catId, category_name: manageSubCatForCategory });
                                    toast.promise(promise, {
                                        loading: `Creating...`,
                                        success: () => {
                                            api.getSubcategories().then(setSubcategories).catch(() => { });
                                            setNewSubCatName('');
                                            return 'Created';
                                        },
                                        error: (err) => err.message || 'Failed'
                                    });
                                }
                            }}
                        />
                    </div>
                    <s-button variant="primary" onClick={async () => {
                        if (newSubCatName.trim()) {
                            const catId = categories.findIndex(c => c === manageSubCatForCategory) + 1;
                            const promise = api.createSubcategory({ name: newSubCatName.trim(), category_id: catId, category_name: manageSubCatForCategory });
                            toast.promise(promise, {
                                loading: `Creating...`,
                                success: () => {
                                    api.getSubcategories().then(setSubcategories).catch(() => { });
                                    setNewSubCatName('');
                                    return 'Created';
                                },
                                        error: (err) => err.message || 'Failed'
                                    });
                                }
                            }}>Add</s-button>
                </div>

                <div className="premium-table-wrap" style={{ maxHeight: '40vh' }}>
                    <table className="premium-table compact">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subcategories.filter(sc => sc.category_name === manageSubCatForCategory).length === 0 ? (
                                <tr><td colSpan="2" className="text-center p-16 text-secondary italic">No sub-categories found</td></tr>
                            ) : (
                                subcategories.filter(sc => sc.category_name === manageSubCatForCategory).map(sc => (
                                    <tr key={sc.id}>
                                        <td>
                                            {editingSubCatId === sc.id ? (
                                                <Input
                                                    autoFocus
                                                    value={editingSubCatName}
                                                    onChange={e => setEditingSubCatName(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSaveSubCat(sc.id);
                                                        if (e.key === 'Escape') {
                                                            setEditingSubCatId(null);
                                                            setEditingSubCatName('');
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <span className="fw-500">{sc.name}</span>
                                            )}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex justify-end" style={{ gap: '8px' }}>
                                                {editingSubCatId === sc.id ? (
                                                    <s-button onClick={() => handleSaveSubCat(sc.id)} title="Save name">
                                                        Save
                                                    </s-button>
                                                ) : (
                                                    <s-button onClick={() => { setEditingSubCatId(sc.id); setEditingSubCatName(sc.name); }} title="Edit name">
                                                        Edit
                                                    </s-button>
                                                )}
                                                <s-button tone="critical" title="Delete" onClick={async () => {
                                                    if (confirm(`Delete sub-category "${sc.name}"?`)) {
                                                        const promise = api.deleteSubcategory(sc.id);
                                                        toast.promise(promise, {
                                                            loading: 'Deleting...',
                                                            success: () => {
                                                                api.getSubcategories().then(setSubcategories).catch(() => { });
                                                                return 'Deleted';
                                                            },
                                                            error: (err) => err.message || 'Failed'
                                                        });
                                                    }
                                                }}>
                                                    Delete
                                                </s-button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                <s-button slot="secondary-actions" onClick={() => setShowManageSubCatModal(false)}>Close</s-button>
            </s-modal>
            )}


        </div>
    );
}
