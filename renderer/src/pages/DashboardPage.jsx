import { useState, useEffect, useRef } from 'react';
import api from '../api';
import './DashboardPage.css';
import { formatDateShort, formatDate } from '../utils';
import { Icons } from '../components/Icons';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import DailyReportModal from '../components/DailyReportModal';
import SButton from '../components/SButton';

const CHART_COLORS = ['#0071E3', '#30D158', '#FF9F0A', '#FF3B30', '#5856D6', '#AF52DE', '#FF6B35', '#00C7BE'];
const TIMEFRAME_LABELS = {
    '7days': 'Last 7 Days',
    '2months': '2 Months',
    '6months': '6 Months',
    '12months': '1 Year'
};

const ANALYTICS_TABS = [
    { id: 'sales', label: 'Sales', icon: 'TrendingUp' },
    { id: 'inventory', label: 'Inventory', icon: 'Package' },
    { id: 'customers', label: 'Customers', icon: 'Users' },
    { id: 'payment', label: 'Payment', icon: 'CreditCard' },
    { id: 'ai', label: 'AI / Automation', icon: 'Zap' },
    { id: 'financial', label: 'Financial', icon: 'BarChart2' },
];

const chartStyle = {
    contentStyle: { borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' },
    axisTickStyle: { fontSize: 11, fill: '#8E8E93' }
};

function EmptyChart({ icon = 'BarChart2', message = 'No data for this period' }) {
    const IconComp = Icons[icon] || Icons.BarChart2;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 12, color: 'var(--text-tertiary)' }}>
            <IconComp size={36} style={{ opacity: 0.2 }} />
            <p style={{ margin: 0, fontSize: '13px' }}>{message}</p>
        </div>
    );
}

function ChartCard({ title, subtitle, children, style }) {
    return (
        <div className="chart-card" style={style}>
            <div className="chart-header">
                <div>
                    <h3>{title}</h3>
                    {subtitle && <p className="chart-subtitle">{subtitle}</p>}
                </div>
            </div>
            <div className="chart-body">{children}</div>
        </div>
    );
}

