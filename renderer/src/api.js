import { supabase } from './supabase';
import { mazewaySupabase } from './mazewaySupabase';

const API_BASE = 'http://localhost:3001/api';

async function request(endpoint, options = {}) {
    const url = endpoint.startsWith('/auth') ? `http://localhost:3001${endpoint}` : `${API_BASE}${endpoint}`;
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const res = await fetch(url, config);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || `Request failed (${res.status})`);
        }

        return data;
    } catch (err) {
        // Network errors (no backend running)
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
            console.error('[API] Backend not reachable at', API_BASE);
            throw new Error('Backend server is not running. Please restart the application.');
        }
        throw err;
    }
}

function compressBase64Image(base64Str, maxWidth = 300, maxHeight = 150) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (maxHeight / height) * width;
                height = maxHeight;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            try {
                const compressed = canvas.toDataURL('image/jpeg', 0.75);
                resolve(compressed);
            } catch (err) {
                console.error('[API Sync] Canvas toDataURL failed:', err);
                resolve(base64Str);
            }
        };
        img.onerror = () => resolve(base64Str);
        img.src = base64Str;
    });
}

const api = {
    // Dashboard
    getDashboard: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/dashboard${qs ? '?' + qs : ''}`);
    },

    // Products
    getProducts: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/products${qs ? '?' + qs : ''}`);
    },
    getCategories: () => request('/products/categories'),
    createCategory: (data) => request('/products/categories', { method: 'POST', body: data }),
    updateCategory: (oldName, newName) => request(`/products/categories/${oldName}`, { method: 'PUT', body: { newName } }),
    deleteCategory: (name) => request(`/products/categories/${name}`, { method: 'DELETE' }),
    
    // Hierarchy & Brands
    getSubcategories: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/products/subcategories${qs ? '?' + qs : ''}`);
    },
    createSubcategory: (data) => request('/products/subcategories', { method: 'POST', body: data }),
    updateSubcategory: (id, name) => request(`/products/subcategories/${id}`, { method: 'PUT', body: { name } }),
    deleteSubcategory: (id) => request(`/products/subcategories/${id}`, { method: 'DELETE' }),
    getBrands: () => request('/products/brands'),
    createBrand: (data) => request('/products/brands', { method: 'POST', body: data }),
    deleteBrand: (id) => request(`/products/brands/${id}`, { method: 'DELETE' }),

    createProduct: (data) => request('/products', { method: 'POST', body: data }),
    updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: data }),
    deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

    // Variants
    getVariants: (productId) => request(`/products/${productId}/variants`),
    createVariant: (productId, data) => request(`/products/${productId}/variants`, { method: 'POST', body: data }),
    updateVariant: (id, data) => request(`/products/variants/${id}`, { method: 'PUT', body: data }),
    deleteVariant: (id) => request(`/products/variants/${id}`, { method: 'DELETE' }),

    // Inventory Extensions
    getStockAlerts: () => request('/products/alerts/stock'),
    getStockMovements: (productId) => request(`/products/${productId}/movements`),
    adjustStock: (productId, data) => request(`/products/${productId}/adjust`, { method: 'POST', body: data }),
    getProductBatches: (productId) => request(`/products/${productId}/batches`),
    addProductBatch: (productId, data) => request(`/products/${productId}/batches`, { method: 'POST', body: data }),
    deleteProductBatch: (productId, batchId) => request(`/products/${productId}/batches/${batchId}`, { method: 'DELETE' }),
    getProductSerials: (productId) => request(`/products/${productId}/serials`),
    addProductSerial: (productId, data) => request(`/products/${productId}/serials`, { method: 'POST', body: data }),
    deleteProductSerial: (serialId) => request(`/products/serials/${serialId}`, { method: 'DELETE' }),
    getInventoryValuation: () => request('/products/valuation'),
    getReorderSuggestions: () => request('/products/reorders'),
    createReorderBills: (items) => request('/products/reorders/create-bills', { method: 'POST', body: { items } }),
    getAdjustmentsHistory: () => request('/products/adjustments'),
    createBulkAdjustment: (data) => request('/products/adjustments', { method: 'POST', body: data }),
    getBundleItems: (productId) => request(`/products/${productId}/bundle-items`),
    saveBundleItems: (productId, items) => request(`/products/${productId}/bundle-items`, { method: 'POST', body: { items } }),

    // Invoices
    getInvoices: () => request('/invoices'),
    getInvoice: (id) => request(`/invoices/${id}`),
    getInvoiceLogs: (id) => request(`/invoices/${id}/logs`),
    createInvoice: (data) => request('/invoices', { method: 'POST', body: data }),
    deleteInvoice: (id) => request(`/invoices/${id}`, { method: 'DELETE' }),
    mergeInvoices: (data) => request('/invoices/merge', { method: 'POST', body: data }),
    returnInvoice: (id, data) => request(`/invoices/${id}/return`, { method: 'POST', body: data }),
    updateInvoicePayment: (id, data) => request(`/invoices/${id}/payment`, { method: 'PUT', body: data }),
    fulfillInvoice: (id, data) => request(`/invoices/${id}/fulfill`, { method: 'POST', body: data }),
    processAdvance: (id) => request(`/invoices/${id}/process-advance`, { method: 'POST' }),
    getPendingItems: () => request('/invoices/pending-items'),

    // Customers
    getCustomers: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/customers${qs ? '?' + qs : ''}`);
    },
    createCustomer: (data) => request('/customers', { method: 'POST', body: data }),
    updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PUT', body: data }),
    deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
    getCustomerCommunicationLogs: (id) => request(`/customers/${id}/communication-logs`),
    createCustomerCommunicationLog: (id, data) => request(`/customers/${id}/communication-logs`, { method: 'POST', body: data }),
    deleteCustomerCommunicationLog: (id, logId) => request(`/customers/${id}/communication-logs/${logId}`, { method: 'DELETE' }),
    getCustomerPurchases: (id) => request(`/customers/${id}/purchases`),

    // Coupons (Marketing)
    getCoupons: () => request('/coupons'),
    createCoupon: (data) => request('/coupons', { method: 'POST', body: data }),
    deleteCoupon: (id) => request(`/coupons/${id}`, { method: 'DELETE' }),
    applyCoupon: (data) => request('/coupons/apply', { method: 'POST', body: data }),

    // Settings
    getSettings: async () => {
        const settings = await request('/settings');
        if (settings) {
            localStorage.setItem('maze_currency', settings.default_currency || 'INR');
            localStorage.setItem('maze_language', settings.invoice_language || 'en');

            // Auto-heal/compress oversized logo in local DB to prevent sync limits from omitting it
            if (settings.logo_url && settings.logo_url.startsWith('data:image/') && settings.logo_url.length > 100000) {
                console.log('[API Settings Sync] Auto-compressing oversized settings logo...');
                try {
                    const compressed = await compressBase64Image(settings.logo_url);
                    if (compressed && compressed.length < settings.logo_url.length) {
                        settings.logo_url = compressed;
                        // Fire-and-forget background update to save compressed logo to SQLite db
                        request('/settings', { method: 'POST', body: { logo_url: compressed } })
                            .then(() => console.log('[API Settings Sync] Compressed settings logo successfully saved locally.'))
                            .catch(err => console.error('[API Settings Sync] Failed to save compressed logo settings:', err));
                    }
                } catch (e) {
                    console.error('[API Settings Sync] Failed to compress logo on load:', e);
                }
            }
        }
        return settings;
    },
    updateSettings: async (data) => {
        const settings = await request('/settings', { method: 'POST', body: data });
        if (settings) {
            localStorage.setItem('maze_currency', settings.default_currency || 'INR');
            localStorage.setItem('maze_language', settings.invoice_language || 'en');
        }
        return settings;
    },

    // Suppliers
    getSuppliers: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/suppliers${qs ? '?' + qs : ''}`);
    },
    createSupplier: (data) => request('/suppliers', { method: 'POST', body: data }),
    updateSupplier: (id, data) => request(`/suppliers/${id}`, { method: 'PUT', body: data }),
    deleteSupplier: (id) => request(`/suppliers/${id}`, { method: 'DELETE' }),

    // Purchases
    getPurchases: () => request('/purchases'),
    getPurchase: (id) => request(`/purchases/${id}`),
    createPurchase: (data) => request('/purchases', { method: 'POST', body: data }),
    paySupplier: (supplierId, data) => request(`/purchases/suppliers/${supplierId}/pay`, { method: 'POST', body: data }),
    returnPurchase: (id, data) => request(`/purchases/${id}/return`, { method: 'POST', body: data }),
    uploadPurchaseInvoice: (imageBase64) => request('/purchases/upload-invoice', { method: 'POST', body: { image: imageBase64 } }),

    // Expenses
    getExpenses: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/expenses${qs ? '?' + qs : ''}`);
    },
    getExpenseCategories: () => request('/expenses/categories'),
    createExpense: (data) => request('/expenses', { method: 'POST', body: data }),
    deleteExpense: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),

    // Data Management
    exportData: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/data/export${qs ? '?' + qs : ''}`);
    },
    importData: (data) => request('/data/import', { method: 'POST', body: { data } }),
    deleteDataByCategory: (categories) => request('/data/delete', { method: 'POST', body: { categories } }),
    getBackups: () => request('/data/backups'),
    getDataPaths: () => request('/data/paths'),
    updateBackupCycle: (cycle) => request('/data/backup-cycle', { method: 'POST', body: { cycle } }),
    backupNow: () => request('/data/backup-now', { method: 'POST' }),
    restoreBackup: (filename) => request('/data/restore-backup', { method: 'POST', body: { filename } }),
    deleteBackup: async (filename) => {
        // 1. Delete Local Backup
        await request('/data/delete-backup', { method: 'POST', body: { filename } });

        // 2. Delete from ERP Cloud Table (Project waywrispbgbtnppusikg)
        const { error: err1 } = await supabase
            .from('cloud_backups')
            .delete()
            .eq('filename', filename);
        if (err1) console.warn('Failed to delete from ERP Cloud:', err1);

        // 3. Delete from Mazeway AI Table (Project uzmxrijlntgmbqqqhsbl)
        const { error: err2 } = await mazewaySupabase
            .from('mazeway_knowledge_backups')
            .delete()
            .eq('filename', filename);
        if (err2) console.warn('Failed to delete from Mazeway AI:', err2);

        return true;
    },
    getBackupContent: (filename) => request(`/data/backup-content?filename=${filename}`),

    // Reports
    getDailyReport: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/reports/daily${qs ? '?' + qs : ''}`);
    },

    // Cloud Backups (Supabase)
    // Cloud Storage (Original Project - waywrispbgbtnppusikg)
    uploadBackupToStorage: async (filename, data) => {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        const { data: result, error } = await supabase
            .from('cloud_backups')
            .insert([{
                filename: filename,
                backup_data: data,
                user_id: userId,
                created_at: new Date().toISOString()
            }]);
        
        if (error) {
            console.error('[Supabase Table Error]', error);
            if (error.message.includes('row-level security')) {
                throw new Error('Cloud Sync is blocked by the Supabase cloud_backups RLS policy. Make sure you have run the SQL to allow inserts.');
            }
            throw new Error(error.message || 'Cloud database sync failed');
        }
        return result;
    },

    // Mazeway AI Knowledge Base (AI Project - uzmxrijlntgmbqqqhsbl)
    pushBackupToMazewayAI: async (filename, data) => {
        let recordCount = 0;
        // Handle both direct backup objects and wrapped export objects
        const actualData = data.data || data;
        
        if (actualData) {
            Object.values(actualData).forEach(tableData => {
                if (Array.isArray(tableData)) recordCount += tableData.length;
            });
        }

        // Extract correct user_id from Mazeway Webhook URL in settings
        const settings = await api.getSettings();
        const webhookUrl = settings.mazeway_webhook_url;
        let userId = null;
        
        if (webhookUrl && webhookUrl.includes('/webhook/')) {
            const parts = webhookUrl.split('/');
            userId = parts[parts.length - 1];
        }

        // Fallback to session ID if webhook not configured
        if (!userId) {
            const { data: { session } } = await supabase.auth.getSession();
            userId = session?.user?.id;
        }

        const { data: result, error } = await mazewaySupabase
            .from('mazeway_knowledge_backups')
            .insert([{
                filename: filename,
                file_content: data,
                user_id: userId,
                record_count: recordCount,
                fetched_at: new Date().toISOString()
            }]);
        
        if (error) {
            console.error('[Supabase AI Table Error]', error);
            throw new Error(error.message || 'AI Knowledge sync failed');
        }
        return result;
    },

    // Mazeway Integration
    getMazewayAuthUrl: () => request('/mazeway/handshake'),
    getMazewayOrders: () => request('/mazeway/orders'),
    updateMazewayOrderStatus: (id, status) => request(`/mazeway/orders/${id}/status`, { method: 'PUT', body: { status } }),
    prepareMazewayKnowledgeData: async () => {
        const [productsRaw, customersRaw, agentsRaw] = await Promise.all([
            api.getProducts({ limit: 10000 }),
            api.getCustomers({ limit: 10000 }),
            api.getAgents()
        ]);

        const products = Array.isArray(productsRaw) ? productsRaw : (productsRaw?.items || []);
        const customers = Array.isArray(customersRaw) ? customersRaw : (customersRaw?.items || []);
        const agents = Array.isArray(agentsRaw) ? agentsRaw : [];
        const pushedAt = new Date().toISOString();

        const inventory = products.map((p) => ({
            product_id: p.id,
            product_name: p.name,
            sku: p.product_code || p.sku || null,
            stock_qty: Number(p.stock_quantity ?? p.stock ?? 0),
            category: p.category || null,
            price: Number(p.selling_price ?? p.price ?? 0),
            updated_at: p.updated_at || p.created_at || null
        }));

        return [
            {
                entity: 'inventory',
                pushed_at: pushedAt,
                records: inventory
            },
            {
                entity: 'products',
                pushed_at: pushedAt,
                records: products
            },
            {
                entity: 'customers',
                pushed_at: pushedAt,
                records: customers
            },
            {
                entity: 'agents',
                pushed_at: pushedAt,
                records: agents
            }
        ];
    },
    syncMazewayKnowledge: async (mazewayApiKey) => {
        if (!window.navigator.onLine) {
            throw new Error('You are offline. Connect to internet to sync with Mazeway.');
        }
        if (!mazewayApiKey) {
            throw new Error('Mazeway API key is missing. Add it in Settings first.');
        }

        const payload = await api.prepareMazewayKnowledgeData();
        const res = await fetch('https://mazeway.up.railway.app/api/erp/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': mazewayApiKey
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            let errorText = `Mazeway sync failed (${res.status})`;
            try {
                const errJson = await res.json();
                errorText = errJson?.error || errJson?.message || errorText;
            } catch {
                // no-op: keep fallback error message
            }
            throw new Error(errorText);
        }

        return {
            pushedAt: new Date().toISOString(),
            entities: payload.length
        };
    },
    pushBackupToMazeway: async (filename, mazewayApiKey) => {
        if (!window.navigator.onLine) {
            throw new Error('You are offline. Connect to internet to sync with Mazeway.');
        }
        if (!mazewayApiKey) {
            throw new Error('Mazeway API key is missing. Add it in Settings first.');
        }

        const backupData = await api.getBackupContent(filename);
        const res = await fetch('https://mazeway.up.railway.app/api/erp/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': mazewayApiKey
            },
            body: JSON.stringify({
                type: 'backup_push',
                filename: filename,
                data: backupData
            })
        });

        if (!res.ok) {
            let errorText = `Backup push failed (${res.status})`;
            try {
                const errJson = await res.json();
                errorText = errJson?.error || errJson?.message || errorText;
            } catch {
                // no-op
            }
            throw new Error(errorText);
        }

        return { success: true };
    },
    createMazewayAgent: async (agentData, mazewayApiKey) => {
        const res = await fetch('https://mazeway.up.railway.app/api/erp/provision-agent', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-api-key': mazewayApiKey
            },
            body: JSON.stringify(agentData)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Provisioning failed');
        }
        return res.json();
    },
    
    // --- Agent Local Persistence ---
    getAgents: () => request('/mazeway/agents'),
    saveAgent: (agent) => request('/mazeway/agents', { method: 'POST', body: agent }),
    deleteAgent: (id) => request(`/mazeway/agents/${id}`, { method: 'DELETE' }),
    syncAgentKnowledgeBase: (agentId) => request(`/mazeway/agents/${agentId}/kb-sync`, { method: 'POST' }),
    getMazewayStats: () => request('/mazeway/stats'),
    getMazewayLogs: () => request('/mazeway/logs'),

    // --- Gmail OAuth Integration ---
    getGmailConnections: () => request('/auth/google/connections'),
    disconnectGmail: (email) => request('/auth/google/disconnect', { method: 'POST', body: { email } }),
    sendTestEmail: (data) => request('/auth/google/test-email', { method: 'POST', body: data }),
    sendInvoiceEmail: (data) => request('/auth/google/send-invoice', { method: 'POST', body: data }),
    getCampaigns: () => request('/auth/google/campaigns'),
    scheduleCampaign: (data) => request('/auth/google/campaigns', { method: 'POST', body: data }),
    cancelCampaign: (id) => request(`/auth/google/campaigns/${id}`, { method: 'DELETE' }),
    getVoiceCampaignProgress: (id) => request(`/auth/google/campaigns/${id}/voice-progress`),

    // --- WhatsApp Integration ---
    getWhatsAppConnections: () => request('/auth/whatsapp/connections'),
    disconnectWhatsApp: (phone_number_id) => request('/auth/whatsapp/disconnect', { method: 'POST', body: { phone_number_id } }),
    sendWhatsAppTest: (data) => request('/auth/whatsapp/test-message', { method: 'POST', body: data }),
    sendWhatsAppInvoice: (data) => request('/auth/whatsapp/send-invoice', { method: 'POST', body: data }),
    getInvoiceShareLink: (invoiceId) => request(`/invoices/${invoiceId}/share-link`),
    
    // --- Billing ---
    getBillingStatus: () => request('/billing/status'),
    addPaymentMethod: (data) => request('/billing/add-payment-method', { method: 'POST', body: data }),
    buyPhoneNumber: () => request('/billing/buy-number', { method: 'POST' }),
    buyEmailPackage: () => request('/billing/buy-email-package', { method: 'POST' }),
    payDues: () => request('/billing/pay-dues', { method: 'POST' }),
    simulateBillingDay: (day) => request('/billing/simulate-day', { method: 'POST', body: { day } }),
    upgradeSubscription: (plan) => request('/billing/upgrade', { method: 'POST', body: { plan } }),
    cancelSubscription: () => request('/billing/cancel-subscription', { method: 'POST' }),
    removePaymentMethod: () => request('/billing/remove-payment-method', { method: 'POST' }),
    sendCancellationCode: () => request('/billing/send-cancellation-code', { method: 'POST' }),
    confirmCancellation: (code) => request('/billing/confirm-cancellation', { method: 'POST', body: { code } }),
};

export default api;
