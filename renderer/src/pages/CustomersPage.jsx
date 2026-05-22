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

    return (
        <div className="customers-page">
            <div className="page-header">
                <div>
                    <h1>Customers</h1>
                    <p className="text-secondary">Manage customer profiles, contact directories, and credits</p>
                </div>
                <SButton variant="primary" onClick={openAdd} aria-label="Add customer">
                    Add Customer
                </SButton>
            </div>

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

            <div className="customers-table-wrap card">
                {loading ? (
                    <div className="loading">Loading customers…</div>
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
                    <div className="empty-state">
                        <Icons.UserX size={32} />
                        <p>No customers matching your search or filters</p>
                    </div>
                ) : (
                    <>
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
                    </>
                )}
            </div>

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
                    <SButton variant="critical" onClick={handleDelete}>Delete Permanently</SButton>
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
                                    <div className="empty-state" style={{ padding: 20 }}>
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
                                                <div className="timeline-item" key={log.id}>
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
        </div>
    );
}
