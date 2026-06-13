import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { amountToWords, calculateTaxSummary, formatCurrency } from '../utils';
import Modal from './Modal';
import SButton from './SButton';
import { toast } from 'sonner';
import './InvoicePreviewModal.css';

const translations = {
    en: {
        taxInvoice: 'TAX INVOICE',
        invoice: 'INVOICE',
        billNo: 'Bill No',
        invoiceNo: 'Invoice No',
        date: 'Date',
        billTo: 'Bill To',
        customer: 'Customer',
        phone: 'Phone',
        email: 'Email',
        gstin: 'GSTIN',
        state: 'State',
        paymentStatus: 'Payment Status',
        fulfillmentStatus: 'Fulfillment Status',
        item: 'Item',
        productName: 'Product Name',
        sku: 'SKU',
        qty: 'Qty',
        unit: 'Unit',
        price: 'Price',
        gst: 'GST',
        disc: 'Disc',
        total: 'Total',
        subtotal: 'Subtotal',
        discount: 'Discount',
        grandTotal: 'Grand Total',
        effectiveTotal: 'Effective Total',
        received: 'Received',
        balance: 'Balance',
        amountInWords: 'Amount In Words',
        paymentHistory: 'Payment History',
        totalPaid: 'Total Paid',
        outstandingDue: 'Outstanding Due',
        bankDetails: 'Bank Details',
        bankName: 'Bank Name',
        accountNo: 'Account No',
        ifscCode: 'IFSC Code',
        accountHolder: 'Account Holder',
        upiId: 'UPI ID',
        termsAndConditions: 'Terms & Conditions',
        authorizedSignatory: 'Authorized Signatory',
        thankYou: 'THANK YOU! VISIT AGAIN',
        scanToPay: 'SCAN TO PAY',
        taxSummary: 'Tax Summary',
        taxableAmount: 'Taxable Amount',
        totalTax: 'Total Tax',
        hsnSac: 'HSN/ SAC',
        rate: 'Rate',
        amt: 'Amt',
        pCreditUsed: 'P-Credit Used',
        netAmount: 'NET AMOUNT',
        shipped: 'Shipped',
        shipping: 'Shipping'
    },
    hi: {
        taxInvoice: 'कर बीजक (TAX INVOICE)',
        invoice: 'बीजक (INVOICE)',
        billNo: 'विधेयक संख्या',
        invoiceNo: 'बीजक संख्या',
        date: 'दिनांक',
        billTo: 'सेवा में',
        customer: 'ग्राहक',
        phone: 'फ़ोन',
        email: 'ईमेल',
        gstin: 'जीएसटी संख्या',
        state: 'राज्य',
        paymentStatus: 'भुगतान की स्थिति',
        fulfillmentStatus: 'पूर्ति की स्थिति',
        item: 'वस्तु',
        productName: 'उत्पाद का नाम',
        sku: 'एसकेयू (SKU)',
        qty: 'मात्रा',
        unit: 'इकाई',
        price: 'दर',
        gst: 'जीएसटी',
        disc: 'छूट',
        total: 'कुल',
        subtotal: 'उप-कुल',
        discount: 'छूट',
        grandTotal: 'कुल योग',
        effectiveTotal: 'प्रभावी योग',
        received: 'प्राप्त राशि',
        balance: 'शेष राशि',
        amountInWords: 'शब्दों में राशि',
        paymentHistory: 'भुगतान इतिहास',
        totalPaid: 'कुल भुगतान',
        outstandingDue: 'कुल बकाया',
        bankDetails: 'बैंक विवरण',
        bankName: 'बैंक का नाम',
        accountNo: 'खाता संख्या',
        ifscCode: 'आईएफएससी कोड',
        accountHolder: 'खाता धारक',
        upiId: 'यूपीआई आईडी',
        termsAndConditions: 'नियम और शर्तें',
        authorizedSignatory: 'अधिकृत हस्ताक्षरकर्ता',
        thankYou: 'धन्यवाद! दोबारा पधारें',
        scanToPay: 'भुगतान के लिए स्कैन करें',
        taxSummary: 'कर विवरण',
        taxableAmount: 'कर योग्य राशि',
        totalTax: 'कुल कर',
        hsnSac: 'एचएसएन / एसएससी',
        rate: 'दर',
        amt: 'राशि',
        pCreditUsed: 'पी-क्रेडिट का उपयोग',
        netAmount: 'कुल देय राशि',
        shipped: 'भेजा गया',
        shipping: 'शिपिंग प्रभार'
    },
    gu: {
        taxInvoice: 'ટેક્સ ઇન્વોઇસ (TAX INVOICE)',
        invoice: 'ઇન્વોઇસ (INVOICE)',
        billNo: 'બિલ નંબર',
        invoiceNo: 'ઇન્વોઇસ નંબર',
        date: 'તારીખ',
        billTo: 'ગ્રાહક વિગત',
        customer: 'ગ્રાહક',
        phone: 'ફોન',
        email: 'ઇમેઇલ',
        gstin: 'જીએસટી નંબર',
        state: 'રાજ્ય',
        paymentStatus: 'ચુકવણી સ્થિતિ',
        fulfillmentStatus: 'વિતરણ સ્થિતિ',
        item: 'વસ્તુ',
        productName: 'વસ્તુનું નામ',
        sku: 'એસકેયુ (SKU)',
        qty: 'જથ્થો',
        unit: 'એકમ',
        price: 'ભાવ',
        gst: 'જીએસટી',
        disc: 'ડિસ્કાઉન્ટ',
        total: 'કુલ',
        subtotal: 'પેટા સરવાળો',
        discount: 'વળતર',
        grandTotal: 'કુલ સરવાળો',
        effectiveTotal: 'અસરકારક સરવાળો',
        received: 'મળેલ રકમ',
        balance: 'બાકી રકમ',
        amountInWords: 'શબ્દોમાં રકમ',
        paymentHistory: 'ચુકવણી ઇતિહાસ',
        totalPaid: 'કુલ ચુકવણી',
        outstandingDue: 'કુલ બાકી રકમ',
        bankDetails: 'બેંક વિગતો',
        bankName: 'બેંક નામ',
        accountNo: 'ખાતા નંબર',
        ifscCode: 'આઈએફએસસી કોડ',
        accountHolder: 'ખાતા ધારક',
        upiId: 'યુપીઆઈ આઈડી',
        termsAndConditions: 'નિયમો અને શરતો',
        authorizedSignatory: 'અધિકૃત સહી',
        thankYou: 'આભાર! ફરી પધારજો',
        scanToPay: 'ચુકવણી માટે સ્કેન કરો',
        taxSummary: 'ટેક્સ વિગત',
        taxableAmount: 'કરપાત્ર રકમ',
        totalTax: 'કુલ ટેક્સ',
        hsnSac: 'એચએસએન / એસએસી',
        rate: 'દર',
        amt: 'રકમ',
        pCreditUsed: 'પી-ક્રેડિટ નો વપરાશ',
        netAmount: 'કુલ ચૂકવવાપાત્ર રકમ',
        shipped: 'મોકલેલ',
        shipping: 'શિપિંગ ચાર્જ'
    }
};

