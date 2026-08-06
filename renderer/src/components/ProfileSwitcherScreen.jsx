import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import Modal from './Modal';
import api from '../api';
import './ProfileSwitcherScreen.css';

export default function ProfileSwitcherScreen({ onSelectProfile, onAddNewAccount }) {
    const isHqTerminal = localStorage.getItem('quantro_is_hq') === 'true' || localStorage.getItem('quantro_device_type') === 'hq';
    const [profiles, setProfiles] = useState([]);
    const [loadingProfiles, setLoadingProfiles] = useState(true);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState(false);
    const [loadingPin, setLoadingPin] = useState(false);
    const [avatarErrors, setAvatarErrors] = useState({});

    const handleAvatarError = (email) => {
        setAvatarErrors(prev => ({ ...prev, [email]: true }));
    };

    const loadRealProfiles = async () => {
        setLoadingProfiles(true);
        try {
            let combinedProfiles = [];

            // 1. Fetch saved profiles from localStorage
            let savedLocal = [];
            try {
                savedLocal = JSON.parse(localStorage.getItem('quantro_saved_profiles') || '[]');
            } catch (e) {}

            savedLocal.forEach(sp => {
                if (sp && sp.email && sp.email.toLowerCase() !== 'admin@quantro.app') {
                    combinedProfiles.push(sp);
                }
            });

            // 2. Fetch real active employees from database (SQLite + Supabase)
            try {
                const empRes = await api.getEmployees();
                if (empRes && empRes.employees && Array.isArray(empRes.employees)) {
                    empRes.employees.forEach(emp => {
                        if (emp.email && emp.email.toLowerCase() !== 'admin@quantro.app') {
                            const idx = combinedProfiles.findIndex(p => p.email.toLowerCase() === emp.email.toLowerCase());
                            const empObj = {
                                id: emp.id,
                                email: emp.email,
                                full_name: emp.full_name,
                                role: emp.role || 'CASHIER',
                                phone: emp.phone || '',
                                avatar_url: emp.avatar_url || '',
                                restrict_to_terminals: emp.restrict_to_terminals,
                                source: 'db'
                            };
                            if (idx >= 0) {
                                combinedProfiles[idx] = { ...combinedProfiles[idx], ...empObj };
                            } else {
                                combinedProfiles.push(empObj);
                            }
                        }
                    });
                }
            } catch (e) {
                console.warn('[Profile Switcher] Failed to load DB employees:', e.message);
            }

            // 3. Fetch real authenticated primary user from Supabase session / local storage
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
                    if (localAuth?.email && localAuth.email.toLowerCase() !== 'admin@quantro.app') {
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

            // Merge active logged-in user to top of list
            if (activeUser) {
                const existingIdx = combinedProfiles.findIndex(p => p.email.toLowerCase() === activeUser.email.toLowerCase());
                if (existingIdx >= 0) {
                    combinedProfiles[existingIdx] = { ...combinedProfiles[existingIdx], ...activeUser };
                } else {
                    combinedProfiles.unshift(activeUser);
                }
            }

            // Filter out any legacy fake admin@quantro.app profile
            combinedProfiles = combinedProfiles.filter(p => p.email && p.email.toLowerCase() !== 'admin@quantro.app');

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

    useEffect(() => {
        if (!selectedProfile) return;

        const handleKeyDown = (e) => {
            if (e.key >= '0' && e.key <= '9') {
                handlePinKeyPress(e.key);
            } else if (e.key === 'Backspace') {
                handlePinBackspace();
            } else if (e.key === 'Escape') {
                setSelectedProfile(null);
            } else if (e.key.toLowerCase() === 'c') {
                setPinInput('');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedProfile, pinInput]);

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
        // Require 4-digit PIN for all profiles, including OWNER/HQ/ADMIN
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
            // 🔒 Block restricted employees from logging in on HQ terminal
            const isHqTerminal = localStorage.getItem('quantro_is_hq') === 'true' || localStorage.getItem('quantro_device_type') === 'hq';
            if (isHqTerminal && profile.restrict_to_terminals === 1) {
                setPinError(true);
                toast.error(`Access Denied: ${profile.full_name || profile.email}'s profile is restricted to paired store terminals and remote access only. HQ login is not permitted.`);
                setPinInput('');
                return;
            }

            // Query Supabase staff_profiles table for assigned PIN
            const { data } = await supabase
                .from('staff_profiles')
                .select('*')
                .eq('email', profile.email)
                .maybeSingle();

            if (data) {
                const dbPin = (data.pin || '').trim();
                const inputPin = pin.trim();

                if (dbPin !== inputPin) {
                    setPinError(true);
                    toast.error(`Incorrect PIN for ${profile.full_name || profile.email}.`);
                    setPinInput('');
                    return;
                }
                toast.success(`Welcome back, ${data.full_name || profile.full_name}!`);
                if (onSelectProfile) onSelectProfile(data);
                return;
            } else {
                setPinError(true);
                toast.error(`Profile not found in database.`);
                setPinInput('');
            }
        } catch (err) {
            setPinError(true);
            toast.error(err.message || 'PIN verification failed.');
            setPinInput('');
        } finally {
            setLoadingPin(false);
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
                    Select your profile to launch your personalized workspace, roles, and terminal permissions.
                </p>
            </div>

            {/* Profile Grid */}
            <div className="profile-grid">
                {profiles.map((p, idx) => (
                    <div 
                        key={idx} 
                        className={`profile-card ${isHqTerminal && p.restrict_to_terminals === 1 ? 'profile-card-restricted' : ''}`}
                        onClick={() => handleProfileClick(p)}
                        title={isHqTerminal && p.restrict_to_terminals === 1 ? 'This account is restricted to child terminals only' : ''}
                        style={isHqTerminal && p.restrict_to_terminals === 1 ? { opacity: 0.55, cursor: 'not-allowed' } : {}}
                    >
                        <button 
                            className="profile-remove-btn" 
                            title="Remove profile from this device"
                            onClick={(e) => handleRemoveProfile(e, p.email)}
                        >
                            <Icons.X size={14} />
                        </button>

                        {/* 🔒 Lock badge for terminal-restricted profiles on HQ */}
                        {isHqTerminal && p.restrict_to_terminals === 1 && (
                            <div style={{
                                position: 'absolute', top: '8px', left: '8px',
                                background: '#ef4444', borderRadius: '6px',
                                padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '3px',
                                fontSize: '10px', fontWeight: '700', color: '#fff', zIndex: 2
                            }}>
                                <Icons.Lock size={9} /> Terminal Only
                            </div>
                        )}
                        
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

                {/* Add Account Card — Redirects to Auth Screen */}
                <div 
                    className="profile-card add-profile-card"
                    onClick={onAddNewAccount}
                >
                    <div className="add-avatar-box">
                        <Icons.Plus size={28} />
                    </div>
                    <div className="profile-name" style={{ marginTop: '12px' }}>Add Account</div>
                    <div className="profile-email">Sign in with Email / Google</div>
                </div>
            </div>

            {/* PIN Entry Modal — Only shown for Employees */}
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
        </div>
    );
}
