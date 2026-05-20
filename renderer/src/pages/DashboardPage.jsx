import { useState, useEffect, useRef } from 'react';
import api from '../api';
import './DashboardPage.css';
import { formatDateShort, formatDate } from '../utils';
import { Icons } from '../components/Icons';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import DailyReportModal from '../components/DailyReportModal';
import SButton from '../components/SButton';

const CHART_COLORS = ['#0071E3', '#28CD41', '#FF9500', '#FF3B30', '#5856D6', '#AF52DE'];
const TIMEFRAME_LABELS = {
    '7days': 'Last 7 Days',
    '2months': '2 Months',
    '6months': '6 Months',
    '12months': '1 Year'
};

export default function DashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('7days');
    // M047: In-memory cache — avoids re-fetching a timeframe already loaded this session
    const cacheRef = useRef({});
    const navigate = useNavigate();
    const [showDailyReport, setShowDailyReport] = useState(false);
    const [settings, setSettings] = useState({});
    const [newVersion, setNewVersion] = useState(null);
    const [isDownloaded, setIsDownloaded] = useState(localStorage.getItem('maze_update_downloaded') === 'true');

    useEffect(() => {
        api.getSettings().then(setSettings).catch(console.error);

        // Check for updates cached state first
        const cachedUpdate = localStorage.getItem('maze_update_available');
        if (cachedUpdate) {
            setNewVersion(cachedUpdate);
        }

        if (!window.maze || !window.maze.updates) return;

        // Perform background check after 3 seconds
        const timeoutId = setTimeout(() => {
            window.maze.updates.check();
        }, 3000);

        const unsubscribeAvailable = window.maze.updates.onAvailable((info) => {
            setNewVersion(info.version);
            localStorage.setItem('maze_update_available', info.version);
            
            // Check if auto-update is enabled
            api.getSettings().then(dbSettings => {
                if (dbSettings.auto_update_enabled === 'true') {
                    console.log('[Maze ERP] Auto-update enabled. Downloading update in background...');
                    window.maze.updates.download();
                }
            }).catch(console.error);
        });

        const unsubscribeNotAvailable = window.maze.updates.onNotAvailable(() => {
            setNewVersion(null);
            setIsDownloaded(false);
            localStorage.removeItem('maze_update_available');
            localStorage.removeItem('maze_update_downloaded');
        });

        const unsubscribeDownloaded = window.maze.updates.onDownloaded((info) => {
            setIsDownloaded(true);
            localStorage.setItem('maze_update_downloaded', 'true');
        });

        return () => {
            clearTimeout(timeoutId);
            unsubscribeAvailable();
            unsubscribeNotAvailable();
            unsubscribeDownloaded();
        };
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [timeframe]);

    async function loadDashboard() {
        // M047: Serve from cache if available
        if (cacheRef.current[timeframe]) {
            setData(cacheRef.current[timeframe]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const result = await api.getDashboard({ range: timeframe });
            cacheRef.current[timeframe] = result; // store in cache
            setData(result);
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading && !data) return <div className="loading">Loading dashboard…</div>;
    if (!data) return <div className="loading">Failed to load dashboard</div>;

    const cards = [
        {
            label: 'Total Products',
            value: data.totalProducts,
            color: 'blue',
            icon: <Icons.Package size={24} />
        },
        {
            label: 'Total Customers',
            value: data.totalCustomers,
            color: 'green',
            icon: <Icons.Users size={24} />
        },
        {
            label: 'Sales Today',
            value: `₹${Number(data.salesToday).toLocaleString('en-IN')}`,
            color: 'orange',
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M8.5 9.99984H15.5M8.5 6.5H15.5M14 18.0002L8.5 13.5002L10 13.5C14.4447 13.5 14.4447 6.5 10 6.5M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )
        },
        {
            label: 'Low Stock Alert',
            value: `${data.lowStockCount} products`,
            color: 'red',
            icon: <Icons.AlertTriangle size={24} />
        }
    ];

    return (
        <div className="dashboard-container">
            {newVersion && (
                <div className="update-banner" style={{
                    background: isDownloaded 
                        ? 'linear-gradient(135deg, #30D158 0%, #1c9e3e 100%)'
                        : 'linear-gradient(135deg, #0071E3 0%, #0056b3 100%)',
                    color: '#fff',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 14px rgba(0, 113, 227, 0.25)',
                    animation: 'slideDown 0.3s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isDownloaded ? <Icons.Check size={18} color="#fff" /> : <Icons.Zap size={18} color="#fff" />}
                        </div>
                        <div>
                            <strong style={{ fontSize: '14px' }}>
                                {isDownloaded ? 'System Update Ready!' : 'System Update Available!'}
                            </strong>
                            <span style={{ fontSize: '13px', marginLeft: '8px', opacity: 0.9 }}>
                                {isDownloaded 
                                    ? `Quantro v${newVersion} has been downloaded. Restart to apply updates.` 
                                    : `Quantro v${newVersion} is ready to install.`}
                            </span>
                        </div>
                    </div>
                    <SButton 
                        type="button"
                        variant="secondary"
                        style={{ 
                            background: '#fff', 
                            color: isDownloaded ? '#30D158' : '#0071E3', 
                            border: 'none', 
                            fontSize: '12px', 
                            fontWeight: 700,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                        onClick={() => {
                            if (isDownloaded && window.maze && window.maze.updates) {
                                window.maze.updates.install();
                            } else {
                                localStorage.setItem('settings_active_tab', 'updates');
                                navigate('/settings');
                            }
                        }}
                    >
                        {isDownloaded ? 'Restart to Update' : 'Install Update'}
                    </SButton>
                </div>
            )}

            <div className="page-header">
                <h1>Dashboard Overview</h1>
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

            <div className="dashboard-cards">
                {cards.map(card => (
                    <div className="stat-card" key={card.label}>
                        <div className="stat-card-content">
                            <div className={`stat-card-icon ${card.color}`}>
                                {card.icon}
                            </div>
                            <div className="stat-card-info">
                                <span className="stat-card-label">{card.label}</span>
                                <span className="stat-card-value">{card.value}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-charts-grid">
                <div className="chart-card main-chart">
                    <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>Sales Trend</h3>
                        <div className="timeframe-selector">
                            <button
                                className={timeframe === '7days' ? 'active' : ''}
                                onClick={() => setTimeframe('7days')}
                                title={TIMEFRAME_LABELS['7days']}
                            >
                                7D
                            </button>
                            <button
                                className={timeframe === '2months' ? 'active' : ''}
                                onClick={() => setTimeframe('2months')}
                                title={TIMEFRAME_LABELS['2months']}
                            >
                                2M
                            </button>
                            <button
                                className={timeframe === '6months' ? 'active' : ''}
                                onClick={() => setTimeframe('6months')}
                                title={TIMEFRAME_LABELS['6months']}
                            >
                                6M
                            </button>
                            <button
                                className={timeframe === '12months' ? 'active' : ''}
                                onClick={() => setTimeframe('12months')}
                                title={TIMEFRAME_LABELS['12months']}
                            >
                                1Y
                            </button>
                        </div>
                    </div>
                    <div className="chart-body" style={{ position: 'relative' }}>
                        {loading && <div className="chart-overlay-loading">Updating...</div>}
                        {/* M019: Show empty state when there's no sales data */}
                        {!loading && (!data.salesOverTime || data.salesOverTime.length === 0) ? (
                            <div className="chart-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: 'var(--text-tertiary)' }}>
                                <Icons.TrendingUp size={40} style={{ opacity: 0.2 }} />
                                <p style={{ margin: 0, fontSize: '14px' }}>No sales data for this period</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={data.salesOverTime}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0071E3" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#8E8E93' }}
                                        dy={10}
                                        tickFormatter={(val) => formatDateShort(val)}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#8E8E93' }}
                                        tickFormatter={(val) => `₹${val}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Sales']}
                                    />
                                    <Area type="monotone" dataKey="total" stroke="#0071E3" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="chart-card side-chart">
                    <div className="chart-header">
                        <h3>Category Distribution</h3>
                    </div>
                    <div className="chart-body" style={{ position: 'relative' }}>
                        {!loading && (!data.categoryDistribution || data.categoryDistribution.length === 0) ? (
                            <div className="chart-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: 'var(--text-tertiary)' }}>
                                <Icons.PieChart size={40} style={{ opacity: 0.2 }} />
                                <p style={{ margin: 0, fontSize: '14px' }}>No categories found</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={data.categoryDistribution?.map(c => ({ ...c, name: c.name || 'Uncategorized' }))}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {(data.categoryDistribution || []).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            <div className="dashboard-bottom-grid">
                <div className="recent-section">
                    {/* M032: Section header with View All link */}
                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ margin: 0 }}>Recent Transactions</h2>
                        <SButton
                            variant="secondary"
                            style={{ fontSize: '13px', gap: '4px' }}
                            onClick={() => navigate('/sales')}
                            title="Go to Sales History"
                        >
                            View All
                        </SButton>
                    </div>
                    <div className="recent-table-wrap">
                        {data.recentTransactions.length === 0 ? (
                            <div className="empty-state">
                                <p>No transactions yet</p>
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Invoice #</th>
                                        <th>Customer</th>
                                        <th>Amount</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.recentTransactions.map(tx => (
                                        <tr key={tx.id}>
                                            <td className="fw-500">INV-{String(tx.id).padStart(4, '0')}</td>
                                            <td>{tx.customer_name || 'Walk-in'}</td>
                                            <td className="fw-600">₹{Number(tx.total).toLocaleString('en-IN')}</td>
                                            <td className="text-secondary">{formatDate(tx.date)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <div className="top-selling-section">
                    <div className="section-header">
                        <h2>Top Selling Products</h2>
                    </div>
                    <div className="top-products-list">
                        {data.topSellingProducts.length === 0 ? (
                            <div className="empty-state mini">
                                <p>No sales data</p>
                            </div>
                        ) : (
                            data.topSellingProducts.map((p, idx) => (
                                <div className="top-product-item" key={idx}>
                                    <div className="tp-rank">{idx + 1}</div>
                                    <div className="tp-info">
                                        <span className="tp-name">{p.name}</span>
                                        <span className="tp-qty">{p.value} units sold</span>
                                    </div>
                                    <div className="tp-bar-wrap">
                                        <div
                                            className="tp-bar"
                                            style={{ width: `${(p.value / data.topSellingProducts[0].value) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {showDailyReport && (
                <DailyReportModal onClose={() => setShowDailyReport(false)} />
            )}
        </div>
    );
}