export default function InvoicePreviewModal({ invoice, onClose, autoOpenShare = false }) {
    const [settings, setSettings] = useState(null);
    const contentRef = useRef(null);
    const [downloading, setDownloading] = useState(false);

    // Share Modal States
    const [showShareModal, setShowShareModal] = useState(autoOpenShare);
    const [gmailConnections, setGmailConnections] = useState([]);
    const [selectedSender, setSelectedSender] = useState('');
    const [recipientEmail, setRecipientEmail] = useState(invoice?.customer_email || '');
    const [recipientPhone, setRecipientPhone] = useState(invoice?.customer_phone || invoice?.walk_in_phone || '');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
    const [loadingConnections, setLoadingConnections] = useState(false);
    const [whatsAppConnections, setWhatsAppConnections] = useState([]);

    useEffect(() => {
        setRecipientEmail(invoice?.customer_email || '');
        setRecipientPhone(invoice?.customer_phone || invoice?.walk_in_phone || '');
    }, [invoice]);

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

    const handleCopyLink = async () => {
        if (!invoice) return;
        const loadingId = toast.loading('Generating hosted invoice link...');
        try {
            const res = await api.getInvoiceShareLink(invoice.id);
            if (res && res.url) {
                await navigator.clipboard.writeText(res.url);
                toast.success('Hosted invoice link copied to clipboard!', { id: loadingId });
            } else {
                throw new Error('No URL returned from server');
            }
        } catch (err) {
            console.error('Failed to copy hosted invoice link:', err);
            toast.error(err.message || 'Failed to generate link.', { id: loadingId });
        }
    };

    const handleSendGmail = async () => {
        if (!invoice) return;
        if (!selectedSender) {
            toast.error('Please select a sender email address.');
            return;
        }
        if (!recipientEmail.trim()) {
            toast.error('Recipient email address is required.');
            return;
        }

        setSendingEmail(true);
        const loadingId = toast.loading('Sending invoice email...');
        try {
            await api.sendInvoiceEmail({
                senderEmail: selectedSender,
                to: recipientEmail.trim(),
                invoiceId: invoice.id,
                style: settings?.invoice_style || 'classic'
            });
            toast.success(`Invoice sent successfully to ${recipientEmail}`, { id: loadingId });
            setShowShareModal(false);
        } catch (err) {
            console.error('Failed to send invoice via Gmail:', err);
            toast.error(err.message || 'Failed to send invoice email.', { id: loadingId });
        } finally {
            setSendingEmail(false);
        }
    };

    const handleSendWhatsApp = async () => {
        if (!invoice) return;
        if (whatsAppConnections.length === 0) {
            toast.error('No active WhatsApp service connected.');
            return;
        }
        if (!recipientPhone.trim()) {
            toast.error('Recipient phone number is required.');
            return;
        }

        setSendingWhatsApp(true);
        const loadingId = toast.loading('Sending invoice PDF via WhatsApp...');
        try {
            // Proactively save phone number to customer if they didn't have one before
            if (invoice.customer_id && (!invoice.customer_phone || invoice.customer_phone.trim() === '')) {
                try {
                    await api.updateCustomer(invoice.customer_id, {
                        name: invoice.customer_name,
                        phone: recipientPhone.trim()
                    });
                } catch (saveErr) {
                    console.warn('Failed to auto-save customer phone:', saveErr);
                }
            }

            await api.sendWhatsAppInvoice({
                to: recipientPhone.trim(),
                invoiceId: invoice.id
            });
            toast.success(`Invoice PDF sent successfully via WhatsApp to ${recipientPhone}`, { id: loadingId });
            setShowShareModal(false);
        } catch (err) {
            console.error('Failed to send invoice via WhatsApp:', err);
            toast.error(err.message || 'Failed to send invoice via WhatsApp.', { id: loadingId });
        } finally {
            setSendingWhatsApp(false);
        }
    };

    if (!invoice) return null;

    function handlePrint() {
        if (!contentRef.current) return;

        if (settings?.enable_cash_drawer === 'true' && window.maze?.triggerCashDrawer) {
            window.maze.triggerCashDrawer();
        }

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
    const lang = settings?.invoice_language || localStorage.getItem('maze_language') || 'en';
    const t = translations[lang] || translations.en;

    const totalQty = (invoice.items || []).reduce((s, i) => {
        const chargeQty = (settings?.include_pending_price === 'false')
            ? (i.qty_delivered !== undefined && i.qty_delivered !== null ? i.qty_delivered : 0)
            : i.quantity;
        return s + chargeQty;
    }, 0);
    const originalTotal = Number(invoice.total || 0);
    const returnedAmount = Number(invoice.total_returned_amount || 0);
    const paidAmount = Number(invoice.paid_amount || 0);
    const hasPerItem = (invoice.items || []).some(i => (i.item_gst_rate > 0 || i.item_discount_rate > 0));
    const isFullyReturned = invoice.return_type === 'full' ||
        (invoice.financial_status || '').toUpperCase() === 'RETURNED';

    // Build a map of returned qty per invoice_item_id and per product_id from invoice.returns
    const returnedByItemId = {};
    const returnedByProductId = {};
    (invoice.returns || []).forEach(r => {
        if (r.invoice_item_id) {
            returnedByItemId[r.invoice_item_id] = (returnedByItemId[r.invoice_item_id] || 0) + (r.return_qty || 0);
        }
        returnedByProductId[r.product_id] = (returnedByProductId[r.product_id] || 0) + (r.return_qty || 0);
    });
    // Helper: get returned qty for an item
    const getItemReturnedQty = (item) => {
        if (item.id && returnedByItemId[item.id]) return returnedByItemId[item.id];
        return returnedByProductId[item.product_id] || 0;
    };

    const subtotal = (invoice.items || []).reduce((s, i) => {
        const chargeQty = (settings?.include_pending_price === 'false')
            ? (i.qty_delivered !== undefined && i.qty_delivered !== null ? i.qty_delivered : 0)
            : i.quantity;
        const base = Number(i.price || 0) * Number(chargeQty || 0);
        if (hasPerItem) {
            const d = Number(i.item_discount_rate || 0);
            const g = Number(i.item_gst_rate || 0);
            const afterD = base - (base * (d / 100));
            const afterG = afterD + (afterD * (g / 100));
            return s + afterG;
        }
        return s + base;
    }, 0);

    const getItemTotal = (item) => {
        const displayQty = (settings?.include_pending_price === 'false')
            ? (item.qty_delivered !== undefined && item.qty_delivered !== null ? item.qty_delivered : 0)
            : item.quantity;
        const base = Number(item.price || 0) * Number(displayQty || 0);
        if (hasPerItem) {
            const d = Number(item.item_discount_rate || 0);
            const g = Number(item.item_gst_rate || 0);
            const afterD = base - (base * (d / 100));
            const afterG = afterD + (afterD * (g / 100));
            return afterG;
        }
        return base;
    };

    const dRate = Number(invoice.discount_rate || 0);
    const gRate = Number(invoice.gst_rate || 0);
    const discountAmount = hasPerItem ? 0 : (subtotal * (dRate / 100));
    const couponDiscountAmount = Number(invoice.coupon_discount_amount || 0);
    const afterDiscount = Math.max(0, subtotal - discountAmount - couponDiscountAmount);
    const gstAmount = hasPerItem ? 0 : (afterDiscount * (gRate / 100));
    const calculatedTotal = afterDiscount + gstAmount;
    const totalToUse = (invoice.total !== undefined && invoice.total !== null) ? Number(invoice.total) : calculatedTotal;
    const effectiveTotal = Math.max(0, totalToUse - returnedAmount);
    const effectiveDue = Math.max(0, effectiveTotal - paidAmount);
    const finStatus = (invoice.financial_status || invoice.payment_status || '').toUpperCase();
    const isCreditInvoice = finStatus === 'UNPAID' || finStatus === 'PARTIAL' || finStatus === 'PARTIALLY RETURNED';

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

    const taxSummary = calculateTaxSummary(invoice.items, settings?.include_pending_price);
    const uniqueMethods = invoice.payments && invoice.payments.length > 0 
        ? [...new Set(invoice.payments.map(p => p.method))]
        : [invoice.payment_method || 'Unpaid'];
    const paymentMethodDisplay = uniqueMethods.join(' + ');

    const billedCategories = [...new Set((invoice.items || []).map(item => item.category).filter(Boolean))].join(', ') || 'General';

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
                                {settings.phone && <span>{t.phone}: {settings.phone}</span>}
                                {settings.email && <span> | {t.email}: {settings.email}</span>}
                            </p>
                        )}
                        {settings?.gstin && <p className="gstin">{t.gstin}: {settings.gstin}</p>}
                    </div>
                </div>
                <div className="invoice-meta">
                    <div className="inv-title">{isCreditInvoice ? 'CREDIT INVOICE' : t.taxInvoice}</div>
                    <div className="inv-number">{invoiceNumber}</div>
                    <div className="inv-date">{invoice.date || '—'}</div>
                </div>
            </div>

            <div className="invoice-customer">
                <div>
                    <div className="ic-label">{t.billTo}</div>
                    <div className="ic-name">{displayName}</div>
                    {invoice.customer_gstin && <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{t.gstin}: {invoice.customer_gstin}</div>}
                    {settings?.show_category_in_invoice !== 'false' && (
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Product Cat: {billedCategories}
                        </div>
                    )}
                </div>
                <div className="invoice-status-section" style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <span className={`payment-status-badge badge-${(invoice.fulfillment_status || 'CONFIRMED').toLowerCase().replace(/_/g, '-')}`}>
                        <span className="badge-dot"></span> 
                        {invoice.fulfillment_status === 'PENDING_PRODUCT' ? 'Pending Product' :
                            invoice.fulfillment_status === 'CONFIRMED' ? 'Confirmed' :
                                invoice.fulfillment_status === 'COMPLETED' ? 'Completed' : invoice.fulfillment_status}
                    </span>
                    {invoice.customer_id && (
                        <span className={`secondary-status-badge badge-${(invoice.financial_status || 'PAID').toLowerCase().replace(/ /g, '-')}`}>
                            {(invoice.financial_status || '').toUpperCase() === 'PAID' ? <span className="badge-dot"></span> : ''}
                            {(invoice.financial_status || '').toUpperCase() === 'PAID' ? 'Paid' :
                                (invoice.financial_status || '').toUpperCase() === 'PARTIAL' ? '⚠ Partial' :
                                    (invoice.financial_status || '').toUpperCase() === 'UNPAID' ? '✖ Unpaid' :
                                        (invoice.financial_status || '').toUpperCase() === 'RETURNED' ? 'Returned' : invoice.financial_status}
                        </span>
                    )}
                </div>
            </div>

            <table className="invoice-items-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>{t.productName}</th>
                        {settings?.enable_sku === 'true' && <th>{t.sku}</th>}
                        <th className="col-qty">{t.qty}</th>
                        <th className="col-qty">{t.unit}</th>
                        <th className="col-price">{t.price}</th>
                        {settings?.enable_gst_per_item === 'true' && <th className="col-qty">{t.gst}</th>}
                        {settings?.enable_discount_per_item === 'true' && <th className="col-qty">{t.disc}</th>}
                        <th style={{ textAlign: 'right' }}>{t.total}</th>
                    </tr>
                </thead>
                <tbody>
                    {(invoice.items || []).map((item, idx) => {
                        const displayQty = (settings?.include_pending_price === 'false')
                            ? (item.qty_delivered !== undefined && item.qty_delivered !== null ? item.qty_delivered : 0)
                            : item.quantity;
                        return (
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
                                <td className="item-qty">
                                    {(() => {
                                        const retQty = getItemReturnedQty(item);
                                        const netQty = displayQty - retQty;
                                        return retQty > 0
                                            ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{netQty}</span>
                                            : displayQty;
                                    })()}
                                </td>
                                <td className="item-qty" style={{ fontWeight: 400 }}>{item.unit || 'PCS'}</td>
                                <td className="item-price">{formatCurrency(item.price)}</td>
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
                                <td style={{ textAlign: 'right', fontWeight: 400 }}>{formatCurrency(getItemTotal(item))}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div className="invoice-footer-layout">
                <div className="invoice-payment-breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid var(--border-light)', paddingBottom: '2px' }}>{t.paymentHistory}</div>
                    {invoice.payments && invoice.payments.length > 0 ? (
                        invoice.payments.map((p, i) => (
                            <div key={i} className="breakdown-item" style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                                <span className="label" style={{ fontWeight: 400 }}>{p.method} {p.transaction_id ? `(${p.transaction_id})` : ''}</span>
                                <span className="value">{formatCurrency(p.amount)}</span>
                            </div>
                        ))
                    ) : (
                        <div className="breakdown-item" style={{ fontSize: '11px', fontStyle: 'italic' }}>No payments recorded</div>
                    )}
                    
                    {Number(invoice.p_credit_amount || 0) > 0 && (
                        <div className="breakdown-item" style={{ marginTop: '4px', borderTop: '1px dashed var(--border)', paddingTop: '4px' }}>
                            <span className="label">{t.pCreditUsed}</span>
                            <span className="value" style={{ color: 'var(--accent)' }}>{formatCurrency(invoice.p_credit_amount)}</span>
                        </div>
                    )}
                    <div className="breakdown-item" style={{ borderTop: '1px solid var(--border)', paddingTop: '4px', marginTop: '4px' }}>
                        <span className="label" style={{ fontWeight: 600 }}>{t.totalPaid}</span>
                        <span className="value text-success" style={{ fontWeight: 600 }}>{formatCurrency(paidAmount)}</span>
                    </div>
                    <div className="breakdown-item">
                        <span className="label" style={{ fontWeight: 600 }}>{t.outstandingDue}</span>
                        <span className={`value ${effectiveDue > 0 ? 'text-danger' : 'text-success'}`} style={{ fontWeight: 600 }}>
                            {formatCurrency(effectiveDue)}
                        </span>
                    </div>
                </div>

                <div className="invoice-totals-box">
                    <div className="invoice-totals-row">
                        <span>{t.subtotal}</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                        <div className="invoice-totals-row discount">
                            <span>{t.discount} ({dRate.toFixed(1)}%)</span>
                            <span>-{formatCurrency(discountAmount)}</span>
                        </div>
                    )}
                    {couponDiscountAmount > 0 && (
                        <div className="invoice-totals-row discount">
                            <span>Coupon ({invoice.coupon_code})</span>
                            <span>-{formatCurrency(couponDiscountAmount)}</span>
                        </div>
                    )}
                    {gstAmount > 0 && (
                        <div className="invoice-totals-row">
                            <span>{t.gst} ({gRate.toFixed(1)}%)</span>
                            <span>+{formatCurrency(gstAmount)}</span>
                        </div>
                    )}
                    <div className="invoice-totals-divider"></div>
                    <div className="invoice-totals-row grand-total">
                        <span>{returnedAmount > 0 ? t.effectiveTotal : t.grandTotal}</span>
                        <span className="total-amount">{formatCurrency(effectiveTotal)}</span>
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
                    <p>{t.phone}: {settings?.phone} | {t.email}: {settings?.email}</p>
                    <p>{t.gstin}: <strong>{settings?.gstin}</strong> | {t.state}: <strong>{settings?.default_place_of_supply || '—'}</strong></p>
                </div>
            </div>

            <div className="formal-info-grid">
                <div className="info-box bill-to">
                    <div className="box-label">{t.billTo}:</div>
                    <div className="box-content">
                        <strong>{displayName?.toUpperCase()}</strong>
                        {invoice.customer_address && <p>{invoice.customer_address}</p>}
                        {invoice.customer_phone && <p>{t.phone}: {invoice.customer_phone}</p>}
                        {invoice.customer_gstin && <p>{t.gstin}: {invoice.customer_gstin}</p>}
                        <p>{t.state}: {invoice.customer_state || settings?.default_place_of_supply || '—'}</p>
                    </div>
                </div>
                <div className="info-box invoice-details">
                    <div className="box-label">{isCreditInvoice ? 'CREDIT INVOICE DETAILS' : `${t.invoiceNo.toUpperCase()} DETAILS`}:</div>
                    <div className="box-content">
                        <div className="detail-row"><span>{t.invoiceNo}:</span> <strong>{invoiceNumber}</strong></div>
                        <div className="detail-row"><span>{t.date}:</span> <strong>{invoice.date}</strong></div>
                        <div className="detail-row"><span>{t.state}:</span> <strong>{invoice.customer_state || settings?.default_place_of_supply || '—'}</strong></div>
                        {settings?.show_category_in_invoice !== 'false' && (
                            <div className="detail-row"><span>Product Cat:</span> <strong>{billedCategories}</strong></div>
                        )}
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
                        <th className="col-name">{t.productName}</th>
                        <th className="col-hsn">{t.hsnSac}</th>
                        <th className="col-qty">{t.qty}</th>
                        <th className="col-unit">{t.unit}</th>
                        <th className="col-price">{t.price}</th>
                        <th className="col-gst">{t.gst}</th>
                        <th className="col-amount">{t.total}</th>
                    </tr>
                </thead>
                <tbody>
                    {(invoice.items || []).map((item, idx) => {
                        const displayQty = (settings?.include_pending_price === 'false')
                            ? (item.qty_delivered !== undefined && item.qty_delivered !== null ? item.qty_delivered : 0)
                            : item.quantity;
                        return (
                            <tr key={item.id || idx}>
                                <td className="col-idx">{idx + 1}</td>
                                <td className="col-name text-left">
                                    {item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}
                                    {item.pending_qty > 0 && <span style={{ marginLeft: 8, fontSize: '0.8em', color: '#b45309', fontWeight: 400 }}>(Pending: {item.pending_qty})</span>}
                                </td>
                                <td className="col-hsn">{item.hsn_sac || item.product_hsn || item.product_code || '—'}</td>
                                <td className="col-qty">
                                    {(() => {
                                        const retQty = getItemReturnedQty(item);
                                        const netQty = displayQty - retQty;
                                        return retQty > 0
                                            ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{netQty}</span>
                                            : displayQty;
                                    })()}
                                </td>
                                <td className="col-unit">{item.unit || 'Pcs'}</td>
                                <td className="col-price text-right">{formatCurrency(item.price)}</td>
                                <td className="col-gst text-right">
                                    {item.item_gst_rate > 0 ? (
                                        <>
                                            {formatCurrency((Number(item.price) * Number(displayQty) * (1 - (item.item_discount_rate || 0) / 100)) * (item.item_gst_rate / 100))}
                                            <br /><span className="gst-small">({item.item_gst_rate}%)</span>
                                        </>
                                    ) : '—'}
                                </td>
                                <td className="col-amount text-right">{formatCurrency(getItemTotal(item))}</td>
                            </tr>
                        );
                    })}
                    <tr className="total-row-main">
                        <td colSpan="3" className="text-right total-label">{t.total}</td>
                        <td className="col-qty">{totalQty}</td>
                        <td className="col-unit"></td>
                        <td className="col-price"></td>
                        <td className="col-gst text-right">{formatCurrency(taxSummary.reduce((s, t) => s + t.igst_amount, 0))}</td>
                        <td className="col-amount text-right">{formatCurrency(calculatedTotal)}</td>
                    </tr>
                </tbody>
            </table>

            <div className="formal-bottom-section">
                <div className="left-column">
                    <div className="tax-summary-box">
                        <div className="box-label">{t.taxSummary}:</div>
                        <table className="tax-table">
                            <thead>
                                <tr>
                                    <th>{t.hsnSac}</th>
                                    <th>{t.taxableAmount}</th>
                                    <th colSpan="2">IGST</th>
                                    <th>{t.totalTax}</th>
                                </tr>
                                <tr className="sub-head">
                                    <th></th>
                                    <th></th>
                                    <th>{t.rate} (%)</th>
                                    <th>{t.amt}</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {taxSummary.map((tax, i) => (
                                    <tr key={i}>
                                        <td>{tax.hsn}</td>
                                        <td>{formatCurrency(tax.taxable_amount)}</td>
                                        <td>{tax.igst_rate}</td>
                                        <td>{formatCurrency(tax.igst_amount)}</td>
                                        <td>{formatCurrency(tax.total_tax)}</td>
                                    </tr>
                                ))}
                                <tr className="total-tax-row">
                                    <td>TOTAL</td>
                                    <td>{formatCurrency(taxSummary.reduce((s, t) => s + t.taxable_amount, 0))}</td>
                                    <td></td>
                                    <td>{formatCurrency(taxSummary.reduce((s, t) => s + t.igst_amount, 0))}</td>
                                    <td>{formatCurrency(taxSummary.reduce((s, t) => s + t.total_tax, 0))}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="payment-mode-box">
                        <div className="box-label">{t.paymentHistory}:</div>
                        <div className="box-content">{paymentMethodDisplay}</div>
                    </div>

                    <div className="payment-mode-box" style={{ borderTop: 'none', marginTop: '-1px' }}>
                        <div className="box-label">{t.paymentHistory} {t.totalPaid}:</div>
                        <div className="box-content" style={{ fontSize: '10px' }}>
                            {invoice.payments && invoice.payments.length > 0 ? (
                                invoice.payments.map((p, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                        <span>{p.method} {p.transaction_id ? `(${p.transaction_id})` : ''}</span>
                                        <span>{formatCurrency(p.amount)}</span>
                                    </div>
                                ))
                            ) : (
                                <div>{invoice.payment_method || 'Unpaid'}</div>
                            )}
                        </div>
                    </div>

                    <div className="bank-details-box-formal" style={{ display: 'flex', gap: '15px', borderTop: '1px solid #334155', alignItems: 'center', padding: '10px' }}>
                        {settings?.payment_qr_url && (
                            <div className="bank-qr-formal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={settings.payment_qr_url} alt="QR" style={{ maxWidth: '80px', maxHeight: '80px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '4px', display: 'block', padding: '6px', background: '#ffffff', boxSizing: 'border-box' }} />
                            </div>
                        )}
                        <div style={{ flex: 1 }}>
                            <div className="box-label" style={{ marginBottom: '4px' }}>{t.bankDetails}:</div>
                            <div className="box-content">
                                <p>{t.bankName}: <strong>{settings?.bank_name}</strong></p>
                                <p>{t.accountNo}: <strong>{settings?.account_number}</strong></p>
                                <p>{t.ifscCode}: <strong>{settings?.ifsc_code}</strong></p>
                                <p>{t.accountHolder}: <strong>{settings?.account_holder_name}</strong></p>
                                {settings?.upi_id && <p>{t.upiId}: <strong>{settings?.upi_id}</strong></p>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="right-column">
                    <div className="summary-totals-box">
                        <div className="summary-row"><span>{t.subtotal}</span><span>:</span><span>{formatCurrency(subtotal)}</span></div>
                        {discountAmount > 0 && (
                            <div className="summary-row"><span>Discount ({dRate.toFixed(1)}%)</span><span>:</span><span>-{formatCurrency(discountAmount)}</span></div>
                        )}
                        {couponDiscountAmount > 0 && (
                            <div className="summary-row"><span>Coupon ({invoice.coupon_code})</span><span>:</span><span>-{formatCurrency(couponDiscountAmount)}</span></div>
                        )}
                        {gstAmount > 0 && (
                            <div className="summary-row"><span>GST ({gRate.toFixed(1)}%)</span><span>:</span><span>+{formatCurrency(gstAmount)}</span></div>
                        )}
                        <div className="summary-row"><span>{t.shipping}</span><span>:</span><span>{formatCurrency(invoice.shipping_amount || 0)}</span></div>
                        <div className="summary-row total"><span>{t.total}</span><span>:</span><span>{formatCurrency(effectiveTotal)}</span></div>
                        <div className="summary-row words">
                            <span>{t.amountInWords} :</span>
                            <p>{amountToWords(effectiveTotal)}</p>
                        </div>
                        <div className="summary-row"><span>{t.received}</span><span>:</span><span>{formatCurrency(paidAmount)}</span></div>
                        <div className="summary-row"><span>{t.balance}</span><span>:</span><span>{formatCurrency(effectiveDue)}</span></div>
                    </div>
                </div>
            </div>

            <div className="formal-terms-box">
                <div className="box-label">{t.termsAndConditions}:</div>
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
                        <p>{t.authorizedSignatory}</p>
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
                <p className="pos-contact">{t.phone}: {settings?.phone}</p>
                {settings?.gstin && <p className="pos-gstin">{t.gstin}: {settings.gstin}</p>}
            </div>

            <div className="pos-divider-dashed"></div>

            <div className="pos-meta">
                <div className="row"><span>{t.billNo}: {invoiceNumber}</span></div>
                <div className="row"><span>{t.date}: {invoice.date}</span></div>
                <div className="row"><span>{t.customer}: {displayName}</span></div>
                {settings?.show_category_in_invoice !== 'false' && (
                    <div className="row"><span>Product Cat: {billedCategories}</span></div>
                )}
            </div>

            <div className="pos-divider-solid"></div>

            <table className="pos-items-table">
                <thead>
                    <tr>
                        <th className="text-left">{t.item}</th>
                        <th className="text-center">{t.qty}</th>
                        <th className="text-right">{t.price}</th>
                        <th className="text-right">{t.total}</th>
                    </tr>
                </thead>
                <tbody>
                    {(invoice.items || []).map((item, idx) => {
                        const displayQty = (settings?.include_pending_price === 'false')
                            ? (item.qty_delivered !== undefined && item.qty_delivered !== null ? item.qty_delivered : 0)
                            : item.quantity;
                        return (
                            <tr key={item.id || idx}>
                                <td className="text-left" colSpan="4">
                                    <div style={{ marginBottom: '2px' }}>
                                        {item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#444' }}>
                                        <span>{displayQty} {item.unit || 'PCS'} x {formatCurrency(item.price)}</span>
                                        <span>{formatCurrency(getItemTotal(item))}</span>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div className="pos-divider-solid"></div>

            <div className="pos-totals">
                <div className="total-row">
                    <span>{t.subtotal}</span>
                    <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                    <div className="total-row">
                        <span>{t.discount} ({dRate.toFixed(1)}%)</span>
                        <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                )}
                {couponDiscountAmount > 0 && (
                    <div className="total-row">
                        <span>Coupon ({invoice.coupon_code})</span>
                        <span>-{formatCurrency(couponDiscountAmount)}</span>
                    </div>
                )}
                {gstAmount > 0 && (
                    <div className="total-row">
                        <span>{t.gst} ({gRate.toFixed(1)}%)</span>
                        <span>+{formatCurrency(gstAmount)}</span>
                    </div>
                )}
                <div className="pos-divider-dashed"></div>
                <div className="grand-total-row">
                    <span>{t.netAmount}</span>
                    <span className="amount">{formatCurrency(effectiveTotal)}</span>
                </div>
                <div className="pos-divider-dashed"></div>
                
                <div className="payment-info">
                    <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>{t.paymentHistory}</div>
                    {invoice.payments && invoice.payments.length > 0 ? (
                        invoice.payments.map((p, i) => (
                            <div key={i} className="row">
                                <span>{p.method}:</span> 
                                <span>{formatCurrency(p.amount)}</span>
                            </div>
                        ))
                    ) : (
                        <div className="row"><span>{invoice.payment_method || 'CASH'}:</span> <span>{formatCurrency(paidAmount)}</span></div>
                    )}
                    {Number(invoice.p_credit_amount || 0) > 0 && (
                        <div className="row"><span>{t.pCreditUsed}:</span> <span>{formatCurrency(invoice.p_credit_amount)}</span></div>
                    )}
                    <div className="pos-divider-dashed" style={{ margin: '4px 0' }}></div>
                    <div className="row" style={{ fontWeight: 'bold' }}><span>{t.totalPaid}:</span> <span>{formatCurrency(paidAmount)}</span></div>
                    {effectiveDue > 0 && <div className="row" style={{ fontWeight: 'bold', color: '#000' }}><span>{t.outstandingDue}:</span> <span>{formatCurrency(effectiveDue)}</span></div>}
                </div>
            </div>

            {taxSummary.length > 0 && (
                <>
                    <div className="pos-divider-dashed"></div>
                    <div className="pos-tax-summary">
                        <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>{t.taxSummary}</div>
                        <table style={{ width: '100%', fontSize: '9px' }}>
                            <thead>
                                <tr>
                                    <th className="text-left">{t.rate}</th>
                                    <th className="text-right">{t.taxableAmount}</th>
                                    <th className="text-right">{t.gst}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {taxSummary.map((tItem, idx) => (
                                    <tr key={idx}>
                                        <td className="text-left">{tItem.igst_rate}%</td>
                                        <td className="text-right">{formatCurrency(tItem.taxable_amount)}</td>
                                        <td className="text-right">{formatCurrency(tItem.total_tax)}</td>
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
                <p className="thank-you">{t.thankYou}</p>
                
                {settings?.payment_qr_url && (
                    <div className="pos-qr-container" style={{ flexDirection: 'column', alignItems: 'center' }}>
                        <img src={settings.payment_qr_url} alt="Payment QR" />
                        <div style={{ textAlign: 'center', marginTop: '6px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{t.scanToPay}</div>
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
                        {settings?.phone && <p style={{ fontSize: '11px', color: '#64748b' }}>{t.phone}: {settings.phone}</p>}
                        {settings?.email && <p style={{ fontSize: '11px', color: '#64748b' }}>{t.email}: {settings.email}</p>}
                        {settings?.gstin && <p style={{ fontSize: '11px', color: '#64748b' }}>{t.gstin}: {settings.gstin}</p>}
                    </div>
                    <div>
                        <div className="invoice-title">{isCreditInvoice ? 'CREDIT INVOICE' : t.invoice}</div>
                        <div className="invoice-meta">{invoiceNumber}</div>
                        <div className="invoice-meta">{invoice.date || '—'}</div>
                    </div>
                </div>

                <div className="two-col section">
                    <div>
                        <div className="section-title">{t.billTo}</div>
                        <p><strong>{displayName}</strong></p>
                        {invoice.customer_email && <p>{invoice.customer_email}</p>}
                        {invoice.customer_phone && <p>{invoice.customer_phone}</p>}
                        {invoice.customer_gstin && <p>{t.gstin}: {invoice.customer_gstin}</p>}
                        {settings?.show_category_in_invoice !== 'false' && (
                            <p style={{ marginTop: '4px', fontSize: '11px', color: '#64748b' }}>Product Cat: {billedCategories}</p>
                        )}
                    </div>
                    <div>
                        <div className="section-title">Shipping Address</div>
                        <p>{invoice.customer_address || '—'}</p>
                    </div>
                    <div>
                        <div className="section-title">{t.paymentStatus}</div>
                        <span className={`badge ${
                            (invoice.financial_status || '').toUpperCase() === 'PAID' ? 'badge-paid' :
                            (invoice.financial_status || '').toUpperCase() === 'PARTIAL' ? 'badge-partial' :
                            (invoice.financial_status || '').toUpperCase() === 'UNPAID' ? 'badge-unpaid' :
                            (invoice.financial_status || '').toUpperCase() === 'RETURNED' ? 'badge-unpaid' : 'badge-pending'
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
                                <th>{t.productName}</th>
                                <th>{t.price}</th>
                                <th>{t.qty}</th>
                                <th>{t.total}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(invoice.items || []).map((item, idx) => {
                                const displayQty = (settings?.include_pending_price === 'false')
                                    ? (item.qty_delivered !== undefined && item.qty_delivered !== null ? item.qty_delivered : 0)
                                    : item.quantity;
                                return (
                                    <tr key={item.id || idx}>
                                        <td>{idx + 1}</td>
                                        <td>
                                            {item.product_name}
                                            {item.variant_name ? ` (${item.variant_name})` : ''}
                                            {item.is_free ? <span style={{ marginLeft: 8, fontSize: '0.8em', color: '#166534', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>FREE</span> : ''}
                                            {item.pending_qty > 0 && <span style={{ marginLeft: 8, fontSize: '0.8em', color: '#b45309', fontWeight: 400 }}>(Pending: {item.pending_qty})</span>}
                                        </td>
                                        <td>{formatCurrency(item.price)}</td>
                                        <td>
                                            {(() => {
                                                const retQty = getItemReturnedQty(item);
                                                const netQty = displayQty - retQty;
                                                return retQty > 0
                                                    ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{netQty} {item.unit || 'PCS'}</span>
                                                    : `${displayQty} ${item.unit || 'PCS'}`;
                                            })()}
                                        </td>
                                        <td>{formatCurrency(getItemTotal(item))}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div className="totals">
                        <div className="totals-row">
                            <span>{t.subtotal}</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        {discountAmount > 0 && (
                            <div className="totals-row">
                                <span>{t.discount} ({dRate.toFixed(1)}%)</span>
                                <span>-{formatCurrency(discountAmount)}</span>
                            </div>
                        )}
                        {couponDiscountAmount > 0 && (
                            <div className="totals-row">
                                <span>Coupon ({invoice.coupon_code})</span>
                                <span>-{formatCurrency(couponDiscountAmount)}</span>
                            </div>
                        )}
                        {gstAmount > 0 && (
                            <div className="totals-row">
                                <span>{t.gst} ({gRate.toFixed(1)}%)</span>
                                <span>+{formatCurrency(gstAmount)}</span>
                            </div>
                        )}
                        
                        <div className="totals-row total">
                            <span>{t.grandTotal}</span>
                            <span>{formatCurrency(effectiveTotal)}</span>
                        </div>
                        {effectiveDue > 0 && (
                            <div className="totals-row" style={{ color: '#991b1b', fontWeight: 600 }}>
                                <span>{t.outstandingDue}</span>
                                <span>{formatCurrency(effectiveDue)}</span>
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
        <>
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
                <div key="payment-status" className="modal-footer-status-badge-container">
                    <span className={`payment-badge badge-${(invoice?.fulfillment_status || 'CONFIRMED').toLowerCase().replace(/_/g, '-')}`} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
                        {invoice?.payment_status === 'ADVANCE' ? '🟠 Advance' :
                            invoice?.fulfillment_status === 'PENDING_PRODUCT' ? '🟣 Pending Product' :
                                invoice?.fulfillment_status === 'CONFIRMED' ? '🔵 Confirmed' :
                                    invoice?.fulfillment_status === 'COMPLETED' ? '🟢 Completed' : invoice?.fulfillment_status}
                    </span>
                    <span className={`secondary-badge badge-${(invoice?.financial_status || 'PAID').toLowerCase().replace(/_/g, '-').replace(/ /g, '-')}`}>
                        {invoice?.financial_status || 'PAID'}
                    </span>
                </div>,
                <SButton key="share" variant="secondary" onClick={() => setShowShareModal(true)}>Share</SButton>,
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
                                            style={{ width: '100px', height: '100px', borderRadius: '4px', border: '1px solid #dee2e6', objectFit: 'contain', background: '#fff', padding: '6px', boxSizing: 'border-box' }}
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
                        <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Share Invoice</h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Copy Link Section */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                <div>
                                    <strong style={{ display: 'block', fontSize: '13px' }}>Invoice Link</strong>
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Copy the invoice URL to clipboard</span>
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
                                            {invoice?.customer_id && invoice?.customer_email ? (
                                                <div style={{
                                                    padding: '8px 12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--border)',
                                                    background: 'var(--bg-primary)',
                                                    fontSize: '13px',
                                                    fontWeight: '500',
                                                    color: 'var(--text-primary)'
                                                }}>
                                                    {recipientEmail}
                                                </div>
                                            ) : (
                                                <input 
                                                    type="email" 
                                                    className="form-control" 
                                                    value={recipientEmail} 
                                                    onChange={e => setRecipientEmail(e.target.value)}
                                                    placeholder="customer@example.com"
                                                    style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-strong)' }}
                                                />
                                            )}
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

