import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { APP_COMPANY, APP_NAME, APP_VERSION } from '../constants';
import { Icons } from './Icons';
import { useAuth } from '../context/AuthContext';
import {
    Sidebar as RadixSidebar,
    SidebarHeader,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
    SidebarFooter,
    SidebarRail,
    useSidebar
} from './ui/sidebar';
import './Sidebar.css';

import api from '../api';
import { supabase } from '../supabase';

export default function Sidebar({ isCollapsed, setIsCollapsed }) {
    const location = useLocation();
    const [showStorePopover, setShowStorePopover] = useState(false);
    const [showProfilePopover, setShowProfilePopover] = useState(false);
    const [openCollapsibles, setOpenCollapsibles] = useState({ inventory: true });
    const [settingsLogo, setSettingsLogo] = useState('');
    const [userAvatar, setUserAvatar] = useState('');

    const storePopoverRef = useRef(null);
    const profilePopoverRef = useRef(null);

    const { currentUser, userRole, activeStoreId, setActiveStoreId, stores, canViewAllStores, isChildTerminal, logout } = useAuth();

    useEffect(() => {
        if (currentUser?.avatar_url) {
            setUserAvatar(currentUser.avatar_url);
        }
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                const googleAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '';
                if (googleAvatar) setUserAvatar(googleAvatar);
            }
        }).catch(console.error);
    }, [currentUser]);

    const formatRoleTitle = (roleStr) => {
        const r = (roleStr || 'OWNER').toUpperCase();
        if (r === 'OWNER' || r === 'HQ' || r === 'ADMIN') return isChildTerminal ? 'Child Terminal Admin' : 'Primary Admin';
        if (r === 'STORE_MGR') return 'Store Manager';
        if (r === 'INVENTORY_CLERK') return 'Inventory Clerk';
        if (r === 'CASHIER') return 'Cashier';
        if (r === 'ACCOUNTANT') return 'Accountant';
        return roleStr || 'Primary Admin';
    };

    const userRoleTitle = formatRoleTitle(currentUser?.role || userRole);
    const userDisplayEmail = currentUser?.email || 'admin@quantro.app';

    useEffect(() => {
        api.getSettings().then(s => {
            if (s && s.logo_url) {
                setSettingsLogo(s.logo_url);
            }
        }).catch(console.error);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (storePopoverRef.current && !storePopoverRef.current.contains(e.target)) {
                setShowStorePopover(false);
            }
            if (profilePopoverRef.current && !profilePopoverRef.current.contains(e.target)) {
                setShowProfilePopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleCollapsible = (key) => {
        setOpenCollapsibles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const activeStore = stores.find(s => String(s.id) === String(activeStoreId)) || stores[0];
    const displayLogo = activeStore?.logo_url || settingsLogo;

    const effectiveRole = (userRole || currentUser?.role || 'OWNER').toUpperCase();

    const canAccess = (feature) => {
        if (effectiveRole === 'OWNER' || effectiveRole === 'REGIONAL_MGR' || effectiveRole === 'HQ' || effectiveRole === 'ADMIN') return true;
        if (effectiveRole === 'CASHIER') return feature === 'sales';
        if (effectiveRole === 'INVENTORY_CLERK') return feature === 'dashboard' || feature === 'inventory';
        if (effectiveRole === 'STORE_MGR') return ['dashboard', 'inventory', 'sales', 'customers', 'purchase'].includes(feature);
        if (effectiveRole === 'ACCOUNTANT') return ['dashboard', 'sales', 'purchase', 'hr', 'billing'].includes(feature);
        return true;
    };

    const handleSwitchAccount = async () => {
        setShowProfilePopover(false);
        try {
            await logout();
        } catch (e) {
            console.error('[Logout] Error:', e);
        }
        window.location.hash = '#/auth';
        window.location.reload();
    };

    const getInitials = (name, email) => {
        const target = (name && name !== 'Primary Admin') ? name : (email ? email.split('@')[0] : 'Primary Admin');
        const parts = target.trim().split(/[ ._]/);
        if (parts.length >= 2 && parts[0] && parts[1]) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return target.substring(0, 2).toUpperCase();
    };

    const userInitials = getInitials(currentUser?.full_name, userDisplayEmail);

    return (
        <RadixSidebar className={isCollapsed ? 'collapsed' : ''}>
            {/* Top Sidebar Header (Store / Company Switcher) */}
            <SidebarHeader ref={storePopoverRef} style={{ position: 'relative' }}>
                <button 
                    className="sidebar-header-button"
                    onClick={() => setShowStorePopover(!showStorePopover)}
                    title="Switch Store Branch Outlet"
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className="header-brand-icon" style={{ background: displayLogo ? '#ffffff' : '#2563eb', border: displayLogo ? '1px solid #e2e8f0' : 'none', padding: '2px' }}>
                            {displayLogo ? (
                                <img src={displayLogo} alt="Business Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '6px' }} />
                            ) : (
                                <img src="/icons/Logo.png" alt="Quantro Logo" onError={(e) => { e.target.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '6px' }} />
                            )}
                        </div>
                        {!isCollapsed && (
                            <div className="header-brand-info">
                                <span className="header-brand-title">
                                    {activeStoreId === '*' ? 'All Outlets' : (activeStore?.name || APP_NAME)}
                                </span>
                                <span className="header-brand-sub">
                                    {activeStoreId === '*' ? 'Consolidated HQ View' : (activeStore?.is_hq ? 'Main Warehouse HQ' : `Branch ${activeStore?.store_code || ''}`)}
                                </span>
                            </div>
                        )}
                    </div>
                    {!isCollapsed && (
                        <Icons.ChevronsUpDown size={16} className="header-chevrons" />
                    )}
                </button>

                {showStorePopover && !isCollapsed && (
                    <div className="store-switcher-popover">
                        {canViewAllStores && (
                            <div 
                                className={`popover-store-item ${activeStoreId === '*' ? 'active' : ''}`}
                                onClick={() => { setActiveStoreId('*'); setShowStorePopover(false); }}
                            >
                                ALL STORES CONSOLIDATED (HQ View)
                            </div>
                        )}
                        {stores.map(st => (
                            <div 
                                key={st.id}
                                className={`popover-store-item ${String(activeStoreId) === String(st.id) ? 'active' : ''}`}
                                onClick={() => { setActiveStoreId(String(st.id)); setShowStorePopover(false); }}
                            >
                                {st.is_hq ? <Icons.Building size={14} /> : <Icons.Store size={14} />} {st.name} ({st.store_code})
                            </div>
                        ))}
                    </div>
                )}
            </SidebarHeader>

            {/* Sidebar Main Content & Collapsible Groups */}
            <SidebarContent>
                {/* Group 1: Platform & Commerce */}
                <SidebarGroup>
                    <SidebarGroupLabel>Platform</SidebarGroupLabel>
                    <SidebarMenu>
                        {canAccess('dashboard') && (
                            <SidebarMenuItem>
                                <NavLink to="/" end style={{ width: '100%', textDecoration: 'none' }}>
                                    {({ isActive }) => (
                                        <SidebarMenuButton isActive={isActive} title={isCollapsed ? "Dashboard" : ""}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Icons.Layout size={18} />
                                                {!isCollapsed && <span>Dashboard</span>}
                                            </div>
                                        </SidebarMenuButton>
                                    )}
                                </NavLink>
                            </SidebarMenuItem>
                        )}

                        {canAccess('inventory') && (
                            <SidebarMenuItem>
                                <NavLink to="/inventory" style={{ width: '100%', textDecoration: 'none' }}>
                                    {({ isActive }) => (
                                        <SidebarMenuButton isActive={isActive} title={isCollapsed ? "Inventory" : ""}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Icons.Package size={18} />
                                                {!isCollapsed && <span>Inventory</span>}
                                            </div>
                                        </SidebarMenuButton>
                                    )}
                                </NavLink>
                            </SidebarMenuItem>
                        )}

                        {canAccess('sales') && (
                            <SidebarMenuItem>
                                <NavLink to="/sales" style={{ width: '100%', textDecoration: 'none' }}>
                                    {({ isActive }) => (
                                        <SidebarMenuButton isActive={isActive} title={isCollapsed ? "Sales & Billing" : ""}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Icons.ShoppingCart size={18} />
                                                {!isCollapsed && <span>Sales & Invoices</span>}
                                            </div>
                                        </SidebarMenuButton>
                                    )}
                                </NavLink>
                            </SidebarMenuItem>
                        )}

                        {canAccess('customers') && (
                            <SidebarMenuItem>
                                <NavLink to="/customers" style={{ width: '100%', textDecoration: 'none' }}>
                                    {({ isActive }) => (
                                        <SidebarMenuButton isActive={isActive} title={isCollapsed ? "Customers" : ""}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Icons.Users size={18} />
                                                {!isCollapsed && <span>Customers</span>}
                                            </div>
                                        </SidebarMenuButton>
                                    )}
                                </NavLink>
                            </SidebarMenuItem>
                        )}

                        {canAccess('purchase') && (
                            <SidebarMenuItem>
                                <NavLink to="/purchase" style={{ width: '100%', textDecoration: 'none' }}>
                                    {({ isActive }) => (
                                        <SidebarMenuButton isActive={isActive} title={isCollapsed ? "Purchases" : ""}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Icons.FileText size={18} />
                                                {!isCollapsed && <span>Purchases & Vendors</span>}
                                            </div>
                                        </SidebarMenuButton>
                                    )}
                                </NavLink>
                            </SidebarMenuItem>
                        )}
                    </SidebarMenu>
                </SidebarGroup>

                {/* Group 2: Operations & Workforce */}
                <SidebarGroup>
                    <SidebarGroupLabel>Operations</SidebarGroupLabel>
                    <SidebarMenu>
                        {canAccess('hr') && (
                            <SidebarMenuItem>
                                <NavLink to="/hr-payroll" style={{ width: '100%', textDecoration: 'none' }}>
                                    {({ isActive }) => (
                                        <SidebarMenuButton isActive={isActive} title={isCollapsed ? "HR & Payroll" : ""}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Icons.Briefcase size={18} />
                                                {!isCollapsed && <span>HR & Payroll</span>}
                                            </div>
                                        </SidebarMenuButton>
                                    )}
                                </NavLink>
                            </SidebarMenuItem>
                        )}

                        {canAccess('automation') && (
                            <SidebarMenuItem>
                                <NavLink to="/automation" style={{ width: '100%', textDecoration: 'none' }}>
                                    {({ isActive }) => (
                                        <SidebarMenuButton isActive={isActive} title={isCollapsed ? "Automation" : ""}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Icons.Cpu size={18} />
                                                {!isCollapsed && <span>AI Workflows</span>}
                                            </div>
                                        </SidebarMenuButton>
                                    )}
                                </NavLink>
                            </SidebarMenuItem>
                        )}

                        {canAccess('billing') && (
                            <SidebarMenuItem>
                                <NavLink to="/billing" style={{ width: '100%', textDecoration: 'none' }}>
                                    {({ isActive }) => (
                                        <SidebarMenuButton isActive={isActive} title={isCollapsed ? "Billing" : ""}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Icons.CreditCard size={18} />
                                                {!isCollapsed && <span>Subscription & Usage</span>}
                                            </div>
                                        </SidebarMenuButton>
                                    )}
                                </NavLink>
                            </SidebarMenuItem>
                        )}
                    </SidebarMenu>
                </SidebarGroup>

                {/* Group 3: System & Preferences */}
                {canAccess('settings') && (
                    <SidebarGroup>
                        <SidebarGroupLabel>System</SidebarGroupLabel>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <NavLink to="/settings" style={{ width: '100%', textDecoration: 'none' }}>
                                    {({ isActive }) => (
                                        <SidebarMenuButton isActive={isActive} title={isCollapsed ? "Settings" : ""}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Icons.Settings size={18} />
                                                {!isCollapsed && <span>Settings</span>}
                                            </div>
                                        </SidebarMenuButton>
                                    )}
                                </NavLink>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroup>
                )}
            </SidebarContent>

            {/* Sidebar Bottom Footer (User Staff Card & Popover Menu) */}
            <SidebarFooter ref={profilePopoverRef} style={{ position: 'relative' }}>
                <button 
                    className="sidebar-footer-button"
                    onClick={() => setShowProfilePopover(!showProfilePopover)}
                    title="User Profile & Account Settings"
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className="footer-user-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                            {userAvatar ? (
                                <img src={userAvatar} alt="Google Avatar" onError={() => setUserAvatar('')} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                            ) : (
                                userInitials
                            )}
                        </div>
                        {!isCollapsed && (
                            <div className="footer-user-info">
                                <span className="footer-user-name" style={{ fontWeight: 600 }}>{userRoleTitle}</span>
                                <span className="footer-user-email">{userDisplayEmail}</span>
                            </div>
                        )}
                    </div>
                    {!isCollapsed && (
                        <Icons.ChevronsUpDown size={16} className="footer-chevrons" />
                    )}
                </button>

                {showProfilePopover && !isCollapsed && (
                    <div className="sidebar-profile-popover">
                        <div className="popover-user-header">
                            <div className="popover-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                                {userAvatar ? (
                                    <img src={userAvatar} alt="Google Avatar" onError={() => setUserAvatar('')} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                                ) : (
                                    userInitials
                                )}
                            </div>
                            <div>
                                <div className="popover-user-name">{userRoleTitle}</div>
                                <div className="popover-user-email">{userDisplayEmail}</div>
                            </div>
                        </div>
                        <div className="popover-divider"></div>
                        <div 
                            className="popover-menu-item" 
                            style={{ cursor: 'pointer', color: '#ef4444' }} 
                            onClick={handleSwitchAccount}
                        >
                            <Icons.LogOut size={16} />
                            <span>Switch Account / Logout</span>
                        </div>
                    </div>
                )}
            </SidebarFooter>

            <SidebarRail onClick={() => setIsCollapsed(!isCollapsed)} />
        </RadixSidebar>
    );
}
