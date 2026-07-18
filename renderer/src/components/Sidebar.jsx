import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { APP_COMPANY, APP_NAME, APP_VERSION, PURCHASES_LABEL } from '../constants';
import { supabase } from '../supabase';
import { Icons } from './Icons';
import api from '../api';
import './Sidebar.css';

const navItems = [
    {
        to: '/',
        label: 'Dashboard',
        icon: <Icons.Layout size={20} />
    },
    {
        to: '/inventory',
        label: 'Inventory',
        icon: <Icons.Package size={20} />
    },
    {
        to: '/sales',
        label: 'Sales',
        icon: <Icons.ShoppingCart size={20} />
    },
    {
        to: '/customers',
        label: 'Customers',
        icon: <Icons.Users size={20} />
    },
    {
        to: '/purchase',
        label: PURCHASES_LABEL,
        icon: <Icons.FileText size={20} />
    },
    {
        to: '/automation',
        label: 'Automation',
        icon: <Icons.Cpu size={20} />
    },
    {
        to: '/billing',
        label: 'Billing',
        icon: <Icons.CreditCard size={20} />
    },
    {
        to: '/settings',
        label: 'Settings',
        icon: <Icons.Settings size={20} />
    }
];

export default function Sidebar({ isCollapsed, setIsCollapsed }) {
    const [user, setUser] = useState(null);
    const [settings, setSettings] = useState(null);

    useEffect(() => {
        const loadSettings = () => {
            api.getSettings().then(setSettings).catch(console.error);
        };
        loadSettings();
        window.addEventListener('settings-updated', loadSettings);
        return () => window.removeEventListener('settings-updated', loadSettings);
    }, []);

    useEffect(() => {
        // Get initial user
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

    const renderSubscriptionBadge = () => {
        const plan = settings?.license_plan || 'Free';
        
        let label = 'Free Starter';
        let shieldColor = '#cd7f32'; // Bronze
        let badgeBg = 'rgba(205, 127, 50, 0.1)';
        let badgeBorder = 'rgba(205, 127, 50, 0.2)';
        let hasUpgrade = true;
        let ShieldIcon = <Icons.Shield size={13} style={{ color: shieldColor }} />;

        if (plan === 'Pro') {
            label = 'Business PRO';
            shieldColor = '#ffd700'; // Gold
            badgeBg = 'rgba(255, 215, 0, 0.1)';
            badgeBorder = 'rgba(255, 215, 0, 0.2)';
            hasUpgrade = true;
            ShieldIcon = <Icons.ShieldCheck size={13} style={{ color: shieldColor }} />;
        } else if (plan === 'Professional') {
            label = 'AI Professional';
            shieldColor = '#00d4ff'; // Diamond Cyan
            badgeBg = 'rgba(0, 212, 255, 0.1)';
            badgeBorder = 'rgba(0, 212, 255, 0.2)';
            hasUpgrade = false;
            ShieldIcon = (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={shieldColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M6 3h12l4 6-10 13L2 9z" />
                </svg>
            );
        }

        const handleUpgradeClick = (e) => {
            e.stopPropagation();
            if (window.maze && typeof window.maze.openExternal === 'function') {
                window.maze.openExternal('https://quantro-web.onrender.com/pricing');
            } else {
                window.open('https://quantro-web.onrender.com/pricing', '_blank');
            }
        };

        if (isCollapsed) {
            return (
                <div 
                    onClick={hasUpgrade ? handleUpgradeClick : undefined}
                    title={`${label} (Click to Upgrade)`}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        width: '28px', 
                        height: '28px', 
                        borderRadius: '8px', 
                        background: badgeBg, 
                        border: `1px solid ${badgeBorder}`,
                        margin: '0 auto 12px auto',
                        cursor: hasUpgrade ? 'pointer' : 'default',
                        position: 'relative'
                    }}
                >
                    {ShieldIcon}
                    {hasUpgrade && (
                        <div style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--accent)', borderRadius: '50%', width: '10px', height: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icons.ArrowUpRight size={7} style={{ color: '#fff' }} />
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div 
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '6px 10px', 
                    borderRadius: '8px', 
                    background: badgeBg, 
                    border: `1px solid ${badgeBorder}`,
                    marginBottom: '12px',
                    width: '100%'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {ShieldIcon}
                    <span style={{ fontSize: '11px', fontWeight: 700, color: shieldColor, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                        {label}
                    </span>
                </div>
                {hasUpgrade && (
                    <button 
                        onClick={handleUpgradeClick}
                        style={{ 
                            background: 'none', 
                            border: 'none', 
                            padding: 0, 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            color: 'var(--text-secondary)',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = shieldColor}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                        title="Upgrade Subscription Plan"
                    >
                        <Icons.ArrowUpRight size={14} />
                    </button>
                )}
            </div>
        );
    };

    return (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-brand" onClick={() => setIsCollapsed(!isCollapsed)} title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
                <div className="sidebar-logo">
                    <img src="./icons/Logo.png" alt={APP_NAME} className="sidebar-logo-img" />
                    <div className="sidebar-logo-hover-icon">
                        {isCollapsed ? <Icons.ChevronRight size={22} strokeWidth={3} /> : <Icons.ChevronLeft size={22} strokeWidth={3} />}
                    </div>
                </div>
                <div className="sidebar-brand-text">
                    <span className="sidebar-brand-name">{APP_NAME}</span>
                    <span className="sidebar-brand-sub">{APP_COMPANY}</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                        title={isCollapsed ? item.label : ''}
                    >
                        <div className="sidebar-link-icon">{item.icon}</div>
                        <span className="sidebar-link-label">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-footer-content">
                    {renderSubscriptionBadge()}
                    <div className="sidebar-footer-info" style={{ justifyContent: 'space-between', width: '100%', display: 'flex', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="user-avatar-wrapper circular" title={userName}>
                                {userAvatar ? (
                                    <img src={userAvatar} alt="Profile" className="user-avatar-img" />
                                ) : (
                                    <div className="user-avatar-placeholder">
                                        <Icons.User size={20} strokeWidth={2} />
                                    </div>
                                )}
                            </div>
                            <span className="user-name" style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{userName}</span>
                        </div>
                        <span className="app-version" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>v{APP_VERSION}</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
