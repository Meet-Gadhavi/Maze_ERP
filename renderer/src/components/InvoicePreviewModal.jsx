import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { amountToWords, calculateTaxSummary, formatCurrency } from '../utils';
import Modal from './Modal';
import SButton from './SButton';
import './InvoicePreviewModal.css';

export default function InvoicePreviewModal({ invoice, onClose }) {
    const [settings, setSettings] = useState(null);
    const contentRef = useRef(null);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        api.getSettings().then(setSettings).catch(console.error);
    }, []);

    if (!invoice) return null;

    function handlePrint() {
        if (!contentRef.current) return;
        const printContent = contentRef.current.cloneNode(true);
        printContent.classList.add('maze-print-el');
        document.body.appendChild(printContent);
        
        setTimeout(() => {
            window.print();
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
                scale: 2,
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
            
            const fileName = `Invoice_${String(invoice.id).padStart(4, '0')}.pdf`;
            pdf.save(fileName);
        } catch (err) {
            console.error('PDF generation error:', err);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setDownloading(false);
        }
    }

    const invoiceNumber = `INV-${String(invoice.id).padStart(4, '0')}`;
    const totalQty = (invoice.items || []).reduce((s, i) => s + i.quantity, 0);
    const originalTotal = Number(invoice.total || 0);
    const returnedAmount = Number(invoice.total_returned_amount || 0);
    const paidAmount = Number(invoice.paid_amount || 0);
    const hasPerItem = (invoice.items || []).some(i => (i.item_gst_rate > 0 || i.item_discount_rate > 0));

    const subtotal = (invoice.items || []).reduce((s, i) => {
        const base = Number(i.price || 0) * Number(i.quantity || 0);
        if (hasPerItem) {
            const d = Number(i.item_discount_rate || 0);
            const g = Number(i.item_gst_rate || 0);
            const afterD = base - (base * (d / 100));
            const afterG = afterD + (afterD * (g / 100));
            return s + afterG;
        }
        return s + base;
    }, 0);

    const dRate = Number(invoice.discount_rate || 0);
    const gRate = Number(invoice.gst_rate || 0);
    const discountAmount = hasPerItem ? 0 : (subtotal * (dRate / 100));
    const afterDiscount = subtotal - discountAmount;
    const gstAmount = hasPerItem ? 0 : (afterDiscount * (gRate / 100));
    const calculatedTotal = afterDiscount + gstAmount;
    const totalToUse = originalTotal > 0 ? originalTotal : calculatedTotal;
    const effectiveTotal = Math.max(0, totalToUse - returnedAmount);
    const effectiveDue = Math.max(0, effectiveTotal - paidAmount);

    let displayName = invoice.customer_name;
    if (!displayName) {
        if (invoice.walk_in_name && invoice.walk_in_phone) {
            displayName = `${invoice.walk_in_name} • ${invoice.walk_in_phone}`;
        } else if (invoice.walk_in_name) {
            displayName = invoice.walk_in_name;
        } else if (invoice.walk_in_phone) {
            displayName = invoice.walk_in_phone;
        } else {
            displayName = 'Walk-in';
        }
    }

    const taxSummary = calculateTaxSummary(invoice.items);
    const uniqueMethods = invoice.payments && invoice.payments.length > 0 
        ? [...new Set(invoice.payments.map(p => p.method))]
        : [invoice.payment_method || 'Unpaid'];
    const paymentMethodDisplay = uniqueMethods.join(' + ');

    const renderClassic = () => (
        <>
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
                                {settings.phone && <span>Ph: {settings.phone}</span>}
                                {settings.email && <span> | E: {settings.email}</span>}
                            </p>
                        )}
                        {settings?.gstin && <p className="gstin">GSTIN: {settings.gstin}</p>}
                    </div>
                </div>
                <div className="invoice-meta">
                    <div className="inv-title">TAX INVOICE</div>
                    <div className="inv-number">{invoiceNumber}</div>
                    <div className="inv-date">{invoice.date || '—'}</div>
                </div>
            </div>

            <div className="invoice-customer">
                <div>
                    <div className="ic-label">Bill To</div>
                    <div className="ic-name">{displayName}</div>
                    {invoice.customer_gstin && <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>GSTIN: {invoice.customer_gstin}</div>}
                </div>
                <div className="invoice-status-section" style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <span className={`payment-status-badge badge-${(invoice.fulfillment_status || 'CONFIRMED').toLowerCase().replace(/_/g, '-')}`}>
                        <span className="badge-dot"></span> 
                        {invoice.fulfillment_status === 'PENDING_PRODUCT' ? 'Pending Product' :
                            invoice.fulfillment_status === 'CONFIRMED' ? 'Confirmed' :
                                invoice.fulfillment_status === 'COMPLETED' ? 'Completed' : invoice.fulfillment_status}
                    </span>
                    {invoice.customer_id && (
                        <span className={`secondary-status-badge badge-${(invoice.financial_status || 'PAID').toLowerCase()}`}>
                            {invoice.financial_status === 'PAID' ? <span className="badge-dot"></span> : ''}
                            {invoice.financial_status === 'PAID' ? 'Paid' :
                                invoice.financial_status === 'PARTIAL' ? '⚠ Partial' :
                                    invoice.financial_status === 'UNPAID' ? '✖ Unpaid' : invoice.financial_status}
                        </span>
                    )}
                </div>
            </div>

            <table className="invoice-items-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Product Name (Variant)</th>
                        {settings?.enable_sku === 'true' && <th>SKU</th>}
                        <th className="col-qty">Qty</th>
                        <th className="col-qty">Unit</th>
                        <th className="col-price">Price</th>
                        {settings?.enable_gst_per_item === 'true' && <th className="col-qty">GST</th>}
                        {settings?.enable_discount_per_item === 'true' && <th className="col-qty">Disc</th>}
                        <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {(invoice.items || []).map((item, idx) => (
                        <tr key={item.id || idx}>
                            <td style={{ color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 400 }}>
                                {item.product_name}
                                {item.variant_name ? ` (${item.variant_name})` : ''}
                                {item.is_free ? <span style={{ marginLeft: 8, fontSize: '0.7em', color: 'var(--success)', fontWeight: 400, background: 'rgba(34, 197, 94, 0.1)', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle' }}>🟢 FREE</span> : ''}
                                {item.pending_qty > 0 && <span style={{ marginLeft: 8, fontSize: '0.8em', color: 'var(--warning)', fontWeight: 400 }}>(Pending: {item.pending_qty})</span>}
                            </td>
                            {settings?.enable_sku === 'true' && (
                                <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                    {item.product_code || '—'}
                                </td>
                            )}
                            <td className="item-qty">{item.qty_delivered || item.quantity}</td>
                            <td className="item-qty" style={{ fontWeight: 400 }}>{item.unit || 'PCS'}</td>
                            <td className="item-price">₹{Number(item.price).toLocaleString('en-IN')}</td>
                            {settings?.enable_gst_per_item === 'true' && (
                                <td className="item-qty" style={{ color: 'var(--text-secondary)' }}>
                                    {item.item_gst_rate ? `${item.item_gst_rate}%` : '—'}
                                </td>
                            )}
                            {settings?.enable_discount_per_item === 'true' && (
                                <td className="item-qty" style={{ color: 'var(--text-secondary)' }}>
                                    {item.item_discount_rate ? `${item.item_discount_rate}%` : '—'}
                                </td>
                            )}
                            <td style={{ textAlign: 'right', fontWeight: 400 }}>₹{Number(item.total).toLocaleString('en-IN')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="invoice-footer-layout">
                <div className="invoice-payment-breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid var(--border-light)', paddingBottom: '2px' }}>Payment History</div>
                    {invoice.payments && invoice.payments.length > 0 ? (
                        invoice.payments.map((p, i) => (
                            <div key={i} className="breakdown-item" style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                                <span className="label" style={{ fontWeight: 400 }}>{p.method} {p.transaction_id ? `(${p.transaction_id})` : ''}</span>
                                <span className="value">₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                        ))
                    ) : (
                        <div className="breakdown-item" style={{ fontSize: '11px', fontStyle: 'italic' }}>No payments recorded</div>
                    )}
                    
                    {Number(invoice.p_credit_amount || 0) > 0 && (
                        <div className="breakdown-item" style={{ marginTop: '4px', borderTop: '1px dashed var(--border)', paddingTop: '4px' }}>
                            <span className="label">P-Credit Used</span>
                            <span className="value" style={{ color: 'var(--accent)' }}>₹{Number(invoice.p_credit_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    <div className="breakdown-item" style={{ borderTop: '1px solid var(--border)', paddingTop: '4px', marginTop: '4px' }}>
                        <span className="label" style={{ fontWeight: 600 }}>Total Paid</span>
                        <span className="value text-success" style={{ fontWeight: 600 }}>₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="breakdown-item">
                        <span className="label" style={{ fontWeight: 600 }}>Outstanding Due</span>
                        <span className={`value ${effectiveDue > 0 ? 'text-danger' : 'text-success'}`} style={{ fontWeight: 600 }}>
                            ₹{effectiveDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                <div className="invoice-totals-box">
                    <div className="invoice-totals-row">
                        <span>Subtotal</span>
                        <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {discountAmount > 0 && (
                        <div className="invoice-totals-row discount">
                            <span>Discount ({dRate.toFixed(1)}%)</span>
                            <span>-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {gstAmount > 0 && (
                        <div className="invoice-totals-row">
                            <span>GST ({gRate.toFixed(1)}%)</span>
                            <span>+₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    <div className="invoice-totals-divider"></div>
                    <div className="invoice-totals-row grand-total">
                        <span>{returnedAmount > 0 ? 'Effective Total' : 'Grand Total'}</span>
                        <span className="total-amount">₹{(effectiveTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>
        </>
    );

    const renderFormal = () => (
        <div className="formal-invoice-container">
            <div className="formal-header">
                <div className="company-logo-section">
                    {settings?.logo_url && <img src={settings.logo_url} alt="Logo" />}
                </div>
                <div className="company-details-section">
                    <h1>{settings?.company_name?.toUpperCase()}</h1>
                    <p>{settings?.address}</p>
                    <p>Phone: {settings?.phone} | Email: {settings?.email}</p>
                    <p>GSTIN: <strong>{settings?.gstin}</strong> | State: <strong>{settings?.default_place_of_supply || '—'}</strong></p>
                </div>
            </div>

            <div className="formal-info-grid">
                <div className="info-box bill-to">
                    <div className="box-label">Bill To:</div>
                    <div className="box-content">
                        <strong>{displayName?.toUpperCase()}</strong>
                        {invoice.customer_address && <p>{invoice.customer_address}</p>}
                        {invoice.customer_phone && <p>Contact No: {invoice.customer_phone}</p>}
                        {invoice.customer_gstin && <p>GSTIN Number: {invoice.customer_gstin}</p>}
                        <p>State: {invoice.customer_state || settings?.default_place_of_supply || '—'}</p>
                    </div>
                </div>
                <div className="info-box invoice-details">
                    <div className="box-label">Invoice Details:</div>
                    <div className="box-content">
                        <div className="detail-row"><span>No:</span> <strong>{invoiceNumber}</strong></div>
                        <div className="detail-row"><span>Date:</span> <strong>{invoice.date}</strong></div>
                        <div className="detail-row"><span>Place of Supply:</span> <strong>{invoice.customer_state || settings?.default_place_of_supply || '—'}</strong></div>
                    </div>
                </div>
            </div>

            <table className="formal-items-table">
                <colgroup>
                    <col style={{ width: '40px' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: '85px' }} />
                    <col style={{ width: '60px' }} />
                    <col style={{ width: '50px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '110px' }} />
                </colgroup>
                <thead>
                    <tr>
                        <th className="col-idx">#</th>
                        <th className="col-name">Item name</th>
                        <th className="col-hsn">HSN/ SAC</th>
                        <th className="col-qty">QUE.</th>
                        <th className="col-unit">Unit</th>
                        <th className="col-price">Price/ Unit (₹)</th>
                        <th className="col-gst">GST(₹)</th>
                        <th className="col-amount">Amount(₹)</th>
                    </tr>
                </thead>
                <tbody>
                    {(invoice.items || []).map((item, idx) => (
                        <tr key={item.id || idx}>
                            <td className="col-idx">{idx + 1}</td>
                            <td className="col-name text-left">{item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}</td>
                            <td className="col-hsn">{item.hsn_sac || item.product_hsn || '—'}</td>
                            <td className="col-qty">{item.quantity}</td>
                            <td className="col-unit">{item.unit || 'Pcs'}</td>
                            <td className="col-price text-right">{Number(item.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="col-gst text-right">
                                {item.item_gst_rate > 0 ? (
                                    <>
                                        {((Number(item.price) * Number(item.quantity) * (1 - (item.item_discount_rate || 0) / 100)) * (item.item_gst_rate / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        <br /><span className="gst-small">({item.item_gst_rate}%)</span>
                                    </>
                                ) : '—'}
                            </td>
                            <td className="col-amount text-right">{Number(item.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    ))}
                    <tr className="total-row-main">
                        <td colSpan="3" className="text-right total-label">Total</td>
                        <td className="col-qty">{totalQty}</td>
                        <td className="col-unit"></td>
                        <td className="col-price"></td>
                        <td className="col-gst text-right">{taxSummary.reduce((s, t) => s + t.igst_amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="col-amount text-right">{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                </tbody>
            </table>

            <div className="formal-bottom-section">
                <div className="left-column">
                    <div className="tax-summary-box">
                        <div className="box-label">Tax Summary:</div>
                        <table className="tax-table">
                            <thead>
                                <tr>
                                    <th>HSN/ SAC</th>
                                    <th>Taxable amount (₹)</th>
                                    <th colSpan="2">IGST</th>
                                    <th>Total Tax(₹)</th>
                                </tr>
                                <tr className="sub-head">
                                    <th></th>
                                    <th></th>
                                    <th>Rate (%)</th>
                                    <th>Amt (₹)</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {taxSummary.map((tax, i) => (
                                    <tr key={i}>
                                        <td>{tax.hsn}</td>
                                        <td>{tax.taxable_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        <td>{tax.igst_rate}</td>
                                        <td>{tax.igst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        <td>{tax.total_tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                                <tr className="total-tax-row">
                                    <td>TOTAL</td>
                                    <td>{taxSummary.reduce((s, t) => s + t.taxable_amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td></td>
                                    <td>{taxSummary.reduce((s, t) => s + t.igst_amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td>{taxSummary.reduce((s, t) => s + t.total_tax, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="payment-mode-box">
                        <div className="box-label">Payment Mode:</div>
                        <div className="box-content">{paymentMethodDisplay}</div>
                    </div>

                    <div className="payment-mode-box" style={{ borderTop: 'none', marginTop: '-1px' }}>
                        <div className="box-label">Payment Breakdown:</div>
                        <div className="box-content" style={{ fontSize: '10px' }}>
                            {invoice.payments && invoice.payments.length > 0 ? (
                                invoice.payments.map((p, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                        <span>{p.method} {p.transaction_id ? `(${p.transaction_id})` : ''}</span>
                                        <span>₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                ))
                            ) : (
                                <div>{invoice.payment_method || 'Unpaid'}</div>
                            )}
                        </div>
                    </div>

                    <div className="bank-details-box-formal" style={{ display: 'flex', gap: '15px', borderTop: '1px solid #334155' }}>
                        <div style={{ flex: 1 }}>
                            <div className="box-label">Bank Details:</div>
                            <div className="box-content">
                                <p>Name: <strong>{settings?.bank_name}</strong></p>
                                <p>Account No.: <strong>{settings?.account_number}</strong></p>
                                <p>IFSC code: <strong>{settings?.ifsc_code}</strong></p>
                                <p>Account Holder's Name: <strong>{settings?.account_holder_name}</strong></p>
                                {settings?.upi_id && <p>UPI ID: <strong>{settings?.upi_id}</strong></p>}
                            </div>
                        </div>
                        {settings?.payment_qr_url && (
                            <div className="bank-qr-formal" style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={settings.payment_qr_url} alt="QR" style={{ width: '70px', height: '70px', objectFit: 'contain', border: '1px solid #e2e8f0' }} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="right-column">
                    <div className="summary-totals-box">
                        <div className="summary-row"><span>Sub Total</span><span>:</span><span>₹ {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div className="summary-row"><span>Shipping</span><span>:</span><span>₹ {Number(invoice.shipping_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div className="summary-row total"><span>Total</span><span>:</span><span>₹ {effectiveTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div className="summary-row words">
                            <span>Invoice Amount In Words :</span>
                            <p>{amountToWords(effectiveTotal)}</p>
                        </div>
                        <div className="summary-row"><span>Received</span><span>:</span><span>₹ {paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div className="summary-row"><span>Balance</span><span>:</span><span>₹ {effectiveDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                    </div>
                </div>
            </div>

            <div className="formal-terms-box">
                <div className="box-label">Terms And Conditions:</div>
                <div className="box-content">
                    <p>Thanks for doing business with us!</p>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, fontSize: '10px' }}>{settings?.terms_and_conditions}</pre>
                </div>
            </div>

            <div className="formal-footer-full">
                <div className="signatory-box-centered">
                    <div className="box-label">For {settings?.company_name?.toUpperCase()}:</div>
                    <div className="sign-area-centered">
                        <div className="sign-placeholder-boxed"></div>
                        <p>Authorized Signatory</p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderPOS = () => (
        <div className="pos-invoice-container">
            <div className="pos-header">
                {settings?.logo_url && <img src={settings.logo_url} alt="Logo" className="pos-logo" />}
                <h2 className="pos-company-name">{settings?.company_name?.toUpperCase() || 'MAZE ERP'}</h2>
                {settings?.address && <p className="pos-address">{settings.address}</p>}
                <p className="pos-contact">Ph: {settings?.phone}</p>
                {settings?.gstin && <p className="pos-gstin">GSTIN: {settings.gstin}</p>}
            </div>

            <div className="pos-divider-dashed"></div>

            <div className="pos-meta">
                <div className="row"><span>Bill No: {invoiceNumber}</span></div>
                <div className="row"><span>Date: {invoice.date}</span></div>
                <div className="row"><span>Customer: {displayName}</span></div>
            </div>

            <div className="pos-divider-solid"></div>

            <table className="pos-items-table">
                <thead>
                    <tr>
                        <th className="text-left">ITEM</th>
                        <th className="text-center">QTY</th>
                        <th className="text-right">PRICE</th>
                        <th className="text-right">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    {(invoice.items || []).map((item, idx) => (
                        <tr key={item.id || idx}>
                            <td className="text-left" colSpan="4">
                                <div style={{ marginBottom: '2px' }}>{item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#444' }}>
                                    <span>{item.quantity} {item.unit || 'PCS'} x {Number(item.price).toLocaleString('en-IN')}</span>
                                    <span>₹{Number(item.total).toLocaleString('en-IN')}</span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="pos-divider-solid"></div>

            <div className="pos-totals">
                <div className="total-row">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {discountAmount > 0 && (
                    <div className="total-row">
                        <span>Discount ({dRate.toFixed(1)}%)</span>
                        <span>-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                )}
                {gstAmount > 0 && (
                    <div className="total-row">
                        <span>GST ({gRate.toFixed(1)}%)</span>
                        <span>+₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                )}
                <div className="pos-divider-dashed"></div>
                <div className="grand-total-row">
                    <span>NET AMOUNT</span>
                    <span className="amount">₹{effectiveTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pos-divider-dashed"></div>
                
                <div className="payment-info">
                    <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>PAYMENT BREAKDOWN</div>
                    {invoice.payments && invoice.payments.length > 0 ? (
                        invoice.payments.map((p, i) => (
                            <div key={i} className="row">
                                <span>{p.method}:</span> 
                                <span>₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                        ))
                    ) : (
                        <div className="row"><span>{invoice.payment_method || 'CASH'}:</span> <span>₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                    )}
                    {Number(invoice.p_credit_amount || 0) > 0 && (
                        <div className="row"><span>P-CREDIT:</span> <span>₹{Number(invoice.p_credit_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                    )}
                    <div className="pos-divider-dashed" style={{ margin: '4px 0' }}></div>
                    <div className="row" style={{ fontWeight: 'bold' }}><span>TOTAL PAID:</span> <span>₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                    {effectiveDue > 0 && <div className="row" style={{ fontWeight: 'bold', color: '#000' }}><span>BALANCE DUE:</span> <span>₹{effectiveDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>}
                </div>
            </div>

            {taxSummary.length > 0 && (
                <>
                    <div className="pos-divider-dashed"></div>
                    <div className="pos-tax-summary">
                        <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>TAX SUMMARY</div>
                        <table style={{ width: '100%', fontSize: '9px' }}>
                            <thead>
                                <tr>
                                    <th className="text-left">RATE</th>
                                    <th className="text-right">TAXABLE</th>
                                    <th className="text-right">TAX</th>
                                </tr>
                            </thead>
                            <tbody>
                                {taxSummary.map((t, idx) => (
                                    <tr key={idx}>
                                        <td className="text-left">{t.igst_rate}%</td>
                                        <td className="text-right">₹{t.taxable_amount.toFixed(2)}</td>
                                        <td className="text-right">₹{t.total_tax.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <div className="pos-divider-solid"></div>
            
            <div className="pos-footer-note">
                {settings?.declaration && <p className="pos-declaration">{settings.declaration}</p>}
                <p className="thank-you">THANK YOU! VISIT AGAIN</p>
                
                {settings?.payment_qr_url && (
                    <div className="pos-qr-container" style={{ flexDirection: 'column', alignItems: 'center' }}>
                        <img src={settings.payment_qr_url} alt="Payment QR" />
                        <div style={{ textAlign: 'center', marginTop: '6px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 'bold' }}>SCAN TO PAY</div>
                            {settings.upi_id && <div style={{ fontSize: '9px', marginTop: '2px' }}>({settings.upi_id})</div>}
                        </div>
                    </div>
                )}
                
                <div className="pos-divider-dashed"></div>
                <p className="powered-by">POWERED BY MAZE ERP</p>
                <div className="pos-cut-safety"></div>
            </div>
        </div>
    );

    const renderMinimalist = () => (
        <div className="minimalist-invoice-wrapper" style={{ width: '100%', boxSizing: 'border-box' }}>
            <style>{`
                .invoice-preview-content.minimalist-mode {
                    background: #ffffff !important;
                }
                .minimalist-invoice-wrapper {
                    background: #ffffff;
                    width: 100%;
                    box-sizing: border-box;
                    padding: 20px 10px 50px 10px;
                }
                .minimalist-invoice-card {
                    font-family: Arial, sans-serif;
                    color: #1e293b;
                    font-size: 13px;
                    background: #ffffff;
                    max-width: 700px;
                    margin: 10px auto;
                    padding: 30px;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    position: relative;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
                    box-sizing: border-box;
                    text-align: left;
                }
                .minimalist-invoice-card .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
                .minimalist-invoice-card .store-name { font-size: 22px; font-weight: 700; color: #0f172a; }
                .minimalist-invoice-card .invoice-title { font-size: 28px; font-weight: 800; color: #0f172a; text-align: right; }
                .minimalist-invoice-card .invoice-meta { text-align: right; color: #64748b; font-size: 12px; margin-top: 4px; }
                .minimalist-invoice-card .section { margin-bottom: 24px; }
                .minimalist-invoice-card .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 6px; }
                .minimalist-invoice-card .two-col { display: flex; gap: 40px; }
                .minimalist-invoice-card .two-col > div { flex: 1; }
                .minimalist-invoice-card table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                .minimalist-invoice-card thead th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }
                .minimalist-invoice-card thead th:last-child { text-align: right; }
                .minimalist-invoice-card tbody td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
                .minimalist-invoice-card tbody td:last-child { text-align: right; font-weight: 500; }
                .minimalist-invoice-card .totals { margin-left: auto; width: 260px; }
                .minimalist-invoice-card .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; color: #475569; }
                .minimalist-invoice-card .totals-row.total { font-weight: 700; font-size: 15px; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 10px; margin-top: 4px; }
                .minimalist-invoice-card .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
                .minimalist-invoice-card .badge-paid { background: #dcfce7; color: #166534; }
                .minimalist-invoice-card .badge-unpaid { background: #fee2e2; color: #991b1b; }
                .minimalist-invoice-card .badge-pending { background: #fef9c3; color: #854d0e; }
                .minimalist-invoice-card .badge-partial { background: #dbeafe; color: #1d4ed8; }
                .minimalist-invoice-card .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
                .minimalist-invoice-card p { margin: 2px 0; }
                .minimalist-invoice-card .payment-row { background: #f0fdf4; }

                @media print {
                    .minimalist-invoice-wrapper {
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .minimalist-invoice-card {
                        border: 1px solid #cbd5e1 !important;
                        border-radius: 8px !important;
                        padding: 20px !important;
                        margin: 0 auto !important;
                        box-shadow: none !important;
                        max-width: 100% !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* Ensure font weights are preserved under minimalist scope */
                    .minimalist-invoice-card strong, 
                    .minimalist-invoice-card .store-name,
                    .minimalist-invoice-card .invoice-title,
                    .minimalist-invoice-card .totals-row.total,
                    .minimalist-invoice-card thead th {
                        font-weight: 700 !important;
                    }
                }
            `}</style>

            <div className="minimalist-invoice-card">
                <div className="header">
                    <div>
                        <div className="store-name">{settings?.company_name || 'Mazeweb'}</div>
                        {settings?.phone && <p style={{ fontSize: '11px', color: '#64748b' }}>{settings.phone}</p>}
                        {settings?.email && <p style={{ fontSize: '11px', color: '#64748b' }}>{settings.email}</p>}
                        {settings?.gstin && <p style={{ fontSize: '11px', color: '#64748b' }}>GSTIN: {settings.gstin}</p>}
                    </div>
                    <div>
                        <div className="invoice-title">INVOICE</div>
                        <div className="invoice-meta">{invoiceNumber}</div>
                        <div className="invoice-meta">{invoice.date || '—'}</div>
                    </div>
                </div>

                <div className="two-col section">
                    <div>
                        <div className="section-title">Billed To</div>
                        <p><strong>{displayName}</strong></p>
                        {invoice.customer_email && <p>{invoice.customer_email}</p>}
                        {invoice.customer_phone && <p>{invoice.customer_phone}</p>}
                        {invoice.customer_gstin && <p>GSTIN: {invoice.customer_gstin}</p>}
                    </div>
                    <div>
                        <div className="section-title">Shipping Address</div>
                        <p>{invoice.customer_address || '—'}</p>
                    </div>
                    <div>
                        <div className="section-title">Payment Status</div>
                        <span className={`badge ${
                            invoice.financial_status === 'PAID' ? 'badge-paid' :
                            invoice.financial_status === 'PARTIAL' ? 'badge-partial' :
                            invoice.financial_status === 'UNPAID' ? 'badge-unpaid' : 'badge-pending'
                        }`}>
                            {invoice.financial_status || 'UNPAID'}
                        </span>
                        <p style={{ marginTop: '6px', color: '#64748b', fontSize: '12px' }}>Method: {paymentMethodDisplay || 'Pay Later'}</p>
                    </div>
                </div>

                <div className="section">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Product</th>
                                <th>Unit Price</th>
                                <th>Qty</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(invoice.items || []).map((item, idx) => (
                                <tr key={item.id || idx}>
                                    <td>{idx + 1}</td>
                                    <td>
                                        {item.product_name}
                                        {item.variant_name ? ` (${item.variant_name})` : ''}
                                        {item.is_free ? <span style={{ marginLeft: 8, fontSize: '0.8em', color: '#166534', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>FREE</span> : ''}
                                    </td>
                                    <td>₹{Number(item.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td>{item.quantity} {item.unit || 'PCS'}</td>
                                    <td>₹{Number(item.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="totals">
                        <div className="totals-row">
                            <span>Subtotal</span>
                            <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {discountAmount > 0 && (
                            <div className="totals-row">
                                <span>Discount ({dRate.toFixed(1)}%)</span>
                                <span>-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        {gstAmount > 0 && (
                            <div className="totals-row">
                                <span>GST ({gRate.toFixed(1)}%)</span>
                                <span>+₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        
                        <div className="totals-row total">
                            <span>Grand Total</span>
                            <span>₹{effectiveTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {effectiveDue > 0 && (
                            <div className="totals-row" style={{ color: '#991b1b', fontWeight: 600 }}>
                                <span>Balance Due</span>
                                <span>₹{effectiveDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="footer">
                    Thank you for shopping with {settings?.company_name || 'Mazeweb'}!<br/>
                    This is a computer-generated invoice.
                </div>
            </div>
        </div>
    );

    return (
        <Modal
            open={true}
            onClose={onClose}
            heading="Invoice Preview"
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
                <SButton key="print" onClick={handlePrint}>Print / PDF</SButton>
            ]}
        >
            <div className={`invoice-preview-content ${settings?.invoice_style === 'formal' ? 'formal-mode' : settings?.invoice_style === 'pos' ? 'pos-mode' : settings?.invoice_style === 'minimalist' ? 'minimalist-mode' : ''}`} ref={contentRef} style={{ padding: '20px' }}>
                {settings?.invoice_style === 'formal' ? renderFormal() : settings?.invoice_style === 'pos' ? renderPOS() : settings?.invoice_style === 'minimalist' ? renderMinimalist() : renderClassic()}
                
                {(settings?.invoice_style !== 'formal' && settings?.invoice_style !== 'pos' && settings?.invoice_style !== 'minimalist') && (
                    <div className="invoice-footer-summary-container">
                        {(settings?.bank_name || settings?.upi_id || settings?.payment_qr_url) && (
                            <div className="bank-details-box" style={{
                                marginTop: '20px',
                                background: '#FFF4E6',
                                border: '1px solid #FFD8A8',
                                borderRadius: '8px',
                                padding: '16px',
                                display: 'flex',
                                gap: '20px',
                                alignItems: 'center'
                            }}>
                                {settings.payment_qr_url && (
                                    <div className="bank-qr" style={{ flexShrink: 0 }}>
                                        <img
                                            src={settings.payment_qr_url}
                                            alt="Payment QR"
                                            style={{ width: '100px', height: '100px', borderRadius: '4px', border: '1px solid #dee2e6', objectFit: 'contain', background: '#fff' }}
                                        />
                                    </div>
                                )}
                                <div className="bank-info" style={{ flex: 1 }}>
                                    <h4 style={{ margin: '0 0 8px 0', color: '#D9480F', fontSize: '14px', borderBottom: '1px solid #FFD8A8', paddingBottom: '4px' }}>BANK DETAILS</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px', fontSize: '12px' }}>
                                        {settings.bank_name && (
                                            <>
                                                <span style={{ color: '#868e96', fontWeight: 400 }}>Bank Name:</span>
                                                <span style={{ fontWeight: 400 }}>{settings.bank_name}</span>
                                            </>
                                        )}
                                        {settings.account_number && (
                                            <>
                                                <span style={{ color: '#868e96', fontWeight: 400 }}>A/C Number:</span>
                                                <span style={{ fontWeight: 400 }}>{settings.account_number}</span>
                                            </>
                                        )}
                                        {settings.ifsc_code && (
                                            <>
                                                <span style={{ color: '#868e96', fontWeight: 400 }}>IFSC Code:</span>
                                                <span style={{ fontWeight: 400 }}>{settings.ifsc_code}</span>
                                            </>
                                        )}
                                        {settings.account_holder_name && (
                                            <>
                                                <span style={{ color: '#868e96', fontWeight: 400 }}>A/C Holder:</span>
                                                <span style={{ fontWeight: 400 }}>{settings.account_holder_name}</span>
                                            </>
                                        )}
                                        {settings.upi_id && (
                                            <>
                                                <span style={{ color: '#868e96', fontWeight: 400 }}>UPI ID:</span>
                                                <span style={{ color: '#D9480F', fontWeight: 400 }}>{settings.upi_id}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="invoice-footer-note">
                            <div className="footer-columns">
                                {settings?.declaration && (
                                    <div className="footer-section declaration">
                                        <h4>Declaration</h4>
                                        <p>{settings.declaration}</p>
                                    </div>
                                )}
                                {settings?.terms_and_conditions && (
                                    <div className="footer-section terms">
                                        <h4>Terms & Conditions</h4>
                                        <pre>{settings.terms_and_conditions}</pre>
                                    </div>
                                )}
                            </div>
                            <div className="footer-divider" style={{ marginTop: '20px' }}></div>
                            <p className="thank-you">Thank You for Your Business!</p>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}

