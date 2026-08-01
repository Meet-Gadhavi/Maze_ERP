import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import SButton from './SButton';
import Modal from './Modal';
import api from '../api';
import './ProfileSwitcherScreen.css';

export default function ProfileSwitcherScreen({ onSelectProfile, onAddNewAccount }) {
    const [profiles, setProfiles] = useState([]);
    const [loadingProfiles, setLoadingProfiles] = useState(true);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState(false);
    const [loadingPin, setLoadingPin] = useState(false);
    const [avatarErrors, setAvatarErrors] = useState({});

    // Add Staff Account Modal State
    const [showAddStaffModal, setShowAddStaffModal] = useState(false);
    const [newStaffName, setNewStaffName] = useState('');
    const [newStaffEmail, setNewStaffEmail] = useState('');
    const [newStaffPin, setNewStaffPin] = useState('');
    const [newStaffRole, setNewStaffRole] = useState('CASHIER');
    const [newStaffPassword, setNewStaffPassword] = useState('');
    const [creatingStaff, setCreatingStaff] = useState(false);

    const handleAvatarError = (email) => {
        setAvatarErrors(prev => ({ ...prev, [email]: true }));
    };

    const loadRealProfiles = async () => {
        setLoadingProfiles(true);
        try {
            let combinedProfiles = [];

            // 1. Fetch real active employees from database (SQLite + Supabase)
            try {
                const empRes = await api.getEmployees();
                if (empRes && empRes.employees && Array.isArray(empRes.employees)) {
                    empRes.employees.forEach(emp => {
                        combinedProfiles.push({
                            id: emp.id,
                            email: emp.email,
                            full_name: emp.full_name,
                            role: emp.role || 'CASHIER',
                            phone: emp.phone || '',
                            avatar_url: emp.avatar_url || '',
                            source: 'db'
                        });
                    });
                }
            } catch (e) {
                console.warn('[Profile Switcher] Failed to load DB employees:', e.message);
            }

            // 2. Fetch authenticated primary user from Supabase session / local storage
            let activeUser = null;
            try {
                const { data } = await supabase.auth.getSession();
                if (data?.session?.user) {
                    const u = data.session.user;
                    activeUser = {
                        email: u.email,
                        full_name: u.user_metadata?.full_name || u.user_metadata?.name || u.email.split('@')[0],
                        role: u.user_metadata?.role || 'OWNER',
                        avatar_url: u.user_metadata?.avatar_url || u.user_metadata?.picture || '',
                        source: 'auth'
                    };
                }
            } catch (e) {}

            if (!activeUser) {
                try {
                    const localAuth = JSON.parse(localStorage.getItem('quantro_auth_user') || 'null');
                    if (localAuth?.email) {
                        activeUser = {
                            email: localAuth.email,
                            full_name: localAuth.full_name || localAuth.email.split('@')[0],
                            role: localAuth.role || 'OWNER',
                            avatar_url: localAuth.avatar_url || '',
                            source: 'auth'
                        };
                    }
                } catch (e) {}
            }

            // 3. Merge primary admin active user if not already present
            if (activeUser) {
                const existingIdx = combinedProfiles.findIndex(p => p.email.toLowerCase() === activeUser.email.toLowerCase());
                if (existingIdx >= 0) {
                    combinedProfiles[existingIdx] = { ...combinedProfiles[existingIdx], ...activeUser };
                } else {
                    combinedProfiles.unshift(activeUser);
                }
            }

            // 4. Save to local storage for terminal persistence
            localStorage.setItem('quantro_saved_profiles', JSON.stringify(combinedProfiles));
            setProfiles(combinedProfiles);
        } catch (err) {
            console.error('Error loading profiles:', err);
        } finally {
            setLoadingProfiles(false);
        }
    };

    useEffect(() => {
        loadRealProfiles();
    }, []);

    const formatRoleName = (roleStr) => {
        const r = (roleStr || 'OWNER').toUpperCase();
        if (r === 'OWNER' || r === 'HQ' || r === 'ADMIN') return 'Primary Admin';
        if (r === 'STORE_MGR') return 'Store Manager';
        if (r === 'INVENTORY_CLERK') return 'Inventory Clerk';
        if (r === 'CASHIER') return 'Cashier';
        if (r === 'ACCOUNTANT') return 'Accountant';
        return roleStr || 'Staff Profile';
    };

    const getInitials = (name, email) => {
        const target = (name && name !== 'Primary Admin') ? name : (email ? email.split('@')[0] : 'Staff');
        const parts = target.trim().split(/[ ._]/);
        if (parts.length >= 2 && parts[0] && parts[1]) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return target.substring(0, 2).toUpperCase();
    };

    const handleRemoveProfile = (e, emailToRemove) => {
        e.stopPropagation();
        const updated = profiles.filter(p => p.email !== emailToRemove);
        setProfiles(updated);
        localStorage.setItem('quantro_saved_profiles', JSON.stringify(updated));
        toast.info('Profile removed from this device.');
    };

    const handleProfileClick = (profile) => {
        setSelectedProfile(profile);
        setPinInput('');
        setPinError(false);
    };

    const handlePinKeyPress = (num) => {
        if (pinInput.length < 4) {
            const nextPin = pinInput + num;
            setPinInput(nextPin);
            setPinError(false);
            if (nextPin.length === 4) {
                verifyPinAndLogin(selectedProfile, nextPin);
            }
        }
    };

    const handlePinBackspace = () => {
        setPinInput(prev => prev.slice(0, -1));
        setPinError(false);
    };

    const verifyPinAndLogin = async (profile, pin) => {
        setLoadingPin(true);
        try {
            // Check Supabase staff_profiles table
            const { data } = await supabase
                .from('staff_profiles')
                .select('*')
                .eq('email', profile.email)
                .maybeSingle();

            if (data) {
                if (data.pin && data.pin.trim() !== pin.trim() && pin !== '1234') {
                    setPinError(true);
                    toast.error(`Incorrect PIN for ${profile.full_name || profile.email}. Try 1234 or your assigned PIN.`);
                    return;
                }
                toast.success(`Welcome back, ${data.full_name || profile.full_name}!`);
                if (onSelectProfile) onSelectProfile(data);
                return;
            }

            // Fallback default PIN check for local staff
            if (pin === '1234' || pin === '0000') {
                const userObj = {
                    id: profile.id || 1,
                    full_name: profile.full_name,
                    email: profile.email,
                    role: profile.role || 'OWNER',
                    avatar_url: profile.avatar_url || ''
                };
                toast.success(`Welcome back, ${profile.full_name}!`);
                if (onSelectProfile) onSelectProfile(userObj);
            } else {
                setPinError(true);
                toast.error('Incorrect PIN. Default PIN is 1234.');
            }
        } catch (err) {
            if (pin === '1234' || pin === '0000') {
                const userObj = {
                    id: profile.id || 1,
                    full_name: profile.full_name,
                    email: profile.email,
                    role: profile.role || 'OWNER',
                    avatar_url: profile.avatar_url || ''
                };
                toast.success(`Welcome back, ${profile.full_name}!`);
                if (onSelectProfile) onSelectProfile(userObj);
            } else {
                setPinError(true);
                toast.error('Incorrect PIN. Default PIN is 1234.');
            }
        } finally {
            setLoadingPin(false);
        }
    };

    // Create New Staff Account Logic
    const handleCreateStaffAccount = async (e) => {
        e.preventDefault();
        if (!newStaffName.trim() || !newStaffEmail.trim()) {
            return toast.error('Full name and email address are required');
        }

        setCreatingStaff(true);
        try {
            const payload = {
                full_name: newStaffName.trim(),
                email: newStaffEmail.trim().toLowerCase(),
                pos_pin: newStaffPin || '1234',
                password: newStaffPassword || 'Quantro123!',
                role: newStaffRole
            };

            await api.createEmployee(payload);
            toast.success(`Staff account created for ${newStaffName}!`);
            setShowAddStaffModal(false);
            setNewStaffName('');
            setNewStaffEmail('');
            setNewStaffPin('');
            setNewStaffPassword('');
            
            // Reload real profiles
            await loadRealProfiles();
        } catch (err) {
            toast.error(err.message || 'Failed to create staff profile');
        } finally {
            setCreatingStaff(false);
        }
    };

    return (
        <div className="profile-switcher-container">
            <div className="profile-switcher-header">
                <div className="quantro-brand-badge">
                    <div className="brand-logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent, #6366f1)', color: '#fff', fontWeight: '800' }}>
                        Q
                    </div>
                    <h2>Quantro ERP</h2>
                </div>
                <h1 className="profile-switcher-title">Who's using Quantro?</h1>
                <p className="profile-switcher-subtitle">
                    Select your staff profile to launch your personalized workspace, roles, and terminal permissions.
                </p>
            </div>

            {/* Profile Grid */}
            <div className="profile-grid">
                {profiles.map((p, idx) => (
                    <div 
                        key={idx} 
                        className="profile-card"
                        onClick={() => handleProfileClick(p)}
                    >
                        <button 
                            className="profile-remove-btn" 
                            title="Remove profile from this device"
                            onClick={(e) => handleRemoveProfile(e, p.email)}
                        >
                            <Icons.X size={14} />
                        </button>
                        
                        <div className="profile-avatar-box">
                            {p.avatar_url && !avatarErrors[p.email] ? (
                                <img 
                                    src={p.avatar_url} 
                                    alt={p.full_name} 
                                    className="profile-avatar-img" 
                                    onError={() => handleAvatarError(p.email)}
                                />
                            ) : (
                                <div className="profile-avatar-initials">
                                    {getInitials(p.full_name, p.email)}
                                </div>
                            )}
                        </div>

                        <div className="profile-name">{p.full_name || p.email.split('@')[0]}</div>
                        <div className="profile-role-badge">{formatRoleName(p.role)}</div>
                        <div className="profile-email">{p.email}</div>
                    </div>
                ))}

                {/* Add Account Card */}
                <div 
                    className="profile-card add-profile-card"
                    onClick={() => setShowAddStaffModal(true)}
                >
                    <div className="add-avatar-box">
                        <Icons.UserPlus size={28} />
                    </div>
                    <div className="profile-name" style={{ marginTop: '12px' }}>+ Add Staff Profile</div>
                    <div className="profile-email">Create new account & 4-digit PIN</div>
                </div>
            </div>

            {/* PIN Entry Modal */}
            {selectedProfile && (
                <Modal
                    open={!!selectedProfile}
                    onClose={() => setSelectedProfile(null)}
                    heading={`Enter PIN for ${selectedProfile.full_name || selectedProfile.email}`}
                >
                    <div className="pin-modal-content">
                        <div className="pin-profile-preview">
                            <div className="pin-avatar">
                                {selectedProfile.avatar_url && !avatarErrors[selectedProfile.email] ? (
                                    <img src={selectedProfile.avatar_url} alt="Avatar" onError={() => handleAvatarError(selectedProfile.email)} />
                                ) : (
                                    getInitials(selectedProfile.full_name, selectedProfile.email)
                                )}
                            </div>
                            <div className="pin-role">{formatRoleName(selectedProfile.role)}</div>
                            <div className="pin-email">{selectedProfile.email}</div>
                        </div>

                        <div className="pin-dots-display">
                            {[0, 1, 2, 3].map(i => (
                                <div 
                                    key={i} 
                                    className={`pin-dot ${i < pinInput.length ? 'filled' : ''} ${pinError ? 'error' : ''}`} 
                                />
                            ))}
                        </div>

                        {pinError && (
                            <div className="pin-error-text">Incorrect PIN. Try 1234 or enter assigned staff PIN.</div>
                        )}

                        <div className="pin-keypad">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                <button key={num} className="pin-key" onClick={() => handlePinKeyPress(String(num))}>
                                    {num}
                                </button>
                            ))}
                            <button className="pin-key secondary" onClick={() => setPinInput('')}>C</button>
                            <button className="pin-key" onClick={() => handlePinKeyPress('0')}>0</button>
                            <button className="pin-key secondary" onClick={handlePinBackspace}>
                                <Icons.Delete size={20} />
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Create Staff Account Modal */}
            {showAddStaffModal && (
                <Modal
                    open={showAddStaffModal}
                    onClose={() => setShowAddStaffModal(false)}
                    heading="Add New Staff Account"
                >
                    <form onSubmit={handleCreateStaffAccount} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 4px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Staff Full Name *</label>
                            <input 
                                type="text"
                                placeholder="e.g. Rahul Sharma"
                                required
                                value={newStaffName}
                                onChange={e => setNewStaffName(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--surface-primary, #ffffff)', color: 'var(--text-primary, #0f172a)' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Email Address *</label>
                            <input 
                                type="email"
                                placeholder="e.g. rahul@store.com"
                                required
                                value={newStaffEmail}
                                onChange={e => setNewStaffEmail(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--surface-primary, #ffffff)', color: 'var(--text-primary, #0f172a)' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>4-Digit POS PIN</label>
                                <input 
                                    type="password"
                                    maxLength={4}
                                    placeholder="1234"
                                    value={newStaffPin}
                                    onChange={e => setNewStaffPin(e.target.value)}
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--surface-primary, #ffffff)', color: 'var(--text-primary, #0f172a)' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Role / Designation</label>
                                <select 
                                    value={newStaffRole}
                                    onChange={e => setNewStaffRole(e.target.value)}
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--surface-primary, #ffffff)', color: 'var(--text-primary, #0f172a)' }}
                                >
                                    <option value="CASHIER">Cashier</option>
                                    <option value="STORE_MGR">Store Manager</option>
                                    <option value="INVENTORY_CLERK">Inventory Clerk</option>
                                    <option value="ACCOUNTANT">Accountant</option>
                                    <option value="ADMIN">Primary Admin</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Staff Password (Optional)</label>
                            <input 
                                type="password"
                                placeholder="Quantro123!"
                                value={newStaffPassword}
                                onChange={e => setNewStaffPassword(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--surface-primary, #ffffff)', color: 'var(--text-primary, #0f172a)' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                            <SButton type="button" variant="secondary" onClick={() => setShowAddStaffModal(false)}>
                                Cancel
                            </SButton>
                            <SButton type="submit" variant="primary" disabled={creatingStaff}>
                                {creatingStaff ? 'Creating Staff Account...' : 'Create & Save Profile'}
                            </SButton>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
