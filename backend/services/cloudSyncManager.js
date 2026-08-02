const { createClient } = require('@supabase/supabase-js');
const db = require('../db');

const supabaseUrl = 'https://waywrispbgbtnppusikg.supabase.co';
const supabaseAnonKey = 'sb_publishable_J4ZoFCETv9sy_gh6m9hZlg_qrTElZDV';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Universal Cloud Sync Manager for Quantro ERP
 * Syncs local SQLite changes directly to Supabase cloud tables.
 */

// 1. PRODUCTS & INVENTORY
async function syncProduct(prod) {
    if (!prod) return;
    try {
        await supabase.from('products').upsert({
            id: prod.id,
            store_id: 1,
            sku: prod.sku || `SKU-${prod.id}`,
            barcode: prod.barcode || '',
            name: prod.name || prod.product_name || 'Product',
            category: prod.category || 'General',
            unit: prod.unit || 'Pcs',
            purchase_price: Number(prod.purchase_price || prod.cost_price || 0),
            selling_price: Number(prod.selling_price || prod.price || 0),
            min_price: Number(prod.min_price || 0),
            tax_rate: Number(prod.gst_percent || prod.tax_rate || 0),
            stock_quantity: Number(prod.stock_quantity || prod.stock || 0),
            min_stock_alert: Number(prod.min_stock_alert || prod.reorder_level || 5),
            is_active: prod.is_active !== undefined ? Boolean(prod.is_active) : true
        });
        console.log(`[Cloud Sync] Product #${prod.id} (${prod.name}) synced.`);
    } catch (err) {
        console.error('[Cloud Sync] Product sync failed:', err.message);
    }
}

// 2. INVOICES & SALES
async function syncInvoice(invoice, items = []) {
    if (!invoice) return;
    try {
        await supabase.from('invoices').upsert({
            id: invoice.id,
            store_id: 1,
            invoice_number: invoice.invoice_number || invoice.invoice_no || `INV-${invoice.id}`,
            customer_id: invoice.customer_id || null,
            customer_name: invoice.customer_name || 'Walk-in Customer',
            date: invoice.created_at ? invoice.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            subtotal: Number(invoice.subtotal || invoice.total_amount || 0),
            discount_amount: Number(invoice.discount_amount || invoice.discount || 0),
            tax_amount: Number(invoice.tax_amount || invoice.gst_amount || 0),
            grand_total: Number(invoice.grand_total || invoice.net_amount || 0),
            paid_amount: Number(invoice.paid_amount || invoice.received_amount || 0),
            due_amount: Number(invoice.due_amount || invoice.balance_due || 0),
            payment_mode: invoice.payment_mode || invoice.payment_method || 'CASH',
            status: invoice.status || 'PAID'
        });

        if (items && items.length > 0) {
            const formattedItems = items.map(item => ({
                invoice_id: invoice.id,
                product_id: item.product_id || null,
                product_name: item.product_name || item.name || 'Item',
                quantity: Number(item.quantity || item.qty || 1),
                unit_price: Number(item.unit_price || item.price || 0),
                discount: Number(item.discount || 0),
                tax_amount: Number(item.tax_amount || 0),
                total: Number(item.total || item.amount || 0)
            }));
            await supabase.from('invoice_items').upsert(formattedItems);
        }
        console.log(`[Cloud Sync] Invoice #${invoice.id} (${invoice.invoice_number}) synced.`);
    } catch (err) {
        console.error('[Cloud Sync] Invoice sync failed:', err.message);
    }
}

// 3. CUSTOMERS
async function syncCustomer(cust) {
    if (!cust) return;
    try {
        await supabase.from('customers').upsert({
            id: cust.id,
            store_id: 1,
            name: cust.name,
            phone: cust.phone || '',
            email: cust.email || '',
            gstin: cust.gstin || '',
            address: cust.address || '',
            outstanding_balance: Number(cust.p_credit_balance || cust.outstanding_balance || 0),
            loyalty_points: Number(cust.loyalty_points || 0)
        });
        console.log(`[Cloud Sync] Customer #${cust.id} (${cust.name}) synced.`);
    } catch (err) {
        console.error('[Cloud Sync] Customer sync failed:', err.message);
    }
}

// 4. SUPPLIERS & VENDORS
async function syncSupplier(supp) {
    if (!supp) return;
    try {
        await supabase.from('suppliers').upsert({
            id: supp.id,
            store_id: 1,
            name: supp.name || supp.company_name || 'Supplier',
            phone: supp.phone || '',
            email: supp.email || '',
            gstin: supp.gstin || '',
            address: supp.address || ''
        });
        console.log(`[Cloud Sync] Supplier #${supp.id} (${supp.name}) synced.`);
    } catch (err) {
        console.error('[Cloud Sync] Supplier sync failed:', err.message);
    }
}

