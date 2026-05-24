import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { toast } from 'sonner';
import CustomSelect from '../components/CustomSelect';
import { Icons } from '../components/Icons';
import Modal from '../components/Modal';
import SButton from '../components/SButton';
import { FormGroup, Input } from '../components/FormComponents';
import { formatDate, validateCustomer } from '../utils';
import { EMPTY_CUSTOMER } from '../constants';
import './CustomersPage.css';

export default function CustomersPage() {
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Filters
    const [sortBy, setSortBy] = useState('Newest First');
    const [filterCredit, setFilterCredit] = useState('All');

    // Settings for Tier Discounts
    const [settings, setSettings] = useState({
        tier_a_discount: '10',
        tier_b_discount: '5',
        tier_c_discount: '0'
    });

    // Settings Modal
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [editingTier, setEditingTier] = useState(null); // 'A', 'B', 'C'
    const [editingTierDiscount, setEditingTierDiscount] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);

    // Modal for Add/Edit
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [form, setForm] = useState(EMPTY_CUSTOMER);
    const [saving, setSaving] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 50;

    // Delete
    const [deleteId, setDeleteId] = useState(null);

    // Customer Activity/History Modal
    const [historyCustomer, setHistoryCustomer] = useState(null);
    const [activeTab, setActiveTab] = useState('purchases'); // 'purchases' or 'communication'
    const [purchases, setPurchases] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logForm, setLogForm] = useState({ type: 'Call', notes: '' });
    const [savingLog, setSavingLog] = useState(false);

    // Marketing/Coupons page tab
    const [activePageTab, setActivePageTab] = useState('directory'); // 'directory' or 'marketing'
    const [coupons, setCoupons] = useState([]);
    const [loadingCoupons, setLoadingCoupons] = useState(false);
    const [products, setProducts] = useState([]);
    const [showCouponModal, setShowCouponModal] = useState(false);
    const [couponForm, setCouponForm] = useState({
        code: '',
        type: 'discount',
        value: '',
        expiry_date: '',
        usage_limit_type: 'unlimited',
        usage_limit: '',
        reward_quantity: '1'
    });
    const [savingCoupon, setSavingCoupon] = useState(false);

    // Campaigns state
    const [marketingSubTab, setMarketingSubTab] = useState('coupons'); // 'coupons' or 'campaigns'
    const [campaigns, setCampaigns] = useState([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [savingCampaign, setSavingCampaign] = useState(false);
    const [campaignForm, setCampaignForm] = useState({
        name: '',
        customers: [],
        startDate: '',
        endDate: '',
        timeToSend: '09:00',
        template: 'order_confirmation'
    });
    const [campaignSearch, setCampaignSearch] = useState('');

    // Catalog search and filter states inside coupon modal
    const [catalogSearch, setCatalogSearch] = useState('');
    const [catalogCategory, setCatalogCategory] = useState('All');
    const [catalogSubcategory, setCatalogSubcategory] = useState('All');
    const [catalogBrand, setCatalogBrand] = useState('All');
    const [selectedProducts, setSelectedProducts] = useState([]);

    const loadCoupons = useCallback(async () => {
        setLoadingCoupons(true);
        try {
            const data = await api.getCoupons();
            setCoupons(data || []);
        } catch (err) {
            console.error('Failed to load coupons', err);
        } finally {
            setLoadingCoupons(false);
        }
    }, []);

    const loadCampaigns = useCallback(async () => {
        setLoadingCampaigns(true);
        try {
            const data = await api.getCampaigns();
            setCampaigns(data || []);
        } catch (err) {
            console.error('Failed to load campaigns', err);
        } finally {
            setLoadingCampaigns(false);
        }
    }, []);

    useEffect(() => {
        if (activePageTab === 'marketing') {
            if (marketingSubTab === 'coupons') {
                loadCoupons();
            } else {
                loadCampaigns();
            }
            api.getProducts().then(data => {
                setProducts(Array.isArray(data) ? data : (data?.items || []));
            }).catch(console.error);
        }
    }, [activePageTab, marketingSubTab, loadCoupons, loadCampaigns]);

    async function handleSaveCoupon() {
        if (!couponForm.code.trim()) {
            return toast.error('Coupon code is required');
        }
        if (couponForm.type !== 'product' && (couponForm.value === '' || isNaN(Number(couponForm.value)) || Number(couponForm.value) < 0)) {
            return toast.error('Discount value must be a non-negative number');
        }
        if (couponForm.type === 'product' && selectedProducts.length === 0) {
            return toast.error('Please select at least one product reward');
        }
        if (couponForm.usage_limit_type === 'custom' && (couponForm.usage_limit === '' || isNaN(Number(couponForm.usage_limit)) || Number(couponForm.usage_limit) <= 0)) {
            return toast.error('Usage limit must be a positive integer');
        }

        const payload = {
            code: couponForm.code.trim().toUpperCase(),
            type: couponForm.type,
            value: couponForm.type === 'product'
                ? JSON.stringify(selectedProducts.map(sp => ({ id: sp.id, qty: sp.qty })))
                : Number(couponForm.value),
            expiry_date: couponForm.expiry_date || null,
            usage_limit_type: couponForm.usage_limit_type,
            usage_limit: couponForm.usage_limit_type === 'custom' ? Math.floor(Number(couponForm.usage_limit)) : null,
            reward_quantity: 1
        };

        setSavingCoupon(true);
        try {
            await api.createCoupon(payload);
            toast.success('Coupon created successfully!');
            setShowCouponModal(false);
            setCouponForm({
                code: '',
                type: 'discount',
                value: '',
                expiry_date: '',
                usage_limit_type: 'unlimited',
                usage_limit: '',
                reward_quantity: '1'
            });
            // Reset filters
            setSelectedProducts([]);
            setCatalogSearch('');
            setCatalogCategory('All');
            setCatalogSubcategory('All');
            setCatalogBrand('All');
            loadCoupons();
        } catch (err) {
            toast.error(err.message || 'Failed to create coupon');
        } finally {
            setSavingCoupon(false);
        }
    }

    function openCreateCouponModal() {
        setSelectedProducts([]);
        setCatalogSearch('');
        setCatalogCategory('All');
        setCatalogSubcategory('All');
        setCatalogBrand('All');
        setCouponForm({
            code: '',
            type: 'discount',
            value: '',
            expiry_date: '',
            usage_limit_type: 'unlimited',
            usage_limit: '',
            reward_quantity: '1'
        });
        setShowCouponModal(true);
    }

    async function handleDeleteCoupon(couponId) {
        if (!confirm('Are you sure you want to delete this coupon?')) return;
        try {
            await api.deleteCoupon(couponId);
            toast.success('Coupon deleted successfully');
            loadCoupons();
        } catch (err) {
            toast.error(err.message || 'Failed to delete coupon');
        }
    }

    async function handleSaveCampaign() {
        if (!campaignForm.name.trim()) {
            return toast.error('Campaign name is required');
        }
        if (campaignForm.customers.length === 0) {
            return toast.error('Please select at least one customer');
        }
        if (!campaignForm.startDate) {
            return toast.error('Start date is required');
        }
        if (!campaignForm.timeToSend) {
            return toast.error('Time to send is required');
        }

        const payload = {
            name: campaignForm.name.trim(),
            customers: campaignForm.customers,
            startDate: campaignForm.startDate,
            endDate: campaignForm.endDate || null,
            timeToSend: campaignForm.timeToSend,
            template: campaignForm.template
        };

        setSavingCampaign(true);
        try {
            await api.scheduleCampaign(payload);
            toast.success('Campaign scheduled successfully!');
            setShowCampaignModal(false);
            setCampaignForm({
                name: '',
                customers: [],
                startDate: '',
                endDate: '',
                timeToSend: '09:00',
                template: 'order_confirmation'
            });
            loadCampaigns();
        } catch (err) {
            toast.error(err.message || 'Failed to schedule campaign');
        } finally {
            setSavingCampaign(false);
        }
    }

    async function handleCancelCampaign(id) {
        if (!confirm('Are you sure you want to cancel this campaign?')) return;
        try {
            await api.cancelCampaign(id);
            toast.success('Campaign cancelled successfully');
            loadCampaigns();
        } catch (err) {
            toast.error(err.message || 'Failed to cancel campaign');
        }
    }

    const loadSettings = useCallback(async () => {
        try {
            const s = await api.getSettings();
            if (s) {
                setSettings({
                    tier_a_discount: s.tier_a_discount ?? '10',
                    tier_b_discount: s.tier_b_discount ?? '5',
                    tier_c_discount: s.tier_c_discount ?? '0'
                });
            }
        } catch (err) {
            console.error('Failed to load settings', err);
        }
    }, []);

    const loadCustomers = useCallback(async () => {
        try {
            const params = {};
            if (search) params.search = search;
            const data = await api.getCustomers(params);
            setCustomers(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        loadCustomers();
        loadSettings();
    }, [loadCustomers, loadSettings]);

    function openAdd() {
        setEditingCustomer(null);
        setForm(EMPTY_CUSTOMER);
        setShowModal(true);
    }

    function openEdit(customer) {
        setEditingCustomer(customer);
        setForm({
            name: customer.name,
            phone: customer.phone,
            email: customer.email || '',
            address: customer.address,
            gstin: customer.gstin || '',
            tier: customer.tier || 'C',
            credit_limit: customer.credit_limit || 0
        });
        setShowModal(true);
    }

    async function handleSave() {
        const error = validateCustomer(form);
        if (error) return toast.error(error);
        
        const payload = {
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            address: form.address.trim(),
            gstin: form.gstin.trim(),
            tier: form.tier || 'C',
            credit_limit: Number(form.credit_limit || 0)
        };

        const promise = editingCustomer 
            ? api.updateCustomer(editingCustomer.id, payload)
            : api.createCustomer(payload);

        setSaving(true);
        toast.promise(promise, {
            loading: editingCustomer ? 'Updating customer...' : 'Adding new customer...',
            success: () => {
                setShowModal(false);
                loadCustomers();
                return editingCustomer ? 'Customer updated successfully' : 'Customer added successfully';
            },
            error: (err) => err.message || 'Failed to save customer',
            finally: () => setSaving(false)
        });
    }

    async function handleDelete() {
        if (!deleteId) return;
        
        const promise = api.deleteCustomer(deleteId);
        
        toast.promise(promise, {
            loading: 'Deleting customer records...',
            success: () => {
                setDeleteId(null);
                loadCustomers();
                return 'Customer deleted successfully';
            },
            error: (err) => err.message || 'Failed to delete customer'
        });
    }

    // Settings / Tier Discounts management
    function openEditTier(tier) {
        setEditingTier(tier);
        const key = `tier_${tier.toLowerCase()}_discount`;
        setEditingTierDiscount(settings[key] || '0');
        setShowSettingsModal(true);
    }

    async function handleSaveTierDiscount() {
        const pct = parseFloat(editingTierDiscount);
        if (isNaN(pct) || pct < 0 || pct > 100) {
            return toast.error('Discount percentage must be between 0 and 100');
        }
        setSavingSettings(true);
        const key = `tier_${editingTier.toLowerCase()}_discount`;
        try {
            await api.updateSettings({ [key]: String(pct) });
            toast.success(`Tier ${editingTier} discount updated successfully`);
            setSettings(prev => ({ ...prev, [key]: String(pct) }));
            setShowSettingsModal(false);
        } catch (err) {
            toast.error(err.message || 'Failed to save setting');
        } finally {
            setSavingSettings(false);
        }
    }

    // CRM activity logs management
    const loadLogs = async (customerId) => {
        setLoadingLogs(true);
        try {
            const data = await api.getCustomerCommunicationLogs(customerId);
            setLogs(data || []);
        } catch (err) {
            console.error('Failed to load communication logs', err);
            setLogs([]);
        } finally {
            setLoadingLogs(false);
        }
    };

    async function viewHistory(customer) {
        setHistoryCustomer(customer);
        setActiveTab('purchases');
        setLogForm({ type: 'Call', notes: '' });
        try {
            const data = await api.getCustomerPurchases(customer.id);
            setPurchases(data || []);
        } catch (err) {
            console.error(err);
            setPurchases([]);
        }
        loadLogs(customer.id);
    }

    async function handleAddLog() {
        if (!logForm.notes.trim()) {
            return toast.error('Notes cannot be empty');
        }
        setSavingLog(true);
        try {
            await api.createCustomerCommunicationLog(historyCustomer.id, {
                type: logForm.type,
                notes: logForm.notes.trim()
            });
            toast.success('Activity logged successfully');
            setLogForm({ ...logForm, notes: '' });
            loadLogs(historyCustomer.id);
        } catch (err) {
            toast.error(err.message || 'Failed to log activity');
        } finally {
            setSavingLog(false);
        }
    }

    async function handleDeleteLog(logId) {
        try {
            await api.deleteCustomerCommunicationLog(historyCustomer.id, logId);
            toast.success('Log deleted successfully');
            loadLogs(historyCustomer.id);
        } catch (err) {
            toast.error(err.message || 'Failed to delete log');
        }
    }

    const filteredAndSortedCustomers = customers.filter(c => {
        if (filterCredit === 'With P-Credit') return c.p_credit_balance > 0;
        if (filterCredit === 'Without P-Credit') return c.p_credit_balance <= 0;
        return true;
    }).sort((a, b) => {
        if (sortBy === 'Name A-Z') return a.name.localeCompare(b.name);
        if (sortBy === 'Name Z-A') return b.name.localeCompare(a.name);
        if (sortBy === 'Highest Credit') return Number(b.p_credit_balance) - Number(a.p_credit_balance);
        if (sortBy === 'Oldest First') return new Date(a.created_at) - new Date(b.created_at);
        return new Date(b.created_at) - new Date(a.created_at);
    });

    const totalPages = Math.max(1, Math.ceil(filteredAndSortedCustomers.length / PAGE_SIZE));
    const paginatedCustomers = filteredAndSortedCustomers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const prevSearch = useRef(search);
    if (prevSearch.current !== search) {
        prevSearch.current = search;
        if (currentPage !== 1) setCurrentPage(1);
    }

    // Catalog definitions for Coupon modal
    const productCategories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
    const productSubcategories = ['All', ...new Set(products.map(p => p.subcategory_name || p.subcategory).filter(Boolean))];
    const productBrands = ['All', ...new Set(products.map(p => p.brand_name || p.brand).filter(Boolean))];

    const filteredCatalogProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                              (p.product_code && p.product_code.toLowerCase().includes(catalogSearch.toLowerCase()));
        const matchesCategory = catalogCategory === 'All' || p.category === catalogCategory;
        const matchesSubcategory = catalogSubcategory === 'All' || (p.subcategory_name === catalogSubcategory || p.subcategory === catalogSubcategory);
        const matchesBrand = catalogBrand === 'All' || (p.brand_name === catalogBrand || p.brand === catalogBrand);
        return matchesSearch && matchesCategory && matchesSubcategory && matchesBrand;
    });

    return (
        <div className="customers-page">
            <div className="page-header">
                <div>
                    <h1>Customers</h1>
                    <p className="text-secondary">
                        {activePageTab === 'directory' 
                            ? 'Manage customer profiles, contact directories, and credits' 
                            : 'Create and manage promo codes, flat discount vouchers, and free product rewards'}
                    </p>
                </div>
                {activePageTab === 'directory' ? (
                    <SButton variant="primary" onClick={openAdd} aria-label="Add customer">
                        Add Customer
                    </SButton>
                ) : (
                    <SButton variant="primary" onClick={openCreateCouponModal} aria-label="Create coupon">
                        Create Coupon
                    </SButton>
                )}
            </div>

            {/* Page Tabs */}
            <div className="crm-modal-tabs" style={{ marginBottom: '24px' }}>
                <button 
                    className={`crm-tab-btn ${activePageTab === 'directory' ? 'active' : ''}`}
                    onClick={() => setActivePageTab('directory')}
                >
                    <Icons.Users size={16} />
                    Customers Directory
                </button>
                <button 
                    className={`crm-tab-btn ${activePageTab === 'marketing' ? 'active' : ''}`}
                    onClick={() => setActivePageTab('marketing')}
                >
                    <Icons.Tag size={16} />
                    Marketing (Coupons)
                </button>
            </div>

            {activePageTab === 'directory' ? (
                <>
                    {/* Tier Configuration Strip */}
                    <div className="tier-strip">
                        <div className="tier-strip-header">
                            <span className="tier-strip-title">Tier Configuration & Default Auto-Discounts</span>
                        </div>
                        <div className="tier-strip-grid">
                            <div className="tier-strip-card">
                                <div className="tier-strip-card-top">
                                    <span className="tier-badge tier-a">Tier A</span>
                                    <button className="tier-card-settings-btn" onClick={() => openEditTier('A')} title="Edit Tier A Discount">
                                        <Icons.Settings size={14} />
                                    </button>
                                </div>
                                <span className="tier-strip-value">{settings.tier_a_discount}%</span>
                                <span className="tier-strip-desc">Default discount applied automatically at checkout</span>
                            </div>
                            <div className="tier-strip-card">
                                <div className="tier-strip-card-top">
                                    <span className="tier-badge tier-b">Tier B</span>
                                    <button className="tier-card-settings-btn" onClick={() => openEditTier('B')} title="Edit Tier B Discount">
                                        <Icons.Settings size={14} />
                                    </button>
                                </div>
                                <span className="tier-strip-value">{settings.tier_b_discount}%</span>
                                <span className="tier-strip-desc">Default discount applied automatically at checkout</span>
                            </div>
                            <div className="tier-strip-card">
                                <div className="tier-strip-card-top">
                                    <span className="tier-badge tier-c">Tier C</span>
                                    <button className="tier-card-settings-btn" onClick={() => openEditTier('C')} title="Edit Tier C Discount">
                                        <Icons.Settings size={14} />
                                    </button>
                                </div>
                                <span className="tier-strip-value">{settings.tier_c_discount}%</span>
                                <span className="tier-strip-desc">Default discount applied automatically at checkout</span>
                            </div>
                        </div>
                    </div>

                    <div className="page-toolbar">
                        <div className="search-bar">
                            <Icons.Search />
                            <input placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div className="page-toolbar-actions">
                            <CustomSelect 
                                value={filterCredit}
                                onChange={setFilterCredit}
                                options={[
                                    { value: 'All', label: 'All Customers' },
                                    { value: 'With P-Credit', label: 'Has P-Credit' },
                                    { value: 'Without P-Credit', label: 'No P-Credit' }
                                ]}
                                className="min-w-[160px]"
                            />
                            <CustomSelect 
                                value={sortBy}
                                onChange={setSortBy}
                                options={[
                                    { value: 'Newest First', label: 'Newest First' },
                                    { value: 'Oldest First', label: 'Oldest First' },
                                    { value: 'Name A-Z', label: 'Name A-Z' },
                                    { value: 'Name Z-A', label: 'Name Z-A' },
                                    { value: 'Highest Credit', label: 'Highest P-Credit' }
                                ]}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="customers-table-wrap card">
                            <div className="loading">Loading customers…</div>
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="empty-state-premium">
                            <div className="empty-icon-wrapper">
                                <Icons.Users size={40} />
                            </div>
                            <h3>No Customers Found</h3>
                            <p>Add your customers to track their purchases and credits.</p>
                            <SButton variant="primary" onClick={openAdd} aria-label="Add customer">
                                Add Customer
                            </SButton>
                        </div>
                    ) : filteredAndSortedCustomers.length === 0 ? (
                        <div className="customers-table-wrap card">
                            <div className="empty-state">
                                <Icons.UserX size={32} />
                                <p>No customers matching your search or filters</p>
                            </div>
                        </div>
                    ) : (
                        <div className="customers-table-wrap card">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Phone</th>
                                        <th>Tier</th>
                                        <th>Credit Limit</th>
                                        <th>P-Credit Balance</th>
                                        <th>GSTIN</th>
                                        <th>Address</th>
                                        <th>Joined</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedCustomers.map(c => {
                                        const isNegativeCredit = Number(c.p_credit_balance || 0) < 0;
                                        return (
                                            <tr key={c.id}>
                                                <td className="fw-600">{c.name}</td>
                                                <td className="text-secondary">{c.phone || '—'}</td>
                                                <td>
                                                    <span className={`tier-badge tier-${(c.tier || 'C').toLowerCase()}`}>
                                                        Tier {c.tier || 'C'}
                                                    </span>
                                                </td>
                                                <td className="text-secondary">₹{Number(c.credit_limit || 0).toLocaleString('en-IN')}</td>
                                                <td className="fw-600" style={{ color: isNegativeCredit ? 'var(--danger)' : 'inherit' }}>
                                                    ₹{Number(c.p_credit_balance || 0).toLocaleString('en-IN')}
                                                </td>
                                                <td className="text-secondary">{c.gstin || 'Not Provided'}</td>
                                                <td className="text-secondary">{c.address || '—'}</td>
                                                <td className="text-secondary">{formatDate(c.created_at)}</td>
                                                <td className="text-right">
                                                    <div className="customer-actions">
                                                        <SButton variant="secondary" size="small" onClick={() => viewHistory(c)} title="Details & CRM History">
                                                            Activity
                                                        </SButton>
                                                        <SButton variant="secondary" size="small" onClick={() => openEdit(c)} title="Edit">
                                                            Edit
                                                        </SButton>
                                                        <SButton variant="secondary" size="small" onClick={() => setDeleteId(c.id)} title="Delete" style={{ color: 'var(--danger)' }}>
                                                            Delete
                                                        </SButton>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {totalPages > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-light)', marginTop: 8 }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredAndSortedCustomers.length)} of {filteredAndSortedCustomers.length}
                                    </span>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <SButton variant="secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                                            Prev
                                        </SButton>
                                        <SButton variant="secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                                            Next
                                        </SButton>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                /* Marketing Tab */
                <div className="coupons-section flex-column gap-20">
                    <div style={{ 
                        display: 'flex', 
                        gap: '4px', 
                        background: 'rgba(0, 0, 0, 0.03)', 
                        padding: '4px', 
                        borderRadius: '10px', 
                        width: 'fit-content', 
                        marginBottom: '16px',
                        border: '1px solid var(--border-light)'
                    }}>
                        <button 
                            className={`crm-tab-btn ${marketingSubTab === 'coupons' ? 'active' : ''}`}
                            onClick={() => setMarketingSubTab('coupons')}
                            style={{ 
                                background: marketingSubTab === 'coupons' ? '#fff' : 'none', 
                                border: 'none', 
                                padding: '8px 20px', 
                                fontWeight: 600, 
                                cursor: 'pointer', 
                                borderRadius: '8px',
                                boxShadow: marketingSubTab === 'coupons' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                color: marketingSubTab === 'coupons' ? 'var(--accent)' : 'var(--text-secondary)',
                                transition: 'all 0.2s ease',
                                borderBottom: 'none'
                            }}
                        >
                            Coupons
                        </button>
                        <button 
                            className={`crm-tab-btn ${marketingSubTab === 'campaigns' ? 'active' : ''}`}
                            onClick={() => setMarketingSubTab('campaigns')}
                            style={{ 
                                background: marketingSubTab === 'campaigns' ? '#fff' : 'none', 
                                border: 'none', 
                                padding: '8px 20px', 
                                fontWeight: 600, 
                                cursor: 'pointer', 
                                borderRadius: '8px',
                                boxShadow: marketingSubTab === 'campaigns' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                color: marketingSubTab === 'campaigns' ? 'var(--accent)' : 'var(--text-secondary)',
                                transition: 'all 0.2s ease',
                                borderBottom: 'none'
                            }}
                        >
                            Email Campaigns
                        </button>
                    </div>

                    {marketingSubTab === 'coupons' ? (
                        <div className="flex-column gap-20">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Discount Coupons</h4>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Create promo codes and discount vouchers for your marketing campaigns.</p>
                                </div>
                                <SButton variant="primary" onClick={openCreateCouponModal}>
                                    Create Coupon
                                </SButton>
                            </div>
                            {loadingCoupons ? (
                                <div className="customers-table-wrap card">
                                    <div className="loading">Loading coupons…</div>
                                </div>
                            ) : coupons.length === 0 ? (
                                <div className="empty-state-premium">
                                    <div className="empty-icon-wrapper">
                                        <Icons.Tag size={40} />
                                    </div>
                                    <h3>No Coupons Found</h3>
                                    <p>Create promo codes and discount vouchers for your marketing campaigns.</p>
                                    <SButton variant="primary" onClick={openCreateCouponModal}>
                                        Create Coupon
                                    </SButton>
                                </div>
                            ) : (
                                <div className="customers-table-wrap card">
                                    <table className="premium-table">
                                        <thead>
                                            <tr>
                                                <th>Code</th>
                                                <th>Type</th>
                                                <th>Benefit</th>
                                                <th>Expiry Date</th>
                                                <th>Limit</th>
                                                <th>Uses</th>
                                                <th className="text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {coupons.map(c => {
                                                const isExpired = c.expiry_date && new Date(c.expiry_date) < new Date(new Date().toISOString().slice(0, 10));
                                                const isLimitReached = c.usage_limit_type === 'custom' && c.times_used >= c.usage_limit;
                                                
                                                return (
                                                    <tr key={c.id}>
                                                        <td className="fw-600">
                                                            <span style={{ 
                                                                background: 'var(--accent-light)', 
                                                                color: 'var(--accent)', 
                                                                padding: '4px 8px', 
                                                                borderRadius: '4px', 
                                                                fontFamily: 'monospace', 
                                                                fontWeight: 'bold',
                                                                letterSpacing: '0.5px' 
                                                            }}>
                                                                {c.code}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span style={{ textTransform: 'capitalize', fontWeight: '600', fontSize: '12.5px' }}>
                                                                {c.type === 'discount' ? 'Discount (%)' : c.type === 'currency' ? 'Currency (Flat)' : 'Product Reward'}
                                                            </span>
                                                        </td>
                                                        <td className="fw-600">
                                                            {c.type === 'discount' 
                                                                ? `${c.value}% Off` 
                                                                : c.type === 'currency' 
                                                                    ? `₹${c.value.toLocaleString('en-IN')}` 
                                                                    : (typeof c.value === 'string' && c.value.trim().startsWith('['))
                                                                        ? `Free: ${c.product_name || 'Reward items'}`
                                                                        : `Free: ${c.product_name || 'Product ID #' + c.value} (x${c.reward_quantity || 1})`
                                                            }
                                                        </td>
                                                        <td>
                                                            {c.expiry_date ? (
                                                                <span style={{ color: isExpired ? 'var(--danger)' : 'inherit', fontWeight: isExpired ? '600' : 'normal' }}>
                                                                    {c.expiry_date} {isExpired && ' (Expired)'}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: 'var(--text-tertiary)' }}>No Expiry</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {c.usage_limit_type === 'custom' ? (
                                                                <span style={{ color: isLimitReached ? 'var(--danger)' : 'inherit', fontWeight: isLimitReached ? '600' : 'normal' }}>
                                                                    Max {c.usage_limit} uses {isLimitReached && ' (Limit reached)'}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: 'var(--text-tertiary)' }}>Unlimited</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <span className="fw-600">{c.times_used}</span>
                                                        </td>
                                                        <td className="text-right">
                                                            <SButton variant="secondary" size="small" onClick={() => handleDeleteCoupon(c.id)} title="Delete Coupon" style={{ color: 'var(--danger)' }}>
                                                                Delete
                                                            </SButton>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-column gap-20">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Scheduled Campaigns</h4>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Automate sending newsletters, confirmations, and feedback requests to customers.</p>
                                </div>
                                <SButton variant="primary" onClick={() => setShowCampaignModal(true)}>
                                    Schedule Campaign
                                </SButton>
                            </div>

                            {loadingCampaigns ? (
                                <div className="customers-table-wrap card">
                                    <div className="loading">Loading campaigns…</div>
                                </div>
                            ) : campaigns.length === 0 ? (
                                <div className="empty-state-premium">
                                    <div className="empty-icon-wrapper">
                                        <Icons.Mail size={40} />
                                    </div>
                                    <h3>No Campaigns Found</h3>
                                    <p>Schedule your first email campaign to engage with your customers.</p>
                                    <SButton variant="primary" onClick={() => setShowCampaignModal(true)}>
                                        Schedule Campaign
                                    </SButton>
                                </div>
                            ) : (
                                <div className="customers-table-wrap card">
                                    <table className="premium-table">
                                        <thead>
                                            <tr>
                                                <th>Campaign Name</th>
                                                <th>Template</th>
                                                <th>Customers</th>
                                                <th>Start Date</th>
                                                <th>Send Time</th>
                                                <th>Status</th>
                                                <th className="text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {campaigns.map(camp => (
                                                <tr key={camp.id}>
                                                    <td className="fw-600">{camp.name}</td>
                                                    <td>
                                                        <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>
                                                            {camp.template.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td>{camp.customers?.length || 0} selected</td>
                                                    <td>{camp.start_date}</td>
                                                    <td>{camp.time_to_send}</td>
                                                    <td>
                                                        <span className={`status-badge ${camp.status}`} style={{
                                                            fontSize: '11px',
                                                            padding: '2px 8px',
                                                            borderRadius: '999px',
                                                            fontWeight: '600',
                                                            background: camp.status === 'completed' ? 'rgba(52, 199, 89, 0.1)' : camp.status === 'scheduled' ? 'rgba(0, 113, 227, 0.1)' : 'rgba(255, 149, 0, 0.1)',
                                                            color: camp.status === 'completed' ? 'var(--success)' : camp.status === 'scheduled' ? 'var(--accent)' : '#d07c00'
                                                        }}>
                                                            {camp.status}
                                                        </span>
                                                    </td>
                                                    <td className="text-right">
                                                        {camp.status === 'scheduled' && (
                                                            <SButton variant="secondary" size="small" onClick={() => handleCancelCampaign(camp.id)} style={{ color: 'var(--danger)' }}>
                                                                Cancel
                                                            </SButton>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Save/Add Customer Modal */}
            <Modal 
                open={showModal} 
                onClose={() => setShowModal(false)} 
                heading={editingCustomer ? 'Edit Customer' : 'Add Customer'}
                size="base"
                primaryAction={
                    <SButton variant="primary" onClick={handleSave} loading={saving} disabled={saving}>
                        {editingCustomer ? 'Update Details' : 'Save Customer'}
                    </SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setShowModal(false)}>Cancel</SButton>
                }
            >
                <div className="flex-column gap-16">
                    <FormGroup label="Customer Name" required>
                        <Input 
                            value={form.name} 
                            onChange={e => setForm({ ...form, name: e.target.value })} 
                            placeholder="e.g. John Doe" 
                            autoFocus 
                        />
                    </FormGroup>
                    <div className="grid-2 gap-16">
                        <FormGroup label="Phone Number">
                            <Input 
                                value={form.phone} 
                                onChange={e => setForm({ ...form, phone: e.target.value })} 
                                placeholder="e.g. +91 98765 43210" 
                            />
                        </FormGroup>
                        <FormGroup label="Email Address">
                            <Input 
                                type="email"
                                value={form.email} 
                                onChange={e => setForm({ ...form, email: e.target.value })} 
                                placeholder="e.g. john@example.com" 
                            />
                        </FormGroup>
                    </div>
                    <div className="grid-2 gap-16">
                        <FormGroup label="Customer Tier">
                            <CustomSelect 
                                value={form.tier} 
                                onChange={value => setForm({ ...form, tier: value })} 
                                options={[
                                    { value: 'A', label: 'Tier A' },
                                    { value: 'B', label: 'Tier B' },
                                    { value: 'C', label: 'Tier C' }
                                ]}
                            />
                        </FormGroup>
                        <FormGroup label="Credit Limit (₹)">
                            <Input 
                                type="number"
                                min="0"
                                step="any"
                                value={form.credit_limit} 
                                onChange={e => setForm({ ...form, credit_limit: e.target.value === '' ? '' : Number(e.target.value) })} 
                                placeholder="e.g. 5000" 
                            />
                        </FormGroup>
                    </div>
                    <FormGroup label="GST Number (Optional)">
                        <Input 
                            value={form.gstin} 
                            onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })} 
                            placeholder="e.g. 07AAAAA0000A1Z5" 
                        />
                    </FormGroup>
                    <FormGroup label="Residential/Business Address">
                        <textarea 
                            rows={3} 
                            value={form.address} 
                            onChange={e => setForm({ ...form, address: e.target.value })} 
                            placeholder="Enter full address..." 
                            className="form-control"
                        />
                    </FormGroup>
                </div>
            </Modal>

            {/* Delete Customer Modal */}
            <Modal
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                heading="Delete Customer"
                size="small"
                variant="critical"
                primaryAction={
                    <SButton variant="primary" tone="critical" onClick={handleDelete}>Delete Permanently</SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setDeleteId(null)}>Cancel</SButton>
                }
            >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ color: 'var(--danger)', marginTop: '2px' }}>
                        <Icons.AlertCircle size={20} />
                    </div>
                    <div>
                        <p style={{ fontWeight: 600, marginBottom: '4px' }}>Are you absolutely sure?</p>
                        <p className="text-secondary" style={{ fontSize: '13px' }}>
                            This action will permanently remove the customer and all associated local records. This cannot be undone.
                        </p>
                    </div>
                </div>
            </Modal>

            {/* Manage Tier Settings Modal */}
            <Modal
                open={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                heading={`Manage Tier ${editingTier} Discount`}
                size="small"
                primaryAction={
                    <SButton variant="primary" onClick={handleSaveTierDiscount} loading={savingSettings} disabled={savingSettings}>
                        Save Changes
                    </SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setShowSettingsModal(false)}>Cancel</SButton>
                }
            >
                <div className="flex-column gap-16">
                    <FormGroup label="Default Discount Percentage (%)" required>
                        <Input 
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={editingTierDiscount} 
                            onChange={e => setEditingTierDiscount(e.target.value)} 
                            placeholder="e.g. 10" 
                            autoFocus 
                        />
                    </FormGroup>
                    <p className="text-secondary" style={{ fontSize: '12.5px', lineHeight: 1.4 }}>
                        This discount rate will be automatically applied at checkout when a customer of Tier {editingTier} is selected at the sales point.
                    </p>
                </div>
            </Modal>

            {/* Customer Details & History Tabbed Modal */}
            <Modal
                id="customer-history-modal"
                open={!!historyCustomer}
                onClose={() => setHistoryCustomer(null)}
                heading={`Customer Details — ${historyCustomer?.name}`}
                size="large"
                secondaryActions={
                    <SButton onClick={() => setHistoryCustomer(null)}>Close</SButton>
                }
            >
                <div>
                    <div className="crm-modal-tabs">
                        <button 
                            className={`crm-tab-btn ${activeTab === 'purchases' ? 'active' : ''}`}
                            onClick={() => setActiveTab('purchases')}
                        >
                            <Icons.ShoppingCart size={16} />
                            Purchase History
                        </button>
                        <button 
                            className={`crm-tab-btn ${activeTab === 'communication' ? 'active' : ''}`}
                            onClick={() => setActiveTab('communication')}
                        >
                            <Icons.MessageSquare size={16} />
                            Communication Logs
                        </button>
                    </div>

                    {activeTab === 'purchases' ? (
                        <div className="card" style={{ border: 'none', boxShadow: 'none', padding: 0 }}>
                            {purchases.length === 0 ? (
                                <div className="empty-state">
                                    <Icons.ShoppingCart size={32} />
                                    <p>No purchase history found</p>
                                </div>
                            ) : (
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Invoice #</th>
                                            <th>Items</th>
                                            <th className="text-right">Total</th>
                                            <th className="text-right">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {purchases.map(inv => (
                                            <tr key={inv.id}>
                                                <td className="fw-600">INV-{String(inv.id).padStart(4, '0')}</td>
                                                <td className="text-secondary">{inv.items?.length || 0} Products</td>
                                                <td className="fw-600 text-right">₹{Number(inv.total).toLocaleString('en-IN')}</td>
                                                <td className="text-secondary text-right">{formatDate(inv.date)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ) : (
                        <div>
                            {/* Log new activity form */}
                            <div className="log-activity-form">
                                <h4>Log Customer Interaction</h4>
                                <div className="log-activity-row">
                                    <div className="log-activity-type">
                                        <CustomSelect 
                                            value={logForm.type}
                                            onChange={type => setLogForm({ ...logForm, type })}
                                            options={[
                                                { value: 'Call', label: <span className="select-icon-label"><Icons.Phone size={14} /> Call</span> },
                                                { value: 'Email', label: <span className="select-icon-label"><Icons.Mail size={14} /> Email</span> },
                                                { value: 'SMS', label: <span className="select-icon-label"><Icons.MessageSquare size={14} /> SMS</span> },
                                                { value: 'Meeting', label: <span className="select-icon-label"><Icons.Users size={14} /> Meeting</span> },
                                                { value: 'Other', label: <span className="select-icon-label"><Icons.Info size={14} /> Other</span> }
                                            ]}
                                        />
                                    </div>
                                    <div className="log-activity-notes">
                                        <Input 
                                            value={logForm.notes}
                                            onChange={e => setLogForm({ ...logForm, notes: e.target.value })}
                                            placeholder="Type interaction notes (e.g. 'Discussed credit terms and catalog')..."
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleAddLog();
                                            }}
                                        />
                                    </div>
                                    <SButton variant="primary" onClick={handleAddLog} loading={savingLog} disabled={savingLog}>
                                        Log
                                    </SButton>
                                </div>
                            </div>

                            {/* Timeline list */}
                            <div className="communications-timeline">
                                {loadingLogs ? (
                                    <div className="loading" style={{ padding: 20 }}>Loading history…</div>
                                ) : logs.length === 0 ? (
                                    <div className="empty-state">
                                        <Icons.MessageSquare size={32} />
                                        <p>No communication logs found. Record a call or email above to begin tracking.</p>
                                    </div>
                                ) : (
                                    <div className="timeline-items">
                                        {logs.map(log => {
                                            let typeIcon = <Icons.Info size={16} />;
                                            let badgeClass = 'timeline-badge-other';
                                            if (log.type === 'Call') {
                                                typeIcon = <Icons.Phone size={16} />;
                                                badgeClass = 'timeline-badge-call';
                                            } else if (log.type === 'Email') {
                                                typeIcon = <Icons.Mail size={16} />;
                                                badgeClass = 'timeline-badge-email';
                                            } else if (log.type === 'SMS') {
                                                typeIcon = <Icons.MessageSquare size={16} />;
                                                badgeClass = 'timeline-badge-sms';
                                            } else if (log.type === 'Meeting') {
                                                typeIcon = <Icons.Users size={16} />;
                                                badgeClass = 'timeline-badge-meeting';
                                            }
                                            return (
                                                <div className={`timeline-item timeline-item-${log.type.toLowerCase()}`} key={log.id}>
                                                    <div className={`timeline-badge ${badgeClass}`}>
                                                        {typeIcon}
                                                    </div>
                                                    <div className="timeline-body">
                                                        <div className="timeline-header">
                                                            <span className="log-type-tag">{log.type}</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                <span className="log-date">{formatDate(log.date)}</span>
                                                                <button 
                                                                    className="delete-log-btn"
                                                                    onClick={() => handleDeleteLog(log.id)}
                                                                    title="Delete log"
                                                                >
                                                                    <Icons.Delete size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="timeline-notes">
                                                            {log.notes}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Create Coupon Modal */}
            <Modal
                open={showCouponModal}
                onClose={() => setShowCouponModal(false)}
                heading="Create Coupon"
                size="base"
                primaryAction={
                    <SButton variant="primary" onClick={handleSaveCoupon} loading={savingCoupon} disabled={savingCoupon}>
                        Save Coupon
                    </SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setShowCouponModal(false)}>Cancel</SButton>
                }
            >
                <div className="flex-column gap-16">
                    <FormGroup label="Coupon Code" required>
                        <Input
                            value={couponForm.code}
                            onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                            placeholder="e.g. SAVE20, WELCOME500"
                            autoFocus
                        />
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Alphanumeric characters only, automatically capitalized.</p>
                    </FormGroup>
                    
                    <div className="grid-2 gap-16">
                        <FormGroup label="Coupon Type">
                            <CustomSelect
                                value={couponForm.type}
                                onChange={type => setCouponForm({ ...couponForm, type, value: '' })}
                                options={[
                                    { value: 'discount', label: 'Percentage Discount' },
                                    { value: 'currency', label: 'Flat Currency Discount' },
                                    { value: 'product', label: 'Free Product Reward' }
                                ]}
                            />
                        </FormGroup>
                        
                        {couponForm.type === 'product' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px', background: 'var(--bg-secondary)', gridColumn: 'span 2' }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Inventory Catalog Selector</div>
                                
                                {/* Filter Row */}
                                <div className="grid-4 gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
                                    <FormGroup label="Search">
                                        <input 
                                            type="text" 
                                            placeholder="Search name/code..." 
                                            value={catalogSearch} 
                                            onChange={e => setCatalogSearch(e.target.value)}
                                            style={{ height: '32px', fontSize: '12px', width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: '4px', padding: '0 8px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                        />
                                    </FormGroup>
                                    <FormGroup label="Category">
                                        <CustomSelect 
                                            value={catalogCategory} 
                                            onChange={setCatalogCategory}
                                            options={productCategories.map(c => ({ value: c, label: c }))}
                                            style={{ height: '32px' }}
                                        />
                                    </FormGroup>
                                    <FormGroup label="Subcategory">
                                        <CustomSelect 
                                            value={catalogSubcategory} 
                                            onChange={setCatalogSubcategory}
                                            options={productSubcategories.map(s => ({ value: s, label: s }))}
                                            style={{ height: '32px' }}
                                        />
                                    </FormGroup>
                                    <FormGroup label="Brand">
                                        <CustomSelect 
                                            value={catalogBrand} 
                                            onChange={setCatalogBrand}
                                            options={productBrands.map(b => ({ value: b, label: b }))}
                                            style={{ height: '32px' }}
                                        />
                                    </FormGroup>
                                </div>

                                {/* Catalog Scroll Area */}
                                <div style={{ height: '160px', overflowY: 'auto', border: '1px solid var(--border-strong)', borderRadius: '6px', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
                                    {filteredCatalogProducts.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                                            No matching products found.
                                        </div>
                                    ) : (
                                        filteredCatalogProducts.map(p => {
                                            const isSelected = selectedProducts.some(sp => sp.id === p.id);
                                            return (
                                                <div 
                                                    key={p.id}
                                                    onClick={() => {
                                                        setSelectedProducts(prev => {
                                                            const isSel = prev.some(sp => sp.id === p.id);
                                                            if (isSel) {
                                                                return prev.filter(sp => sp.id !== p.id);
                                                            } else {
                                                                return [...prev, { id: p.id, name: p.name, qty: 1 }];
                                                            }
                                                        });
                                                    }}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '8px 12px',
                                                        borderBottom: '1px solid var(--border-light)',
                                                        cursor: 'pointer',
                                                        background: isSelected ? 'var(--accent-light)' : 'transparent',
                                                        transition: 'background 0.15s ease'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span style={{ fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--accent)' : 'var(--text-primary)', fontSize: '13px' }}>
                                                            {p.name}
                                                        </span>
                                                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                                            {p.brand_name || 'Generic'} • {p.subcategory_name || 'General'} • Code: {p.product_code || '—'}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                                            ₹{Number(p.selling_price || 0).toFixed(2)}
                                                        </span>
                                                        {isSelected && (
                                                            <Icons.CheckCircle size={14} style={{ color: 'var(--accent)' }} />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Selected Products Tags container */}
                                {selectedProducts.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '10px', marginTop: '4px' }}>
                                        {selectedProducts.map(sp => (
                                            <div 
                                                key={sp.id} 
                                                style={{ 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    gap: '6px', 
                                                    background: 'var(--accent-light)', 
                                                    border: '1px solid var(--accent)', 
                                                    color: 'var(--accent)', 
                                                    padding: '4px 8px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '12px', 
                                                    fontWeight: '600' 
                                                }}
                                            >
                                                <span>{sp.name}</span>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>qty:</span>
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        value={sp.qty} 
                                                        onChange={e => {
                                                            const val = Math.max(1, Math.floor(Number(e.target.value || 1)));
                                                            setSelectedProducts(prev => prev.map(p => p.id === sp.id ? { ...p, qty: val } : p));
                                                        }}
                                                        onClick={e => e.stopPropagation()} // Prevent list toggle
                                                        style={{ 
                                                            width: '45px', 
                                                            height: '22px',
                                                            border: '1px solid var(--border-strong)', 
                                                            borderRadius: '4px', 
                                                            padding: '0 4px', 
                                                            fontSize: '11px', 
                                                            textAlign: 'center', 
                                                            background: 'var(--bg-primary)', 
                                                            color: 'var(--text-primary)' 
                                                        }} 
                                                    />
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent list toggle
                                                        setSelectedProducts(prev => prev.filter(p => p.id !== sp.id));
                                                    }}
                                                    style={{ 
                                                        background: 'none', 
                                                        border: 'none', 
                                                        color: 'var(--accent)', 
                                                        cursor: 'pointer', 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        padding: 0,
                                                        marginLeft: '4px'
                                                    }}
                                                >
                                                    <Icons.X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', borderTop: '1px solid var(--border-light)', paddingTop: '10px', marginTop: '4px' }}>
                                        No products selected yet. Click on products above to select them.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <FormGroup label={couponForm.type === 'discount' ? "Discount Percentage (%)" : "Flat Amount (₹)"} required>
                                <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={couponForm.value}
                                    onChange={e => setCouponForm({ ...couponForm, value: e.target.value })}
                                    placeholder={couponForm.type === 'discount' ? "e.g. 15" : "e.g. 250"}
                                />
                            </FormGroup>
                        )}
                    </div>

                    <div className="grid-2 gap-16">
                        <FormGroup label="Expiry Date (Optional)">
                            <Input
                                type="date"
                                value={couponForm.expiry_date}
                                onChange={e => setCouponForm({ ...couponForm, expiry_date: e.target.value })}
                            />
                        </FormGroup>
                        
                        <FormGroup label="Usage Limit">
                            <CustomSelect
                                value={couponForm.usage_limit_type}
                                onChange={usage_limit_type => setCouponForm({ ...couponForm, usage_limit_type, usage_limit: usage_limit_type === 'custom' ? '1' : '' })}
                                options={[
                                    { value: 'unlimited', label: 'Unlimited Uses' },
                                    { value: 'custom', label: 'Custom Limit' }
                                ]}
                            />
                        </FormGroup>
                    </div>

                    {couponForm.usage_limit_type === 'custom' && (
                        <FormGroup label="Max Number of Uses" required>
                            <Input
                                type="number"
                                min="1"
                                value={couponForm.usage_limit}
                                onChange={e => setCouponForm({ ...couponForm, usage_limit: e.target.value })}
                                placeholder="e.g. 100"
                            />
                        </FormGroup>
                    )}
                </div>
            </Modal>

            {/* Schedule Campaign Modal */}
            <Modal
                open={showCampaignModal}
                onClose={() => setShowCampaignModal(false)}
                heading="Schedule Email Campaign"
                size="base"
                primaryAction={
                    <SButton variant="primary" onClick={handleSaveCampaign} loading={savingCampaign} disabled={savingCampaign}>
                        Schedule Campaign
                    </SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setShowCampaignModal(false)}>Cancel</SButton>
                }
            >
                <div className="flex-column gap-16">
                    <FormGroup label="Campaign Name" required>
                        <Input
                            value={campaignForm.name}
                            onChange={e => setCampaignForm({ ...campaignForm, name: e.target.value })}
                            placeholder="e.g. Summer Discount Blast"
                            autoFocus
                        />
                    </FormGroup>

                    <div className="grid-2 gap-16">
                        <FormGroup label="Template Selection" required>
                            <CustomSelect
                                value={campaignForm.template}
                                onChange={template => setCampaignForm({ ...campaignForm, template })}
                                options={[
                                    { value: 'order_confirmation', label: 'Order Confirmation' },
                                    { value: 'feedback', label: 'Customer Feedback Request' },
                                    { value: 'invoice_email', label: 'General Marketing Newsletter' }
                                ]}
                            />
                        </FormGroup>

                        <FormGroup label="Time to Send" required>
                            <Input
                                type="time"
                                value={campaignForm.timeToSend}
                                onChange={e => setCampaignForm({ ...campaignForm, timeToSend: e.target.value })}
                            />
                        </FormGroup>
                    </div>

                    <FormGroup label="Start Date" required>
                        <Input
                            type="date"
                            value={campaignForm.startDate}
                            onChange={e => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
                        />
                    </FormGroup>

                    <FormGroup label="Select Recipients (Customers)" required>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Selected: {campaignForm.customers.length} of {customers.filter(c => c.email).length}
                                </span>
                                <button 
                                    type="button"
                                    onClick={() => {
                                        const totalWithEmail = customers.filter(c => c.email).length;
                                        const hasAll = campaignForm.customers.length === totalWithEmail;
                                        setCampaignForm({
                                            ...campaignForm,
                                            customers: hasAll ? [] : customers.filter(c => c.email).map(c => c.id)
                                        });
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--accent)',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        padding: 0
                                    }}
                                >
                                    {campaignForm.customers.length === customers.filter(c => c.email).length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <Input
                                    placeholder="Search customers by name or email..."
                                    value={campaignSearch}
                                    onChange={e => setCampaignSearch(e.target.value)}
                                    style={{ paddingLeft: '36px' }}
                                />
                                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                                    <Icons.Search size={16} />
                                </div>
                            </div>
                        </div>

                        <div style={{ 
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                            gap: '8px',
                            maxHeight: '200px', 
                            overflowY: 'auto', 
                            border: '1px solid var(--border)', 
                            borderRadius: '10px', 
                            padding: '12px',
                            background: '#f8fafc'
                        }}>
                            {(() => {
                                const filtered = customers.filter(c => {
                                    if (!campaignSearch) return true;
                                    const query = campaignSearch.toLowerCase();
                                    return c.name.toLowerCase().includes(query) || (c.email && c.email.toLowerCase().includes(query));
                                });
                                if (filtered.length === 0) {
                                    return (
                                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                            No customers found matching "{campaignSearch}"
                                        </div>
                                    );
                                }
                                return filtered.map(c => {
                                    const hasEmail = !!c.email;
                                    const isChecked = campaignForm.customers.includes(c.id);
                                    return (
                                        <div
                                            key={c.id}
                                            onClick={() => {
                                                if (!hasEmail) return;
                                                if (isChecked) {
                                                    setCampaignForm({
                                                        ...campaignForm,
                                                        customers: campaignForm.customers.filter(id => id !== c.id)
                                                    });
                                                } else {
                                                    setCampaignForm({
                                                        ...campaignForm,
                                                        customers: [...campaignForm.customers, c.id]
                                                    });
                                                }
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '8px 10px',
                                                borderRadius: '8px',
                                                border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border)',
                                                background: !hasEmail ? '#f1f5f9' : isChecked ? 'rgba(10, 110, 255, 0.05)' : '#fff',
                                                cursor: hasEmail ? 'pointer' : 'not-allowed',
                                                opacity: hasEmail ? 1 : 0.6,
                                                transition: 'all 0.15s ease',
                                                userSelect: 'none'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                disabled={!hasEmail}
                                                checked={isChecked}
                                                readOnly
                                                style={{ cursor: hasEmail ? 'pointer' : 'not-allowed', accentColor: 'var(--accent)' }}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                                <span style={{ fontWeight: 600, fontSize: '12.5px', color: isChecked ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {c.name}
                                                </span>
                                                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {hasEmail ? c.email : 'No email address'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </FormGroup>
                </div>
            </Modal>
        </div>
    );
}
