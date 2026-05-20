import './styles/index.css';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
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

export default function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    const [shutdownLoading, setShutdownLoading] = useState(false);
    const [shutdownProgress, setShutdownProgress] = useState(0);
    const [shutdownMessage, setShutdownMessage] = useState('');

    useEffect(() => {
        // Initial check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setLoading(false);
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
