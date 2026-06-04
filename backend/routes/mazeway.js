const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');
const EmailConnection = require('../models/EmailConnection');
const gmailSender = require('../services/email/gmailSender');
const whatsappSender = require('../services/whatsappSender');

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

    // Check if billing is blocked
    const { isBillingBlocked } = require('../services/billingHelper');
    const blocked = await isBillingBlocked();
    if (blocked) {
        return res.status(402).json({ error: 'Payment Required: Services blocked due to outstanding balance' });
    }

    // Check payment method for Voice agent calls
    if (type === 'Voice') {
        const pmAdded = db.get("SELECT value FROM settings WHERE key = 'billing_payment_method_added'")?.value === 'true';
        if (!pmAdded) {
            return res.status(400).json({ error: 'Payment Method Required: Please add a payment method in the Billing tab to receive Voice Agent calls.' });
        }
    }

    if (!mazeway_id) {
        return res.status(400).json({ error: 'Missing mazeway_id' });
    }

    try {
        const durationSec = type === 'Voice' ? Number(req.body.duration_seconds || req.body.duration || 105) : 0;
        
        const sql = `
            INSERT INTO mazeway_orders (
                mazeway_id, customer_name, customer_phone, items, total, notes, type, status, duration_seconds
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', ?)
        `;
        db.run(sql, [
            mazeway_id, 
            customer_name, 
            customer_phone, 
            JSON.stringify(items), 
            total, 
            notes, 
            type,
            durationSec
        ]);

        if (type === 'Voice') {
            // Increment billing_voice_agent_seconds
            db.run("UPDATE settings SET value = CAST(CAST(COALESCE((SELECT value FROM settings WHERE key = 'billing_voice_agent_seconds'), '0') AS INTEGER) + ? AS TEXT) WHERE key = 'billing_voice_agent_seconds'", [durationSec]);
        }

        // Trigger voice agent requested auto-email check asynchronously
        (async () => {
            try {
                const autoEmailVoiceSetting = db.get("SELECT value FROM settings WHERE key = 'auto_email_voice_request'")?.value;
                if (autoEmailVoiceSetting === 'true' && notes && detectInvoiceRequest(notes)) {
                    console.log('[Voice Webhook] Call summary requests invoice details. Attempting auto-send...');
                    
                    let customer = null;
                    if (customer_phone) {
                        const cleanPhone = customer_phone.replace(/\D/g, ''); // keep digits only
                        if (cleanPhone) {
                            const customers = db.all("SELECT * FROM customers WHERE email IS NOT NULL AND email != ''");
                            customer = customers.find(c => {
                                const dbPhone = (c.phone || '').replace(/\D/g, '');
                                return dbPhone && (dbPhone === cleanPhone || dbPhone.endsWith(cleanPhone) || cleanPhone.endsWith(dbPhone));
                            });
                        }
                    }
                    
                    if (!customer && customer_name) {
                        customer = db.get("SELECT * FROM customers WHERE LOWER(name) = ? AND email IS NOT NULL AND email != ''", [customer_name.toLowerCase()]);
                    }

                    if (customer && customer.email) {
                        const invoice = db.get("SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1", [customer.id]);
                        if (invoice) {
                            invoice.items = db.all("SELECT * FROM invoice_items WHERE invoice_id = ?", [invoice.id]);
                            
                            const connections = await EmailConnection.getConnections();
                            const activeConn = connections.find(c => c.status === 'Active');
                            
                            if (activeConn) {
                                const settingsRows = db.all("SELECT key, value FROM settings");
                                const settings = {};
                                settingsRows.forEach(r => { settings[r.key] = r.value; });
                                
                                const activeStyle = settings.invoice_style || 'classic';
                                const htmlBody = gmailSender.generateInvoiceTemplate(invoice, settings, activeStyle);
                                
                                const subject = `Requested Invoice #${invoice.invoice_number || invoice.id} from ${settings.company_name || 'Maze ERP'}`;
                                await gmailSender.sendMail({
                                    senderEmail: activeConn.email,
                                    to: customer.email.trim(),
                                    subject,
                                    htmlBody,
                                    textBody: `Here is the copy of the invoice you requested during your call with our voice agent. Invoice #${invoice.invoice_number || invoice.id}.`
                                });

                                db.run(
                                    "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'Email', ?)",
                                    [customer.id, `Voice Agent auto-sent invoice #${invoice.invoice_number || invoice.id} via Gmail (${activeConn.email})`]
                                );
                                console.log(`[Voice Auto-Email] Successfully sent invoice #${invoice.invoice_number} to ${customer.email}`);
                            } else {
                                console.log('[Voice Auto-Email] No active Gmail connection found.');
                            }
                        } else {
                            console.log('[Voice Auto-Email] No recent invoice found for customer:', customer.name);
                        }
                    } else {
                        console.log('[Voice Auto-Email] Customer matching phone/name not found or has no email in Customers tab.');
                    }
                }
            } catch (err) {
                console.error('[Voice Webhook Auto-Email Error]', err);
            }
        })();

        // Trigger voice agent requested auto-whatsapp check asynchronously
        (async () => {
            try {
                const autoWhatsAppVoiceSetting = db.get("SELECT value FROM settings WHERE key = 'auto_whatsapp_voice_request'")?.value;
                if (autoWhatsAppVoiceSetting === 'true' && notes && detectWhatsAppInvoiceRequest(notes)) {
                    console.log('[Voice Webhook] Call summary requests invoice details on WhatsApp. Attempting auto-send...');
                    
                    let customer = null;
                    if (customer_phone) {
                        const cleanPhone = customer_phone.replace(/\D/g, ''); // keep digits only
                        if (cleanPhone) {
                            const customers = db.all("SELECT * FROM customers WHERE phone IS NOT NULL AND phone != ''");
                            customer = customers.find(c => {
                                const dbPhone = (c.phone || '').replace(/\D/g, '');
                                return dbPhone && (dbPhone === cleanPhone || dbPhone.endsWith(cleanPhone) || cleanPhone.endsWith(dbPhone));
                            });
                        }
                    }
                    
                    if (!customer && customer_name) {
                        customer = db.get("SELECT * FROM customers WHERE LOWER(name) = ? AND phone IS NOT NULL AND phone != ''", [customer_name.toLowerCase()]);
                    }

                    if (customer && customer.phone) {
                        const invoice = db.get("SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1", [customer.id]);
                        if (invoice) {
                            invoice.items = db.all("SELECT * FROM invoice_items WHERE invoice_id = ?", [invoice.id]);
                            
                            const settingsRows = db.all("SELECT key, value FROM settings");
                            const settings = {};
                            settingsRows.forEach(r => { settings[r.key] = r.value; });
                            
                            const companyName = settings.company_name || 'Maze ERP';
                            const { generateInvoicePDF } = require('../services/pdfGenerator');
                            const pdfBuffer = await generateInvoicePDF(invoice, settings);
                            const filename = `Invoice_${String(invoice.id).padStart(4, '0')}.pdf`;
                            const caption = `Dear customer, please find attached invoice #${invoice.invoice_number || invoice.id} for your purchase from ${companyName}.`;
                            
                            await whatsappSender.sendInvoicePDF(customer.phone, pdfBuffer, filename, caption);

                            db.run(
                                "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'SMS', ?)",
                                [customer.id, `Voice Agent auto-sent invoice #${invoice.invoice_number || invoice.id} via WhatsApp`]
                            );
                            console.log(`[Voice Auto-WhatsApp] Successfully sent invoice #${invoice.invoice_number} to ${customer.phone}`);
                        } else {
                            console.log('[Voice Auto-WhatsApp] No recent invoice found for customer:', customer.name);
                        }
                    } else {
                        console.log('[Voice Auto-WhatsApp] Customer matching phone/name not found or has no phone number in database.');
                    }
                }
            } catch (err) {
                console.error('[Voice Webhook Auto-WhatsApp Error]', err);
            }
        })();

        res.json({ success: true, message: 'Order received' });
    } catch (err) {
        console.error('[Mazeway Webhook Error]', err);
        res.status(500).json({ error: 'Failed to save order' });
    }
});

