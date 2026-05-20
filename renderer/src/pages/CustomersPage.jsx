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

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [form, setForm] = useState(EMPTY_CUSTOMER);
    const [saving, setSaving] = useState(false);

    // M020: Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 50;

    // Delete
    const [deleteId, setDeleteId] = useState(null);

    // Purchase history
    const [historyCustomer, setHistoryCustomer] = useState(null);
    const [purchases, setPurchases] = useState([]);

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
    }, [loadCustomers]);

    function openAdd() {
        setEditingCustomer(null);
        setForm(EMPTY_CUSTOMER);
        setShowModal(true);
    }

    function openEdit(customer) {
        setEditingCustomer(customer);
        setForm({ name: customer.name, phone: customer.phone, email: customer.email || '', address: customer.address, gstin: customer.gstin || '' });
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
            gstin: form.gstin.trim()
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

    async function viewHistory(customer) {
        setHistoryCustomer(customer);
        try {
            const data = await api.getCustomerPurchases(customer.id);
            setPurchases(data);
        } catch (err) {
            console.error(err);
            setPurchases([]);
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
                                <th>GSTIN</th>
                                <th>Address</th>
                                <th>Joined</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedCustomers.map(c => (
                                <tr key={c.id}>
                                    <td className="fw-600">{c.name}</td>
                                    <td className="text-secondary">{c.phone || '—'}</td>
                                    <td className="text-secondary">{c.gstin || 'Not Provided'}</td>
                                    <td className="text-secondary">{c.address || '—'}</td>
                                    <td className="text-secondary">{formatDate(c.created_at)}</td>
                                    <td className="text-right">
                                        <div className="customer-actions">
                                            <SButton variant="secondary" size="small" onClick={() => viewHistory(c)} title="Purchase History">
                                                History
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
                            ))}
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

            <Modal
                open={!!historyCustomer}
                onClose={() => setHistoryCustomer(null)}
                heading={`Purchases — ${historyCustomer?.name}`}
                size="large"
                secondaryActions={
                    <SButton onClick={() => setHistoryCustomer(null)}>Close</SButton>
                }
            >
                <div className="card" style={{ border: 'none', boxShadow: 'none' }}>
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
            </Modal>
        </div>
    );
}
