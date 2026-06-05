const { google } = require('googleapis');
const db = require('../db');
const EmailConnection = require('../models/EmailConnection');
const gmailSender = require('./email/gmailSender');
const aiReplyService = require('./aiReplyService');

let pollingInterval = null;

function getMessageBody(payload) {
    if (payload.body && payload.body.data) {
        const base64Data = payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(base64Data, 'base64').toString('utf8');
    }
    if (payload.parts) {
        for (const part of payload.parts) {
            const body = getMessageBody(part);
            if (body) return body;
        }
    }
    return '';
}

async function checkUnreadEmails(connection) {
    const email = connection.email;
    try {
        const authClient = await gmailSender.getAuthorizedClient(email);
        const gmail = google.gmail({ version: 'v1', auth: authClient });

        // List unread messages
        const listRes = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread'
        });

        const messages = listRes.data.messages || [];
        if (messages.length === 0) return;

        console.log(`[Email Receiver] Found ${messages.length} unread email(s) for connection: ${email}`);

        for (const msg of messages) {
            try {
                // Check if already processed locally
                const alreadyProcessed = db.get("SELECT message_id FROM processed_emails WHERE message_id = ?", [msg.id]);
                if (alreadyProcessed) {
                    continue;
                }

                // Get message details
                const msgDetails = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id
                });

                const payload = msgDetails.data.payload;
                if (!payload) continue;

                const headers = payload.headers || [];
                const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
                const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
                const bodyText = getMessageBody(payload) || '';

                // Extract clean sender email address
                const emailMatch = fromHeader.match(/<([^>]+)>/) || [null, fromHeader];
                const senderEmail = (emailMatch[1] || fromHeader).trim().toLowerCase();

                if (!senderEmail) {
                    console.warn(`[Email Receiver] Could not extract sender email from: ${fromHeader}`);
                    continue;
                }

                // Skip emails sent by ourselves to prevent reply loops
                if (senderEmail === email.toLowerCase()) {
                    console.log(`[Email Receiver] Skipping self-sent message in thread`);
                    await markAsRead(gmail, msg.id);
                    db.run("INSERT OR IGNORE INTO processed_emails (message_id) VALUES (?)", [msg.id]);
                    continue;
                }

                // --- SYSTEM SENDER BLOCKLIST ---
                // Never auto-reply to mailer-daemon, postmaster, bounce/DSN addresses,
                // no-reply senders, or any automated system notifications.
                const BLOCKED_SENDER_PATTERNS = [
                    /^mailer-daemon/i,
                    /^postmaster/i,
                    /^no-?reply/i,
                    /^noreply/i,
                    /^bounce/i,
                    /^auto-?reply/i,
                    /^donotreply/i,
                    /^do-not-reply/i,
                    /^notifications?@/i,
                    /^alerts?@/i,
                    /^daemon@/i,
                    /^MAILER-DAEMON/i,
                ];
                const BLOCKED_SUBJECT_PATTERNS = [
                    /delivery status notification/i,
                    /undeliverable/i,
                    /mail delivery failed/i,
                    /failure notice/i,
                    /returned mail/i,
                    /auto.?reply/i,
                    /out of office/i,
                    /automatic reply/i,
                ];
                const isBlockedSender = BLOCKED_SENDER_PATTERNS.some(re => re.test(senderEmail));
                const isBlockedSubject = BLOCKED_SUBJECT_PATTERNS.some(re => re.test(subjectHeader));
                if (isBlockedSender || isBlockedSubject) {
                    console.log(`[Email Receiver] Skipping system/automated email from "${senderEmail}" (Subject: "${subjectHeader}") — blocked sender or subject.`);
                    await markAsRead(gmail, msg.id);
                    db.run("INSERT OR IGNORE INTO processed_emails (message_id) VALUES (?)", [msg.id]);
                    continue;
                }
                // --- END BLOCKLIST ---

                // Also check Auto-Submitted header (RFC 3834) — skip all auto-generated emails
                const autoSubmitted = headers.find(h => h.name.toLowerCase() === 'auto-submitted')?.value || '';
                const precedence = headers.find(h => h.name.toLowerCase() === 'precedence')?.value || '';
                if (autoSubmitted && autoSubmitted.toLowerCase() !== 'no') {
                    console.log(`[Email Receiver] Skipping auto-submitted email from "${senderEmail}" (Auto-Submitted: ${autoSubmitted}).`);
                    await markAsRead(gmail, msg.id);
                    db.run("INSERT OR IGNORE INTO processed_emails (message_id) VALUES (?)", [msg.id]);
                    continue;
                }
                if (precedence && /bulk|list|junk/i.test(precedence)) {
                    console.log(`[Email Receiver] Skipping bulk/list email from "${senderEmail}" (Precedence: ${precedence}).`);
                    await markAsRead(gmail, msg.id);
                    db.run("INSERT OR IGNORE INTO processed_emails (message_id) VALUES (?)", [msg.id]);
                    continue;
                }

                // AI only answers if the user has sent a reply to any email in this thread
                const inReplyTo = headers.find(h => h.name.toLowerCase() === 'in-reply-to')?.value || '';
                const references = headers.find(h => h.name.toLowerCase() === 'references')?.value || '';
                const isReply = subjectHeader.toLowerCase().startsWith('re:') || inReplyTo || references;

                if (!isReply) {
                    console.log(`[Email Receiver] Skipping email from ${senderEmail} (Subject: "${subjectHeader}"): Not a reply.`);
                    // Insert into processed_emails so we don't query it again, but leave it UNREAD in Gmail
                    db.run("INSERT OR IGNORE INTO processed_emails (message_id) VALUES (?)", [msg.id]);
                    continue;
                }

                // Only reply to threads that Quantro itself sent via gmailSender.
                // This prevents hijacking personal Gmail conversations that were never
                // started through Quantro campaigns or invoice emails.
                const threadId = msgDetails.data.threadId;
                if (!threadId) {
                    console.warn(`[Email Receiver] No threadId found for message ID ${msg.id}`);
                    db.run("INSERT OR IGNORE INTO processed_emails (message_id) VALUES (?)", [msg.id]);
                    continue;
                }

                // Ensure table exists (in case receiver starts before any email is sent)
                db.run(`CREATE TABLE IF NOT EXISTS quantro_sent_threads (
                    thread_id TEXT PRIMARY KEY,
                    sender_email TEXT,
                    sent_at TEXT DEFAULT (datetime('now','localtime'))
                )`);

                const isQuantroThread = db.get(
                    "SELECT 1 FROM quantro_sent_threads WHERE thread_id = ?",
                    [threadId]
                );

                if (!isQuantroThread) {
                    console.log(`[Email Receiver] Skipping email from ${senderEmail} (Subject: "${subjectHeader}"): Thread was not started by Quantro.`);
                    // Mark processed so we don't re-check it, but leave unread in Gmail
                    db.run("INSERT OR IGNORE INTO processed_emails (message_id) VALUES (?)", [msg.id]);
                    continue;
                }

                console.log(`[Email Receiver] Processing reply email from ${senderEmail} - Subject: "${subjectHeader}"`);

                // Find or create customer
                let customer = db.get("SELECT * FROM customers WHERE LOWER(email) = ?", [senderEmail]);
                if (!customer) {
                    const leadName = `AI Lead (${senderEmail})`;
                    const insertRes = db.run(
                        "INSERT INTO customers (name, email, phone, address) VALUES (?, ?, '', '')",
                        [leadName, senderEmail]
                    );
                    customer = { id: insertRes.lastInsertRowid, name: leadName, email: senderEmail, phone: '', address: '' };
                    console.log(`[Email Receiver] Created new lead placeholder: ${leadName} (ID: ${customer.id})`);
                }

                // Log incoming email to communication log
                db.run(
                    "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'Email', ?)",
                    [customer.id, `Received Email: ${subjectHeader}\n\n${bodyText}`]
                );

                // Run AI reply generation
                const cleanReplyText = await aiReplyService.processIncomingMessage({
                    customerId: customer.id,
                    text: bodyText,
                    channel: 'Email',
                    email: senderEmail
                });

                // Send auto-reply
                const replySubject = subjectHeader.toLowerCase().startsWith('re:') ? subjectHeader : `Re: ${subjectHeader}`;
                await gmailSender.sendMail({
                    senderEmail: email,
                    to: senderEmail,
                    subject: replySubject,
                    htmlBody: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5; color: #333333;">${cleanReplyText.replace(/\n/g, '<br/>')}</div>`,
                    textBody: cleanReplyText
                });

                // Log outgoing AI reply to communication log
                db.run(
                    "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'Email', ?)",
                    [customer.id, `AI Auto-Reply: ${cleanReplyText}`]
                );

                // Mark the email as read in Gmail
                await markAsRead(gmail, msg.id);
                // Mark processed locally so we don't reply again
                db.run("INSERT OR IGNORE INTO processed_emails (message_id) VALUES (?)", [msg.id]);
                console.log(`[Email Receiver] Successfully processed and replied to message ID: ${msg.id}`);
            } catch (msgErr) {
                console.error(`[Email Receiver] Error processing message ID ${msg.id}:`, msgErr);
            }
        }
    } catch (err) {
        console.error(`[Email Receiver] Error checking emails for ${email}:`, err.message);
    }
}