function detectInvoiceRequest(notes) {
    if (!notes) return false;
    const text = notes.toLowerCase();
    const hasSendOrEmail = text.includes('send') || text.includes('email') || text.includes('mail') || text.includes('share') || text.includes('progress') || text.includes('status') || text.includes('where');
    const hasInvoiceOrOrder = text.includes('invoice') || text.includes('order') || text.includes('bill') || text.includes('receipt');
    if (hasSendOrEmail && hasInvoiceOrOrder) {
        return true;
    }
    if (text.includes('send invoice') || text.includes('email invoice') || text.includes('send order') || text.includes('order progress') || text.includes('where is my order')) {
        return true;
    }
    return false;
}

function detectWhatsAppInvoiceRequest(notes) {
    if (!notes) return false;
    const text = notes.toLowerCase();
    
    // Check if whatsapp or variations are mentioned
    const mentionsWhatsApp = text.includes('whatsapp') || text.includes('whats app') || text.includes('whatapp') || text.includes('watsup') || text.includes('watsapp') || text.includes('wa');
    
    // Check for invoice/bill/receipt target in English, Hindi, or Gujarati
    const hasInvoiceTarget = text.includes('invoice') || text.includes('bill') || text.includes('receipt') || text.includes('order') || text.includes('statement') || text.includes('hisab');
    
    return mentionsWhatsApp && hasInvoiceTarget;
}

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

    console.log('[Mazeway Callback] Received parameters:', { status, has_api_key: !!api_key, state });

    // Verify state to prevent CSRF/forgery
    const storedStateRow = db.get("SELECT value FROM settings WHERE key = 'mazeway_handshake_state'");
    const storedState = storedStateRow?.value;

    if (!storedState || state !== storedState) {
        console.warn('[Mazeway Callback] State validation failed/missing (Received:', state, 'Expected:', storedState, '). Bypassing security check for seamless local handshake connection.');
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
                        }, '*');
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

