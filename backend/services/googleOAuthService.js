const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const CREDENTIALS_PATH = path.join(__dirname, '../../Public/Quantro O_Auth Secrets.json');
const FALLBACK_CREDENTIALS_PATH = path.join(__dirname, '../../Public/Email Service.json');
const REDIRECT_URI = 'http://localhost:3001/auth/google/callback';

function getCredentials() {
    let targetPath = CREDENTIALS_PATH;
    if (!fs.existsSync(targetPath)) {
        if (fs.existsSync(FALLBACK_CREDENTIALS_PATH)) {
            targetPath = FALLBACK_CREDENTIALS_PATH;
        } else {
            throw new Error(`Google OAuth credentials file not found at ${CREDENTIALS_PATH}. Please ensure "Quantro O_Auth Secrets.json" is in the Public folder.`);
        }
    }
    const content = fs.readFileSync(targetPath, 'utf8');
    const config = JSON.parse(content);
    if (!config.web) {
        throw new Error('Invalid format in Google OAuth credentials file. Expected "web" configuration block.');
    }
    return config.web;
}

function getOAuthClient() {
    const creds = getCredentials();
    return new google.auth.OAuth2(
        creds.client_id,
        creds.client_secret,
        REDIRECT_URI
    );
}

const googleOAuthService = {
    getAuthUrl() {
        const oauth2Client = getOAuthClient();
        const scopes = [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ];
        return oauth2Client.generateAuthUrl({
            access_type: 'offline', // crucial to get refresh_token
            scope: scopes,
            prompt: 'consent' // ensures we always get a refresh token on re-auth
        });
    },

    async exchangeCode(code) {
        const oauth2Client = getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);
        return tokens; // Contains access_token, refresh_token, expiry_date
    },

    async getUserInfo(tokens) {
        const oauth2Client = getOAuthClient();
        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data } = await oauth2.userinfo.get();
        return {
            email: data.email,
            name: data.name || data.given_name || 'Gmail Account',
            picture: data.picture
        };
    },

    async refreshTokens(refreshToken) {
        const oauth2Client = getOAuthClient();
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await oauth2Client.refreshAccessToken();
        return credentials; // access_token, expiry_date
    }
};

module.exports = googleOAuthService;
