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
                        htmlBody = `
                            <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333;">
                                <h2>Hello ${customer.name},</h2>
                                <p>We wanted to reach out and share an update regarding our latest services.</p>
                                <p>Thank you for choosing ${settings.company_name || 'Maze ERP'}!</p>
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
