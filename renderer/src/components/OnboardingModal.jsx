import React, { useState } from 'react';
import api from '../api';
import { toast } from 'sonner';
import { Icons } from './Icons';
import SButton from './SButton';
import './OnboardingModal.css';

export default function OnboardingModal({ isOpen, session, onComplete }) {
    const [step, setStep] = useState(1);
    const [accountMode, setAccountMode] = useState('hq'); // 'hq', 'store', 'remote'
    const [pairKey, setPairKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [remoteReason, setRemoteReason] = useState('Work from Home');
    const [customReason, setCustomReason] = useState('');

    const [form, setForm] = useState({
        shop_name: 'Quantro',
        gstin: '',
        place_of_supply: '',
        phone: '',
        email: '',
        pos_pin: '1234',
        logo_url: ''
    });

    if (!isOpen) return null;

    // Calculate total steps based on selected terminal type
    let totalSteps = 5;
    if (accountMode === 'store') totalSteps = 2;
    if (accountMode === 'remote') totalSteps = 3;

    const progressPercentage = Math.round((step / totalSteps) * 100);

    let stepTitles = [];
    if (accountMode === 'hq') {
        stepTitles = [
            "Select Device Architecture & Terminal Type",
            "Shop & Business Profile",
            "GSTIN & Tax Registration",
            "Contact, Email & 4-Digit Security PIN",
            "Business Logo & Final Launch"
        ];
    } else if (accountMode === 'store') {
        stepTitles = [
            "Select Device Architecture & Terminal Type",
            "Connection Status & Linked Business"
        ];
    } else if (accountMode === 'remote') {
        stepTitles = [
            "Select Device Architecture & Terminal Type",
            "Remote Access Purpose",
            "Welcome Back & Session Launch"
        ];
    }

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error("Logo file size must be less than 2 MB");
            return;
        }

        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
            setForm(prev => ({ ...prev, logo_url: uploadEvent.target.result }));
            toast.success("Business Logo selected successfully!");
        };
        reader.readAsDataURL(file);
    };

    const handleNext = async () => {
        if (step === 1 && (accountMode === 'store' || accountMode === 'remote')) {
            if (!pairKey || pairKey.trim().length < 10) {
                toast.error(`A valid 16-character ${accountMode === 'remote' ? 'Remote Access' : 'Store Terminal'} Key is mandatory to proceed.`);
                return;
            }
            const userEmail = session?.user?.email || JSON.parse(localStorage.getItem('quantro_auth_user') || '{}')?.email || '';
            setLoading(true);
            try {
                const res = await api.pairStoreTerminal(pairKey.trim(), userEmail);
                if (res.store) {
                    localStorage.setItem('quantro_is_child_terminal', 'true');
                    localStorage.setItem('quantro_store_id', String(res.store.id));
                    
                    // Pre-fill the form with paired Store details
                    setForm(prev => ({
                        ...prev,
                        shop_name: res.store.name || 'Quantro Store',
                        gstin: res.store.gstin || '',
                        place_of_supply: res.store.place_of_supply || '',
                        phone: res.store.phone || '',
                        email: res.store.email || userEmail,
                        logo_url: res.store.logo_url || ''
                    }));
                    
                    toast.success(`Terminal paired with ${res.store.name}!`);
                }
            } catch (err) {
                toast.error(err.message || "16-character terminal key verification failed");
                setLoading(false);
                return;
            } finally {
                setLoading(false);
            }
        }

        if (accountMode === 'hq') {
            if (step === 2 && !form.shop_name.trim()) {
                toast.error("Shop / Business Name is required");
                return;
            }
            if (step === 4) {
                if (form.pos_pin && form.pos_pin.length !== 4) {
                    toast.error("Security POS PIN must be exactly 4 digits");
                    return;
                }
            }
        } else if (accountMode === 'remote') {
            if (step === 2) {
                const actualReason = remoteReason === 'Other' ? customReason : remoteReason;
                if (!actualReason || !actualReason.trim()) {
                    toast.error("Please specify your reason for Remote Access");
                    return;
                }
            }
        }

        if (step < totalSteps) {
            setStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(prev => prev - 1);
        }
    };

    const handleFinish = async () => {
        setLoading(true);
        try {
            // Save device context
            localStorage.setItem('quantro_device_type', accountMode);
            localStorage.setItem('quantro_is_hq', accountMode === 'hq' ? 'true' : 'false');
            localStorage.setItem('quantro_is_remote', accountMode === 'remote' ? 'true' : 'false');
            localStorage.setItem('quantro_onboarding_completed', '1');

            if (form.email) {
                localStorage.setItem(`quantro_onboarding_completed_${form.email.trim().toLowerCase()}`, '1');
            }
            if (accountMode === 'remote') {
                const actualReason = remoteReason === 'Other' ? customReason : remoteReason;
                localStorage.setItem('quantro_remote_reason', actualReason);
            }

            // 1. Save business profile settings
            await api.updateSettings({
                shop_name: form.shop_name || 'Quantro',
                gstin: form.gstin,
                place_of_supply: form.place_of_supply,
                phone: form.phone,
                email: form.email,
                logo_url: form.logo_url,
                onboarding_completed: '1',
                terminal_type: accountMode
            });

            // 2. Create primary staff profile only for HQ mode.
            if (form.email && accountMode === 'hq') {
                try {
                    await api.createEmployee({
                        full_name: form.shop_name || 'Primary Admin',
                        email: form.email.trim().toLowerCase(),
                        pos_pin: form.pos_pin || '1234',
                        password: 'Quantro123!',
                        role: 'OWNER',
                        restrict_to_terminals: 0
                    });
                } catch (empErr) {
                    console.warn('[Onboarding] Staff profile creation notice:', empErr.message);
                }
            }

            toast.success(`Quantro ERP Onboarding Completed (${accountMode.toUpperCase()} Mode)!`);
            if (onComplete) onComplete();
        } catch (err) {
            console.error('[Onboarding] Save settings error:', err);
            toast.error(err.message || "Failed to complete onboarding");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="onboarding-overlay">
            <div className="onboarding-modal-card">
                {/* Full-Page Progress Container */}
                <div className="onboarding-progress-container">
                    <div className="onboarding-step-header">
                        <span className="step-label">Step {step} of {totalSteps}</span>
                        <span className="step-title">{stepTitles[step - 1]}</span>
                        <span className="step-percent">{progressPercentage}% Completed</span>
                    </div>

                    <div className="segmented-progress-bar">
                        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                            <div 
                                key={s} 
                                className={`progress-segment ${s <= step ? 'active' : ''}`} 
                            />
                        ))}
                    </div>
                </div>

                {/* Step Contents */}
                <div className="onboarding-body" style={{ flex: 1, padding: '40px max(40px, 5vw)' }}>
                    {/* STEP 1: System Architecture & Terminal Selection */}
                    {step === 1 && (
                        <div className="onboarding-step-content">
                            <h2 className="step-heading">WELCOME TO QUANTRO ERP</h2>
                            <p className="step-desc">Select how this computer or device is being onboarded into your ERP network:</p>

                            <div className="account-mode-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '24px' }}>
                                {/* Card 1: HQ Terminal */}
                                <div 
                                    className={`mode-card ${accountMode === 'hq' ? 'selected' : ''}`}
                                    onClick={() => setAccountMode('hq')}
                                    style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
                                >
                                    <div className="mode-card-icon" style={{ marginBottom: '12px' }}><Icons.Building size={32} /></div>
                                    <div className="mode-card-info">
                                        <h4 style={{ fontSize: '16px', fontWeight: '700' }}>HQ Terminal</h4>
                                        <p style={{ fontSize: '13px', marginTop: '8px', color: 'var(--text-secondary, #64748b)' }}>
                                            Head Office PCs & Warehouse Management (Full Admin Access)
                                        </p>
                                    </div>
                                </div>

                                {/* Card 2: Store Terminal */}
                                <div 
                                    className={`mode-card ${accountMode === 'store' ? 'selected' : ''}`}
                                    onClick={() => setAccountMode('store')}
                                    style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
                                >
                                    <div className="mode-card-icon" style={{ marginBottom: '12px' }}><Icons.Store size={32} /></div>
                                    <div className="mode-card-info">
                                        <h4 style={{ fontSize: '16px', fontWeight: '700' }}>Store Terminal</h4>
                                        <p style={{ fontSize: '13px', marginTop: '8px', color: 'var(--text-secondary, #64748b)' }}>
                                            Connect Stores & Local Store ERP (POS & Local Ops)
                                        </p>
                                    </div>
                                </div>

                                {/* Card 3: Remote Access */}
                                <div 
                                    className={`mode-card ${accountMode === 'remote' ? 'selected' : ''}`}
                                    onClick={() => setAccountMode('remote')}
                                    style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
                                >
                                    <div className="mode-card-icon" style={{ marginBottom: '12px' }}><Icons.Globe size={32} /></div>
                                    <div className="mode-card-info">
                                        <h4 style={{ fontSize: '16px', fontWeight: '700' }}>Remote Access</h4>
                                        <p style={{ fontSize: '13px', marginTop: '8px', color: 'var(--text-secondary, #64748b)' }}>
                                            Easy to Control Remote ERP (Read-Only & Approvals)
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {(accountMode === 'store' || accountMode === 'remote') && (
                                <div className="form-group" style={{ marginTop: '28px', maxWidth: '500px', margin: '28px auto 0 auto' }}>
                                    <label style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                                        16-Character {accountMode === 'remote' ? 'Remote Access' : 'Store Terminal'} Key *
                                    </label>
                                    <input 
                                        type="text"
                                        required
                                        value={pairKey}
                                        onChange={e => setPairKey(e.target.value)}
                                        placeholder="e.g. STR-873F-CECD-662C"
                                        style={{ fontFamily: 'monospace', fontSize: '16px', letterSpacing: '2px', textAlign: 'center', padding: '12px' }}
                                    />
                                    <span style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px', display: 'block' }}>
                                        * Compulsory: You must enter a valid 16-character key to connect this terminal.
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* HQ STEP 2: Shop & Business Profile */}
                    {step === 2 && accountMode === 'hq' && (
                        <div className="onboarding-step-content" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                            <h2 className="step-heading">Shop / Business Profile</h2>
                            <p className="step-desc">Enter your primary store identity displayed on customer invoices and receipts.</p>

                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label>Shop / Business Name *</label>
                                <input 
                                    type="text"
                                    required
                                    value={form.shop_name}
                                    onChange={e => setForm({ ...form, shop_name: e.target.value })}
                                    placeholder="e.g. Quantro"
                                />
                            </div>
                        </div>
                    )}

                    {/* STORE STEP 2: Connected Status & Connected HQ */}
                    {step === 2 && accountMode === 'store' && (
                        <div className="onboarding-step-content" style={{ maxWidth: '600px', margin: '0 auto', width: '100%', textAlign: 'center' }}>
                            <div style={{ fontSize: '56px', marginBottom: '16px' }}>⚡</div>
                            <h2 className="step-heading">Terminal Connected Successfully!</h2>
                            <p className="step-desc" style={{ marginBottom: '24px' }}>
                                This terminal has been paired and linked to your corporate Head Office.
                            </p>
                            
                            <div style={{
                                background: 'var(--bg-secondary, #f8fafc)',
                                border: '1px solid var(--border, #e2e8f0)',
                                borderRadius: '12px',
                                padding: '24px',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '20px',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                            }}>
                                <div style={{
                                    width: '72px',
                                    height: '72px',
                                    borderRadius: '8px',
                                    background: '#e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    flexShrink: 0
                                }}>
                                    {form.logo_url ? (
                                        <img src={form.logo_url} alt="HQ Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <Icons.Building size={32} style={{ color: '#64748b' }} />
                                    )}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{form.shop_name}</h3>
                                    <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}><strong>GSTIN:</strong> {form.gstin || 'N/A'}</p>
                                    <p style={{ fontSize: '14px', color: '#64748b', marginTop: '2px' }}><strong>Place of Supply:</strong> {form.place_of_supply || 'N/A'}</p>
                                    <p style={{ fontSize: '14px', color: '#64748b', marginTop: '2px' }}><strong>Linked Phone:</strong> {form.phone || 'N/A'}</p>
                                </div>
                            </div>

                            <div style={{
                                marginTop: '24px',
                                padding: '12px 16px',
                                background: 'rgba(34,197,94,0.1)',
                                borderRadius: '8px',
                                color: '#16a34a',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span>●</span> Connected to HQ Company Profile
                            </div>
                        </div>
                    )}

                    {/* REMOTE STEP 2: Remote Access Purpose */}
                    {step === 2 && accountMode === 'remote' && (
                        <div className="onboarding-step-content" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                            <h2 className="step-heading">Why do you need to use Remote Access?</h2>
                            <p className="step-desc">Specify your main operations purpose for this remote access terminal session.</p>

                            <div className="form-group" style={{ marginTop: '20px' }}>
                                <label>Access Purpose *</label>
                                <select 
                                    value={remoteReason}
                                    onChange={e => setRemoteReason(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border, #e2e8f0)',
                                        background: '#fff',
                                        fontSize: '15px'
                                    }}
                                >
                                    <option value="Work from Home">Work from Home / Offsite Operations</option>
                                    <option value="Mobile Management">Mobile Management & Quick Audit</option>
                                    <option value="Offsite Auditing">External Auditing & Tax Preparation</option>
                                    <option value="Emergency Access">Emergency Troubleshooting & Support</option>
                                    <option value="Other">Other (Specify Custom Reason)</option>
                                </select>
                            </div>

                            {remoteReason === 'Other' && (
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label>Specify Custom Reason *</label>
                                    <input 
                                        type="text"
                                        required
                                        value={customReason}
                                        onChange={e => setCustomReason(e.target.value)}
                                        placeholder="e.g. Monitoring stock levels while travelling"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* HQ STEP 3: Tax & GSTIN Registration */}
                    {step === 3 && accountMode === 'hq' && (
                        <div className="onboarding-step-content" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                            <h2 className="step-heading">GSTIN & Tax Registration</h2>
                            <p className="step-desc">Configure your regional GSTIN and place of supply for compliant tax invoices.</p>

                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label>GSTIN Number</label>
                                <input 
                                    type="text"
                                    value={form.gstin}
                                    onChange={e => setForm({ ...form, gstin: e.target.value })}
                                    placeholder="e.g. 24AAAAA0000A1Z5"
                                />
                            </div>

                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label>Default Place of Supply</label>
                                <input 
                                    type="text"
                                    value={form.place_of_supply}
                                    onChange={e => setForm({ ...form, place_of_supply: e.target.value })}
                                    placeholder="e.g. 09-Uttar Pradesh"
                                />
                            </div>
                        </div>
                    )}

                    {/* REMOTE STEP 3: Welcome Back & Session Launch */}
                    {step === 3 && accountMode === 'remote' && (
                        <div className="onboarding-step-content" style={{ maxWidth: '600px', margin: '0 auto', width: '100%', textAlign: 'center' }}>
                            <div style={{ fontSize: '56px', marginBottom: '16px' }}>👤</div>
                            <h2 className="step-heading">
                                Welcome Back, {
                                    (() => {
                                        const authUser = JSON.parse(localStorage.getItem('quantro_auth_user') || 'null');
                                        return authUser?.full_name || session?.user?.email?.split('@')[0] || 'User';
                                    })()
                                }!
                            </h2>
                            <p className="step-desc" style={{ marginBottom: '24px' }}>
                                Remote authorization completed. Launching your workspace.
                            </p>

                            <div style={{
                                background: 'var(--bg-secondary, #f8fafc)',
                                border: '1px solid var(--border, #e2e8f0)',
                                borderRadius: '12px',
                                padding: '24px',
                                textAlign: 'left',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                maxWidth: '440px',
                                margin: '0 auto'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span style={{ color: '#64748b' }}>Account Email:</span>
                                    <strong style={{ marginLeft: 'auto' }}>{
                                        (() => {
                                            const authUser = JSON.parse(localStorage.getItem('quantro_auth_user') || 'null');
                                            return authUser?.email || session?.user?.email || 'N/A';
                                        })()
                                    }</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span style={{ color: '#64748b' }}>Authorized Role:</span>
                                    <strong style={{
                                        marginLeft: 'auto',
                                        background: '#eff6ff',
                                        color: '#2563eb',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: '700'
                                    }}>{
                                        (() => {
                                            const authUser = JSON.parse(localStorage.getItem('quantro_auth_user') || 'null');
                                            return authUser?.role || 'STAFF';
                                        })()
                                    }</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b' }}>Access Purpose:</span>
                                    <strong style={{ marginLeft: 'auto', color: '#475569', fontSize: '13px' }}>
                                        {remoteReason === 'Other' ? customReason : remoteReason}
                                    </strong>
                                </div>
                            </div>

                            <div style={{
                                marginTop: '24px',
                                padding: '12px 16px',
                                background: 'rgba(34,197,94,0.1)',
                                borderRadius: '8px',
                                color: '#16a34a',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span>●</span> Remote Session Authenticated
                            </div>
                        </div>
                    )}

                    {/* HQ STEP 4: Contact & Email (+ PIN only for HQ mode) */}
                    {step === 4 && accountMode === 'hq' && (
                        <div className="onboarding-step-content" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                            <h2 className="step-heading">Contact, Account Email & Security PIN</h2>
                            <p className="step-desc">Set your owner account email and a 4-digit PIN for instant POS terminal profile switching.</p>

                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label>Helpline Phone Number</label>
                                <input 
                                    type="text"
                                    value={form.phone}
                                    onChange={e => setForm({ ...form, phone: e.target.value })}
                                    placeholder="e.g. +91 98765 43210"
                                />
                            </div>

                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label>Account Email Address *</label>
                                <input 
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    placeholder="e.g. admin@store.com"
                                />
                            </div>

                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label>Create 4-Digit Security POS PIN * (for Profile Switching)</label>
                                <input 
                                    type="password"
                                    maxLength={4}
                                    required
                                    value={form.pos_pin}
                                    onChange={e => setForm({ ...form, pos_pin: e.target.value.replace(/\D/g, '') })}
                                    placeholder="1234"
                                    style={{ fontSize: '18px', letterSpacing: '4px', fontWeight: 'bold' }}
                                />
                                <span style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', display: 'block' }}>
                                    ℹ️ This PIN is used to switch between staff profiles on this terminal.
                                </span>
                            </div>
                        </div>
                    )}

                    {/* HQ STEP 5: Business Logo & Final Launch */}
                    {step === 5 && accountMode === 'hq' && (
                        <div className="onboarding-step-content" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                            <h2 className="step-heading">Business Logo & Branding</h2>
                            <p className="step-desc">Upload your official brand logo for printed customer invoices and receipts.</p>

                            {/* Logo Upload Dropzone */}
                            <div 
                                className="logo-upload-dropzone"
                                onClick={() => document.getElementById('onboarding-logo-input').click()}
                            >
                                {form.logo_url ? (
                                    <div className="logo-preview-box">
                                        <img src={form.logo_url} alt="Business Logo" className="logo-preview-img" />
                                        <span className="change-logo-text">Click to Change Logo</span>
                                    </div>
                                ) : (
                                    <div className="upload-placeholder-box">
                                        <div className="upload-icon-circle"><Icons.Upload size={24} /></div>
                                        <span className="upload-title">Click to browse or drop your logo file</span>
                                        <span className="upload-sub">PNG, JPG or WebP (Max 2MB)</span>
                                    </div>
                                )}
                                <input 
                                    type="file" 
                                    id="onboarding-logo-input"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    style={{ display: 'none' }}
                                />
                            </div>

                            <div className="summary-preview-card" style={{ marginTop: '16px' }}>
                                <div className="summary-row">
                                    <span>Selected Architecture:</span>
                                    <strong style={{ color: 'var(--accent, #6366f1)' }}>{accountMode.toUpperCase()} TERMINAL</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Business Name:</span>
                                    <strong>{form.shop_name}</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Account Email:</span>
                                    <strong>{form.email || 'N/A'}</strong>
                                </div>
                                <div className="summary-row">
                                    <span>4-Digit Security PIN:</span>
                                    <strong>•••• ({form.pos_pin || '1234'})</strong>
                                </div>
                                <div className="summary-row">
                                    <span>GSTIN:</span>
                                    <strong>{form.gstin || 'Not Provided'}</strong>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="onboarding-footer" style={{ padding: '20px 40px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                    <SButton 
                        variant="secondary"
                        onClick={handleBack}
                        disabled={step === 1 || loading}
                    >
                        Back
                    </SButton>

                    {step < totalSteps ? (
                        <SButton 
                            variant="primary"
                            onClick={handleNext}
                            disabled={loading}
                        >
                            Next Step
                        </SButton>
                    ) : (
                        <SButton 
                            variant="primary"
                            onClick={handleFinish}
                            disabled={loading}
                        >
                            {loading ? "Launching Quantro..." : "Complete Setup & Launch"}
                        </SButton>
                    )}
                </div>
            </div>
        </div>
    );
}
