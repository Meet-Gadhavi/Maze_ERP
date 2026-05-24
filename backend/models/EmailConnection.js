const db = require('../db');

const EmailConnection = {
    async getConnections() {
        await db.ready;
        return db.all('SELECT * FROM email_connections ORDER BY connected_at DESC');
    },

    async getConnectionByEmail(email) {
        await db.ready;
        return db.get('SELECT * FROM email_connections WHERE email = ?', [email]);
    },

    async getConnectionById(id) {
        await db.ready;
        return db.get('SELECT * FROM email_connections WHERE id = ?', [id]);
    },

    async createOrUpdateConnection({ provider, email, accessToken, refreshToken, expiryDate, status }) {
        await db.ready;
        const existing = await this.getConnectionByEmail(email);
        if (existing) {
            // Update
            const sql = `
                UPDATE email_connections 
                SET access_token = ?, 
                    refresh_token = COALESCE(?, refresh_token), 
                    expiry_date = ?, 
                    status = ? 
                WHERE email = ?
            `;
            db.run(sql, [accessToken, refreshToken || null, expiryDate, status || 'Active', email]);
        } else {
            // Insert
            const sql = `
                INSERT INTO email_connections (provider, email, access_token, refresh_token, expiry_date, status)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            db.run(sql, [provider || 'gmail', email, accessToken, refreshToken || null, expiryDate, status || 'Active']);
        }
        return this.getConnectionByEmail(email);
    },

    async updateStatus(email, status) {
        await db.ready;
        db.run('UPDATE email_connections SET status = ? WHERE email = ?', [status, email]);
    },

    async updateAccessToken(email, accessToken, expiryDate) {
        await db.ready;
        db.run('UPDATE email_connections SET access_token = ?, expiry_date = ? WHERE email = ?', [accessToken, expiryDate, email]);
    },

    async deleteConnection(email) {
        await db.ready;
        db.run('DELETE FROM email_connections WHERE email = ?', [email]);
    },

    async getDailyUsage(email) {
        await db.ready;
        const date = new Date().toLocaleDateString('sv-SE');
        const row = db.get('SELECT emails_sent FROM email_daily_usage WHERE email = ? AND date = ?', [email, date]);
        return row ? row.emails_sent : 0;
    },

    async incrementDailyUsage(email) {
        await db.ready;
        const date = new Date().toLocaleDateString('sv-SE');
        const existing = db.get('SELECT * FROM email_daily_usage WHERE email = ? AND date = ?', [email, date]);
        if (existing) {
            db.run('UPDATE email_daily_usage SET emails_sent = emails_sent + 1 WHERE email = ? AND date = ?', [email, date]);
        } else {
            db.run('INSERT INTO email_daily_usage (email, date, emails_sent) VALUES (?, ?, 1)', [email, date]);
        }
    }
};

module.exports = EmailConnection;
