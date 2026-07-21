import React, { useState, useEffect } from 'react';
import SButton from '../SButton';
import { Icons } from '../Icons';
import api from '../../api';
import { toast } from 'sonner';
import Modal from '../Modal';

const LANGUAGE_LABELS = {
    en: 'English (Indian)',
    hi: 'Hindi',
    gu: 'Gujarati',
    mr: 'Marathi',
    ta: 'Tamil'
};

function getPersonalityLabel(prompt) {
    if (!prompt) return 'Custom';
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.includes('aggressive and persuasive sales closing assistant')) return 'Sales';
    if (cleanPrompt.includes('empathetic and helpful customer support assistant')) return 'Support';
    if (cleanPrompt.includes('analytical and firm procurement assistant')) return 'Purchase';
    if (cleanPrompt.includes('balanced and professional business assistant')) return 'Multipurpose';
    return 'Custom';
}

export default function ConnectedServicesCard({
    agents = [],
    onCreateVoiceAgent,
    onOpenConfig,
    onToggleActive,
    onDeleteAgent,
    onEditAgent
}) {
    const voiceAgents = (agents || []).filter(a => a.type?.toLowerCase() === 'voice');

    // Gmail States
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showTestModal, setShowTestModal] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [testSender, setTestSender] = useState('');
    const [testRecipient, setTestRecipient] = useState('');
    const [testSubject, setTestSubject] = useState('Maze ERP Test Email');
    const [testBody, setTestBody] = useState('Hello! This is a test email sent from Maze ERP via Gmail OAuth.');
    const [sendingTest, setSendingTest] = useState(false);

    // WhatsApp States
    const [waConnections, setWaConnections] = useState([]);
    const [loadingWa, setLoadingWa] = useState(true);
    const [showWaChoiceModal, setShowWaChoiceModal] = useState(false);
    const [connectingQEIWA, setConnectingQEIWA] = useState(false);
    const [showWaTestModal, setShowWaTestModal] = useState(false);
    const [showWaManageModal, setShowWaManageModal] = useState(false);
    const [testWaPhone, setTestWaPhone] = useState('');
    const [sendingWaTest, setSendingWaTest] = useState(false);

    // Shared Settings
    const [settings, setSettings] = useState({});

    const fetchConnections = async () => {
        setLoading(true);
        try {
            const data = await api.getGmailConnections();
            setConnections(data || []);
        } catch (err) {
            console.error('Failed to fetch Gmail connections:', err);
            toast.error('Failed to load Gmail connections.');
        } finally {
            setLoading(false);
        }
    };

    const fetchWhatsAppConnections = async () => {
        setLoadingWa(true);
        try {
            const data = await api.getWhatsAppConnections();
            setWaConnections(data || []);
        } catch (err) {
            console.error('Failed to fetch WhatsApp connections:', err);
        } finally {
            setLoadingWa(false);
        }
    };

    const loadSettings = async () => {
        try {
            const data = await api.getSettings();
            setSettings(data || {});
        } catch (err) {
            console.error('Failed to fetch settings:', err);
        }
    };

    const handleToggleSetting = async (key, val) => {
        try {
            const updatedValue = val ? 'true' : 'false';
            setSettings(prev => ({ ...prev, [key]: updatedValue }));
            await api.updateSettings({ [key]: updatedValue });
            toast.success('Automation setting updated.');
        } catch (err) {
            console.error('Failed to update setting:', err);
            toast.error('Failed to update automation setting.');
            loadSettings();
        }
    };

    const handleNumberSettingChange = async (key, value) => {
        try {
            setSettings(prev => ({ ...prev, [key]: value }));
            await api.updateSettings({ [key]: String(value) });
        } catch (err) {
            console.error('Failed to update numerical setting:', err);
            loadSettings();
        }
    };

    useEffect(() => {
        fetchConnections();
        fetchWhatsAppConnections();
        loadSettings();

        // Check URL for WhatsApp success redirect callback
        const checkParams = () => {
            if (window.location.href.includes('whatsapp=success')) {
                fetchWhatsAppConnections();
                toast.success('WhatsApp service connected successfully!');
                // Clean URL query params to prevent repeating toast on reload
                if (window.history.replaceState) {
                    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash.split('?')[0];
                    window.history.replaceState({}, document.title, cleanUrl);
                }
            }
        };
        checkParams();

        // Listen for new connections completed from Deep Links
        const handleGmailConnected = (event) => {
            if (event.data?.type === 'gmail-connected') {
                fetchConnections();
            }
        };
        const handleWhatsAppConnected = (event) => {
            if (event.data?.type === 'whatsapp-connected') {
                fetchWhatsAppConnections();
            }
        };
        window.addEventListener('message', handleGmailConnected);
        window.addEventListener('message', handleWhatsAppConnected);
        return () => {
            window.removeEventListener('message', handleGmailConnected);
            window.removeEventListener('message', handleWhatsAppConnected);
        };
    }, []);

    const handleConnect = () => {
        const authUrl = 'http://localhost:3001/auth/google';
        if (window.maze?.openExternal) {
            window.maze.openExternal(authUrl);
        } else {
            window.open(authUrl, '_blank');
        }
    };

    const handleDisconnect = async (email) => {
        if (!window.confirm(`Are you sure you want to disconnect ${email}?`)) return;
        
        const loadingId = toast.loading('Disconnecting Gmail account...');
        try {
            await api.disconnectGmail(email);
            toast.success('Gmail account disconnected successfully.', { id: loadingId });
            fetchConnections();
        } catch (err) {
            console.error('Failed to disconnect:', err);
            toast.error(err.message || 'Failed to disconnect Gmail account.', { id: loadingId });
        }
    };

    const handleOpenTest = (email) => {
        setTestSender(email);
        setShowTestModal(true);
    };

    const handleSendTest = async () => {
        if (!testRecipient.trim()) {
            toast.error('Recipient email is required.');
            return;
        }

        setSendingTest(true);
        const loadingId = toast.loading('Sending test email...');
        try {
            await api.sendTestEmail({
                senderEmail: testSender,
                to: testRecipient,
                subject: testSubject,
                body: testBody
            });
            toast.success(`Test email sent successfully to ${testRecipient}`, { id: loadingId });
            setShowTestModal(false);
            setTestRecipient('');
            fetchConnections();
        } catch (err) {
            console.error('Test email failed:', err);
            toast.error(err.message || 'Failed to send test email.', { id: loadingId });
        } finally {
            setSendingTest(false);
        }
    };

    // WhatsApp Action Handlers
    const handleConnectQEIWA = async () => {
        setConnectingQEIWA(true);
        const loadingId = toast.loading('Connecting to QEIWA WhatsApp service...');
        try {
            await api.connectQEIWA();
            toast.success('Connected to Quantro ERP Identity WhatsApp Automation (QEIWA) successfully!', { id: loadingId });
            setShowWaChoiceModal(false);
            fetchWhatsAppConnections();
        } catch (err) {
            console.error('Failed to connect QEIWA:', err);
            toast.error(err.message || 'Failed to connect QEIWA service.', { id: loadingId });
        } finally {
            setConnectingQEIWA(false);
        }
    };

    const handleConnectWhatsApp = () => {
        const authUrl = 'http://localhost:3001/auth/whatsapp/connect';
        if (window.maze?.openExternal) {
            window.maze.openExternal(authUrl);
        } else {
            window.open(authUrl, '_blank');
        }
    };

    const handleDisconnectWhatsApp = async (phoneId) => {
        if (!window.confirm('Are you sure you want to disconnect this WhatsApp service?')) return;
        
        const loadingId = toast.loading('Disconnecting WhatsApp service...');
        try {
            await api.disconnectWhatsApp(phoneId);
            toast.success('WhatsApp service disconnected successfully.', { id: loadingId });
            fetchWhatsAppConnections();
        } catch (err) {
            console.error('Failed to disconnect WhatsApp:', err);
            toast.error(err.message || 'Failed to disconnect WhatsApp service.', { id: loadingId });
        }
    };

    const handleSendWhatsAppTest = async () => {
        if (!testWaPhone.trim()) {
            toast.error('Recipient phone number is required.');
            return;
        }

        setSendingWaTest(true);
        const loadingId = toast.loading('Sending test WhatsApp message...');
        try {
            await api.sendWhatsAppTest({ phone: testWaPhone });
            toast.success(`Test message sent successfully to ${testWaPhone}`, { id: loadingId });
            setShowWaTestModal(false);
            setTestWaPhone('');
        } catch (err) {
            console.error('Test WhatsApp failed:', err);
            toast.error(err.message || 'Failed to send test WhatsApp message.', { id: loadingId });
        } finally {
            setSendingWaTest(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* GMAIL SERVICE SECTION */}
            <div className="agents-section" style={{ marginTop: '12px' }}>
                <div className="agents-section-header" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px'
                    }}>
                        <img src="./gmail-icon.png" alt="Gmail" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div className="section-title-wrap" style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                                Gmail Service
                            </h3>
                            {connections.length > 0 && (
                                <span style={{ 
                                    fontSize: '13px', 
                                    fontWeight: 600, 
                                    color: connections[0].emailsSentToday >= (connections[0].emailsLimit || 1000) ? '#e53e3e' : 'var(--text-secondary)',
                                    background: '#f8fafc',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)'
                                }}>
                                    Daily Limit: {connections[0].emailsSentToday} / {connections[0].emailsLimit || 1000} Sent
                                </span>
                            )}
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Send invoices, order confirmations, feedback, and marketing campaigns using your own business Gmail account.
                        </p>
                    </div>
                    {connections.length === 0 && !loading && (
                        <SButton variant="primary" onClick={handleConnect} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <Icons.Mail size={16} />
                            Get Email Service
                        </SButton>
                    )}
                </div>

                <div style={{ marginTop: '20px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                            <span className="spinner" style={{ borderTopColor: 'var(--accent)', width: '24px', height: '24px' }}></span>
                        </div>
                    ) : connections.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {connections.map(conn => (
                                <div key={conn.id} className="agent-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '14px', border: '1px solid var(--border)', background: '#fff' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{conn.email}</span>
                                                <span className={`agent-status-chip ${conn.status === 'Active' ? 'active' : 'provisioning'}`} style={{
                                                    fontSize: '10px',
                                                    padding: '2px 8px',
                                                    borderRadius: '999px',
                                                    fontWeight: 700,
                                                    background: conn.status === 'Active' ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)',
                                                    color: conn.status === 'Active' ? 'var(--success)' : 'var(--danger)',
                                                    border: '1px solid currentColor'
                                                }}>
                                                    {conn.status}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Icons.Calendar size={12} />
                                                    Connected on {new Date(conn.connectedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <SButton variant="secondary" size="small" onClick={() => setShowManageModal(true)}>
                                            Manage
                                        </SButton>
                                        <SButton variant="secondary" size="small" onClick={() => handleOpenTest(conn.email)}>
                                            Send Test
                                        </SButton>
                                        <SButton variant="secondary" tone="critical" size="small" onClick={() => handleDisconnect(conn.email)}>
                                            Disconnect
                                        </SButton>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', border: '1px dashed var(--border)', borderRadius: '12px', background: 'var(--bg-soft)' }}>
                            <Icons.Mail size={32} style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }} />
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                No Gmail accounts connected yet. Connect your email to automate customer communications.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* WHATSAPP SERVICE SECTION */}
            <div className="agents-section">
                <div className="agents-section-header" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        overflow: 'hidden'
                    }}>
                        <img src="./whatsapp-icon.png" alt="WhatsApp" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div className="section-title-wrap" style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                                WhatsApp Service
                            </h3>
                            {waConnections.length > 0 && (
                                <span style={{ 
                                    fontSize: '13px', 
                                    fontWeight: 600, 
                                    color: (waConnections[0].messagesSentToday || 0) >= (waConnections[0].messagesLimit || 1800) ? '#e53e3e' : 'var(--text-secondary)',
                                    background: '#f8fafc',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)'
                                }}>
                                    Daily Limit: {waConnections[0].messagesSentToday || 0} / {waConnections[0].messagesLimit || 1800} Sent
                                </span>
                            )}
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Send styled invoice PDFs directly to customer numbers, automate notifications, and schedule text marketing campaigns.
                        </p>
                    </div>
                    {waConnections.length === 0 && !loadingWa && (
                        <SButton variant="primary" onClick={() => setShowWaChoiceModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-whatsapp" viewBox="0 0 16 16">
                                <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                            </svg>
                            Get WhatsApp Service
                        </SButton>
                    )}
                </div>

                <div style={{ marginTop: '20px' }}>
                    {loadingWa ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                            <span className="spinner" style={{ borderTopColor: 'var(--accent)', width: '24px', height: '24px' }}></span>
                        </div>
                    ) : waConnections.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {waConnections.map(conn => {
                                const isQeiwa = conn.service_type === 'QEIWA' || conn.phone_number_id === '1232217746642571';
                                const displayTitle = isQeiwa
                                    ? 'Quantro QEIWA (+91 90332 81960)'
                                    : (conn.phone_number ? `OBIWA (${conn.phone_number})` : `Phone ID: ${conn.phone_number_id}`);
                                return (
                                    <div key={conn.id} className="agent-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '14px', border: '1px solid var(--border)', background: '#fff' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{displayTitle}</span>
                                                    <span className="agent-status-chip active" style={{
                                                        fontSize: '10px',
                                                        padding: '2px 8px',
                                                        borderRadius: '999px',
                                                        fontWeight: 700,
                                                        background: isQeiwa ? 'rgba(37, 211, 102, 0.15)' : 'rgba(2, 132, 199, 0.12)',
                                                        color: isQeiwa ? '#128C7E' : '#0284c7',
                                                        border: '1px solid currentColor'
                                                    }}>
                                                        {isQeiwa ? 'QEIWA' : 'OBIWA'}
                                                    </span>
                                                    <span className="agent-status-chip active" style={{
                                                        fontSize: '10px',
                                                        padding: '2px 8px',
                                                        borderRadius: '999px',
                                                        fontWeight: 700,
                                                        background: 'rgba(52, 199, 89, 0.1)',
                                                        color: 'var(--success)',
                                                        border: '1px solid currentColor'
                                                    }}>
                                                        {conn.status || 'Active'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                                    <span>WABA ID: {conn.waba_id}</span>
                                                    <span>•</span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Icons.Calendar size={12} />
                                                        Connected on {new Date(conn.connected_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <SButton variant="secondary" size="small" onClick={() => setShowWaManageModal(true)}>
                                                Manage
                                            </SButton>
                                            <SButton variant="secondary" size="small" onClick={() => setShowWaTestModal(true)}>
                                                Send Test
                                            </SButton>
                                            <SButton variant="secondary" tone="critical" size="small" onClick={() => handleDisconnectWhatsApp(conn.phone_number_id)}>
                                                Disconnect
                                            </SButton>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', border: '1px dashed var(--border)', borderRadius: '12px', background: 'var(--bg-soft)' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-whatsapp" viewBox="0 0 16 16" style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                            </svg>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                No WhatsApp Business accounts connected yet. Get started with WhatsApp Cloud API to automate customer outreach.
                            </p>
                            <SButton
                                variant="primary"
                                onClick={() => setShowWaChoiceModal(true)}
                                style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-whatsapp" viewBox="0 0 16 16">
                                    <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                                </svg>
                                Get WhatsApp Service
                            </SButton>
                        </div>
                    )}
                </div>
            </div>

            {/* VOICE AGENT SERVICE SECTION */}
            <div className="agents-section" style={{ opacity: settings.license_plan !== 'Professional' ? 0.75 : 1 }}>
                <div className="agents-section-header" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        overflow: 'hidden'
                    }}>
                        <img src="./mazeway.png" alt="Voice Agent" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div className="section-title-wrap" style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Voice Agent Service
                                {settings.license_plan !== 'Professional' && (
                                    <Icons.Lock size={14} style={{ color: '#94a3b8' }} title="Requires AI Professional" />
                                )}
                            </h3>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Automate customer calling using advanced AI personas, answer queries, perform outbound campaigns, and schedule calls.
                        </p>
                    </div>
                    {voiceAgents.length === 0 && (
                        <SButton 
                            variant="primary" 
                            onClick={(e) => {
                                if (settings.license_plan !== 'Professional') {
                                    toast.info("Managed AI Voice Agents require the AI Professional plan. Click the upgrade link in the sidebar to unlock.");
                                    return;
                                }
                                onCreateVoiceAgent(e);
                            }} 
                            style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                opacity: settings.license_plan !== 'Professional' ? 0.7 : 1,
                                cursor: settings.license_plan !== 'Professional' ? 'not-allowed' : 'pointer'
                            }}
                            title={settings.license_plan !== 'Professional' ? "Managed AI Voice Agents require the AI Professional plan." : undefined}
                        >
                            <Icons.Phone size={16} />
                            Get Voice Agent
                            {settings.license_plan !== 'Professional' && <Icons.Lock size={12} />}
                        </SButton>
                    )}
                </div>

                <div style={{ marginTop: '20px' }}>
                    {voiceAgents.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {voiceAgents.map(conn => (
                                <div key={conn.id} className="agent-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '14px', border: '1px solid var(--border)', background: '#fff' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{conn.name}</span>
                                                <span className={`agent-status-chip ${conn.status === 'ACTIVE' ? 'active' : conn.status === 'PROVISIONING' ? 'provisioning' : conn.status === 'FAILED' ? 'failed' : 'provisioning'}`} style={{
                                                    fontSize: '10px',
                                                    padding: '2px 8px',
                                                    borderRadius: '999px',
                                                    fontWeight: 700,
                                                    background: conn.status === 'ACTIVE' ? 'rgba(52, 199, 89, 0.1)' : conn.status === 'PROVISIONING' ? 'rgba(255, 149, 0, 0.1)' : 'rgba(255, 59, 48, 0.1)',
                                                    color: conn.status === 'ACTIVE' ? 'var(--success)' : conn.status === 'PROVISIONING' ? '#d69e2e' : 'var(--danger)',
                                                    border: '1px solid currentColor'
                                                }}>
                                                    {conn.status}
                                                </span>
                                                <span className={`agent-status-chip ${conn.is_active ? 'active' : 'inactive'}`} style={{
                                                    fontSize: '10px',
                                                    padding: '2px 8px',
                                                    borderRadius: '999px',
                                                    fontWeight: 700,
                                                    background: conn.is_active ? 'rgba(52, 199, 89, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                                    color: conn.is_active ? 'var(--success)' : 'var(--text-secondary)',
                                                    border: '1px solid currentColor'
                                                }}>
                                                    {conn.is_active ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                                <span>Persona: {getPersonalityLabel(conn.persona)}</span>
                                                <span>•</span>
                                                <span>Language: {LANGUAGE_LABELS[conn.language] || conn.language || 'English'}</span>
                                                <span>•</span>
                                                <span>Plan: {conn.config?.plan ? conn.config.plan.toUpperCase() : 'STARTER'} (₹{conn.config?.price || 600}/mo)</span>
                                            </div>
                                            {(() => {
                                                const phoneNumber = conn.config?.phone || conn.config?.phone_number || conn.config?.sip?.phoneNumber;
                                                const isOwnProvider = !!conn.config?.sip;

                                                if (isOwnProvider) {
                                                    if (phoneNumber) {
                                                        return (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                                                <span>VoIP Number:</span>
                                                                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                                                    {phoneNumber}
                                                                </span>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                } else {
                                                    if (!phoneNumber) {
                                                        return (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                                                <span>VoIP Number:</span>
                                                                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                                                                    Provisioning Phone Number...
                                                                </span>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }
                                            })()}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <SButton 
                                            variant="secondary" 
                                            size="small" 
                                            onClick={() => {
                                                if (settings.license_plan !== 'Professional') {
                                                    toast.info("AI Voice Agents require the AI Professional plan. Click the upgrade link in the sidebar to unlock.");
                                                    return;
                                                }
                                                onEditAgent(conn);
                                            }}
                                            style={{ opacity: settings.license_plan !== 'Professional' ? 0.6 : 1 }}
                                        >
                                            Edit {settings.license_plan !== 'Professional' && <Icons.Lock size={10} />}
                                        </SButton>
                                        <SButton 
                                            variant="secondary" 
                                            size="small" 
                                            onClick={() => {
                                                if (settings.license_plan !== 'Professional') {
                                                    toast.info("AI Voice Agents require the AI Professional plan. Click the upgrade link in the sidebar to unlock.");
                                                    return;
                                                }
                                                onOpenConfig(conn);
                                            }}
                                            style={{ opacity: settings.license_plan !== 'Professional' ? 0.6 : 1 }}
                                        >
                                            Manage Logs {settings.license_plan !== 'Professional' && <Icons.Lock size={10} />}
                                        </SButton>
                                        <SButton 
                                            variant="secondary" 
                                            size="small" 
                                            onClick={() => {
                                                if (settings.license_plan !== 'Professional') {
                                                    toast.info("AI Voice Agents require the AI Professional plan. Click the upgrade link in the sidebar to unlock.");
                                                    return;
                                                }
                                                onToggleActive(conn);
                                            }}
                                            style={{ opacity: settings.license_plan !== 'Professional' ? 0.6 : 1 }}
                                        >
                                            {conn.is_active ? 'Deactivate' : 'Activate'} {settings.license_plan !== 'Professional' && <Icons.Lock size={10} />}
                                        </SButton>
                                        <SButton variant="secondary" tone="critical" size="small" onClick={() => onDeleteAgent(conn)}>
                                            Delete
                                        </SButton>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', border: '1px dashed var(--border)', borderRadius: '12px', background: 'var(--bg-soft)' }}>
                            <Icons.Phone size={32} style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }} />
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '450px', lineHeight: 1.5 }}>
                                No AI Voice calling agents created yet. Get started by creating your first AI Voice calling agent to automate customer calling.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Test Email Modal */}
            {showTestModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000, padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#fff', padding: '24px', borderRadius: '16px',
                        width: '100%', maxWidth: '480px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', justifyBetween: 'space-between', alignItems: 'center' }}>
                            Send Test Email
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Sender</label>
                                <input type="text" className="form-control" value={testSender} disabled style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Recipient Email</label>
                                <input 
                                    type="email" 
                                    className="form-control" 
                                    placeholder="recipient@example.com" 
                                    value={testRecipient} 
                                    onChange={e => setTestRecipient(e.target.value)} 
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Subject</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    value={testSubject} 
                                    onChange={e => setTestSubject(e.target.value)} 
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Message Body</label>
                                <textarea 
                                    className="form-control" 
                                    value={testBody} 
                                    onChange={e => setTestBody(e.target.value)} 
                                    rows={4} 
                                    style={{ width: '100%', resize: 'none', fontFamily: 'inherit' }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <SButton onClick={() => setShowTestModal(false)} disabled={sendingTest}>Cancel</SButton>
                            <SButton variant="primary" onClick={handleSendTest} loading={sendingTest} disabled={sendingTest}>Send Email</SButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Test WhatsApp Modal */}
            {showWaTestModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000, padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#fff', padding: '24px', borderRadius: '16px',
                        width: '100%', maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
                            Send Test WhatsApp Message
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Recipient Phone Number</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g. 919876543210 (with country code)" 
                                    value={testWaPhone} 
                                    onChange={e => setTestWaPhone(e.target.value)} 
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <SButton onClick={() => setShowWaTestModal(false)} disabled={sendingWaTest}>Cancel</SButton>
                            <SButton variant="primary" onClick={handleSendWhatsAppTest} loading={sendingWaTest} disabled={sendingWaTest}>Send Message</SButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Gmail Automation Settings Modal */}
            {showManageModal && (
                <Modal
                    open={showManageModal}
                    onClose={() => setShowManageModal(false)}
                    heading="Gmail Automation Settings"
                    size="medium"
                >
                    <div style={{ padding: '4px 0' }}>
                        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Configure automated actions for your connected Gmail service. These settings apply globally when an active Gmail connection is available.
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Toggle 1 - Invoice Created */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-light, #f0f0f0)' }}>
                                <div style={{ flex: 1, paddingRight: '16px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Auto-send Invoice on Creation</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Automatically email the invoice to the customer when a new sale is created.</div>
                                </div>
                                <div 
                                    className={`toggle-switch ${settings.auto_email_invoice_created === 'true' ? 'active' : ''}`}
                                    onClick={() => handleToggleSetting('auto_email_invoice_created', settings.auto_email_invoice_created !== 'true')}
                                    style={{ flexShrink: 0 }}
                                >
                                    <div className={`toggle-track ${settings.auto_email_invoice_created === 'true' ? 'on' : ''}`} />
                                </div>
                            </div>

                            {/* Toggle 2 - Invoice Edited */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-light, #f0f0f0)' }}>
                                <div style={{ flex: 1, paddingRight: '16px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Auto-send Invoice on Edit</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Automatically email the updated invoice when a sale is modified.</div>
                                </div>
                                <div 
                                    className={`toggle-switch ${settings.auto_email_invoice_edited === 'true' ? 'active' : ''}`}
                                    onClick={() => handleToggleSetting('auto_email_invoice_edited', settings.auto_email_invoice_edited !== 'true')}
                                    style={{ flexShrink: 0 }}
                                >
                                    <div className={`toggle-track ${settings.auto_email_invoice_edited === 'true' ? 'on' : ''}`} />
                                </div>
                            </div>

                            {/* Toggle 3 - Order Confirmation */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-light, #f0f0f0)' }}>
                                <div style={{ flex: 1, paddingRight: '16px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Order Confirmation Auto-Send</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Automatically email a receipt confirmation to the customer upon checkout.</div>
                                </div>
                                <div 
                                    className={`toggle-switch ${settings.auto_email_order_confirmation === 'true' ? 'active' : ''}`}
                                    onClick={() => handleToggleSetting('auto_email_order_confirmation', settings.auto_email_order_confirmation !== 'true')}
                                    style={{ flexShrink: 0 }}
                                >
                                    <div className={`toggle-track ${settings.auto_email_order_confirmation === 'true' ? 'on' : ''}`} />
                                </div>
                            </div>

                            {/* Toggle 4 - Payment Completed */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-light, #f0f0f0)' }}>
                                <div style={{ flex: 1, paddingRight: '16px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Payment Received Auto-Send</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Automatically email the paid invoice receipt when payment status is completed.</div>
                                </div>
                                <div 
                                    className={`toggle-switch ${settings.auto_email_payment_received === 'true' ? 'active' : ''}`}
                                    onClick={() => handleToggleSetting('auto_email_payment_received', settings.auto_email_payment_received !== 'true')}
                                    style={{ flexShrink: 0 }}
                                >
                                    <div className={`toggle-track ${settings.auto_email_payment_received === 'true' ? 'on' : ''}`} />
                                </div>
                            </div>

                             {/* Toggle 5 - Due Payment Reminder */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light, #f0f0f0)', opacity: settings.license_plan === 'Free' ? 0.6 : 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ flex: 1, paddingRight: '16px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            Due Payment Reminder
                                            {settings.license_plan === 'Free' && <Icons.Lock size={12} style={{ color: '#94a3b8' }} />}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Automatically email outstanding due balance alerts to customers with unpaid bills.</div>
                                    </div>
                                    <div 
                                        className={`toggle-switch ${settings.auto_email_due_reminder === 'true' && settings.license_plan !== 'Free' ? 'active' : ''}`}
                                        onClick={() => {
                                            if (settings.license_plan === 'Free') {
                                                toast.info("Due Payment Reminders require the Business PRO plan. Click the upgrade link in the sidebar to unlock.");
                                                return;
                                            }
                                            handleToggleSetting('auto_email_due_reminder', settings.auto_email_due_reminder !== 'true');
                                        }}
                                        style={{ flexShrink: 0, cursor: settings.license_plan === 'Free' ? 'not-allowed' : 'pointer' }}
                                        title={settings.license_plan === 'Free' ? "Due Payment Reminders require the Business PRO plan." : undefined}
                                    >
                                        <div className={`toggle-track ${settings.auto_email_due_reminder === 'true' && settings.license_plan !== 'Free' ? 'on' : ''}`} />
                                    </div>
                                </div>
                                {settings.auto_email_due_reminder === 'true' && settings.license_plan !== 'Free' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Send reminder after:</span>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            value={settings.auto_email_due_reminder_days || 7} 
                                            onChange={e => handleNumberSettingChange('auto_email_due_reminder_days', parseInt(e.target.value) || 1)}
                                            style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '13px' }}
                                        />
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>days of invoice date</span>
                                    </div>
                                )}
                            </div>

                            {/* Toggle 6 - Voice Integration */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: settings.license_plan !== 'Professional' ? 0.6 : 1 }}>
                                <div style={{ flex: 1, paddingRight: '16px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Voice Agent Integration
                                        {settings.license_plan !== 'Professional' && <Icons.Lock size={12} style={{ color: '#94a3b8' }} />}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Scan call logs for requests like "send me that invoice" and auto-email details to registered customers.</div>
                                </div>
                                <div 
                                    className={`toggle-switch ${settings.auto_email_voice_request === 'true' && settings.license_plan === 'Professional' ? 'active' : ''}`}
                                    onClick={() => {
                                        if (settings.license_plan !== 'Professional') {
                                            toast.info("Voice Agent Integration requires the AI Professional plan. Click the upgrade link in the sidebar to unlock.");
                                            return;
                                        }
                                        handleToggleSetting('auto_email_voice_request', settings.auto_email_voice_request !== 'true');
                                    }}
                                    style={{ flexShrink: 0, cursor: settings.license_plan !== 'Professional' ? 'not-allowed' : 'pointer' }}
                                    title={settings.license_plan !== 'Professional' ? "Voice Agent Integration requires the AI Professional plan." : undefined}
                                >
                                    <div className={`toggle-track ${settings.auto_email_voice_request === 'true' && settings.license_plan === 'Professional' ? 'on' : ''}`} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <SButton variant="primary" onClick={() => setShowManageModal(false)}>Close</SButton>
                        </div>
                    </div>
                </Modal>
            )}

            {/* WhatsApp Automation Settings Modal */}
            {showWaManageModal && (
                <Modal
                    open={showWaManageModal}
                    onClose={() => setShowWaManageModal(false)}
                    heading="WhatsApp Automation Settings"
                    size="medium"
                >
                    <div style={{ padding: '4px 0' }}>
                        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Configure automated actions for your connected WhatsApp service. These settings apply globally when an active WhatsApp connection is available.
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Toggle 1 - Invoice Created */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-light, #f0f0f0)' }}>
                                <div style={{ flex: 1, paddingRight: '16px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Auto-send Invoice PDF on Creation</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Automatically WhatsApp the invoice PDF to the customer when a new sale is created.</div>
                                </div>
                                <div 
                                    className={`toggle-switch ${settings.auto_whatsapp_invoice_created === 'true' ? 'active' : ''}`}
                                    onClick={() => handleToggleSetting('auto_whatsapp_invoice_created', settings.auto_whatsapp_invoice_created !== 'true')}
                                    style={{ flexShrink: 0 }}
                                >
                                    <div className={`toggle-track ${settings.auto_whatsapp_invoice_created === 'true' ? 'on' : ''}`} />
                                </div>
                            </div>

                            {/* Toggle 2 - Invoice Edited */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-light, #f0f0f0)' }}>
                                <div style={{ flex: 1, paddingRight: '16px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Auto-send Invoice PDF on Edit</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Automatically WhatsApp the updated invoice PDF when a sale is modified.</div>
                                </div>
                                <div 
                                    className={`toggle-switch ${settings.auto_whatsapp_invoice_edited === 'true' ? 'active' : ''}`}
                                    onClick={() => handleToggleSetting('auto_whatsapp_invoice_edited', settings.auto_whatsapp_invoice_edited !== 'true')}
                                    style={{ flexShrink: 0 }}
                                >
                                    <div className={`toggle-track ${settings.auto_whatsapp_invoice_edited === 'true' ? 'on' : ''}`} />
                                </div>
                            </div>

                            {/* Toggle 3 - Order Confirmation */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-light, #f0f0f0)' }}>
                                <div style={{ flex: 1, paddingRight: '16px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Order Confirmation Auto-Send</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Automatically WhatsApp a confirmation message to the customer upon checkout.</div>
                                </div>
                                <div 
                                    className={`toggle-switch ${settings.auto_whatsapp_order_confirmation === 'true' ? 'active' : ''}`}
                                    onClick={() => handleToggleSetting('auto_whatsapp_order_confirmation', settings.auto_whatsapp_order_confirmation !== 'true')}
                                    style={{ flexShrink: 0 }}
                                >
                                    <div className={`toggle-track ${settings.auto_whatsapp_order_confirmation === 'true' ? 'on' : ''}`} />
                                </div>
                            </div>

                            {/* Toggle 4 - Payment Completed */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-light, #f0f0f0)' }}>
                                <div style={{ flex: 1, paddingRight: '16px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Payment Received Auto-Send</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Automatically WhatsApp the paid invoice PDF receipt when payment is fully completed.</div>
                                </div>
                                <div 
                                    className={`toggle-switch ${settings.auto_whatsapp_payment_received === 'true' ? 'active' : ''}`}
                                    onClick={() => handleToggleSetting('auto_whatsapp_payment_received', settings.auto_whatsapp_payment_received !== 'true')}
                                    style={{ flexShrink: 0 }}
                                >
                                    <div className={`toggle-track ${settings.auto_whatsapp_payment_received === 'true' ? 'on' : ''}`} />
                                </div>
                            </div>

                            {/* Toggle 5 - Due Payment Reminder */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light, #f0f0f0)', opacity: settings.license_plan === 'Free' ? 0.6 : 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ flex: 1, paddingRight: '16px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            Due Payment Reminder
                                            {settings.license_plan === 'Free' && <Icons.Lock size={12} style={{ color: '#94a3b8' }} />}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Automatically WhatsApp outstanding due alerts with invoice PDFs to customers with unpaid bills.</div>
                                    </div>
                                    <div 
                                        className={`toggle-switch ${settings.auto_whatsapp_due_reminder === 'true' && settings.license_plan !== 'Free' ? 'active' : ''}`}
                                        onClick={() => {
                                            if (settings.license_plan === 'Free') {
                                                toast.info("Due Payment Reminders require the Business PRO plan. Click the upgrade link in the sidebar to unlock.");
                                                return;
                                            }
                                            handleToggleSetting('auto_whatsapp_due_reminder', settings.auto_whatsapp_due_reminder !== 'true');
                                        }}
                                        style={{ flexShrink: 0, cursor: settings.license_plan === 'Free' ? 'not-allowed' : 'pointer' }}
                                        title={settings.license_plan === 'Free' ? "Due Payment Reminders require the Business PRO plan." : undefined}
                                    >
                                        <div className={`toggle-track ${settings.auto_whatsapp_due_reminder === 'true' && settings.license_plan !== 'Free' ? 'on' : ''}`} />
                                    </div>
                                </div>
                                {settings.auto_whatsapp_due_reminder === 'true' && settings.license_plan !== 'Free' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Send reminder after:</span>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            value={settings.auto_whatsapp_due_reminder_days || 7} 
                                            onChange={e => handleNumberSettingChange('auto_whatsapp_due_reminder_days', parseInt(e.target.value) || 1)}
                                            style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '13px' }}
                                        />
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>days of invoice date</span>
                                    </div>
                                )}
                            </div>

                            {/* Toggle 6 - Voice Integration */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: settings.license_plan !== 'Professional' ? 0.6 : 1 }}>
                                <div style={{ flex: 1, paddingRight: '16px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Voice Agent Integration
                                        {settings.license_plan !== 'Professional' && <Icons.Lock size={12} style={{ color: '#94a3b8' }} />}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Scan call logs for requests like "send me that invoice" and auto-WhatsApp PDF details to registered customers.</div>
                                </div>
                                <div 
                                    className={`toggle-switch ${settings.auto_whatsapp_voice_request === 'true' && settings.license_plan === 'Professional' ? 'active' : ''}`}
                                    onClick={() => {
                                        if (settings.license_plan !== 'Professional') {
                                            toast.info("Voice Agent Integration requires the AI Professional plan. Click the upgrade link in the sidebar to unlock.");
                                            return;
                                        }
                                        handleToggleSetting('auto_whatsapp_voice_request', settings.auto_whatsapp_voice_request !== 'true');
                                    }}
                                    style={{ flexShrink: 0, cursor: settings.license_plan !== 'Professional' ? 'not-allowed' : 'pointer' }}
                                    title={settings.license_plan !== 'Professional' ? "Voice Agent Integration requires the AI Professional plan." : undefined}
                                >
                                    <div className={`toggle-track ${settings.auto_whatsapp_voice_request === 'true' && settings.license_plan === 'Professional' ? 'on' : ''}`} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <SButton variant="primary" onClick={() => setShowWaManageModal(false)}>Close</SButton>
                        </div>
                    </div>
                </Modal>
            )}

            {/* WhatsApp Connection Type Choice Modal (QEIWA vs OBIWA) */}
            {showWaChoiceModal && (
                <Modal
                    open={showWaChoiceModal}
                    heading="Connect WhatsApp Service"
                    title="Connect WhatsApp Service"
                    onClose={() => setShowWaChoiceModal(false)}
                    size="medium"
                >
                    <div style={{ padding: '4px 0' }}>
                        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            Select how you would like to connect WhatsApp Business Automation to Quantro ERP:
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* QEIWA Option */}
                            <div style={{
                                border: '2px solid #25D366',
                                borderRadius: '14px',
                                padding: '20px',
                                background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.06) 0%, rgba(255,255,255,1) 100%)',
                                position: 'relative'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: '#128C7E',
                                        background: 'rgba(37, 211, 102, 0.18)',
                                        padding: '3px 10px',
                                        borderRadius: '999px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        Instant Setup (Shared)
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        +91 90332 81960
                                    </span>
                                </div>

                                <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    QEIWA — Quantro ERP Identity WhatsApp Automation
                                </h4>
                                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    Connect instantly using Quantro's official verified WhatsApp Business line. Send invoices, PDFs, and automated customer notifications right away without needing your own Meta developer account.
                                </p>

                                <SButton
                                    variant="primary"
                                    onClick={handleConnectQEIWA}
                                    loading={connectingQEIWA}
                                    style={{
                                        width: '100%',
                                        background: '#25D366',
                                        borderColor: '#25D366',
                                        color: '#fff',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-whatsapp" viewBox="0 0 16 16">
                                        <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                                    </svg>
                                    Connect with QEIWA
                                </SButton>
                            </div>

                            {/* OBIWA Option */}
                            <div style={{
                                border: '1px solid var(--border)',
                                borderRadius: '14px',
                                padding: '20px',
                                background: 'var(--bg-soft)',
                                position: 'relative'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: '#0284c7',
                                        background: 'rgba(2, 132, 199, 0.12)',
                                        padding: '3px 10px',
                                        borderRadius: '999px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        Custom Branding
                                    </span>
                                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-tertiary)' }}>
                                        Meta Embedded Portal
                                    </span>
                                </div>

                                <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    OBIWA — Own Business Identity WhatsApp Automation
                                </h4>
                                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    Connect your own Meta WhatsApp Business Account via Meta Embedded Signup using your company's custom phone number, display name, and brand identity.
                                </p>

                                <SButton
                                    variant="secondary"
                                    onClick={() => {
                                        setShowWaChoiceModal(false);
                                        handleConnectWhatsApp();
                                    }}
                                    style={{
                                        width: '100%',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Icons.ShieldCheck size={16} />
                                    Connect with OBIWA (Meta Portal)
                                </SButton>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
