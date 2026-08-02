import React, { useState, useEffect } from 'react';
import api from '../api';
import { toast } from 'sonner';
import Modal from '../components/Modal';
import SButton from '../components/SButton';
import { Icons } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import './HRPayrollPage.css';

export default function HRPayrollPage() {
    const { currentUser, userRole, isOwner, activeStoreId, stores, canManageEmployees, canManagePayroll } = useAuth();
    const [activeTab, setActiveTab] = useState('employees'); // 'employees', 'attendance', 'payroll'
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
        status: 'ACTIVE'
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
            status: 'ACTIVE'
        });
        setShowEmpModal(true);
    };

    const handleOpenEditEmp = (emp) => {
        setEditingEmp(emp);
        setEmpForm({
            full_name: emp.full_name,
            email: emp.email,
            phone: emp.phone || '',
            password: '',
            pos_pin: '',
            role: emp.role,
            assigned_store_ids: emp.assigned_store_ids || ['*'],
            department: emp.department || 'Sales',
            designation: emp.designation || 'Staff',
            base_salary: emp.base_salary || 0,
            allowances: emp.allowances || 0,
            deductions: emp.deductions || 0,
            status: emp.status || 'ACTIVE'
        });
        setShowEmpModal(true);
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
            <div className="hr-tabs-bar">
                <button 
                    className={`hr-tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
                    onClick={() => setActiveTab('employees')}
                >
                    <Icons.Users size={16} /> Employees & Credentials ({employees.length})
                </button>
                <button 
                    className={`hr-tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('attendance')}
                >
                    <Icons.Clock size={16} /> Attendance & Shifts
                </button>
                {canManagePayroll && (
                    <button 
                        className={`hr-tab-btn ${activeTab === 'payroll' ? 'active' : ''}`}
                        onClick={() => setActiveTab('payroll')}
                    >
                        <Icons.DollarSign size={16} /> Payroll & Slips ({disbursements.length})
                    </button>
                )}
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
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {canManageEmployees && (
                                                <button className="hr-action-btn edit" onClick={() => handleOpenEditEmp(emp)}>
                                                    <Icons.Edit2 size={14} /> Edit
                                                </button>
                                            )}
                                            {canManagePayroll && (
                                                <button className="hr-action-btn pay" onClick={() => handleDisburseSalary(emp)}>
                                                    <Icons.DollarSign size={14} /> Disburse
                                                </button>
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
                                    onChange={e => setEmpForm({ ...empForm, role: e.target.value })}
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
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700' }}>Tab & Sub-Tab Permissions & Scopes Matrix</h4>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {[
                                    { key: 'dashboard', label: 'Dashboard Page' },
                                    { key: 'inventory_products', label: 'Inventory (All Products)' },
                                    { key: 'inventory_transfers', label: 'Inventory (Stock Transfers)' },
                                    { key: 'sales_invoices', label: 'Sales (All Invoices)' },
                                    { key: 'sales_pos', label: 'Sales (Quick POS Billing)' },
                                    { key: 'customers', label: 'Customers Management' },
                                    { key: 'purchases', label: 'Purchases & Suppliers' },
                                    { key: 'hr_payroll', label: 'HR & Payroll Management' },
                                    { key: 'settings', label: 'System Settings' }
                                ].map(item => (
                                    <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '600' }}>{item.label}</label>
                                        <select 
                                            value={empForm.scopes?.[item.key] || 'edit'}
                                            onChange={e => setEmpForm({
                                                ...empForm,
                                                scopes: { ...(empForm.scopes || {}), [item.key]: e.target.value }
                                            })}
                                            style={{ padding: '8px', borderRadius: '8px', fontSize: '12px', border: '1px solid var(--border-color, #cbd5e1)' }}
                                        >
                                            <option value="edit">Read & Edit (Full Write Access)</option>
                                            <option value="read">Read-Only (View Only)</option>
                                            <option value="hseen">Hseen (Header Summary Only)</option>
                                            <option value="unseen">Unseen (Hidden Completely)</option>
                                        </select>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        </div>
    );
}
