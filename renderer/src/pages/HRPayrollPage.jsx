import React, { useState, useEffect } from 'react';
import api from '../api';
import { toast } from 'sonner';
import Modal from '../components/Modal';
import SButton from '../components/SButton';
import { Icons } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import './HRPayrollPage.css';

const DEFAULT_SCOPES = {
    dashboard: 'edit',
    inventory_products: 'edit',
    inventory_transfers: 'edit',
    sales_invoices: 'edit',
    sales_pos: 'edit',
    customers: 'edit',
    purchases: 'edit',
    hr_payroll: 'edit',
    settings: 'edit'
};

const SCOPE_OPTIONS = [
    { value: 'edit', label: 'Read & Edit', icon: <Icons.Edit2 size={13} />, desc: 'Full write, update and create access' },
    { value: 'read', label: 'Read-Only', icon: <Icons.Eye size={13} />, desc: 'View records only (no editing)' },
    { value: 'hseen', label: 'Hseen (Header Summary)', icon: <Icons.Maximize size={13} />, desc: 'Header summary metrics only' },
    { value: 'unseen', label: 'Unseen (Hidden)', icon: <Icons.EyeOff size={13} />, desc: 'Completely hide module from sidebar' }
];

const MODULE_SCOPE_ITEMS = [
    { key: 'dashboard', label: 'Dashboard & Business Overview', desc: 'KPI metrics, revenue graphs, and sales summaries', icon: <Icons.LayoutDashboard size={18} /> },
    { key: 'inventory_products', label: 'Inventory (Products Directory)', desc: 'Product catalog, pricing, variants, and stock adjustments', icon: <Icons.Package size={18} /> },
    { key: 'inventory_transfers', label: 'Inventory (Stock Transfers)', desc: 'Inter-branch stock dispatch & GRN receipts', icon: <Icons.Truck size={18} /> },
    { key: 'sales_invoices', label: 'Sales (Tax Invoices & Billing)', desc: 'Historical customer invoices, credit notes, and returns', icon: <Icons.FileText size={18} /> },
    { key: 'sales_pos', label: 'Sales (Quick POS Billing Terminal)', desc: '1-second barcode billing, cash drawer & receipts', icon: <Icons.ShoppingCart size={18} /> },
    { key: 'customers', label: 'Customers & CRM Ledger', desc: 'Customer profiles, credit balances, and loyalty points', icon: <Icons.Users size={18} /> },
    { key: 'purchases', label: 'Purchases & Vendor Management', desc: 'Purchase orders, supplier bills, and landed costs', icon: <Icons.Briefcase size={18} /> },
    { key: 'hr_payroll', label: 'HR & Payroll Management', desc: 'Employee directory, attendance, PINs, and salary disbursements', icon: <Icons.Shield size={18} /> },
    { key: 'settings', label: 'System & Branch Settings', desc: 'Store profile, GSTIN, invoice templates, and pairing keys', icon: <Icons.Settings size={18} /> }
];

