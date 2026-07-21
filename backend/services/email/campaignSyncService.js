const crypto = require('crypto');
const db = require('../../db');

const SUPABASE_URL = 'https://waywrispbgbtnppusikg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_J4ZoFCETv9sy_gh6m9hZlg_qrTElZDV';

/**
 * Returns or generates a unique sync identifier for this desktop client installation.
 */
function getSyncId() {
    const row = db.get("SELECT value FROM settings WHERE key = 'online_sync_id'");
    if (row && row.value) {
        return row.value;
    }
    const syncId = crypto.randomUUID();
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('online_sync_id', ?)", [syncId]);
    return syncId;
}

/**
 * Sync campaigns from local SQLite to remote Supabase.
 */
async function pushCampaigns() {
    try {
        await db.ready;
        const syncId = getSyncId();
        const localCampaigns = db.all("SELECT * FROM email_campaigns");

        // Fetch remote campaigns for this syncId from Supabase PostgREST
        const remoteRes = await fetch(`${SUPABASE_URL}/rest/v1/online_campaigns?sync_id=eq.${syncId}`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!remoteRes.ok) {
            throw new Error(`Failed to fetch remote campaigns (${remoteRes.status})`);
        }

        const remoteCampaigns = await remoteRes.json();

        // 1. Identify local campaigns that need to be pushed (inserted or updated)
        for (const local of localCampaigns) {
            const remoteMatch = remoteCampaigns.find(r => String(r.id) === String(local.id));
            const payload = {
                id: String(local.id),
                sync_id: syncId,
                name: local.name,
                customers: local.customers, // already JSON string in SQLite
                start_date: local.start_date,
                end_date: local.end_date,
                time_to_send: local.time_to_send,
                template: local.template,
                status: local.status,
                channel: local.channel,
                custom_content: local.custom_content,
                created_at: local.created_at
            };

            if (remoteMatch) {
                // If status, name, or other details changed, update remote
                if (remoteMatch.status !== local.status || 
                    remoteMatch.name !== local.name || 
                    remoteMatch.time_to_send !== local.time_to_send ||
                    remoteMatch.start_date !== local.start_date) {
                    
                    console.log(`[Campaign Sync] Updating campaign #${local.id} on Supabase...`);
                    await fetch(`${SUPABASE_URL}/rest/v1/online_campaigns?sync_id=eq.${syncId}&id=eq.${local.id}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                        },
                        body: JSON.stringify(payload)
                    });
                }
            } else {
                console.log(`[Campaign Sync] Creating campaign #${local.id} on Supabase...`);
                await fetch(`${SUPABASE_URL}/rest/v1/online_campaigns`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify(payload)
                });
            }
        }

        // 2. Identify cloud campaigns that were deleted locally
        for (const remote of remoteCampaigns) {
            const localMatch = localCampaigns.find(l => String(l.id) === String(remote.id));
            if (!localMatch) {
                console.log(`[Campaign Sync] Deleting campaign #${remote.id} from Supabase...`);
                await fetch(`${SUPABASE_URL}/rest/v1/online_campaigns?sync_id=eq.${syncId}&id=eq.${remote.id}`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                });
            }
        }
    } catch (err) {
        console.error('[Campaign Sync] Error pushing campaigns:', err.message);
    }
}

/**
 * Sync customers, settings, and active email/whatsapp connections as metadata.
 */
async function pushMetadata() {
    try {
        await db.ready;
        const syncId = getSyncId();

        // 1. Fetch relevant settings
        const settingsKeys = [
            'company_name', 'email', 'phone', 'address', 'logo_url', 
            'whatsapp_token', 'whatsapp_phone_number_id', 'whatsapp_business_account_id',
            'billing_whatsapp_non_csw_count', 'billing_email_sent_count', 'billing_voice_agent_seconds',
            'billing_payment_method_added', 'billing_payment_method_autopay', 'billing_last_payment_date',
            'billing_wallet_balance'
        ];
        const settingsRows = db.all("SELECT key, value FROM settings");
        const settings = {};
        settingsRows.forEach(r => {
            if (settingsKeys.includes(r.key)) {
                settings[r.key] = r.value;
            }
        });

        // 2. Fetch active email/whatsapp connections
        const emailConnections = db.all("SELECT email, access_token, refresh_token, expiry_date, status FROM email_connections WHERE status = 'Active'");
        const whatsappConnections = db.all("SELECT phone_number_id, waba_id, token, status FROM whatsapp_connections WHERE status = 'Active'");

        // 3. Fetch customers list
        const customers = db.all("SELECT id, name, email, phone, p_credit_balance FROM customers");

        const payload = {
            sync_id: syncId,
            settings: JSON.stringify(settings),
            email_connections: JSON.stringify(emailConnections),
            whatsapp_connections: JSON.stringify(whatsappConnections),
            customers: JSON.stringify(customers),
            updated_at: new Date().toISOString()
        };

        // Check if metadata row already exists in Supabase
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/online_metadata?sync_id=eq.${syncId}`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!checkRes.ok) {
            throw new Error(`Failed to check remote metadata (${checkRes.status})`);
        }

        const existingMetadata = await checkRes.json();
        const exists = existingMetadata.length > 0;

        if (exists) {
            console.log(`[Campaign Sync] Updating online metadata for sync_id ${syncId} on Supabase...`);
            await fetch(`${SUPABASE_URL}/rest/v1/online_metadata?sync_id=eq.${syncId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify(payload)
            });
        } else {
            console.log(`[Campaign Sync] Creating online metadata for sync_id ${syncId} on Supabase...`);
            await fetch(`${SUPABASE_URL}/rest/v1/online_metadata`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify(payload)
            });
        }
    } catch (err) {
        console.error('[Campaign Sync] Error pushing metadata:', err.message);
    }
}

/**
 * Pull campaign statuses updated by the cloud server and write them to SQLite.
 */
async function pullCampaignStatuses() {
    try {
        await db.ready;
        const syncId = getSyncId();

        const remoteRes = await fetch(`${SUPABASE_URL}/rest/v1/online_campaigns?sync_id=eq.${syncId}`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!remoteRes.ok) {
            throw new Error(`Failed to fetch remote campaigns for pulling (${remoteRes.status})`);
        }

        const remoteCampaigns = await remoteRes.json();

        for (const remote of remoteCampaigns) {
            const local = db.get("SELECT status FROM email_campaigns WHERE id = ?", [remote.id]);
            if (local && local.status !== remote.status) {
                console.log(`[Campaign Sync] Updating local campaign #${remote.id} status to '${remote.status}'`);
                db.run("UPDATE email_campaigns SET status = ? WHERE id = ?", [remote.status, remote.id]);
            }
        }
    } catch (err) {
        console.error('[Campaign Sync] Error pulling campaign statuses:', err.message);
    }
}

/**
 * Syncs everything (pushes local state and pulls updates).
 */
async function syncAll() {
    console.log('[Campaign Sync] Performing full cloud sync cycle on Supabase...');
    await pushCampaigns();
    await pushMetadata();
    await pullCampaignStatuses();
}

/**
 * Starts background sync routine.
 */
function startSyncSchedule() {
    console.log('[Campaign Sync] Starting periodic pulling of campaign statuses...');
    
    // Pull statuses every 2 minutes
    setInterval(pullCampaignStatuses, 120000);
    
    // Sync everything every 10 minutes
    setInterval(syncAll, 600000);

    // Initial sync after 10 seconds
    setTimeout(syncAll, 10000);
}

module.exports = {
    getSyncId,
    pushCampaigns,
    pushMetadata,
    pullCampaignStatuses,
    syncAll,
    startSyncSchedule
};