function KpiCard({ label, value, sub, color = 'blue', icon, onClick }) {
    return (
        <div className="stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
            <div className="stat-card-content">
                <div className={`stat-card-icon ${color}`}>{icon}</div>
                <div className="stat-card-info">
                    <span className="stat-card-label">{label}</span>
                    <span className="stat-card-value">{value}</span>
                    {sub && <span className="stat-card-sub">{sub}</span>}
                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('7days');
    const cacheRef = useRef({});
    const navigate = useNavigate();
    const [showDailyReport, setShowDailyReport] = useState(false);
    const [settings, setSettings] = useState({});
    const [newVersion, setNewVersion] = useState(null);
    const [isDownloaded, setIsDownloaded] = useState(localStorage.getItem('maze_update_downloaded') === 'true');
    const [activeTab, setActiveTab] = useState('sales');

    useEffect(() => {
        api.getSettings().then(setSettings).catch(console.error);

        const cachedUpdate = localStorage.getItem('maze_update_available');
        if (cachedUpdate) setNewVersion(cachedUpdate);

        if (!window.maze || !window.maze.updates) return;

        const timeoutId = setTimeout(() => { window.maze.updates.check(); }, 3000);

        const unsubAvail = window.maze.updates.onAvailable((info) => {
            setNewVersion(info.version);
            localStorage.setItem('maze_update_available', info.version);
            api.getSettings().then(dbSettings => {
                if (dbSettings.auto_update_enabled === 'true') window.maze.updates.download();
            }).catch(console.error);
        });

        const unsubNotAvail = window.maze.updates.onNotAvailable(() => {
            setNewVersion(null); setIsDownloaded(false);
            localStorage.removeItem('maze_update_available');
            localStorage.removeItem('maze_update_downloaded');
        });

        const unsubDownloaded = window.maze.updates.onDownloaded(() => {
            setIsDownloaded(true);
            localStorage.setItem('maze_update_downloaded', 'true');
        });

        return () => { clearTimeout(timeoutId); unsubAvail(); unsubNotAvail(); unsubDownloaded(); };
    }, []);

    useEffect(() => { loadDashboard(); }, [timeframe]);

    async function loadDashboard() {
        if (cacheRef.current[timeframe]) {
            setData(cacheRef.current[timeframe]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const result = await api.getDashboard({ range: timeframe });
            cacheRef.current[timeframe] = result;
            setData(result);
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading && !data) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
            <div className="spinner" style={{ borderTopColor: 'var(--accent)', width: '36px', height: '36px' }}></div>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>Loading analytics…</p>
        </div>
    );

    if (!data) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                <Icons.AlertTriangle size={26} />
            </div>
            <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Dashboard failed to load</p>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13px' }}>Make sure the backend server is running.</p>
            </div>
            <SButton variant="primary" onClick={() => { cacheRef.current = {}; loadDashboard(); }}>Retry</SButton>
        </div>
    );

    const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

    return (
        <div className="dashboard-container">
            {/* ── Update Banner ─────────────────────────────── */}
            {newVersion && (
                <div className="update-banner" style={{
                    background: isDownloaded ? 'linear-gradient(135deg,#30D158 0%,#1c9e3e 100%)' : 'linear-gradient(135deg,#0071E3 0%,#0056b3 100%)',
                    color: '#fff', padding: '14px 20px', borderRadius: '12px', marginBottom: '0',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    boxShadow: '0 4px 14px rgba(0,113,227,0.25)', animation: 'slideDown 0.3s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isDownloaded ? <Icons.Check size={18} color="#fff" /> : <Icons.Zap size={18} color="#fff" />}
                        </div>
                        <div>
                            <strong style={{ fontSize: '14px' }}>{isDownloaded ? 'System Update Ready!' : 'System Update Available!'}</strong>
                            <span style={{ fontSize: '13px', marginLeft: 8, opacity: 0.9 }}>
                                {isDownloaded ? `Quantro v${newVersion} downloaded. Restart to apply.` : `Quantro v${newVersion} is ready to install.`}
                            </span>
                        </div>
                    </div>
                    <SButton type="button" variant="secondary"
                        style={{ background: '#fff', color: isDownloaded ? '#30D158' : '#0071E3', border: 'none', fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '6px' }}
                        onClick={() => {
                            if (isDownloaded && window.maze?.updates) window.maze.updates.install();
                            else { localStorage.setItem('settings_active_tab', 'updates'); navigate('/settings'); }
                        }}>
                        {isDownloaded ? 'Restart to Update' : 'Install Update'}
                    </SButton>
                </div>
            )}

            {/* ── Page Header ────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1>Dashboard Overview</h1>
                    <p className="text-secondary">Real-time analytics across sales, inventory, customers & AI</p>
                </div>
                <div className="header-actions">
                    {settings.enable_quick_sale === 'true' && settings.enable_customer_display === 'true' && (
                        <SButton variant="secondary" onClick={() => window.maze?.openCustomerDisplay()} style={{ border: '1px solid var(--border-strong)' }}>
                            Customer Display
                        </SButton>
                    )}
                    <SButton variant="secondary" onClick={() => setShowDailyReport(true)}>
                        Daily Report
                    </SButton>
                </div>
            </div>

            {/* ── KPI Row (6 cards) ──────────────────────────── */}
            <div className="dashboard-kpi-grid">
                <KpiCard
                    label="Today's Sales"
                    value={fmt(data.salesToday)}
                    color="blue"
                    icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M8.5 9.99984H15.5M8.5 6.5H15.5M14 18.0002L8.5 13.5002L10 13.5C14.4447 13.5 14.4447 6.5 10 6.5M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                />
                <KpiCard
                    label="Monthly Revenue"
                    value={fmt(data.monthlyRevenue)}
                    color="green"
                    icon={<Icons.TrendingUp size={22} />}
                />
                <KpiCard
                    label="Total Orders"
                    value={data.totalOrders}
                    sub={TIMEFRAME_LABELS[timeframe]}
                    color="purple"
                    icon={<Icons.ShoppingBag size={22} />}
                />
                <KpiCard
                    label="Low Stock"
                    value={`${data.lowStockCount} items`}
                    color="orange"
                    icon={<Icons.AlertTriangle size={22} />}
                    onClick={() => navigate('/inventory')}
                />
                <KpiCard
                    label="Pending Dues"
                    value={fmt(data.outstandingDues?.total)}
                    sub={`${data.outstandingDues?.count || 0} invoices`}
                    color="red"
                    icon={<Icons.Clock size={22} />}
                    onClick={() => navigate('/sales')}
                />
                <KpiCard
                    label="AI Orders"
                    value={data.aiOrdersCount}
                    color="ai"
                    icon={<Icons.Zap size={22} />}
                    onClick={() => navigate('/automation')}
                />
            </div>

            {/* ── Timeframe Picker ───────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <div className="timeframe-selector">
                    {Object.entries(TIMEFRAME_LABELS).map(([key, label]) => (
                        <button key={key} className={timeframe === key ? 'active' : ''} onClick={() => { cacheRef.current = {}; setTimeframe(key); }} title={label}>
                            {key === '7days' ? '7D' : key === '2months' ? '2M' : key === '6months' ? '6M' : '1Y'}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Analytics Section Tabs ─────────────────────── */}
            <div className="analytics-tabs-wrap">
                <div className="analytics-tabs">
                    {ANALYTICS_TABS.map(tab => {
                        const IconComp = Icons[tab.icon] || Icons.BarChart2;
                        return (
                            <button
                                key={tab.id}
                                className={`analytics-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <IconComp size={15} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════
                SALES TAB
            ══════════════════════════════════════════════════ */}
            {activeTab === 'sales' && (
                <div className="analytics-panel">
                    {/* Sales Trend + Orders vs Revenue */}
                    <div className="analytics-grid-2">
                        <ChartCard title="Sales Trend" subtitle={`Revenue over ${TIMEFRAME_LABELS[timeframe].toLowerCase()}`}>
                            {loading ? <EmptyChart message="Loading..." /> :
                            !data.salesOverTime?.length ? <EmptyChart icon="TrendingUp" message="No sales for this period" /> : (
                                <ResponsiveContainer width="100%" height={240}>
                                    <AreaChart data={data.salesOverTime}>
                                        <defs>
                                            <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#0071E3" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={formatDateShort} />
                                        <YAxis axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={v => `₹${v}`} width={60} />
                                        <Tooltip contentStyle={chartStyle.contentStyle} formatter={v => [fmt(v), 'Sales']} labelFormatter={l => formatDate(l)} />
                                        <Area type="monotone" dataKey="total" stroke="#0071E3" strokeWidth={2.5} fillOpacity={1} fill="url(#gradSales)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>

                        <ChartCard title="Orders vs Revenue" subtitle="Invoice count and revenue per day">
                            {loading ? <EmptyChart message="Loading..." /> :
                            !data.ordersVsRevenue?.some(d => d.orders > 0) ? <EmptyChart icon="BarChart2" message="No orders for this period" /> : (
                                <ResponsiveContainer width="100%" height={240}>
                                    <ComposedChart data={data.ordersVsRevenue}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={formatDateShort} />
                                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={v => `₹${v}`} width={60} />
                                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} />
                                        <Tooltip contentStyle={chartStyle.contentStyle} formatter={(v, name) => name === 'revenue' ? [fmt(v), 'Revenue'] : [v, 'Orders']} labelFormatter={formatDate} />
                                        <Bar yAxisId="right" dataKey="orders" fill="rgba(0,113,227,0.15)" radius={[4, 4, 0, 0]} name="orders" />
                                        <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#0071E3" strokeWidth={2.5} dot={false} name="revenue" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                    </div>

                    {/* Top Products + Category Sales */}
                    <div className="analytics-grid-2">
                        <ChartCard title="Top Selling Products" subtitle="By units sold this period">
                            {!data.topSellingProducts?.length ? <EmptyChart icon="Package" message="No sales data" /> : (
                                <div className="top-products-list">
                                    {data.topSellingProducts.slice(0, 8).map((p, i) => (
                                        <div className="top-product-item" key={i}>
                                            <div className="tp-rank">{i + 1}</div>
                                            <div className="tp-info">
                                                <span className="tp-name">{p.name}</span>
                                                <span className="tp-qty">{Number(p.value).toLocaleString('en-IN')} units</span>
                                            </div>
                                            <div className="tp-bar-wrap">
                                                <div className="tp-bar" style={{ width: `${Math.max(8, (p.value / data.topSellingProducts[0].value) * 100)}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ChartCard>

                        <ChartCard title="Category Sales" subtitle="Revenue by product category">
                            {!data.categorySales?.length ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie data={data.categoryDistribution?.map(c => ({ ...c, name: c.name || 'Uncategorized' })) || []} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                                            {(data.categoryDistribution || []).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={chartStyle.contentStyle} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie data={data.categorySales.map(c => ({ ...c, name: c.name || 'Uncategorized' }))} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                                            {data.categorySales.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={chartStyle.contentStyle} formatter={v => [fmt(v), 'Revenue']} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                    </div>

                    {/* Peak Hours + Returns */}
                    <div className="analytics-grid-2">
                        <ChartCard title="Peak Selling Hours" subtitle="Revenue activity by hour of day">
                            {!data.peakSellingHours?.some(h => h.revenue > 0) ? <EmptyChart icon="Clock" message="No hourly data available" /> : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart data={data.peakSellingHours}>
                                        <defs>
                                            <linearGradient id="gradPeak" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#5856D6" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#5856D6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={h => `${h}:00`} />
                                        <YAxis axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={v => `₹${v}`} width={60} />
                                        <Tooltip contentStyle={chartStyle.contentStyle} formatter={(v, name) => name === 'revenue' ? [fmt(v), 'Revenue'] : [v, 'Orders']} labelFormatter={h => `${h}:00`} />
                                        <Area type="monotone" dataKey="revenue" stroke="#5856D6" strokeWidth={2.5} fillOpacity={1} fill="url(#gradPeak)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>

                        <ChartCard title="Return / Refund Analytics" subtitle="Returns count and amount over period">
                            {!data.returnAnalytics?.some(r => r.count > 0) ? <EmptyChart icon="RotateCcw" message="No returns in this period" /> : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={data.returnAnalytics}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={formatDateShort} />
                                        <YAxis axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={v => `₹${v}`} width={60} />
                                        <Tooltip contentStyle={chartStyle.contentStyle} formatter={(v, name) => name === 'amount' ? [fmt(v), 'Amount'] : [v, 'Returns']} labelFormatter={formatDate} />
                                        <Bar dataKey="amount" fill="#FF3B30" radius={[4, 4, 0, 0]} name="amount" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                    </div>

                    {/* Recent Transactions */}
                    <div className="chart-card">
                        <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><h3>Recent Transactions</h3><p className="chart-subtitle">Latest 10 invoices</p></div>
                            <SButton variant="secondary" style={{ fontSize: '12px' }} onClick={() => navigate('/sales')}>View All</SButton>
                        </div>
                        <div className="recent-table-wrap">
                            {!data.recentTransactions?.length ? (
                                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No transactions yet</div>
                            ) : (
                                <table>
                                    <thead>
                                        <tr><th>Invoice #</th><th>Customer</th><th>Amount</th><th>Paid</th><th>Status</th><th>Date</th></tr>
                                    </thead>
                                    <tbody>
                                        {data.recentTransactions.map(tx => (
                                            <tr key={tx.id}>
                                                <td className="fw-500">INV-{String(tx.id).padStart(4, '0')}</td>
                                                <td>{tx.customer_name}</td>
                                                <td className="fw-600">{fmt(tx.total)}</td>
                                                <td style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(tx.paid_amount)}</td>
                                                <td>
                                                    <span className={`status-badge ${tx.payment_status === 'Paid' || tx.payment_status === 'PAID' ? 'paid' : tx.payment_status === 'Partial' ? 'partial' : 'due'}`}>
                                                        {tx.payment_status || 'Paid'}
                                                    </span>
                                                </td>
                                                <td className="text-secondary">{formatDate(tx.date)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════
                INVENTORY TAB
            ══════════════════════════════════════════════════ */}
            {activeTab === 'inventory' && (
                <div className="analytics-panel">
                    {/* Inventory KPIs */}
                    <div className="analytics-mini-kpi-row">
                        <div className="mini-kpi-card">
                            <span className="mini-kpi-label">Inventory Value</span>
                            <span className="mini-kpi-value">{fmt(data.inventoryValue)}</span>
                        </div>
                        <div className="mini-kpi-card">
                            <span className="mini-kpi-label">Total Products</span>
                            <span className="mini-kpi-value">{data.totalProducts}</span>
                        </div>
                        <div className="mini-kpi-card warning">
                            <span className="mini-kpi-label">Low Stock Items</span>
                            <span className="mini-kpi-value">{data.lowStockCount}</span>
                        </div>
                    </div>

                    <div className="analytics-grid-2">
                        {/* Low Stock Products */}
                        <ChartCard title="Low Stock Alert" subtitle="Products below minimum stock level">
                            {!data.lowStockProducts?.length ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0', color: 'var(--success)' }}>
                                    <Icons.CheckCircle size={40} />
                                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>All products well-stocked!</p>
                                </div>
                            ) : (
                                <div className="stock-alert-list">
                                    {data.lowStockProducts.map((p, i) => {
                                        const pct = Math.min(100, Math.max(4, (p.stock_quantity / Math.max(1, p.min_stock_level)) * 100));
                                        return (
                                            <div className="stock-alert-item" key={i}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <span style={{ fontWeight: 500, fontSize: '13px' }}>{p.name}</span>
                                                    <span style={{ fontSize: '12px', color: pct < 30 ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
                                                        {p.stock_quantity} / {p.min_stock_level} {p.unit}
                                                    </span>
                                                </div>
                                                <div className="stock-progress-wrap">
                                                    <div className="stock-progress-fill" style={{ width: `${pct}%`, background: pct < 30 ? 'var(--danger)' : 'var(--warning)' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ChartCard>

                        {/* Fast vs Slow Moving */}
                        <ChartCard title="Fast vs Slow Moving Products" subtitle="By units sold this period">
                            {!data.fastMoving?.length && !data.slowMoving?.length ? <EmptyChart icon="BarChart2" message="No movement data" /> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                    <div>
                                        <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: 'var(--success)' }}>🚀 Fast Moving</p>
                                        {(data.fastMoving || []).map((p, i) => (
                                            <div key={i} className="top-product-item">
                                                <div className="tp-rank" style={{ background: 'rgba(48,209,88,0.1)', color: 'var(--success)' }}>{i + 1}</div>
                                                <div className="tp-info"><span className="tp-name">{p.name}</span><span className="tp-qty">{p.sold} units</span></div>
                                                <div className="tp-bar-wrap"><div className="tp-bar" style={{ width: `${Math.max(8, (p.sold / Math.max(1, data.fastMoving[0]?.sold)) * 100)}%`, background: 'var(--success)' }} /></div>
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: 'var(--warning)' }}>🐢 Slow Moving</p>
                                        {(data.slowMoving || []).map((p, i) => (
                                            <div key={i} className="top-product-item">
                                                <div className="tp-rank" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>{i + 1}</div>
                                                <div className="tp-info"><span className="tp-name">{p.name}</span><span className="tp-qty">{p.sold} units</span></div>
                                                <div className="tp-bar-wrap"><div className="tp-bar" style={{ width: '8%', background: 'var(--warning)' }} /></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </ChartCard>
                    </div>

                    {/* Stock Movement Trend */}
                    <ChartCard title="Stock Movement Trend" subtitle="Inventory in vs out over period">
                        {!data.stockMovementTrend?.some(d => d.stock_in > 0 || d.stock_out > 0) ? <EmptyChart icon="ArrowUpDown" message="No stock movements recorded" /> : (
                            <ResponsiveContainer width="100%" height={240}>
                                <AreaChart data={data.stockMovementTrend}>
                                    <defs>
                                        <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#30D158" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#30D158" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#FF3B30" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#FF3B30" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={formatDateShort} />
                                    <YAxis axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} />
                                    <Tooltip contentStyle={chartStyle.contentStyle} labelFormatter={formatDate} />
                                    <Area type="monotone" dataKey="stock_in" stroke="#30D158" strokeWidth={2} fill="url(#gradIn)" name="Stock IN" />
                                    <Area type="monotone" dataKey="stock_out" stroke="#FF3B30" strokeWidth={2} fill="url(#gradOut)" name="Stock OUT" />
                                    <Legend />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>
                </div>
            )}

            {/* ══════════════════════════════════════════════════
                CUSTOMERS TAB
            ══════════════════════════════════════════════════ */}
            {activeTab === 'customers' && (
                <div className="analytics-panel">
                    <div className="analytics-grid-2">
                        {/* Top Customers Leaderboard */}
                        <ChartCard title="Top Customers" subtitle={`By revenue · ${TIMEFRAME_LABELS[timeframe]}`}>
                            {!data.topCustomers?.length ? <EmptyChart icon="Users" message="No customer data for this period" /> : (
                                <div className="leaderboard-list">
                                    {data.topCustomers.map((c, i) => (
                                        <div className="leaderboard-item" key={i}>
                                            <div className={`leaderboard-rank rank-${i < 3 ? i + 1 : 'other'}`}>{i + 1}</div>
                                            <div className="leaderboard-info">
                                                <span className="leaderboard-name">{c.name}</span>
                                                <span className="leaderboard-sub">{c.invoice_count} invoice{c.invoice_count !== 1 ? 's' : ''}</span>
                                            </div>
                                            <span className="leaderboard-value">{fmt(c.total_spent)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ChartCard>

                        {/* Repeat vs New */}
                        <ChartCard title="Customer Loyalty" subtitle="Repeat vs first-time customers">
                            {(!data.repeatVsNew?.repeat && !data.repeatVsNew?.new) ? <EmptyChart icon="Users" message="No customer data" /> : (
                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Repeat Customers', value: data.repeatVsNew?.repeat || 0 },
                                                { name: 'New Customers', value: data.repeatVsNew?.new || 0 }
                                            ]}
                                            cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value"
                                        >
                                            <Cell fill="#0071E3" />
                                            <Cell fill="#30D158" />
                                        </Pie>
                                        <Tooltip contentStyle={chartStyle.contentStyle} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                    </div>

                    <div className="analytics-grid-2">
                        {/* Customer Growth */}
                        <ChartCard title="Customer Growth" subtitle="New customers over time">
                            {!data.customerGrowth?.some(d => d.new_customers > 0) ? <EmptyChart icon="UserPlus" message="No new customers in this period" /> : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart data={data.customerGrowth}>
                                        <defs>
                                            <linearGradient id="gradCust" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#30D158" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#30D158" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={formatDateShort} />
                                        <YAxis axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} allowDecimals={false} />
                                        <Tooltip contentStyle={chartStyle.contentStyle} formatter={v => [v, 'New Customers']} labelFormatter={formatDate} />
                                        <Area type="monotone" dataKey="new_customers" stroke="#30D158" strokeWidth={2.5} fillOpacity={1} fill="url(#gradCust)" name="New Customers" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>

                        {/* Invoice Status Distribution */}
                        <ChartCard title="Invoice Status" subtitle="Payment status breakdown for period">
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Paid', value: data.duesByStatus?.Paid || 0 },
                                            { name: 'Partial', value: data.duesByStatus?.Partial || 0 },
                                            { name: 'Unpaid', value: data.duesByStatus?.Unpaid || 0 }
                                        ].filter(d => d.value > 0)}
                                        cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value"
                                    >
                                        <Cell fill="#30D158" />
                                        <Cell fill="#FF9F0A" />
                                        <Cell fill="#FF3B30" />
                                    </Pie>
                                    <Tooltip contentStyle={chartStyle.contentStyle} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════
                PAYMENT TAB
            ══════════════════════════════════════════════════ */}
            {activeTab === 'payment' && (
                <div className="analytics-panel">
                    <div className="analytics-mini-kpi-row">
                        <div className="mini-kpi-card danger">
                            <span className="mini-kpi-label">Total Outstanding</span>
                            <span className="mini-kpi-value">{fmt(data.outstandingDues?.total)}</span>
                            <span className="mini-kpi-sub">{data.outstandingDues?.count || 0} invoices pending</span>
                        </div>
                        <div className="mini-kpi-card">
                            <span className="mini-kpi-label">Advance Invoices</span>
                            <span className="mini-kpi-value">{data.advanceCount || 0}</span>
                        </div>
                    </div>

                    <div className="analytics-grid-2">
                        {/* Payment Method Breakdown */}
                        <ChartCard title="Payment Method Distribution" subtitle="How customers pay">
                            {!data.paymentMethodBreakdown?.length ? <EmptyChart icon="CreditCard" message="No payment data for this period" /> : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie
                                            data={data.paymentMethodBreakdown.map(p => ({ name: p.method || 'Cash', value: Number(p.total) }))}
                                            cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value"
                                        >
                                            {data.paymentMethodBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={chartStyle.contentStyle} formatter={v => [fmt(v), 'Amount']} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>

                        {/* Payment Method by Count */}
                        <ChartCard title="Transactions by Method" subtitle="Number of transactions per payment type">
                            {!data.paymentMethodBreakdown?.length ? <EmptyChart icon="CreditCard" message="No payment data" /> : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={data.paymentMethodBreakdown.map(p => ({ name: p.method || 'Cash', count: p.count, amount: p.total }))} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} />
                                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} width={60} />
                                        <Tooltip contentStyle={chartStyle.contentStyle} />
                                        <Bar dataKey="count" fill="#0071E3" radius={[0, 6, 6, 0]} name="Transactions" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                    </div>

                    {/* Return Analytics */}
                    <ChartCard title="Return & Refund Analytics" subtitle="Refund amounts over the selected period">
                        {!data.returnAnalytics?.some(r => r.count > 0) ? <EmptyChart icon="RotateCcw" message="No returns in this period" /> : (
                            <ResponsiveContainer width="100%" height={220}>
                                <ComposedChart data={data.returnAnalytics}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={formatDateShort} />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={v => `₹${v}`} width={60} />
                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} />
                                    <Tooltip contentStyle={chartStyle.contentStyle} formatter={(v, name) => name === 'amount' ? [fmt(v), 'Refund'] : [v, 'Returns']} labelFormatter={formatDate} />
                                    <Bar yAxisId="right" dataKey="count" fill="rgba(255,59,48,0.2)" radius={[4, 4, 0, 0]} name="count" />
                                    <Line yAxisId="left" type="monotone" dataKey="amount" stroke="#FF3B30" strokeWidth={2.5} dot={false} name="amount" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>
                </div>
            )}

            {/* ══════════════════════════════════════════════════
                AI / AUTOMATION TAB
            ══════════════════════════════════════════════════ */}
            {activeTab === 'ai' && (
                <div className="analytics-panel">
                    {/* AI KPI Cards */}
                    <div className="analytics-mini-kpi-row">
                        <div className="mini-kpi-card ai">
                            <span className="mini-kpi-label">Total AI Orders</span>
                            <span className="mini-kpi-value">{data.aiStats?.totalOrders || 0}</span>
                        </div>
                        <div className="mini-kpi-card ai">
                            <span className="mini-kpi-label">AI Revenue</span>
                            <span className="mini-kpi-value">{fmt(data.aiStats?.confirmedRevenue)}</span>
                            <span className="mini-kpi-sub">{data.aiStats?.confirmedOrders || 0} confirmed</span>
                        </div>
                        <div className="mini-kpi-card">
                            <span className="mini-kpi-label">Voice Orders</span>
                            <span className="mini-kpi-value">{data.aiStats?.voiceCount || 0}</span>
                        </div>
                        <div className="mini-kpi-card">
                            <span className="mini-kpi-label">WhatsApp Orders</span>
                            <span className="mini-kpi-value">{data.aiStats?.whatsappCount || 0}</span>
                        </div>
                    </div>

                    <div className="analytics-grid-2">
                        {/* AI vs Manual */}
                        <ChartCard title="AI vs Manual Orders" subtitle={`Orders comparison · ${TIMEFRAME_LABELS[timeframe]}`}>
                            {(!data.aiVsManual?.aiOrders && !data.aiVsManual?.manualOrders) ? <EmptyChart icon="Zap" message="No order data for this period" /> : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'AI Orders', value: data.aiVsManual?.aiOrders || 0 },
                                                { name: 'Manual Orders', value: data.aiVsManual?.manualOrders || 0 }
                                            ]}
                                            cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={4} dataKey="value"
                                        >
                                            <Cell fill="#5856D6" />
                                            <Cell fill="#0071E3" />
                                        </Pie>
                                        <Tooltip contentStyle={chartStyle.contentStyle} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>

                        {/* Voice vs WhatsApp */}
                        <ChartCard title="Channel Distribution" subtitle="Voice vs WhatsApp agent orders">
                            {(!data.aiStats?.voiceCount && !data.aiStats?.whatsappCount) ? <EmptyChart icon="Activity" message="No AI orders yet" /> : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Voice', value: data.aiStats?.voiceCount || 0 },
                                                { name: 'WhatsApp', value: data.aiStats?.whatsappCount || 0 }
                                            ]}
                                            cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={4} dataKey="value"
                                        >
                                            <Cell fill="#5856D6" />
                                            <Cell fill="#30D158" />
                                        </Pie>
                                        <Tooltip contentStyle={chartStyle.contentStyle} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                    </div>

                    {/* AI Orders by Day */}
                    <ChartCard title="AI Orders Over Time" subtitle="Daily AI agent order activity">
                        {!data.aiOrdersByDay?.some(d => d.count > 0) ? (
                            <div style={{ padding: '40px', textAlign: 'center' }}>
                                <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(88,86,214,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#5856D6' }}>
                                    <Icons.Zap size={28} />
                                </div>
                                <p style={{ fontWeight: 600, margin: '0 0 8px' }}>No AI orders yet</p>
                                <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px', fontSize: '13px' }}>Connect your Mazeway Voice or WhatsApp agents to start receiving AI-powered orders.</p>
                                <SButton variant="primary" onClick={() => navigate('/automation')}>Set Up AI Agents</SButton>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={data.aiOrdersByDay}>
                                    <defs>
                                        <linearGradient id="gradAI" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#5856D6" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#5856D6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={formatDateShort} />
                                    <YAxis axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} allowDecimals={false} />
                                    <Tooltip contentStyle={chartStyle.contentStyle} formatter={v => [v, 'AI Orders']} labelFormatter={formatDate} />
                                    <Area type="monotone" dataKey="count" stroke="#5856D6" strokeWidth={2.5} fillOpacity={1} fill="url(#gradAI)" name="AI Orders" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>
                </div>
            )}

            {/* ══════════════════════════════════════════════════
                FINANCIAL TAB
            ══════════════════════════════════════════════════ */}
            {activeTab === 'financial' && (
                <div className="analytics-panel">
                    {/* Financial KPIs */}
                    <div className="analytics-mini-kpi-row">
                        <div className="mini-kpi-card green">
                            <span className="mini-kpi-label">Gross Profit (Est.)</span>
                            <span className="mini-kpi-value">{fmt(data.estimatedProfit)}</span>
                            <span className="mini-kpi-sub">{TIMEFRAME_LABELS[timeframe]}</span>
                        </div>
                        <div className="mini-kpi-card danger">
                            <span className="mini-kpi-label">Total Expenses</span>
                            <span className="mini-kpi-value">{fmt(data.totalExpenses)}</span>
                        </div>
                        <div className="mini-kpi-card">
                            <span className="mini-kpi-label">Purchase Spend</span>
                            <span className="mini-kpi-value">{fmt(data.purchaseTotal)}</span>
                        </div>
                        <div className="mini-kpi-card green">
                            <span className="mini-kpi-label">Net (Rev - Exp)</span>
                            <span className="mini-kpi-value">{fmt((data.monthlyRevenue || 0) - (data.totalExpenses || 0))}</span>
                        </div>
                    </div>

                    {/* Revenue vs Expenses */}
                    <ChartCard title="Revenue vs Expenses" subtitle="Overlay comparison over the period">
                        {!data.revenueVsExpenses?.some(d => d.revenue > 0 || d.expenses > 0) ? <EmptyChart icon="BarChart2" message="No financial data for this period" /> : (
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={data.revenueVsExpenses}>
                                    <defs>
                                        <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0071E3" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#FF3B30" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#FF3B30" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={formatDateShort} />
                                    <YAxis axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={v => `₹${v}`} width={60} />
                                    <Tooltip contentStyle={chartStyle.contentStyle} formatter={(v, n) => [fmt(v), n === 'revenue' ? 'Revenue' : 'Expenses']} labelFormatter={formatDate} />
                                    <Area type="monotone" dataKey="revenue" stroke="#0071E3" strokeWidth={2.5} fill="url(#gradRev)" name="revenue" />
                                    <Area type="monotone" dataKey="expenses" stroke="#FF3B30" strokeWidth={2.5} fill="url(#gradExp)" name="expenses" />
                                    <Legend />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>

                    <div className="analytics-grid-2">
                        {/* Expenses by Category */}
                        <ChartCard title="Expenses by Category" subtitle="Spending breakdown">
                            {!data.expensesByCategory?.length ? <EmptyChart icon="Tag" message="No expense data for this period" /> : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie
                                            data={data.expensesByCategory.map(e => ({ name: e.name || 'Uncategorized', value: Number(e.amount) }))}
                                            cx="50%" cy="50%" innerRadius={60} outerRadius={88} paddingAngle={4} dataKey="value"
                                        >
                                            {data.expensesByCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={chartStyle.contentStyle} formatter={v => [fmt(v), 'Expense']} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>

                        {/* Purchase vs Sales Revenue */}
                        <ChartCard title="Purchase vs Sales" subtitle="Spend vs earned comparison">
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={[
                                    { name: 'Revenue', value: data.monthlyRevenue || 0, fill: '#30D158' },
                                    { name: 'Purchases', value: data.purchaseTotal || 0, fill: '#FF9F0A' },
                                    { name: 'Expenses', value: data.totalExpenses || 0, fill: '#FF3B30' },
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} />
                                    <YAxis axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={v => `₹${v}`} width={70} />
                                    <Tooltip contentStyle={chartStyle.contentStyle} formatter={v => [fmt(v)]} />
                                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                        {[{ fill: '#30D158' }, { fill: '#FF9F0A' }, { fill: '#FF3B30' }].map((entry, i) => (
                                            <Cell key={i} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </div>
                </div>
            )}

            {showDailyReport && <DailyReportModal onClose={() => setShowDailyReport(false)} />}
        </div>
    );
}
