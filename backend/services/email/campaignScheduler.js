const db = require('../../db');
const EmailConnection = require('../../models/EmailConnection');
const gmailSender = require('./gmailSender');

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

        // Get first active connection to use as sender
        const connections = await EmailConnection.getConnections();
        const activeConnection = connections.find(c => c.status === 'Active');

        for (const campaign of campaigns) {
            // Check if start_date has arrived or passed
            if (currentDateStr < campaign.start_date) continue;

            // Check if campaign has expired (past end_date)
            if (campaign.end_date && currentDateStr > campaign.end_date) {
                console.log(`[Campaign Scheduler] Campaign "${campaign.name}" (ID: ${campaign.id}) has expired (End Date: ${campaign.end_date}). Marking as cancelled.`);
                db.run("UPDATE email_campaigns SET status = 'cancelled' WHERE id = ?", [campaign.id]);
                continue;
            }
            
            // Check if start date is today and time has arrived, or if start date was in the past
            if (currentDateStr === campaign.start_date && currentTimeStr < campaign.time_to_send) continue;

            console.log(`[Campaign Scheduler] Executing campaign "${campaign.name}" (ID: ${campaign.id})...`);
            
            // Mark as sending to prevent duplicate executions
            db.run("UPDATE email_campaigns SET status = 'sending' WHERE id = ?", [campaign.id]);

            if (!activeConnection) {
                console.error(`[Campaign Scheduler] Failed to run campaign "${campaign.name}": No active Gmail connection found.`);
                db.run("UPDATE email_campaigns SET status = 'failed' WHERE id = ?", [campaign.id]);
                continue;
            }

            const customerIds = JSON.parse(campaign.customers || '[]');
            const templateType = campaign.template;
            
            let successCount = 0;
            let failCount = 0;

            for (const customerId of customerIds) {
                try {
                    const customer = db.get("SELECT * FROM customers WHERE id = ?", [customerId]);
                    if (!customer || !customer.email) {
                        failCount++;
                        continue;
                    }

                    // Build email content based on selected template
                    let subject = '';
                    let htmlBody = '';
                    
                    const settingsRows = db.all('SELECT key, value FROM settings');
                    const settings = {};
                    settingsRows.forEach(r => { settings[r.key] = r.value; });

                    if (templateType === 'order_confirmation') {
                        subject = `Order Confirmation - ${settings.company_name || 'Maze ERP'}`;
                        const orderDetails = `
                            <p>Thank you for your order! Your confirmation details are being processed.</p>
                            <p><strong>Customer Name:</strong> ${customer.name}</p>
                            <p><strong>Support Email:</strong> ${settings.email || 'N/A'}</p>
                        `;
                        htmlBody = gmailSender.generateOrderConfirmationTemplate(customer.name, orderDetails, settings);
                    } else if (templateType === 'feedback') {
                        subject = `Feedback Request - ${settings.company_name || 'Maze ERP'}`;
                        htmlBody = gmailSender.generateFeedbackTemplate(customer.name, settings);
                    } else {
                        // General marketing message or invoice style
                        subject = `${campaign.name} - Special Update`;
                        const logoUrl = settings.logo_url || '';
                        const companyName = settings.company_name || 'Maze ERP';
                        const logoHtml = logoUrl 
                            ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 40px; margin-bottom: 12px; display: inline-block;" />` 
                            : '';
                        
                        htmlBody = `
                            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                                <div style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 32px; text-align: center; color: #ffffff;">
                                    ${logoHtml}
                                    <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #93c5fd; margin-bottom: 8px;">Exclusive Newsletter</div>
                                    <h2 style="margin: 0; font-size: 24px; font-weight: 800;">${campaign.name || 'Special Update'}</h2>
                                </div>
                                <div style="padding: 32px; color: #334155; line-height: 1.6; font-size: 14px;">
                                    <p style="margin: 0 0 16px 0; font-size: 16px;">Hello <strong>${customer.name}</strong>,</p>
                                    <p style="margin: 0 0 24px 0;">We wanted to reach out and share an exciting update regarding our latest products and services. We are continuously working to improve your experience.</p>
                                    
                                    <div style="background: #eff6ff; border-radius: 8px; padding: 20px; border: 1px solid #dbeafe; margin-bottom: 24px; color: #1e3a8a;">
                                        <p style="margin: 0; font-weight: 600; font-size: 15px;">What's New?</p>
                                        <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px; color: #1e40af;">
                                            <li>Premium updates to client communication systems</li>
                                            <li>Enhanced discount and marketing coupon management</li>
                                            <li>Real-time campaign tracking and template styling</li>
                                        </ul>
                                    </div>

                                    <p style="margin: 0 0 24px 0;">Thank you for being a valued customer and choosing <strong>${companyName}</strong>!</p>
                                    
                                    <div style="text-align: center;">
                                        <a href="#" style="background: #1e3a8a; color: #ffffff; padding: 12px 32px; border-radius: 6px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(30, 58, 138, 0.2);">Explore Updates</a>
                                    </div>
                                </div>
                                <div style="background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9;">
                                    <p style="margin: 0 0 4px 0; font-weight: bold; color: #334155;">${companyName}</p>
                                    <p style="margin: 0;">Support: ${settings.email || ''} | Phone: ${settings.phone || ''}</p>
                                </div>
                            </div>
                        `;
                    }

                    await gmailSender.sendMail({
                        senderEmail: activeConnection.email,
                        to: customer.email,
                        subject,
                        htmlBody
                    });

                    // Log communication
                    db.run(
                        "INSERT INTO customer_communication_logs (customer_id, type, notes) VALUES (?, 'Email', ?)",
                        [customer.id, `Sent campaign email: "${campaign.name}" (Template: ${templateType})`]
                    );

                    successCount++;
                } catch (e) {
                    console.error(`[Campaign Scheduler] Failed to send campaign email to customer ID ${customerId}:`, e.message);
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
    console.log('[Campaign Scheduler] Starting background campaign runner (Interval: 1 minute)...');
    setInterval(processCampaigns, 60000); // Check every 60 seconds
}

module.exports = { startCampaignScheduler };
