const { google } = require('googleapis');
const googleOAuthService = require('../googleOAuthService');
const EmailConnection = require('../../models/EmailConnection');
const db = require('../../db');

/**
 * Encodes a string to RFC 2822 base64url format for the Google API raw message body.
 */
function base64url(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Compiles a raw MIME multipart email message.
 */
function compileMimeEmail({ to, fromName, fromEmail, subject, htmlBody, textBody = '' }) {
    const boundary = 'maze_erp_mail_boundary_' + Date.now();
    const headers = [
        `To: ${to}`,
        `From: "${fromName}" <${fromEmail}>`,
        `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        ''
    ];

    const bodyParts = [];

    // Plain text part
    bodyParts.push(`--${boundary}`);
    bodyParts.push('Content-Type: text/plain; charset="UTF-8"');
    bodyParts.push('Content-Transfer-Encoding: base64');
    bodyParts.push('');
    bodyParts.push(Buffer.from(textBody).toString('base64'));

    // HTML part
    bodyParts.push(`--${boundary}`);
    bodyParts.push('Content-Type: text/html; charset="UTF-8"');
    bodyParts.push('Content-Transfer-Encoding: base64');
    bodyParts.push('');
    bodyParts.push(Buffer.from(htmlBody).toString('base64'));

    // End boundary
    bodyParts.push(`--${boundary}--`);

    return headers.join('\r\n') + bodyParts.join('\r\n');
}

/**
 * Returns a refreshed OAuth2 client for the given connected email address.
 */
async function getAuthorizedClient(email) {
    const connection = await EmailConnection.getConnectionByEmail(email);
    if (!connection) {
        throw new Error(`No Gmail connection found for sender email: ${email}`);
    }

    const creds = require('../../../Public/Email Service.json').web;
    const oauth2Client = new google.auth.OAuth2(
        creds.client_id,
        creds.client_secret,
        'http://localhost:3001/auth/google/callback'
    );

    // If close to expiry (within 5 minutes), refresh access token
    const isExpired = Date.now() >= (connection.expiry_date - 300000);
    if (isExpired && connection.refresh_token) {
        try {
            console.log(`[Gmail Sender] Access token for ${email} expired or expiring soon. Refreshing...`);
            const refreshed = await googleOAuthService.refreshTokens(connection.refresh_token);
            
            const newExpiry = Date.now() + (refreshed.expires_in * 1000);
            await EmailConnection.createOrUpdateConnection({
                email,
                accessToken: refreshed.access_token,
                expiryDate: newExpiry,
                status: 'Active'
            });

            oauth2Client.setCredentials({
                access_token: refreshed.access_token,
                refresh_token: connection.refresh_token,
                expiry_date: newExpiry
            });
        } catch (err) {
            console.error(`[Gmail Sender] Failed to refresh tokens for ${email}:`, err.message);
            await EmailConnection.updateStatus(email, 'Expired');
            throw new Error(`Gmail authorization expired for ${email}. Please reconnect in Automation settings.`);
        }
    } else {
        oauth2Client.setCredentials({
            access_token: connection.access_token,
            refresh_token: connection.refresh_token,
            expiry_date: connection.expiry_date
        });
    }

    return oauth2Client;
}

function getDefaultLogo() {
    try {
        const fs = require('fs');
        const path = require('path');
        const p1 = path.join(__dirname, '..', '..', '..', 'Public', 'mazeway.png');
        if (fs.existsSync(p1)) {
            return `data:image/png;base64,${fs.readFileSync(p1).toString('base64')}`;
        }
        const p2 = path.join(__dirname, '..', '..', '..', 'renderer', 'public', 'icons', 'Logo.png');
        if (fs.existsSync(p2)) {
            return `data:image/png;base64,${fs.readFileSync(p2).toString('base64')}`;
        }
    } catch (e) {
        console.error('[Gmail Sender] Error loading default logo:', e);
    }
    return '';
}

function getCompanyName(settings) {
    if (settings && settings.company_name && settings.company_name.trim() !== '' && settings.company_name !== 'Quantro') {
        return settings.company_name;
    }
    return 'Maze ERP';
}

function getFromName(settings) {
    if (settings && settings.company_name && settings.company_name.trim() !== '' && settings.company_name !== 'Quantro') {
        return settings.company_name;
    }
    return 'Maze ERP Admin';
}

const gmailSender = {
    getAuthorizedClient,
    /**
     * Send email directly using a connected Gmail account
     */
    async sendMail({ senderEmail, to, subject, htmlBody, textBody = '' }) {
        try {
            // Check billing block status
            const { isBillingBlocked } = require('../billingHelper');
            const blocked = await isBillingBlocked();
            if (blocked) {
                throw new Error("Email Service Blocked: Outstanding dues have not been paid. Please complete payment in the Billing tab.");
            }

            // Check daily usage limit
            const limit = 1000;
            const currentUsage = await EmailConnection.getDailyUsage(senderEmail);
            if (currentUsage >= limit) {
                throw new Error(`Daily email limit of ${limit} has been reached for ${senderEmail}.`);
            }

            const auth = await getAuthorizedClient(senderEmail);
            const gmail = google.gmail({ version: 'v1', auth });

            const connection = await EmailConnection.getConnectionByEmail(senderEmail);
            await db.ready;
            const settingsRows = db.all('SELECT key, value FROM settings');
            const settings = {};
            settingsRows.forEach(r => { settings[r.key] = r.value; });

            const fromName = getFromName(settings);

            const rawMime = compileMimeEmail({
                to,
                fromName,
                fromEmail: senderEmail,
                subject,
                htmlBody,
                textBody
            });

            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: base64url(rawMime)
                }
            });

            // Track this outgoing thread so the AI receiver only replies to
            // threads that Quantro itself started — never personal Gmail emails.
            const sentThreadId = response.data.threadId;
            if (sentThreadId) {
                db.run(
                    `CREATE TABLE IF NOT EXISTS quantro_sent_threads (
                        thread_id TEXT PRIMARY KEY,
                        sender_email TEXT,
                        sent_at TEXT DEFAULT (datetime('now','localtime'))
                    )`
                );
                db.run(
                    "INSERT OR IGNORE INTO quantro_sent_threads (thread_id, sender_email) VALUES (?, ?)",
                    [sentThreadId, senderEmail]
                );
            }

            // Increment daily usage count
            await EmailConnection.incrementDailyUsage(senderEmail);

            // Increment billing email sent count
            db.run("UPDATE settings SET value = CAST(CAST(COALESCE((SELECT value FROM settings WHERE key = 'billing_email_sent_count'), '0') AS INTEGER) + 1 AS TEXT) WHERE key = 'billing_email_sent_count'");

            console.log(`[Gmail Sender] Email successfully sent to ${to} via ${senderEmail}. Message ID: ${response.data.id}`);
            return response.data;
        } catch (err) {
            console.error('[Gmail Sender] Error sending email:', err);
            throw err;
        }
    },

    /**
     * Generate HTML Templates for various ERP emails
     */
    generateInvoiceTemplate(invoice, settings, style = 'classic') {
        const itemsList = (invoice.items || []).map(item => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: left;">
                    ${item.product_name} ${item.variant_name ? `(${item.variant_name})` : ''}
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: center;">${item.quantity}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right;">₹${item.price.toLocaleString('en-IN')}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: bold;">₹${item.total.toLocaleString('en-IN')}</td>
            </tr>
        `).join('');

        const currency = settings.default_currency || 'INR';
        const displayTotal = invoice.total_amount || invoice.effective_total || invoice.total || 0;
        const displayDue = typeof invoice.due_amount !== 'undefined' ? invoice.due_amount : Math.max(0, (invoice.total || 0) - (invoice.paid_amount || 0));

        const logoUrl = settings.logo_url || getDefaultLogo();
        const companyName = getCompanyName(settings);

        if (style === 'minimalist') {
            return `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 24px;">
                        <div>
                            ${logoUrl 
                                ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 40px; margin-bottom: 8px; display: block;" />` 
                                : ''
                            }
                            <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">${companyName}</h2>
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">${settings.email || ''}</p>
                        </div>
                        <div style="text-align: right;">
                            <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">INVOICE</h3>
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">#${invoice.invoice_number || invoice.id}</p>
                        </div>
                    </div>
                    <div style="margin-bottom: 24px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">Billed To</h4>
                        <p style="margin: 0; font-weight: 600; color: #1e293b;">${invoice.customer_name || 'Valued Customer'}</p>
                        ${invoice.customer_email ? `<p style="margin: 2px 0 0 0; font-size: 13px; color: #64748b;">${invoice.customer_email}</p>` : ''}
                    </div>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-weight: 600; color: #475569;">Item</th>
                                <th style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #475569;">Qty</th>
                                <th style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #475569;">Price</th>
                                <th style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #475569;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsList}
                        </tbody>
                    </table>
                    <div style="width: 250px; margin-left: auto; font-size: 14px;">
                        <div style="display: flex; justify-content: space-between; padding: 6px 0; color: #475569;">
                            <span>Subtotal</span>
                            <span>₹${displayTotal.toLocaleString('en-IN')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid #0f172a; font-weight: 700; color: #0f172a; font-size: 16px; margin-top: 8px;">
                            <span>Grand Total</span>
                            <span>₹${displayTotal.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                    <div style="margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
                        Thank you for your business! If you have any questions, please contact us.
                    </div>
                </div>
            `;
        }

        // Default / Classic style
        return `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
                <div style="background: #ffffff; border-radius: 8px; border: 1px solid #eaecf0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); padding: 32px;">
                    <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
                        ${logoUrl 
                            ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 40px; display: block;" />`
                            : `<span style="font-size: 24px; font-weight: bold; color: #1e3a8a;">${companyName}</span>`
                        }
                        <span style="font-size: 14px; background: #eff6ff; color: #1e40af; padding: 6px 12px; border-radius: 20px; font-weight: 600; text-transform: uppercase;">Invoice Due</span>
                    </div>
                    <div style="font-size: 14px; line-height: 1.5; color: #4b5563; margin-bottom: 24px;">
                        <p>Dear <strong>${invoice.customer_name || 'Customer'}</strong>,</p>
                        <p>Thank you for shopping with us. We have generated invoice <strong>#${invoice.invoice_number || invoice.id}</strong> for your recent purchase.</p>
                    </div>
                    <div style="background: #f9fafb; border-radius: 6px; border: 1px solid #f3f4f6; padding: 16px; margin-bottom: 24px;">
                        <table style="width: 100%; font-size: 13px; color: #4b5563;">
                            <tr>
                                <td style="padding: 4px 0; color: #9ca3af;">Invoice Number:</td>
                                <td style="padding: 4px 0; text-align: right; font-weight: 600;">#${invoice.invoice_number || invoice.id}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #9ca3af;">Date:</td>
                                <td style="padding: 4px 0; text-align: right; font-weight: 600;">${invoice.date}</td>
                            </tr>
                            <tr>
                                <td style="padding: 4px 0; color: #9ca3af;">Total Amount:</td>
                                <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #111827; font-size: 15px;">₹${displayTotal.toLocaleString('en-IN')}</td>
                            </tr>
                            ${displayDue > 0 ? `
                            <tr>
                                <td style="padding: 4px 0; color: #ef4444; font-weight: 600;">Outstanding Due:</td>
                                <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #ef4444; font-size: 15px;">₹${displayDue.toLocaleString('en-IN')}</td>
                            </tr>
                            ` : ''}
                        </table>
                    </div>
                    <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">Purchase Summary</h4>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; color: #4b5563;">
                        <thead>
                            <tr style="color: #9ca3af;">
                                <th style="padding: 6px 0; border-bottom: 1px solid #e5e7eb; text-align: left;">Product</th>
                                <th style="padding: 6px 0; border-bottom: 1px solid #e5e7eb; text-align: center; width: 50px;">Qty</th>
                                <th style="padding: 6px 0; border-bottom: 1px solid #e5e7eb; text-align: right; width: 80px;">Price</th>
                                <th style="padding: 6px 0; border-bottom: 1px solid #e5e7eb; text-align: right; width: 100px;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsList}
                        </tbody>
                    </table>
                    <div style="font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.5; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                        <p>${companyName} | Phone: ${settings.phone || ''} | Email: ${settings.email || ''}</p>
                        <p style="margin-top: 4px;">This is an automated invoice transmission. Thank you for your support!</p>
                    </div>
                </div>
            </div>
        `;
    },

    generateOrderConfirmationTemplate(customerName, orderDetails, settings) {
        const logoUrl = settings.logo_url || getDefaultLogo();
        const companyName = getCompanyName(settings);
        return `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
                <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 32px; text-align: center; color: #ffffff;">
                    ${logoUrl 
                        ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 40px; margin-bottom: 12px; display: inline-block;" />` 
                        : ''
                    }
                    <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8; margin-bottom: 8px;">Order Placed Successfully</div>
                    <h2 style="margin: 0; font-size: 24px; font-weight: 800;">Order Confirmed</h2>
                </div>
                <div style="padding: 32px; color: #334155; line-height: 1.6;">
                    <p style="margin: 0 0 16px 0; font-size: 16px;">Dear <strong>${customerName}</strong>,</p>
                    <p style="margin: 0 0 24px 0;">We are thrilled to confirm your order has been received and is being processed. Below are the details of your confirmation.</p>
                    
                    <div style="background: #f8fafc; border-radius: 8px; padding: 20px; border: 1px solid #f1f5f9; margin-bottom: 24px;">
                        <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Order Details</h4>
                        <div style="font-size: 14px;">
                            ${orderDetails}
                        </div>
                    </div>

                    <p style="margin: 0 0 24px 0;">We will send another notification with tracking information as soon as your items are dispatched.</p>
                    
                    <div style="text-align: center;">
                        <a href="#" style="background: #0f172a; color: #ffffff; padding: 12px 32px; border-radius: 6px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 14px;">View In Portal</a>
                    </div>
                </div>
                <div style="background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0 0 4px 0; font-weight: bold; color: #334155;">${companyName}</p>
                    <p style="margin: 0;">Support: ${settings.email || ''} | Phone: ${settings.phone || ''}</p>
                </div>
            </div>
        `;
    },

    generateFeedbackTemplate(customerName, settings) {
        const logoUrl = settings.logo_url || getDefaultLogo();
        const companyName = getCompanyName(settings);
        return `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); overflow: hidden;">
                <div style="background: #0f172a; padding: 28px; text-align: center; color: #ffffff;">
                    ${logoUrl 
                        ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 40px; margin-bottom: 12px; display: inline-block;" />` 
                        : ''
                    }
                    <h2 style="margin: 0; font-size: 22px; font-weight: 700;">We'd Love Your Feedback!</h2>
                </div>
                <div style="padding: 32px; color: #334155; line-height: 1.6; text-align: center;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; text-align: left;">Dear <strong>${customerName}</strong>,</p>
                    <p style="margin: 0 0 24px 0; text-align: left;">Thank you for your recent purchase at <strong>${companyName}</strong>. We strive to provide the best possible experience, and your opinion helps us improve.</p>
                    
                    <p style="margin: 0 0 32px 0; font-weight: 600; color: #0f172a;">How would you rate your overall experience with us?</p>
                    
                    <div style="margin: 24px 0; display: inline-flex; gap: 12px;">
                        <span style="font-size: 32px; cursor: pointer; padding: 0 8px;">😠</span>
                        <span style="font-size: 32px; cursor: pointer; padding: 0 8px;">🙁</span>
                        <span style="font-size: 32px; cursor: pointer; padding: 0 8px;">😐</span>
                        <span style="font-size: 32px; cursor: pointer; padding: 0 8px;">🙂</span>
                        <span style="font-size: 32px; cursor: pointer; padding: 0 8px;">😍</span>
                    </div>

                    <p style="margin: 32px 0 24px 0; text-align: left;">Alternatively, you can write to us directly by replying to this email. We read every response!</p>
                    
                    <div style="text-align: center; margin-top: 32px;">
                        <a href="#" style="background: #3b82f6; color: #ffffff; padding: 12px 36px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);">Share Detailed Review</a>
                    </div>
                </div>
                <div style="background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0; font-weight: 600; color: #334155;">${companyName}</p>
                    <p style="margin: 4px 0 0 0;">Phone: ${settings.phone || ''} | Address: ${settings.address || ''}</p>
                </div>
            </div>
        `;
    },

    generateTestEmailTemplate(body, settings) {
        const companyName = getCompanyName(settings);
        const logoUrl = settings.logo_url || getDefaultLogo();
        const logoHtml = logoUrl 
            ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 48px; display: block; margin: 0 auto 12px auto;" />`
            : `<div style="font-size: 24px; font-weight: 800; color: #0071e3; margin-bottom: 8px; letter-spacing: -0.5px;">${companyName}</div>`;

        return `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="background: #f8fafc; padding: 32px; border-bottom: 1px solid #eaecf0; text-align: center;">
                    ${logoHtml}
                    <div style="font-size: 13px; font-weight: 600; color: #0071e3; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">Gmail Integration Test</div>
                </div>
                <div style="padding: 32px; color: #334155; line-height: 1.6;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #0f172a;">Test Email Successful!</p>
                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569;">
                        ${body || 'Hello! This is a test email sent from Maze ERP via Gmail OAuth.'}
                    </p>
                    <div style="background: rgba(52, 199, 89, 0.08); border: 1px solid rgba(52, 199, 89, 0.2); padding: 16px; border-radius: 8px; display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
                        <div style="color: #34c759; font-size: 18px; line-height: 1;">✓</div>
                        <div style="font-size: 13px; color: #278a3e;">
                            <strong>Active Connection Verified</strong><br/>
                            Your email service is configured correctly and ready to send invoices, confirmations, feedback forms, and email campaigns.
                        </div>
                    </div>
                </div>
                <div style="background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #86868b; border-top: 1px solid #eaecf0;">
                    <p style="margin: 0; font-weight: 600; color: #1d1d1f;">${companyName}</p>
                    <p style="margin: 4px 0 0 0;">${settings.address || ''}</p>
                    <p style="margin: 2px 0 0 0;">Support: ${settings.email || ''} | Phone: ${settings.phone || ''}</p>
                </div>
            </div>
        `;
    }
};

module.exports = gmailSender;
