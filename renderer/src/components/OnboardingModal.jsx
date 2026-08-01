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
        logo_url: ''
    });

    if (!isOpen) return null;

    const totalSteps = 5;
    const progressPercentage = (step / totalSteps) * 100;

    const stepTitles = [
        "Store & Terminal Alignment",
        "Shop & Business Profile",
        "GSTIN & Tax Registration",
        "Contact & Communications",
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

            // Save business profile settings
            await api.updateSettings({
                shop_name: form.shop_name || 'Quantro',
                gstin: form.gstin,
                place_of_supply: form.place_of_supply,
                phone: form.phone,
                email: form.email,
                logo_url: form.logo_url,
                onboarding_completed: '1'
            });

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

                    {/* STEP 4: Contact & Communications */}
                    {step === 4 && (
                        <div className="onboarding-step-content">
                            <h2 className="step-heading">Contact & Communications</h2>
                            <p className="step-desc">Provide customer helpline phone number and store billing email address.</p>

                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label>Phone Number</label>
                                <input 
                                    type="text"
                                    value={form.phone}
                                    onChange={e => setForm({ ...form, phone: e.target.value })}
                                    placeholder="e.g. +91 98765 43210"
                                />
                            </div>

                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label>Email Address</label>
                                <input 
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    placeholder="e.g. contact@business.com"
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
                                <div className="summary-row">
                                    <span>Contact Email:</span>
                                    <strong>{form.email || 'N/A'}</strong>
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
                        <Icons.ArrowLeft size={16} /> Back
                    </SButton>

                    {step < totalSteps ? (
                        <SButton 
                            variant="primary" 
                            onClick={handleNext} 
                            loading={loading}
                        >
                            Continue <Icons.ArrowRight size={16} />
                        </SButton>
                    ) : (
                        <SButton 
                            variant="primary" 
                            onClick={handleFinish} 
                            loading={loading}
                            style={{ background: '#16a34a' }}
                        >
                            Finish & Launch Quantro <Icons.Check size={16} />
                        </SButton>
                    )}
                </div>
            </div>
        </div>
    );
}
