const db = require('../../db');
const EmailConnection = require('../../models/EmailConnection');
const gmailSender = require('./gmailSender');
const whatsappSender = require('../whatsappSender');
const { generateInvoicePDF } = require('../pdfGenerator');

let lastReminderDate = '';

// Helper to wrap campaign HTML nicely
function wrapCampaignHtml(title, customerName, innerContent, settings) {
    const logoUrl = settings.logo_url || '';
    const companyName = settings.company_name || 'Maze ERP';
    const logoHtml = logoUrl 
        ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 40px; margin-bottom: 12px; display: inline-block;" />` 
        : '';

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 32px; text-align: center; color: #ffffff;">
                ${logoHtml}
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #93c5fd; margin-bottom: 8px;">${companyName}</div>
                <h2 style="margin: 0; font-size: 24px; font-weight: 800;">${title}</h2>
            </div>
            <div style="padding: 32px; color: #334155; line-height: 1.6; font-size: 14px;">
                <p style="margin: 0 0 16px 0; font-size: 16px;">Hello <strong>${customerName}</strong>,</p>
                ${innerContent}
            </div>
            <div style="background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0 0 4px 0; font-weight: bold; color: #334155;">${companyName}</p>
                <p style="margin: 0;">Support: ${settings.email || ''} | Phone: ${settings.phone || ''}</p>
            </div>
        </div>
    `;
}

// Check and process due payment reminders
async function checkDuePaymentReminders() {
    try {
        await db.ready;
        const today = new Date().toISOString().split('T')[0];
        if (lastReminderDate === today) return; // Already run today
        
        console.log('[Reminder Service] Checking for due payment reminders...');
        
        const settingsRows = db.all('SELECT key, value FROM settings');
        const settings = {};
        settingsRows.forEach(r => { settings[r.key] = r.value; });
        
        const emailEnabled = settings.auto_email_due_reminder === 'true';
        const whatsappEnabled = settings.auto_whatsapp_due_reminder === 'true';
        if (!emailEnabled && !whatsappEnabled) {
            lastReminderDate = today;
            return;
        }

        const emailDays = parseInt(settings.auto_email_due_reminder_days || '7', 10);
        const whatsappDays = parseInt(settings.auto_whatsapp_due_reminder_days || '7', 10);

        // Fetch unpaid/partial invoices
        const invoices = db.all("SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.payment_status != 'Paid'");
        
        const todayMs = new Date(today).getTime();

        for (const invoice of invoices) {
            const invoiceDateStr = invoice.date; // YYYY-MM-DD
            if (!invoiceDateStr) continue;
            
            const invoiceMs = new Date(invoiceDateStr).getTime();
            const ageDays = Math.floor((todayMs - invoiceMs) / (1000 * 60 * 60 * 24));
            if (ageDays < 0) continue;

            const outstandingDue = Number(invoice.total) - Number(invoice.paid_amount);
            if (outstandingDue <= 0) continue;

            // Fetch items
            const items = db.all("SELECT * FROM invoice_items WHERE invoice_id = ?", [invoice.id]);
            const invoiceObj = { ...invoice, items };

            // 1. Gmail Due Reminder
            if (emailEnabled && ageDays >= emailDays) {
                const logKey = `Due Reminder Sent for Invoice #${invoice.id} via Gmail`;
                const alreadySent = db.get("SELECT id FROM customer_communication_logs WHERE customer_id = ? AND notes LIKE ?", [invoice.customer_id, `%${logKey}%`]);
                
                if (!alreadySent && invoice.customer_email) {
                    const activeConn = db.get("SELECT email FROM email_connections WHERE status = 'Active' LIMIT 1");
                    if (activeConn) {
                        try {
                            const subject = `Due Payment Reminder: Invoice #${invoice.invoice_number || invoice.id}`;
                            const htmlBody = gmailSender.generateInvoiceTemplate(invoiceObj, settings, settings.invoice_style || 'classic');
                            await gmailSender.sendMail({
                                senderEmail: activeConn.email,
                                to: invoice.customer_email,
                                subject,
                                htmlBody
                            });
                            
                            db.run(
                                "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'Email', ?)",
                                [invoice.customer_id, logKey]
                            );
                            console.log(`[Reminder Service] Sent Gmail due reminder for invoice #${invoice.id} to ${invoice.customer_email}`);
                        } catch (err) {
                            console.error(`[Reminder Service] Failed to send Gmail reminder for invoice #${invoice.id}:`, err.message);
                        }
                    }
                }
            }

            // 2. WhatsApp Due Reminder
            if (whatsappEnabled && ageDays >= whatsappDays) {
                const logKey = `Due Reminder Sent for Invoice #${invoice.id} via WhatsApp`;
                const alreadySent = db.get("SELECT id FROM customer_communication_logs WHERE customer_id = ? AND notes LIKE ?", [invoice.customer_id, `%${logKey}%`]);
                
                const recipientPhone = invoice.customer_phone || invoice.walk_in_phone;
                if (!alreadySent && recipientPhone) {
                    try {
                        const pdfBuffer = await generateInvoicePDF(invoiceObj, settings);
                        const filename = `Invoice_${String(invoice.id).padStart(4, '0')}.pdf`;
                        const caption = `Dear customer, please find attached outstanding due reminder for Invoice #${invoice.invoice_number || invoice.id}. Outstanding balance: ₹${outstandingDue.toFixed(2)}`;
                        
                        await whatsappSender.sendInvoicePDF(recipientPhone, pdfBuffer, filename, caption);
                        
                        db.run(
                            "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'SMS', ?)",
                            [invoice.customer_id, logKey]
                        );
                        console.log(`[Reminder Service] Sent WhatsApp due reminder for invoice #${invoice.id} to ${recipientPhone}`);
                    } catch (err) {
                        console.error(`[Reminder Service] Failed to send WhatsApp reminder for invoice #${invoice.id}:`, err.message);
                    }
                }
            }
        }
        
        lastReminderDate = today;
    } catch (err) {
        console.error('[Reminder Service] Error running check:', err);
    }
}