// 5. PURCHASES
async function syncPurchase(pur) {
    if (!pur) return;
    try {
        await supabase.from('purchases').upsert({
            id: pur.id,
            store_id: 1,
            purchase_number: pur.purchase_number || pur.po_number || `PO-${pur.id}`,
            supplier_id: pur.supplier_id || null,
            supplier_name: pur.supplier_name || 'Vendor',
            date: pur.date || new Date().toISOString().split('T')[0],
            grand_total: Number(pur.grand_total || pur.total_amount || 0),
            paid_amount: Number(pur.paid_amount || 0),
            status: pur.status || 'RECEIVED'
        });
        console.log(`[Cloud Sync] Purchase #${pur.id} (${pur.purchase_number}) synced.`);
    } catch (err) {
        console.error('[Cloud Sync] Purchase sync failed:', err.message);
    }
}

// 6. EXPENSES
async function syncExpense(exp) {
    if (!exp) return;
    try {
        await supabase.from('expenses').upsert({
            id: exp.id,
            store_id: 1,
            category: exp.category || 'General',
            description: exp.description || exp.notes || '',
            amount: Number(exp.amount || 0),
            date: exp.date || new Date().toISOString().split('T')[0],
            payment_mode: exp.payment_mode || exp.payment_method || 'CASH'
        });
        console.log(`[Cloud Sync] Expense #${exp.id} synced.`);
    } catch (err) {
        console.error('[Cloud Sync] Expense sync failed:', err.message);
    }
}

// 7. STAFF & PROFILES
async function syncStaff(staff) {
    if (!staff || !staff.email) return;
    try {
        await supabase.from('staff_profiles').upsert({
            store_id: 1,
            email: staff.email,
            full_name: staff.name || staff.full_name || 'Staff',
            role: staff.role || 'CASHIER',
            pin: String(staff.pin || '1234'),
            phone: staff.phone || '',
            avatar_url: staff.avatar_url || '',
            is_active: staff.is_active !== undefined ? Boolean(staff.is_active) : true
        }, { onConflict: 'email' });
        console.log(`[Cloud Sync] Staff Profile (${staff.email}) synced.`);
    } catch (err) {
        console.error('[Cloud Sync] Staff Profile sync failed:', err.message);
    }
}

// 8. APP & BUSINESS SETTINGS
async function syncSettings(settingsObj) {
    if (!settingsObj) return;
    try {
        await supabase.from('app_settings').upsert({
            id: 1,
            store_id: 1,
            business_name: settingsObj.company_name || settingsObj.business_name || 'Quantro Retail',
            gstin: settingsObj.gstin || '',
            place_of_supply: settingsObj.place_of_supply || settingsObj.state || '',
            phone: settingsObj.phone || '',
            email: settingsObj.email || '',
            address: settingsObj.address || '',
            logo_base64: settingsObj.logo_url || settingsObj.logo_base64 || '',
            onboarding_completed: String(settingsObj.onboarding_completed || '1')
        });
        console.log(`[Cloud Sync] Business Settings synced.`);
    } catch (err) {
        console.error('[Cloud Sync] Settings sync failed:', err.message);
    }
}

/**
 * Full Bulk Sync across all local SQLite tables to Supabase Cloud
 * Automatically runs on app startup for existing users with local data.
 */