function QuantroScopeDropdown({ value = 'edit', onChange }) {
    const [open, setOpen] = useState(false);
    const dropdownRef = React.useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selected = SCOPE_OPTIONS.find(o => o.value === value) || SCOPE_OPTIONS[0] || { value: 'edit', label: 'Read & Edit', icon: <Icons.Edit2 size={13} />, desc: 'Full write access' };

    return (
        <div className="quantro-custom-select-container" ref={dropdownRef}>
            <button 
                type="button"
                className={`quantro-custom-select-trigger ${open ? 'open' : ''}`}
                onClick={() => setOpen(!open)}
            >
                <span className={`quantro-scope-badge ${selected.value}`}>
                    {selected.icon} {selected.label}
                </span>
                <Icons.ChevronDown size={14} className={`quantro-select-arrow ${open ? 'rotated' : ''}`} />
            </button>

            {open && (
                <div className="quantro-custom-select-menu">
                    {SCOPE_OPTIONS.map(opt => (
                        <div 
                            key={opt.value} 
                            className={`quantro-custom-select-item ${opt.value === value ? 'selected' : ''}`}
                            onClick={() => {
                                onChange(opt.value);
                                setOpen(false);
                            }}
                        >
                            <span className={`quantro-scope-badge ${opt.value}`}>
                                {opt.icon} {opt.label}
                            </span>
                            <span className="quantro-scope-desc">{opt.desc}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function HRPayrollPage() {
    const { currentUser, userRole, isOwner, activeStoreId, stores, setStores, canManageEmployees, canManagePayroll, canManageStores } = useAuth();
    const [activeTab, setActiveTab] = useState('employees'); // 'employees', 'attendance', 'payroll'

    const [showStoreModal, setShowStoreModal] = useState(false);
    const [showPairModal, setShowPairModal] = useState(false);
    const [pairKeyInput, setPairKeyInput] = useState('');
    const [newBranchForm, setNewBranchForm] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        gstin: '',
        place_of_supply: ''
    });
    const [createdPairKey, setCreatedPairKey] = useState('');
    const [employees, setEmployees] = useState([]);
    const [disbursements, setDisbursements] = useState([]);
    const [loading, setLoading] = useState(true);

    // Employee Modal State
    const [showEmpModal, setShowEmpModal] = useState(false);
    const [editingEmp, setEditingEmp] = useState(null);
    const [empForm, setEmpForm] = useState({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        pos_pin: '',
        role: 'CASHIER',
        assigned_store_ids: ['*'],
        department: 'Sales',
        designation: 'Cashier',
        base_salary: 20000,
        allowances: 2000,
        deductions: 500,
        status: 'ACTIVE',
        restrict_to_terminals: 1,
        scopes: { ...DEFAULT_SCOPES }
    });
    const [savingEmp, setSavingEmp] = useState(false);

    // Clock In/Out Modal State
    const [showClockModal, setShowClockModal] = useState(false);
    const [clockDrawer, setClockDrawer] = useState('1000');

    // Payroll Payout Modal State
    const [showPayrollModal, setShowPayrollModal] = useState(false);
    const [selectedEmpForPayroll, setSelectedEmpForPayroll] = useState(null);
    const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
    const [disbursing, setDisbursing] = useState(false);

    useEffect(() => {
        loadData();
    }, [activeStoreId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const empRes = await api.getEmployees(activeStoreId);
            if (empRes.employees) setEmployees(empRes.employees);

            const payRes = await api.getPayrollHistory();
            if (payRes.disbursements) setDisbursements(payRes.disbursements);

            const storesRes = await api.getStores();
            if (storesRes.stores) setStores(storesRes.stores);
        } catch (err) {
            console.error('[HR Page] Load error:', err);
            toast.error(err.message || 'Failed to load HR data');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreateEmp = () => {
        setEditingEmp(null);
        setEmpForm({
            full_name: '',
            email: '',
            phone: '',
            password: '',
            pos_pin: '',
            role: 'CASHIER',
            assigned_store_ids: ['*'],
            department: 'Sales',
            designation: 'Cashier',
            base_salary: 20000,
            allowances: 2000,
            deductions: 500,
            status: 'ACTIVE',
            restrict_to_terminals: 1,
            scopes: { ...DEFAULT_SCOPES, dashboard: 'read', sales_pos: 'edit', hr_payroll: 'unseen', settings: 'unseen' }
        });
        setShowEmpModal(true);
    };

    const handleOpenEditEmp = (emp) => {
        setEditingEmp(emp);

        let parsedScopes = { ...DEFAULT_SCOPES };
        if (emp && emp.scopes) {
            if (typeof emp.scopes === 'string') {
                try {
                    const obj = JSON.parse(emp.scopes);
                    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                        parsedScopes = { ...DEFAULT_SCOPES, ...obj };
                    }
                } catch (e) {}
            } else if (typeof emp.scopes === 'object' && !Array.isArray(emp.scopes)) {
                parsedScopes = { ...DEFAULT_SCOPES, ...emp.scopes };
            }
        }

        setEmpForm({
            full_name: emp.full_name || '',
            email: emp.email || '',
            phone: emp.phone || '',
            password: '',
            pos_pin: '',
            role: emp.role || 'CASHIER',
            assigned_store_ids: Array.isArray(emp.assigned_store_ids) ? emp.assigned_store_ids : ['*'],
            department: emp.department || 'Sales',
            designation: emp.designation || 'Staff',
            base_salary: emp.base_salary || 0,
            allowances: emp.allowances || 0,
            deductions: emp.deductions || 0,
            status: emp.status || 'ACTIVE',
            restrict_to_terminals: emp.restrict_to_terminals !== undefined ? Number(emp.restrict_to_terminals) : (emp.role === 'OWNER' ? 0 : 1),
            scopes: parsedScopes
        });
        setShowEmpModal(true);
    };

    const handleDeleteEmployee = async (emp) => {
        if (emp.id === 1 || emp.role === 'OWNER') {
            toast.error('Primary Owner profile cannot be deleted.');
            return;
        }
        if (!window.confirm(`Are you sure you want to permanently delete employee profile for ${emp.full_name}?`)) {
            return;
        }
        try {
            await api.deleteEmployee(emp.id);
            toast.success(`Employee ${emp.full_name} deleted successfully.`);
            loadData();
        } catch (err) {
            toast.error(err.message || 'Failed to delete employee profile');
        }
    };

    const handleSaveEmployee = async (e) => {
        e.preventDefault();
        setSavingEmp(true);
        try {
            if (editingEmp) {
                await api.updateEmployee(editingEmp.id, empForm);
                toast.success(`Employee ${empForm.full_name} updated successfully!`);
            } else {
                await api.createEmployee(empForm);
                toast.success(`Employee ${empForm.full_name} created successfully!`);
            }
            setShowEmpModal(false);
            loadData();
        } catch (err) {
            toast.error(err.message || 'Failed to save employee profile');
        } finally {
            setSavingEmp(false);
        }
    };

    const handleDisburseSalary = async (emp) => {
        setSelectedEmpForPayroll(emp);
        setShowPayrollModal(true);
    };

    const confirmDisburseSalary = async () => {
        if (!selectedEmpForPayroll) return;
        setDisbursing(true);
        try {
            await api.disbursePayroll({
                payroll_month: payrollMonth,
                employee_id: selectedEmpForPayroll.id,
                store_id: activeStoreId === '*' ? 1 : Number(activeStoreId)
            });
            toast.success(`Salary disbursed for ${selectedEmpForPayroll.full_name}!`);
            setShowPayrollModal(false);
            loadData();
        } catch (err) {
            toast.error(err.message || 'Failed to disburse salary');
        } finally {
            setDisbursing(false);
        }
    };

    const handleClockIn = async () => {
        try {
            await api.clockIn({
                employee_id: currentUser?.id || 1,
                store_id: Number(activeStoreId === '*' ? 1 : activeStoreId),
                starting_cash_drawer: Number(clockDrawer || 0)
            });
            toast.success(`Clocked IN successfully at Store ${activeStoreId}!`);
            setShowClockModal(false);
        } catch (err) {
            toast.error(err.message || 'Clock-in failed');
        }
    };

    return (
        <div className="hr-payroll-container">
            {/* Page Header */}
            <div className="hr-header-bar">
                <div>
                    <h1 className="hr-title">HR & Workforce Payroll</h1>
                    <p className="hr-subtitle">Manage staff credentials, POS clock-in attendance, roles, and monthly compensation.</p>
                </div>
                <div className="hr-header-actions">
                    <SButton variant="secondary" onClick={() => setShowClockModal(true)}>
                        <Icons.Clock size={16} /> POS Clock In / Out
                    </SButton>
                    {canManageEmployees && (
                        <SButton variant="primary" onClick={handleOpenCreateEmp}>
                            <Icons.Plus size={16} /> Add Employee Profile
                        </SButton>
                    )}
                </div>
            </div>

            {/* KPI Cards Bar */}
            <div className="hr-kpi-grid">
                <div className="hr-kpi-card">
                    <div className="hr-kpi-icon blue"><Icons.Users size={22} /></div>
                    <div>
                        <div className="hr-kpi-value">{employees.length}</div>
                        <div className="hr-kpi-label">Active Employees</div>
                    </div>
                </div>
                <div className="hr-kpi-card">
                    <div className="hr-kpi-icon green"><Icons.Shield size={22} /></div>
                    <div>
                        <div className="hr-kpi-value">{userRole}</div>
                        <div className="hr-kpi-label">Logged-In Role</div>
                    </div>
                </div>
                {canManagePayroll && (
                    <div className="hr-kpi-card">
                        <div className="hr-kpi-icon purple"><Icons.Banknote size={22} /></div>
                        <div>
                            <div className="hr-kpi-value">
                                ₹{employees.reduce((sum, e) => sum + Number(e.base_salary || 0), 0).toLocaleString('en-IN')}
                            </div>
                            <div className="hr-kpi-label">Monthly Base Payroll</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs Header */}
            <div className="tabs">
                <button 
                    className={`tab-item ${activeTab === 'employees' ? 'active' : ''}`}
                    onClick={() => setActiveTab('employees')}
                >
                    <Icons.Users size={16} /> Employees & Credentials ({employees.length})
                </button>
                <button 
                    className={`tab-item ${activeTab === 'attendance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('attendance')}
                >
                    <Icons.Clock size={16} /> Attendance & Shifts
                </button>
                {canManagePayroll && (
                    <button 
                        className={`tab-item ${activeTab === 'payroll' ? 'active' : ''}`}
                        onClick={() => setActiveTab('payroll')}
                    >
                        <Icons.DollarSign size={16} /> Payroll & Slips ({disbursements.length})
                    </button>
                )}
                <button 
                    className={`tab-item ${activeTab === 'stores' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stores')}
                >
                    <Icons.Store size={16} /> Store Branches & Pairing Keys ({stores.length})
                </button>
            </div>

            {/* Tab 1: Employees Directory */}
            {activeTab === 'employees' && (
                <div className="hr-table-card">
                    <table className="hr-table">
                        <thead>
                            <tr>
                                <th>Emp Code</th>
                                <th>Full Name</th>
                                <th>Email / Username</th>
                                <th>Role</th>
                                <th>Assigned Stores</th>
                                <th>Department</th>
                                {canManagePayroll && <th>Base Salary</th>}
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map(emp => (
                                <tr key={emp.id}>
                                    <td><span className="code-badge">{emp.employee_code}</span></td>
                                    <td><strong>{emp.full_name}</strong></td>
                                    <td>{emp.email}</td>
                                    <td><span className={`role-badge ${emp.role.toLowerCase()}`}>{emp.role}</span></td>
                                    <td>
                                        <span className="store-badge">
                                            {emp.assigned_store_ids?.includes('*') ? 'All Outlets (HQ)' : `${emp.assigned_store_ids?.length || 0} Stores`}
                                        </span>
                                    </td>
                                    <td>{emp.department}</td>
                                    {canManagePayroll && <td>₹{Number(emp.base_salary || 0).toLocaleString('en-IN')}</td>}
                                    <td>
                                        <span className={`status-pill ${emp.status.toLowerCase()}`}>{emp.status}</span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {canManageEmployees && (
                                                <SButton 
                                                    variant="secondary"
                                                    title="View & Edit Profile / Scopes"
                                                    onClick={() => handleOpenEditEmp(emp)}
                                                >
                                                    <Icons.Eye size={14} />
                                                </SButton>
                                            )}
                                            <SButton 
                                                variant="secondary"
                                                title="POS Shift & Clock-In Log"
                                                onClick={() => setShowClockModal(true)}
                                            >
                                                <Icons.Clock size={14} />
                                            </SButton>
                                            {canManagePayroll && (
                                                <SButton 
                                                    variant="secondary"
                                                    title="Disburse Monthly Salary Payout"
                                                    onClick={() => handleDisburseSalary(emp)}
                                                >
                                                    <Icons.RotateCcw size={14} />
                                                </SButton>
                                            )}
                                            {canManageEmployees && emp.id !== 1 && emp.role !== 'OWNER' && (
                                                <SButton 
                                                    variant="secondary"
                                                    tone="critical"
                                                    title="Delete Employee Profile"
                                                    onClick={() => handleDeleteEmployee(emp)}
                                                >
                                                    <Icons.Trash2 size={14} />
                                                </SButton>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {employees.length === 0 && (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                                        No employee profiles created yet. Click "Add Employee Profile" above to create one.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Tab 2: Attendance & Shifts */}
            {activeTab === 'attendance' && (
                <div className="hr-table-card">
                    <div style={{ padding: '24px', textAlign: 'center' }}>
                        <div style={{ margin: '0 auto 12px auto', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', color: '#2563eb', borderRadius: '12px' }}>
                            <Icons.Clock size={28} />
                        </div>
                        <h3>POS Attendance & Shift Logging Active</h3>
                        <p style={{ color: '#64748b', maxWidth: '500px', margin: '8px auto 20px auto' }}>
                            Staff members clock in and out directly at the POS billing terminal using their 4-digit PIN. Cash drawer balances are verified automatically on shift close.
                        </p>
                        <SButton variant="primary" onClick={() => setShowClockModal(true)}>
                            Clock In / Out Now
                        </SButton>
                    </div>
                </div>
            )}

            {/* Tab 3: Payroll Disbursements History */}
            {activeTab === 'payroll' && canManagePayroll && (
                <div className="hr-table-card">
                    <table className="hr-table">
                        <thead>
                            <tr>
                                <th>Disbursement ID</th>
                                <th>Month</th>
                                <th>Employee</th>
                                <th>Role</th>
                                <th>Store Branch</th>
                                <th>Gross Salary</th>
                                <th>Net Disbursed</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {disbursements.map(d => (
                                <tr key={d.id}>
                                    <td>#PAY-{d.id}</td>
                                    <td><strong>{d.payroll_month}</strong></td>
                                    <td>{d.full_name} ({d.employee_code})</td>
                                    <td><span className="role-badge">{d.role}</span></td>
                                    <td>{d.store_name || 'Main HQ'}</td>
                                    <td>₹{Number(d.gross_salary).toLocaleString('en-IN')}</td>
                                    <td><strong style={{ color: '#16a34a' }}>₹{Number(d.net_salary).toLocaleString('en-IN')}</strong></td>
                                    <td><span className="status-pill active">{d.status}</span></td>
                                    <td>{new Date(d.disbursed_at).toLocaleDateString()}</td>
                                </tr>
                            ))}
                            {disbursements.length === 0 && (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                                        No payroll disbursements recorded yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Tab 4: Store Branches & Terminal Pairing Keys */}
            {activeTab === 'stores' && (
                <div className="hr-table-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>Store Branches & Pairing Keys</h3>
                            <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
                                Manage child outlets, generate 16-character pairing tokens, or connect this terminal to a Parent HQ system.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {canManageStores && (
                                <SButton variant="primary" type="button" onClick={() => setShowStoreModal(true)}>
                                    <Icons.Plus size={16} /> Add & Pair New Child Branch
                                </SButton>
                            )}
                            <SButton variant="secondary" type="button" onClick={() => setShowPairModal(true)}>
                                Connect This Terminal to Parent HQ
                            </SButton>
                        </div>
                    </div>
                    <table className="hr-table">
                        <thead>
                            <tr>
                                <th>Branch Code</th>
                                <th>Store / Outlet Name</th>
                                <th>16-Character Pairing Key</th>
                                <th>Branch Type</th>
                                <th>Terminal Pairing Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stores.map(st => {
                                const isPaired = Boolean(st.pair_key_hash && (st.is_paired || st.status === 'CONNECTED'));
                                return (
                                    <tr key={st.id}>
                                        <td><span className="code-badge">{st.store_code || `STR-${st.id}`}</span></td>
                                        <td><strong>{st.name}</strong></td>
                                        <td><code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', letterSpacing: '1px' }}>{st.pair_key_hash || 'STR-PEND-KEY-88'}</code></td>
                                        <td><span className="role-badge">{st.is_hq ? 'Main HQ Warehouse' : 'Branch Store'}</span></td>
                                        <td>
                                            {st.is_hq ? (
                                                <span className="status-pill active" style={{ background: '#dcfce7', color: '#15803d' }}>
                                                    Live
                                                </span>
                                            ) : isPaired ? (
                                                <span className="status-pill active" style={{ background: '#dcfce7', color: '#15803d' }}>
                                                    Connected
                                                </span>
                                            ) : (
                                                <span className="status-pill pending" style={{ background: '#fef3c7', color: '#b45309' }}>
                                                    Pending Pairing (Key Entry Awaited)
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {st.is_hq ? (
                                                <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                                                    Primary Admin (No Disconnect)
                                                </span>
                                            ) : isPaired ? (
                                                <SButton 
                                                    variant="secondary"
                                                    tone="critical"
                                                    onClick={() => toast.info(`Branch ${st.name} pairing disconnected.`)}
                                                >
                                                    Disconnect Branch
                                                </SButton>
                                            ) : (
                                                <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                                                    Pending Pairing (No Disconnect)
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Employee Add/Edit Modal */}
            {showEmpModal && (
                <Modal 
                    isOpen={showEmpModal} 
                    onClose={() => setShowEmpModal(false)}
                    title={editingEmp ? `Edit Profile: ${editingEmp.full_name}` : 'Add New Employee Profile'}
                >
                    <form onSubmit={handleSaveEmployee} className="hr-form">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Full Name *</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={empForm.full_name}
                                    onChange={e => setEmpForm({ ...empForm, full_name: e.target.value })}
                                    placeholder="e.g. Rajesh Kumar"
                                />
                            </div>
                            <div className="form-group">
                                <label>Work Login Email *</label>
                                <input 
                                    type="email" 
                                    required 
                                    value={empForm.email}
                                    onChange={e => setEmpForm({ ...empForm, email: e.target.value })}
                                    placeholder="rajesh.b2@quantro.app"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>{editingEmp ? 'Password (Leave blank to keep unchanged)' : 'Login Password *'}</label>
                                <input 
                                    type="password" 
                                    required={!editingEmp}
                                    value={empForm.password}
                                    onChange={e => setEmpForm({ ...empForm, password: e.target.value })}
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="form-group">
                                <label>Quick POS 4-Digit PIN</label>
                                <input 
                                    type="text" 
                                    maxLength={4}
                                    value={empForm.pos_pin}
                                    onChange={e => setEmpForm({ ...empForm, pos_pin: e.target.value })}
                                    placeholder="e.g. 1234"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Job Role Profile *</label>
                                <select 
                                    value={empForm.role}
                                    onChange={e => {
                                        const nextRole = e.target.value;
                                        setEmpForm({ 
                                            ...empForm, 
                                            role: nextRole,
                                            restrict_to_terminals: nextRole === 'OWNER' ? 0 : 1
                                        });
                                    }}
                                >
                                    <option value="CASHIER">Cashier (POS Billing Only)</option>
                                    <option value="STORE_MGR">Store Manager (Local Outlet View)</option>
                                    <option value="INVENTORY_CLERK">Inventory Clerk (Stock & Transfers)</option>
                                    <option value="ACCOUNTANT">Accountant (Tax & Expenses)</option>
                                    <option value="REGIONAL_MGR">Regional Manager (Multi-Branch Cluster)</option>
                                    <option value="OWNER">Owner / HQ Admin (Full Business Access)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Department</label>
                                <input 
                                    type="text" 
                                    value={empForm.department}
                                    onChange={e => setEmpForm({ ...empForm, department: e.target.value })}
                                    placeholder="Sales / Inventory / Management"
                                />
                            </div>
                        </div>

                        {canManagePayroll && (
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Base Monthly Salary (₹)</label>
                                    <input 
                                        type="number" 
                                        value={empForm.base_salary}
                                        onChange={e => setEmpForm({ ...empForm, base_salary: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Allowances (₹)</label>
                                    <input 
                                        type="number" 
                                        value={empForm.allowances}
                                        onChange={e => setEmpForm({ ...empForm, allowances: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Deductions (₹)</label>
                                    <input 
                                        type="number" 
                                        value={empForm.deductions}
                                        onChange={e => setEmpForm({ ...empForm, deductions: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Granular Sub-Tab Scopes Matrix Selector */}
                        <div className="scopes-matrix-section" style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', background: 'var(--surface-secondary, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700' }}>Tab & Sub-Tab Permissions & Scopes Matrix</h4>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0' }}>
                                Configure vertical module scopes. Scopes dictate what tabs and features this employee can access across HQ and paired store terminals.
                            </p>
                            
                            <div className="scopes-vertical-list">
                                {MODULE_SCOPE_ITEMS.map(item => (
                                    <div key={item.key} className="scope-vertical-item">
                                        <div className="scope-item-left">
                                            <div className="scope-item-icon">{item.icon}</div>
                                            <div>
                                                <div className="scope-item-title">{item.label}</div>
                                                <div className="scope-item-sub">{item.desc}</div>
                                            </div>
                                        </div>
                                        <QuantroScopeDropdown 
                                            value={(empForm.scopes && typeof empForm.scopes === 'object' && !Array.isArray(empForm.scopes) && empForm.scopes[item.key]) || 'edit'}
                                            onChange={(newLevel) => setEmpForm(prev => {
                                                const currentScopes = (prev.scopes && typeof prev.scopes === 'object' && !Array.isArray(prev.scopes))
                                                    ? prev.scopes 
                                                    : { ...DEFAULT_SCOPES };
                                                return {
                                                    ...prev,
                                                    scopes: { ...currentScopes, [item.key]: newLevel }
                                                };
                                            })}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input 
                                        type="checkbox"
                                        id="allow_remote_access"
                                        checked={Boolean(empForm.scopes?.allow_remote_access)}
                                        onChange={e => setEmpForm({
                                            ...empForm,
                                            scopes: { ...(empForm.scopes || {}), allow_remote_access: e.target.checked }
                                        })}
                                    />
                                    <label htmlFor="allow_remote_access" style={{ fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                                        Allow Remote / Home Access (Enforces Read-Only & POS Restrictions)
                                    </label>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input 
                                        type="checkbox"
                                        id="restrict_to_terminals"
                                        checked={Boolean(empForm.restrict_to_terminals)}
                                        onChange={e => setEmpForm({
                                            ...empForm,
                                            restrict_to_terminals: e.target.checked ? 1 : 0
                                        })}
                                    />
                                    <label htmlFor="restrict_to_terminals" style={{ fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                                        Restrict login to paired child terminals and remote access sessions only (No HQ login)
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <SButton variant="secondary" type="button" onClick={() => setShowEmpModal(false)}>
                                Cancel
                            </SButton>
                            <SButton variant="primary" type="submit" disabled={savingEmp}>
                                {savingEmp ? 'Saving...' : editingEmp ? 'Update Profile' : 'Create Profile'}
                            </SButton>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Clock-In Modal */}
            {showClockModal && (
                <Modal isOpen={showClockModal} onClose={() => setShowClockModal(false)} title="POS Clock In / Shift Start">
                    <div style={{ padding: '16px' }}>
                        <div className="form-group">
                            <label>Starting Cash Drawer Balance (₹)</label>
                            <input 
                                type="number"
                                value={clockDrawer}
                                onChange={e => setClockDrawer(e.target.value)}
                                placeholder="1000"
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                            <SButton variant="secondary" onClick={() => setShowClockModal(false)}>Cancel</SButton>
                            <SButton variant="primary" onClick={handleClockIn}>Confirm Clock In</SButton>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Disburse Salary Modal */}
            {showPayrollModal && selectedEmpForPayroll && (
                <Modal isOpen={showPayrollModal} onClose={() => setShowPayrollModal(false)} title={`Disburse Salary: ${selectedEmpForPayroll.full_name}`}>
                    <div style={{ padding: '16px' }}>
                        <p style={{ marginBottom: '16px' }}>
                            Executing monthly salary payout for <strong>{selectedEmpForPayroll.full_name}</strong> ({selectedEmpForPayroll.role}).
                        </p>
                        <div className="form-group">
                            <label>Payroll Month</label>
                            <input 
                                type="month"
                                value={payrollMonth}
                                onChange={e => setPayrollMonth(e.target.value)}
                            />
                        </div>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', margin: '16px 0', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span>Base Salary:</span> <strong>₹{Number(selectedEmpForPayroll.base_salary || 0).toLocaleString('en-IN')}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span>Allowances:</span> <strong>+₹{Number(selectedEmpForPayroll.allowances || 0).toLocaleString('en-IN')}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span>Deductions:</span> <strong>-₹{Number(selectedEmpForPayroll.deductions || 0).toLocaleString('en-IN')}</strong>
                            </div>
                            <hr style={{ border: 'none', borderTop: '1px solid #cbd5e1', margin: '8px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold' }}>
                                <span>Net Disbursed Amount:</span>
                                <span style={{ color: '#16a34a' }}>
                                    ₹{Math.max(0, Number(selectedEmpForPayroll.base_salary || 0) + Number(selectedEmpForPayroll.allowances || 0) - Number(selectedEmpForPayroll.deductions || 0)).toLocaleString('en-IN')}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <SButton variant="secondary" onClick={() => setShowPayrollModal(false)}>Cancel</SButton>
                            <SButton variant="primary" onClick={confirmDisburseSalary} disabled={disbursing}>
                                {disbursing ? 'Processing...' : 'Confirm Disburse Payout'}
                            </SButton>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal: Add & Pair New Child Branch */}
            {showStoreModal && (
                <Modal isOpen={showStoreModal} onClose={() => { setShowStoreModal(false); setCreatedPairKey(''); }} title="Add & Pair New Child Store Branch">
                    <div style={{ padding: '16px' }}>
                        {createdPairKey ? (
                            <div style={{ textAlign: 'center', padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                <div style={{ margin: '0 auto 8px auto', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dcfce7', color: '#16a34a', borderRadius: '50%' }}>
                                    <Icons.PartyPopper size={24} />
                                </div>
                                <h3 style={{ color: '#166534', margin: 0 }}>Child Branch Created!</h3>
                                <p style={{ fontSize: '13px', color: '#15803d', margin: '8px 0 16px 0' }}>
                                    Enter this 16-character Pairing Token on the Child ERP terminal to pair it with Parent HQ:
                                </p>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', background: '#ffffff', padding: '12px 20px', borderRadius: '8px', border: '2px dashed #22c55e', color: '#15803d', display: 'inline-block' }}>
                                    {createdPairKey}
                                </div>
                                <div style={{ marginTop: '20px' }}>
                                    <SButton variant="primary" onClick={() => { setShowStoreModal(false); setCreatedPairKey(''); }}>Done</SButton>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                try {
                                    const res = await api.createStore(newBranchForm);
                                    if (res.pair_key) {
                                        setCreatedPairKey(res.pair_key);
                                        toast.success(`Child branch ${newBranchForm.name} created!`);
                                        const storesRes = await api.getStores();
                                        if (storesRes.stores) setStores(storesRes.stores);
                                    }
                                } catch (err) {
                                    toast.error(err.message || 'Failed to create branch');
                                }
                            }}>
                                <div className="form-group" style={{ marginBottom: '12px' }}>
                                    <label>Branch Name *</label>
                                    <input type="text" required value={newBranchForm.name} onChange={e => setNewBranchForm({ ...newBranchForm, name: e.target.value })} placeholder="e.g. Quantro Outlet - Downtown" />
                                </div>
                                <div className="form-group" style={{ marginBottom: '12px' }}>
                                    <label>Address</label>
                                    <input type="text" value={newBranchForm.address} onChange={e => setNewBranchForm({ ...newBranchForm, address: e.target.value })} placeholder="45 MG Road, Bangalore" />
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Branch Phone</label>
                                        <input type="text" value={newBranchForm.phone} onChange={e => setNewBranchForm({ ...newBranchForm, phone: e.target.value })} placeholder="+91 98765 43210" />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Branch Email</label>
                                        <input type="email" value={newBranchForm.email} onChange={e => setNewBranchForm({ ...newBranchForm, email: e.target.value })} placeholder="downtown@quantro.app" />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Branch GSTIN</label>
                                        <input type="text" value={newBranchForm.gstin} onChange={e => setNewBranchForm({ ...newBranchForm, gstin: e.target.value })} placeholder="24AAAAA0000A1Z5" />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Place of Supply</label>
                                        <input type="text" value={newBranchForm.place_of_supply} onChange={e => setNewBranchForm({ ...newBranchForm, place_of_supply: e.target.value })} placeholder="09-Uttar Pradesh" />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                    <SButton variant="secondary" type="button" onClick={() => setShowStoreModal(false)}>Cancel</SButton>
                                    <SButton variant="primary" type="submit">Generate 16-Char Pair Token</SButton>
                                </div>
                            </form>
                        )}
                    </div>
                </Modal>
            )}

            {/* Modal: Connect Terminal via 16-Char Pair Key */}
            {showPairModal && (
                <Modal isOpen={showPairModal} onClose={() => setShowPairModal(false)} title="Connect Terminal to Parent HQ System">
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                            const res = await api.pairStoreTerminal(pairKeyInput);
                            if (res.store) {
                                toast.success(`Terminal paired with ${res.store.name}!`);
                                setShowPairModal(false);
                                const storesRes = await api.getStores();
                                if (storesRes.stores) setStores(storesRes.stores);
                            }
                        } catch (err) {
                            toast.error(err.message || 'Pairing failed');
                        }
                    }} style={{ padding: '16px' }}>
                        <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
                            Enter the 16-character Branch Pairing Token generated by Parent HQ Admin to align this terminal as a Child ERP instance.
                        </p>
                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label>16-Character Pairing Token *</label>
                            <input 
                                type="text" 
                                required 
                                value={pairKeyInput}
                                onChange={e => setPairKeyInput(e.target.value)}
                                placeholder="e.g. STR-98F1-44A2-KL89"
                                style={{ fontFamily: 'monospace', fontSize: '16px', letterSpacing: '1px', textAlign: 'center' }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <SButton variant="secondary" type="button" onClick={() => setShowPairModal(false)}>Cancel</SButton>
                            <SButton variant="primary" type="submit">Verify & Align Terminal</SButton>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