async function markAsRead(gmail, messageId) {
    await gmail.users.messages.batchModify({
        userId: 'me',
        ids: [messageId],
        resource: {
            removeLabelIds: ['UNREAD']
        }
    });
}

const emailReceiver = {
    startEmailReceiver() {
        if (pollingInterval) {
            console.log('[Email Receiver] Service already running.');
            return;
        }

        console.log('[Email Receiver] Starting background unread Gmail polling service (every 30 seconds)...');
        pollingInterval = setInterval(async () => {
            try {
                await db.ready;
                
                // Initialize processed_emails table if not exists
                db.run(`
                    CREATE TABLE IF NOT EXISTS processed_emails (
                        message_id TEXT PRIMARY KEY,
                        processed_at TEXT DEFAULT (datetime('now','localtime'))
                    )
                `);

                const connections = await EmailConnection.getConnections();
                const activeConnections = connections.filter(c => c.status === 'Active');

                for (const conn of activeConnections) {
                    await checkUnreadEmails(conn);
                }
            } catch (err) {
                console.error('[Email Receiver] Poller interval error:', err.message);
            }
        }, 30000); // 30 seconds
    },

    stopEmailReceiver() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
            console.log('[Email Receiver] Background service stopped.');
        }
    }
};

module.exports = emailReceiver;
