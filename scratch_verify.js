const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://waywrispbgbtnppusikg.supabase.co';
const supabaseAnonKey = 'sb_publishable_J4ZoFCETv9sy_gh6m9hZlg_qrTElZDV';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testBillingCreditLedger() {
    try {
        const { data, error } = await supabase.from('billing_credit_ledger').select('*').limit(1);
        if (error) {
            console.log('Error:', error.message);
        } else {
            console.log('Success! Sample:', data);
        }
    } catch (err) {
        console.log('Exception:', err.message);
    }
}

testBillingCreditLedger();
