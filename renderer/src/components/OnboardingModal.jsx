import React, { useState } from 'react';
import api from '../api';
import { toast } from 'sonner';
import { Icons } from './Icons';
import SButton from './SButton';
import './OnboardingModal.css';

export default function OnboardingModal({ isOpen, onComplete }) {
    const [step, setStep] = useState(1);
    const [accountMode, setAccountMode] = useState('hq'); // 'hq' or 'child'
    const [pairKey, setPairKey] = useState('');
    const [loading, setLoading] = useState(false);

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

    const totalSteps = 5;
    const progressPercentage = (step / totalSteps) * 100;

    const stepTitles = [
        "Store & Terminal Alignment",
        "Shop & Business Profile",
        "GSTIN & Tax Registration",
        "Contact, Email & 4-Digit Security PIN",
        "Business Logo & Final Launch"
    ];

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
        if (step === 1 && accountMode === 'child') {
            if (!pairKey || pairKey.trim().length < 10) {
                toast.error("Please enter a valid 16-character Branch Pairing Token");
                return;
            }
            // Pair terminal with Parent HQ
            setLoading(true);
            try {
                const res = await api.pairStoreTerminal(pairKey.trim());
                if (res.store) {
                    localStorage.setItem('quantro_is_child_terminal', 'true');
                    toast.success(`Paired with ${res.store.name}!`);
                }
            } catch (err) {
                toast.error(err.message || "Pairing token verification failed");
                setLoading(false);
                return;
            }
            setLoading(false);
        }

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
            localStorage.setItem('quantro_onboarding_completed', '1');

            // 1. Save business profile settings
            await api.updateSettings({
                shop_name: form.shop_name || 'Quantro',
                gstin: form.gstin,
                place_of_supply: form.place_of_supply,
                phone: form.phone,
                email: form.email,
                logo_url: form.logo_url,
                onboarding_completed: '1'
            });

            // 2. Create/update primary staff profile with 4-digit PIN in SQLite & Supabase
            if (form.email) {
                try {
                    await api.createEmployee({
                        full_name: form.shop_name || 'Primary Admin',
                        email: form.email.trim().toLowerCase(),
                        pos_pin: form.pos_pin || '1234',
                        password: 'Quantro123!',
                        role: 'ADMIN'
                    });
                } catch (empErr) {
                    console.warn('[Onboarding] Staff profile creation notice:', empErr.message);
                }
            }

            toast.success("Onboarding Completed! Welcome to Quantro ERP.");
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
                {/* Segmented Broken Progress Bar */}
                <div className="onboarding-progress-container">
                    <div className="onboarding-step-header">
                        <span className="step-label">Step {step} of {totalSteps}</span>
                        <span className="step-title">{stepTitles[step - 1]}</span>
                        <span className="step-percent">{progressPercentage}% Completed</span>
                    </div>

                    <div className="segmented-progress-bar">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <div 
                                key={s} 
                                className={`progress-segment ${s <= step ? 'active' : ''}`} 
                            />
                        ))}
                    </div>
                </div>

                {/* Step Contents */}
                <div className="onboarding-body">
                    {/* STEP 1: Store & Terminal Alignment */}
                    {step === 1 && (
                        <div className="onboarding-step-content">
                            <h2 className="step-heading">Welcome to Quantro ERP</h2>
                            <p className="step-desc">Choose how this computer terminal connects to your retail business network.</p>

                            <div className="account-mode-grid">
                                <div 
                                    className={`mode-card ${accountMode === 'hq' ? 'selected' : ''}`}
                                    onClick={() => setAccountMode('hq')}
                                >
                                    <div className="mode-card-icon"><Icons.Building size={24} /></div>
                                    <div className="mode-card-info">
                                        <h4>Create Primary HQ Account</h4>
                                        <p>Set up an independent main store warehouse & HQ management hub.</p>
                                    </div>
                                </div>

                                <div 
                                    className={`mode-card ${accountMode === 'child' ? 'selected' : ''}`}
                                    onClick={() => setAccountMode('child')}
                                >
                                    <div className="mode-card-icon"><Icons.Store size={24} /></div>
                                    <div className="mode-card-info">
                                        <h4>Connect to Parent HQ Network</h4>
                                        <p>Align this terminal as a Child Branch using a 16-character Pairing Token.</p>
                                    </div>
                                </div>
                            </div>

                            {accountMode === 'child' && (
                                <div className="form-group" style={{ marginTop: '20px' }}>
                                    <label>16-Character Branch Pairing Token *</label>
                                    <input 
                                        type="text"
                                        value={pairKey}
                                        onChange={e => setPairKey(e.target.value)}
                                        placeholder="e.g. STR-873F-CECD-662C"
                                        style={{ fontFamily: 'monospace', fontSize: '15px', letterSpacing: '1px', textAlign: 'center' }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: Shop & Business Profile */}
                    {step === 2 && (
                        <div className="onboarding-step-content">
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

                    {/* STEP 3: Tax & GSTIN Registration */}
                    {step === 3 && (
                        <div className="onboarding-step-content">
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

                    {/* STEP 4: Contact, Email & 4-Digit Security PIN */}
                    {step === 4 && (
                        <div className="onboarding-step-content">
                            <h2 className="step-heading">Contact, Account Email & Security PIN</h2>
                            <p className="step-desc">Set your account email and a 4-digit PIN for 1-second POS terminal profile switching.</p>

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
                                <label>Create 4-Digit Security POS PIN * (for 1-second Profile Login)</label>
                                <input 
                                    type="password"
                                    maxLength={4}
                                    required
                                    value={form.pos_pin}
                                    onChange={e => setForm({ ...form, pos_pin: e.target.value.replace(/\D/g, '') })}
                                    placeholder="1234"
                                    style={{ fontSize: '18px', letterSpacing: '4px', fontWeight: 'bold' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 5: Business Logo & Final Launch */}
                    {step === 5 && (
                        <div className="onboarding-step-content">
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
                                <div className="summary-row">
                                    <span>Place of Supply:</span>
                                    <strong>{form.place_of_supply || 'Default'}</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Contact Phone:</span>
                                    <strong>{form.phone || 'N/A'}</strong>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="onboarding-footer">
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