async function processCampaigns() {
    try {
        await db.ready;
        // Check for scheduled campaigns
        const campaigns = db.all("SELECT * FROM email_campaigns WHERE status = 'scheduled'");
        if (campaigns.length === 0) return;

        const now = new Date();
        const currentDateStr = now.toLocaleDateString('sv-SE'); // YYYY-MM-DD format
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMinutes}`;

        // Get active Gmail sender
        const connections = await EmailConnection.getConnections();
        const activeConnection = connections.find(c => c.status === 'Active');

        // Get active WhatsApp connection
        const activeWhatsApp = db.get("SELECT phone_number_id, token FROM whatsapp_connections WHERE status = 'Active' LIMIT 1");

        for (const campaign of campaigns) {
            // Check if start_date has arrived or passed
            if (currentDateStr < campaign.start_date) continue;

            // Check if campaign has expired (past end_date)
            if (campaign.end_date && currentDateStr > campaign.end_date) {
                console.log(`[Campaign Scheduler] Campaign "${campaign.name}" (ID: ${campaign.id}) has expired. Marking as cancelled.`);
                db.run("UPDATE email_campaigns SET status = 'cancelled' WHERE id = ?", [campaign.id]);
                continue;
            }
            
            // Check if start date is today and time has arrived
            if (currentDateStr === campaign.start_date && currentTimeStr < campaign.time_to_send) continue;

            console.log(`[Campaign Scheduler] Executing campaign "${campaign.name}" (ID: ${campaign.id})...`);
            
            // Mark as sending
            db.run("UPDATE email_campaigns SET status = 'sending' WHERE id = ?", [campaign.id]);

            const campaignChannel = campaign.channel || 'email';

            if (campaignChannel === 'email' && !activeConnection) {
                console.error(`[Campaign Scheduler] Failed to run campaign "${campaign.name}": No active Gmail connection.`);
                db.run("UPDATE email_campaigns SET status = 'failed' WHERE id = ?", [campaign.id]);
                continue;
            }

            if (campaignChannel === 'whatsapp' && !activeWhatsApp) {
                // Fallback check: is there a setting credential?
                const globalWaToken = db.get("SELECT value FROM settings WHERE key = 'whatsapp_token'")?.value;
                if (!globalWaToken) {
                    console.error(`[Campaign Scheduler] Failed to run campaign "${campaign.name}": No active WhatsApp connection or credentials.`);
                    db.run("UPDATE email_campaigns SET status = 'failed' WHERE id = ?", [campaign.id]);
                    continue;
                }
            }

            const customerIds = JSON.parse(campaign.customers || '[]');
            const templateType = campaign.template;
            
            let successCount = 0;
            let failCount = 0;

            const settingsRows = db.all('SELECT key, value FROM settings');
            const settings = {};
            settingsRows.forEach(r => { settings[r.key] = r.value; });
            const companyName = settings.company_name || 'Maze ERP';

            for (const customerId of customerIds) {
                try {
                    const customer = db.get("SELECT * FROM customers WHERE id = ?", [customerId]);
                    if (!customer) {
                        failCount++;
                        continue;
                    }

                    // For email we need email address, for whatsapp we need phone number
                    if (campaignChannel === 'email' && !customer.email) {
                        failCount++;
                        continue;
                    }
                    if (campaignChannel === 'whatsapp' && !customer.phone) {
                        failCount++;
                        continue;
                    }

                    // 1. Handle special templates
                    let subject = '';
                    let htmlBody = '';
                    let textBody = '';
                    let skipCustomer = false;

                    if (templateType === 'due_balance') {
                        // Query unpaid invoices to get total due
                        const unpaidInvoices = db.all("SELECT * FROM invoices WHERE customer_id = ? AND payment_status != 'Paid'", [customer.id]);
                        const totalDue = unpaidInvoices.reduce((sum, inv) => sum + (Number(inv.total) - Number(inv.paid_amount)), 0);

                        if (totalDue <= 0) {
                            skipCustomer = true; // Skip customer if they have no due balance
                        } else {
                            subject = `Outstanding Due Balance Statement - ${companyName}`;
                            textBody = `Outstanding Due Reminder:\n\nDear ${customer.name},\n\nYou have an outstanding due balance of ₹${totalDue.toLocaleString('en-IN')} at ${companyName}. Please clear your balance as soon as possible. Thank you!`;
                            
                            const innerHtml = `
                                <p>Our records show that you have an outstanding due balance of <strong>₹${totalDue.toLocaleString('en-IN')}</strong>.</p>
                                <p>Below is the list of your unpaid invoices:</p>
                                <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
                                    <thead>
                                        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569;">
                                            <th style="padding: 8px; text-align: left;">Invoice ID</th>
                                            <th style="padding: 8px; text-align: left;">Date</th>
                                            <th style="padding: 8px; text-align: right;">Total Amount</th>
                                            <th style="padding: 8px; text-align: right;">Outstanding Due</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${unpaidInvoices.map(inv => `
                                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                                <td style="padding: 8px;">#${inv.invoice_number || inv.id}</td>
                                                <td style="padding: 8px;">${inv.date}</td>
                                                <td style="padding: 8px; text-align: right;">₹${inv.total.toLocaleString('en-IN')}</td>
                                                <td style="padding: 8px; text-align: right; color: #ef4444; font-weight: bold;">₹${(inv.total - inv.paid_amount).toLocaleString('en-IN')}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                                <p>Please complete your payment at your earliest convenience.</p>
                            `;
                            htmlBody = wrapCampaignHtml(campaign.name, customer.name, innerHtml, settings);
                        }
                    } else if (templateType === 'festival_offer') {
                        subject = `Festival Special Offer! Diwali/Holi/Eid Sale - ${companyName}`;
                        textBody = `Festival Sale Greetings!\n\nDear ${customer.name},\n\nCelebrate this festive season with our exclusive Diwali/Holi/Eid sale. Enjoy special deals and discounts on all our products! Visit us today!`;
                        
                        const innerHtml = `
                            <p>Celebrate this festive season with our exclusive **Diwali / Holi / Eid Sale**!</p>
                            <p>Enjoy special deals, seasonal catalogs, and limited-time discounts across our entire store. Be sure to check them out today!</p>
                        `;
                        htmlBody = wrapCampaignHtml("Festival Sale!", customer.name, innerHtml, settings);
                    } else if (templateType === 'discount_coupon') {
                        // Fetch latest coupon
                        const latestCoupon = db.get("SELECT * FROM coupons ORDER BY id DESC LIMIT 1");
                        const couponCode = latestCoupon ? latestCoupon.code : 'WELCOME10';
                        const discountDesc = latestCoupon ? `${latestCoupon.type === 'percentage' ? `${latestCoupon.value}%` : `₹${latestCoupon.value}`} Flat Discount` : 'Special Discount';

                        subject = `Exclusive Discount Promo Code - ${companyName}`;
                        textBody = `Exclusive Discount!\n\nDear ${customer.name},\n\nHere is your exclusive promo code: ${couponCode}.\nUse this code at checkout to claim ${discountDesc} on your next order! Valid for a limited time.`;
                        
                        const innerHtml = `
                            <p>We are pleased to offer you an exclusive discount on your next purchase!</p>
                            <div style="background: #f0fdf4; border: 1px dashed #22c55e; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                                <div style="font-size: 13px; color: #166534; font-weight: 600; text-transform: uppercase;">Your Coupon Code</div>
                                <div style="font-size: 28px; font-weight: bold; color: #15803d; margin: 8px 0; letter-spacing: 2px;">${couponCode}</div>
                                <div style="font-size: 14px; color: #166534;">Get <strong>${discountDesc}</strong> at checkout!</div>
                            </div>
                            <p>Hurry, this offer is valid for a limited time only.</p>
                        `;
                        htmlBody = wrapCampaignHtml("Exclusive Discount!", customer.name, innerHtml, settings);
                    } else if (templateType === 'new_arrivals') {
                        subject = `Discover Our New Arrivals! - ${companyName}`;
                        textBody = `New Arrivals!\n\nDear ${customer.name},\n\nWe have just launched our brand new products and latest collections. Check them out today before they sell out!`;
                        
                        const innerHtml = `
                            <p>We are thrilled to announce that our **New Arrivals** are officially here!</p>
                            <p>Discover fresh collections, advanced new inventory, and cutting-edge products designed to fit your needs perfectly. Visit our catalog today to check them out!</p>
                        `;
                        htmlBody = wrapCampaignHtml("New Arrivals!", customer.name, innerHtml, settings);
                    } else if (templateType === 'flash_sale') {
                        subject = `Flash Sale Alert! Limited Time Offer - ${companyName}`;
                        textBody = `Flash Sale Alert!\n\nDear ${customer.name},\n\nOur Flash Sale is live! Slashed prices on our top products for a limited time only. Hurry and order now!`;
                        
                        const innerHtml = `
                            <p>Our **Flash Sale** is officially live for a very limited time!</p>
                            <p>Prices have been heavily slashed across selected high-demand products. Don't wait — grab your favorites before the timer runs out!</p>
                        `;
                        htmlBody = wrapCampaignHtml("Flash Sale Alert!", customer.name, innerHtml, settings);
                    } else if (templateType === 'clearance_sale') {
                        subject = `Stock Clearance Sale! Everything Must Go - ${companyName}`;
                        textBody = `Clearance Sale!\n\nDear ${customer.name},\n\nClearance Sale is live now! Get massive discounts on remaining inventory. Grab them while stocks last!`;
                        
                        const innerHtml = `
                            <p>Get ready for our massive **Stock Clearance Sale**!</p>
                            <p>We are clearing out inventory to make room for new stock. Take advantage of our lowest prices ever. Quantities are highly limited, so shop today!</p>
                        `;
                        htmlBody = wrapCampaignHtml("Clearance Sale!", customer.name, innerHtml, settings);
                    } else if (templateType === 'back_in_stock') {
                        subject = `Good News! High-Demand Products Back In Stock - ${companyName}`;
                        textBody = `Back In Stock!\n\nDear ${customer.name},\n\nYour favorite products are now back in stock and ready to order. Get yours today before they are sold out again!`;
                        
                        const innerHtml = `
                            <p>We've got great news! Your favorite products are officially **Back In Stock**!</p>
                            <p>We have restocked our most popular products, and they are now ready for immediate billing and delivery. Order yours now while supplies last.</p>
                        `;
                        htmlBody = wrapCampaignHtml("Back In Stock!", customer.name, innerHtml, settings);
                    } else if (templateType === 'order_confirmation') {
                        subject = `Order Confirmation - ${companyName}`;
                        const orderDetails = `
                            <p>Thank you for your order! Your confirmation details are being processed.</p>
                            <p><strong>Customer Name:</strong> ${customer.name}</p>
                            <p><strong>Support Email:</strong> ${settings.email || 'N/A'}</p>
                        `;
                        htmlBody = gmailSender.generateOrderConfirmationTemplate(customer.name, orderDetails, settings);
                        textBody = `Order Confirmed!\n\nDear ${customer.name},\n\nThank you for your order. We have successfully received it and are processing it. We will notify you once shipped.`;
                    } else if (templateType === 'feedback') {
                        subject = `Feedback Request - ${companyName}`;
                        htmlBody = gmailSender.generateFeedbackTemplate(customer.name, settings);
                        textBody = `We'd Love Your Feedback!\n\nDear ${customer.name},\n\nThank you for shopping at ${companyName}. We hope you had a great experience. Please reply to this message with your rating (1-5 stars) and feedback!`;
                    } else if (templateType === 'invoice_email') {
                        // Find the customer's latest invoice
                        const latestInvoice = db.get("SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1", [customer.id]);
                        let invoiceObj;
                        if (latestInvoice) {
                            const items = db.all("SELECT * FROM invoice_items WHERE invoice_id = ?", [latestInvoice.id]);
                            invoiceObj = { ...latestInvoice, items, customer_name: customer.name, customer_email: customer.email };
                        } else {
                            invoiceObj = {
                                invoice_number: 'MOCK-001',
                                date: new Date().toLocaleDateString('en-IN'),
                                customer_name: customer.name,
                                customer_email: customer.email,
                                total: 10000,
                                paid_amount: 10000,
                                items: [
                                    { product_name: 'Premium Office Chair', variant_name: 'Mesh Black', quantity: 1, price: 8500, total: 8500 },
                                    { product_name: 'Wireless Keyboard', variant_name: '', quantity: 1, price: 1500, total: 1500 }
                                ]
                            };
                        }
                        subject = `Invoice #${invoiceObj.invoice_number || invoiceObj.id} from ${companyName}`;
                        const activeStyle = settings.invoice_style || 'classic';
                        htmlBody = gmailSender.generateInvoiceTemplate(invoiceObj, settings, activeStyle);
                        textBody = `Invoice Notification:\n\nDear ${customer.name}, please find attached invoice #${invoiceObj.invoice_number || invoiceObj.id} for your purchase of ₹${invoiceObj.total}. Thank you!`;
                    } else {
                        // General marketing message or newsletter style
                        subject = `${campaign.name} - Special Update`;
                        const innerHtml = `
                            <p>We wanted to reach out and share an exciting update regarding our latest products and services. We are continuously working to improve your experience.</p>
                        `;
                        htmlBody = wrapCampaignHtml(campaign.name, customer.name, innerHtml, settings);
                        textBody = `Special Update from ${companyName}:\n\nDear ${customer.name},\n\nWe wanted to share some exciting news regarding our latest products and inventory updates. Contact us for more details!`;
                    }

                    if (skipCustomer) {
                        continue;
                    }

                    // 2. Dispatch based on channel
                    if (campaignChannel === 'email') {
                        await gmailSender.sendMail({
                            senderEmail: activeConnection.email,
                            to: customer.email,
                            subject,
                            htmlBody
                        });

                        db.run(
                            "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'Email', ?)",
                            [customer.id, `Sent campaign email: "${campaign.name}" (Template: ${templateType})`]
                        );
                    } else if (campaignChannel === 'whatsapp') {
                        await whatsappSender.sendText(customer.phone, textBody);

                        db.run(
                            "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'SMS', ?)",
                            [customer.id, `Sent campaign WhatsApp: "${campaign.name}" (Template: ${templateType})`]
                        );
                    }

                    successCount++;
                } catch (e) {
                    console.error(`[Campaign Scheduler] Failed to send campaign to customer ID ${customerId} on ${campaignChannel}:`, e.message);
                    failCount++;
                }
            }

            console.log(`[Campaign Scheduler] Campaign "${campaign.name}" complete. Sent: ${successCount}, Failed: ${failCount}`);
            db.run("UPDATE email_campaigns SET status = 'completed' WHERE id = ?", [campaign.id]);
        }
    } catch (err) {
        console.error('[Campaign Scheduler] Error processing campaigns:', err);
    }
}

function startCampaignScheduler() {
    console.log('[Campaign Scheduler] Starting background campaign and reminder runner...');
    
    // Check campaigns every 60 seconds
    setInterval(processCampaigns, 60000);
    
    // Run due reminders check every 30 minutes
    setInterval(checkDuePaymentReminders, 1800000);
    
    // Run once immediately on start
    setTimeout(() => {
        processCampaigns();
        checkDuePaymentReminders();
    }, 5000);
}

module.exports = { startCampaignScheduler, checkDuePaymentReminders };
