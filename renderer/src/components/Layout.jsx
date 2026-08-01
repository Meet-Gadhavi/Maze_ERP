import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import { SidebarProvider, SidebarInset } from './ui/sidebar';
import './Layout.css';

export default function Layout({ children }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Only trigger if Alt is pressed (for navigation)
            if (e.altKey) {
                const key = e.key.toLowerCase();
                
                // Navigation shortcuts
                switch(key) {
                    case 'd': navigate('/'); break;
                    case 'i': navigate('/inventory'); break;
                    case 's': navigate('/sales'); break;
                    case 'c': navigate('/customers'); break;
                    case 'p': navigate('/purchase'); break;
                    case 'h': navigate('/hr-payroll'); break;
                    case 'e': navigate('/settings'); break;
                    case 'k': setIsShortcutsOpen(prev => !prev); break;
                    default: break;
                }
            }

            // Global Esc to close modal
            if (e.key === 'Escape') {
                setIsShortcutsOpen(false);
            }
        };

        const handleOpenShortcuts = () => setIsShortcutsOpen(true);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('open-keyboard-shortcuts', handleOpenShortcuts);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('open-keyboard-shortcuts', handleOpenShortcuts);
        };
    }, [navigate]);

    return (
        <SidebarProvider defaultOpen={!isCollapsed}>
            <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
            <SidebarInset className="layout-content">
                {children}
            </SidebarInset>

            <KeyboardShortcutsModal 
                isOpen={isShortcutsOpen} 
                onClose={() => setIsShortcutsOpen(false)} 
            />
        </SidebarProvider>
    );
}
