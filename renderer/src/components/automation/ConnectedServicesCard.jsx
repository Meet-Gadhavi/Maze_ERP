import React, { useState, useEffect } from 'react';
import SButton from '../SButton';
import { Icons } from '../Icons';
import api from '../../api';
import { toast } from 'sonner';

export default function ConnectedServicesCard() {
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showTestModal, setShowTestModal] = useState(false);
    const [testSender, setTestSender] = useState('');
    const [testRecipient, setTestRecipient] = useState('');
    const [testSubject, setTestSubject] = useState('Maze ERP Test Email');
    const [testBody, setTestBody] = useState('Hello! This is a test email sent from Maze ERP via Gmail OAuth.');
    const [sendingTest, setSendingTest] = useState(false);

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

    useEffect(() => {
        fetchConnections();

        // Listen for new connections completed from Deep Links
        const handleGmailConnected = (event) => {
            if (event.data?.type === 'gmail-connected') {
                fetchConnections();
            }
        };
        window.addEventListener('message', handleGmailConnected);
        return () => window.removeEventListener('message', handleGmailConnected);
    }, []);

    const handleConnect = () => {
        // Open Google OAuth in the system browser (not in the Electron window).
        // This is required so that when Google redirects to maze-erp://google-auth-callback,
        // the OS can properly route the custom protocol deep link back to the Electron app.
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
        } catch (err) {
            console.error('Test email failed:', err);
            toast.error(err.message || 'Failed to send test email.', { id: loadingId });
        } finally {
            setSendingTest(false);
        }
    };

    return (
        <div className="agents-section" style={{ marginTop: '24px', marginBottom: '24px' }}>
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
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Gmail Service
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Send invoices, order confirmations, feedback, and marketing campaigns using your own business Gmail account.
                    </p>
                </div>
                {connections.length === 0 && !loading && (
                    <SButton variant="primary" onClick={handleConnect} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <Icons.Mail size={16} />
                        Connect Gmail
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
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Icons.Calendar size={12} />
                                                    Connected on {new Date(conn.connectedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '250px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>Daily Limit:</span>
                                                    <span style={{ color: conn.emailsSentToday >= conn.emailsLimit ? '#e53e3e' : conn.emailsSentToday > 800 ? '#dd6b20' : '#38a169' }}>
                                                        {conn.emailsSentToday} / {conn.emailsLimit} Sent
                                                    </span>
                                                </div>
                                                <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${Math.min(100, (conn.emailsSentToday / conn.emailsLimit) * 100)}%`,
                                                        height: '100%',
                                                        backgroundColor: conn.emailsSentToday >= conn.emailsLimit ? '#e53e3e' : conn.emailsSentToday > 800 ? '#dd6b20' : '#38a169',
                                                        transition: 'width 0.3s ease',
                                                        borderRadius: '3px'
                                                    }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
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
                                    autoFocus
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
        </div>
    );
}