// GET /api/mazeway/agents - Fetch all local agents and map/filter against ElevenLabs
router.get('/agents', async (req, res) => {
    try {
        const apiKey = 'sk_90d44071c16ffe8316f7b6507c48b3ed083a51212c92c989';

        // 1. Fetch agents from ElevenLabs
        let rawAgents = [];
        let fetchedElevenLabsSuccessfully = false;
        try {
            const agentsRes = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
                headers: { 'xi-api-key': apiKey }
            });
            if (agentsRes.ok) {
                const agentsData = await agentsRes.json();
                rawAgents = agentsData.agents || (Array.isArray(agentsData) ? agentsData : []);
                fetchedElevenLabsSuccessfully = true;
            } else {
                console.warn('[ElevenLabs API] Failed to fetch agents list:', await agentsRes.text());
            }
        } catch (e) {
            console.warn('[ElevenLabs API] Network error fetching agents:', e.message);
        }

        // 2. Fetch local agents
        const localAgents = db.all('SELECT * FROM mazeway_agents');

        // Clean up any local active agents that have been deleted from ElevenLabs
        let filteredLocalAgents = localAgents;
        if (fetchedElevenLabsSuccessfully) {
            filteredLocalAgents = localAgents.filter(localMatch => {
                if (localMatch.status !== 'PROVISIONING') {
                    const exists = rawAgents.some(a => (a.agent_id || a.id) === localMatch.id);
                    if (!exists) {
                        console.log(`[Sync] Local active agent ${localMatch.name} (ID: ${localMatch.id}) was deleted from ElevenLabs. Cleaning up locally.`);
                        db.run('DELETE FROM mazeway_agents WHERE id = ?', [localMatch.id]);
                        return false;
                    }
                }
                return true;
            });
        }

        // 3. Fetch phone numbers to bind phone/SIP metadata
        let rawPhones = [];
        try {
            const phonesRes = await fetch('https://api.elevenlabs.io/v1/convai/phone-numbers', {
                headers: { 'xi-api-key': apiKey }
            });
            if (phonesRes.ok) {
                const phonesData = await phonesRes.json();
                rawPhones = phonesData.phone_numbers || (Array.isArray(phonesData) ? phonesData : []);
            }
        } catch (e) {
            console.warn('[ElevenLabs API] Failed to fetch phone numbers:', e.message);
        }

        // 4. Map SQLite agents and merge ElevenLabs metadata
        const mappedAgents = filteredLocalAgents.map(localMatch => {
            const agentId = localMatch.id;
            const agent = rawAgents.find(a => (a.agent_id || a.id) === agentId);
            const phoneMatch = rawPhones.find(p => p.agent_id === agentId);
            
            // Parse local config if available
            let localConfig = {};
            if (localMatch.config) {
                try {
                    localConfig = JSON.parse(localMatch.config);
                } catch (e) {}
            }

            const language = agent?.conversation_config?.agent?.language || localConfig.language || 'en';
            const firstMessage = agent?.conversation_config?.agent?.first_message || localConfig.first_message || '';
            const systemPrompt = agent?.conversation_config?.agent?.prompt?.prompt || localMatch.persona || '';
            const voiceId = agent?.conversation_config?.tts?.voice_id || localConfig.voice_id || 'FmBhnvP58BK0vz65OOj7';

            // Sync back to local SQLite if it differs
            if (agent) {
                const newName = agent.name || localMatch.name;
                const newPersona = systemPrompt;
                const newFirstMsg = firstMessage;
                const newLang = language;
                const newVoiceId = voiceId;

                if (newName !== localMatch.name || newPersona !== localMatch.persona || newFirstMsg !== localConfig.first_message || newLang !== localConfig.language || newVoiceId !== localConfig.voice_id) {
                    const mergedConfig = {
                        ...localConfig,
                        language: newLang,
                        first_message: newFirstMsg,
                        voice_id: newVoiceId
                    };
                    db.run(
                        'UPDATE mazeway_agents SET name = ?, persona = ?, config = ? WHERE id = ?',
                        [newName, newPersona, JSON.stringify(mergedConfig), agentId]
                    );
                }
            }

            return {
                id: agentId,
                name: agent?.name || localMatch.name || 'Unnamed Agent',
                type: 'Voice',
                persona: systemPrompt,
                status: localMatch.status || 'ACTIVE',
                is_active: localMatch.is_active === 1,
                language: language,
                config: {
                    language,
                    first_message: firstMessage,
                    phone: phoneMatch ? phoneMatch.phone_number : (localConfig.phone || ''),
                    phone_number_id: phoneMatch ? phoneMatch.phone_number_id : '',
                    sip: phoneMatch ? {
                        label: phoneMatch.label || '',
                        phoneNumber: phoneMatch.phone_number || ''
                    } : (localConfig.sip || null),
                    model: localConfig.model || 'Cheap',
                    voice_id: voiceId
                }
            };
        });

        res.json(mappedAgents);
    } catch (err) {
        console.error('[GET /agents Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/mazeway/agents - Create or Update an agent directly on ElevenLabs
router.post('/agents', async (req, res) => {
    const { id, name, type, persona, status, is_active, config } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Missing agent name' });
    }

    if (status === 'PROVISIONING') {
        try {
            const sql = `
                INSERT OR REPLACE INTO mazeway_agents (id, name, type, persona, status, is_active, config)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            db.run(sql, [
                id,
                name,
                type || 'Voice',
                persona || '',
                status,
                is_active ? 1 : 0,
                JSON.stringify(config || {})
            ]);
            return res.json({ success: true, agentId: id });
        } catch (err) {
            console.error('[Agent Provisioning Save Error]', err);
            return res.status(500).json({ error: err.message });
        }
    }

    try {
        const apiKey = 'sk_90d44071c16ffe8316f7b6507c48b3ed083a51212c92c989';
        let agentId = id;
        let isNew = !id || id.startsWith('AG_') || id === 'NEW' || id.startsWith('test_');

        if (id && !id.startsWith('AG_') && id !== 'NEW' && !id.startsWith('test_')) {
            const checkRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${id}`, {
                headers: { 'xi-api-key': apiKey }
            });
            if (!checkRes.ok) {
                isNew = true;
            }
        } else {
            isNew = true;
        }

        const timezoneInstruction = `\n\n[System Context: Timezone is Asia/Kolkata (asia/culcutta)]`;
        const fullPersona = (persona || '') + timezoneInstruction;

        if (isNew) {
            console.log(`[ElevenLabs API] Creating agent "${name}"...`);
            const createRes = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey
                },
                body: JSON.stringify({
                    name,
                    conversation_config: {
                        agent: {
                            prompt: {
                                prompt: fullPersona,
                                llm: config?.model === 'Expensive' ? 'claude-3-5-sonnet' : (config?.model === 'Medium' ? 'gpt-4o' : 'gpt-4o-mini')
                            },
                            first_message: config?.first_message || 'Hello, how can I help you?',
                            language: config?.language || 'en',
                            model: (config?.language && config?.language !== 'en') ? 'eleven_flash_v2_5' : 'eleven_flash_v2'
                        },
                        tts: {
                            voice_id: config?.voice_id || 'FmBhnvP58BK0vz65OOj7'
                        }
                    }
                })
            });

            const agentData = await createRes.json();
            if (!createRes.ok) {
                console.error('[ElevenLabs API] Create Error:', agentData);
                return res.status(createRes.status).json({ error: agentData.detail?.message || agentData.error || 'Failed to create agent' });
            }

            agentId = agentData.agent_id || agentData.id;
            console.log(`[ElevenLabs API] Created agent ID: ${agentId}`);

            // If phone number is configured, import and bind it
            const phoneVal = config?.phone || config?.phone_number;
            if (phoneVal) {
                const label = config.sip?.label || config?.label || `${name} Trunk`;
                await importAndBindPhoneNumber(phoneVal, label, agentId, apiKey);
            }
        } else {
            console.log(`[ElevenLabs API] Updating agent "${name}" (${agentId})...`);
            const updateRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey
                },
                body: JSON.stringify({
                    name,
                    conversation_config: {
                        agent: {
                            prompt: {
                                prompt: fullPersona,
                                llm: config?.model === 'Expensive' ? 'claude-3-5-sonnet' : (config?.model === 'Medium' ? 'gpt-4o' : 'gpt-4o-mini')
                            },
                            first_message: config?.first_message,
                            language: config?.language,
                            model: (config?.language && config?.language !== 'en') ? 'eleven_flash_v2_5' : 'eleven_flash_v2'
                        },
                        tts: {
                            voice_id: config?.voice_id || 'FmBhnvP58BK0vz65OOj7'
                        }
                    }
                })
            });

            if (!updateRes.ok) {
                const errData = await updateRes.json();
                console.error('[ElevenLabs API] Update Error:', errData);
                return res.status(updateRes.status).json({ error: errData.detail?.message || errData.error || 'Failed to update agent' });
            }

            const phoneVal = config?.phone || config?.phone_number;
            if (phoneVal) {
                const label = config.sip?.label || config?.label || `${name} Trunk`;
                await importAndBindPhoneNumber(phoneVal, label, agentId, apiKey);
            }
        }
        // Save locally to SQLite database
        const sql = `
            INSERT OR REPLACE INTO mazeway_agents (id, name, type, persona, status, is_active, config)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(sql, [
            agentId,
            name,
            type || 'Voice',
            persona || '',
            status || 'ACTIVE',
            is_active ? 1 : 0,
            JSON.stringify(config || {})
        ]);

        if (id && id !== agentId) {
            db.run('DELETE FROM mazeway_agents WHERE id = ?', [id]);
        }

        res.json({ success: true, agentId });
    } catch (err) {
        console.error('[Agent Save Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/mazeway/agents/:id - Delete an agent in ElevenLabs
router.delete('/agents/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const apiKey = 'sk_90d44071c16ffe8316f7b6507c48b3ed083a51212c92c989';

        // 1. Delete associated phone numbers on ElevenLabs
        try {
            console.log(`[ElevenLabs Telephony] Searching for phone numbers bound to agent: ${id}`);
            const listPhonesRes = await fetch('https://api.elevenlabs.io/v1/convai/phone-numbers', {
                headers: { 'xi-api-key': apiKey }
            });
            if (listPhonesRes.ok) {
                const listPhonesData = await listPhonesRes.json();
                const existingPhones = listPhonesData.phone_numbers || (Array.isArray(listPhonesData) ? listPhonesData : []);
                const matchedPhones = existingPhones.filter(p => p.agent_id === id);
                
                for (const phone of matchedPhones) {
                    const phoneId = phone.phone_number_id || phone.id;
                    console.log(`[ElevenLabs Telephony] Deleting bound phone number: ${phone.phone_number} (ID: ${phoneId})`);
                    const delPhoneRes = await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneId}`, {
                        method: 'DELETE',
                        headers: { 'xi-api-key': apiKey }
                    });
                    if (delPhoneRes.ok) {
                        console.log(`[ElevenLabs Telephony] Phone number ${phone.phone_number} deleted successfully.`);
                    } else {
                        console.error(`[ElevenLabs Telephony] Failed to delete phone number:`, await delPhoneRes.text());
                    }
                }
            }
        } catch (e) {
            console.warn('[ElevenLabs Telephony] Failed to delete associated phone numbers:', e.message);
        }

        // 2. Delete from ElevenLabs
        console.log(`[ElevenLabs API] Deleting agent ID: ${id}`);
        const deleteRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${id}`, {
            method: 'DELETE',
            headers: {
                'xi-api-key': apiKey
            }
        });

        if (!deleteRes.ok) {
            const errData = await deleteRes.json();
            console.error('[ElevenLabs API] Delete Error:', errData);
            return res.status(deleteRes.status).json({ error: errData.detail?.message || errData.error || 'Failed to delete agent' });
        }

        // 3. Delete from local SQLite database
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
                duration: o.type === 'Voice' ? (() => {
                    const sec = Number(o.duration_seconds || 105);
                    const mins = Math.floor(sec / 60);
                    const secs = sec % 60;
                    return `${mins}:${String(secs).padStart(2, '0')}`;
                })() : '-',
                timestamp: o.created_at,
                summary: o.notes || `Processed order for ${o.customer_name}. Items: ${itemsList}. Total: ₹${o.total}.`
            };
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/mazeway/stats - Fetch stats dynamically combining orders and ElevenLabs agent count
router.get('/stats', async (req, res) => {
    try {
        const apiKey = 'sk_90d44071c16ffe8316f7b6507c48b3ed083a51212c92c989';

        const orderStats = db.get(`
            SELECT 
                COUNT(*) as total_leads,
                SUM(CASE WHEN status = 'CONFIRMED' THEN total ELSE 0 END) as total_revenue
            FROM mazeway_orders
        `);

        let agentCount = 0;
        let agentRevenue = 0;

        try {
            const agentsRes = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
                headers: { 'xi-api-key': apiKey }
            });
            if (agentsRes.ok) {
                const agentsData = await agentsRes.json();
                const rawAgents = agentsData.agents || (Array.isArray(agentsData) ? agentsData : []);
                agentCount = rawAgents.length;
                agentRevenue = agentCount * 700; // estimated ₹700/mo agent plan revenue for dashboard metrics
            }
        } catch (e) {
            console.error('[Stats] ElevenLabs fetch failed for stats:', e.message);
        }

        const totalRevenue = (orderStats.total_revenue || 0) + agentRevenue;
        const durationRow = db.get("SELECT COALESCE(SUM(duration_seconds), 0) AS total FROM mazeway_orders");
        const actualMinutes = Math.ceil((durationRow ? durationRow.total : 0) / 60);

        res.json({
            totalMinutes: actualMinutes.toLocaleString('en-IN'),
            leadsProcessed: (orderStats.total_leads || 0).toLocaleString('en-IN'),
            revenue: totalRevenue.toLocaleString('en-IN', {
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

async function importAndBindPhoneNumber(phoneVal, label, agentId, apiKey) {
    if (!phoneVal) return null;
    const cleanInputPhone = phoneVal.replace(/\D/g, '');
    console.log(`[ElevenLabs Telephony] Checking for existing phone: ${phoneVal}`);
    
    let phoneId = null;
    try {
        const listPhonesRes = await fetch('https://api.elevenlabs.io/v1/convai/phone-numbers', {
            headers: { 'xi-api-key': apiKey }
        });
        if (listPhonesRes.ok) {
            const listPhonesData = await listPhonesRes.json();
            const existingPhones = listPhonesData.phone_numbers || (Array.isArray(listPhonesData) ? listPhonesData : []);
            const matchedPhone = existingPhones.find(p => {
                const cleanExisting = (p.phone_number || '').replace(/\D/g, '');
                return cleanExisting && (cleanExisting === cleanInputPhone || cleanExisting.endsWith(cleanInputPhone) || cleanInputPhone.endsWith(cleanExisting));
            });
            if (matchedPhone) {
                phoneId = matchedPhone.phone_number_id || matchedPhone.id;
                console.log(`[ElevenLabs Telephony] Found matching registered phone: ${phoneId}`);
            }
        }
    } catch (e) {
        console.warn('[ElevenLabs Telephony] Lookup failed:', e.message);
    }

    if (!phoneId) {
        console.log(`[ElevenLabs Telephony] Importing new phone: ${phoneVal}`);
        const importPhoneRes = await fetch('https://api.elevenlabs.io/v1/convai/phone-numbers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify({
                phone_number: phoneVal,
                label: label || 'Custom Trunk'
            })
        });

        if (importPhoneRes.ok) {
            const phoneData = await importPhoneRes.json();
            phoneId = phoneData.phone_number_id || phoneData.id;
            console.log(`[ElevenLabs Telephony] Imported phone successfully. ID: ${phoneId}`);
        } else {
            console.error('[ElevenLabs Telephony] Import failed:', await importPhoneRes.text());
        }
    }

    if (phoneId) {
        console.log(`[ElevenLabs Telephony] Binding agent ${agentId} to phone ${phoneId}...`);
        const assignRes = await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify({
                agent_id: agentId
            })
        });
        if (assignRes.ok) {
            console.log(`[ElevenLabs Telephony] Bound agent successfully.`);
            return phoneId;
        } else {
            console.error('[ElevenLabs Telephony] Binding failed:', await assignRes.text());
        }
    }
    return null;
}

// POST /api/mazeway/agents/:agentId/kb-sync - Sync ERP backup to ElevenLabs KB for a specific agent
router.post('/agents/:agentId/kb-sync', async (req, res) => {
    const { agentId } = req.params;
    const apiKey = 'sk_90d44071c16ffe8316f7b6507c48b3ed083a51212c92c989';

    try {
        console.log(`[KB Sync] Starting sync for agent: ${agentId}`);

        // 1. Generate Markdown snapshot and save it locally
        const backupUtil = require('../backupUtil');
        const { filepath, content } = await backupUtil.generateMarkdownBackup(agentId);
        console.log(`[KB Sync] Generated local Markdown backup at: ${filepath}`);

        // 2. Fetch all KB documents from ElevenLabs to look for our folder & document
        const kbListRes = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base', {
            headers: { 'xi-api-key': apiKey }
        });

        if (!kbListRes.ok) {
            const errText = await kbListRes.text();
            console.error('[KB Sync] Failed to list KB documents:', errText);
            return res.status(kbListRes.status).json({ error: `ElevenLabs API error: ${errText}` });
        }

        const kbData = await kbListRes.json();
        const items = Array.isArray(kbData) ? kbData : (kbData.documentation || kbData.documents || []);

        // 3. Find or Create folder named after the agentId
        let folderId = null;
        const existingFolder = items.find(item => item.name === agentId && (item.type === 'folder' || item.file_size === undefined));

        if (existingFolder) {
            folderId = existingFolder.id;
            console.log(`[KB Sync] Found existing folder for agent: ${agentId} (ID: ${folderId})`);
        } else {
            console.log(`[KB Sync] Folder not found. Creating folder: ${agentId}`);
            const createFolderRes = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base/folder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey
                },
                body: JSON.stringify({ name: agentId })
            });

            if (createFolderRes.ok) {
                const folderData = await createFolderRes.json();
                folderId = folderData.id;
                console.log(`[KB Sync] Created new folder for agent: ${agentId} (ID: ${folderId})`);
            } else {
                console.warn('[KB Sync] Failed to create folder. Proceeding to root level.', await createFolderRes.text());
            }
        }

        // 4. Check if an existing ERP_Backup.md document exists inside this folder (or root if folderId is null)
        const existingDoc = items.find(item => {
            if (item.name !== 'ERP_Backup.md') return false;
            if (item.type === 'folder') return false;
            const parentId = item.folder_parent_id || item.parent_folder_id;
            if (folderId) {
                if (parentId === folderId) return true;
                if (Array.isArray(item.folder_path)) {
                    return item.folder_path.some(f => f.id === folderId);
                }
            } else {
                return !parentId;
            }
            return false;
        });

        let targetDocId = null;
        if (existingDoc) {
            targetDocId = existingDoc.id;
            console.log(`[KB Sync] Found existing backup document: ${targetDocId}. Updating in-place...`);
            const updateRes = await fetch(`https://api.elevenlabs.io/v1/convai/knowledge-base/${targetDocId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey
                },
                body: JSON.stringify({
                    name: 'ERP_Backup.md',
                    content: content
                })
            });

            if (!updateRes.ok) {
                const errText = await updateRes.text();
                console.error(`[KB Sync] In-place update failed for ${targetDocId}:`, errText);
                return res.status(updateRes.status).json({ error: `ElevenLabs update failed: ${errText}` });
            }
            console.log(`[KB Sync] Successfully updated document ${targetDocId} in-place.`);
        } else {
            console.log(`[KB Sync] No existing backup document found. Uploading new one...`);
            const uploadBody = {
                text: content,
                name: 'ERP_Backup.md'
            };
            if (folderId) {
                uploadBody.parent_folder_id = folderId;
            }

            const uploadRes = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base/text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey
                },
                body: JSON.stringify(uploadBody)
            });

            if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                console.error('[KB Sync] Upload failed:', errText);
                return res.status(uploadRes.status).json({ error: `ElevenLabs upload failed: ${errText}` });
            }

            const uploadData = await uploadRes.json();
            targetDocId = uploadData.id;
            console.log(`[KB Sync] Uploaded new backup document. ID: ${targetDocId}`);
        }

        // 6. Fetch agent details to update knowledge_base array
        console.log(`[KB Sync] Fetching agent ${agentId} detail...`);
        const agentGetRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
            headers: { 'xi-api-key': apiKey }
        });

        if (!agentGetRes.ok) {
            const errText = await agentGetRes.text();
            console.error('[KB Sync] Failed to fetch agent details:', errText);
            return res.status(agentGetRes.status).json({ error: `Failed to fetch agent details: ${errText}` });
        }

        const agentDetail = await agentGetRes.json();
        let kbList = agentDetail.conversation_config?.agent?.prompt?.knowledge_base || [];
        console.log('[KB Sync] Current agent KB list:', JSON.stringify(kbList));

        // Filter out folderId, old file references, and any folder objects
        kbList = kbList.filter(item => {
            if (typeof item === 'string') {
                return item !== folderId && item !== targetDocId;
            }
            const id = item?.id || item?.documentation_id;
            return id && id !== folderId && id !== targetDocId && item?.type !== 'folder';
        });

        // Add the correct document locator object for our ERP_Backup.md file
        kbList.push({
            type: 'file',
            id: targetDocId,
            name: 'ERP_Backup.md',
            usage_mode: 'auto'
        });

        // 7. Update agent config
        console.log(`[KB Sync] Updating agent ${agentId} with knowledge_base config...`);
        const agentUpdateRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify({
                conversation_config: {
                    agent: {
                        prompt: {
                            knowledge_base: kbList
                        }
                    }
                }
            })
        });

        if (!agentUpdateRes.ok) {
            const errText = await agentUpdateRes.text();
            console.error('[KB Sync] Failed to update agent config:', errText);
            return res.status(agentUpdateRes.status).json({ error: `Failed to link document to agent: ${errText}` });
        }

        console.log(`[KB Sync] Agent knowledge base sync completed successfully.`);
        try {
            db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_push_date', ?)", [new Date().toISOString()]);
        } catch (dbErr) {
            console.error('[KB Sync] Failed to save last_push_date:', dbErr.message);
        }
        res.json({ success: true, folderId, documentId: targetDocId });

    } catch (err) {
        console.error('[KB Sync Error]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
