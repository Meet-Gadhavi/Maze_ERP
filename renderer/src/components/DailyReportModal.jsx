import { useState, useEffect, useRef } from 'react';
import api from '../api';
import './DailyReportModal.css';
import Icons from './Icons';
import { formatCurrency } from '../utils';

export default function DailyReportModal({ onClose }) {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [startingCash, setStartingCash] = useState(0);
    const [actualCash, setActualCash] = useState(0);
    const [expenses, setExpenses] = useState(0);

    const modalRef = useRef(null);
    const reportContentRef = useRef(null);

    useEffect(() => {
        loadReport();
    }, []);

    useEffect(() => {
        if (!loading) {
            const modal = modalRef.current;
            if (modal) {
                const handleHide = () => onClose();
                modal.addEventListener('hide', handleHide);
                modal.addEventListener('close', handleHide);
                
                // Show modal after a tiny delay to ensure custom elements are upgraded
                const timer = setTimeout(() => {
                    const trigger = document.getElementById('daily-report-trigger');
                    if (trigger) trigger.click();
                }, 50);

                return () => {
                    clearTimeout(timer);
                    modal.removeEventListener('hide', handleHide);
                    modal.removeEventListener('close', handleHide);
                };
            }
        }
    }, [loading, onClose]);

    async function loadReport() {
        setLoading(true);
        try {
            const data = await api.getDailyReport();
            setReport(data);
            
            // Also fetch expenses for the day if any
            const expenseData = await api.getExpenses({ date: new Date().toISOString().slice(0,10) });
            const totalExp = (expenseData || []).reduce((sum, e) => sum + Number(e.amount), 0);
            setExpenses(totalExp);
        } catch (err) {
            console.error('Report load error:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return (
        <div className="report-modal-overlay">
            <div className="report-modal loading" style={{ background: '#fff', padding: '40px', borderRadius: '12px', textAlign: 'center' }}>Loading daily report...</div>
        </div>
    );

    const cashCollected = (report?.payments || []).find(p => p.method === 'Cash')?.total || 0;
    const expectedCash = Number(startingCash) + Number(cashCollected) - Number(expenses);
    const difference = Number(actualCash) - expectedCash;

    function handlePrint() {
        if (!reportContentRef.current) return;
        const printContent = reportContentRef.current.cloneNode(true);
        printContent.classList.add('maze-print-el');
        document.body.appendChild(printContent);
        setTimeout(() => {
            window.print();
            document.body.removeChild(printContent);
        }, 50);
    }

    return (
        <>
            <s-button id="daily-report-trigger" commandFor="daily-report-modal" command="--show" style={{ display: 'none' }}>Open</s-button>
            <s-modal
                id="daily-report-modal"
                ref={modalRef}
                heading="Daily Cash Report (Z-Report)"
                size="large"
            >
                <div className="report-content printable-report" ref={reportContentRef}>
                    <p style={{ color: '#6d7175', marginBottom: '20px' }}>{new Date().toDateString()}</p>
                <div className="report-grid">
                    {/* Financial Summary */}
                    <div className="report-card">
                        <h3>Financial Summary</h3>
                        <div className="report-stat-row">
                            <span>Total Invoices</span>
                            <strong>{report?.salesSummary?.total_invoices || 0}</strong>
                        </div>
                        <div className="report-stat-row">
                            <span>Total Gross Sales</span>
                            <strong>{formatCurrency(report?.salesSummary?.total_sales || 0)}</strong>
                        </div>
                        <div className="report-stat-row">
                            <span>Total Returned</span>
                            <strong className="text-danger">{formatCurrency(report?.returnsSummary?.total_returned || 0)}</strong>
                        </div>
                        <div className="report-stat-row total">
                            <span>Net Collections</span>
                            <strong>{formatCurrency((report?.salesSummary?.total_collected || 0) - (report?.returnsSummary?.total_returned || 0))}</strong>
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="report-card">
                        <h3>Payment Breakdown</h3>
                        {(report?.payments || []).map(p => (
                            <div className="report-stat-row" key={p.method}>
                                <span>{p.method}</span>
                                <strong>{formatCurrency(p.total)}</strong>
                            </div>
                        ))}
                        <div className="report-stat-row">
                            <span>Expenses (Today)</span>
                            <strong className="text-danger">-{formatCurrency(expenses)}</strong>
                        </div>
                    </div>

                    {/* Reconciliation */}
                    <div className="report-card full-width reconciliation-card">
                        <h3>Shift Reconciliation</h3>
                        <div className="recon-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                            <div className="recon-input-group no-print">
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6d7175', marginBottom: '8px' }}>Opening Cash (Starting)</label>
                                <div className="input-with-icon" style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#6d7175' }}>₹</span>
                                    <input 
                                        type="number" 
                                        value={startingCash} 
                                        onChange={e => setStartingCash(e.target.value)}
                                        placeholder="0.00"
                                        style={{ paddingLeft: '24px' }}
                                    />
                                </div>
                            </div>
                            <div className="recon-stat only-print">
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6d7175', marginBottom: '8px' }}>Opening Cash (Starting)</label>
                                <div className="value" style={{ fontSize: '18px', fontWeight: '700' }}>{formatCurrency(startingCash)}</div>
                            </div>
                            <div className="recon-stat">
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6d7175', marginBottom: '8px' }}>Expected Cash in Drawer</label>
                                <div className="value" style={{ fontSize: '18px', fontWeight: '700' }}>{formatCurrency(expectedCash)}</div>
                                <small style={{ fontSize: '11px', color: '#6d7175' }}>(Opening + Cash Sales - Expenses)</small>
                            </div>
                            <div className="recon-input-group no-print">
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6d7175', marginBottom: '8px' }}>Actual Cash in Drawer</label>
                                <div className="input-with-icon" style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#6d7175' }}>₹</span>
                                    <input 
                                        type="number" 
                                        value={actualCash} 
                                        onChange={e => setActualCash(e.target.value)}
                                        placeholder="0.00"
                                        style={{ paddingLeft: '24px' }}
                                    />
                                </div>
                            </div>
                            <div className="recon-stat only-print">
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6d7175', marginBottom: '8px' }}>Actual Cash in Drawer</label>
                                <div className="value" style={{ fontSize: '18px', fontWeight: '700' }}>{formatCurrency(actualCash)}</div>
                            </div>
                            <div className="recon-stat">
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6d7175', marginBottom: '8px' }}>Discrepancy / Difference</label>
                                <div className={`value ${difference === 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '18px', fontWeight: '700', color: difference === 0 ? '#008060' : '#d82c0d' }}>
                                    {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                                </div>
                                <small style={{ fontSize: '11px', color: '#6d7175' }}>{difference === 0 ? 'Perfect Match' : difference > 0 ? 'Surplus' : 'Shortage'}</small>
                            </div>
                        </div>
                    </div>

                    {/* Top Products */}
                    <div className="report-card full-width">
                        <h3>Item-wise Sales Summary</h3>
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Product Name</th>
                                    <th className="text-center">Qty</th>
                                    <th className="text-right">Total Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(report?.productSales || []).slice(0, 10).map((p, idx) => (
                                    <tr key={idx}>
                                        <td>{p.product_name}</td>
                                        <td className="text-center">{p.quantity}</td>
                                        <td className="text-right">{formatCurrency(p.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="report-footer-print only-print">
                    <div className="signature-line">
                        <div className="line"></div>
                        <span>Cashier Signature</span>
                    </div>
                    <div className="signature-line">
                        <div className="line"></div>
                        <span>Manager Signature</span>
                    </div>
                </div>
                
                <div className="no-print" style={{ marginTop: '20px', padding: '12px', background: '#f6f6f7', borderRadius: '8px' }}>
                    <p style={{ fontSize: '12px', color: '#6d7175', margin: 0 }}>Note: Opening cash and actual cash are for shift reconciliation and are not saved to the database.</p>
                </div>
            </div>

            <s-button
                slot="secondary-actions"
                onClick={handlePrint}
            >
                Print Report
            </s-button>
            <s-button
                slot="primary-action"
                variant="primary"
                commandFor="daily-report-modal"
                command="--hide"
                onClick={() => setTimeout(onClose, 300)}
            >
                Finish & Close
            </s-button>
        </s-modal>
        </>
    );
}
