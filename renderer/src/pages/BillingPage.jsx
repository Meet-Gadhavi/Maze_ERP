import { useState, useEffect } from 'react';
import api from '../api';
import SButton from '../components/SButton';
import { Icons } from '../components/Icons';
import { toast } from 'sonner';
import { supabase } from '../supabase';
import Skeleton from '../components/Skeleton';

export default function BillingPage() {
    const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && import.meta.env.DEV;
    // Always use the production web URL
    const webBaseUrl = 'https://quantro-web.onrender.com';

    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showRazorpay, setShowRazorpay] = useState(false);
    const [showPaymentSetupModal, setShowPaymentSetupModal] = useState(false);
    const [enableAutopay, setEnableAutopay] = useState(true);
    const [paymentDetails, setPaymentDetails] = useState({
        cardName: '',
        cardNumber: '4111 2222 3333 4444',
        cardExpiry: '12/28',
        cardCvv: '123'
    });
    const [paying, setPaying] = useState(false);
    const [paymentMode, setPaymentMode] = useState('card');
    const [upiId, setUpiId] = useState('');

    // Plan Upgrade Modal States
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [upgradePlan, setUpgradePlan] = useState('');
    const [newLicenseKey, setNewLicenseKey] = useState('');
    const [upgradeVerifying, setUpgradeVerifying] = useState(false);
    const [upgradeError, setUpgradeError] = useState('');

    const [termsAccepted, setTermsAccepted] = useState(false);
    const [licenseDetails, setLicenseDetails] = useState(null);

    // Cancellation Code Modal States
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancellationCode, setCancellationCode] = useState('');
    const [cancelVerifying, setCancelVerifying] = useState(false);
    const [cancelError, setCancelError] = useState('');

    // Credit Topup States
    const [showTopupModal, setShowTopupModal] = useState(false);
    const [topupAmount, setTopupAmount] = useState('500');
    const [topupLoading, setTopupLoading] = useState(false);

    const handleTopupCredit = async (amountVal) => {
        const amt = Number(amountVal || topupAmount);
        if (!amt || amt <= 0) {
            toast.error('Please enter a valid top-up amount');
            return;
        }
        setTopupLoading(true);
        try {
            await api.topupCredit(amt, `Razorpay Top-up via quantro-web (₹${amt})`);
            toast.success(`Successfully added ₹${amt.toFixed(2)} wallet credit!`);
            setShowTopupModal(false);
            loadBillingStatus();
        } catch (err) {
            toast.error(err.message || 'Failed to process top-up');
        } finally {
            setTopupLoading(false);
        }
    };

    useEffect(() => {
        async function fetchLicense() {
            if (status && status.licenseKey && status.licensePlan !== 'Free') {
                try {
                    const { data, error } = await supabase
                        .from('licenses')
                        .select('*')
                        .eq('license_key', status.licenseKey)
                        .maybeSingle();
                    if (!error && data) {
                        setLicenseDetails(data);
                    }
                } catch (e) {
                    console.error('Failed to fetch license details:', e);
                }
            } else {
                setLicenseDetails(null);
            }
        }
        fetchLicense();
    }, [status]);

    const getSubscriptionEndDate = () => {
        if (!licenseDetails || !licenseDetails.created_at) return '';
        const createdDate = new Date(licenseDetails.created_at);
        createdDate.setDate(createdDate.getDate() + 30);
        return createdDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const loadBillingStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getBillingStatus();
            setStatus(data);
        } catch (e) {
            console.error('Failed to load billing status:', e);
            setError(e.message || 'Failed to retrieve billing status data.');
            toast.error('Failed to retrieve billing status data.');
        } finally {
            setLoading(false);
        }
    };

    const openExternalLink = (url) => {
        if (window.maze && typeof window.maze.openExternal === 'function') {
            window.maze.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    };

    useEffect(() => {
        loadBillingStatus();
    }, []);

    const handleConfirmPaymentSetup = () => {
        if (!termsAccepted) {
            toast.error('You must accept the Terms & Conditions, Privacy Policy, and Refund Policy to proceed.');
            return;
        }
        setShowPaymentSetupModal(false);
        setTermsAccepted(false);

        const url = `${webBaseUrl}/?page=add-card&syncId=${status?.syncId || ''}&sync_id=${status?.syncId || ''}&email=${encodeURIComponent(status?.email || '')}&autopay=${enableAutopay ? 'true' : 'false'}`;
        openExternalLink(url);
        toast.info('Opening Quantro Web Portal to complete 1 Rupee verification checkout.');
    };

    const handleBuyEmailPackage = async () => {
        try {
            await api.buyEmailPackage();
            toast.success('Transactional Email Package purchased! Limit increased to 50,000 emails/mo.');
            loadBillingStatus();
        } catch (e) {
            toast.error(e.message || 'Failed to buy email package.');
        }
    };

    const handleRazorpayPay = async () => {
        if (paymentMode === 'upi') {
            if (!upiId || !upiId.includes('@') || upiId.trim().startsWith('@') || upiId.trim().endsWith('@')) {
                toast.error('Please enter a valid UPI ID (e.g., username@bank).');
                return;
            }
        }
        setPaying(true);
        setTimeout(async () => {
            try {
                await api.payDues();
                if (paymentMode === 'upi' && enableAutopay) {
                    await api.addPaymentMethod({
                        enableAutopay: true,
                        brand: 'UPI',
                        last4: upiId.trim(),
                        expiry: 'N/A'
                    });
                }
                toast.success('Razorpay Payment Successful! All dues cleared and services active.');
                setShowRazorpay(false);
                setPaying(false);
                loadBillingStatus();
            } catch (e) {
                toast.error(e.message || 'Payment failed. Try again.');
                setPaying(false);
            }
        }, 1500);
    };

    const formatSecondsToMinutes = (sec) => {
        const mins = Math.floor(sec / 60);
        const secs = sec % 60;
        return `${mins}m ${secs}s`;
    };

    const handleUpgrade = (plan) => {
        setUpgradePlan(plan);
        setNewLicenseKey('');
        setUpgradeError('');
        setShowUpgradeModal(true);
        openExternalLink('https://quantro-web.onrender.com/pricing');
    };

    const handleVerifyUpgrade = async () => {
        if (!newLicenseKey.trim()) {
            setUpgradeError('Please enter your new license activation key.');
            return;
        }

        setUpgradeVerifying(true);
        setUpgradeError('');
        const loadingId = toast.loading('Verifying updated license key in Supabase...');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('No active user session found. Please re-login.');
            }

            const { data, error } = await supabase
                .from('licenses')
                .select('*')
                .eq('license_key', newLicenseKey.trim())
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                const invalidErr = 'Invalid activation key. Please check the spelling and try again.';
                setUpgradeError(invalidErr);
                toast.error(invalidErr, { id: loadingId });
                setUpgradeVerifying(false);
                return;
            }

            if (data.user_id !== user.id) {
                if (data.email === user.email) {
                    // Sync user_id if email matches
                    await supabase
                        .from('licenses')
                        .update({ user_id: user.id })
                        .eq('id', data.id);
                } else {
                    const diffAccountError = `This key is registered to a different account (${data.email || 'another user'}).`;
                    setUpgradeError(diffAccountError);
                    toast.error(diffAccountError, { id: loadingId });
                    setUpgradeVerifying(false);
                    return;
                }
            }

            if (data.status !== 'Active') {
                const inactiveError = `This license key is currently ${data.status}.`;
                setUpgradeError(inactiveError);
                toast.error(inactiveError, { id: loadingId });
                setUpgradeVerifying(false);
                return;
            }

            // Save details to SQLite settings
            await api.updateSettings({
                license_key: data.license_key,
                license_plan: data.plan,
                license_status: data.status,
                license_user_id: user.id
            });

            // Sync with local backend
            try {
                await api.upgradeSubscription(data.plan);
            } catch (err) {
                console.warn('Local API update failed:', err.message);
            }

            toast.success(`Welcome to Quantro ${data.plan}! Plan activated successfully.`, { id: loadingId });
            setShowUpgradeModal(false);
            loadBillingStatus();
        } catch (err) {
            console.error('Upgrade verification error:', err);
            const failError = `Verification failed: ${err.message}`;
            setUpgradeError(failError);
            toast.error(failError, { id: loadingId });
        } finally {
            setUpgradeVerifying(false);
        }
    };

    const handleCancel = async () => {
        if (!window.confirm('Are you sure you want to cancel your subscription? You will be downgraded to the Free tier.')) {
            return;
        }
        setCancellationCode('');
        setCancelError('');
        setCancelVerifying(false);
        setShowCancelModal(true);
        const loadingId = toast.loading('Sending cancellation verification code to your email...');
        try {
            const res = await api.sendCancellationCode();
            if (res.success) {
                toast.success(res.message || 'Verification code sent to your email.', { id: loadingId });
            } else {
                toast.error(res.message || 'Failed to send verification code.', { id: loadingId });
            }
        } catch (e) {
            console.error('Failed to send cancellation code:', e);
            toast.error(e.message || 'Failed to send verification code.', { id: loadingId });
        }
    };

    const handleConfirmCancellation = async () => {
        if (!cancellationCode.trim()) {
            setCancelError('Please enter the 6-digit confirmation code.');
            return;
        }
        setCancelVerifying(true);
        setCancelError('');
        const loadingId = toast.loading('Confirming cancellation...');

        try {
            await api.confirmCancellation(cancellationCode.trim());

            const { data: { user } } = await supabase.auth.getUser();
            if (user && status.licenseKey) {
                const { error: supabaseError } = await supabase
                    .from('licenses')
                    .update({ plan: 'Free', price: 0, status: 'Active' })
                    .eq('license_key', status.licenseKey)
                    .eq('user_id', user.id);
                
                if (supabaseError) throw supabaseError;
            }

            toast.success('Subscription cancelled successfully. Plan is now Free Starter.', { id: loadingId });
            setShowCancelModal(false);
            loadBillingStatus();
        } catch (err) {
            console.error('Cancellation confirmation error:', err);
            const failError = err.message || 'Verification failed.';
            setCancelError(failError);
            toast.error(failError, { id: loadingId });
        } finally {
            setCancelVerifying(false);
        }
    };

    const handleRemoveCard = async () => {
        if (!window.confirm('Are you sure you want to remove your saved payment method? WhatsApp template alerts and Voice Agent calling will be disabled.')) {
            return;
        }
        const loadingId = toast.loading('Removing payment method securely...');
        try {
            await api.removePaymentMethod();
            toast.success('Payment method successfully removed.', { id: loadingId });
            loadBillingStatus();
        } catch (e) {
            toast.error(e.message || 'Failed to remove payment method.', { id: loadingId });
        }
    };

    if (loading) {
        return (
            <div className="page-content" style={{ padding: '24px' }}>
                <div className="page-header" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div className="skeleton-box skeleton-avatar" />
                        <div>
                            <div className="skeleton-box skeleton-title" style={{ width: '180px' }} />
                            <div className="skeleton-box skeleton-text" style={{ width: '350px' }} />
                        </div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="skeleton-card" style={{ height: '180px' }}>
                            <div className="skeleton-box skeleton-title" />
                            <div className="skeleton-box skeleton-text" />
                            <div className="skeleton-box skeleton-button" style={{ marginTop: '16px' }} />
                        </div>
                        <div className="skeleton-card" style={{ height: '150px' }}>
                            <div className="skeleton-box skeleton-title" />
                            <div className="skeleton-box skeleton-text" />
                        </div>
                    </div>
                    <div className="skeleton-card" style={{ height: '300px' }}>
                        <div className="skeleton-box skeleton-title" />
                        <div className="skeleton-box skeleton-text" />
                        <div className="skeleton-box skeleton-text" style={{ width: '80%' }} />
                        <div className="skeleton-box skeleton-button" style={{ marginTop: '24px', width: '100%' }} />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !status) {
        return (
            <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '16px' }}>
                <Icons.AlertTriangle size={48} style={{ color: 'var(--danger)' }} />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Connection Error</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', maxWidth: '360px' }}>
                    {error || 'Failed to retrieve billing status data. Please verify the backend service is running.'}
                </p>
                <SButton variant="primary" onClick={loadBillingStatus}>
                    Retry Connection
                </SButton>
            </div>
        );
    }

    const dues = status?.dues || {
        whatsappCost: 0,
        voiceCost: 0,
        emailCost: 0,
        numberCost: 0,
        emailPackageDue: 0,
        subscriptionCost: 0,
        totalDue: 0
    };
    const creditLedger = Array.isArray(status?.creditLedger) ? status.creditLedger : [];
    const creditBalance = Number(status?.creditBalance || 0);

    return (
        <div className="page-content">
            {/* Header Section */}
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '8px' }}>
                        <Icons.CreditCard size={24} />
                    </div>
                    <div>
                        <h1 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Billing & Subscription</h1>
                        <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                            Monitor automation usage limits, pricing parameters, and pay outstanding service dues.
                        </p>
                    </div>
                </div>
            </div>

            {/* Block Warning Alert Banner */}
            {status.isBlocked && (
                <div style={{
                    background: 'rgba(255, 59, 48, 0.08)',
                    border: '1px solid rgba(255, 59, 48, 0.2)',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    color: 'var(--danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '24px',
                    animation: 'pulse 2s infinite'
                }}>
                    <Icons.AlertTriangle size={24} />
                    <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '15px' }}>Automations Blocked</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--danger)' }}>
                            Services are suspended because you have outstanding dues of <strong>₹{(dues.totalDue || 0).toFixed(2)}</strong> past the 5-day grace period (due by the 5th). Please clear dues to reactivate services.
                        </p>
                    </div>
                    <SButton variant="primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => setShowRazorpay(true)}>
                        Pay Outstanding Balance
                    </SButton>
                </div>
            )}

            {/* Main Billing Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px', alignItems: 'start' }}>
                
                {/* Left Column: Services & Pricing Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Subscription Plan Card */}
                    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    padding: '8px', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '8px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Icons.Award size={20} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                                        Active Plan: {status.licensePlan === 'Free' ? 'Free Starter' : status.licensePlan === 'Pro' ? 'Business PRO' : 'AI Professional'}
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                            License key: <code style={{ fontFamily: 'monospace', background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: '4px' }}>{status.licenseKey || 'N/A'}</code>
                                        </span>
                                        {status.licensePlan !== 'Free' && getSubscriptionEndDate() && (
                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                End of subscription: <strong style={{ color: 'var(--text-primary)' }}>{getSubscriptionEndDate()}</strong>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <span style={{ 
                                fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', 
                                padding: '4px 10px', borderRadius: '12px',
                                background: status.licensePlan === 'Free' ? 'var(--bg-secondary)' : 'rgba(16, 185, 129, 0.1)',
                                color: status.licensePlan === 'Free' ? 'var(--text-secondary)' : 'rgb(16, 185, 129)',
                                border: '1px solid ' + (status.licensePlan === 'Free' ? 'var(--border)' : 'rgba(16, 185, 129, 0.2)')
                            }}>
                                {status.licensePlan === 'Free' ? 'Starter' : status.licenseStatus === 'Active' ? 'PRO' : 'Active'}
                            </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {status.licensePlan === 'Free' && 'Standard local billing with SQLite. Upgrade to enable WhatsApp marketing dispatches, credit limit controls, and voice calling agent subscriptions.'}
                            {status.licensePlan === 'Pro' && 'Business PRO tier includes WhatsApp Campaign scheduler, credit limit checks, payment integrations, and automated notifications.'}
                            {status.licensePlan === 'Professional' && 'AI Professional tier includes autonomous OpenCode Zen AI Responders, Voice calling agent subscriptions, and auto-profiling converters.'}
                        </p>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                            {status.licensePlan === 'Free' && (
                                <>
                                    <SButton variant="primary" style={{ flex: 1 }} onClick={() => handleUpgrade('Pro')}>
                                        Upgrade to PRO (₹499/mo)
                                    </SButton>
                                    <SButton variant="primary" style={{ flex: 1, background: 'var(--purple)', borderColor: 'var(--purple)' }} onClick={() => handleUpgrade('Professional')}>
                                        Go Professional (₹1199/mo)
                                    </SButton>
                                </>
                            )}
                            {status.licensePlan === 'Pro' && (
                                <>
                                    <SButton variant="primary" style={{ flex: 1, background: 'var(--purple)', borderColor: 'var(--purple)' }} onClick={() => handleUpgrade('Professional')}>
                                        Upgrade to Professional (₹1199/mo)
                                    </SButton>
                                    <SButton variant="secondary" style={{ color: 'var(--danger)' }} onClick={handleCancel}>
                                        Cancel Subscription
                                    </SButton>
                                </>
                            )}
                            {status.licensePlan === 'Professional' && (
                                <SButton variant="secondary" style={{ flex: 1, color: 'var(--danger)' }} onClick={handleCancel}>
                                    Cancel Professional Subscription
                                </SButton>
                            )}
                        </div>
                    </div>

                    {/* Pay-As-You-Go Wallet Credit Card */}
                    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(37, 211, 102, 0.05) 100%)', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '12px', background: 'var(--accent)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
                                }}>
                                    <Icons.Wallet size={22} />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Quantro Pay-As-You-Go Wallet</h3>
                                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(52, 199, 89, 0.15)', color: '#128C7E', border: '1px solid currentColor' }}>
                                            Live Credit Balance
                                        </span>
                                    </div>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        Real-time usage balance for WhatsApp API, Gmail Delivery, and AI Voice Calling services.
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Available Balance</span>
                                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                                        ₹{creditBalance.toFixed(2)}
                                    </div>
                                </div>
                                <SButton variant="primary" onClick={() => setShowTopupModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px' }}>
                                    <Icons.PlusCircle size={16} />
                                    Top-Up Credit
                                </SButton>
                            </div>
                        </div>

                        {/* Service Rates Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', background: '#ffffff', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(37, 211, 102, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src="./whatsapp-icon.png" alt="WA" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>WhatsApp API</div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#128C7E' }}>₹0.30 / message</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(234, 67, 53, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src="./gmail-icon.png" alt="Gmail" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Gmail Delivery</div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#ea4335' }}>₹0.05 / email</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(147, 51, 234, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src="./mazeway.png" alt="Voice" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>AI Voice Agent</div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#9333ea' }}>₹10.00 / minute</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Credit Deduction Log & Transaction Ledger Table */}
                    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Credit Deduction Log &amp; Transaction History</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    Itemized ledger of all service deductions and Razorpay credit top-ups synchronized with Quantro Web.
                                </p>
                            </div>
                            <SButton variant="secondary" size="small" onClick={loadBillingStatus} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Icons.RefreshCw size={14} />
                                Refresh Log
                            </SButton>
                        </div>

                        {(!creditLedger || creditLedger.length === 0) ? (
                            <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px', background: 'var(--bg-soft)', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                                No credit transactions logged yet. Deductions will appear here automatically when messages or calls are triggered.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            <th style={{ padding: '12px 16px' }}>Date &amp; Time</th>
                                            <th style={{ padding: '12px 16px' }}>Service</th>
                                            <th style={{ padding: '12px 16px' }}>Description</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Units</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Wallet Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {creditLedger.map((row, idx) => {
                                            const isTopup = row.service_type === 'Credit Top-up' || row.amount > 0;
                                            const badgeBg = row.service_type === 'WhatsApp' ? 'rgba(37, 211, 102, 0.12)' :
                                                            row.service_type === 'Email' ? 'rgba(234, 67, 53, 0.12)' :
                                                            row.service_type === 'Voice Agent' ? 'rgba(147, 51, 234, 0.12)' : 'rgba(2, 132, 199, 0.12)';
                                            const badgeColor = row.service_type === 'WhatsApp' ? '#128C7E' :
                                                               row.service_type === 'Email' ? '#ea4335' :
                                                               row.service_type === 'Voice Agent' ? '#9333ea' : '#0284c7';
                                            return (
                                                <tr key={row.id || idx} style={{ borderBottom: idx < status.creditLedger.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                                    <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                                        {new Date(row.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: badgeBg, color: badgeColor }}>
                                                            {row.service_type}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                                        {row.description || 'Service usage deduction'}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                        {row.units_used || 1}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: isTopup ? '#16a34a' : '#dc2626' }}>
                                                        {isTopup ? `+₹${Math.abs(row.amount).toFixed(2)}` : `-₹${Math.abs(row.amount).toFixed(2)}`}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        ₹{(row.balance_after || 0).toFixed(2)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Gmail Email Overages */}
                    {!status.gmailConnected ? (
                        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255, 149, 0, 0.04)', border: '1px solid rgba(255, 149, 0, 0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc',
                                    border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
                                }}>
                                    <img src="./gmail-icon.png" alt="Gmail" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Gmail API Delivery Service</h3>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Gmail is not connected to enable transactions</span>
                                </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Please connect your Gmail account in the Automation page to enable auto-emails and transactional package subscriptions.
                            </p>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc',
                                        border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
                                    }}>
                                        <img src="./gmail-icon.png" alt="Gmail" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Gmail API Delivery Service</h3>
                                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                            {status.emailPackageActive ? 'Transactional Plan Active' : 'Standard Free Plan'}
                                        </span>
                                    </div>
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 600, background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '12px' }}>
                                    ₹0.05 / email overage
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Emails Sent This Cycle</span>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                                        {status.emailSentCount} <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)' }}>/ {status.emailPackageActive ? '50,000' : '1,000 free'}</span>
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Overage Cost</span>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                                        ₹{dues.emailCost.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                            {!status.emailPackageActive && (
                                <SButton 
                                    variant="secondary" 
                                    disabled={status.emailSentCount < 1000}
                                    onClick={handleBuyEmailPackage}
                                >
                                    {status.emailSentCount < 1000 
                                        ? `Upgrade available after daily free limit is reached (${status.emailSentCount}/1000 sent)`
                                        : "Upgrade to Transactional Package (₹2500/mo - 50k Limit)"}
                                </SButton>
                            )}
                        </div>
                    )}

                    {/* WhatsApp Non-CSW Messages */}
                    {!status.whatsappConnected ? (
                        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255, 149, 0, 0.04)', border: '1px solid rgba(255, 149, 0, 0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc',
                                    border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
                                }}>
                                    <img src="./whatsapp-icon.png" alt="WhatsApp" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>WhatsApp Service</h3>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>WhatsApp is not connected to enable transactions</span>
                                </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Please connect your WhatsApp Business account in the Automation page to enable auto-notifications and campaign templates.
                            </p>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc',
                                        border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
                                    }}>
                                        <img src="./whatsapp-icon.png" alt="WhatsApp" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>WhatsApp API Service</h3>
                                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                            {!status.paymentMethodAdded ? 'Action Required: Add Payment Method' : 'Authorized'}
                                        </span>
                                    </div>
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 600, background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '12px' }}>
                                    ₹0.30 / message (Flat Rate)
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Billed Messages</span>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                                        {status.whatsappNonCswCount}
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Accumulated Cost</span>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                                        ₹{dues.whatsappCost.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                            {!status.paymentMethodAdded && (
                                <SButton variant="secondary" onClick={() => setShowPaymentSetupModal(true)}>
                                    Add Payment Method to Enable WhatsApp Templates
                                </SButton>
                            )}
                        </div>
                    )}

                    {/* Voice Calling Agent */}
                    {!status.voiceAgentCreated ? (
                        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255, 149, 0, 0.04)', border: '1px solid rgba(255, 149, 0, 0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc',
                                    border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
                                }}>
                                    <img src="./mazeway.png" alt="Voice Agent" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>AI Voice Agent Calling</h3>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Get Voice Agent to enable transactions</span>
                                </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Please create your first voice calling agent in the Automation page to enable auto-notifications and campaign templates and furthermore transactions.
                            </p>
                        </div>
                    ) : !status.phoneNumberPurchased ? (
                        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255, 149, 0, 0.04)', border: '1px solid rgba(255, 149, 0, 0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc',
                                    border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
                                }}>
                                    <img src="./mazeway.png" alt="Voice Agent" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>AI Voice Agent Calling</h3>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Voice Agent is provisioning to enable transactions</span>
                                </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Your AI Voice Agent is currently being provisioned by the admin. Please wait for approval to get your dedicated VoIP number.
                            </p>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc',
                                        border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
                                    }}>
                                        <img src="./mazeway.png" alt="Voice Agent" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>AI Voice Agent Calling</h3>
                                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                            {!status.paymentMethodAdded ? 'Action Required: Add Payment Method' : 'Authorized'}
                                        </span>
                                    </div>
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 600, background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '12px' }}>
                                    ₹10.00 / minute
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Call Time Usage</span>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                                        {formatSecondsToMinutes(status.voiceAgentSeconds)}
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Accumulated Cost</span>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                                        ₹{dues.voiceCost.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                            {!status.paymentMethodAdded && (
                                <SButton variant="secondary" onClick={() => setShowPaymentSetupModal(true)}>
                                    Add Payment Method to Enable AI Voice calling
                                </SButton>
                            )}
                        </div>
                    )}

                    {/* VoIP / Dedicated Number Card */}
                    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc',
                                    border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
                                }}>
                                    <img src="./mazeway.png" alt="VoIP Number" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Dedicated VoIP Number</h3>
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                        {status.phoneNumberPurchased ? `Active: ${status.phoneNumberDetails}` : 'No VoIP Number Active'}
                                    </span>
                                </div>
                            </div>
                            {status.phoneNumberPurchased && (
                                <span style={{ fontSize: '12px', fontWeight: 600, background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '12px' }}>
                                    Active Subscription
                                </span>
                            )}
                        </div>
                        
                        {status.phoneNumberPurchased ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Dedicated Number Cost</span>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                                        ₹{dues.numberCost.toFixed(2)} / mo
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Status</span>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--success)', marginTop: '4px' }}>
                                        Active & Provisioned
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255, 59, 48, 0.02)', border: '1px dashed rgba(255, 59, 48, 0.15)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    You don't own active VoIP number
                                </span>
                                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                    To get one, please create and buy an agent in the Automation page first.
                                </p>
                            </div>
                        )}
                    </div>

                </div>

                {/* Right Column: Summary Box and Payment Method */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Summary Dues Box */}
                    <div className="card" style={{ padding: '24px', background: 'linear-gradient(180deg, var(--bg-card), var(--bg-secondary))' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800 }}>Account Summary</h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Email Overages:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>₹{dues.emailCost.toFixed(2)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>WhatsApp API Messages:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>₹{dues.whatsappCost.toFixed(2)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Voice Calling Agent:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>₹{dues.voiceCost.toFixed(2)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>VoIP Subscriptions:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>₹{dues.numberCost.toFixed(2)}</strong>
                            </div>
                            {dues.emailPackageDue > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Email Package Purchase:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>₹{dues.emailPackageDue.toFixed(2)}</strong>
                                </div>
                            )}
                            {dues.subscriptionCost > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Subscription Plan ({status.licensePlan}):</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>₹{dues.subscriptionCost.toFixed(2)}</strong>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Outstanding Due</span>
                            <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent)' }}>₹{dues.totalDue.toFixed(2)}</span>
                        </div>

                        <SButton 
                            variant="primary" 
                            style={{ width: '100%', padding: '12px' }}
                            disabled={dues.totalDue <= 0}
                            onClick={() => setShowRazorpay(true)}
                        >
                            Pay All Dues at Once (Razorpay)
                        </SButton>
                        
                        <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                            * Dues are calculated at the end of the month (28th–30th). Unpaid balances past the 5-day grace period (due on the 5th) will suspend automation services.
                        </div>
                    </div>

                    {/* Payment Method Added Card */}
                    <div className="card" style={{ padding: '20px' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700 }}>Payment Method</h3>
                        {status.paymentMethodAdded ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    {status.paymentMethodBrand === 'UPI' ? (
                                        <div style={{
                                            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                            color: '#ffffff',
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '20px',
                                            minWidth: '36px'
                                        }}>
                                            UPI
                                        </div>
                                    ) : status.paymentMethodLast4 === 'Netbanking' ? (
                                        <div style={{
                                            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                            color: '#ffffff',
                                            fontSize: '9px',
                                            fontWeight: 'bold',
                                            padding: '4px 6px',
                                            borderRadius: '6px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '20px',
                                            minWidth: '36px'
                                        }}>
                                            BANK
                                        </div>
                                    ) : (
                                        <img src="./mazeway.png" alt="Razorpay" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                    )}
                                    <div style={{ flex: 1 }}>
                                        {status.paymentMethodBrand === 'UPI' ? (
                                            <div style={{ fontSize: '13px', fontWeight: 600 }}>UPI ID: {status.paymentMethodLast4}</div>
                                        ) : status.paymentMethodLast4 === 'Netbanking' ? (
                                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{status.paymentMethodBrand} Netbanking</div>
                                        ) : (
                                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{status.paymentMethodBrand} ending in {status.paymentMethodLast4}</div>
                                        )}
                                        {status.paymentMethodBrand !== 'UPI' && status.paymentMethodExpiry !== 'N/A' && (
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Expires {status.paymentMethodExpiry}</div>
                                        )}
                                    </div>
                                    <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(52, 199, 89, 0.1)', color: '#278a3e', padding: '2px 6px', borderRadius: '10px', marginRight: '8px' }}>
                                        Default
                                    </span>
                                    <span 
                                        onClick={handleRemoveCard}
                                        style={{ fontSize: '11px', fontWeight: 650, color: 'var(--danger)', cursor: 'pointer', textDecoration: 'underline', marginLeft: 'auto' }}
                                    >
                                        {status.paymentMethodBrand === 'UPI' ? 'Remove UPI' : 'Remove Card'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Icons.ShieldCheck size={14} style={{ color: 'var(--success)' }} />
                                    <span>
                                        {status.paymentMethodAutopay 
                                            ? 'Autopay enabled via Razorpay.' 
                                            : 'Autopay not enabled. Outstanding bills must be paid manually.'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px 16px', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                                <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '14px', fontWeight: 500 }}>No payment method configured</div>
                                <SButton variant="secondary" style={{ width: '100%' }} onClick={() => setShowPaymentSetupModal(true)}>
                                    Setup Payment Method (Visa / Master Card)
                                </SButton>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Setup Payment Method Authorization Dialog Popup */}
            {showPaymentSetupModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: '#ffffff', width: '420px', borderRadius: '16px',
                        overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)'
                    }}>
                        {/* Header */}
                        <div style={{ background: 'var(--accent)', color: '#ffffff', padding: '20px 24px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Set Up Payment Method</h3>
                            <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
                                Link your card securely on the Quantro Web Portal
                            </p>
                        </div>
                        
                        {/* Body */}
                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                Setting up your payment method requires a refundable <strong>₹1.00</strong> transaction to verify card details. This process will happen securely on the Quantro Web Portal.
                            </div>

                            {/* Terms Checkbox */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Legal Agreements</div>
                                <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer', userSelect: 'none' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={termsAccepted} 
                                        onChange={(e) => setTermsAccepted(e.target.checked)} 
                                        style={{ marginTop: '3px' }}
                                    />
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        I have read and agree to Quantro's{' '}
                                        <a href="#" onClick={(e) => { e.preventDefault(); openExternalLink(`${webBaseUrl}/?page=terms`); }} style={{ color: 'var(--accent)', fontWeight: 650, textDecoration: 'underline' }}>Terms of Service</a>,{' '}
                                        <a href="#" onClick={(e) => { e.preventDefault(); openExternalLink(`${webBaseUrl}/?page=privacy`); }} style={{ color: 'var(--accent)', fontWeight: 650, textDecoration: 'underline' }}>Privacy Policy</a>, and{' '}
                                        <a href="#" onClick={(e) => { e.preventDefault(); openExternalLink(`${webBaseUrl}/?page=refund`); }} style={{ color: 'var(--accent)', fontWeight: 650, textDecoration: 'underline' }}>Refund Policy</a>.
                                    </div>
                                </label>
                            </div>

                            {/* Autopay Checkbox */}
                            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', userSelect: 'none' }}>
                                <input 
                                    type="checkbox" 
                                    checked={enableAutopay} 
                                    onChange={(e) => setEnableAutopay(e.target.checked)} 
                                    style={{ marginTop: '3px' }}
                                />
                                <div>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Enable Autopay</span>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        Automatically charge future outstanding balances via Razorpay on the 5th of the month.
                                    </p>
                                </div>
                            </label>
                        </div>

                        {/* Footer */}
                        <div style={{ background: '#f8fafc', padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)' }}>
                            <SButton variant="secondary" onClick={() => { setShowPaymentSetupModal(false); setTermsAccepted(false); }}>
                                Cancel
                            </SButton>
                            <SButton variant="primary" style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }} disabled={!termsAccepted} onClick={handleConfirmPaymentSetup}>
                                Link Card on Website (₹1.00)
                            </SButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Subscription Cancellation Verification Code Modal */}
            {showCancelModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: '#ffffff', width: '420px', borderRadius: '16px',
                        overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)'
                    }}>
                        {/* Header */}
                        <div style={{ background: 'var(--danger)', color: '#ffffff', padding: '20px 24px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Confirm Subscription Cancellation</h3>
                            <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
                                Enter verification code sent to your email
                            </p>
                        </div>
                        
                        {/* Body */}
                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                We have sent a 6-digit confirmation code to your email. Please enter it below to authorize the cancellation of your paid tier.
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>6-Digit Code</label>
                                <input 
                                    type="text" 
                                    className="input-text" 
                                    value={cancellationCode} 
                                    onChange={(e) => setCancellationCode(e.target.value)} 
                                    placeholder="Enter 6-digit code" 
                                    maxLength={6}
                                    style={{ height: '38px', fontSize: '16px', fontWeight: 'bold', textAlign: 'center', letterSpacing: '4px' }} 
                                />
                            </div>

                            {cancelError && (
                                <div style={{
                                    padding: '10px 14px',
                                    background: '#fef2f2',
                                    color: '#b91c1c',
                                    border: '1px solid #fee2e2',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    lineHeight: '1.4',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <Icons.AlertCircle size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
                                    <span>{cancelError}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ background: '#f8fafc', padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)' }}>
                            <SButton variant="secondary" disabled={cancelVerifying} onClick={() => setShowCancelModal(false)}>
                                Cancel
                            </SButton>
                            <SButton variant="primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} disabled={cancelVerifying} onClick={handleConfirmCancellation}>
                                {cancelVerifying ? 'Downgrading...' : 'Verify & Downgrade Plan'}
                            </SButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Simulated Razorpay Checkout Dialog Portal Overlay */}
            {showRazorpay && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: '#ffffff', width: '380px', borderRadius: '16px',
                        overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)'
                    }}>
                        
                        {/* Razorpay Brand Header */}
                        <div style={{ background: '#172554', color: '#ffffff', padding: '24px 20px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '1px' }}>Razorpay Secure Checkout</div>
                                <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 800 }}>Quantro ERP</h3>
                            </div>
                            <span style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>₹{dues.totalDue.toFixed(2)}</span>
                        </div>

                        {/* Payment Method Selector Tab */}
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', margin: '20px 20px 0 20px' }}>
                            <button
                                type="button"
                                onClick={() => setPaymentMode('card')}
                                style={{
                                    flex: 1,
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: paymentMode === 'card' ? '#ffffff' : 'transparent',
                                    color: paymentMode === 'card' ? '#1e293b' : '#64748b',
                                    boxShadow: paymentMode === 'card' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Icons.CreditCard size={15} />
                                Card
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMode('upi')}
                                style={{
                                    flex: 1,
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: paymentMode === 'upi' ? '#ffffff' : 'transparent',
                                    color: paymentMode === 'upi' ? '#1e293b' : '#64748b',
                                    boxShadow: paymentMode === 'upi' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <div style={{
                                    background: paymentMode === 'upi' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : '#94a3b8',
                                    color: '#ffffff',
                                    fontSize: '8px',
                                    fontWeight: 'bold',
                                    padding: '2px 4px',
                                    borderRadius: '3px',
                                    lineHeight: 1
                                }}>UPI</div>
                                UPI / VPA
                            </button>
                        </div>

                        {/* Razorpay Body */}
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {paymentMode === 'card' ? (
                                <>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Cardholder Name</label>
                                        <input 
                                            type="text" 
                                            className="input-text" 
                                            value={paymentDetails.cardName || 'Valued Customer'} 
                                            onChange={(e) => setPaymentDetails({ ...paymentDetails, cardName: e.target.value })} 
                                            placeholder="Enter your name" 
                                            style={{ height: '36px', fontSize: '13px' }} 
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Card Number</label>
                                        <input 
                                            type="text" 
                                            className="input-text" 
                                            value={paymentDetails.cardNumber} 
                                            onChange={(e) => setPaymentDetails({ ...paymentDetails, cardNumber: e.target.value })} 
                                            style={{ height: '36px', fontSize: '13px' }} 
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Expiry</label>
                                            <input 
                                                type="text" 
                                                className="input-text" 
                                                value={paymentDetails.cardExpiry} 
                                                onChange={(e) => setPaymentDetails({ ...paymentDetails, cardExpiry: e.target.value })} 
                                                placeholder="MM/YY" 
                                                style={{ height: '36px', fontSize: '13px' }} 
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>CVV</label>
                                            <input 
                                                type="password" 
                                                className="input-text" 
                                                value={paymentDetails.cardCvv} 
                                                onChange={(e) => setPaymentDetails({ ...paymentDetails, cardCvv: e.target.value })} 
                                                placeholder="•••" 
                                                style={{ height: '36px', fontSize: '13px' }} 
                                            />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>UPI ID (VPA)</label>
                                        <input 
                                            type="text" 
                                            className="input-text" 
                                            value={upiId} 
                                            onChange={(e) => setUpiId(e.target.value)} 
                                            placeholder="mobile@ybl or user@upi" 
                                            style={{ height: '36px', fontSize: '13px' }} 
                                        />
                                    </div>

                                    <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', userSelect: 'none', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={enableAutopay} 
                                            onChange={(e) => setEnableAutopay(e.target.checked)} 
                                            style={{ marginTop: '3px' }}
                                        />
                                        <div>
                                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Enable UPI Autopay</span>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#64748b', lineHeight: 1.3 }}>
                                                Securely authorize Quantro to charge future outstanding bills to this UPI account.
                                            </p>
                                        </div>
                                    </label>
                                </>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#278a3e', fontSize: '11px', marginTop: '4px' }}>
                                <Icons.ShieldCheck size={16} />
                                <span>Secured by 256-bit SSL encryption.</span>
                            </div>
                        </div>

                        {/* Razorpay Footer */}
                        <div style={{ background: '#f8fafc', padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)' }}>
                            <SButton variant="secondary" disabled={paying} onClick={() => setShowRazorpay(false)}>
                                Cancel
                            </SButton>
                            <SButton variant="primary" style={{ background: '#0a6eff', borderColor: '#0a6eff' }} disabled={paying} onClick={handleRazorpayPay}>
                                {paying ? 'Processing Securely...' : `Pay ₹${dues.totalDue.toFixed(2)}`}
                            </SButton>
                        </div>

                    </div>
                </div>
            )}

            {/* Plan Upgrade Verification Input Modal */}
            {showUpgradeModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: '#ffffff', width: '420px', borderRadius: '16px',
                        overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)'
                    }}>
                        {/* Header */}
                        <div style={{ background: 'var(--accent)', color: '#ffffff', padding: '20px 24px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Activate Upgraded Plan</h3>
                            <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
                                Unlock {upgradePlan} tier features
                            </p>
                        </div>
                        
                        {/* Body */}
                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                We have redirected you to the website to purchase your <strong>{upgradePlan}</strong> upgrade. After completing the payment, please paste your new activation key below to activate the plan tier.
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>License Key</label>
                                <input 
                                    type="text" 
                                    className="input-text" 
                                    value={newLicenseKey} 
                                    onChange={(e) => setNewLicenseKey(e.target.value)} 
                                    placeholder="QTY-XXXX-XXXX-XXXX" 
                                    style={{ height: '38px', fontSize: '13.5px', fontFamily: 'monospace' }} 
                                />
                            </div>

                            {upgradeError && (
                                <div style={{
                                    padding: '10px 14px',
                                    background: '#fef2f2',
                                    color: '#b91c1c',
                                    border: '1px solid #fee2e2',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    lineHeight: '1.4',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <Icons.AlertCircle size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
                                    <span>{upgradeError}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ background: '#f8fafc', padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)' }}>
                            <SButton variant="secondary" disabled={upgradeVerifying} onClick={() => setShowUpgradeModal(false)}>
                                Cancel
                            </SButton>
                            <SButton variant="primary" style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }} disabled={upgradeVerifying} onClick={handleVerifyUpgrade}>
                                {upgradeVerifying ? 'Activating Plan...' : 'Verify & Activate'}
                            </SButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Pay-As-You-Go Credit Topup Modal */}
            {showTopupModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icons.Wallet size={20} />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Top-Up Wallet Credits</h3>
                            </div>
                            <button onClick={() => setShowTopupModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                                <Icons.X size={18} />
                            </button>
                        </div>

                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                            Recharge your Quantro ERP wallet to send WhatsApp API messages, Gmail invoice notifications, and run AI Voice agent calls.
                        </p>

                        {/* Quick Presets */}
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Select Preset Amount</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {['250', '500', '1000'].map(amt => (
                                    <button
                                        key={amt}
                                        type="button"
                                        onClick={() => setTopupAmount(amt)}
                                        style={{
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: topupAmount === amt ? '2px solid var(--accent)' : '1px solid var(--border)',
                                            background: topupAmount === amt ? 'rgba(2, 132, 199, 0.08)' : '#fff',
                                            color: topupAmount === amt ? 'var(--accent)' : 'var(--text-primary)',
                                            fontWeight: 700,
                                            fontSize: '14px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ₹{amt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Input */}
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Or Enter Custom Amount (₹)</label>
                            <input
                                type="number"
                                className="input-text"
                                value={topupAmount}
                                onChange={(e) => setTopupAmount(e.target.value)}
                                placeholder="e.g. 500"
                                style={{ height: '40px', fontSize: '15px', fontWeight: 700 }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px' }}>
                            <SButton variant="primary" disabled={topupLoading} onClick={() => handleTopupCredit()} style={{ width: '100%', justifyContent: 'center' }}>
                                {topupLoading ? 'Adding Wallet Credit...' : `Add ₹${Number(topupAmount || 0).toFixed(2)} Wallet Credit`}
                            </SButton>
                            <SButton variant="secondary" onClick={() => {
                                const url = `${webBaseUrl}/?action=topup-credit&amount=${topupAmount}&syncId=${status?.syncId || ''}`;
                                openExternalLink(url);
                                toast.info('Opening Quantro Web Razorpay Checkout...');
                            }} style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}>
                                Pay via Razorpay on Quantro Web Website
                            </SButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
