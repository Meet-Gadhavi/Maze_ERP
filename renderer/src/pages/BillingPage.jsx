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

    // Activation / Upgrade Key Verification States
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [activationKey, setActivationKey] = useState('');
    const [keyVerifying, setKeyVerifying] = useState(false);
    const [keyError, setKeyError] = useState('');

    // Credit Topup States
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

            // Fetch live Supabase license details
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

    // Calculate ERP License Days Remaining
    const getLicenseDaysLeft = () => {
        if (!licenseDetails || !licenseDetails.expires_at) return null;
        const expiryDate = new Date(licenseDetails.expires_at);
        const now = new Date();
        const diffTime = expiryDate.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Calculate VoBiz Number Days Remaining
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
                    <Skeleton height="260px" borderRadius="16px" />
                    <Skeleton height="260px" borderRadius="16px" />
                    <Skeleton height="260px" borderRadius="16px" />
                </div>
            </div>
        );
    }

    const currentPlan = licenseDetails?.plan || status?.licensePlan || 'Free';
    const isPro = currentPlan !== 'Free';

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Page Header */}
            <div>
                <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    Billing & Subscriptions
                </h1>
                <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                    Manage your Quantro ERP license, VoBiz telephony numbers, and prepaid pay-as-you-go wallet.
                </p>
            </div>

            {/* Error Banner */}
            {error && (
                <div style={{ padding: '16px 20px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '12px', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icons.AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* Top Overview Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
                
                {/* 1. ERP LICENSE SUBSCRIPTION CARD */}
                <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(10, 110, 255, 0.1)', color: '#0A6EFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icons.Award size={22} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>ERP Subscription</h3>
                                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Quantro License Plan</span>
                                </div>
                            </div>
                            <span style={{
                                padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                                background: isPro ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                                color: isPro ? '#10B981' : 'var(--text-secondary)',
                                border: `1px solid ${isPro ? 'rgba(16, 185, 129, 0.2)' : 'var(--border)'}`
                            }}>
                                {isPro ? `${currentPlan} Active` : 'Free Starter'}
                            </span>
                        </div>

                        <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>License Key</span>
                                <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                                    {status?.licenseKey || 'QTY-FREE-STARTER-KEY'}
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Expiration Date:</span>
                                <strong style={{ fontSize: '13px', color: licenseDaysLeft !== null && licenseDaysLeft <= 5 ? '#DC2626' : 'var(--text-primary)' }}>
                                    {licenseDetails?.expires_at 
                                        ? new Date(licenseDetails.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : 'Never (Free Tier)'}
                                </strong>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        {isPro && (licenseDaysLeft === null || licenseDaysLeft <= 5) ? (
                            <SButton
                                variant="primary"
                                style={{ flex: 1, justifyContent: 'center' }}
                                onClick={() => openExternalLink(`${webBaseUrl}/renew?key=${encodeURIComponent(status?.licenseKey || '')}`)}
                            >
                                Renew Subscription
                            </SButton>
                        ) : (
                            <SButton
                                variant="primary"
                                style={{ flex: 1, justifyContent: 'center' }}
                                onClick={() => openExternalLink(`${webBaseUrl}/pricing`)}
                            >
                                {isPro ? 'Manage / Upgrade' : 'Get PRO License'}
                            </SButton>
                        )}
                        <SButton
                            variant="secondary"
                            onClick={() => setShowKeyModal(true)}
                            style={{ padding: '0 16px' }}
                        >
                            Enter Key
                        </SButton>
                    </div>
                </div>

                {/* 2. VOBIZ PHONE NUMBER & VOICE AGENT CARD */}
                <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icons.Phone size={22} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>VoBiz Phone Number</h3>
                                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Voice Calling Telephony</span>
                                </div>
                            </div>
                            <span style={{
                                padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                                background: status?.phoneNumberPurchased ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-secondary)',
                                color: status?.phoneNumberPurchased ? '#8B5CF6' : 'var(--text-secondary)',
                                border: `1px solid ${status?.phoneNumberPurchased ? 'rgba(139, 92, 246, 0.2)' : 'var(--border)'}`
                            }}>
                                {status?.phoneNumberPurchased ? 'Active Number' : 'Not Subscribed'}
                            </span>
                        </div>

                        <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Assigned Number</span>
                                <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                                    {status?.phoneNumberDetails || 'No Active Phone Number'}
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>VoBiz Expiration:</span>
                                <strong style={{ fontSize: '13px', color: vobizDaysLeft !== null && vobizDaysLeft <= 5 ? '#DC2626' : 'var(--text-primary)' }}>
                                    {licenseDetails?.vobiz_expires_at 
                                        ? new Date(licenseDetails.vobiz_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : (status?.phoneNumberPurchased ? 'Active Subscription' : 'N/A')}
                                </strong>
                            </div>
                        </div>

                        {/* Reallocation Grace Period Warning */}
                        {vobizDaysLeft !== null && vobizDaysLeft <= 5 && (
                            <div style={{ marginTop: '12px', padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', fontSize: '11px', color: '#991B1B', lineHeight: 1.4 }}>
                                <strong>Warning:</strong> Renew your VoBiz number now. Once your subscription ends, after a 2-day grace period, your phone number access will be provided to another user and your organization will have to buy a new VoBiz number.
                            </div>
                        )}
                    </div>

                    <div>
                        <SButton
                            variant="primary"
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => openExternalLink(`${webBaseUrl}/renew?key=${encodeURIComponent(status?.licenseKey || '')}&type=vobiz`)}
                        >
                            {vobizDaysLeft !== null && vobizDaysLeft <= 5 ? 'Renew VoBiz Number' : 'Buy / Renew VoBiz Number'}
                        </SButton>
                    </div>
                </div>

                {/* 3. PREPAID WALLET CARD */}
                <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icons.Wallet size={22} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Prepaid Wallet</h3>
                                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Pay-As-You-Go Credit Balance</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Available Balance</span>
                            <div style={{ fontSize: '32px', fontWeight: 800, color: (status?.creditBalance || 0) <= 10 ? '#DC2626' : '#10B981', marginTop: '4px', letterSpacing: '-0.02em' }}>
                                ₹{Number(status?.creditBalance || 0).toFixed(2)}
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px', display: 'block' }}>
                                Used for WhatsApp (₹0.30/msg) & Email dispatches (₹0.05/email)
                            </span>
                        </div>
                    </div>

                    <SButton
                        variant="primary"
                        style={{ width: '100%', justifyContent: 'center', backgroundColor: '#10B981' }}
                        onClick={() => setShowTopupModal(true)}
                    >
                        Top Up Wallet Balance
                    </SButton>
                </div>
            </div>

            {/* PREPAID TRANSACTIONS LEDGER */}
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
