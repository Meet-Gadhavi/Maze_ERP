const express = require('express');
const router = express.Router();
const db = require('../db');
const { z } = require('zod');
const campaignSyncService = require('../services/email/campaignSyncService');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://waywrispbgbtnppusikg.supabase.co';
const supabaseAnonKey = 'sb_publishable_J4ZoFCETv9sy_gh6m9hZlg_qrTElZDV';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function syncCustomerToSupabase(customerRecord) {
    if (!customerRecord) return;
    try {
        await supabase.from('customers').upsert({
            id: customerRecord.id,
            store_id: 1,
            name: customerRecord.name,
            phone: customerRecord.phone || '',
            email: customerRecord.email || '',
            gstin: customerRecord.gstin || '',
            address: customerRecord.address || '',
            outstanding_balance: Number(customerRecord.p_credit_balance || customerRecord.outstanding_balance || 0),
            loyalty_points: Number(customerRecord.loyalty_points || 0)
        });
        console.log(`[Supabase Sync] Customer #${customerRecord.id} (${customerRecord.name}) pushed to cloud.`);
    } catch (e) {
        console.error('[Supabase Sync] Customer push error:', e.message);
    }
}

async function syncAllCustomersToSupabase() {
    try {
        await db.ready;
        const customers = db.all('SELECT * FROM customers');
        if (customers && customers.length > 0) {
            const rows = customers.map(c => ({
                id: c.id,
                store_id: 1,
                name: c.name,
                phone: c.phone || '',
                email: c.email || '',
                gstin: c.gstin || '',
                address: c.address || '',
                outstanding_balance: Number(c.p_credit_balance || c.outstanding_balance || 0),
                loyalty_points: Number(c.loyalty_points || 0)
            }));
            await supabase.from('customers').upsert(rows);
            console.log(`[Supabase Sync] Bulk pushed ${rows.length} customers to cloud.`);
        }
    } catch (e) {
        console.error('[Supabase Sync] Bulk customer push error:', e.message);
    }
}

// Trigger initial bulk sync
setTimeout(syncAllCustomersToSupabase, 3000);

// C005: Zod validation schema for customer data
const customerSchema = z.object({
    name: z.string().min(1, "Customer name is required").max(100),
    phone: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, "Invalid phone format").optional().or(z.literal('')),
    email: z.string().email("Invalid email format").optional().or(z.literal('')),
    address: z.string().max(500).optional().or(z.literal('')),
    gstin: z.string().max(20).optional().or(z.literal('')),
    tier: z.enum(['A', 'B', 'C']).default('C'),
    credit_limit: z.number().min(0).default(0)
});

/**
 * M007: Shared helper to build validated customer fields from request body.
 * Merges incoming values with existing record (for partial updates).
 */
function buildCustomerFields(body, existing = {}) {
    // Validate with Zod first
    const validated = customerSchema.parse({
        name: (body.name ?? existing.name ?? '').trim(),
        phone: (body.phone ?? existing.phone ?? '').trim(),
        email: (body.email ?? existing.email ?? '').trim(),
        address: (body.address ?? existing.address ?? '').trim(),
        gstin: (body.gstin ?? existing.gstin ?? '').trim(),
        tier: body.tier ?? existing.tier ?? 'C',
        credit_limit: Number(body.credit_limit ?? existing.credit_limit ?? 0)
    });

    return validated;
}

// GET /api/customers
router.get('/', async (req, res, next) => {
    try {
        await db.ready;
        const { search } = req.query;
        let sql = 'SELECT * FROM customers';
        const params = [];

        if (search) {
            sql += ' WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        sql += ' ORDER BY created_at DESC';

        const customers = db.all(sql, params);
        res.json(customers);
    } catch (err) {
        next(err);
    }
});

// GET /api/customers/:id
router.get('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const customer = db.get('SELECT * FROM customers WHERE id = ?', [Number(req.params.id)]);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        res.json(customer);
    } catch (err) {
        next(err);
    }
});

