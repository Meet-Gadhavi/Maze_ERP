import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://waywrispbgbtnppusikg.supabase.co';
const supabaseAnonKey = 'sb_publishable_J4ZoFCETv9sy_gh6m9hZlg_qrTElZDV';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storageKey: 'quantro-main-auth-token',
        persistSession: true,
        autoRefreshToken: true
    }
});
