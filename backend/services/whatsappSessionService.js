const db = require('../db');

function formatPhone(phone) {
    if (!phone) return '';
    // Strip non-digits
    const cleaned = phone.replace(/\D/g, '');
    // If it's 10 digits (common for Indian numbers), assume country code 91
    if (cleaned.length === 10) {
        return '91' + cleaned;
    }
    return cleaned;
}

async function isCustomerSessionActive(phoneNumber) {
    await db.ready;
    if (!phoneNumber) return false;
    
    const cleanPhone = formatPhone(phoneNumber);
    if (!cleanPhone) return false;
    
    try {
        const row = db.get("SELECT csw_expiration_timestamp FROM whatsapp_sessions WHERE phone_number = ?", [cleanPhone]);
        if (!row || !row.csw_expiration_timestamp) {
            return false;
        }
        const now = Date.now();
        const active = now < Number(row.csw_expiration_timestamp);
        console.log(`[CSW Check] Phone: ${cleanPhone}, Expiry: ${row.csw_expiration_timestamp}, Now: ${now}, Active: ${active}`);
        return active;
    } catch (err) {
        console.error(`[CSW Check] Error for phone ${cleanPhone}:`, err);
        return false;
    }
}

async function updateCustomerSession(phoneNumber, state = 'active') {
    await db.ready;
    if (!phoneNumber) return;
    
    const cleanPhone = formatPhone(phoneNumber);
    if (!cleanPhone) return;
    
    try {
        const now = Date.now();
        const expiration = now + 24 * 60 * 60 * 1000; // 24 hours window
        
        db.run(
            `INSERT INTO whatsapp_sessions (phone_number, last_customer_message_timestamp, csw_expiration_timestamp, conversation_state)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(phone_number) DO UPDATE SET 
                last_customer_message_timestamp = excluded.last_customer_message_timestamp,
                csw_expiration_timestamp = excluded.csw_expiration_timestamp,
                conversation_state = excluded.conversation_state`,
            [cleanPhone, now, expiration, state]
        );
        console.log(`[CSW Session Update] Phone: ${cleanPhone}, Updated Expiry: ${expiration}`);
    } catch (err) {
        console.error(`[CSW Session Update] Error updating session for ${cleanPhone}:`, err);
    }
}

async function getSessionState(phoneNumber) {
    await db.ready;
    if (!phoneNumber) return null;
    const cleanPhone = formatPhone(phoneNumber);
    if (!cleanPhone) return null;
    try {
        return db.get("SELECT * FROM whatsapp_sessions WHERE phone_number = ?", [cleanPhone]);
    } catch (err) {
        console.error(`[CSW Session State] Error getting session for ${cleanPhone}:`, err);
        return null;
    }
}

module.exports = {
    isCustomerSessionActive,
    updateCustomerSession,
    getSessionState
};
