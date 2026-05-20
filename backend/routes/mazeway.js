const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

// POST /api/mazeway/webhook - Receive orders from Mazeway
router.post('/webhook', async (req, res) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    // Fetch stored API key from settings
    const storedKeyRow = db.get("SELECT value FROM settings WHERE key = 'mazeway_api_key'");
    const storedKey = storedKeyRow?.value;

    if (!storedKey || apiKey !== storedKey) {
        console.warn('[Mazeway Webhook] Unauthorized attempt with key:', apiKey);
        return res.status(401).json({ error: 'Unauthorized: Invalid Mazeway API Key' });
    }

    const { 
        mazeway_id, 
        customer_name, 
        customer_phone, 
        items, 
        total, 
        notes, 
        type 
    } = req.body;

    if (!mazeway_id) {
        return res.status(400).json({ error: 'Missing mazeway_id' });
    }

    try {
        const sql = `
            INSERT INTO mazeway_orders (
                mazeway_id, customer_name, customer_phone, items, total, notes, type, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW')
        `;
        db.run(sql, [
            mazeway_id, 
            customer_name, 
            customer_phone, 
            JSON.stringify(items), 
            total, 
            notes, 
            type
        ]);
        res.json({ success: true, message: 'Order received' });
    } catch (err) {
        console.error('[Mazeway Webhook Error]', err);
        res.status(500).json({ error: 'Failed to save order' });
    }
});

