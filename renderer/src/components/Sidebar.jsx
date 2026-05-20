import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { APP_COMPANY, APP_NAME, APP_VERSION, PURCHASES_LABEL } from '../constants';
import { supabase } from '../supabase';
import { Icons } from './Icons';
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
        to: '/settings',
        label: 'Settings',
        icon: <Icons.Settings size={20} />
    }
];

export default function Sidebar({ isCollapsed, setIsCollapsed }) {
    const [user, setUser] = useState(null);

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
                    <div className="sidebar-footer-info">
                        {!isCollapsed && <span className="sidebar-footer-text">v{APP_VERSION}</span>}
                        <div className="user-avatar-wrapper circular" title={userName}>
                            {userAvatar ? (
                                <img src={userAvatar} alt="Profile" className="user-avatar-img" />
                            ) : (
                                <div className="user-avatar-placeholder">
                                    <Icons.User size={20} strokeWidth={2} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
