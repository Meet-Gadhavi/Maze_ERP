import './styles/index.css';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { Component, useState, useEffect } from 'react';
import { supabase } from './supabase';
import Layout from './components/Layout';
import { Icons } from './components/Icons';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import SalesPage from './pages/SalesPage';
import CustomersPage from './pages/CustomersPage';
import SettingsPage from './pages/SettingsPage';
import PurchasePage from './pages/PurchasePage';
import AutomationPage from './pages/AutomationPage';
import BillingPage from './pages/BillingPage';
import AuthPage from './pages/AuthPage';
import CustomerDisplayPage from './pages/CustomerDisplayPage';
import api from './api';
import SButton from './components/SButton';

/**
 * M009: Global React Error Boundary — catches unhandled render/lifecycle errors
 * in any child component and shows a fallback UI instead of a white screen crash.
 */
class AppErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[Quantro] Render error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100vh', gap: '20px',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                    padding: '20px', textAlign: 'center'
                }}>
                    <div style={{ 
                        width: '64px', height: '64px', borderRadius: '16px', 
                        background: 'rgba(255, 59, 48, 0.1)', color: 'var(--danger)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '8px'
                    }}>
                        <Icons.AlertTriangle size={32} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                        <h2 style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>Something went wrong</h2>
                        <p style={{ color: 'var(--text-secondary)', margin: 0, maxWidth: 320, lineHeight: 1.5, fontSize: '14px' }}>
                            An unexpected error occurred in the system. Please reload the application to continue.
                        </p>
                    </div>
                    <SButton
                        variant="primary"
                        style={{ marginTop: '12px', padding: '12px 32px' }}
                        onClick={() => window.location.reload()}
                    >
                        Reload Application
                    </SButton>
                </div>
            );
        }
        return this.props.children;
    }
}