// GET /api/mazeway/orders - Fetch all Mazeway orders
router.get('/orders', (req, res) => {
    try {
        const orders = db.all('SELECT * FROM mazeway_orders ORDER BY created_at DESC');
        // Parse items JSON
        const parsedOrders = orders.map(o => ({
            ...o,
            items: JSON.parse(o.items || '[]')
        }));
        res.json(parsedOrders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/mazeway/orders/:id/status - Confirm or reject an order
router.put('/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // CONFIRMED, REJECTED

    if (!['CONFIRMED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        db.run('UPDATE mazeway_orders SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /api/mazeway/handshake - Initialize connection and get auth URL
router.get('/handshake', async (req, res) => {
    try {
        await db.ready;

        // Check if database is ready
        if (!db) {
            console.error('[Mazeway Handshake] Database not initialized');
            return res.status(503).json({ error: 'Database is not ready. Please restart the application.' });
        }

        // Generate a random state for security
        const state = crypto.randomBytes(16).toString('hex');

        // Save state to database for validation on callback
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mazeway_handshake_state', ?)", [state]);

        // Construct the Mazeway Auth URL
        // We use the local Express backend endpoint which is 100% reliable for both dev and prod environments
        const callbackUrl = encodeURIComponent('http://localhost:3001/api/mazeway/callback');
        const authUrl = `https://mazeway.up.railway.app/connect?callback=${callbackUrl}&state=${state}`;

        console.log('[Mazeway Handshake] Generated auth URL');
        res.json({ authUrl, state });
    } catch (err) {
        console.error('[Mazeway Handshake Error]', err);
        res.status(500).json({ error: 'Failed to initialize handshake: ' + err.message });
    }
});

// GET /api/mazeway/callback - Handle handshake redirect
router.get('/callback', async (req, res) => {
    const { api_key, webhook_url, status, state } = req.query;

    // Verify state to prevent CSRF/forgery
    const storedStateRow = db.get("SELECT value FROM settings WHERE key = 'mazeway_handshake_state'");
    const storedState = storedStateRow?.value;

    if (!storedState || state !== storedState) {
        return res.status(403).send('<h1>Handshake Failed</h1><p>Security validation failed: Invalid or expired state parameter.</p>');
    }

    // Clear state after use
    db.run("DELETE FROM settings WHERE key = 'mazeway_handshake_state'");

    if (status !== 'connected' || !api_key) {
        return res.send('<h1>Handshake Failed</h1><p>The Mazeway connection was not successful or was cancelled.</p>');
    }

    try {
        await db.ready;
        console.log('[Mazeway Callback] Received params:', { status, has_api_key: !!api_key, has_webhook: !!webhook_url });

        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mazeway_api_key', ?)", [String(api_key)]);
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mazeway_webhook_url', ?)", [String(webhook_url)]);
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mazeway_cloud_enabled', 'true')");
        
        console.log('[Mazeway Callback] Settings saved to database.');
        // Return HTML that notifies the opener and closes the popup
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Mazeway Connected</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f4f7f6; color: #333; }
                    .card { background: white; padding: 40px; border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; max-width: 400px; }
                    .icon { width: 64px; height: 64px; background: #30d158; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: white; font-size: 32px; }
                    h1 { margin: 0 0 10px; font-size: 24px; }
                    p { color: #666; line-height: 1.5; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">✓</div>
                    <h1>Connected!</h1>
                    <p>Your ERP is now linked with Mazeway. This window will close automatically.</p>
                </div>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ 
                            type: 'mazeway-connected', 
                            api_key: '${api_key}', 
                            webhook_url: '${webhook_url}' 
                        }, window.location.origin);
                    }
                    setTimeout(() => {
                        window.close();
                    }, 2000);
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('[Mazeway Callback Error]', err);
        res.status(500).send('<h1>Server Error</h1><p>' + err.message + '</p>');
    }
});

// --- Agent Persistence Routes ---

// GET /api/mazeway/agents - Fetch all local agents
router.get('/agents', (req, res) => {
    try {
        const agents = db.all('SELECT * FROM mazeway_agents ORDER BY created_at DESC');
        const parsedAgents = agents.map(a => ({
            ...a,
            is_active: a.is_active === 1,
            config: JSON.parse(a.config || '{}')
        }));
        res.json(parsedAgents);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/mazeway/agents - Create or Update a local agent
router.post('/agents', (req, res) => {
    const { id, name, type, persona, status, is_active, config } = req.body;
    
    if (!id || !name) {
        return res.status(400).json({ error: 'Missing agent ID or name' });
    }

    try {
        const sql = `
            INSERT OR REPLACE INTO mazeway_agents (id, name, type, persona, status, is_active, config)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(sql, [
            id, name, type, persona, status, 
            is_active ? 1 : 0, 
            JSON.stringify(config || {})
        ]);
        res.json({ success: true });
    } catch (err) {
        console.error('[Agent Save Error]', err);
        res.status(500).json({ error: 'Failed to save agent' });
    }
});

// DELETE /api/mazeway/agents/:id - Remove a local agent
router.delete('/agents/:id', (req, res) => {
    const { id } = req.params;
    try {
        db.run('DELETE FROM mazeway_agents WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/mazeway/logs - Fetch real activity logs from orders
router.get('/logs', (req, res) => {
    try {
        const orders = db.all('SELECT * FROM mazeway_orders ORDER BY created_at DESC LIMIT 20');
        const logs = orders.map(o => {
            const items = JSON.parse(o.items || '[]');
            const itemsList = items.map(i => `${i.quantity}x ${i.name}`).join(', ');
            
            return {
                id: o.id,
                type: o.type || 'Voice',
                status: o.status === 'NEW' ? 'PENDING' : o.status === 'CONFIRMED' ? 'COMPLETED' : 'REJECTED',
                duration: o.type === 'Voice' ? '1:45' : '-', // Fake duration for now as it's not in DB
                timestamp: o.created_at,
                summary: o.notes || `Processed order for ${o.customer_name}. Items: ${itemsList}. Total: ₹${o.total}.`
            };
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/mazeway/stats - Fetch real stats for the Automation Dashboard
router.get('/stats', (req, res) => {
    try {
        const orderStats = db.get(`
            SELECT 
                COUNT(*) as total_leads,
                SUM(CASE WHEN status = 'CONFIRMED' THEN total ELSE 0 END) as total_revenue
            FROM mazeway_orders
        `);

        const agentCount = db.get('SELECT COUNT(*) as count FROM mazeway_agents WHERE is_active = 1').count;

        // Estimate minutes: 5 mins per processed order + 2 mins per active agent (just for demo consistency)
        // In a real system, this would come from call logs.
        const estimatedMinutes = (orderStats.total_leads * 5) + (agentCount * 2);

        res.json({
            totalMinutes: estimatedMinutes.toLocaleString('en-IN'),
            leadsProcessed: (orderStats.total_leads || 0).toLocaleString('en-IN'),
            revenue: (orderStats.total_revenue || 0).toLocaleString('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0
            })
        });
    } catch (err) {
        console.error('[Mazeway Stats Error]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
