const db = require('../db');

function getDayOfMonth(settings) {
    if (process.env.BILLING_SIMULATED_DAY && !isNaN(process.env.BILLING_SIMULATED_DAY)) {
        return parseInt(process.env.BILLING_SIMULATED_DAY, 10);
    }
    const simDay = settings.billing_simulated_day;
    if (simDay && !isNaN(simDay) && simDay !== '') {
        return parseInt(simDay, 10);
    }
    return new Date().getDate();
}

async function calculateCurrentDue(settings) {
    const whatsappCount = Number(settings.billing_whatsapp_non_csw_count || 0);
    const whatsappCost = whatsappCount * 0.30;

    const voiceSeconds = Number(settings.billing_voice_agent_seconds || 0);
    const voiceMinutes = voiceSeconds / 60;
    const voiceCost = voiceMinutes * 10;

    const emailCount = Number(settings.billing_email_sent_count || 0);
    const emailPackageActive = settings.billing_email_package_active === 'true';
    let emailCost = 0;
    if (!emailPackageActive) {
        const freeLimit = 1000;
        if (emailCount > freeLimit) {
            emailCost = (emailCount - freeLimit) * 0.05;
        }
    }

    // Check if subscription has been paid in the current billing cycle
    const lastPayment = settings.billing_last_payment_date;
    let numberCost = 0;
    let emailPackageDue = Number(settings.billing_email_package_due || 0);

    let hasPaidThisCycle = false;
    if (lastPayment) {
        try {
            const parts = lastPayment.split(/[-/]/);
            if (parts.length >= 3) {
                const payMonth = parseInt(parts[1], 10);
                const payYear = parseInt(parts[2], 10);
                const currentMonth = new Date().getMonth() + 1;
                const currentYear = new Date().getFullYear();
                if (payMonth === currentMonth && payYear === currentYear) {
                    hasPaidThisCycle = true;
                }
            }
        } catch (e) {
            console.error('[Billing Helper] Error parsing payment date:', e);
        }
    }

    if (!hasPaidThisCycle) {
        // Dynamic number cost: Sum plans of all active Voice agents provisioned from Mazeway
        await db.ready;
        try {
            const activeVoiceAgents = db.all("SELECT config FROM mazeway_agents WHERE status = 'ACTIVE'");
            activeVoiceAgents.forEach(agent => {
                const config = JSON.parse(agent.config || '{}');
                if (config.price) {
                    numberCost += Number(config.price);
                }
            });
        } catch (err) {
            console.error('[Billing Helper] Error calculating VoIP agent number costs:', err);
        }
    } else {
        emailPackageDue = 0;
    }

    const licensePlan = settings.license_plan || 'Free';
    const licenseStatus = settings.license_status || 'Active';
    let subscriptionCost = 0;

    if (!hasPaidThisCycle && licenseStatus === 'Active') {
        if (licensePlan === 'Pro') {
            subscriptionCost = 499;
        } else if (licensePlan === 'Professional') {
            subscriptionCost = 1199;
        }
    }

    const totalDue = whatsappCost + voiceCost + emailCost + numberCost + emailPackageDue + subscriptionCost;

    return {
        whatsappCost: parseFloat(whatsappCost.toFixed(2)),
        voiceCost: parseFloat(voiceCost.toFixed(2)),
        emailCost: parseFloat(emailCost.toFixed(2)),
        numberCost: parseFloat(numberCost.toFixed(2)),
        emailPackageDue: parseFloat(emailPackageDue.toFixed(2)),
        subscriptionCost: parseFloat(subscriptionCost.toFixed(2)),
        totalDue: parseFloat(totalDue.toFixed(2))
    };
}

