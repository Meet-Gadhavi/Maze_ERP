import { useState, useEffect } from 'react';
import api from '../api';
import SButton from '../components/SButton';
import { Icons } from '../components/Icons';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import Skeleton from '../components/Skeleton';

export default function BillingPage() {
    const webBaseUrl = 'https://quantro-web.onrender.com';

    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [licenseDetails, setLicenseDetails] = useState(null);

    // Activation Key Modal States
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [activationKey, setActivationKey] = useState('');
    const [keyVerifying, setKeyVerifying] = useState(false);
    const [keyError, setKeyError] = useState('');

    // Credit Topup Modal States
    const [showTopupModal, setShowTopupModal] = useState(false);
    const [topupAmount, setTopupAmount] = useState('500');

    const openExternalLink = (url) => {
        if (window.maze && typeof window.maze.openExternal === 'function') {
            window.maze.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    };

    const loadBillingStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getBillingStatus();
            setStatus(data);

            if (data && data.licenseKey) {
                const { data: licenseData } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('license_key', data.licenseKey)
                    .maybeSingle();

                if (licenseData) {
                    setLicenseDetails(licenseData);
                }
            }
        } catch (e) {
            console.error('Failed to load billing status:', e);
            setError(e.message || 'Failed to retrieve billing status data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBillingStatus();
    }, []);

    const handleTopupCredit = (amountVal) => {
        const amt = Number(amountVal || topupAmount || 250);
        const url = `${webBaseUrl}/?page=top-up&amount=${amt}&email=${encodeURIComponent(status?.email || '')}&syncId=${status?.syncId || ''}`;
        openExternalLink(url);
        setShowTopupModal(false);
        toast.info(`Opening Quantro Web to top up ₹${amt.toFixed(2)} wallet credits.`);
    };

    const handleVerifyKey = async (e) => {
        if (e) e.preventDefault();
        if (!activationKey.trim()) {
            setKeyError('Please enter your license activation key.');
            return;
        }

        setKeyVerifying(true);
        setKeyError('');
        const loadingId = toast.loading('Verifying license key in Supabase...');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No active user session found.');

            const { data, error } = await supabase
                .from('licenses')
                .select('*')
                .eq('license_key', activationKey.trim())
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                const invalidErr = 'Invalid activation key. Please check spelling and try again.';
                setKeyError(invalidErr);
                toast.error(invalidErr, { id: loadingId });
                setKeyVerifying(false);
                return;
            }

            if (data.status !== 'Active') {
                const inactiveErr = `This license key is currently ${data.status}.`;
                setKeyError(inactiveErr);
                toast.error(inactiveErr, { id: loadingId });
                setKeyVerifying(false);
                return;
            }

            await api.updateSettings({
                license_key: data.license_key,
                license_plan: data.plan,
                license_status: data.status,
                license_user_id: user.id
            });

            toast.success(`License activated successfully! Plan: ${data.plan}`, { id: loadingId });
            setShowKeyModal(false);
            setActivationKey('');
            loadBillingStatus();
        } catch (err) {
            console.error('License key verification error:', err);
            const failError = `Verification failed: ${err.message}`;
            setKeyError(failError);
            toast.error(failError, { id: loadingId });
        } finally {
            setKeyVerifying(false);
        }
    };

    // Calculate Days Left for Subscription Expiration
    const getLicenseDaysLeft = () => {
        if (!licenseDetails || !licenseDetails.expires_at) return null;
        const expiryDate = new Date(licenseDetails.expires_at);
        const now = new Date();
        const diffTime = expiryDate.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Calculate Days Left for VoBiz Phone Number Expiration
    const getVobizDaysLeft = () => {
        if (!licenseDetails || !licenseDetails.vobiz_expires_at) return null;
        const expiryDate = new Date(licenseDetails.vobiz_expires_at);
        const now = new Date();
        const diffTime = expiryDate.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const licenseDaysLeft = getLicenseDaysLeft();
    const vobizDaysLeft = getVobizDaysLeft();

    if (loading) {
        return (
            <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
                <Skeleton width="240px" height="36px" style={{ marginBottom: '8px' }} />
                <Skeleton width="400px" height="20px" style={{ marginBottom: '32px' }} />
                <Skeleton height="300px" borderRadius="16px" style={{ marginBottom: '24px' }} />
                <Skeleton height="240px" borderRadius="16px" />
            </div>
        );
    }

    const currentPlan = licenseDetails?.plan || status?.licensePlan || 'Free';
    const isPro = currentPlan !== 'Free';

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Page Header */}
            <div>
                <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    Billing & Subscriptions
                </h1>
                <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                    Manage your Quantro ERP license plan, monthly usage billing, and prepaid pay-as-you-go wallet.
                </p>
            </div>

            {/* Error Banner */}
            {error && (
                <div style={{ padding: '16px 20px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '12px', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icons.AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* 1. MAIN ACCOUNT & LICENSE SUMMARY CARD */}
            <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                    
                    {/* Left: Active License Overview */}
                    <div style={{ flex: '1 1 320px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(10, 110, 255, 0.1)', color: '#0A6EFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icons.Award size={22} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    Active Plan: {isPro ? `${currentPlan} Tier` : 'Free Starter'}
                                </h2>
                                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                    License key: <code style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{status?.licenseKey || 'QTY-FREE-STARTER'}</code>
                                </span>
                            </div>
                        </div>

                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '8px' }}>
                            {isPro ? 'Pro plan subscription active with multi-channel automation & advanced ERP tooling.' : 'Free Starter plan with basic ERP features. Upgrade to PRO to unlock advanced automations.'}
                        </div>

                        {/* Expiration Date Info */}
                        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                Expiration Date: <strong style={{ color: licenseDaysLeft !== null && licenseDaysLeft <= 5 ? '#DC2626' : 'var(--text-primary)' }}>
                                    {licenseDetails?.expires_at 
                                        ? new Date(licenseDetails.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : 'Never (Free Tier)'}
                                </strong>
                            </div>

                            {/* Renew Button when <= 5 Days */}
                            {isPro && (licenseDaysLeft === null || licenseDaysLeft <= 5) && (
                                <SButton
                                    variant="primary"
                                    onClick={() => openExternalLink(`${webBaseUrl}/renew?key=${encodeURIComponent(status?.licenseKey || '')}`)}
                                    style={{ padding: '6px 14px', fontSize: '12px', height: '32px' }}
                                >
                                    Renew Subscription
                                </SButton>
                            )}
                        </div>
                    </div>

                    {/* Right: Wallet Credit Balance */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '20px 24px', borderRadius: '14px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '240px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prepaid Wallet Balance</span>
                        <div style={{ fontSize: '32px', fontWeight: 800, color: (status?.creditBalance || 0) <= 10 ? '#DC2626' : '#10B981', letterSpacing: '-0.02em' }}>
                            ₹{Number(status?.creditBalance || 0).toFixed(2)}
                        </div>
                        <SButton
                            variant="primary"
                            onClick={() => setShowTopupModal(true)}
                            style={{ backgroundColor: '#10B981', padding: '6px 16px', fontSize: '12px', height: '32px' }}
                        >
                            Top Up Balance
                        </SButton>
                    </div>
                </div>

                {/* Bottom Action Bar */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <SButton variant="primary" onClick={() => openExternalLink(`${webBaseUrl}/pricing`)}>
                        {isPro ? 'Manage / Upgrade Plan' : 'Upgrade to PRO'}
                    </SButton>
                    <SButton variant="secondary" onClick={() => setShowKeyModal(true)}>
                        Enter Activation Key
                    </SButton>
                </div>
            </div>

            {/* 2. MONTHLY BILLED & SERVICE USAGE RATES CARD */}
            <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Service Usage & Monthly Billing Rates
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Real-time monthly consumption for WhatsApp API, Email delivery, AI Voice Agents, and VoBiz phone numbers.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    
                    {/* WhatsApp API */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(37, 211, 102, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src="./whatsapp-icon.png" alt="WA" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                            </div>
                            <div>
                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>WhatsApp API</strong>
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block' }}>Monthly Billed</span>
                            </div>
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#128C7E', marginTop: '4px' }}>
                            ₹0.30 <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>/ message</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            Status: <strong style={{ color: status?.whatsappConnected ? '#10B981' : 'var(--text-tertiary)' }}>{status?.whatsappConnected ? 'Connected (QEIWA)' : 'Not Connected'}</strong>
                        </div>
                    </div>

                    {/* Gmail Delivery */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(234, 67, 53, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src="./gmail-icon.png" alt="Gmail" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                            </div>
                            <div>
                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Gmail Delivery</strong>
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block' }}>Monthly Billed</span>
                            </div>
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#EA4335', marginTop: '4px' }}>
                            ₹0.05 <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>/ email</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            Status: <strong style={{ color: status?.gmailConnected ? '#10B981' : 'var(--text-tertiary)' }}>{status?.gmailConnected ? 'Connected' : 'Not Connected'}</strong>
                        </div>
                    </div>

                    {/* AI Voice Agent */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(147, 51, 234, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src="./mazeway.png" alt="Voice" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                            </div>
                            <div>
                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>AI Voice Agent</strong>
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block' }}>Monthly Billed</span>
                            </div>
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#9333EA', marginTop: '4px' }}>
                            ₹10.00 <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>/ minute</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            Voice Seconds: <strong>{status?.voiceAgentSeconds || 0}s</strong>
                        </div>
                    </div>

                    {/* VoBiz Phone Number */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icons.Phone size={18} />
                            </div>
                            <div>
                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>VoBiz Phone Number</strong>
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block' }}>Telephony Subscription</span>
                            </div>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'monospace' }}>
                            {status?.phoneNumberDetails || 'No Active Phone Number'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>VoBiz Expiry:</span>
                            <strong style={{ color: vobizDaysLeft !== null && vobizDaysLeft <= 5 ? '#DC2626' : 'var(--text-primary)' }}>
                                {licenseDetails?.vobiz_expires_at 
                                    ? new Date(licenseDetails.vobiz_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                    : (status?.phoneNumberPurchased ? 'Active' : 'N/A')}
                            </strong>
                        </div>
                    </div>
                </div>

                {/* VoBiz Expiration Warning & Renew Button */}
                {vobizDaysLeft !== null && vobizDaysLeft <= 5 && (
                    <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '12px', color: '#991B1B', lineHeight: 1.4, flex: 1 }}>
                            <strong>Warning:</strong> Renew your VoBiz number now. Once your subscription ends, after a 2-day grace period, your phone number access will be provided to another user and your organization will have to buy a new VoBiz number.
                        </div>
                        <SButton
                            variant="primary"
                            style={{ backgroundColor: '#DC2626', padding: '6px 14px', fontSize: '12px', height: '32px' }}
                            onClick={() => openExternalLink(`${webBaseUrl}/renew?key=${encodeURIComponent(status?.licenseKey || '')}&type=vobiz`)}
                        >
                            Renew VoBiz Number
                        </SButton>
                    </div>
                )}
            </div>

            {/* 3. PREPAID TRANSACTIONS LEDGER TABLE */}
            <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Wallet Usage History</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Real-time deductions and top-ups recorded in your prepaid ledger.
                        </p>
                    </div>
                </div>

                {(!status?.creditLedger || status.creditLedger.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                        No transactions recorded yet in your prepaid wallet.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date & Time</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Service Type</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Description</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Balance After</th>
                                </tr>
                            </thead>
                            <tbody>
                                {status.creditLedger.map((row) => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                                            {new Date(row.timestamp || Date.now()).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {row.service_type}
                                        </td>
                                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                                            {row.description}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: row.amount > 0 ? '#10B981' : '#DC2626' }}>
                                            {row.amount > 0 ? `+₹${row.amount.toFixed(2)}` : `-₹${Math.abs(row.amount).toFixed(2)}`}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            ₹{Number(row.balance_after || 0).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* TOP UP MODAL */}
            {showTopupModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px' }}>
                    <div style={{ width: '100%', maxWidth: '440px', padding: '28px', borderRadius: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Top Up Prepaid Wallet</h3>
                            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                Select an amount to add funds directly to your wallet via Quantro Web.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            {['100', '250', '500', '1000', '2500', '5000'].map(amt => (
                                <button
                                    key={amt}
                                    onClick={() => setTopupAmount(amt)}
                                    style={{
                                        padding: '12px', borderRadius: '10px', border: topupAmount === amt ? '2px solid #10B981' : '1px solid var(--border)',
                                        background: topupAmount === amt ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)',
                                        fontWeight: 700, fontSize: '14px', color: topupAmount === amt ? '#10B981' : 'var(--text-primary)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ₹{amt}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <SButton variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowTopupModal(false)}>
                                Cancel
                            </SButton>
                            <SButton variant="primary" style={{ flex: 1, justifyContent: 'center', backgroundColor: '#10B981' }} onClick={() => handleTopupCredit(topupAmount)}>
                                Proceed to Pay
                            </SButton>
                        </div>
                    </div>
                </div>
            )}

            {/* ACTIVATION KEY ENTRY MODAL */}
            {showKeyModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px' }}>
                    <div style={{ width: '100%', maxWidth: '440px', padding: '28px', borderRadius: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Enter License Activation Key</h3>
                            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                Enter the license key purchased from Quantro Web pricing page.
                            </p>
                        </div>

                        <form onSubmit={handleVerifyKey} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input
                                type="text"
                                placeholder="QTY-XXXX-XXXX-XXXX"
                                value={activationKey}
                                onChange={(e) => setActivationKey(e.target.value)}
                                style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '14px', boxSizing: 'border-box' }}
                            />

                            {keyError && (
                                <div style={{ fontSize: '12px', color: '#DC2626', background: '#FEF2F2', padding: '8px 12px', borderRadius: '8px', border: '1px solid #FCA5A5' }}>
                                    {keyError}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <SButton variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowKeyModal(false)} type="button">
                                    Cancel
                                </SButton>
                                <SButton variant="primary" style={{ flex: 1, justifyContent: 'center' }} type="submit" loading={keyVerifying} disabled={keyVerifying}>
                                    Activate Key
                                </SButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