async function fullBulkSyncAllEntities() {
    try {
        await db.ready;
        console.log('[Cloud Sync] Starting Full System Cloud Synchronization for Local Data...');

        // Products
        const products = db.all('SELECT * FROM products');
        if (products && products.length > 0) {
            for (const p of products) await syncProduct(p);
        }

        // Customers
        const customers = db.all('SELECT * FROM customers');
        if (customers && customers.length > 0) {
            for (const c of customers) await syncCustomer(c);
        }

        // Invoices
        const invoices = db.all('SELECT * FROM invoices');
        if (invoices && invoices.length > 0) {
            for (const inv of invoices) {
                const items = db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [inv.id]);
                await syncInvoice(inv, items);
            }
        }

        // Suppliers
        const suppliers = db.all('SELECT * FROM suppliers');
        if (suppliers && suppliers.length > 0) {
            for (const s of suppliers) await syncSupplier(s);
        }

        // Purchases
        const purchases = db.all('SELECT * FROM purchases');
        if (purchases && purchases.length > 0) {
            for (const pur of purchases) await syncPurchase(pur);
        }

        // Expenses
        const expenses = db.all('SELECT * FROM expenses');
        if (expenses && expenses.length > 0) {
            for (const exp of expenses) await syncExpense(exp);
        }

        // Staff / Employees
        try {
            const staffList = db.all('SELECT * FROM employees');
            if (staffList && staffList.length > 0) {
                for (const st of staffList) await syncStaff(st);
            }
        } catch (_) {}

        // App Settings
        try {
            const settingsRows = db.all('SELECT key, value FROM settings');
            if (settingsRows && settingsRows.length > 0) {
                const settingsMap = {};
                settingsRows.forEach(r => { settingsMap[r.key] = r.value; });
                await syncSettings(settingsMap);
            }
        } catch (_) {}

        console.log('[Cloud Sync] Full System Cloud Synchronization Completed Successfully.');
    } catch (err) {
        console.error('[Cloud Sync] Full Sync encountered an error:', err.message);
/**
 * Pull Live Data from Supabase PostgreSQL Cloud DB and Sync to Local Engine
 * Guarantees that multi-store & multi-device updates appear in real time on all pages.
 */
async function pullFromCloudAndSyncLocal() {
    try {
        await db.ready;

        // 1. PRODUCTS
        try {
            const { data: cloudProducts, error } = await supabase.from('products').select('*');
            if (cloudProducts && Array.isArray(cloudProducts) && !error) {
                for (const p of cloudProducts) {
                    try {
                        db.run(`
                            INSERT INTO products (id, name, sku, category, selling_price, cost_price, stock_quantity, unit, gst_rate)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                name = excluded.name,
                                sku = excluded.sku,
                                category = excluded.category,
                                selling_price = excluded.selling_price,
                                cost_price = excluded.cost_price,
                                stock_quantity = excluded.stock_quantity,
                                unit = excluded.unit,
                                gst_rate = excluded.gst_rate
                        `, [p.id, p.name, p.sku || '', p.category || 'General', Number(p.selling_price || 0), Number(p.cost_price || 0), Number(p.stock_quantity || 0), p.unit || 'Pcs', Number(p.gst_rate || 0)]);
                    } catch (_) {}
                }
            }
        } catch (e) {
            console.warn('[Cloud Pull] Products pull notice:', e.message);
        }

        // 2. CUSTOMERS
        try {
            const { data: cloudCust, error } = await supabase.from('customers').select('*');
            if (cloudCust && Array.isArray(cloudCust) && !error) {
                for (const c of cloudCust) {
                    try {
                        db.run(`
                            INSERT INTO customers (id, name, phone, email, gstin, address, p_credit_balance, loyalty_points)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                name = excluded.name,
                                phone = excluded.phone,
                                email = excluded.email,
                                gstin = excluded.gstin,
                                address = excluded.address,
                                p_credit_balance = excluded.p_credit_balance,
                                loyalty_points = excluded.loyalty_points
                        `, [c.id, c.name, c.phone || '', c.email || '', c.gstin || '', c.address || '', Number(c.outstanding_balance || c.p_credit_balance || 0), Number(c.loyalty_points || 0)]);
                    } catch (_) {}
                }
            }
        } catch (e) {
            console.warn('[Cloud Pull] Customers pull notice:', e.message);
        }

        // 3. SUPPLIERS
        try {
            const { data: cloudSupp, error } = await supabase.from('suppliers').select('*');
            if (cloudSupp && Array.isArray(cloudSupp) && !error) {
                for (const s of cloudSupp) {
                    try {
                        db.run(`
                            INSERT INTO suppliers (id, name, phone, email, gstin, address)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                name = excluded.name,
                                phone = excluded.phone,
                                email = excluded.email,
                                gstin = excluded.gstin,
                                address = excluded.address
                        `, [s.id, s.name, s.phone || '', s.email || '', s.gstin || '', s.address || '']);
                    } catch (_) {}
                }
            }
        } catch (e) {
            console.warn('[Cloud Pull] Suppliers pull notice:', e.message);
        }

        // 4. INVOICES
        try {
            const { data: cloudInv, error } = await supabase.from('invoices').select('*');
            if (cloudInv && Array.isArray(cloudInv) && !error) {
                for (const inv of cloudInv) {
                    try {
                        db.run(`
                            INSERT INTO invoices (id, invoice_number, customer_name, customer_phone, grand_total, payment_mode, status, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                invoice_number = excluded.invoice_number,
                                customer_name = excluded.customer_name,
                                customer_phone = excluded.customer_phone,
                                grand_total = excluded.grand_total,
                                payment_mode = excluded.payment_mode,
                                status = excluded.status
                        `, [inv.id, inv.invoice_number, inv.customer_name || 'Walk-in Customer', inv.customer_phone || '', Number(inv.grand_total || 0), inv.payment_mode || 'CASH', inv.status || 'COMPLETED', inv.created_at || new Date().toISOString()]);
                    } catch (_) {}
                }
            }
        } catch (e) {
            console.warn('[Cloud Pull] Invoices pull notice:', e.message);
        }

        // 5. PURCHASES
        try {
            const { data: cloudPur, error } = await supabase.from('purchases').select('*');
            if (cloudPur && Array.isArray(cloudPur) && !error) {
                for (const pur of cloudPur) {
                    try {
                        db.run(`
                            INSERT INTO purchases (id, purchase_number, supplier_name, date, grand_total, paid_amount, status)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                purchase_number = excluded.purchase_number,
                                supplier_name = excluded.supplier_name,
                                grand_total = excluded.grand_total,
                                paid_amount = excluded.paid_amount,
                                status = excluded.status
                        `, [pur.id, pur.purchase_number || `PO-${pur.id}`, pur.supplier_name || 'Vendor', pur.date || new Date().toISOString().split('T')[0], Number(pur.grand_total || 0), Number(pur.paid_amount || 0), pur.status || 'RECEIVED']);
                    } catch (_) {}
                }
            }
        } catch (e) {
            console.warn('[Cloud Pull] Purchases pull notice:', e.message);
        }

        // 6. EXPENSES
        try {
            const { data: cloudExp, error } = await supabase.from('expenses').select('*');
            if (cloudExp && Array.isArray(cloudExp) && !error) {
                for (const exp of cloudExp) {
                    try {
                        db.run(`
                            INSERT INTO expenses (id, category, description, amount, date, payment_mode)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                category = excluded.category,
                                description = excluded.description,
                                amount = excluded.amount,
                                date = excluded.date,
                                payment_mode = excluded.payment_mode
                        `, [exp.id, exp.category || 'General', exp.description || '', Number(exp.amount || 0), exp.date || new Date().toISOString().split('T')[0], exp.payment_mode || 'CASH']);
                    } catch (_) {}
                }
            }
        } catch (e) {
            console.warn('[Cloud Pull] Expenses pull notice:', e.message);
        }

        // 7. STAFF PROFILES
        try {
            const { data: cloudStaff, error } = await supabase.from('staff_profiles').select('*');
            if (cloudStaff && Array.isArray(cloudStaff) && !error) {
                for (const st of cloudStaff) {
                    try {
                        db.run(`
                            INSERT INTO employees (full_name, email, role, phone, avatar_url, status)
                            VALUES (?, ?, ?, ?, ?, 'ACTIVE')
                            ON CONFLICT(email) DO UPDATE SET
                                full_name = excluded.full_name,
                                role = excluded.role,
                                phone = excluded.phone,
                                avatar_url = excluded.avatar_url
                        `, [st.full_name, st.email.toLowerCase(), st.role || 'CASHIER', st.phone || '', st.avatar_url || '']);
                    } catch (_) {}
                }
            }
        } catch (e) {
            console.warn('[Cloud Pull] Staff pull notice:', e.message);
        }

        // 8. APP SETTINGS
        try {
            const { data: cloudSettings, error } = await supabase.from('app_settings').select('*').maybeSingle();
            if (cloudSettings && !error) {
                if (cloudSettings.business_name) db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('company_name', ?)", [cloudSettings.business_name]);
                if (cloudSettings.gstin) db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('gstin', ?)", [cloudSettings.gstin]);
                if (cloudSettings.phone) db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('phone', ?)", [cloudSettings.phone]);
                if (cloudSettings.email) db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('email', ?)", [cloudSettings.email]);
                if (cloudSettings.logo_base64) db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('logo_url', ?)", [cloudSettings.logo_base64]);
            }
        } catch (e) {}

    } catch (err) {
        console.error('[Cloud Pull] Error pulling live data from Supabase:', err.message);
    }
}

// Initial pull 2 seconds after startup, then push local changes
setTimeout(async () => {
    await pullFromCloudAndSyncLocal();
    await fullBulkSyncAllEntities();
}, 2000);

// Continuous 15-second background cloud sync interval
setInterval(async () => {
    await pullFromCloudAndSyncLocal();
}, 15000);

module.exports = {
    supabase,
    syncProduct,
    syncInvoice,
    syncCustomer,
    syncSupplier,
    syncPurchase,
    syncExpense,
    syncStaff,
    syncSettings,
    fullBulkSyncAllEntities,
    pullFromCloudAndSyncLocal
};
