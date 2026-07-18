import { useState, useEffect, useRef } from 'react';
import api from '../api';
import './DashboardPage.css';
import { formatDateShort, formatDate } from '../utils';
import { Icons } from '../components/Icons';
import { useNavigate } from 'react-router-dom';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import DailyReportModal from '../components/DailyReportModal';
import SButton from '../components/SButton';
import CustomSelect from '../components/CustomSelect';
import Skeleton from '../components/Skeleton';

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

function ChartCard({ title, subtitle, children, style, action }) {
    return (
        <div className="chart-card" style={style}>
            <div className="chart-header">
                <div>
                    <h3>{title}</h3>
                    {subtitle && <p className="chart-subtitle">{subtitle}</p>}
                </div>
                {action && <div className="chart-action">{action}</div>}
            </div>
            <div className="chart-body">{children}</div>
        </div>
    );
}

function KpiCard({ label, value, sub, color = 'blue', icon, onClick }) {
    return (
        <div className="stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
            {onClick && (
                <div className="stat-card-arrow">
                    <Icons.ArrowUpRight size={15} />
                </div>
            )}
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
    const [selectedSubcatCategory, setSelectedSubcatCategory] = useState('');
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
        <div className="page-content" style={{ padding: '24px' }}>
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div>
                    <div className="skeleton-box skeleton-title" style={{ width: '180px' }} />
                    <div className="skeleton-box skeleton-text" style={{ width: '350px' }} />
                </div>
            </div>
            
            <div className="analytics-mini-kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="skeleton-card" style={{ height: '80px' }} />
                <div className="skeleton-card" style={{ height: '80px' }} />
                <div className="skeleton-card" style={{ height: '80px' }} />
                <div className="skeleton-card" style={{ height: '80px' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
                <div className="skeleton-card" style={{ height: '300px' }}>
                    <div className="skeleton-box skeleton-title" />
                    <div className="skeleton-box skeleton-text" />
                </div>
                <div className="skeleton-card" style={{ height: '300px' }}>
                    <div className="skeleton-box skeleton-title" />
                    <div className="skeleton-box skeleton-text" />
                </div>
            </div>
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

    const subcatCategories = Array.from(new Set(data?.categoryCustomerCount?.map(c => c.name).filter(Boolean) || []));
    const activeSubcatCategory = selectedSubcatCategory || subcatCategories[0] || '';
    const subcatOptions = subcatCategories.map(cat => ({ value: cat, label: cat }));

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Matrix mapping: day -> hour -> { revenue, orders }
    const heatmapMatrix = Array.from({ length: 7 }, () => Array(24).fill(null).map(() => ({ revenue: 0, orders: 0 })));

    let maxRevenue = 0;
    let maxOrders = 0;

    if (data?.peakSellingHours) {
        data.peakSellingHours.forEach(item => {
            const d = item.day ?? 0;
            const h = item.hour ?? 0;
            if (d >= 0 && d < 7 && h >= 0 && h < 24) {
                heatmapMatrix[d][h] = {
                    revenue: Number(item.revenue || 0),
                    orders: Number(item.orders || 0)
                };
                if (Number(item.revenue || 0) > maxRevenue) maxRevenue = Number(item.revenue || 0);
                if (Number(item.orders || 0) > maxOrders) maxOrders = Number(item.orders || 0);
            }
        });
    }

    const getHeatmapColor = (revenue, max) => {
        if (revenue === 0) return '#E5E5EA';
        if (!max || max === 0) return '#0066FF'; // Default blue
        const pct = revenue / max;
        if (pct <= 0.25) return '#D2D9E8'; // lightest: grayish blue
        if (pct <= 0.5) return '#85A8FF';  // light blue
        if (pct <= 0.75) return '#3B6BFF'; // medium blue
        return '#0A2B99';                  // darkest: dark blue
    };

    const filteredSubcategories = (data?.subcategoryCustomerCount || [])
        .filter(item => item.category_name === activeSubcatCategory)
        .map(item => ({
            name: item.name || 'Uncategorized',
            value: item.customer_count
        }));

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
                                <LineChart
                                    xAxis={[{
                                        data: data.salesOverTime.map(d => new Date(d.date)),
                                        scaleType: 'time',
                                        valueFormatter: (value) => formatDateShort(value)
                                    }]}
                                    series={[{
                                        data: data.salesOverTime.map(d => d.total),
                                        area: true,
                                        color: '#0071E3',
                                        showMark: false,
                                        valueFormatter: (v) => `₹${fmt(v)}`
                                    }]}
                                    height={240}
                                    slotProps={{ legend: { hidden: true } }}
                                />
                            )}
                        </ChartCard>

                        <ChartCard title="Orders vs Revenue" subtitle="Invoice count and revenue per day">
                            {loading ? <EmptyChart message="Loading..." /> :
                            !data.ordersVsRevenue?.some(d => d.orders > 0) ? <EmptyChart icon="BarChart2" message="No orders for this period" /> : (
                                <LineChart
                                    xAxis={[{
                                        data: data.ordersVsRevenue.map(d => new Date(d.date)),
                                        scaleType: 'time',
                                        valueFormatter: (value) => formatDateShort(value)
                                    }]}
                                    yAxis={[
                                        { id: 'leftAxis', valueFormatter: (v) => `₹${fmt(v)}` },
                                        { id: 'rightAxis', position: 'right' }
                                    ]}
                                    series={[
                                        {
                                            yAxisKey: 'leftAxis',
                                            data: data.ordersVsRevenue.map(d => d.revenue),
                                            label: 'Revenue',
                                            color: '#0071E3',
                                            showMark: false,
                                            valueFormatter: (v) => `₹${fmt(v)}`
                                        },
                                        {
                                            yAxisKey: 'rightAxis',
                                            data: data.ordersVsRevenue.map(d => d.orders),
                                            label: 'Orders',
                                            color: '#FF9F0A',
                                            showMark: true,
                                            valueFormatter: (v) => `${v} orders`
                                        }
                                    ]}
                                    rightAxis="rightAxis"
                                    height={240}
                                />
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

                        <ChartCard title="Category Sales" subtitle="Revenue breakdown by product category">
                            {(!data.categorySales?.length && !data.categoryDistribution?.length) ? <EmptyChart icon="Tag" message="No category data" /> : (
                            <BarChart
                                dataset={(!data.categorySales?.length ? (data.categoryDistribution || []) : data.categorySales).map(c => ({ name: c.name || 'Uncategorized', value: Number(c.value || 0) }))}
                                yAxis={[{
                                    scaleType: 'band',
                                    dataKey: 'name'
                                }]}
                                xAxis={[{
                                    valueFormatter: (v) => `₹${fmt(v)}`
                                }]}
                                series={[{
                                    dataKey: 'value',
                                    label: 'Revenue',
                                    color: '#AF52DE',
                                    valueFormatter: (v) => `₹${fmt(v)}`
                                }]}
                                layout="horizontal"
                                height={240}
                                margin={{ left: 100 }}
                                slotProps={{ legend: { hidden: true } }}
                            />
                            )}
                        </ChartCard>
                    </div>

                    {/* Peak Hours + Returns */}
                    <div className="analytics-grid-2">
                        <ChartCard title="Peak Selling Hours" subtitle="Activity heatmap by weekday & hour">
                            {!data.peakSellingHours?.some(h => h.revenue > 0) ? <EmptyChart icon="Clock" message="No hourly data available" /> : (
                                <div className="heatmap-container" style={{ padding: '10px 0', overflowX: 'auto' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '400px' }}>
                                        {/* Hour labels at top */}
                                        <div style={{ display: 'flex', paddingLeft: '36px', marginBottom: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                                            {Array.from({ length: 6 }, (_, i) => (
                                                <div key={i} style={{ width: '16.66%', textAlign: 'left' }}>
                                                    {i === 0 ? '12 AM' : i === 3 ? '12 PM' : `${i * 4} ${i < 3 ? 'AM' : 'PM'}`}
                                                </div>
                                            ))}
                                        </div>

                                        {/* 7 Days of the week */}
                                        {days.map((dayLabel, dIdx) => (
                                            <div key={dIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {/* Day label */}
                                                <span style={{ 
                                                    width: '30px', 
                                                    fontSize: '11px', 
                                                    fontWeight: 600, 
                                                    color: 'var(--text-secondary)',
                                                    textAlign: 'right',
                                                    marginRight: '4px'
                                                }}>
                                                    {dayLabel}
                                                </span>

                                                {/* 24 Hours */}
                                                <div style={{ display: 'flex', gap: '4px', flexGrow: 1 }}>
                                                    {hours.map((hourVal, hIdx) => {
                                                        const cell = heatmapMatrix[dIdx][hourVal];
                                                        const color = getHeatmapColor(cell.revenue, maxRevenue);
                                                        const tooltipText = `${dayLabel} at ${hourVal === 0 ? '12 AM' : hourVal === 12 ? '12 PM' : hourVal > 12 ? `${hourVal - 12} PM` : `${hourVal} AM`}\nRevenue: ${fmt(cell.revenue)}\nOrders: ${cell.orders}`;
                                                        
                                                        return (
                                                            <div
                                                                key={hIdx}
                                                                title={tooltipText}
                                                                style={{
                                                                    width: '100%',
                                                                    aspectRatio: '1/1',
                                                                    backgroundColor: color,
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    transition: 'transform 0.15s ease, filter 0.15s ease',
                                                                    border: cell.revenue === 0 ? '1px solid #D1D1D6' : 'none',
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.transform = 'scale(1.25)';
                                                                    e.currentTarget.style.filter = 'brightness(1.2)';
                                                                    e.currentTarget.style.zIndex = '1';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.transform = 'scale(1)';
                                                                    e.currentTarget.style.filter = 'none';
                                                                    e.currentTarget.style.zIndex = '0';
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}

                                        {/* Heatmap Legend */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                            <span>Less</span>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#E5E5EA', border: '1px solid #D1D1D6' }} />
                                                <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#D2D9E8' }} />
                                                <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#85A8FF' }} />
                                                <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#3B6BFF' }} />
                                                <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#0A2B99' }} />
                                            </div>
                                            <span>More</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </ChartCard>

                        <ChartCard title="Return / Refund Analytics" subtitle="Returns count and amount over period">
                            {!data.returnAnalytics?.some(r => r.count > 0) ? <EmptyChart icon="RotateCcw" message="No returns in this period" /> : (
                                <LineChart
                                    xAxis={[{
                                        data: data.returnAnalytics.map(d => new Date(d.date)),
                                        scaleType: 'time',
                                        valueFormatter: (value) => formatDateShort(value)
                                    }]}
                                    series={[{
                                        data: data.returnAnalytics.map(d => d.amount),
                                        label: 'Refund Amount',
                                        color: '#FF3B30',
                                        showMark: true,
                                        valueFormatter: (v) => `₹${fmt(v)}`
                                    }]}
                                    height={220}
                                    slotProps={{ legend: { hidden: true } }}
                                />
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
                                        <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: 'var(--success)' }}>Fast Moving</p>
                                        {(data.fastMoving || []).map((p, i) => (
                                            <div key={i} className="top-product-item">
                                                <div className="tp-rank" style={{ background: 'rgba(48,209,88,0.1)', color: 'var(--success)' }}>{i + 1}</div>
                                                <div className="tp-info"><span className="tp-name">{p.name}</span><span className="tp-qty">{p.sold} units</span></div>
                                                <div className="tp-bar-wrap"><div className="tp-bar" style={{ width: `${Math.max(8, (p.sold / Math.max(1, data.fastMoving[0]?.sold)) * 100)}%`, background: 'var(--success)' }} /></div>
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: 'var(--warning)' }}>Slow Moving</p>
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

                    {/* Stock Movement Trend (Wide) */}
                    <div className="analytics-grid-2" style={{ marginTop: '24px' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                            <ChartCard title="Stock Movement Trend" subtitle="Inventory in vs out over period">
                                {!data.stockMovementTrend?.some(d => d.stock_in > 0 || d.stock_out > 0) ? <EmptyChart icon="ArrowUpDown" message="No stock movements recorded" /> : (
                                    <ResponsiveContainer width="100%" height={240}>
                                        <LineChart data={data.stockMovementTrend}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} tickFormatter={formatDateShort} />
                                            <YAxis axisLine={false} tickLine={false} tick={chartStyle.axisTickStyle} />
                                            <Tooltip contentStyle={chartStyle.contentStyle} labelFormatter={formatDate} />
                                            <Line type="monotone" dataKey="stock_in" stroke="#30D158" strokeWidth={2.5} dot={true} name="Stock IN" />
                                            <Line type="monotone" dataKey="stock_out" stroke="#FF3B30" strokeWidth={2.5} dot={true} name="Stock OUT" />
                                            <Legend />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>
                        </div>
                    </div>

                    {/* Category-wise & Subcategory Selling (Side-by-side) */}
                    <div className="analytics-grid-2" style={{ marginTop: '24px' }}>
                        <ChartCard title="Category-wise Selling" subtitle="Unique customers buying from each category">
                            {!data.categoryCustomerCount?.length ? <EmptyChart icon="Tag" message="No sales data for this period" /> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
                                    {/* SVG Funnel */}
                                    <svg viewBox="0 0 500 130" width="100%" height="135" style={{ display: 'block', overflow: 'visible' }}>
                                        {(() => {
                                            const sortedCategoryCustomers = (data.categoryCustomerCount || [])
                                                .map(c => ({ name: c.name || 'Uncategorized', value: Number(c.customer_count || 0) }))
                                                .sort((a, b) => b.value - a.value);
                                            const numSegments = Math.min(5, sortedCategoryCustomers.length);
                                            const W = 500;
                                            const H = 120;
                                            const g = 3;
                                            const segW = W / numSegments;
                                            
                                            // Pre-calculate heights
                                            const heights = [];
                                            const maxVal = sortedCategoryCustomers[0]?.value || 1;
                                            for (let i = 0; i <= numSegments; i++) {
                                                if (i < numSegments) {
                                                    const val = sortedCategoryCustomers[i].value;
                                                    // Scale between 25px and 100px
                                                    heights.push(Math.max(25, (val / maxVal) * 90));
                                                } else {
                                                    heights.push(12); // The tail ending height
                                                }
                                            }

                                            // Funnel Segment Colors: Blue, Red, Orange, Yellow, Green
                                            const funnelColors = ['#0071E3', '#FF2D55', '#FF9F0A', '#FFCC00', '#30D158'];

                                            return Array.from({ length: numSegments }).map((_, i) => {
                                                const cat = sortedCategoryCustomers[i];
                                                const x_start = i * segW + g;
                                                const x_end = (i + 1) * segW - g;
                                                const hl = heights[i];
                                                const hr = heights[i + 1];
                                                const y_l = hl / 2;
                                                const y_r = hr / 2;
                                                const center = H / 2;

                                                const color = funnelColors[i % funnelColors.length];
                                                const pathData = `M ${x_start} ${center - y_l} C ${(x_start + x_end)/2} ${center - y_l}, ${(x_start + x_end)/2} ${center - y_r}, ${x_end} ${center - y_r} L ${x_end} ${center + y_r} C ${(x_start + x_end)/2} ${center + y_r}, ${(x_start + x_end)/2} ${center + y_l}, ${x_start} ${center + y_l} Z`;

                                                return (
                                                    <g key={i}>
                                                        <path
                                                            d={pathData}
                                                            fill={color}
                                                            style={{
                                                                cursor: 'pointer',
                                                                transition: 'filter 0.2s ease, opacity 0.2s ease',
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.filter = 'brightness(1.15) drop-shadow(0px 4px 8px rgba(0,0,0,0.15))';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.filter = 'none';
                                                            }}
                                                        >
                                                            <title>{`${cat.name}\nCustomers: ${cat.value}`}</title>
                                                        </path>
                                                        {/* Value text indicator inside the segment if it's wide enough */}
                                                        {hl > 35 && (
                                                            <text
                                                                x={(x_start + x_end) / 2}
                                                                y={center + 4}
                                                                textAnchor="middle"
                                                                fill="#FFFFFF"
                                                                style={{ fontSize: '10px', fontWeight: 'bold', pointerEvents: 'none', fillOpacity: 0.9 }}
                                                            >
                                                                {cat.value}
                                                            </text>
                                                        )}
                                                    </g>
                                                );
                                            });
                                        })()}
                                    </svg>

                                    {/* Legend below */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginTop: '4px' }}>
                                        {(() => {
                                            const sortedCategoryCustomers = (data.categoryCustomerCount || [])
                                                .map(c => ({ name: c.name || 'Uncategorized', value: Number(c.customer_count || 0) }))
                                                .sort((a, b) => b.value - a.value);
                                            const funnelColors = ['#0071E3', '#FF2D55', '#FF9F0A', '#FFCC00', '#30D158'];
                                            return sortedCategoryCustomers.slice(0, 5).map((cat, i) => {
                                                const color = funnelColors[i % funnelColors.length];
                                                return (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }}></span>
                                                        <span style={{ 
                                                            color: 'var(--text-primary)', 
                                                            overflow: 'hidden', 
                                                            textOverflow: 'ellipsis', 
                                                            whiteSpace: 'nowrap',
                                                            fontWeight: 500 
                                                        }} title={cat.name}>
                                                            {cat.name}
                                                        </span>
                                                        <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto', fontSize: '11px' }}>
                                                            ({cat.value})
                                                        </span>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}
                        </ChartCard>

                        <ChartCard 
                            title="Subcategory Selling Analytics" 
                            subtitle="Unique customers per subcategory"
                            action={
                                subcatOptions.length > 0 && (
                                    <div style={{ width: '160px' }}>
                                        <CustomSelect
                                            value={activeSubcatCategory}
                                            options={subcatOptions}
                                            onChange={(val) => setSelectedSubcatCategory(val)}
                                        />
                                    </div>
                                )
                            }
                        >
                            {!filteredSubcategories.length ? (
                                <EmptyChart icon="PieChart" message="No subcategory sales in this category" />
                            ) : (
                                <BarChart
                                    dataset={filteredSubcategories}
                                    yAxis={[{
                                        scaleType: 'band',
                                        dataKey: 'name'
                                    }]}
                                    xAxis={[{
                                        valueFormatter: (v) => `${v}`
                                    }]}
                                    series={[{
                                        dataKey: 'value',
                                        label: 'Sales',
                                        color: '#0071E3',
                                        valueFormatter: (v) => `${v}`
                                    }]}
                                    layout="horizontal"
                                    height={240}
                                    margin={{ left: 80 }}
                                    slotProps={{ legend: { hidden: true } }}
                                />
                            )}
                        </ChartCard>
                    </div>
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
                                <PieChart
                                    series={[{
                                        data: [
                                            { id: 0, value: data.repeatVsNew?.repeat || 0, label: 'Repeat Customers', color: '#0071E3' },
                                            { id: 1, value: data.repeatVsNew?.new || 0, label: 'New Customers', color: '#30D158' }
                                        ],
                                        innerRadius: 60,
                                        outerRadius: 85,
                                        paddingAngle: 4,
                                        cx: '50%',
                                        cy: '50%'
                                    }]}
                                    height={240}
                                    slotProps={{ legend: { position: { vertical: 'bottom', horizontal: 'center' } } }}
                                />
                            )}
                        </ChartCard>
                    </div>

                    <div className="analytics-grid-2">
                        {/* Customer Growth */}
                        <ChartCard title="Customer Growth" subtitle="New customers over time">
                            {!data.customerGrowth?.some(d => d.new_customers > 0) ? <EmptyChart icon="UserPlus" message="No new customers in this period" /> : (
                                <BarChart
                                    dataset={data.customerGrowth}
                                    xAxis={[{
                                        scaleType: 'band',
                                        dataKey: 'date',
                                        valueFormatter: (value) => formatDateShort(value)
                                    }]}
                                    series={[{
                                        dataKey: 'new_customers',
                                        label: 'New Customers',
                                        color: '#30D158',
                                        valueFormatter: (v) => `${v} customers`
                                    }]}
                                    height={220}
                                    slotProps={{ legend: { hidden: true } }}
                                />
                            )}
                        </ChartCard>

                        {/* Invoice Status Distribution */}
                        <ChartCard title="Invoice Status" subtitle="Payment status breakdown for period">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 8px' }}>
                                {[
                                    { name: 'Paid', value: data.duesByStatus?.Paid || 0, color: '#30D158' },
                                    { name: 'Partial', value: data.duesByStatus?.Partial || 0, color: '#FF9F0A' },
                                    { name: 'Unpaid', value: data.duesByStatus?.Unpaid || 0, color: '#FF3B30' }
                                ].map((item, idx) => {
                                    const totalStatusVal = (data.duesByStatus?.Paid || 0) + (data.duesByStatus?.Partial || 0) + (data.duesByStatus?.Unpaid || 0);
                                    const pct = totalStatusVal > 0 ? ((item.value / totalStatusVal) * 100).toFixed(1) : 0;
                                    return (
                                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                                                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }}></span>
                                                    {item.name}
                                                </span>
                                                <span style={{ color: 'var(--text-secondary)' }}>
                                                    <strong>{item.value}</strong> ({pct}%)
                                                </span>
                                            </div>
                                            <div style={{ height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${pct}%`, backgroundColor: item.color, borderRadius: '4px', transition: 'width 0.4s ease' }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
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
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', padding: '8px 0' }}>
                                    {data.paymentMethodBreakdown.map((p, idx) => {
                                        const amount = Number(p.total);
                                        const method = p.method || 'Cash';
                                        return (
                                            <div key={idx} style={{ 
                                                background: 'rgba(255, 255, 255, 0.05)', 
                                                border: '1px solid var(--border)', 
                                                borderRadius: '12px', 
                                                padding: '16px', 
                                                display: 'flex', 
                                                flexDirection: 'column', 
                                                gap: '8px',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></span>
                                                    <strong>{method}</strong>
                                                </div>
                                                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(amount)}</span>
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.count} transactions</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ChartCard>

                        {/* Payment Method by Count */}
                        <ChartCard title="Transactions by Method" subtitle="Number of transactions per payment type">
                            {!data.paymentMethodBreakdown?.length ? <EmptyChart icon="CreditCard" message="No payment data" /> : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie
                                            data={data.paymentMethodBreakdown.map(p => ({ name: p.method || 'Cash', value: p.count }))}
                                            cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value"
                                        >
                                            {data.paymentMethodBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={chartStyle.contentStyle} formatter={v => [v, 'Transactions']} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                                    </PieChart>
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px 8px' }}>
                                    {[
                                        { name: 'AI Orders', value: data.aiVsManual?.aiOrders || 0, color: '#5856D6', icon: 'Zap' },
                                        { name: 'Manual Orders', value: data.aiVsManual?.manualOrders || 0, color: '#0071E3', icon: 'User' }
                                    ].map((item, idx) => {
                                        const totalVal = (data.aiVsManual?.aiOrders || 0) + (data.aiVsManual?.manualOrders || 0);
                                        const pct = totalVal > 0 ? ((item.value / totalVal) * 100).toFixed(1) : 0;
                                        return (
                                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', background: `${item.color}15`, color: item.color }}>
                                                            {item.icon === 'Zap' ? <Icons.Zap size={14} /> : <Icons.User size={14} />}
                                                        </span>
                                                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{item.name}</span>
                                                    </div>
                                                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                        <strong>{item.value}</strong> ({pct}%)
                                                    </span>
                                                </div>
                                                <div style={{ height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${pct}%`, backgroundColor: item.color, borderRadius: '4px' }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ChartCard>

                        {/* Voice vs WhatsApp */}
                        <ChartCard title="Channel Distribution" subtitle="Voice vs WhatsApp agent orders">
                            {(!data.aiStats?.voiceCount && !data.aiStats?.whatsappCount) ? <EmptyChart icon="Activity" message="No AI orders yet" /> : (
                                <PieChart
                                    series={[{
                                        data: [
                                            { id: 0, value: data.aiStats?.voiceCount || 0, label: 'Voice', color: '#5856D6' },
                                            { id: 1, value: data.aiStats?.whatsappCount || 0, label: 'WhatsApp', color: '#30D158' }
                                        ],
                                        innerRadius: 65,
                                        outerRadius: 90,
                                        paddingAngle: 4,
                                        cx: '50%',
                                        cy: '50%'
                                    }]}
                                    height={260}
                                    slotProps={{ legend: { position: { vertical: 'bottom', horizontal: 'center' } } }}
                                />
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
                            <LineChart
                                xAxis={[{
                                    data: data.aiOrdersByDay.map(d => new Date(d.date)),
                                    scaleType: 'time',
                                    valueFormatter: (value) => formatDateShort(value)
                                }]}
                                series={[{
                                    data: data.aiOrdersByDay.map(d => d.count),
                                    label: 'AI Orders',
                                    color: '#5856D6',
                                    showMark: true,
                                    valueFormatter: (v) => `${v} orders`
                                }]}
                                height={220}
                                slotProps={{ legend: { hidden: true } }}
                            />
                        )}
                    </ChartCard>

                    {/* Email Analytics Section */}
                    <div style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Email Delivery Analytics</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Delivery stats and account usage for connected Gmail automation services.</p>
                            </div>
                            <SButton variant="secondary" onClick={() => navigate('/automation')} style={{ fontSize: '12px', padding: '6px 12px' }}>
                                Manage Gmail
                            </SButton>
                        </div>

                        {/* Email KPI Row */}
                        <div className="analytics-mini-kpi-row" style={{ marginBottom: '24px' }}>
                            <div className="mini-kpi-card">
                                <span className="mini-kpi-label">Total Emails Sent</span>
                                <span className="mini-kpi-value">{data.emailStats?.totalEmailsSent || 0}</span>
                                <span className="mini-kpi-sub">In selected period</span>
                            </div>
                            <div className="mini-kpi-card">
                                <span className="mini-kpi-label">Active Connections</span>
                                <span className="mini-kpi-value">{data.emailStats?.activeAccountsCount || 0}</span>
                                <span className="mini-kpi-sub">Connected senders</span>
                            </div>
                        </div>

                        <div className="analytics-grid-2">
                            {/* Usage by Account Card */}
                            <ChartCard title="Usage by Account" subtitle="Daily email limit utilization">
                                {!data.emailStats?.connections || data.emailStats.connections.length === 0 ? (
                                    <EmptyChart icon="Mail" message="No connected Gmail accounts" />
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px' }}>
                                        {data.emailStats.connections.map((conn, idx) => {
                                            const percent = Math.min(100, Math.round((conn.emails_sent_today / (conn.emailsLimit || 1000)) * 100));
                                            return (
                                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                                                            {conn.email}
                                                        </span>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                            {conn.emails_sent_today} / {conn.emailsLimit || 1000} Sent
                                                        </span>
                                                    </div>
                                                    <div style={{ width: '100%', height: '8px', background: 'var(--bg-soft)', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${percent}%`, height: '100%', background: percent > 85 ? 'var(--danger)' : 'var(--accent)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </ChartCard>

                            <ChartCard title="Email Dispatches" subtitle="Daily email delivery volume">
                                {!data.emailStats?.dailyTrends?.some(t => t.count > 0) ? (
                                    <EmptyChart icon="Send" message="No emails sent in this period" />
                                ) : (
                                    <LineChart
                                        xAxis={[{
                                            data: data.emailStats.dailyTrends.map(d => new Date(d.date)),
                                            scaleType: 'time',
                                            valueFormatter: (value) => formatDateShort(value)
                                        }]}
                                        series={[{
                                            data: data.emailStats.dailyTrends.map(d => d.count),
                                            area: true,
                                            color: '#0071E3',
                                            showMark: false,
                                            valueFormatter: (v) => `${v} emails`
                                        }]}
                                        height={260}
                                        slotProps={{ legend: { hidden: true } }}
                                    />
                                )}
                            </ChartCard>
                        </div>
                    </div>

                    {/* WhatsApp Analytics Section */}
                    <div style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>WhatsApp Delivery Analytics</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Delivery stats and account usage for connected Meta WhatsApp Cloud API services.</p>
                            </div>
                            <SButton variant="secondary" onClick={() => navigate('/automation')} style={{ fontSize: '12px', padding: '6px 12px' }}>
                                Manage WhatsApp
                            </SButton>
                        </div>

                        {/* WhatsApp KPI Row */}
                        <div className="analytics-mini-kpi-row" style={{ marginBottom: '24px' }}>
                            <div className="mini-kpi-card">
                                <span className="mini-kpi-label">Total WhatsApp Sent</span>
                                <span className="mini-kpi-value">{data.whatsappStats?.totalSent || 0}</span>
                                <span className="mini-kpi-sub">In selected period</span>
                            </div>
                            <div className="mini-kpi-card">
                                <span className="mini-kpi-label">Active WhatsApp Channels</span>
                                <span className="mini-kpi-value">{data.whatsappStats?.activeChannelsCount || 0}</span>
                                <span className="mini-kpi-sub">Connected phone IDs</span>
                            </div>
                        </div>

                        <div className="analytics-grid-2">
                            {/* Usage by Phone ID Card */}
                            <ChartCard title="Usage by Phone ID" subtitle="Daily WhatsApp message limit utilization">
                                {!data.whatsappStats?.connections || data.whatsappStats.connections.length === 0 ? (
                                    <EmptyChart icon="MessageSquare" message="No connected WhatsApp accounts" />
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px' }}>
                                        {data.whatsappStats.connections.map((conn, idx) => {
                                            const percent = Math.min(100, Math.round((conn.messages_sent_today / (conn.messagesLimit || 1800)) * 100));
                                            return (
                                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                                                            Phone ID: {conn.phone_number_id}
                                                        </span>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                            {conn.messages_sent_today} / {conn.messagesLimit || 1800} Sent
                                                        </span>
                                                    </div>
                                                    <div style={{ width: '100%', height: '8px', background: 'var(--bg-soft)', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${percent}%`, height: '100%', background: percent > 85 ? 'var(--danger)' : '#25D366', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </ChartCard>

                            <ChartCard title="WhatsApp Dispatches" subtitle="Daily WhatsApp message volume">
                                {!data.whatsappStats?.dailyTrends?.some(t => t.count > 0) ? (
                                    <EmptyChart icon="MessageSquare" message="No WhatsApp messages sent in this period" />
                                ) : (
                                    <LineChart
                                        xAxis={[{
                                            data: data.whatsappStats.dailyTrends.map(d => new Date(d.date)),
                                            scaleType: 'time',
                                            valueFormatter: (value) => formatDateShort(value)
                                        }]}
                                        series={[{
                                            data: data.whatsappStats.dailyTrends.map(d => d.count),
                                            area: true,
                                            color: '#25D366',
                                            showMark: false,
                                            valueFormatter: (v) => `${v} messages`
                                        }]}
                                        height={260}
                                        slotProps={{ legend: { hidden: true } }}
                                    />
                                )}
                            </ChartCard>
                        </div>
                    </div>
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
                            <span className="mini-kpi-value">
                                {fmt(
                                    (data.salesOverTime ? data.salesOverTime.reduce((sum, item) => sum + (item.total || 0), 0) : 0) - 
                                    (data.totalExpenses || 0)
                                )}
                            </span>
                            <span className="mini-kpi-sub">{TIMEFRAME_LABELS[timeframe]}</span>
                        </div>
                    </div>

                    {/* Revenue vs Expenses */}
                    <ChartCard title="Revenue vs Expenses" subtitle="Overlay comparison over the period">
                        {!data.revenueVsExpenses?.some(d => d.revenue > 0 || d.expenses > 0) ? <EmptyChart icon="BarChart2" message="No financial data for this period" /> : (
                            <LineChart
                                xAxis={[{
                                    data: data.revenueVsExpenses.map(d => new Date(d.date)),
                                    scaleType: 'time',
                                    valueFormatter: (value) => formatDateShort(value)
                                }]}
                                series={[
                                    {
                                        data: data.revenueVsExpenses.map(d => d.revenue),
                                        label: 'Revenue',
                                        color: '#0071E3',
                                        showMark: true,
                                        valueFormatter: (v) => `₹${fmt(v)}`
                                    },
                                    {
                                        data: data.revenueVsExpenses.map(d => d.expenses),
                                        label: 'Expenses',
                                        color: '#FF3B30',
                                        showMark: true,
                                        valueFormatter: (v) => `₹${fmt(v)}`
                                    }
                                ]}
                                height={260}
                            />
                        )}
                    </ChartCard>

                    <div className="analytics-grid-2">
                        {/* Expenses by Category */}
                        <ChartCard title="Expenses by Category" subtitle="Spending breakdown">
                            {!data.expensesByCategory?.length ? <EmptyChart icon="Tag" message="No expense data for this period" /> : (
                                <BarChart
                                    dataset={data.expensesByCategory.map(e => ({ name: e.name || 'Uncategorized', value: Number(e.amount) }))}
                                    yAxis={[{
                                        scaleType: 'band',
                                        dataKey: 'name'
                                    }]}
                                    xAxis={[{
                                        valueFormatter: (v) => `₹${fmt(v)}`
                                    }]}
                                    series={[{
                                        dataKey: 'value',
                                        label: 'Expense',
                                        color: '#FF3B30',
                                        valueFormatter: (v) => `₹${fmt(v)}`
                                    }]}
                                    layout="horizontal"
                                    height={260}
                                    margin={{ left: 100 }}
                                    slotProps={{ legend: { hidden: true } }}
                                />
                            )}
                        </ChartCard>

                        {/* Purchase vs Sales Revenue */}
                        <ChartCard title="Purchase vs Sales" subtitle="Spend vs earned comparison">
                            <BarChart
                                dataset={[
                                    { label: 'Revenue', value: data.monthlyRevenue || 0 },
                                    { label: 'Purchases', value: data.purchaseTotal || 0 },
                                    { label: 'Expenses', value: data.totalExpenses || 0 }
                                ]}
                                xAxis={[{
                                    scaleType: 'band',
                                    dataKey: 'label'
                                }]}
                                yAxis={[{
                                    valueFormatter: (v) => `₹${fmt(v)}`
                                }]}
                                series={[{
                                    dataKey: 'value',
                                    valueFormatter: (v) => `₹${fmt(v)}`,
                                    color: '#0071E3'
                                }]}
                                height={260}
                                slotProps={{ legend: { hidden: true } }}
                            />
                        </ChartCard>
                    </div>
                </div>
            )}

            {showDailyReport && <DailyReportModal onClose={() => setShowDailyReport(false)} />}
        </div>
    );
}
