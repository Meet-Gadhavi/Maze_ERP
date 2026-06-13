import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { calculateTaxSummary, formatCurrency } from '../utils';
import Modal from './Modal';
import SButton from './SButton';
import './InvoicePreviewModal.css'; // Reuse premium invoice styles for design consistency

export default function QuotationPreviewModal({ quotation, onClose }) {
    const [settings, setSettings] = useState(null);
    const contentRef = useRef(null);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        api.getSettings().then(setSettings).catch(console.error);
    }, []);

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
            displayName = 'Global Template / Walk-in';
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

    function handlePrint() {
        if (!contentRef.current) return;

        const printContent = contentRef.current.cloneNode(true);
        printContent.classList.add('maze-print-el');
        document.body.appendChild(printContent);
        
        setTimeout(() => {
            if (window.maze?.printPage) {
                window.maze.printPage();
            } else {
                window.print();
            }
            document.body.removeChild(printContent);
        }, 50);
    }

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
        } catch (err) {
            console.error('PDF generation error:', err);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setDownloading(false);
        }
    }

    const renderQuotationContent = () => (
        <div style={{ padding: '40px', background: '#fff', color: '#000', fontFamily: 'Inter, sans-serif' }}>
            {/* Header section */}
            <div className="invoice-header">
                <div className="invoice-brand">
                    {settings?.logo_url ? (
                        <img src={settings.logo_url} alt="Brand Logo" className="invoice-logo" />
                    ) : (
                        <h1>{settings?.company_name || 'Quantro'}</h1>
                    )}
                    <div className="brand-details">
                        {settings?.company_name && settings?.logo_url && <h3>{settings.company_name}</h3>}
                        {settings?.address && <p className="address">{settings.address}</p>}
                        {(settings?.phone || settings?.email) && (
                            <p className="contact">
                                {settings.phone && <span>Phone: {settings.phone}</span>}
                                {settings.email && <span> | Email: {settings.email}</span>}
                            </p>
                        )}
                        {settings?.gstin && <p className="gstin">GSTIN: {settings.gstin}</p>}
                    </div>
                </div>
                <div className="invoice-meta">
                    <div className="inv-title" style={{ color: 'var(--accent)', letterSpacing: '2px' }}>QUOTATION</div>
                    <div className="inv-number">{quotationNumber}</div>
                    <div className="inv-date">Date: {dateStr}</div>
                </div>
            </div>

            {/* Customer information */}
            <div className="invoice-customer" style={{ marginTop: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                <div>
                    <div className="ic-label" style={{ fontWeight: 600, textTransform: 'uppercase', color: '#666', fontSize: '12px' }}>Prepared For:</div>
                    <div className="ic-name" style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>{displayName}</div>
                    {quotation.customer_email && <div style={{ fontSize: '12px', marginTop: '2px', color: '#555' }}>Email: {quotation.customer_email}</div>}
                    {quotation.customer_address && <div style={{ fontSize: '12px', marginTop: '2px', color: '#555' }}>Address: {quotation.customer_address}</div>}
                    {quotation.customer_gstin && <div style={{ fontSize: '12px', marginTop: '2px', color: '#555' }}>GSTIN: {quotation.customer_gstin}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>Quotation Title:</div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{quotation.name}</div>
                </div>
            </div>

            {/* Items table */}
            <table className="invoice-items-table" style={{ width: '100%', marginTop: '30px', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #000', textAlign: 'left' }}>
                        <th style={{ padding: '8px 0' }}>#</th>
                        <th>Product Name</th>
                        <th style={{ textAlign: 'right' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Unit</th>
                        <th style={{ textAlign: 'right' }}>Rate</th>
                        <th style={{ textAlign: 'right', paddingRight: '8px' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {(quotation.items || []).map((item, idx) => (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px 0', color: '#666' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 500 }}>{item.product_name}</td>
                            <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right' }}>{item.unit || 'PCS'}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, paddingRight: '8px' }}>{formatCurrency(item.total)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Summary details */}
            <div className="invoice-footer-layout" style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ maxWidth: '50%' }}>
                    {settings?.terms_and_conditions && (
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '10px' }}>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Terms & Conditions:</div>
                            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{settings.terms_and_conditions}</p>
                        </div>
                    )}
                </div>

                <div className="invoice-totals-box" style={{ minWidth: '250px' }}>
                    <div className="invoice-totals-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                        <div className="invoice-totals-row discount" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'red' }}>
                            <span>Discount ({dRate}%)</span>
                            <span>-{formatCurrency(discountAmount)}</span>
                        </div>
                    )}
                    {gstAmount > 0 && (
                        <div className="invoice-totals-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                            <span>GST ({gRate}%)</span>
                            <span>+{formatCurrency(gstAmount)}</span>
                        </div>
                    )}
                    <div className="invoice-totals-divider" style={{ borderTop: '1px solid #ddd', margin: '8px 0' }}></div>
                    <div className="invoice-totals-row grand-total" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 700, fontSize: '16px' }}>
                        <span>Estimated Total</span>
                        <span style={{ color: 'var(--accent)' }}>{formatCurrency(totalAmount)}</span>
                    </div>
                </div>
            </div>
            
            <div style={{ marginTop: '50px', textAlign: 'center', fontSize: '12px', color: '#888', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                This is an estimated quotation. Valid for 30 days from the date of issue.
            </div>
        </div>
    );

    return (
        <Modal onClose={onClose} title={`Preview Quotation: ${quotationNumber}`} width="850px">
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '15px', paddingRight: '10px' }}>
                <SButton onClick={handlePrint}>Print / Save as PDF</SButton>
                <SButton onClick={handleDownloadPDF} disabled={downloading}>
                    {downloading ? 'Downloading...' : 'Direct PDF Download'}
                </SButton>
                <SButton variant="secondary" onClick={onClose}>Close</SButton>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: '#f9f9f9', padding: '20px 0' }}>
                <div ref={contentRef} style={{ width: '210mm', minHeight: '297mm', margin: '0 auto', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {renderQuotationContent()}
                </div>
            </div>
        </Modal>
    );
}
