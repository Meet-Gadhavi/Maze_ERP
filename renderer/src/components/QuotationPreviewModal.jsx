import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { formatCurrency } from '../utils';
import Modal from './Modal';
import SButton from './SButton';
import { toast } from 'sonner';
import './InvoicePreviewModal.css';

export default function QuotationPreviewModal({ quotation, onClose, onConvert }) {
    const [settings, setSettings] = useState(null);
    const contentRef = useRef(null);
    const [downloading, setDownloading] = useState(false);

    // Share Modal States
    const [showShareModal, setShowShareModal] = useState(false);
    const [gmailConnections, setGmailConnections] = useState([]);
    const [selectedSender, setSelectedSender] = useState('');
    const [recipientEmail, setRecipientEmail] = useState(quotation?.customer_email || '');
    const [recipientPhone, setRecipientPhone] = useState(quotation?.customer_phone || quotation?.walk_in_phone || '');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
    const [loadingConnections, setLoadingConnections] = useState(false);
    const [whatsAppConnections, setWhatsAppConnections] = useState([]);

    useEffect(() => {
        setRecipientEmail(quotation?.customer_email || '');
        setRecipientPhone(quotation?.customer_phone || quotation?.walk_in_phone || '');
    }, [quotation]);

    useEffect(() => {
        api.getSettings().then(setSettings).catch(console.error);
    }, []);

    useEffect(() => {
        if (showShareModal) {
            setLoadingConnections(true);
            Promise.all([
                api.getGmailConnections(),
                api.getWhatsAppConnections()
            ]).then(([gConns, waConns]) => {
                const activeGConns = (gConns || []).filter(c => c.status === 'Active');
                setGmailConnections(activeGConns);
                if (activeGConns.length > 0) {
                    setSelectedSender(activeGConns[0].email);
                }
                const activeWaConns = (waConns || []).filter(c => c.status === 'Active');
                setWhatsAppConnections(activeWaConns);
            }).catch(err => {
                console.error('Failed to load connections in share modal:', err);
            }).finally(() => setLoadingConnections(false));
        }
    }, [showShareModal]);

    if (!quotation) return null;

    const quotationNumber = `QTN-${String(quotation.id).padStart(4, '0')}`;
    const dateStr = quotation.date || new Date(quotation.created_at).toLocaleDateString();

    let displayName = quotation.customer_name;
    if (!displayName) {
        if (quotation.walk_in_name && quotation.walk_in_phone) {
            displayName = `${quotation.walk_in_name} • ${quotation.walk_in_phone}`;
        } else if (quotation.walk_in_name) {
            displayName = quotation.walk_in_name;
        } else if (quotation.walk_in_phone) {
            displayName = quotation.walk_in_phone;
        } else {
            displayName = 'Walk-in Customer';
        }
    }

    const subtotal = (quotation.items || []).reduce((sum, item) => {
        const base = Number(item.price || 0) * Number(item.quantity || 0);
        return sum + base;
    }, 0);

    const dRate = Number(quotation.discount_rate || 0);
    const gRate = Number(quotation.gst_rate || 0);
    const discountAmount = subtotal * (dRate / 100);
    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const gstAmount = afterDiscount * (gRate / 100);
    const totalAmount = afterDiscount + gstAmount;

    // Use quotation-specific T&C/declaration, falling back to invoice ones
    const quotationDeclaration = settings?.quotation_declaration || settings?.declaration || '';
    const quotationTerms = settings?.quotation_terms_and_conditions || settings?.terms_and_conditions || '';

    const handleCopyLink = async () => {
        if (!quotation) return;
        try {
            const res = await api.getQuotationShareLink(quotation.id);
            if (res && res.url) {
                await navigator.clipboard.writeText(res.url);
                toast.success('Quotation link copied to clipboard!');
            } else {
                toast.error('Failed to generate quotation link.');
            }
        } catch (err) {
            console.error('Failed to copy quotation link:', err);
            toast.error(err.message || 'Failed to generate share link');
        }
    };

    const handleSendGmail = async () => {
        if (!quotation) return;
        if (!selectedSender) {
            toast.error('Please select a sender email address.');
            return;
        }
        if (!recipientEmail.trim()) {
            toast.error('Recipient email address is required.');
            return;
        }

        setSendingEmail(true);
        const loadingId = toast.loading('Sending quotation email...');
        try {
            await api.sendQuotationEmail({
                senderEmail: selectedSender,
                to: recipientEmail.trim(),
                quotationId: quotation.id,
                style: settings?.invoice_style || 'classic'
            });
            toast.success(`Quotation sent successfully to ${recipientEmail}`, { id: loadingId });
            setShowShareModal(false);
        } catch (err) {
            console.error('Failed to send quotation via Gmail:', err);
            toast.error(err.message || 'Failed to send quotation email.', { id: loadingId });
        } finally {
            setSendingEmail(false);
        }
    };

    const handleSendWhatsApp = async () => {
        if (!quotation) return;
        if (whatsAppConnections.length === 0) {
            toast.error('No active WhatsApp service connected.');
            return;
        }
        if (!recipientPhone.trim()) {
            toast.error('Recipient phone number is required.');
            return;
        }

        setSendingWhatsApp(true);
        const loadingId = toast.loading('Sending quotation PDF via WhatsApp...');
        try {
            await api.sendWhatsAppQuotation({
                to: recipientPhone.trim(),
                quotationId: quotation.id
            });
            toast.success(`Quotation sent via WhatsApp to ${recipientPhone}`, { id: loadingId });
            setShowShareModal(false);
        } catch (err) {
            console.error('Failed to send quotation via WhatsApp:', err);
            toast.error(err.message || 'Failed to send quotation via WhatsApp.', { id: loadingId });
        } finally {
            setSendingWhatsApp(false);
        }
    };

    // --- PDF Download ---
    async function handleDownloadPDF() {
        if (!contentRef.current || downloading) return;
        
        try {
            setDownloading(true);
            const el = contentRef.current;
            const origOverflow = el.style.overflow;
            const origMaxHeight = el.style.maxHeight;
            const origHeight = el.style.height;
            el.style.overflow = 'visible';
            el.style.maxHeight = 'none';
            el.style.height = 'auto';

            const canvas = await html2canvas(el, {
                useCORS: true,
                allowTaint: true,
                scale: 4,
                logging: false,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0,
                windowWidth: el.scrollWidth,
                windowHeight: el.scrollHeight
            });
            
            el.style.overflow = origOverflow;
            el.style.maxHeight = origMaxHeight;
            el.style.height = origHeight;

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
                compress: true
            });
            
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const usableWidth = pageWidth - (margin * 2);
            const imgWidth = usableWidth;
            const imgHeight = (canvas.height * usableWidth) / canvas.width;
            
            let yOffset = margin;
            const usableHeight = pageHeight - (margin * 2);
            
            if (imgHeight <= usableHeight) {
                pdf.addImage(imgData, 'PNG', margin, yOffset, imgWidth, imgHeight);
            } else {
                let remainingHeight = imgHeight;
                let sourceY = 0;
                const sourceWidth = canvas.width;
                const sourceHeight = canvas.height;
                
                while (remainingHeight > 0) {
                    const sliceHeight = Math.min(usableHeight, remainingHeight);
                    const sliceSourceHeight = (sliceHeight / imgHeight) * sourceHeight;
                    const sliceCanvas = document.createElement('canvas');
                    sliceCanvas.width = sourceWidth;
                    sliceCanvas.height = sliceSourceHeight;
                    const ctx = sliceCanvas.getContext('2d');
                    ctx.drawImage(canvas, 0, sourceY, sourceWidth, sliceSourceHeight, 0, 0, sourceWidth, sliceSourceHeight);
                    const sliceData = sliceCanvas.toDataURL('image/png');
                    pdf.addImage(sliceData, 'PNG', margin, margin, imgWidth, sliceHeight);
                    remainingHeight -= sliceHeight;
                    sourceY += sliceSourceHeight;
                    if (remainingHeight > 0) pdf.addPage();
                }
            }
            
            const fileName = `Quotation_${String(quotation.id).padStart(4, '0')}.pdf`;
            pdf.save(fileName);
            toast.success('PDF downloaded successfully!');
        } catch (err) {
            console.error('PDF generation error:', err);
            toast.error('Failed to generate PDF. Please try again.');
        } finally {
            setDownloading(false);
        }
    }

    // --- Construction-themed Quotation Content ---
    const accentColor = '#00a651';
    const accentLight = '#e6f7ed';

    const renderQuotationContent = () => (
        <div style={{ padding: '40px', background: '#fff', color: '#000', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            {/* Header: QUOTATION + Company Name on LEFT, Logo + Contact Info on RIGHT */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                {/* Left side: QUOTATION title + Company Name */}
                <div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.5px', textTransform: 'uppercase' }}>
                        Quotation
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: accentColor, marginTop: '4px' }}>
                        {settings?.company_name || 'Company'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.6, marginTop: '4px' }}>
                        {settings?.phone && <div>{settings.phone}</div>}
                        {settings?.email && <div>{settings.email}</div>}
                    </div>
                </div>

                {/* Right side: Logo + Contact Info */}
                <div style={{ textAlign: 'right' }}>
                    {settings?.logo_url ? (
                        <img src={settings.logo_url} alt="Logo" style={{ maxHeight: '60px', objectFit: 'contain', marginBottom: '6px' }} />
                    ) : (
                        <div style={{ width: '60px', height: '60px', background: accentColor, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', marginBottom: '6px' }}>
                            <span style={{ color: '#fff', fontSize: '24px', fontWeight: 900 }}>Q</span>
                        </div>
                    )}
                    <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>
                        {settings?.address && <div>{settings.address}</div>}
                        {settings?.phone && <div>{settings.phone}</div>}
                        {settings?.email && <div>{settings.email}</div>}
                    </div>
                </div>
            </div>

            {/* Green accent line */}
            <div style={{ height: '3px', background: accentColor, marginBottom: '20px' }}></div>

            {/* Quotation Meta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '12px', color: '#475569' }}>
                <div>
                    <div><strong>Quotation #</strong></div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{quotationNumber}</div>
                </div>
                <div>
                    <div><strong>Quotation Date</strong></div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{dateStr}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div><strong>Title</strong></div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{quotation.name}</div>
                </div>
            </div>

            {/* Customer & Details boxes */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <div style={{ flex: 1, background: accentLight, borderRadius: '8px', padding: '16px', border: `1px solid ${accentColor}22` }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: accentColor, marginBottom: '10px', letterSpacing: '0.5px' }}>Quotation To:</div>
                    <div style={{ fontSize: '12px', lineHeight: 1.8 }}>
                        <div><span style={{ color: '#64748b' }}>Client Name:</span> <strong>{displayName}</strong></div>
                        {(quotation.customer_phone || quotation.walk_in_phone) && (
                            <div><span style={{ color: '#64748b' }}>Phone:</span> <strong>{quotation.customer_phone || quotation.walk_in_phone}</strong></div>
                        )}
                        {quotation.customer_email && (
                            <div><span style={{ color: '#64748b' }}>Email:</span> <strong>{quotation.customer_email}</strong></div>
                        )}
                        {quotation.customer_address && (
                            <div><span style={{ color: '#64748b' }}>Address:</span> <strong>{quotation.customer_address}</strong></div>
                        )}
                    </div>
                </div>
                <div style={{ flex: 1, background: accentLight, borderRadius: '8px', padding: '16px', border: `1px solid ${accentColor}22` }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: accentColor, marginBottom: '10px', letterSpacing: '0.5px' }}>Quotation Details:</div>
                    <div style={{ fontSize: '12px', lineHeight: 1.8 }}>
                        <div><span style={{ color: '#64748b' }}>Title:</span> <strong>{quotation.name}</strong></div>
                        {quotation.customer_gstin && (
                            <div><span style={{ color: '#64748b' }}>GSTIN:</span> <strong>{quotation.customer_gstin}</strong></div>
                        )}
                        {settings?.gstin && (
                            <div><span style={{ color: '#64748b' }}>Our GSTIN:</span> <strong>{settings.gstin}</strong></div>
                        )}
                        <div><span style={{ color: '#64748b' }}>Status:</span> <strong style={{ color: accentColor }}>Estimated</strong></div>
                    </div>
                </div>
            </div>

            {/* Items Table with green header — improved visibility */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px', border: '1px solid #c8e6c9' }}>
                <thead>
                    <tr style={{ background: accentColor, backgroundColor: accentColor }}>
                        <th style={{ padding: '12px 14px', textAlign: 'left', background: accentColor, backgroundColor: accentColor, color: '#ffffff', WebkitTextFillColor: '#ffffff', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid rgba(255,255,255,0.3)' }}>Product / Phase</th>
                        <th style={{ padding: '12px 10px', textAlign: 'center', background: accentColor, backgroundColor: accentColor, color: '#ffffff', WebkitTextFillColor: '#ffffff', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', borderRight: '1px solid rgba(255,255,255,0.3)', width: '60px' }}>Qty</th>
                        <th style={{ padding: '12px 10px', textAlign: 'center', background: accentColor, backgroundColor: accentColor, color: '#ffffff', WebkitTextFillColor: '#ffffff', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', borderRight: '1px solid rgba(255,255,255,0.3)', width: '60px' }}>Unit</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right', background: accentColor, backgroundColor: accentColor, color: '#ffffff', WebkitTextFillColor: '#ffffff', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', borderRight: '1px solid rgba(255,255,255,0.3)', width: '100px' }}>Rate</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right', background: accentColor, backgroundColor: accentColor, color: '#ffffff', WebkitTextFillColor: '#ffffff', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', width: '110px' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {(quotation.items || []).map((item, idx) => (
                        <tr key={item.id || idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f0faf3', borderBottom: '1px solid #c8e6c9' }}>
                            <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 500, fontStyle: 'italic', borderRight: '1px solid #e8f5e9' }}>{item.product_name}</td>
                            <td style={{ padding: '11px 10px', textAlign: 'center', fontSize: '13px', fontWeight: 600, borderRight: '1px solid #e8f5e9' }}>{item.quantity}</td>
                            <td style={{ padding: '11px 10px', textAlign: 'center', fontSize: '13px', color: '#475569', borderRight: '1px solid #e8f5e9' }}>{item.unit || 'PCS'}</td>
                            <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: '13px', borderRight: '1px solid #e8f5e9' }}>{formatCurrency(item.price)}</td>
                            <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: '13px', fontWeight: 700 }}>{formatCurrency(item.total)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                {/* Terms & Declaration */}
                <div style={{ maxWidth: '50%' }}>
                    {quotationTerms && (
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                            <div style={{ fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>Terms & Conditions:</div>
                            <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5 }}>{quotationTerms}</p>
                        </div>
                    )}
                    {quotationDeclaration && (
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '12px' }}>
                            <div style={{ fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>Declaration:</div>
                            <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>{quotationDeclaration}</p>
                        </div>
                    )}
                </div>

                {/* Summary */}
                <div style={{ minWidth: '220px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', borderBottom: '1px solid #e2e8f0' }}>
                        <span style={{ color: '#475569' }}>SUBTOTAL</span>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#ef4444', borderBottom: '1px solid #e2e8f0' }}>
                            <span>Discount ({dRate}%)</span>
                            <span>-{formatCurrency(discountAmount)}</span>
                        </div>
                    )}
                    {gstAmount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', borderBottom: '1px solid #e2e8f0' }}>
                            <span style={{ color: '#475569' }}>TAX @ {gRate}%</span>
                            <span>{formatCurrency(gstAmount)}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', fontSize: '15px', fontWeight: 800, background: accentColor, color: '#fff', borderRadius: '6px', marginTop: '8px' }}>
                        <span>TOTAL</span>
                        <span>{formatCurrency(totalAmount)}</span>
                    </div>
                </div>
            </div>

            {/* Signature section — two proper boxes centered */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '40px' }}>
                <div style={{ width: '220px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '40px' }}>Client Signature</div>
                    <div style={{ borderTop: '1px solid #94a3b8' }}></div>
                </div>
                <div style={{ width: '180px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '40px' }}>Date</div>
                    <div style={{ borderTop: '1px solid #94a3b8' }}></div>
                </div>
            </div>
            
            <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #eee', paddingTop: '12px' }}>
                This is an estimated quotation. Valid for 30 days from the date of issue.
            </div>
        </div>
    );

    return (
        <>
            <Modal
                open={true}
                onClose={onClose}
                heading={`Quotation Preview — ${quotationNumber}`}
                size="large"
                padding="none"
                primaryAction={
                    <SButton 
                        variant="primary" 
                        loading={downloading}
                        onClick={handleDownloadPDF}
                    >
                        Download PDF
                    </SButton>
                }
                secondaryActions={[
                    <SButton key="share" variant="secondary" onClick={() => setShowShareModal(true)}>Share</SButton>
                ]}
            >
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: '#f9f9f9', padding: '20px 0' }}>
                    <div ref={contentRef} style={{ width: '210mm', minHeight: '297mm', margin: '0 auto', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        {renderQuotationContent()}
                    </div>
                </div>

                {/* Share Modal Popup */}
                {showShareModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', zIndex: 200000, padding: '20px'
                    }}>
                        <div style={{
                            backgroundColor: '#fff', padding: '24px', borderRadius: '16px',
                            width: '100%', maxWidth: '440px', boxSizing: 'border-box',
                            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                        }}>
                            <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Share Quotation</h3>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Copy Link Section */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                    <div>
                                        <strong style={{ display: 'block', fontSize: '13px' }}>Quotation Link</strong>
                                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Copy the quotation URL to clipboard</span>
                                    </div>
                                    <SButton variant="secondary" size="small" onClick={handleCopyLink}>Copy Link</SButton>
                                </div>

                                {/* Gmail Send Section */}
                                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <img src="./gmail-icon.png" alt="Gmail" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                        <strong style={{ fontSize: '14px' }}>Send via Gmail</strong>
                                    </div>

                                    {loadingConnections ? (
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading Gmail connections...</div>
                                    ) : gmailConnections.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Sender Account</label>
                                                <select 
                                                    className="form-control" 
                                                    value={selectedSender} 
                                                    onChange={e => setSelectedSender(e.target.value)}
                                                    style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-strong)' }}
                                                >
                                                    {gmailConnections.map(c => (
                                                        <option key={c.id} value={c.email}>{c.email}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Recipient Email</label>
                                                <input 
                                                    type="email" 
                                                    className="form-control" 
                                                    value={recipientEmail} 
                                                    onChange={e => setRecipientEmail(e.target.value)}
                                                    placeholder="Shivamaa9211@gmail.com"
                                                    style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-strong)' }}
                                                />
                                            </div>

                                            <SButton 
                                                variant="primary" 
                                                onClick={handleSendGmail} 
                                                loading={sendingEmail} 
                                                disabled={sendingEmail}
                                                style={{ width: '100%', marginTop: '4px' }}
                                            >
                                                Send Email
                                            </SButton>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                            No active Gmail connections found. 
                                            <p style={{ margin: '4px 0 0 0', fontSize: '11px' }}>
                                                Go to <strong>Automation</strong> and connect your Gmail account first to send emails directly.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* WhatsApp Send Section */}
                                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <img src="./whatsapp-icon.png" alt="WhatsApp" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                        <strong style={{ fontSize: '14px' }}>Send via WhatsApp</strong>
                                    </div>

                                    {loadingConnections ? (
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading WhatsApp connections...</div>
                                    ) : whatsAppConnections.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Recipient Phone Number</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    value={recipientPhone} 
                                                    onChange={e => setRecipientPhone(e.target.value)}
                                                    placeholder="e.g. +91 98765 43210"
                                                    style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-strong)' }}
                                                />
                                                {!recipientPhone.trim() && (
                                                    <div style={{ fontSize: '11.5px', color: '#e53e3e', marginTop: '6px', fontWeight: 600 }}>
                                                        ⚠️ No phone number saved. Please enter one to proceed.
                                                    </div>
                                                )}
                                            </div>

                                            <SButton 
                                                variant="primary" 
                                                onClick={handleSendWhatsApp} 
                                                loading={sendingWhatsApp} 
                                                disabled={sendingWhatsApp}
                                                style={{ width: '100%', marginTop: '4px', backgroundColor: '#25D366', borderColor: '#25D366', color: '#fff' }}
                                            >
                                                Send PDF via WhatsApp
                                            </SButton>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                            No active WhatsApp connections found. 
                                            <p style={{ margin: '4px 0 0 0', fontSize: '11px' }}>
                                                Go to <strong>Automation</strong> and connect your WhatsApp service first to send messages.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                                <SButton onClick={() => setShowShareModal(false)}>Close</SButton>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
