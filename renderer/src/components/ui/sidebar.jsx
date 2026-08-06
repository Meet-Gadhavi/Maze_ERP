import React, { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './sidebar.css';

const SidebarContext = createContext({
    state: 'expanded',
    open: true,
    setOpen: () => {},
    toggleSidebar: () => {},
});

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
}

export function SidebarProvider({ defaultOpen = true, open: openProp, onOpenChange: setOpenProp, className = '', style = {}, children, ...props }) {
    const [openState, setOpenState] = useState(defaultOpen);
    const open = openProp ?? openState;
    const setOpen = (value) => {
        const openState = typeof value === 'function' ? value(open) : value;
        if (setOpenProp) {
            setOpenProp(openState);
        } else {
            setOpenState(openState);
        }
    };

    const toggleSidebar = () => {
        setOpen(!open);
    };

    const state = open ? 'expanded' : 'collapsed';

    return (
        <SidebarContext.Provider value={{ state, open, setOpen, toggleSidebar }}>
            <div
                style={{
                    '--sidebar-width': '260px',
                    '--sidebar-width-icon': '68px',
                    display: 'flex',
                    minHeight: '100vh',
                    width: '100vw',
                    ...style
                }}
                className={`sidebar-provider ${state} ${className}`}
                {...props}
            >
                {children}
            </div>
        </SidebarContext.Provider>
    );
}

export function Sidebar({ side = 'left', variant = 'sidebar', collapsible = 'icon', className = '', children, ...props }) {
    const { state } = useSidebar();

    return (
        <aside
            data-state={state}
            data-collapsible={state === 'collapsed' ? collapsible : ''}
            className={`radix-sidebar ${state} ${className}`}
            {...props}
        >
            <div className="radix-sidebar-inner">
                {children}
            </div>
        </aside>
    );
}

export function SidebarHeader({ className = '', children, ...props }) {
    return (
        <div className={`radix-sidebar-header ${className}`} {...props}>
            {children}
        </div>
    );
}

export function SidebarContent({ className = '', children, ...props }) {
    return (
        <div className={`radix-sidebar-content ${className}`} {...props}>
            {children}
        </div>
    );
}

export const SidebarFooter = React.forwardRef(({ className = '', children, ...props }, ref) => {
    return (
        <div ref={ref} className={`radix-sidebar-footer ${className}`} {...props}>
            {children}
        </div>
    );
});
SidebarFooter.displayName = 'SidebarFooter';

export function SidebarGroup({ className = '', children, ...props }) {
    return (
        <div className={`radix-sidebar-group ${className}`} {...props}>
            {children}
        </div>
    );
}

export function SidebarGroupLabel({ className = '', children, ...props }) {
    return (
        <div className={`radix-sidebar-group-label ${className}`} {...props}>
            {children}
        </div>
    );
}

export function SidebarMenu({ className = '', children, ...props }) {
    return (
        <ul className={`radix-sidebar-menu ${className}`} {...props}>
            {children}
        </ul>
    );
}

export function SidebarMenuItem({ className = '', children, ...props }) {
    return (
        <li className={`radix-sidebar-menu-item ${className}`} {...props}>
            {children}
        </li>
    );
}

export function SidebarMenuButton({ asChild = false, isActive = false, className = '', children, ...props }) {
    return (
        <div className={`radix-sidebar-menu-button ${isActive ? 'active' : ''} ${className}`} {...props}>
            {children}
        </div>
    );
}

export function SidebarMenuSub({ className = '', children, ...props }) {
    return (
        <motion.ul 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className={`radix-sidebar-menu-sub ${className}`} 
            {...props}
        >
            {children}
        </motion.ul>
    );
}

export function SidebarMenuSubItem({ className = '', children, ...props }) {
    return (
        <li className={`radix-sidebar-menu-sub-item ${className}`} {...props}>
            {children}
        </li>
    );
}

export function SidebarMenuSubButton({ isActive = false, className = '', children, ...props }) {
    return (
        <div className={`radix-sidebar-menu-sub-button ${isActive ? 'active' : ''} ${className}`} {...props}>
            {children}
        </div>
    );
}

export function SidebarTrigger({ className = '', children, ...props }) {
    const { toggleSidebar } = useSidebar();

    return (
        <button
            type="button"
            className={`radix-sidebar-trigger ${className}`}
            onClick={toggleSidebar}
            title="Toggle Sidebar"
            {...props}
        >
            {children || (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                </svg>
            )}
        </button>
    );
}

export function SidebarRail({ className = '', ...props }) {
    const { toggleSidebar } = useSidebar();
    return (
        <button
            className={`radix-sidebar-rail ${className}`}
            aria-label="Toggle Sidebar Rail"
            onClick={toggleSidebar}
            {...props}
        />
    );
}

export function SidebarInset({ className = '', children, ...props }) {
    return (
        <main className={`radix-sidebar-inset ${className}`} {...props}>
            {children}
        </main>
    );
}
