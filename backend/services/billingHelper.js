const db = require('../db');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://waywrispbgbtnppusikg.supabase.co';
const supabaseAnonKey = 'sb_publishable_J4ZoFCETv9sy_gh6m9hZlg_qrTElZDV';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to retrieve active license key from local settings database
async function getActiveLicenseKey() {
    await db.ready;
    const row = db.get("SELECT value FROM settings WHERE key = 'license_key'");
    return row?.value || 'QTY-FREE-PZ3T-191W-89FJ';
}

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

// Outstanding dues are always 0 since subscriptions are pre-paid and usage is wallet-deducted,
// but we calculate the usage costs (overages) to display in the UI cards.
async function calculateCurrentDue(settings) {
    const whatsappCount = Number(settings.billing_whatsapp_non_csw_count || 0);
    const emailCount = Number(settings.billing_email_sent_count || 0);
    const voiceSeconds = Number(settings.billing_voice_agent_seconds || 0);

    const whatsappCost = whatsappCount * 0.30;
    const emailCost = emailCount * 0.05;
    const voiceCost = (voiceSeconds / 60) * 10.00;

    return {
        whatsappCost: Number(whatsappCost.toFixed(4)),
        voiceCost: Number(voiceCost.toFixed(4)),
        emailCost: Number(emailCost.toFixed(4)),
        numberCost: 0,
        emailPackageDue: 0,
        subscriptionCost: 0,
        totalDue: 0
    };
}

async function checkAndRunAutopay(settings) {
    // Autopay is obsolete under pure pre-paid model
    return;
}

// Block services if wallet balance is 0 or negative
async function isBillingBlocked() {
    const balance = await getCreditBalance();
    return balance <= 0;
}

// Fetch the wallet balance live from Supabase, falling back to local SQLite settings (live ERP data)
async function getCreditBalance() {
    try {
        const key = await getActiveLicenseKey();
        const { data, error } = await supabase
            .from('credit_ledger')
            .select('balance_after')
            .eq('license_key', key)
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('[Supabase Wallet] Error fetching wallet balance:', error.message);
            await db.ready;
            const localBal = db.get("SELECT value FROM settings WHERE key = 'billing_credit_balance'")?.value;
            return localBal ? parseFloat(localBal) : 0.00;
        }

        if (data) {
            return parseFloat(data.balance_after || 0);
        }

        // Fall back to local SQLite balance if no transactions found in Supabase
        await db.ready;
        const localBal = db.get("SELECT value FROM settings WHERE key = 'billing_credit_balance'")?.value;
        return localBal ? parseFloat(localBal) : 0.00;
    } catch (err) {
        console.error('[Supabase Wallet] Failed to get credit balance:', err);
        try {
            await db.ready;
            const localBal = db.get("SELECT value FROM settings WHERE key = 'billing_credit_balance'")?.value;
            return localBal ? parseFloat(localBal) : 0.00;
        } catch (e) {
            return 0.00;
        }
    }
}

// Deduct wallet credit live in Supabase
async function deductCredit(serviceType, units, unitCost, description) {
    try {
        const key = await getActiveLicenseKey();
        const currentBal = await getCreditBalance();
        const totalDeduction = Number(units) * Number(unitCost);
        const newBal = Math.max(0, currentBal - totalDeduction);

        const { data, error } = await supabase
            .from('credit_ledger')
            .insert({
                license_key: key,
                service_type: serviceType,
                description: description,
                units_used: Number(units),
                amount: -totalDeduction,
                balance_after: newBal,
                created_at: new Date().toISOString()
            })
            .select()
            .maybeSingle();

        if (error) {
            console.error('[Supabase Wallet] Error inserting deduction:', error.message);
        }
        
        // Update local settings balance for fallback/offline display
        await db.ready;
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_credit_balance', ?)", [newBal.toFixed(4)]);

        return newBal;
    } catch (err) {
        console.error('[Supabase Wallet] Failed to deduct credit:', err);
        return 0;
    }
}

// Add top-up wallet credit in Supabase
async function addCredit(amount, description = 'Credit Top-up via quantro-web') {
    try {
        const key = await getActiveLicenseKey();
        const currentBal = await getCreditBalance();
        const newBal = currentBal + Number(amount);

        const { data, error } = await supabase
            .from('credit_ledger')
            .insert({
                license_key: key,
                service_type: 'Credit Top-up',
                description: description,
                units_used: 1,
                amount: Number(amount),
                balance_after: newBal,
                created_at: new Date().toISOString()
            })
            .select()
            .maybeSingle();

        if (error) {
            console.error('[Supabase Wallet] Error inserting top-up:', error.message);
        }

        // Update local settings balance for fallback/offline display
        await db.ready;
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_credit_balance', ?)", [newBal.toFixed(4)]);

        return newBal;
    } catch (err) {
        console.error('[Supabase Wallet] Failed to add credit:', err);
        return 0;
    }
}

// Get credit ledger log from Supabase
async function getCreditLedger() {
    try {
        const key = await getActiveLicenseKey();
        const { data, error } = await supabase
            .from('credit_ledger')
            .select('*')
            .eq('license_key', key)
            .order('id', { ascending: false })
            .limit(100);

        if (error) {
            console.error('[Supabase Wallet] Error fetching ledger:', error.message);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('[Supabase Wallet] Failed to get credit ledger:', err);
        return [];
    }
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
