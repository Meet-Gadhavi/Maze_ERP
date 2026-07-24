const db = require('../db');

function getDayOfMonth(settings) {
    if (process.env.BILLING_SIMULATED_DAY && !isNaN(process.env.BILLING_SIMULATED_DAY)) {
        return parseInt(process.env.BILLING_SIMULATED_DAY, 10);
    }
    const simDay = settings ? settings.billing_simulated_day : '';
    if (simDay && !isNaN(simDay) && simDay !== '') {
        return parseInt(simDay, 10);
    }
    return new Date().getDate();
}

async function calculateCurrentDue(settings) {
    // Postpaid monthly dues have been purged in favor of Prepaid Wallet model.
    return {
        whatsappCost: 0,
        voiceCost: 0,
        emailCost: 0,
        numberCost: 0,
        emailPackageDue: 0,
        subscriptionCost: 0,
        totalDue: 0
    };
}

async function checkAndRunAutopay(settings) {
    // Legacy autopay disabled in prepaid wallet model.
    return;
}

async function isBillingBlocked() {
    await db.ready;
    const balance = await getCreditBalance();
    // In prepaid model, automations are blocked ONLY when wallet credit balance is depleted (<= 0)
    return balance <= 0;
}

async function getCreditBalance() {
    await db.ready;
    const row = db.get("SELECT value FROM settings WHERE key = 'billing_credit_balance'");
    return parseFloat(row?.value || '100.00');
}

async function deductCredit(serviceType, units, unitCost, description) {
    await db.ready;
    const currentBal = await getCreditBalance();
    const totalDeduction = Number(units) * Number(unitCost);

    if (currentBal < totalDeduction) {
        throw new Error(`Insufficient wallet balance (₹${currentBal.toFixed(2)}). Required: ₹${totalDeduction.toFixed(2)}. Please top up your wallet.`);
    }

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
