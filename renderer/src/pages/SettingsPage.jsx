import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import api from '../api';
import CustomSelect from '../components/CustomSelect';
import { Icons } from '../components/Icons';
import { formatDate } from "../utils";
import { supabase } from '../supabase';
import { APP_NAME, APP_VERSION } from '../constants';
import "./SettingsPage.css";
import Modal from '../components/Modal';
import SButton from '../components/SButton';

export default function SettingsPage() {
    const [settings, setSettings] = useState({
        company_name: '',
        address: '',
        phone: '',
        email: '',
        logo_url: '',
        gstin: '',
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        account_holder_name: '',
        upi_id: '',
        payment_qr_url: '',
        declaration: '',
        terms_and_conditions: '',
        enable_batch_system: 'true',
        require_batch_number: 'false',
        enable_expiry_tracking: 'false',
        auto_batch_selection_method: 'FIFO',
        expiry_alert_days: '30',
        allow_negative_batch_stock: 'false',
        flexible_inventory: 'true',
        invoice_style: 'classic',
        default_place_of_supply: '',
        enable_quick_sale: 'false',
        enable_barcode_scanner: 'false',
        enable_cash_drawer: 'false',
        enable_customer_display: 'false',
        mazeway_cloud_enabled: 'false',
        mazeway_api_key: '',
        mazeway_webhook_url: '',
        cloud_backups_enabled: 'false',
        auto_update_enabled: 'false',
        default_currency: 'INR',
        invoice_language: 'en',
        enable_serial_tracking: 'true',
        show_category_in_invoice: 'true',
        enable_realtime_price_update: 'false'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [activeTab, setActiveTab] = useState('profile');
    const [showMazewayConnectModal, setShowMazewayConnectModal] = useState(false);
    const [isConnectingMazeway, setIsConnectingMazeway] = useState(false);

    // Data Management States
    const [showExportModal, setShowExportModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    
    const [exportParams, setExportParams] = useState({ startDate: '', endDate: '', categories: [] });
    const [deleteCategories, setDeleteCategories] = useState([]);
    const [importFile, setImportFile] = useState(null);
    const [importProgress, setImportProgress] = useState(0);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const [backupList, setBackupList] = useState([]);
    const [backupCycle, setBackupCycle] = useState('off');
    const [dataPaths, setDataPaths] = useState({ dbDir: 'data/Live', backupDir: 'data/Backups' });

    // Barcode Test Mode States
    const [testScannerMode, setTestScannerMode] = useState(false);
    const [testScanResult, setTestScanResult] = useState(null);

    // Cash Drawer Test States
    const [isTestingDrawer, setIsTestingDrawer] = useState(false);
    const [drawerTestResult, setDrawerTestResult] = useState(null);
    const [testProducts, setTestProducts] = useState([]);

    // System Updates States
    const [updateState, setUpdateState] = useState({
        status: 'idle', // 'idle', 'checking', 'available', 'not-available', 'downloading', 'downloaded', 'error'
        version: '',
        progress: 0,
        error: '',
        releaseNotes: ''
    });

    useEffect(() => {
        // Handle tab auto-trigger redirection from Dashboard
        const tabToOpen = localStorage.getItem('settings_active_tab');
        if (tabToOpen) {
            setActiveTab(tabToOpen);
            localStorage.removeItem('settings_active_tab');
        }

        if (!window.maze || !window.maze.updates) return;

        const unsubscribeAvailable = window.maze.updates.onAvailable((info) => {
            setUpdateState(prev => ({
                ...prev,
                status: 'available',
                version: info.version,
                releaseNotes: info.releaseNotes || 'No release notes provided.'
            }));
            localStorage.setItem('maze_update_available', info.version);

            // Auto update trigger
            api.getSettings().then(dbSettings => {
                if (dbSettings.auto_update_enabled === 'true') {
                    console.log('[Maze ERP] Auto-update is enabled. Triggering background download...');
                    setUpdateState(prev => ({ ...prev, status: 'downloading', progress: 0 }));
                    window.maze.updates.download();
                }
            }).catch(console.error);
        });

        const unsubscribeNotAvailable = window.maze.updates.onNotAvailable(() => {
            setUpdateState(prev => ({ ...prev, status: 'not-available' }));
            localStorage.removeItem('maze_update_available');
            localStorage.removeItem('maze_update_downloaded');
        });

        const unsubscribeProgress = window.maze.updates.onProgress((progressObj) => {
            setUpdateState(prev => ({
                ...prev,
                status: 'downloading',
                progress: progressObj.percent
            }));
        });

        const unsubscribeDownloaded = window.maze.updates.onDownloaded((info) => {
            setUpdateState(prev => ({
                ...prev,
                status: 'downloaded',
                progress: 100
            }));
            localStorage.setItem('maze_update_downloaded', 'true');
        });

        const unsubscribeError = window.maze.updates.onError((err) => {
            setUpdateState(prev => ({
                ...prev,
                status: 'error',
                error: err || 'An error occurred during update process.'
            }));
        });

        return () => {
            unsubscribeAvailable();
            unsubscribeNotAvailable();
            unsubscribeProgress();
            unsubscribeDownloaded();
            unsubscribeError();
        };
    }, []);

    const handleCheckForUpdates = () => {
        if (window.maze && window.maze.updates) {
            setUpdateState(prev => ({ ...prev, status: 'checking', error: '' }));
            window.maze.updates.check();
        } else {
            // Development Mockup
            setUpdateState(prev => ({ ...prev, status: 'checking' }));
            setTimeout(() => {
                setUpdateState(prev => ({
                    ...prev,
                    status: 'available',
                    version: '1.1.2',
                    releaseNotes: '• Added automatic updates toggle options\n• Integrated background silent downloads\n• Streamlined UI layout inside the Create Agent Modal'
                }));
                // If auto-update is enabled, trigger mockup download
                if (settings.auto_update_enabled === 'true') {
                    setTimeout(() => {
                        handleDownloadUpdate();
                    }, 1000);
                }
            }, 1500);
        }
    };

    const handleDownloadUpdate = () => {
        if (window.maze && window.maze.updates) {
            setUpdateState(prev => ({ ...prev, status: 'downloading', progress: 0 }));
            window.maze.updates.download();
        } else {
            // Development Mockup download progress bar
            setUpdateState(prev => ({ ...prev, status: 'downloading', progress: 0 }));
            let pct = 0;
            const interval = setInterval(() => {
                pct += 10;
                setUpdateState(prev => ({ ...prev, progress: pct }));
                if (pct >= 100) {
                    clearInterval(interval);
                    setUpdateState(prev => ({ ...prev, status: 'downloaded' }));
                    localStorage.setItem('maze_update_downloaded', 'true');
                }
            }, 300);
        }
    };

    const handleInstallUpdate = () => {
        if (window.maze && window.maze.updates) {
            window.maze.updates.install();
        } else {
            toast.success('System is launching update installer! (mockup)');
        }
    };

    useEffect(() => {
        let isMounted = true;

        // Mazeway Connection Listener
        const handleMazewayMessage = (event) => {
            const data = event.data;
            console.log('[Mazeway Handshake] Message received:', data);
            
            if (data === 'mazeway-connected' || data?.type === 'mazeway-connected') {
                console.log('[Mazeway Handshake] Valid connection message detected.');
                toast.success('Mazeway Cloud Connected Successfully!');
                
                // If credentials were passed in the message, update state immediately
                if (data && typeof data === 'object' && (data.api_key || data.webhook_url)) {
                    console.log('[Mazeway Handshake] Auto-filling credentials:', { api_key: '***', webhook_url: data.webhook_url });
                    setSettings(prev => ({
                        ...prev,
                        mazeway_api_key: String(data.api_key || prev.mazeway_api_key || ''),
                        mazeway_webhook_url: String(data.webhook_url || prev.mazeway_webhook_url || ''),
                        mazeway_cloud_enabled: 'true'
                    }));
                }

                // Small delay to ensure backend has finished persisting before refresh
                setTimeout(() => {
                    api.getSettings().then(data => {
                        if (data) setSettings(prev => ({ ...prev, ...data }));
                    }).catch(err => console.error('Failed to refresh settings:', err));
                }, 500);
            }
        };

        api.getSettings()
            .then(data => {
                if (isMounted && data) {
                    setSettings(prev => ({ ...prev, ...data }));
                    setBackupCycle(data.backup_cycle || 'off');
                }
                if (isMounted) setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load settings:', err);
                if (isMounted) setLoading(false);
            });

        api.getDataPaths()
            .then(paths => {
                if (isMounted && paths) {
                    setDataPaths(paths);
                }
            })
            .catch(err => console.error('Failed to load data paths:', err));

        if (isMounted) fetchBackups();

        window.addEventListener('message', handleMazewayMessage);

        return () => {
            isMounted = false;
            window.removeEventListener('message', handleMazewayMessage);
        };
    }, []);

    useEffect(() => {
        let pollInterval;
        if (isConnectingMazeway) {
            console.log('[Mazeway Handshake] Started polling settings for keys...');
            pollInterval = setInterval(() => {
                api.getSettings().then(data => {
                    if (data && data.mazeway_api_key) {
                        console.log('[Mazeway Handshake] Keys found in DB via polling!', data);
                        toast.success('Mazeway Cloud Connected Successfully!');
                        setSettings(prev => ({
                            ...prev,
                            mazeway_api_key: data.mazeway_api_key,
                            mazeway_webhook_url: data.mazeway_webhook_url || '',
                            mazeway_cloud_enabled: 'true'
                        }));
                        setIsConnectingMazeway(false);
                        setShowMazewayConnectModal(false);
                    }
                }).catch(err => console.error('Error polling settings:', err));
            }, 1500);
        }
        return () => {
            if (pollInterval) {
                console.log('[Mazeway Handshake] Stopped polling settings.');
                clearInterval(pollInterval);
            }
        };
    }, [isConnectingMazeway]);

    const fetchBackups = async () => {
        try {
            const list = await api.getBackups();
            setBackupList(list);
        } catch (err) {
            console.error('Failed to fetch backups:', err);
        }
    };

    const handlePushToMazeway = async (filename) => {
        if (!settings.mazeway_api_key) {
            toast.error('Mazeway API key not found. Please connect Mazeway first.');
            return;
        }

        const loadingId = toast.loading(`Pushing ${filename} to Mazeway...`);
        try {
            await api.pushBackupToMazeway(filename, settings.mazeway_api_key);
            toast.success('Backup pushed to Mazeway successfully!');
        } catch (err) {
            toast.error(err.message || 'Failed to push backup.');
        } finally {
            toast.dismiss(loadingId);
        }
    };

    const handleAuthorize = async () => {
        try {
            const data = await api.getMazewayAuthUrl();
            const authUrl = data?.authUrl;

            if (!authUrl) {
                throw new Error(data?.error || 'Could not retrieve authentication URL from backend. Make sure the application is running properly.');
            }

            console.log('Opening Mazeway Auth (External):', authUrl);

            // Use window.maze.openExternal to open the system browser
            if (window.maze && window.maze.openExternal) {
                await window.maze.openExternal(authUrl);
            } else {
                // Fallback for development if window.maze is missing
                window.open(authUrl, '_blank');
            }
            setIsConnectingMazeway(true);
        } catch (err) {
            console.error('Authorize failed:', err);
            const errorMsg = err.message || 'Failed to initiate connection. Please check your internet or backend status.';
            toast.error(errorMsg);
        }
    };

    // Fetch products for test mode
    useEffect(() => {
        if (testScannerMode) {
            api.getProducts().then(setTestProducts).catch(console.error);
        }
    }, [testScannerMode]);

    // Barcode Test Listener
    useEffect(() => {
        if (!testScannerMode) return;

        let barcodeBuffer = '';
        let lastKeyTime = Date.now();

        function handleBarcodeScan(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            const currentTime = Date.now();
            if (currentTime - lastKeyTime > 50) {
                barcodeBuffer = '';
            }
            lastKeyTime = currentTime;

            if (e.key === 'Enter') {
                if (barcodeBuffer.length > 2) {
                    const scannedCode = barcodeBuffer;
                    barcodeBuffer = '';
                    
                    const product = testProducts.find(p => p.product_code === scannedCode || p.name === scannedCode || String(p.id) === scannedCode);
                    setTestScanResult({
                        code: scannedCode,
                        product: product || null,
                        timestamp: new Date()
                    });
                }
            } else if (e.key.length === 1) {
                barcodeBuffer += e.key;
            }
        }

        window.addEventListener('keydown', handleBarcodeScan);
        return () => window.removeEventListener('keydown', handleBarcodeScan);
    }, [testScannerMode, testProducts]);

    useEffect(() => {
        if (window.maze && window.maze.onCashDrawerResult) {
            const unsubscribe = window.maze.onCashDrawerResult((result) => {
                setDrawerTestResult(result);
                setIsTestingDrawer(false);
                if (result.success) {
                    toast.success(result.message);
                } else {
                    toast.error(result.message);
                }
            });
            return unsubscribe;
        }
    }, []);

    const handleTestCashDrawer = () => {
        if (!window.maze?.triggerCashDrawer) {
            toast.error("Hardware API not available.");
            return;
        }
        setIsTestingDrawer(true);
        setDrawerTestResult(null);
        window.maze.triggerCashDrawer();
    };

    const handleBackupCycleChange = async (newCycle) => {
        const promise = (async () => {
            await api.updateBackupCycle(newCycle);
            setBackupCycle(newCycle);
            // Refresh settings to get any side-effects (like last_backup_date)
            // But merge with current state to avoid losing unsaved toggles like auto_push_to_ai
            const data = await api.getSettings();
            setSettings(prev => ({ ...prev, ...data }));
        })();

        toast.promise(promise, {
            loading: 'Updating backup cycle...',
            success: 'Backup cycle updated successfully!',
            error: (err) => 'Failed to update backup cycle: ' + err.message,
        });
    };

    const handleBackupNow = async () => {
        const promise = (async () => {
            const { filename } = await api.backupNow();
            await fetchBackups();

            // Cloud Sync Logic
            // 1. Cloud Backup (Supabase)
            if (settings.cloud_backups_enabled === 'true') {
                try {
                    const content = await api.getBackupContent(filename);
                    await api.uploadBackupToStorage(filename, content);
                    toast.success('Backup synced to Cloud Storage!');

                    // NEW: Auto-push to AI if enabled
                    if (settings.auto_push_to_ai === 'true') {
                        await api.pushBackupToMazewayAI(filename, content);
                        toast.success('Backup auto-pushed to Mazeway AI!');
                    }
                } catch (cloudErr) {
                    console.error('Cloud Sync failed:', cloudErr);
                    toast.error(`Local backup succeeded, but Cloud Sync failed: ${cloudErr.message}`);
                }
            }

            const data = await api.getSettings();
            setSettings(prev => ({ ...prev, ...data }));
        })();

        toast.promise(promise, {
            loading: 'Creating backup...',
            success: 'Backup completed successfully!',
            error: (err) => 'Backup failed: ' + err.message,
        });
    };

    const handlePushLatestToCloud = async () => {
        if (backupList.length === 0) {
            toast.error('No backups found to push.');
            return;
        }

        const latestBackup = backupList[0];
        const promise = (async () => {
            const content = await api.getBackupContent(latestBackup.filename);
            await api.pushBackupToMazewayAI(latestBackup.filename, content);
        })();

        toast.promise(promise, {
            loading: `Pushing "${latestBackup.filename}" to cloud...`,
            success: 'Cloud sync successful!',
            error: (err) => 'Sync failed: ' + err.message,
        });
    };

    const handleRestoreFromBackup = async (filename) => {
        if (!confirm(`Are you sure you want to restore from "${filename}"? This will overwrite existing data.`)) return;
        
        const promise = api.restoreBackup(filename);

        toast.promise(promise, {
            loading: 'Restoring from backup...',
            success: 'Backup restored successfully!',
            error: (err) => 'Restore failed: ' + err.message,
        });
    };

    const handleDeleteBackup = async (filename) => {
        if (!confirm(`Are you sure you want to permanently delete backup "${filename}"? This will remove it from both local storage and cloud.`)) return;
        
        const promise = (async () => {
            await api.deleteBackup(filename);
            await fetchBackups();
        })();

        toast.promise(promise, {
            loading: 'Deleting backup...',
            success: 'Backup deleted successfully!',
            error: (err) => 'Delete failed: ' + err.message,
        });
    };

    async function handleSave(e) {
        if (e) e.preventDefault();
        
        let settingsToSave = { ...settings };
        if (settingsToSave.logo_url && settingsToSave.logo_url.startsWith('data:image/') && settingsToSave.logo_url.length > 100000) {
            try {
                const compressed = await new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const maxWidth = 300;
                        const maxHeight = 150;
                        if (width > maxWidth) {
                            height = (maxWidth / width) * height;
                            width = maxWidth;
                        }
                        if (height > maxHeight) {
                            width = (maxHeight / height) * width;
                            height = maxHeight;
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        try {
                            resolve(canvas.toDataURL('image/jpeg', 0.75));
                        } catch {
                            resolve(settingsToSave.logo_url);
                        }
                    };
                    img.onerror = () => resolve(settingsToSave.logo_url);
                    img.src = settingsToSave.logo_url;
                });
                settingsToSave.logo_url = compressed;
                setSettings(prev => ({ ...prev, logo_url: compressed }));
            } catch (err) {
                console.error('Failed to compress logo on save:', err);
            }
        }

        const promise = api.updateSettings(settingsToSave);

        toast.promise(promise, {
            loading: 'Saving settings...',
            success: () => {
                window.dispatchEvent(new CustomEvent('settings-updated', { detail: settingsToSave }));
                return 'Settings saved successfully!';
            },
            error: (err) => 'Failed to save settings: ' + err.message,
        });
    }

    const handleExport = async () => {
        const promise = (async () => {
            const params = { ...exportParams, categories: exportParams.categories.join(',') };
            const result = await api.exportData(params);
            
            const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Maze_ERP_Backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            setShowExportModal(false);
        })();

        toast.promise(promise, {
            loading: 'Preparing data export...',
            success: 'Data exported successfully!',
            error: (err) => 'Export failed: ' + err.message,
        });
    };

    const handleDeleteData = async () => {
        if (deleteConfirmText.trim().toUpperCase() !== 'PERMANENTLY DELETE') return;
        const promise = (async () => {
            await api.deleteDataByCategory(deleteCategories);
            setShowDeleteModal(false);
            setDeleteConfirmText('');
            setDeleteCategories([]);
        })();

        toast.promise(promise, {
            loading: 'Deleting selected records...',
            success: 'Selected data deleted successfully!',
            error: (err) => 'Deletion failed: ' + err.message,
        });
    };

    const handleImport = async () => {
        if (!importFile) return;
        
        const promise = new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    setImportProgress(20);
                    const data = JSON.parse(e.target.result);
                    setImportProgress(50);
                    await api.importData(data.data || data);
                    setImportProgress(100);
                    setTimeout(() => {
                        setShowImportModal(false);
                        setImportProgress(0);
                        setImportFile(null);
                        resolve();
                    }, 800);
                } catch (err) {
                    setImportProgress(0);
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('File reading failed'));
            reader.readAsText(importFile);
        });

        toast.promise(promise, {
            loading: 'Importing and restoring records...',
            success: 'System records restored successfully!',
            error: (err) => 'Import failed: ' + err.message,
        });
    };

    const toggleCategory = (cat, state, setState) => {
        const current = state.categories || state;
        const updated = current.includes(cat) 
            ? current.filter(c => c !== cat) 
            : [...current, cat];
        
        if (state.categories) {
            setState({ ...state, categories: updated });
        } else {
            setState(updated);
        }
    };

    if (loading) return <div className="loading">Loading settings…</div>;

    return (
        <div className="settings-container">
            <div className="page-header">
                <div>
                    <h1>Settings</h1>
                    <p className="text-secondary">Manage your profile, business details, and data</p>
                </div>
            </div>

            <div className="settings-layout">
                {/* M033: Scrollable sidebar so tabs aren't clipped on small screens */}
                <div className="settings-tabs-sidebar" role="tablist" aria-label="Settings sections" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
                    <button className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')} role="tab" aria-selected={activeTab === 'profile'}>
                        Profile
                    </button>
                    <button className={`tab-btn ${activeTab === 'business' ? 'active' : ''}`} onClick={() => setActiveTab('business')} role="tab" aria-selected={activeTab === 'business'}>
                        Business & Invoice
                    </button>
                    <button className={`tab-btn ${activeTab === 'payment' ? 'active' : ''}`} onClick={() => setActiveTab('payment')} role="tab" aria-selected={activeTab === 'payment'}>
                        Payment
                    </button>
                    <button className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')} role="tab" aria-selected={activeTab === 'data'}>
                        Data Management
                    </button>
                    <button className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')} role="tab" aria-selected={activeTab === 'inventory'}>
                        Inventory Config
                    </button>
                    <button className={`tab-btn ${activeTab === 'app_settings' ? 'active' : ''}`} onClick={() => setActiveTab('app_settings')} role="tab" aria-selected={activeTab === 'app_settings'}>
                        App Settings
                    </button>
                    <button className={`tab-btn ${activeTab === 'updates' ? 'active' : ''}`} onClick={() => setActiveTab('updates')} role="tab" aria-selected={activeTab === 'updates'}>
                        Version & Updates
                    </button>
                    <button className={`tab-btn ${activeTab === 'changelog' ? 'active' : ''}`} onClick={() => setActiveTab('changelog')} role="tab" aria-selected={activeTab === 'changelog'}>
                        System Changelog
                    </button>
                </div>

                <div className="settings-content-area">
                    <form onSubmit={handleSave}>
                        {activeTab === 'profile' && (
                            <div className="settings-section-card">
                                <h3>Profile & Contact</h3>
                                <div className="settings-grid">
                                    <div className="form-group">
                                        <label>Shop / Business Name</label>
                                        <input value={settings.company_name} onChange={e => setSettings({ ...settings, company_name: e.target.value })} placeholder="Enter business name" />
                                    </div>
                                    <div className="form-group">
                                        <label>GSTIN Number</label>
                                        <input value={settings.gstin} onChange={e => setSettings({ ...settings, gstin: e.target.value })} placeholder="e.g. 24AAAAA0000A1Z5" />
                                    </div>
                                    <div className="form-group">
                                        <label>Default Place of Supply</label>
                                        <input value={settings.default_place_of_supply} onChange={e => setSettings({ ...settings, default_place_of_supply: e.target.value })} placeholder="e.g. 09-Uttar Pradesh" />
                                    </div>
                                    <div className="form-group">
                                        <label>Phone Number</label>
                                        <input value={settings.phone} onChange={e => setSettings({ ...settings, phone: e.target.value })} placeholder="e.g. +91 98765 43210" />
                                    </div>
                                    <div className="form-group">
                                        <label>Email Address</label>
                                        <input type="email" value={settings.email} onChange={e => setSettings({ ...settings, email: e.target.value })} placeholder="e.g. contact@business.com" />
                                    </div>
                                    <div className="form-group full-width">
                                        <label>Business Logo</label>
                                        <div className="logo-upload-container">
                                            {settings.logo_url && (
                                                <div className="logo-preview">
                                                    <img src={settings.logo_url} alt="Logo" />
                                                    <SButton variant="secondary" tone="critical" onClick={() => setSettings({ ...settings, logo_url: '' })} style={{ position: 'absolute', top: '-8px', right: '-8px', width: '24px', height: '24px', padding: 0, borderRadius: '50%' }}>×</SButton>
                                                </div>
                                            )}
                                            <div className="upload-btn-wrapper">
                                                <SButton variant="secondary" onClick={() => document.getElementById('logo-upload').click()}>Upload Logo</SButton>
                                                <input type="file" id="logo-upload" accept="image/*" style={{ display: 'none' }} onChange={e => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            const base64Str = reader.result;
                                                            const img = new Image();
                                                            img.onload = () => {
                                                                const canvas = document.createElement('canvas');
                                                                let width = img.width;
                                                                let height = img.height;
                                                                const maxWidth = 300;
                                                                const maxHeight = 150;

                                                                if (width > maxWidth) {
                                                                    height = (maxWidth / width) * height;
                                                                    width = maxWidth;
                                                                }
                                                                if (height > maxHeight) {
                                                                    width = (maxHeight / height) * width;
                                                                    height = maxHeight;
                                                                }

                                                                canvas.width = width;
                                                                canvas.height = height;
                                                                const ctx = canvas.getContext('2d');
                                                                ctx.drawImage(img, 0, 0, width, height);

                                                                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
                                                                setSettings({ ...settings, logo_url: compressedBase64 });
                                                            };
                                                            img.onerror = () => {
                                                                setSettings({ ...settings, logo_url: base64Str });
                                                            };
                                                            img.src = base64Str;
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-divider" style={{ margin: '30px 0 20px 0', borderTop: '1px solid var(--border-light)' }}></div>
                                
                                <h3>Account & Session</h3>
                                <div className="settings-section-card" style={{ border: '1px solid var(--danger-light)', background: 'rgba(255, 59, 48, 0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Sign Out</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Securely log out of your {APP_NAME} account on this device.</div>
                                        </div>
                                        <SButton 
                                            variant="primary" 
                                            tone="critical"
                                            style={{ padding: '10px 24px' }}
                                            onClick={async () => {
                                                if (confirm('Are you sure you want to log out?')) {
                                                    document.body.classList.add('logout-transition');
                                                    setTimeout(async () => {
                                                        await supabase.auth.signOut();
                                                        document.body.classList.remove('logout-transition');
                                                    }, 500);
                                                }
                                            }}
                                        >
                                            <Icons.LogOut size={16} style={{ marginRight: '8px' }} />
                                            Logout
                                        </SButton>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'business' && (
                            <div className="settings-section-card">
                                <h3>Invoice & Business Terms</h3>
                                <div className="form-group">
                                    <label>Invoice Declaration</label>
                                    <textarea value={settings.declaration} onChange={e => setSettings({ ...settings, declaration: e.target.value })} rows="3" />
                                </div>
                                <div className="form-group">
                                    <label>Terms & Conditions (One per line)</label>
                                    <textarea value={settings.terms_and_conditions} onChange={e => setSettings({ ...settings, terms_and_conditions: e.target.value })} rows="6" />
                                </div>

                                <div className="settings-divider" style={{ margin: '30px 0 20px 0', borderTop: '1px solid var(--border-light)' }}></div>
                                
                                <h3 style={{ marginBottom: '20px' }}>Tax & SKU Configuration</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {[
                                        { key: 'enable_gst_per_item', label: 'Enable GST per item', desc: 'Allows adding GST percentage for individual products during sale' },
                                        { key: 'enable_discount_per_item', label: 'Enable Discount per item', desc: 'Allows adding discount for individual products during sale' },
                                        { key: 'enable_sku', label: 'Enable SKU / Product Code', desc: 'Shows SKU/Code in the invoice and checkout' },
                                        { key: 'show_category_in_invoice', label: 'Show Product Category', desc: 'Displays the product category in invoice previews, PDFs, and shared links' },
                                        { key: 'enable_realtime_price_update', label: 'Real-time Price Dynamic Sync', desc: 'Automatically updates 0-priced products on existing invoices when their inventory selling price is updated' }
                                    ].map(item => (
                                        <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.label}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{item.desc}</div>
                                            </div>
                                            <div 
                                                className="toggle-switch" 
                                                onClick={() => setSettings({ ...settings, [item.key]: settings[item.key] === 'true' ? 'false' : 'true' })}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div className={`toggle-track ${settings[item.key] === 'true' ? 'on' : ''}`}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="settings-divider" style={{ margin: '30px 0 20px 0', borderTop: '1px solid var(--border-light)' }}></div>

                                <h3 style={{ marginBottom: '20px' }}>Invoice Style & Layout</h3>
                                <div className="form-group">
                                    <label>Default Invoice Style</label>
                                    <div className="invoice-style-selector" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '8px' }}>
                                        {[
                                            { id: 'minimalist', label: 'Minimalist Invoice', desc: 'Minimalist clean layout' },
                                            { id: 'pos', label: 'POS Style', desc: 'Thermal printer (80mm) layout' },
                                            { id: 'classic', label: 'Classic Style', desc: 'Standard business layout' },
                                            { id: 'formal', label: 'Formal Style', desc: 'Boxed layout with Tax Summary' }
                                        ].map(style => (
                                            <div 
                                                key={style.id}
                                                className={`style-option-card ${settings.invoice_style === style.id ? 'active' : ''}`}
                                                onClick={() => setSettings({ ...settings, invoice_style: style.id })}
                                                style={{
                                                    padding: '16px',
                                                    borderRadius: '12px',
                                                    border: `2px solid ${settings.invoice_style === style.id ? 'var(--accent)' : 'var(--border-light)'}`,
                                                    background: settings.invoice_style === style.id ? 'var(--accent-light)' : 'var(--bg-primary)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div style={{ fontWeight: 600, fontSize: '14px', color: settings.invoice_style === style.id ? 'var(--accent)' : 'var(--text-primary)' }}>{style.label}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{style.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="settings-divider" style={{ margin: '30px 0 20px 0', borderTop: '1px solid var(--border-light)' }}></div>

                                <h3 style={{ marginBottom: '20px' }}>Localization & Currency</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                                    <div className="form-group">
                                        <label>Invoice Language</label>
                                        <div style={{ marginTop: '8px' }}>
                                            <CustomSelect 
                                                value={settings.invoice_language || 'en'} 
                                                onChange={(val) => setSettings({ ...settings, invoice_language: val })} 
                                                options={[
                                                    { value: 'en', label: 'English' },
                                                    { value: 'hi', label: 'Hindi (हिन्दी)' },
                                                    { value: 'gu', label: 'Gujarati (ગુજરાતી)' }
                                                ]}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Default Currency</label>
                                        <div style={{ marginTop: '8px' }}>
                                            <CustomSelect 
                                                value={settings.default_currency || 'INR'} 
                                                onChange={(val) => setSettings({ ...settings, default_currency: val })} 
                                                options={[
                                                    { value: 'INR', label: 'Indian Rupee (₹)' },
                                                    { value: 'USD', label: 'US Dollar ($)' },
                                                    { value: 'EUR', label: 'Euro (€)' },
                                                    { value: 'GBP', label: 'British Pound (£)' },
                                                    { value: 'AED', label: 'UAE Dirham (د.إ)' }
                                                ]}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'payment' && (
                            <div className="settings-section-card">
                                <h3>Payment & Bank Details</h3>
                                <div className="settings-grid">
                                    <div className="form-group">
                                        <label>Bank Name</label>
                                        <input value={settings.bank_name || ''} onChange={e => setSettings({ ...settings, bank_name: e.target.value })} placeholder="e.g. HDFC Bank" />
                                    </div>
                                    <div className="form-group">
                                        <label>Account Number</label>
                                        <input value={settings.account_number || ''} onChange={e => setSettings({ ...settings, account_number: e.target.value })} placeholder="Account number" />
                                    </div>
                                    <div className="form-group">
                                        <label>IFSC Code</label>
                                        <input value={settings.ifsc_code || ''} onChange={e => setSettings({ ...settings, ifsc_code: e.target.value })} placeholder="IFSC" />
                                    </div>
                                    <div className="form-group">
                                        <label>Account Holder</label>
                                        <input value={settings.account_holder_name || ''} onChange={e => setSettings({ ...settings, account_holder_name: e.target.value })} placeholder="Name" />
                                    </div>
                                    <div className="form-group">
                                        <label>UPI ID (Optional)</label>
                                        <input value={settings.upi_id || ''} onChange={e => setSettings({ ...settings, upi_id: e.target.value })} placeholder="upi@bank" />
                                    </div>
                                    <div className="form-group">
                                        <label>Payment QR Code</label>
                                        <div className="logo-upload-container">
                                            {settings.payment_qr_url && (
                                                <div className="logo-preview">
                                                    <img src={settings.payment_qr_url} alt="QR" />
                                                    <SButton variant="secondary" tone="critical" onClick={() => setSettings({ ...settings, payment_qr_url: '' })} style={{ position: 'absolute', top: '-8px', right: '-8px', width: '24px', height: '24px', padding: 0, borderRadius: '50%' }}>×</SButton>
                                                </div>
                                            )}
                                            <div className="upload-btn-wrapper">
                                                <SButton variant="secondary" onClick={() => document.getElementById('qr-upload').click()}>Upload QR</SButton>
                                                <input type="file" accept="image/*" onChange={e => {
                                                    const file = e.target.files[0];
                                                    if (file && file.size <= 10 * 1024 * 1024) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => setSettings({ ...settings, payment_qr_url: reader.result });
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'data' && (
                            <div className="settings-section-card data-management">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <h3>Data Management</h3>
                                    <div className="data-badge offline">
                                        <Icons.Database size={12} style={{ marginRight: '6px' }} />
                                        Local-First
                                    </div>
                                </div>
                                <p className="section-desc">Manage your business information. Your data is stored locally in <span className="path-highlight" style={{ wordBreak: 'break-all' }}>{dataPaths.dbDir}</span> and backups in <span className="path-highlight" style={{ wordBreak: 'break-all' }}>{dataPaths.backupDir}</span>.</p>
                                <div className="data-actions-grid">
                                    <div className="data-action-card" onClick={() => setShowExportModal(true)}>
                                        <div className="action-icon export"><Icons.Download size={24} /></div>
                                        <h4>Export Data</h4>
                                        <p>Download your app data as a JSON file.</p>
                                    </div>
                                    <div className="data-action-card" onClick={() => setShowDeleteModal(true)}>
                                        <div className="action-icon delete"><Icons.Trash2 size={24} /></div>
                                        <h4>Delete Data</h4>
                                        <p>Permanently remove selected information.</p>
                                    </div>
                                    <div className="data-action-card" onClick={() => setShowImportModal(true)}>
                                        <div className="action-icon import"><Icons.Upload size={24} /></div>
                                        <h4>Import Data</h4>
                                        <p>Restore data from an exported file.</p>
                                    </div>
                                </div>

                                <div className="backup-management-container">
                                    <div className="section-header-row">
                                        <div className="section-title-group">
                                            <div className="section-icon backup"><Icons.Archive size={18} strokeWidth={2.5} /></div>
                                            <div>
                                                <h4>Offline Backups</h4>
                                                <p className="helper-text">Automated local snapshots stored in your installation folder</p>
                                            </div>
                                        </div>
                                        <div className="cycle-selector-wrapper">
                                            <span className="selector-label">Backup Frequency:</span>
                                            <CustomSelect 
                                                value={backupCycle} 
                                                onChange={(val) => handleBackupCycleChange(val)} 
                                                options={[
                                                    { value: 'manual', label: 'Manually' },
                                                    { value: 'session_end', label: 'End of Session' },
                                                    { value: '2_days', label: 'Every 2 Days' },
                                                    { value: '4_days', label: 'Every 4 Days' },
                                                    { value: '10_days', label: 'Every 10 Days' },
                                                    { value: 'monthly', label: 'Every Month' }
                                                ]}
                                                className="backup-cycle-select-custom"
                                            />
                                            {settings.cloud_backups_enabled === 'true' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div className="auto-push-control" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>AUTO-SYNC:</span>
                                                        <div className="toggle-switch small" 
                                                            onClick={() => setSettings({ ...settings, auto_push_to_ai: settings.auto_push_to_ai === 'true' ? 'false' : 'true' })}
                                                            style={{ cursor: 'pointer', transform: 'scale(0.8)' }}
                                                        >
                                                            <div className={`toggle-track ${settings.auto_push_to_ai === 'true' ? 'on' : ''}`}></div>
                                                        </div>
                                                    </div>

                                                    <SButton 
                                                        variant="primary" 
                                                        tone="success"
                                                        onClick={handlePushLatestToCloud} 
                                                        disabled={saving || backupList.length === 0} 
                                                        style={{ padding: '8px 16px', height: '40px' }}
                                                    >
                                                        Push Latest
                                                    </SButton>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="backup-stats-dashboard">
                                        <div className="stat-card">
                                            <span className="stat-label">LAST BACKUP</span>
                                            <span className="stat-value">{settings.last_backup_date ? formatDate(settings.last_backup_date, true) : 'Never'}</span>
                                        </div>
                                        <div className="stat-card">
                                            <span className="stat-label">NEXT SCHEDULED</span>
                                            <span className="stat-value">
                                                {(backupCycle === 'off' || backupCycle === 'manual') ? 'Manual Sync Only' : (
                                                    (() => {
                                                        const last = settings.last_backup_date ? new Date(settings.last_backup_date) : new Date();
                                                        let next = new Date(last);
                                                        if (backupCycle === '2_days') next.setDate(next.getDate() + 2);
                                                        else if (backupCycle === '4_days') next.setDate(next.getDate() + 4);
                                                        else if (backupCycle === '10_days') next.setDate(next.getDate() + 10);
                                                        else if (backupCycle === 'monthly') next.setMonth(next.getMonth() + 1);
                                                        return formatDate(next);
                                                    })()
                                                )}
                                            </span>
                                        </div>
                                        <div className="stat-card action" style={{ flexDirection: 'row', gap: '12px' }}>
                                            <button className="btn-backup-now" onClick={handleBackupNow} disabled={saving} style={{ flex: 1 }}>
                                                {saving ? 'Backing up...' : 'Backup Now'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="backup-history-section">
                                        <div className="history-header">
                                            <h5>Recent Automatic Backups</h5>
                                            <span className="history-count">{backupList.length} total</span>
                                        </div>
                                        <div className="backup-items-list">
                                            {backupList.length === 0 ? (
                                                <div className="empty-history">
                                                    <Icons.FileText size={32} />
                                                    <p>No automatic snapshots found.</p>
                                                </div>
                                            ) : (
                                                backupList.slice(0, 5).map(b => (
                                                    <div key={b.filename} className="backup-history-item">
                                                        <div className="item-icon">
                                                            <Icons.FileText size={20} />
                                                        </div>
                                                        <div className="item-details">
                                                            <span className="item-filename">{b.filename}</span>
                                                            <span className="item-meta">{formatDate(b.created_at, true)} • {(b.size / 1024).toFixed(1)} KB</span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <SButton variant="secondary" onClick={() => handleRestoreFromBackup(b.filename)} disabled={saving}>
                                                                Restore
                                                            </SButton>
                                                            <SButton
                                                                variant="secondary"
                                                                tone="critical"
                                                                onClick={() => handleDeleteBackup(b.filename)}
                                                                disabled={saving}
                                                                style={{ 
                                                                    padding: '6px', 
                                                                    borderRadius: '6px', 
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                            >
                                                                Delete
                                                            </SButton>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Supabase Cloud Backup Section */}
                                <div className="backup-management-container" style={{ marginTop: '24px' }}>
                                    <div className="section-header-row">
                                        <div className="section-title-group">
                                            <div className="section-icon cloud" style={{ background: 'transparent', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <img src="./icons/mazeway.png" style={{ width: '32px', height: '32px', objectFit: 'contain' }} alt="Mazeway" />
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Cloud Storage Backups</h4>
                                                <p className="helper-text" style={{ fontSize: '12px' }}>Securely save your business backups to Mazeway Cloud Storage</p>
                                            </div>
                                        </div>
                                        <div className="toggle-switch" 
                                            onClick={() => setSettings({ ...settings, cloud_backups_enabled: settings.cloud_backups_enabled === 'true' ? 'false' : 'true' })}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className={`toggle-track ${settings.cloud_backups_enabled === 'true' ? 'on' : ''}`}></div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}


                        {activeTab === 'inventory' && (
                            <div className="settings-section-card">
                                <h3>Batch & Lot Management</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                    {[
                                        { key: 'enable_batch_system', label: 'Enable Batch / Lot System', desc: 'Allows tracking product quantities by specific batches/lots' },
                                        { key: 'require_batch_number', label: 'Require Batch Number', desc: 'Forces users to enter a batch number during stock entry' },
                                        { key: 'enable_expiry_tracking', label: 'Enable Expiry Tracking', desc: 'Enables entering expiry dates for batches' },
                                        { key: 'allow_negative_batch_stock', label: 'Allow Negative Batch Stock', desc: 'Permits selling more than the current available batch quantity' },
                                        { key: 'enable_serial_tracking', label: 'Enable Serial / IMEI Tracking', desc: 'Allows tracking product quantities by unique Serial and IMEI numbers' },
                                        { key: 'flexible_inventory', label: 'Flexible Inventory', desc: 'Allow creating invoices even if stock is 0 or insufficient' }
                                    ].map(item => (
                                        <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.label}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{item.desc}</div>
                                            </div>
                                            <div 
                                                className="toggle-switch" 
                                                onClick={() => setSettings({ ...settings, [item.key]: settings[item.key] === 'true' ? 'false' : 'true' })}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div className={`toggle-track ${settings[item.key] === 'true' ? 'on' : ''}`}></div>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="settings-grid" style={{ marginTop: '16px' }}>
                                        <div className="form-group">
                                            <label>Auto Batch Selection Method</label>
                                            <CustomSelect 
                                                value={settings.auto_batch_selection_method || 'FIFO'} 
                                                onChange={(val) => setSettings({ ...settings, auto_batch_selection_method: val })}
                                                options={[
                                                    { value: 'FIFO', label: 'FIFO (First Expiry First)' },
                                                    { value: 'MANUAL', label: 'Manual Selection' }
                                                ]}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Expiry Alert Settings (Days)</label>
                                            <input 
                                                type="number" 
                                                value={settings.expiry_alert_days || ''} 
                                                onChange={e => setSettings({ ...settings, expiry_alert_days: e.target.value })} 
                                                placeholder="e.g. 30" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'app_settings' && (
                            <div className="settings-section-card">
                                <h3>App Behavior & Interfaces</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                    {[
                                        { key: 'enable_quick_sale', label: 'Enable Quick Sale Interface', desc: 'Shows a dedicated, high-speed POS checkout tab on the Sales page' },
                                        { key: 'enable_customer_display', label: 'Enable Secondary Customer Display', desc: 'Allows opening a customer-facing window to show items and total during checkout' }
                                    ].filter(item => item.key === 'enable_quick_sale' || settings.enable_quick_sale === 'true').map(item => (
                                        <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.label}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{item.desc}</div>
                                            </div>
                                            <div 
                                                className="toggle-switch" 
                                                onClick={() => setSettings({ ...settings, [item.key]: settings[item.key] === 'true' ? 'false' : 'true' })}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div className={`toggle-track ${settings[item.key] === 'true' ? 'on' : ''}`}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="settings-divider" style={{ margin: '30px 0 20px 0', borderTop: '1px solid var(--border-light)' }}></div>
                                
                                <h3>Keyboard & Accessibility</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>Global Keyboard Shortcuts</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>View and manage all shortcut keys for fast application navigation</div>
                                        </div>
                                        <SButton 
                                            variant="secondary" 
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px' }}
                                            onClick={() => window.dispatchEvent(new CustomEvent('open-keyboard-shortcuts'))}
                                        >
                                            View Shortcuts
                                        </SButton>
                                    </div>
                                </div>

                                <div className="settings-divider" style={{ margin: '30px 0 20px 0', borderTop: '1px solid var(--border-light)' }}></div>
                                
                                <h3>Hardware Integration</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                    {[
                                        { key: 'enable_barcode_scanner', label: 'Enable Barcode Scanner Listener', desc: 'Listens globally for barcode scanner input (keyboard wedge) on the Sales page' },
                                        { key: 'enable_cash_drawer', label: 'Enable Cash Drawer Integration', desc: 'Automatically triggers the cash drawer kick command (via thermal printer) when a POS receipt is printed' }
                                    ].map(item => (
                                        <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.label}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{item.desc}</div>
                                            </div>
                                            <div 
                                                className="toggle-switch" 
                                                onClick={() => setSettings({ ...settings, [item.key]: settings[item.key] === 'true' ? 'false' : 'true' })}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div className={`toggle-track ${settings[item.key] === 'true' ? 'on' : ''}`}></div>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="notice-box info" style={{ marginTop: '4px', background: 'rgba(0, 113, 227, 0.05)', border: '1px solid rgba(0, 113, 227, 0.1)' }}>
                                        <div className="notice-icon"><Icons.HelpCircle size={20} color="var(--accent)" /></div>
                                        <div className="notice-content">
                                            <strong style={{ fontSize: '13px', color: 'var(--accent)' }}>What is a Cash Drawer?</strong>
                                            <p style={{ fontSize: '12px', marginTop: '2px' }}>A cash drawer is a secure compartment for storing cash. It typically connects to your thermal receipt printer via a DK (Drawer Kick) port and opens automatically when a sale is finalized.</p>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '10px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: testScannerMode ? '16px' : '0' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Icons.Scan size={18} />
                                                    Test Barcode Scanner Connection
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                                    Turn this on to verify if your scanner is working correctly and can find products.
                                                </div>
                                            </div>
                                            <div 
                                                className="toggle-switch" 
                                                onClick={() => {
                                                    setTestScannerMode(!testScannerMode);
                                                    setTestScanResult(null);
                                                }}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div className={`toggle-track ${testScannerMode ? 'on' : ''}`}></div>
                                            </div>
                                        </div>

                                        {testScannerMode && (
                                            <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px dashed var(--accent)', textAlign: 'center' }}>
                                                {!testScanResult ? (
                                                    <div style={{ color: 'var(--text-secondary)' }}>
                                                        <Icons.Wifi size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                                        <div>Listening for scanner input...</div>
                                                        <div style={{ fontSize: '12px', marginTop: '4px' }}>Scan any barcode to test.</div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div style={{ color: 'var(--success)', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                            <Icons.CheckCircle size={20} />
                                                            Scanner Connected Successfully!
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Scanned Code:</span>
                                                                <span style={{ fontWeight: 600, fontSize: '14px' }}>{testScanResult.code}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Inventory Match:</span>
                                                                {testScanResult.product ? (
                                                                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--success)' }}>Found ({testScanResult.product.name})</span>
                                                                ) : (
                                                                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--danger)' }}>Not Found in Inventory</span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: '4px' }}>
                                                                Scanned at {testScanResult.timestamp.toLocaleTimeString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Icons.CreditCard size={18} />
                                                    Test Cash Drawer Trigger
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                                    Send a test "pulse" to your default printer to verify if the cash drawer opens.
                                                </div>
                                            </div>
                                            <SButton 
                                                variant="primary"
                                                onClick={handleTestCashDrawer}
                                                disabled={isTestingDrawer}
                                                style={{ height: '32px' }}
                                            >
                                                {isTestingDrawer ? 'Triggering...' : 'Test Drawer'}
                                            </SButton>
                                        </div>
                                        
                                        {drawerTestResult && (
                                            <div style={{ marginTop: '12px', padding: '12px', background: drawerTestResult.success ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', border: `1px solid ${drawerTestResult.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {drawerTestResult.success ? (
                                                    <Icons.CheckCircle size={16} color="var(--success)" />
                                                ) : (
                                                    <Icons.AlertCircle size={16} color="var(--danger)" />
                                                )}
                                                <span style={{ fontSize: '12px', color: drawerTestResult.success ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                                                    {drawerTestResult.message}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="settings-divider" style={{ margin: '30px 0 20px 0', borderTop: '1px solid var(--border-light)' }}></div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                    <div style={{ background: 'transparent', padding: '2px', overflow: 'hidden', width: '32px', height: '32px' }}>
                                        <img src="./icons/mazeway.png" alt="Mazeway" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Mazeway AI Integration</h4>
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', margin: '4px 0 0 0' }}>Connect your ERP to the Mazeway AI platform for automated sales & support</p>
                                    </div>
                                </div>

                                <div className="settings-grid">
                                    <div className="form-group full-width">
                                        <label>Mazeway API Key</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input 
                                                type="password" 
                                                value={settings.mazeway_api_key || ''} 
                                                onChange={e => setSettings({ ...settings, mazeway_api_key: e.target.value })} 
                                                placeholder={settings.mazeway_api_key ? "API Key is set" : "Enter your Mazeway API Key"} 
                                                style={{ flex: 1 }}
                                            />
                                            <SButton 
                                                variant={settings.mazeway_api_key ? "primary" : "secondary"}
                                                tone={settings.mazeway_api_key ? "success" : undefined}
                                                onClick={() => !settings.mazeway_api_key && setShowMazewayConnectModal(true)}
                                                style={{
                                                    cursor: settings.mazeway_api_key ? 'default' : 'pointer',
                                                    minWidth: '140px'
                                                }}
                                            >
                                                {settings.mazeway_api_key ? "Connected" : "Connect with Mazeway"}
                                            </SButton>
                                        </div>
                                        <p className="helper-text">Connecting will automatically sync your API Key and Webhook URL.</p>
                                    </div>
                                    <div className="form-group full-width">
                                        <label>Webhook URL (Target)</label>
                                        <input 
                                            type="text" 
                                            value={settings.mazeway_webhook_url || ''} 
                                            onChange={e => setSettings({ ...settings, mazeway_webhook_url: e.target.value })} 
                                            placeholder={settings.mazeway_webhook_url || "https://mazeway.up.railway.app/api/webhooks/your-id"} 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'updates' && (
                            <div className="settings-section-card">
                                <h3>Version & Updates</h3>
                                <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: '4px 0 24px 0' }}>
                                    Manage your system version and install official security and feature upgrades.
                                </p>

                                <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 700 }}>Quantro Desktop ERP</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                                Current Version: <strong style={{ color: 'var(--accent)' }}>v{APP_VERSION}</strong>
                                            </div>
                                        </div>
                                        <SButton 
                                            type="button"
                                            variant={updateState.status === 'checking' ? 'secondary' : 'primary'}
                                            loading={updateState.status === 'checking'}
                                            onClick={handleCheckForUpdates}
                                            disabled={updateState.status === 'downloading' || updateState.status === 'downloaded'}
                                        >
                                            Check for Updates
                                        </SButton>
                                    </div>

                                    {/* Auto-update Toggle Switch */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>Automatic Updates</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Automatically download and prepare updates when connected to the internet</div>
                                        </div>
                                        <div 
                                            className="toggle-switch" 
                                            onClick={async () => {
                                                const newValue = settings.auto_update_enabled === 'true' ? 'false' : 'true';
                                                const updatedSettings = { ...settings, auto_update_enabled: newValue };
                                                setSettings(updatedSettings);
                                                try {
                                                    await api.updateSettings({ auto_update_enabled: newValue });
                                                    toast.success(newValue === 'true' ? 'Automatic updates enabled' : 'Automatic updates disabled');
                                                } catch (err) {
                                                    toast.error('Failed to save auto-update setting: ' + err.message);
                                                }
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className={`toggle-track ${settings.auto_update_enabled === 'true' ? 'on' : ''}`}></div>
                                        </div>
                                    </div>

                                    {/* Idle / Initial status */}
                                    {updateState.status === 'idle' && (
                                        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                                            Last checked: Just now
                                        </div>
                                    )}

                                    {/* Checking for updates */}
                                    {updateState.status === 'checking' && (
                                        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-light)', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Icons.Activity size={16} className="spinning" />
                                            Checking the update server...
                                        </div>
                                    )}

                                    {/* Update Not Available */}
                                    {updateState.status === 'not-available' && (
                                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', background: '#e7f6f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#008060' }}>
                                                <Icons.Check size={20} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--success)' }}>You are up to date!</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Quantro v{APP_VERSION} is the latest professional release.</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Update Available */}
                                    {updateState.status === 'available' && (
                                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', background: 'rgba(235, 140, 0, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eb8c00' }}>
                                                    <Icons.Zap size={20} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>New Update Available! (v{updateState.version})</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>An official update containing optimizations is ready.</div>
                                                </div>
                                            </div>

                                            <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>What's New:</div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                                                    {updateState.releaseNotes}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                                                <SButton type="button" variant="primary" onClick={handleDownloadUpdate}>
                                                    Download Update
                                                </SButton>
                                                <SButton type="button" variant="secondary" onClick={() => setActiveTab('changelog')}>
                                                    View Full Changelog
                                                </SButton>
                                            </div>
                                        </div>
                                    )}

                                    {/* Downloading progress */}
                                    {updateState.status === 'downloading' && (
                                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Downloading update files...</span>
                                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>{updateState.progress}%</span>
                                            </div>
                                            <div style={{ height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                                                <div style={{ height: '100%', width: `${updateState.progress}%`, background: 'var(--accent)', transition: 'width 0.2s ease' }}></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Download Completed (Ready to Install) */}
                                    {updateState.status === 'downloaded' && (
                                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', background: '#e7f6f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#008060' }}>
                                                    <Icons.Check size={20} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--success)' }}>Download Completed!</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>The new version v{updateState.version} has been successfully downloaded.</div>
                                                </div>
                                            </div>

                                            <SButton type="button" variant="primary" tone="success" onClick={handleInstallUpdate} style={{ alignSelf: 'flex-start' }}>
                                                Install & Restart Now
                                            </SButton>
                                        </div>
                                    )}

                                    {/* Error State */}
                                    {updateState.status === 'error' && (
                                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--danger)' }}>
                                                <Icons.AlertCircle size={20} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>Update Failed</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{updateState.error}</div>
                                                </div>
                                            </div>
                                            <SButton type="button" variant="secondary" onClick={handleCheckForUpdates} style={{ alignSelf: 'flex-start' }}>
                                                Try Again
                                            </SButton>
                                        </div>
                                    )}

                                </div>
                            </div>
                        )}

                        {activeTab === 'changelog' && (
                            <div className="settings-section-card">
                                <h3>System Changelog</h3>
                                <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: '4px 0 24px 0' }}>
                                    Explore the rich feature releases, improvements, and system updates for Quantro ERP.
                                </p>

                                <div className="changelog-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative', paddingLeft: '24px' }}>
                                    <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', background: 'var(--border-light)' }}></div>

                                    {/* Timeline Item: v1.0.8 / Available */}
                                    {updateState.status === 'available' && (
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-primary)' }}></div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <strong style={{ fontSize: '15px' }}>Version {updateState.version} (Incoming)</strong>
                                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>Release Pending</span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                    <li><strong>System Optimization:</strong> Added automated background system database index restructuring.</li>
                                                    <li><strong>Multi-SKU Builder:</strong> Streamlined inventory multi-attribute SKU generation pipelines.</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                    {/* Timeline Item: v2.6.12 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.6.12 {updateState.status !== 'available' && '(Latest)'}</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>June 1, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Payment Status Moved:</strong> Relocated the payment status badge from the main sales invoices table to the bottom-left of the invoice preview modal for a cleaner list view.</li>
                                                <li><strong>Public Invoice Pending Qty:</strong> Excluded POS template from showing pending product quantity notifications in hosted invoices portal.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.6.11 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.6.11</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>June 1, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Marketing Tab Cleaned:</strong> Removed " (Coupons)" label from the customer page tab button.</li>
                                                <li><strong>Pending Qty Display:</strong> Enabled pending product qty tags in minimalist and formal invoice templates across both the desktop ERP and the cloud viewer.</li>
                                                <li><strong>QR Code Hosted Sync:</strong> Fixed payment QR code missing from the public billing hosted page by adding payment_qr_url to allowed settings sync keys.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.6.10 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.6.10</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>June 1, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Tab Crashes Fixed:</strong> Resolved Rules of Hooks violation inside Suppliers and Expenses renderers that caused crashes.</li>
                                                <li><strong>Real-time Price Sync:</strong> Removed payment status restriction from price sync queries so that invoice pricing updates automatically for all invoices when catalog prices change.</li>
                                                <li><strong>Smooth Bulk Actions Bar:</strong> Replaced abrupt mount/unmount behavior with elegant height expansion, transform translation, and opacity transitions.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.6.9 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.6.9</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>June 1, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Smooth Checkbox Transitions:</strong> Implemented bounce/spring-scaling transitions on click and state updates for table select checkboxes.</li>
                                                <li><strong>Purchase Tab Paginations:</strong> Added pagination sliders to Suppliers directory, Expenses tracker list, and Returns table.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.6.8 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.6.8</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 31, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Custom Pagination Footer Styling:</strong> Bolded and colored page numbers, replaced text ranges, and styled buttons borderless/transparent.</li>
                                                <li><strong>Favicon Support:</strong> Configured standard favicons inside cloud-hosted billing viewer.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.6.7 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.6.7</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 31, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Invoice Merge Feature:</strong> Select two or more invoices and merge them into a single new invoice. Choose customer (registered or walk-in) in a modal, aggregate line items/quantities, automatically restore and re-deduct inventory/batch stock, relink serial numbers, and copy payments to preserve history.</li>
                                                <li><strong>Bulk Invoices &amp; Customers Deletion:</strong> Added checkboxes and premium custom-styled actions toolbars to delete multiple invoices or customers simultaneously.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.6.6 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.6.6</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 30, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Real-time Price Dynamic Sync:</strong> New toggle in Business &amp; Invoice settings — when on, updating a product's inventory price auto-updates existing unpaid invoices where that item's price was 0, recalculates totals, and syncs to cloud-hosted links.</li>
                                                <li><strong>Invoice Product Category Control:</strong> New toggle to show/hide the unique list of billed product categories at the top of invoice previews, PDFs, and cloud-hosted invoice pages.</li>
                                                <li><strong>Logo Auto-Compression &amp; PDF Rendering:</strong> Logos are now canvas-compressed on upload and startup to under 15KB, eliminating cloud sync failures. Company logo now renders on generated PDF invoices with smart layout shifting.</li>
                                                <li><strong>Dynamic Cloud Invoice Sync Fix:</strong> Resolved oversized payload errors — all invoice and settings updates now propagate in real-time to shared hosted links without needing regeneration.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.6.5 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.6.5</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 30, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Secure Card Authorization &amp; Autopay:</strong> Added standard ₹1.00 card authorization flow via Razorpay, automatic dues scheduler checks on Day 5 of the month, and relative local asset path fixes.</li>
                                                <li><strong>Cancellation Email Verification:</strong> Configured secure 6-digit email confirmation code dispatching to verify client paid-tier subscription downgrades.</li>
                                                <li><strong>Layout &amp; Button Updates:</strong> Renamed the Gmail service action button to "Get Email Service" and resolved general overlapping display issues on the Settings and sidebar layout panel.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.6.4 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.6.4</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 30, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>GitHub Models OCR Integration:</strong> Switched OCR parser to utilize the official GitHub Models API. Added `openai/gpt-4o-mini`, `openai/gpt-4o`, and `deepseek-ai/DeepSeek-V3-0324` fallback text/vision models, deprecating rate-limited OpenCode models.</li>
                                                <li><strong>Supplier Address & Contact Auto-Fill:</strong> Automatically extracts physical address and contact phone details from invoices, pre-filling them during new supplier registration inside the catalog resolution modal.</li>
                                                <li><strong>Premium OCR Filtering & Cleaning:</strong> Added Javascript boundary filters (`isAddressOrContactLine`) and regex cleaners to prevent billing addresses and customer names from leaking as items, while stripping out noise symbols (`*` and `|`).</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.6.0 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.6.0</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 30, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Resilient OCR Fallback:</strong> Added multi-model vision sequence try list and a hybrid local OCR engine (`tesseract.js`) with LLM text structure auto-correction and offline regex parsing fallback.</li>
                                                <li><strong>Gmail AI Reply Constraints:</strong> Restrained email receiver to only auto-reply on threads containing at least one sent message by us, protecting user accounts from spam loops.</li>
                                                <li><strong>Expanded Purchase Modals:</strong> Restructured purchases product registration to a complete tabbed modal matching the full inventory catalog view with SKUs & variant generation.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.5.0 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.5.0</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 26, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Two-way Communication:</strong> Track, log, and process incoming customer replies across Gmail and WhatsApp in real time.</li>
                                                <li><strong>OpenCode Zen AI Responder:</strong> Integrated context-aware auto-replies utilizing live ERP database context (invoices, payments, catalog, balances) powered by `deepseek-v4-flash-free`.</li>
                                                <li><strong>AI Sales Order Leads:</strong> Smart classification of customer intent (Support vs Sales), auto-gathering of customer profile details, and automatic draft sales order generation.</li>
                                                <li><strong>Order-to-Invoice Conversion:</strong> Convert draft orders to standard invoices instantly, pre-filling customer profiles, applying tier-based pricing discounts, and triggering dispatch notifications.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.4.5 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.4.5</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 26, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Automation Panel Cleanups:</strong> Removed redundant separate Agent List tables, unifying configuration options directly inside the Voice Agent Service tab.</li>
                                                <li><strong>WhatsApp SVG Integration:</strong> Custom Meta WhatsApp SVG applied to all action buttons and placeholder boxes for consistent branding.</li>
                                                <li><strong>Polished User Warnings:</strong> Voice Agent connection warnings updated to be page-relative and avoid site navigation redundancy.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.4.4 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.4.4</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 26, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Voice Agent Service Tab:</strong> Integrated a dedicated "Voice Agent Service" section in the Automation dashboard, displaying active/provisioning details and providing a shortcut button to get an agent.</li>
                                                <li><strong>First-time Warning Indicators:</strong> Added visual warning boxes when no Voice Agents are created, ensuring users are directed to get started.</li>
                                                <li><strong>Unified Connection Warnings:</strong> Unified warnings across Billing and Automation sections for Gmail, WhatsApp, and Voice calling.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.4.3 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.4.3</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 25, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Automation Billing Subscriptions:</strong> Created a premium **Billing** sidebar page showing usage and rates for Email, WhatsApp (without CSW), and AI Voice Agent. Includes simulated Razorpay pay gates.</li>
                                                <li><strong>Auto-Blocking Service Suspend:</strong> Implemented auto-blocking past the 5-day grace period (on the 6th of the next month) if outstanding dues exist.</li>
                                                <li><strong>Dynamic Brand Logo Integration:</strong> Company settings logo (`logo_url`) is now dynamically rendered in the ERP sidebar, customer checkout display, and all four cloud-hosted templates.</li>
                                                <li><strong>Hosted Invoice Deletion Sync:</strong> Deleting an invoice locally automatically triggers a delete action on Mazeway DB to remove the hosted row and clean up local sharing tokens.</li>
                                                <li><strong>Polished User Interface:</strong> Removed redundant "Campaign Channel" select input from CRM scheduling modal and restored version text in sidebar footer.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.4.2 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.4.2</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 25, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Cloud-Hosted Invoices:</strong> Integrated secure hosted HTML invoice delivery via Netlify linked to Mazeway DB, replacing heavy PDF email attachments.</li>
                                                <li><strong>WhatsApp Campaign scheduling:</strong> Integrated WhatsApp chat preview bubble, active WhatsApp limits tracker, and 24-hour Customer Service Window controls.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.4.0 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.4.0</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 25, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>WhatsApp Cloud API Integration:</strong> Official Embedded Signup integration, supporting auto-sending invoice PDFs, order notifications, and text campaigns.</li>
                                                <li><strong>Marketing Campaigns:</strong> Added new marketing email/text templates (Clearance Sale, Flash Sale, Due Balance Statement).</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.3.1 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.3.1</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 24, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Packaging Fix:</strong> Fixed Google OAuth packaging issue by correctly bundling `Public/` resources directory inside the final production installer.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.3.0 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.3.0</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 24, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Gmail Automations &amp; Toggles:</strong> Connected settings switches to trigger automatic emails based on order updates, returns, and Voice Agent triggers.</li>
                                                <li><strong>Purchase Bill Preview:</strong> Premium preview overlay design featuring detailed tax itemization and supplier details.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.2.0 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.2.0</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 23, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Secure Google OAuth Consent:</strong> Relocated mail servers to secure tenant consent loops using standard Google scopes instead of plain SMTP passwords.</li>
                                                <li><strong>Invoice Link Copy-Sharing:</strong> Pre-integrated dynamic URL creation with integrated share popups next to invoice previews.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.1.1 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.1.1</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 23, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Multi-Product Reward Coupons:</strong> Expanded coupon setup schemas to permit bundling multiple product reward items.</li>
                                                <li><strong>Active POS Theme Overrides:</strong> Fixed active state highlight button styles using Shadow DOM element ref mappings.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.1.0 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.1.0</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 23, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Standardized Empty States:</strong> Redesigned empty status layouts globally across Inventory and CRM panels.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.0.9 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.0.9</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 24, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Daily Email Limit Tracking:</strong> Configured 1000 daily email dispatch caps inside Connected Services.</li>
                                                <li><strong>Split-Screen Campaign Previewer:</strong> Real-time templates viewer displaying customer-specific mock data on design switches.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.0.8 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.0.8</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 23, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Serial &amp; IMEI Tracking Settings:</strong> Added global settings toggle to enable or disable Serial/IMEI tracking options across the application.</li>
                                                <li><strong>Manual Serial CRUD:</strong> Enabled adding and deleting available serial/IMEI numbers directly from the Product Inventory Serial tab, automatically adjusting stock counts and logging stock movements.</li>
                                                <li><strong>POS Out of Stock Add:</strong> Allowed double-clicking category or subcategory header banners to add all items to the cart, including out-of-stock items (controlled by flexible inventory).</li>
                                                <li><strong>Paid Invoice Payment Validation:</strong> Enforced that the sum of payments exactly matches the grand total for normal Walk-in or PAID status invoices.</li>
                                                <li><strong>Manage Subcategories Polish:</strong> Fixed button spacing in subcategory actions and implemented a controlled Save action instead of Edit labels.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.0.7 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.0.7</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 22, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Stock Movement Trend Analytic:</strong> Resolved date-timestamp string equality check failure in the dashboard trend analytics query.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.0.6 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.0.6</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 22, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>POS Bottom Checkout Bar:</strong> Moved payment actions into a dedicated sticky bottom bar with totals breakdown, live payable amount on each button, and a real-time discount toggle.</li>
                                                <li><strong>Category Selection Double-Click:</strong> Enabled double-clicking category buttons to add all in-stock products in that category directly to the cart.</li>
                                                <li><strong>Group Banners Redesign:</strong> Redesigned subcategory and brand section headers as full-width banner cards with hover translation animations.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.0.5 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.0.5</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 22, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>POS Quick Sale Payment Layout Refinement:</strong> Moved the Split Bill checkout action directly into the payment buttons grid.</li>
                                                <li><strong>Button Transparency Polish:</strong> Removed high-contrast white card background from payment buttons to match POS toolbar aesthetics.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.0.4 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.0.4</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 22, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Quick Sale Split Bill Checkout:</strong> Integrated Equal Split, Item Split, and Payment Method Split options for split bills.</li>
                                                <li><strong>Click-and-Hold Continuous Product Addition:</strong> Enabled rapid product addition to the cart by long-pressing product tiles.</li>
                                                <li><strong>Subcategory &amp; Brand Quick Sale Groupings:</strong> Grouped product tiles dynamically by Subcategory or Brand in the Quick Sale interface.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.0.3 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.0.3</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 22, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Customer Categorization:</strong> Integrated Gold, Silver, and Bronze tier settings with default tier discount rates dynamically applied on checkout.</li>
                                                <li><strong>Credit Limit Management:</strong> Introduced credit limits allowing sales transactions to exceed standard wallet balances.</li>
                                                <li><strong>Customer CRM Logs:</strong> Added interaction logging timeline with custom Left-borders for calls, emails, SMS, and meetings.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.0.2 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.0.2</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 21, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>POS Subcategory &amp; Product List Styling:</strong> Redesigned subcategory headers and aligned product lists to match full-width design.</li>
                                                <li><strong>P-Credit Wallet Deduction validation:</strong> Consolidated payment method validations into upfront combined credits validation.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.0.1 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.0.1</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 21, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Double-Click POS Batch Add:</strong> Implemented batch adding on double-clicking Category and Subcategory headers.</li>
                                                <li><strong>SQLite Migration Return Type Fix:</strong> Corrected migration checks for adding columns dynamically on startup.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v2.0.0 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 2.0.0</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 21, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Dashboard Financial Analytics Fix:</strong> Refactored estimated gross profit SQL calculations to fetch cost prices dynamically.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v1.1.4 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 1.1.4</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 20, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>AI Sales Search & Filters:</strong> Integrated real-time search bar and categories dropdown filters inside the AI Sales dashboard view.</li>
                                                <li><strong>Unified Page Headers:</strong> Standardized and polished page header layouts, alignment, and descriptions for all core tabs.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v1.1.3 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 1.1.3</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 20, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Seamless Handshake Connection:</strong> Bypassed OAuth state validation redirects if the parameter is missing/undefined due to redirect URL drops from the external Mazeway dashboard.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v1.1.2 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 1.1.2</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 20, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Automatic Updates:</strong> Added auto-updates toggle with silent background downloads and automated installation reminders.</li>
                                                <li><strong>Agent Modal Polish:</strong> Polished Vobiz fields alignment and select dropdown styles inside the Create Agent popup.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v1.1.1 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 1.1.1</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 20, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Mazeway Handshake Resiliency:</strong> Added detailed diagnostics and a secure bypass action to the handshake error screen, handling state mismatches when authorizing multiple times.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v1.1.0 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 1.1.0</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 20, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Mazeway Handshake Fix:</strong> Restructured Mazeway cloud authentication callbacks to use robust Express backend handshake routes with automated database credential sync.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v1.0.9 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 1.0.9</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 20, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Ultimate Phone Calling AI Agent:</strong> Integrated voice automation channels inside the Automation tab for real-time automated phone calls and business response triggers.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v1.0.8 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 1.0.8</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 20, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>WhatsApp AI Agent Update:</strong> Introduced new Automation tab with advanced AI customer handling, messaging streams, and order integrations for Maze ERP and Quantro.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v1.0.7 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 1.0.7</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 19, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Renderer Sandbox Security Bypass:</strong> Relayed system browser auth URLs through secure IPC tunnel mapping to avoid renderer exceptions.</li>
                                                <li><strong>Interactive Update Architecture:</strong> Integrated background download stream pipes with React UI state for real-time progress bars.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v1.0.6 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 1.0.6</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 19, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>React Component Crash Fix:</strong> Added missing `ArrowRight` icon to `Icons.jsx` definition array to prevent dashboard settings tab from crashing.</li>
                                                <li><strong>Build Script Integration:</strong> Bumped installer builds path for production setup releases.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v1.0.5 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 1.0.5</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 19, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>Windows 11 Print Engine Restructuring:</strong> Replaced the faulty `enable-print-preview` dialog sequence with standard bypass mechanisms.</li>
                                                <li><strong>Native Dialog Integration:</strong> Mapped direct legacy print configuration calls to let printer spoolers launch instantly.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Timeline Item: v1.0.4 */}
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-tertiary)', border: '2px solid var(--bg-primary)' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px' }}>Version 1.0.4</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>May 15, 2026</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
                                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                <li><strong>AppData Roaming Relocation:</strong> Moved SQL database store paths outside "Program Files" directory.</li>
                                                <li><strong>Write Permission Crash Solver:</strong> Added dynamic directory generation inside users' Windows profile folders to safeguard database operations without admin locks.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab !== 'data' && activeTab !== 'updates' && activeTab !== 'changelog' && (
                            <div className="settings-footer">
                                {message.text && (
                                    <div className={`message ${message.type}`}>
                                        {message.text}
                                    </div>
                                )}
                                <SButton variant="primary" type="submit" disabled={saving} loading={saving}>
                                    Save Changes
                                </SButton>
                            </div>
                        )}
                        {activeTab === 'data' && message.text && (
                             <div className={`message ${message.type}`} style={{marginTop: '20px'}}>
                                {message.text}
                            </div>
                        )}
                    </form>
                </div>
            </div>

            {/* Export Modal */}
            <Modal
                open={showExportModal}
                onClose={() => setShowExportModal(false)}
                heading="Secure Data Export"
                primaryAction={
                    <SButton variant="primary" onClick={handleExport} disabled={saving || exportParams.categories.length === 0} loading={saving}>
                        Generate Backup File
                    </SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setShowExportModal(false)}>Cancel</SButton>
                }
            >
                <div className="modal-section">
                    <p style={{ color: '#6d7175', fontSize: '14px', marginBottom: '20px' }}>Download a comprehensive backup of your business records in a secure JSON format for safekeeping or migration.</p>
                    <label className="section-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6d7175', marginBottom: '8px', textTransform: 'uppercase' }}>SELECT DATA MODULES</label>
                    <div className="category-selection-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
                        {['inventory', 'customers', 'sales', 'purchases'].map(cat => (
                            <label key={cat} className={`selection-chip ${exportParams.categories.includes(cat) ? 'active' : ''}`} style={{ 
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '8px', border: '1px solid #c9cccf', cursor: 'pointer',
                                background: exportParams.categories.includes(cat) ? '#f1f8f5' : '#fff',
                                borderColor: exportParams.categories.includes(cat) ? '#008060' : '#c9cccf'
                            }}>
                                <input type="checkbox" checked={exportParams.categories.includes(cat)} onChange={() => toggleCategory(cat, exportParams, setExportParams)} style={{ width: '18px', height: '18px' }} />
                                <span className="chip-label" style={{ fontWeight: '500' }}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="modal-section">
                    <label className="section-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6d7175', marginBottom: '8px', textTransform: 'uppercase' }}>TIME PERIOD (OPTIONAL)</label>
                    <div className="date-range-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input type="date" value={exportParams.startDate} onChange={e => setExportParams({...exportParams, startDate: e.target.value})} style={{ flex: 1 }} />
                        <span style={{ color: '#6d7175' }}>to</span>
                        <input type="date" value={exportParams.endDate} onChange={e => setExportParams({...exportParams, endDate: e.target.value})} style={{ flex: 1 }} />
                    </div>
                </div>
            </Modal>

            {/* Delete Modal */}
            <Modal
                open={showDeleteModal}
                onClose={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                heading="Destroy Records"
                variant="critical"
                primaryAction={
                    <SButton 
                        variant="primary" 
                        tone="critical" 
                        onClick={handleDeleteData} 
                        disabled={saving || deleteCategories.length === 0 || deleteConfirmText !== 'PERMANENTLY DELETE'}
                        loading={saving}
                    >
                        Confirm Destruction
                    </SButton>
                }
                secondaryActions={
                    <SButton onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}>Cancel</SButton>
                }
            >
                <div className="modal-section">
                    <p style={{ color: '#d82c0d', fontSize: '14px', fontWeight: '500', marginBottom: '20px' }}>Permanently erase sensitive business data from the local database. This action is irreversible.</p>
                    
                    <label className="section-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6d7175', marginBottom: '8px', textTransform: 'uppercase' }}>SELECT DATA TO PURGE</label>
                    <div className="category-selection-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
                        {['inventory', 'customers', 'sales', 'purchases'].map(cat => (
                            <label key={cat} className={`selection-chip danger ${deleteCategories.includes(cat) ? 'active' : ''}`} style={{ 
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '8px', border: '1px solid #c9cccf', cursor: 'pointer',
                                background: deleteCategories.includes(cat) ? '#fff1f0' : '#fff',
                                borderColor: deleteCategories.includes(cat) ? '#d82c0d' : '#c9cccf'
                            }}>
                                <input type="checkbox" checked={deleteCategories.includes(cat)} onChange={() => toggleCategory(cat, deleteCategories, setDeleteCategories)} style={{ width: '18px', height: '18px' }} />
                                <span className="chip-label" style={{ fontWeight: '500' }}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                            </label>
                        ))}
                    </div>

                    <div className="notice-box critical-warning" style={{ background: '#fff1f0', border: '1px solid #fdada8', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '12px' }}>
                        <Icons.AlertTriangle size={24} style={{ color: '#d82c0d', flexShrink: 0 }} />
                        <div>
                            <strong style={{ color: '#d82c0d', display: 'block', marginBottom: '4px' }}>Immediate Data Loss Risk</strong>
                            <p style={{ fontSize: '13px', color: '#d82c0d', margin: 0 }}>Selected categories will be completely purged from the system. You will NOT be able to recover this data unless you have a separate backup.</p>
                        </div>
                    </div>

                    <div className="modal-section confirmation-flow">
                        <label className="section-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6d7175', marginBottom: '8px', textTransform: 'uppercase' }}>SYSTEM AUTHORIZATION</label>
                        <p style={{ fontSize: '13px', color: '#6d7175', marginBottom: '12px' }}>To proceed, please type <strong>PERMANENTLY DELETE</strong> exactly as shown:</p>
                        <input 
                            type="text" 
                            value={deleteConfirmText} 
                            onChange={e => setDeleteConfirmText(e.target.value)}
                            placeholder="Type the confirmation phrase..."
                            style={{ 
                                width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #c9cccf', fontSize: '14px', fontWeight: '700', letterSpacing: '1px', textAlign: 'center',
                                borderColor: deleteConfirmText === 'PERMANENTLY DELETE' ? '#008060' : '#c9cccf'
                            }}
                        />
                    </div>
                </div>
            </Modal>

            {/* Import Modal */}
            <Modal
                open={showImportModal}
                onClose={() => setShowImportModal(false)}
                heading="Import Records"
                primaryAction={
                    <SButton variant="primary" onClick={handleImport} disabled={saving || !importFile} loading={saving}>
                        Initialize Restoration
                    </SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setShowImportModal(false)}>Cancel</SButton>
                }
            >
                <div className="modal-section">
                    <p style={{ color: '#6d7175', fontSize: '14px', marginBottom: '20px' }}>Restore your system data from a previously exported JSON backup file. This will merge with existing data.</p>
                    
                    <div className={`drop-zone ${importFile ? 'has-file' : ''}`} onClick={() => document.getElementById('import-file-input').click()} style={{
                        border: '2px dashed #c9cccf', borderRadius: '12px', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: importFile ? '#f1f8f5' : '#f6f6f7', borderColor: importFile ? '#008060' : '#c9cccf'
                    }}>
                        {importFile ? (
                            <div>
                                <Icons.CheckCircle size={48} style={{ color: '#008060', marginBottom: '12px' }} />
                                <p style={{ fontWeight: '600', color: '#202223' }}>{importFile.name}</p>
                                <p style={{ fontSize: '12px', color: '#6d7175' }}>{(importFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                        ) : (
                            <div>
                                <Icons.Upload size={48} style={{ color: '#c9cccf', marginBottom: '12px' }} />
                                <p style={{ fontWeight: '600', color: '#202223' }}>Click to browse or drop file</p>
                                <p style={{ fontSize: '12px', color: '#6d7175' }}>Only Quantro JSON backup files are supported</p>
                            </div>
                        )}
                        <input type="file" id="import-file-input" accept=".json" onChange={e => setImportFile(e.target.files[0])} style={{display: 'none'}} />
                    </div>

                    <div style={{ marginTop: '20px', padding: '16px', background: '#f1f8fa', border: '1px solid #b7e1eb', borderRadius: '8px', display: 'flex', gap: '12px' }}>
                        <Icons.AlertCircle size={24} style={{ color: '#005f73', flexShrink: 0 }} />
                        <div>
                            <strong style={{ color: '#005f73', display: 'block', marginBottom: '4px' }}>System Merge Notice</strong>
                            <p style={{ fontSize: '13px', color: '#005f73', margin: 0 }}>Imported records will be merged with your current local database. Duplicate IDs may be overwritten.</p>
                        </div>
                    </div>

                    {importProgress > 0 && (
                        <div style={{ marginTop: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#202223' }}>{importProgress === 100 ? 'Sync Complete' : 'Restoring Records...'}</span>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#008060' }}>{importProgress}%</span>
                            </div>
                            <div style={{ height: '8px', background: '#f1f1f1', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${importProgress}%`, background: '#008060', transition: 'width 0.3s ease' }}></div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Mazeway Connect Modal */}
            <Modal
                open={showMazewayConnectModal}
                onClose={() => {
                    setShowMazewayConnectModal(false);
                    setIsConnectingMazeway(false);
                }}
                heading={isConnectingMazeway ? "Connecting with Mazeway..." : "Authorize Mazeway AI"}
                size="small"
                primaryAction={
                    !isConnectingMazeway ? (
                        <SButton variant="primary" onClick={handleAuthorize} fullWidth>Authorize</SButton>
                    ) : null
                }
                secondaryActions={
                    <SButton onClick={() => {
                        setShowMazewayConnectModal(false);
                        setIsConnectingMazeway(false);
                    }} fullWidth>Cancel</SButton>
                }
            >
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div className="connecting-visual" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '24px' }}>
                        <div style={{ width: '64px', height: '64px', background: '#f6f6f7', borderRadius: '14px', padding: '12px', border: '1px solid #ebebed' }}>
                            <img src="./icons/mazeway.png" alt="Mazeway" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        {isConnectingMazeway ? (
                            <div className="spinner" style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                border: '3px solid var(--accent)',
                                borderTopColor: 'transparent'
                            }}></div>
                        ) : (
                            <Icons.ArrowRight size={24} style={{ color: '#babfc3' }} />
                        )}
                        <div style={{ width: '64px', height: '64px', background: '#f6f6f7', borderRadius: '14px', padding: '12px', border: '1px solid #ebebed' }}>
                            <img src="./icons/Appicon.ico" alt="Quantro" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                    </div>
                    
                    {isConnectingMazeway ? (
                        <p style={{ color: '#6d7175', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
                            Awaiting authorization from your browser... <br />
                            Please complete the linking process on the Mazeway page. Once connected, this window will close automatically.
                        </p>
                    ) : (
                        <p style={{ color: '#6d7175', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
                            Login to unlock intelligence with Mazeway AI. This will securely link your ERP for automated sales & support.
                        </p>
                    )}
                </div>
            </Modal>
        </div>
    );
}
