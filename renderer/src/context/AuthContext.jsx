import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';
import { toast } from 'sonner';

import { supabase } from '../supabase';

const AuthContext = createContext();

const DEFAULT_OWNER = {
    id: 1,
    employee_code: 'EMP-001',
    full_name: 'Primary Admin',
    email: '',
    role: 'OWNER',
    assigned_store_ids: ['*'],
    department: 'Executive',
    designation: 'Business Owner'
};

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const saved = localStorage.getItem('quantro_current_user');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.email === 'admin@quantro.app') parsed.email = '';
                return parsed;
            }
            return DEFAULT_OWNER;
        } catch (e) {
            return DEFAULT_OWNER;
        }
    });

    const [activeStoreId, setActiveStoreId] = useState(() => {
        try {
            const saved = localStorage.getItem('quantro_active_store_id');
            return saved ? saved : '1'; // Default HQ Store ID
        } catch (e) {
            return '1';
        }
    });

    const [stores, setStores] = useState([]);
    const [isChildTerminal, setIsChildTerminal] = useState(() => {
        return localStorage.getItem('quantro_is_child_terminal') === 'true';
    });

    // Sync logged-in Supabase email and Google profile picture into currentUser
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                const userEmail = session.user.email || '';
                const googleAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '';
                setCurrentUser(prev => ({
                    ...(prev || DEFAULT_OWNER),
                    email: userEmail || (prev?.email !== 'admin@quantro.app' ? prev?.email : '') || '',
                    avatar_url: googleAvatar || prev?.avatar_url || '',
                    full_name: prev?.full_name && prev.full_name !== 'Primary Admin' ? prev.full_name : (session.user.user_metadata?.full_name || userEmail.split('@')[0])
                }));
            }
        }).catch(console.error);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                const userEmail = session.user.email || '';
                const googleAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '';
                setCurrentUser(prev => ({
                    ...(prev || DEFAULT_OWNER),
                    email: userEmail || (prev?.email !== 'admin@quantro.app' ? prev?.email : '') || '',
                    avatar_url: googleAvatar || prev?.avatar_url || '',
                    full_name: prev?.full_name && prev.full_name !== 'Primary Admin' ? prev.full_name : (session.user.user_metadata?.full_name || userEmail.split('@')[0])
                }));
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (currentUser) {
            localStorage.setItem('quantro_current_user', JSON.stringify(currentUser));
        } else {
            localStorage.removeItem('quantro_current_user');
        }
    }, [currentUser]);

    useEffect(() => {
        if (activeStoreId) {
            localStorage.setItem('quantro_active_store_id', String(activeStoreId));
        }
    }, [activeStoreId]);

    // Load stores list
    useEffect(() => {
        api.getStores()
            .then(res => {
                if (res.stores) setStores(res.stores);
            })
            .catch(err => console.error('[AuthContext] Load stores failed:', err));
    }, []);

    const login = async (email, password, pin) => {
        try {
            const res = await api.loginStaff({ email, password, pin });
            if (res.user) {
                setCurrentUser(res.user);
                toast.success(`Welcome back, ${res.user.full_name} (${res.user.role})!`);
                return res.user;
            }
        } catch (err) {
            toast.error(err.message || 'Login failed');
            throw err;
        }
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.error('[AuthContext] Supabase signout error:', e);
        }
        setCurrentUser(null);
        localStorage.removeItem('quantro_current_user');
        localStorage.removeItem('quantro_local_session');
        toast.info('Logged out successfully.');
    };

    // Role-based permission evaluation
    const userRole = currentUser?.role || 'OWNER';
    const isOwner = userRole === 'OWNER';
    const isRegionalMgr = userRole === 'REGIONAL_MGR';
    const isStoreMgr = userRole === 'STORE_MGR';
    const isCashier = userRole === 'CASHIER';
    const isInventoryClerk = userRole === 'INVENTORY_CLERK';
    const isAccountant = userRole === 'ACCOUNTANT';

    // Feature Permission Guards
    const canViewNetProfit = isOwner || isAccountant;
    const canViewWholesaleCost = isOwner || isAccountant;
    const canManagePayroll = isOwner;
    const canManageEmployees = isOwner;
    const canManageStores = isOwner;
    const canEditInventory = isOwner || isRegionalMgr || isStoreMgr || isInventoryClerk;
    const canProcessSales = isOwner || isRegionalMgr || isStoreMgr || isCashier;
    const canViewAllStores = isOwner;

    return (
        <AuthContext.Provider value={{
            currentUser,
            userRole,
            activeStoreId,
            setActiveStoreId,
            stores,
            setStores,
            isChildTerminal,
            setIsChildTerminal,
            login,
            logout,
            isOwner,
            isRegionalMgr,
            isStoreMgr,
            isCashier,
            isInventoryClerk,
            isAccountant,
            canViewNetProfit,
            canViewWholesaleCost,
            canManagePayroll,
            canManageEmployees,
            canManageStores,
            canEditInventory,
            canProcessSales,
            canViewAllStores
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