function ActivationGate({ session, onActivated }) {
    const [keyInput, setKeyInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleVerify = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        if (!keyInput.trim()) {
            setErrorMsg('Please enter your license activation key.');
            toast.error('Please enter your license activation key.');
            return;
        }

        setLoading(true);
        const loadingId = toast.loading('Verifying license activation key in Supabase...');

        try {
            const { data, error } = await supabase
                .from('licenses')
                .select('*')
                .eq('license_key', keyInput.trim())
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                const invalidError = 'Invalid activation key. Please check the spelling and try again.';
                setErrorMsg(invalidError);
                toast.error(invalidError, { id: loadingId });
                setLoading(false);
                return;
            }

            if (data.user_id !== session.user.id) {
                if (data.email === session.user.email) {
                    // Self-correct / sync user_id if email matches
                    await supabase
                        .from('licenses')
                        .update({ user_id: session.user.id })
                        .eq('id', data.id);
                } else {
                    const diffAccountError = `This key is registered to a different account (${data.email || 'another user'}).`;
                    setErrorMsg(diffAccountError);
                    toast.error(diffAccountError, { id: loadingId });
                    setLoading(false);
                    return;
                }
            }

            if (data.status !== 'Active') {
                const inactiveError = `This license key is currently ${data.status}. Please check your plan status.`;
                setErrorMsg(inactiveError);
                toast.error(inactiveError, { id: loadingId });
                setLoading(false);
                return;
            }

            // Save details to SQLite settings
            await api.updateSettings({
                license_key: data.license_key,
                license_plan: data.plan,
                license_status: data.status,
                license_user_id: session.user.id
            });

            toast.success(`Welcome to Quantro ERP! Plan unlocked: ${data.plan}`, { id: loadingId });
            onActivated(data.plan);
        } catch (err) {
            console.error('License verification error:', err);
            const failError = `Verification failed: ${err.message}`;
            setErrorMsg(failError);
            toast.error(failError, { id: loadingId });
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        toast.info('Signed out successfully.');
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <div style={{
                background: '#ffffff', padding: '40px', borderRadius: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                width: '100%', maxWidth: '480px', textAlign: 'center', border: '1px solid #e2e8f0'
            }}>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '16px',
                    background: 'rgba(10, 110, 255, 0.1)', color: '#0A6EFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 24px auto'
                }}>
                    <Icons.KeyRound size={32} />
                </div>

                <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                    Activate Quantro ERP
                </h2>
                <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '14px', lineHeight: 1.5 }}>
                    Please enter the activation key generated after signing in and downloading the installer from the website dashboard.
                </p>

                <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            License Key
                        </label>
                        <input
                            type="text"
                            placeholder="QTY-XXXX-XXXX-XXXX"
                            required
                            value={keyInput}
                            onChange={(e) => setKeyInput(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: '12px',
                                border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none',
                                transition: 'border-color 0.2s', fontFamily: 'monospace',
                                boxSizing: 'border-box'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#0A6EFF'}
                            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                        />
                    </div>

                    {errorMsg && (
                        <div style={{
                            padding: '12px 16px',
                            background: '#fef2f2',
                            color: '#b91c1c',
                            border: '1px solid #fee2e2',
                            borderRadius: '12px',
                            fontSize: '13px',
                            lineHeight: '1.4',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <Icons.AlertCircle size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <SButton
                        variant="primary"
                        style={{ height: '48px', justifyContent: 'center', fontSize: '14px', width: '100%' }}
                        disabled={loading}
                        loading={loading}
                        type="submit"
                    >
                        Unlock Application
                    </SButton>
                </form>

                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                        Logged in as: <strong style={{ color: '#334155' }}>{session?.user?.email}</strong>
                    </span>
                    <button
                        onClick={handleSignOut}
                        style={{
                            background: 'none', border: 'none', color: '#ef4444', fontSize: '12px',
                            fontWeight: 650, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                    >
                        <Icons.LogOut size={14} /> Log Out
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isActivated, setIsActivated] = useState(false);
    const [checkingActivation, setCheckingActivation] = useState(false);

    const [shutdownLoading, setShutdownLoading] = useState(false);
    const [shutdownProgress, setShutdownProgress] = useState(0);
    const [shutdownMessage, setShutdownMessage] = useState('');

    const checkActivation = async (currSession) => {
        setCheckingActivation(true);
        try {
            const settings = await api.getSettings();
            const localKey = settings.license_key;
            const localStatus = settings.license_status || '';

            if (!localKey) {
                // Auto-fetch active license from Supabase if we don't have a local key
                try {
                    const { data: userLicenses, error: fetchError } = await supabase
                        .from('licenses')
                        .select('*')
                        .eq('user_id', currSession.user.id)
                        .eq('status', 'Active')
                        .order('created_at', { ascending: false });

                    if (!fetchError && userLicenses && userLicenses.length > 0) {
                        const activeLicense = userLicenses[0];
                        await api.updateSettings({
                            license_key: activeLicense.license_key,
                            license_plan: activeLicense.plan,
                            license_status: activeLicense.status,
                            license_user_id: activeLicense.user_id
                        });
                        setIsActivated(true);
                        setLoading(false);
                        setCheckingActivation(false);
                        return;
                    }
                } catch (fetchErr) {
                    console.error('Failed to auto-fetch license from Supabase:', fetchErr);
                }

                setIsActivated(false);
                setLoading(false);
                setCheckingActivation(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('license_key', localKey)
                    .maybeSingle();

                if (!error && data) {
                    // Sync user_id if email matches but user_id is outdated
                    if (data.user_id !== currSession.user.id && data.email === currSession.user.email) {
                        await supabase
                            .from('licenses')
                            .update({ user_id: currSession.user.id })
                            .eq('id', data.id);
                    }

                    if (data.status === 'Active' && (data.user_id === currSession.user.id || data.email === currSession.user.email)) {
                        setIsActivated(true);
                        await api.updateSettings({
                            license_plan: data.plan,
                            license_status: data.status,
                            license_user_id: currSession.user.id
                        });
                    } else {
                        // The current key is not active. Check if user has another active license in Supabase.
                        const { data: altLicenses, error: altError } = await supabase
                            .from('licenses')
                            .select('*')
                            .eq('user_id', currSession.user.id)
                            .eq('status', 'Active')
                            .order('created_at', { ascending: false });

                        if (!altError && altLicenses && altLicenses.length > 0) {
                            const activeLicense = altLicenses[0];
                            await api.updateSettings({
                                license_key: activeLicense.license_key,
                                license_plan: activeLicense.plan,
                                license_status: activeLicense.status,
                                license_user_id: activeLicense.user_id
                            });
                            setIsActivated(true);
                        } else {
                            setIsActivated(false);
                            await api.updateSettings({
                                license_status: data.status
                            });
                        }
                    }
                } else {
                    // Key not found or error. Check if they have any active license.
                    const { data: altLicenses, error: altError } = await supabase
                        .from('licenses')
                        .select('*')
                        .eq('user_id', currSession.user.id)
                        .eq('status', 'Active')
                        .order('created_at', { ascending: false });

                    if (!altError && altLicenses && altLicenses.length > 0) {
                        const activeLicense = altLicenses[0];
                        await api.updateSettings({
                            license_key: activeLicense.license_key,
                            license_plan: activeLicense.plan,
                            license_status: activeLicense.status,
                            license_user_id: activeLicense.user_id
                        });
                        setIsActivated(true);
                    } else {
                        setIsActivated(localStatus === 'Active');
                    }
                }
            } catch (netErr) {
                setIsActivated(localStatus === 'Active');
            }
        } catch (err) {
            console.error('Check activation error:', err);
        } finally {
            setCheckingActivation(false);
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                checkActivation(session);
            } else {
                setLoading(false);
            }
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            if (session) {
                checkActivation(session);
            } else {
                setIsActivated(false);
                setLoading(false);
                try {
                    // Clear local settings on sign out
                    await api.updateSettings({
                        license_key: '',
                        license_plan: '',
                        license_status: '',
                        license_user_id: ''
                    });
                } catch (err) {
                    console.error('Failed to clear license on sign out:', err);
                }
            }
        });

        // Listen for deep links from Electron
        if (window.maze) {
            if (window.maze.onAuthCallback) {
                window.maze.onAuthCallback((url) => {
                    console.log('[Quantro] Auth deep link received:', url);
                    
                    // Handle Supabase Auth (Hash)
                    if (url.includes('#access_token=')) {
                        const hash = url.split('#')[1];
                        if (hash) {
                            const params = new URLSearchParams(hash);
                            const accessToken = params.get('access_token');
                            const refreshToken = params.get('refresh_token');
                            if (accessToken && refreshToken) {
                                supabase.auth.setSession({
                                    access_token: accessToken,
                                    refresh_token: refreshToken
                                });
                                toast.success('Authentication successful!');
                            }
                        }
                    } 
                    // Handle Mazeway Handshake (Query Params)
                    else if (url.includes('mazeway-callback')) {
                        try {
                            const urlObj = new URL(url.replace('maze-erp://', 'http://')); // Use temporary protocol for parsing
                            const api_key = urlObj.searchParams.get('api_key');
                            const webhook_url = urlObj.searchParams.get('webhook_url');
                            const status = urlObj.searchParams.get('status');

                            if (status === 'connected' && api_key) {
                                console.log('[Quantro] Mazeway connection confirmed via deep link.');
                                // Update settings in DB first, then local state via event
                                api.updateSettings({
                                    mazeway_api_key: api_key,
                                    mazeway_webhook_url: webhook_url || '',
                                    mazeway_cloud_enabled: 'true'
                                }).then(() => {
                                    toast.success('Mazeway connected successfully!');
                                    // Dispatch event to refresh settings in SettingsPage if open
                                    window.postMessage({ type: 'mazeway-connected', api_key, webhook_url }, '*');
                                }).catch(err => {
                                    console.error('Failed to save Mazeway settings:', err);
                                    toast.error('Connection successful but failed to save settings.');
                                });
                            }
                        } catch (e) {
                            console.error('Failed to parse Mazeway callback:', e);
                        }
                    }
                    // Handle Google OAuth Callback (Query Params)
                    else if (url.includes('google-auth-callback')) {
                        try {
                            const urlObj = new URL(url.replace('maze-erp://', 'http://'));
                            const status = urlObj.searchParams.get('status');
                            const email = urlObj.searchParams.get('email');
                            const message = urlObj.searchParams.get('message');

                            if (status === 'success') {
                                toast.success(`Gmail account connected: ${email}`);
                                // Dispatch event to refresh Gmail connection status in UI
                                window.postMessage({ type: 'gmail-connected', email }, '*');
                            } else {
                                toast.error(`Gmail Connection Failed: ${message || 'Unknown error'}`);
                            }
                        } catch (e) {
                            console.error('Failed to parse Google OAuth callback:', e);
                        }
                    }
                });
            }

            // NEW: Handle Session End Backup
            if (window.maze.onAppCloseRequested) {
                window.maze.onAppCloseRequested(async () => {
                    console.log('[Quantro] App close requested. Checking backup settings...');
                    try {
                        const settings = await api.getSettings();
                        
                        if (settings.backup_cycle === 'session_end') {
                            setShutdownLoading(true);
                            setShutdownProgress(10);
                            setShutdownMessage('Checking backup configurations...');
                            
                            await new Promise(r => setTimeout(r, 500)); // Visual delay for smoother feel
                            
                            setShutdownProgress(30);
                            setShutdownMessage('Generating local data snapshot...');
                            const { filename } = await api.backupNow();
                            
                            if (settings.auto_push_to_ai === 'true') {
                                setShutdownProgress(60);
                                setShutdownMessage('Synchronizing with Mazeway AI Cloud...');
                                const content = await api.getBackupContent(filename);
                                await api.pushBackupToMazewayAI(filename, content);
                            }
                            
                            setShutdownProgress(100);
                            setShutdownMessage('Session secured. Closing application...');
                            await new Promise(r => setTimeout(r, 800));
                        }
                    } catch (e) {
                        console.error('[Quantro] Session backup failed:', e);
                    } finally {
                        if (window.maze.confirmAppQuit) {
                            window.maze.confirmAppQuit();
                        }
                    }
                });
            }
        }

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div style={{ 
                height: '100vh', display: 'flex', alignItems: 'center', 
                justifyContent: 'center', background: 'var(--bg-primary)' 
            }}>
                <div className="spinner" style={{ borderTopColor: 'var(--accent)', width: '40px', height: '40px' }}></div>
            </div>
        );
    }

    return (
        <AppErrorBoundary>
            {shutdownLoading && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(12px)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', zIndex: 99999, gap: '30px', padding: '40px'
                }}>
                    <div style={{ 
                        width: '80px', height: '80px', borderRadius: '24px', 
                        background: 'rgba(10, 110, 255, 0.1)', color: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '10px', animation: 'pulse 2s infinite'
                    }}>
                        <Icons.CloudLightning size={40} />
                    </div>
                    
                    <div style={{ textAlign: 'center', maxWidth: '450px' }}>
                        <h2 style={{ margin: 0, fontWeight: 800, fontSize: '24px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                            Please Wait
                        </h2>
                        <p style={{ margin: '12px 0 0', color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6 }}>
                            We are taking a secure backup of your session. Once complete, the application will close automatically. 
                            <span style={{ display: 'block', marginTop: '8px', fontWeight: 600, color: 'var(--accent)' }}>
                                Please keep your internet connected and system ON.
                            </span>
                        </p>
                    </div>

                    <div style={{ width: '100%', maxWidth: '400px' }}>
                        <div style={{ 
                            height: '8px', width: '100%', background: '#F2F4F7', 
                            borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' 
                        }}>
                            <div style={{ 
                                height: '100%', width: `${shutdownProgress}%`, 
                                background: 'linear-gradient(90deg, #0A6EFF, #2E90FA)', 
                                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                borderRadius: '10px'
                            }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {shutdownMessage}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>
                                {shutdownProgress}%
                            </span>
                        </div>
                    </div>
                </div>
            )}
            <HashRouter>
                <Toaster 
                    position="bottom-right" 
                    expand={true} 
                    richColors 
                    closeButton 
                    theme="light"
                    toastOptions={{
                        style: {
                            borderRadius: '12px',
                            border: '1px solid #EAECF0',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        },
                    }}
                />
                {!session ? (
                    <Routes>
                        <Route path="/customer-display" element={<CustomerDisplayPage />} />
                        <Route path="*" element={<AuthPage />} />
                    </Routes>
                ) : !isActivated ? (
                    <ActivationGate 
                        session={session} 
                        onActivated={() => setIsActivated(true)} 
                    />
                ) : (
                    <Routes>
                        <Route path="/customer-display" element={<CustomerDisplayPage />} />
                        <Route path="*" element={
                            <Layout>
                                <Routes>
                                    <Route path="/" element={<DashboardPage />} />
                                    <Route path="/inventory" element={<InventoryPage />} />
                                    <Route path="/sales" element={<SalesPage />} />
                                    <Route path="/customers" element={<CustomersPage />} />
                                    <Route path="/purchase" element={<PurchasePage />} />
                                    <Route path="/automation" element={<AutomationPage />} />
                                    <Route path="/billing" element={<BillingPage />} />
                                    <Route path="/settings" element={<SettingsPage />} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Layout>
                        } />
                    </Routes>
                )}
            </HashRouter>
        </AppErrorBoundary>
    );
}
