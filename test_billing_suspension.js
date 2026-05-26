const db = require('./backend/db.js');
const { getDayOfMonth, calculateCurrentDue, isBillingBlocked } = require('./backend/services/billingHelper');
const gmailSender = require('./backend/services/email/gmailSender');
const whatsappSender = require('./backend/services/whatsappSender');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('==================================================');
    console.log('STARTING BILLING AUTO-SUSPENSION VERIFICATION');
    console.log('==================================================');

    await db.ready;
    console.log('Database connected successfully.');

    // 1. Backup existing settings & agents
    const backupSettings = {};
    const settingsToBackup = [
        'billing_simulated_day',
        'billing_whatsapp_non_csw_count',
        'billing_voice_agent_seconds',
        'billing_email_sent_count',
        'billing_email_package_due',
        'billing_payment_method_added',
        'billing_payment_method_autopay',
        'billing_email_package_active',
        'billing_last_payment_date'
    ];

    for (const key of settingsToBackup) {
        const row = db.get("SELECT value FROM settings WHERE key = ?", [key]);
        backupSettings[key] = row ? row.value : null;
    }

    // Save existing agents to restore later
    const originalAgents = db.all("SELECT * FROM mazeway_agents");
    db.run("DELETE FROM mazeway_agents"); // clear for clean test run

    let testSuccess = true;

    try {
        // Setup initial test data: create an active voice agent with starter plan (price 600)
        db.run(
            `INSERT INTO mazeway_agents (id, name, type, persona, status, is_active, config)
             VALUES ('TEST_AGENT_01', 'Test Voice Agent', 'Voice', 'Sales', 'ACTIVE', 1, ?)`,
            [JSON.stringify({ plan: 'starter', price: 600, phone_number: '+91 99990 00001' })]
        );

        // Populate usage counts to accumulate outstanding dues
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_whatsapp_non_csw_count', '10')"); // ₹2.00
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_voice_agent_seconds', '120')"); // ₹20.00
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_email_sent_count', '1050')"); // 50 overage emails = ₹2.50
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_payment_method_added', 'false')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_email_package_active', 'false')");
        db.run("DELETE FROM settings WHERE key = 'billing_last_payment_date'");

        // Verify calculations: dues should be WhatsApp (₹2) + Voice (₹20) + Email (₹2.50) + VoIP Sub (₹600) = ₹624.50
        const rows = db.all("SELECT key, value FROM settings");
        const settingsMap = {};
        rows.forEach(r => { settingsMap[r.key] = r.value; });
        const dues = await calculateCurrentDue(settingsMap);
        
        console.log(`\nCalculated Dues:`);
        console.log(`- WhatsApp Cost: ₹${dues.whatsappCost}`);
        console.log(`- Voice Cost: ₹${dues.voiceCost}`);
        console.log(`- Email Cost: ₹${dues.emailCost}`);
        console.log(`- VoIP Number Cost: ₹${dues.numberCost}`);
        console.log(`- Total Due: ₹${dues.totalDue}`);

        if (dues.totalDue !== 624.50) {
            console.error(`❌ FAILED: Expected total due to be ₹624.50, but got ₹${dues.totalDue}`);
            testSuccess = false;
        } else {
            console.log('✅ PASSED: Overage & Subscription calculations match.');
        }

        // ==========================================
        // TEST CASE 1: Day 3 (Grace Period - Active)
        // ==========================================
        console.log('\n--- Test Case 1: Day 3 (Grace Period - Active) ---');
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_simulated_day', '3')");
        const isBlockedDay3 = await isBillingBlocked();
        console.log(`Is billing blocked on Day 3? ${isBlockedDay3}`);
        if (isBlockedDay3 !== false) {
            console.error('❌ FAILED: Billing should NOT be blocked during grace period (Day <= 5)');
            testSuccess = false;
        } else {
            console.log('✅ PASSED: Services remain active on Day 3.');
        }

        // ==========================================
        // TEST CASE 2: Day 6 (Grace Overdue - Blocked)
        // ==========================================
        console.log('\n--- Test Case 2: Day 6 (Grace Overdue - Blocked) ---');
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_simulated_day', '6')");
        const isBlockedDay6 = await isBillingBlocked();
        console.log(`Is billing blocked on Day 6? ${isBlockedDay6}`);
        if (isBlockedDay6 !== true) {
            console.error('❌ FAILED: Billing should be blocked after grace period (Day >= 6)');
            testSuccess = false;
        } else {
            console.log('✅ PASSED: Services auto-suspended on Day 6.');
        }

        // ==========================================
        // TEST CASE 3: Day 29 (Cycle End - Blocked)
        // ==========================================
        console.log('\n--- Test Case 3: Day 29 (Billing Cycle End - Blocked) ---');
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_simulated_day', '29')");
        const isBlockedDay29 = await isBillingBlocked();
        console.log(`Is billing blocked on Day 29? ${isBlockedDay29}`);
        if (isBlockedDay29 !== true) {
            console.error('❌ FAILED: Billing should be blocked on Day 29');
            testSuccess = false;
        } else {
            console.log('✅ PASSED: Services remain suspended at end of cycle.');
        }

        // ==========================================
        // TEST CASE 4: Service Restrictions (Send Blocked)
        // ==========================================
        console.log('\n--- Test Case 4: Verify email and whatsapp send restrictions when blocked ---');
        
        // Gmail send try
        try {
            await gmailSender.sendMail({
                senderEmail: 'test@gmail.com',
                to: 'customer@gmail.com',
                subject: 'Invoice',
                htmlBody: '<p>Test</p>'
            });
            console.error('❌ FAILED: Gmail sender did not throw billing blocked error');
            testSuccess = false;
        } catch (err) {
            if (err.message.includes('Email Service Blocked')) {
                console.log('✅ PASSED: Gmail sender threw correct block message:', err.message);
            } else {
                console.error('❌ FAILED: Unexpected error from Gmail sender:', err.message);
                testSuccess = false;
            }
        }

        // WhatsApp text try
        try {
            await whatsappSender.sendText('919999012345', 'Hello');
            console.error('❌ FAILED: WhatsApp sender did not throw billing blocked error');
            testSuccess = false;
        } catch (err) {
            if (err.message.includes('WhatsApp Service Blocked')) {
                console.log('✅ PASSED: WhatsApp sender threw correct block message:', err.message);
            } else {
                console.error('❌ FAILED: Unexpected error from WhatsApp sender:', err.message);
                testSuccess = false;
            }
        }

        // ==========================================
        // TEST CASE 5: Payment Clearance & Instant Activation
        // ==========================================
        console.log('\n--- Test Case 5: Clear Dues (Payment Simulation) ---');
        // Reset usage counters like /pay-dues route does
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_whatsapp_non_csw_count', '0')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_voice_agent_seconds', '0')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_email_sent_count', '0')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_email_package_due', '0')");
        
        // Simulate payment date set to today in the database to clear subscription dues
        const todayStr = new Date().toLocaleDateString('en-IN');
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_last_payment_date', ?)", [todayStr]);

        // Verify blocked status now
        const isBlockedAfterPayment = await isBillingBlocked();
        console.log(`Is billing blocked after paying dues? ${isBlockedAfterPayment}`);
        if (isBlockedAfterPayment !== false) {
            console.error('❌ FAILED: Account should be unblocked instantly after dues are cleared.');
            testSuccess = false;
        } else {
            console.log('✅ PASSED: Account unblocked successfully.');
        }

        // ==========================================
        // TEST CASE 6: Payment Method Out-of-CSW Templates Restriction
        // ==========================================
        console.log('\n--- Test Case 6: Payment Method Check for Out-of-CSW Templates ---');
        // Ensure billing is NOT blocked but no payment method is added
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_payment_method_added', 'false')");
        
        try {
            // Send template outside active session (session inactive by default in tests)
            await whatsappSender.sendTemplate('919999012345', 'invoice_ready');
            console.error('❌ FAILED: WhatsApp template sent without payment method');
            testSuccess = false;
        } catch (err) {
            if (err.message.includes('Payment Method Required')) {
                console.log('✅ PASSED: WhatsApp blocked sending templates outside CSW without card setup:', err.message);
            } else {
                console.error('❌ FAILED: Unexpected error from WhatsApp template:', err.message);
                testSuccess = false;
            }
        }

    } catch (e) {
        console.error('❌ CRITICAL ERROR IN TEST SUITE:', e);
        testSuccess = false;
    } finally {
        // Restore backup settings
        console.log('\nRestoring original database settings...');
        for (const [key, val] of Object.entries(backupSettings)) {
            if (val === null) {
                db.run("DELETE FROM settings WHERE key = ?", [key]);
            } else {
                db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, val]);
            }
        }

        // Restore original agents
        db.run("DELETE FROM mazeway_agents");
        for (const agent of originalAgents) {
            db.run(
                `INSERT INTO mazeway_agents (id, name, type, persona, status, is_active, config, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [agent.id, agent.name, agent.type, agent.persona, agent.status, agent.is_active, agent.config, agent.created_at]
            );
        }

        console.log('Database restore complete.');
    }

    console.log('==================================================');
    if (testSuccess) {
        console.log('🎉 ALL BILLING SUSPENSION TESTS PASSED SUCCESSFULLY! 🎉');
    } else {
        console.error('🚨 SOME TESTS FAILED. PLEASE VERIFY SYSTEM LOGS. 🚨');
    }
    console.log('==================================================');

    process.exit(testSuccess ? 0 : 1);
}

runTests();
