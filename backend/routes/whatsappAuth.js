const express = require('express');
const router = express.Router();
const db = require('../db');
const whatsappSender = require('../services/whatsappSender');

// Mock Meta Embedded Signup page
router.get('/connect', (req, res) => {
    // Renders a beautiful mock signup page
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Meta Embedded Signup - Mock</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background-color: #f0f2f5;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .card {
                    background: white;
                    padding: 32px;
                    border-radius: 8px;
                    box-shadow: 0 12px 28px 0 rgba(0, 0, 0, 0.2), 0 2px 4px 0 rgba(0, 0, 0, 0.1);
                    width: 450px;
                    text-align: center;
                }
                .facebook-logo {
                    color: #1877f2;
                    font-size: 32px;
                    font-weight: bold;
                    margin-bottom: 24px;
                }
                h2 {
                    margin-top: 0;
                    color: #1c1e21;
                    font-size: 20px;
                }
                p {
                    color: #606770;
                    font-size: 14px;
                    line-height: 1.4;
                    margin-bottom: 24px;
                }
                .input-group {
                    text-align: left;
                    margin-bottom: 16px;
                }
                .input-group label {
                    display: block;
                    font-size: 12px;
                    font-weight: bold;
                    color: #606770;
                    margin-bottom: 6px;
                }
                .input-group input {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #dddfe2;
                    border-radius: 6px;
                    font-size: 14px;
                    box-sizing: border-box;
                }
                .btn {
                    background-color: #1877f2;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 12px 24px;
                    font-size: 15px;
                    font-weight: bold;
                    width: 100%;
                    cursor: pointer;
                    margin-top: 8px;
                }
                .btn:hover {
                    background-color: #166fe5;
                }
                .footer {
                    margin-top: 24px;
                    font-size: 11px;
                    color: #8d949e;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="facebook-logo">meta</div>
                <h2>Embedded Signup</h2>
                <p>Connect your Quantro ERP to the WhatsApp Business Platform via Cloud API.</p>
                <form action="/auth/whatsapp/callback" method="GET">
                    <div class="input-group">
                        <label>WhatsApp Business Account ID (WABA ID)</label>
                        <input type="text" name="waba_id" value="3150419608479658" required />
                    </div>
                    <div class="input-group">
                        <label>Phone Number ID</label>
                        <input type="text" name="phone_number_id" value="1117813404753239" required />
                    </div>
                    <div class="input-group">
                        <label>System User Token (Permanent)</label>
                        <input type="password" name="token" value="EAATPnZC7jFeIBRqggccKGFX3E8Q3UNUmNf4bS59ZCV8MpbzIvfaIHmFrMRvDIHRkiS91DlU110DKgvY5EHWqKzzKL3mgPO9iuv8iFnR5ZAr6GC3CKZC4jmBkZBzSNoFB1v7ArepgYwCUoAeM2UFca2wudIVnPZCJRVgc9W3n0k2S5BG9EmA95Q6g8x1ZAuMjvdkCgZDZD" required />
                    </div>
                    <button type="submit" class="btn">Link WhatsApp Account</button>
                </form>
                <div class="footer">
                    Meta Business Partner Integration.
                </div>
            </div>
        </body>
        </html>
    `);
});

// OAuth Callback receiver
router.get('/callback', async (req, res, next) => {
    try {
        await db.ready;
        const { waba_id, phone_number_id, token } = req.query;

        if (!waba_id || !phone_number_id || !token) {
            return res.status(400).send("Missing required WhatsApp login details.");
        }

        // Store active credentials in the database
        db.run(
            `INSERT OR REPLACE INTO whatsapp_connections (phone_number_id, waba_id, token, status)
             VALUES (?, ?, ?, 'Active')`,
            [phone_number_id, waba_id, token]
        );

        // Redirect back to electron client frontend
        res.redirect('http://localhost:5173/#/automation?whatsapp=success');
    } catch (err) {
        next(err);
    }
});

// GET active connections
router.get('/connections', async (req, res, next) => {
    try {
        await db.ready;
        const rows = db.all("SELECT id, phone_number_id, waba_id, status, connected_at FROM whatsapp_connections");
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// POST disconnect WhatsApp
router.post('/disconnect', async (req, res, next) => {
    try {
        await db.ready;
        const { phone_number_id } = req.body;
        if (!phone_number_id) {
            return res.status(400).json({ error: "phone_number_id is required" });
        }

        db.run("DELETE FROM whatsapp_connections WHERE phone_number_id = ?", [phone_number_id]);
        res.json({ message: "WhatsApp service disconnected successfully." });
    } catch (err) {
        next(err);
    }
});

// POST test-message
router.post('/test-message', async (req, res, next) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ error: "recipient phone is required" });
        }

        const msgText = "Test Message from Quantro ERP WhatsApp Integration!\n\nYour WhatsApp Cloud API is successfully configured.";
        const result = await whatsappSender.sendText(phone, msgText);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Webhook Verification (GET /webhook)
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = db.get("SELECT value FROM settings WHERE key = 'whatsapp_webhook_verify_token'")?.value || 'maze_secure_verify_2026';

    if (mode && token) {
        if (mode === 'subscribe' && token === verifyToken) {
            console.log('[WhatsApp Webhook] Verified successfully.');
            return res.status(200).send(challenge);
        } else {
            return res.status(403).send('Forbidden');
        }
    }
    res.status(400).send('Bad Request');
});

// Webhook Event Receiver (POST /webhook)
router.post('/webhook', (req, res) => {
    const body = req.body;
    console.log('[WhatsApp Webhook] Received Event:', JSON.stringify(body, null, 2));

    // Handle statuses or incoming messages here if necessary.
    // Return standard success response to Meta
    res.status(200).send('EVENT_RECEIVED');
});

module.exports = router;