// GET /api/customers/:id/purchases
router.get('/:id/purchases', async (req, res, next) => {
    try {
        await db.ready;
        const invoices = db.all(
            'SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC',
            [Number(req.params.id)]
        );

        const result = invoices.map(inv => ({
            ...inv,
            items: db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [inv.id])
        }));

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// POST /api/customers
router.post('/', async (req, res, next) => {
    try {
        await db.ready;
        const fields = buildCustomerFields(req.body);
        if (!fields.name) return res.status(400).json({ error: 'Customer name is required' });

        const result = db.run(
            'INSERT INTO customers (name, phone, email, address, gstin, tier, credit_limit) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [fields.name, fields.phone, fields.email, fields.address, fields.gstin, fields.tier, fields.credit_limit]
        );

        const customer = db.get('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(customer);

        // Direct push to Supabase customers table & metadata
        syncCustomerToSupabase(customer);
        campaignSyncService.pushMetadata().catch(err => console.error('[Sync] Failed to push metadata on customer create:', err.message));
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        next(err);
    }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const existing = db.get('SELECT * FROM customers WHERE id = ?', [Number(req.params.id)]);
        if (!existing) return res.status(404).json({ error: 'Customer not found' });

        const fields = buildCustomerFields(req.body, existing);
        if (!fields.name) return res.status(400).json({ error: 'Customer name is required' });

        db.run(
            'UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, gstin = ?, tier = ?, credit_limit = ? WHERE id = ?',
            [fields.name, fields.phone, fields.email, fields.address, fields.gstin, fields.tier, fields.credit_limit, Number(req.params.id)]
        );

        const customer = db.get('SELECT * FROM customers WHERE id = ?', [Number(req.params.id)]);
        res.json(customer);

        // Direct push to Supabase customers table & metadata
        syncCustomerToSupabase(customer);
        campaignSyncService.pushMetadata().catch(err => console.error('[Sync] Failed to push metadata on customer update:', err.message));
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        next(err);
    }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await db.ready;
        const existing = db.get('SELECT * FROM customers WHERE id = ?', [Number(req.params.id)]);
        if (!existing) return res.status(404).json({ error: 'Customer not found' });

        db.run('DELETE FROM customers WHERE id = ?', [Number(req.params.id)]);
        res.json({ message: 'Customer deleted', id: Number(req.params.id) });

        // Sync customer metadata to cloud
        campaignSyncService.pushMetadata().catch(err => console.error('[Sync] Failed to push metadata on customer delete:', err.message));
    } catch (err) {
        next(err);
    }
});

// GET /api/customers/:id/communication-logs
router.get('/:id/communication-logs', async (req, res, next) => {
    try {
        await db.ready;
        const logs = db.all(
            'SELECT * FROM customer_communication_logs WHERE customer_id = ? ORDER BY date DESC, id DESC',
            [Number(req.params.id)]
        );
        res.json(logs);
    } catch (err) {
        next(err);
    }
});

// POST /api/customers/:id/communication-logs
router.post('/:id/communication-logs', async (req, res, next) => {
    try {
        await db.ready;
        const customerId = Number(req.params.id);
        const customer = db.get('SELECT id FROM customers WHERE id = ?', [customerId]);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        const logSchema = z.object({
            type: z.enum(['Call', 'Email', 'SMS', 'Meeting', 'Other']),
            notes: z.string().min(1, "Notes are required"),
            date: z.string().optional()
        });

        const validated = logSchema.parse(req.body);
        
        let result;
        if (validated.date) {
            result = db.run(
                'INSERT INTO customer_communication_logs (customer_id, type, notes, date) VALUES (?, ?, ?, ?)',
                [customerId, validated.type, validated.notes, validated.date]
            );
        } else {
            result = db.run(
                'INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, ?, ?)',
                [customerId, validated.type, validated.notes]
            );
        }

        const log = db.get('SELECT * FROM customer_communication_logs WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(log);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        next(err);
    }
});

// DELETE /api/customers/:id/communication-logs/:logId
router.delete('/:id/communication-logs/:logId', async (req, res, next) => {
    try {
        await db.ready;
        const logId = Number(req.params.logId);
        const existing = db.get('SELECT id FROM customer_communication_logs WHERE id = ? AND customer_id = ?', [logId, Number(req.params.id)]);
        if (!existing) return res.status(404).json({ error: 'Communication log not found' });

        db.run('DELETE FROM customer_communication_logs WHERE id = ?', [logId]);
        res.json({ message: 'Communication log deleted', id: logId });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