async function checkAndRunAutopay(settings) {
    if (settings.billing_payment_method_added !== 'true' || settings.billing_payment_method_autopay !== 'true') {
        return;
    }
    
    let isDay5 = false;
    const simDay = settings.billing_simulated_day;
    if (simDay && !isNaN(simDay) && simDay !== '') {
        isDay5 = parseInt(simDay, 10) === 5;
    } else {
        isDay5 = new Date().getDate() === 5;
    }

    if (!isDay5) {
        return;
    }

    const lastPayment = settings.billing_last_payment_date;
    let alreadyPaidThisCycle = false;
    if (lastPayment) {
        try {
            const parts = lastPayment.split(/[-/]/);
            if (parts.length >= 3) {
                const payMonth = parseInt(parts[1], 10);
                const payYear = parseInt(parts[2], 10);
                const currentMonth = new Date().getMonth() + 1;
                const currentYear = new Date().getFullYear();
                if (payMonth === currentMonth && payYear === currentYear) {
                    alreadyPaidThisCycle = true;
                }
            }
        } catch (e) {
            console.error('[Autopay Helper] Error parsing payment date:', e);
        }
    }

    if (alreadyPaidThisCycle) {
        return;
    }

    const dues = await calculateCurrentDue(settings);
    if (dues.totalDue > 0) {
        console.log(`[Autopay Helper] Day 5 detected with outstanding dues of ₹${dues.totalDue}. Executing autopay...`);
        await db.ready;
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_whatsapp_non_csw_count', '0')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_voice_agent_seconds', '0')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_email_sent_count', '0')");
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_email_package_due', '0')");
        
        const todayStr = new Date().toLocaleDateString('en-IN');
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_last_payment_date', ?)", [todayStr]);
        console.log(`[Autopay Helper] Autopay payment of ₹${dues.totalDue} successful. Last payment date updated to ${todayStr}.`);
        
        // Update settings map in-place so calculation downstream knows it is cleared
        settings.billing_whatsapp_non_csw_count = '0';
        settings.billing_voice_agent_seconds = '0';
        settings.billing_email_sent_count = '0';
        settings.billing_email_package_due = '0';
        settings.billing_last_payment_date = todayStr;
    }
}

async function isBillingBlocked() {
    await db.ready;
    const rows = db.all("SELECT key, value FROM settings");
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    // Run autopay check before deciding block state
    await checkAndRunAutopay(settings);

    const day = getDayOfMonth(settings);
    const dues = await calculateCurrentDue(settings);

    // Block if day of month is >= 6 and there is outstanding balance
    if (day >= 6 && dues.totalDue > 0) {
        return true;
    }
    return false;
}

async function getCreditBalance() {
    await db.ready;
    const row = db.get("SELECT value FROM settings WHERE key = 'billing_credit_balance'");
    return parseFloat(row?.value || '500.00');
}

async function deductCredit(serviceType, units, unitCost, description) {
    await db.ready;
    const currentBal = await getCreditBalance();
    const totalDeduction = Number(units) * Number(unitCost);
    const newBal = Math.max(0, currentBal - totalDeduction);
    
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_credit_balance', ?)", [newBal.toFixed(4)]);
    db.run(
        `INSERT INTO billing_credit_ledger (service_type, description, units_used, amount, balance_after)
         VALUES (?, ?, ?, ?, ?)`,
        [serviceType, description, Number(units), -totalDeduction, newBal]
    );
    return newBal;
}

async function addCredit(amount, description = 'Credit Top-up via quantro-web') {
    await db.ready;
    const currentBal = await getCreditBalance();
    const newBal = currentBal + Number(amount);
    
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_credit_balance', ?)", [newBal.toFixed(4)]);
    db.run(
        `INSERT INTO billing_credit_ledger (service_type, description, units_used, amount, balance_after)
         VALUES ('Credit Top-up', ?, 1, ?, ?)`,
        [description, Number(amount), newBal]
    );
    return newBal;
}

async function getCreditLedger() {
    await db.ready;
    return db.all("SELECT * FROM billing_credit_ledger ORDER BY id DESC LIMIT 100") || [];
}

module.exports = {
    getDayOfMonth,
    calculateCurrentDue,
    isBillingBlocked,
    checkAndRunAutopay,
    getCreditBalance,
    deductCredit,
    addCredit,
    getCreditLedger
};

