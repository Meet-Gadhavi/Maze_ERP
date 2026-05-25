const express = require('express');
const router = express.Router();
const db = require('../db');
const whatsappSender = require('../services/whatsappSender');

// Simulated Meta Embedded Signup page matching Facebook Login for Business UX
router.get('/connect', async (req, res, next) => {
    try {
        await db.ready;
        const wabaId = db.get("SELECT value FROM settings WHERE key = 'whatsapp_business_account_id'")?.value || '3150419608479658';
        const phoneId = db.get("SELECT value FROM settings WHERE key = 'whatsapp_phone_number_id'")?.value || '1117813404753239';
        const token = db.get("SELECT value FROM settings WHERE key = 'whatsapp_token'")?.value || 'EAATPnZC7jFeIBRqggccKGFX3E8Q3UNUmNf4bS59ZCV8MpbzIvfaIHmFrMRvDIHRkiS91DlU110DKgvY5EHWqKzzKL3mgPO9iuv8iFnR5ZAr6GC3CKZC4jmBkZBzSNoFB1v7ArepgYwCUoAeM2UFca2wudIVnPZCJRVgc9W3n0k2S5BG9EmA95Q6g8x1ZAuMjvdkCgZDZD';
        const appId = db.get("SELECT value FROM settings WHERE key = 'whatsapp_app_id'")?.value || '1354185989887458';
        const configId = '1222207263263139'; // Meta-hosted config ID provided by user

        // Case A: Mock Manual Form Mode
        if (req.query.mode === 'mock') {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Manual WhatsApp Setup</title>
                    <meta charset="utf-8">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            background-color: #f0f2f5;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            margin: 0;
                        }
                        .card {
                            background: white;
                            padding: 32px;
                            border-radius: 12px;
                            box-shadow: 0 12px 28px 0 rgba(0, 0, 0, 0.12);
                            width: 100%;
                            max-width: 450px;
                            box-sizing: border-box;
                        }
                        h2 {
                            margin-top: 0;
                            color: #1c1e21;
                            font-size: 20px;
                        }
                        p {
                            color: #606770;
                            font-size: 14px;
                            line-height: 1.4;
                            margin-bottom: 24px;
                        }
                        .form-group {
                            margin-bottom: 16px;
                        }
                        .form-group label {
                            display: block;
                            font-size: 12px;
                            font-weight: bold;
                            color: #606770;
                            margin-bottom: 6px;
                        }
                        .form-control {
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #dddfe2;
                            border-radius: 6px;
                            font-size: 14px;
                            box-sizing: border-box;
                        }
                        .btn {
                            background-color: #1877f2;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            padding: 12px 24px;
                            font-size: 15px;
                            font-weight: bold;
                            width: 100%;
                            cursor: pointer;
                            margin-top: 8px;
                        }
                        .btn:hover {
                            background-color: #166fe5;
                        }
                        .footer-link {
                            display: block;
                            text-align: center;
                            margin-top: 16px;
                            font-size: 13px;
                            color: #1877f2;
                            text-decoration: none;
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h2>Manual WhatsApp Link</h2>
                        <p>Link your account manually by entering WABA details below.</p>
                        <form action="/auth/whatsapp/callback" method="GET">
                            <div class="form-group">
                                <label>WhatsApp Business Account ID (WABA ID)</label>
                                <input type="text" class="form-control" name="waba_id" value="${wabaId}" required />
                            </div>
                            <div class="form-group">
                                <label>Phone Number ID</label>
                                <input type="text" class="form-control" name="phone_number_id" value="${phoneId}" required />
                            </div>
                            <div class="form-group">
                                <label>System User Token (Permanent)</label>
                                <input type="password" class="form-control" name="token" value="${token}" required />
                            </div>
                            <button type="submit" class="btn">Link Account</button>
                        </form>
                        <a class="footer-link" href="/auth/whatsapp/connect">← Back to Real Meta Onboarding</a>
                    </div>
                </body>
                </html>
            `);
        }

        // Case B: Real Meta-Hosted Embedded Signup parent page
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Facebook Login for Business</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        background-color: #f0f2f5;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        padding: 16px;
                        box-sizing: border-box;
                    }
                    .dialog-container {
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 12px 28px 0 rgba(0, 0, 0, 0.12), 0 2px 4px 0 rgba(0, 0, 0, 0.08);
                        width: 100%;
                        max-width: 500px;
                        overflow: hidden;
                        border: 1px solid #ced0d4;
                        display: flex;
                        flex-direction: column;
                    }
                    .dialog-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 14px 20px;
                        border-bottom: 1px solid #e5e5e5;
                        background: #ffffff;
                    }
                    .header-left {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .meta-logo {
                        height: 20px;
                        display: block;
                    }
                    .sync-icon {
                        color: #8a8d91;
                        font-size: 14px;
                    }
                    .header-right {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .profile-img {
                        width: 28px;
                        height: 28px;
                        border-radius: 50%;
                        object-fit: cover;
                        border: 1px solid #ddd;
                    }
                    .fb-badge {
                        width: 14px;
                        height: 14px;
                        background: #1877f2;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-left: -12px;
                        margin-top: 14px;
                        border: 2px solid white;
                    }
                    .fb-badge svg {
                        width: 8px;
                        height: 8px;
                        fill: white;
                    }
                    .dialog-banner {
                        width: 100%;
                        height: 140px;
                        background: #f8fafc;
                        border-bottom: 1px solid #e5e5e5;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .dialog-body {
                        padding: 24px;
                        flex-grow: 1;
                    }
                    h2 {
                        margin: 0 0 10px 0;
                        color: #1c1e21;
                        font-size: 20px;
                        font-weight: 600;
                        line-height: 1.25;
                    }
                    .subtitle {
                        color: #606770;
                        font-size: 14px;
                        line-height: 1.4;
                        margin: 0 0 24px 0;
                    }
                    .section-title {
                        font-size: 14px;
                        font-weight: 700;
                        color: #1c1e21;
                        margin: 0 0 16px 0;
                    }
                    .feature-item {
                        display: flex;
                        gap: 16px;
                        margin-bottom: 20px;
                        align-items: flex-start;
                    }
                    .feature-icon {
                        width: 36px;
                        height: 36px;
                        background: #f0f2f5;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                        color: #606770;
                    }
                    .feature-icon svg {
                        width: 20px;
                        height: 20px;
                        fill: currentColor;
                    }
                    .feature-text {
                        flex-grow: 1;
                    }
                    .feature-heading {
                        font-size: 14px;
                        font-weight: 600;
                        color: #1c1e21;
                        margin: 0 0 4px 0;
                    }
                    .feature-desc {
                        font-size: 13px;
                        color: #606770;
                        line-height: 1.35;
                        margin: 0;
                    }
                    .feature-bullets {
                        margin: 8px 0 0 0;
                        padding-left: 20px;
                        font-size: 13px;
                        color: #606770;
                    }
                    .feature-bullets li {
                        margin-bottom: 4px;
                    }
                    .divider {
                        height: 1px;
                        background: #e5e5e5;
                        margin: 24px 0 16px 0;
                    }
                    .terms-text {
                        font-size: 11px;
                        color: #8d949e;
                        line-height: 1.4;
                        margin: 0 0 16px 0;
                    }
                    .terms-text a {
                        color: #1877f2;
                        text-decoration: none;
                    }
                    .terms-text a:hover {
                        text-decoration: underline;
                    }
                    .session-id {
                        font-family: monospace;
                        font-size: 10px;
                        color: #bcc0c4;
                        margin-top: 8px;
                    }
                    .dialog-footer {
                        padding: 16px 24px;
                        background: #f0f2f5;
                        border-top: 1px solid #e5e5e5;
                        display: flex;
                        justify-content: flex-end;
                        gap: 12px;
                    }
                    .btn {
                        border-radius: 6px;
                        padding: 10px 20px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        border: none;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        transition: background-color 0.1s;
                    }
                    .btn-secondary {
                        background-color: #e4e6eb;
                        color: #050505;
                    }
                    .btn-secondary:hover {
                        background-color: #d8dadf;
                    }
                    .btn-primary {
                        background-color: #1877f2;
                        color: white;
                        padding: 10px 28px;
                    }
                    .btn-primary:hover {
                        background-color: #166fe5;
                    }
                    
                    /* Status alerts */
                    .status-alert {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 16px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        font-size: 14px;
                        line-height: 1.4;
                        text-align: left;
                    }
                    .status-alert.loading {
                        background-color: #e7f3ff;
                        border: 1px solid #1877f2;
                        color: #1877f2;
                    }
                    .status-alert.success {
                        background-color: #ecfdf5;
                        border: 1px solid #059669;
                        color: #065f46;
                    }
                    .spinner {
                        border: 3px solid #e7f3ff;
                        border-top: 3px solid #1877f2;
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        animation: spin 1s linear infinite;
                        flex-shrink: 0;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    .account-preview-box {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px;
                        border: 1px solid #e5e5e5;
                        border-radius: 8px;
                        background: #f8fafc;
                        margin-bottom: 16px;
                    }
                    .account-icon {
                        width: 32px;
                        height: 32px;
                        border-radius: 6px;
                        background: #dcfce7;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #16a34a;
                    }
                    .account-details {
                        font-size: 13px;
                    }
                    .account-name {
                        font-weight: 600;
                        color: #1c1e21;
                    }
                    .account-id {
                        color: #606770;
                        font-size: 11px;
                        margin-top: 2px;
                    }
                </style>
                <!-- Facebook SDK initialization -->
                <script>
                  window.fbAsyncInit = function() {
                    FB.init({
                      appId            : '${appId}',
                      autoLogAppEvents : true,
                      xfbml            : true,
                      version          : 'v25.0'
                    });
                  };
                </script>
                <script async defer crossorigin="anonymous" src="https://connect.facebook.net/en_US/sdk.js"></script>
            </head>
            <body>
                <div class="dialog-container">
                    <!-- Dialog Header -->
                    <div class="dialog-header">
                        <div class="header-left">
                            <!-- Meta Logo SVG -->
                            <svg class="meta-logo" viewBox="0 0 88 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M72.0729 0C70.6698 0 69.317 0.603314 68.3242 1.66699L64.8872 5.34005C64.0848 6.19632 62.9669 6.67972 61.7925 6.67972H53.0725C51.8981 6.67972 50.7802 6.19632 49.9778 5.34005L46.5408 1.66699C45.548 0.603314 44.1952 0 42.7921 0C39.8131 0 37.3877 2.37894 37.3877 5.29747V13.8824C37.3877 15.011 36.4568 15.922 35.3093 15.922C34.1618 15.922 33.2309 15.011 33.2309 13.8824V5.29747C33.2309 2.37894 30.8055 0 27.8265 0C24.8475 0 22.4221 2.37894 22.4221 5.29747V13.8824C22.4221 16.801 24.8475 19.1799 27.8265 19.1799C29.2296 19.1799 30.5824 18.5766 31.5752 17.5129L35.0122 13.8398C35.8146 12.9836 36.9325 12.5002 38.1069 12.5002H46.8269C48.0013 12.5002 49.1192 12.9836 49.9216 13.8398L53.3586 17.5129C54.3514 18.5766 55.7042 19.1799 57.1073 19.1799C60.0863 19.1799 62.5117 16.801 62.5117 13.8824V5.29747C62.5117 4.1689 63.4426 3.2579 64.5901 3.2579C65.7376 3.2579 66.6685 4.1689 66.6685 5.29747V13.8824C66.6685 16.801 69.0939 19.1799 72.0729 19.1799C75.0519 19.1799 77.4773 16.801 77.4773 13.8824V5.29747C77.4773 2.37894 75.0519 0 72.0729 0Z" fill="#0064E0"/>
                                <path d="M12.9157 14.5386H5.43859V9.92209H11.956V8.12574H5.43859V3.53588H12.7237V1.73953H3.53589V16.335H12.9157V14.5386Z" fill="#1C1F23"/>
                                <path d="M18.8927 1.73953H16.9946V16.335H18.8927V1.73953Z" fill="#1C1F23"/>
                                <path d="M22.0917 16.335H23.9898V1.73953H22.0917V16.335Z" fill="#1C1F23"/>
                            </svg>
                            <span class="sync-icon">&#8644;</span>
                            <span style="font-size: 13px; color: #606770; font-weight: 500;">Quantro Link</span>
                        </div>
                        <div class="header-right">
                            <img class="profile-img" src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80" alt="Profile">
                            <div class="fb-badge">
                                <svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                            </div>
                        </div>
                    </div>

                    <!-- Step 1: Informational Screen -->
                    <div id="step1">
                        <div class="dialog-banner">
                            <!-- Visual Shaking Hands SVG -->
                            <svg viewBox="0 0 500 180" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:100%; object-fit: cover;">
                              <defs>
                                <linearGradient id="banner-grad" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stop-color="#e0f2fe"/>
                                  <stop offset="50%" stop-color="#fae8ff"/>
                                  <stop offset="100%" stop-color="#dcfce7"/>
                                </linearGradient>
                              </defs>
                              <rect width="100%" height="100%" fill="url(#banner-grad)"/>
                              
                              <circle cx="70" cy="90" r="35" fill="#fecdd3" />
                              <path d="M 55,115 Q 70,80 85,115" fill="none" stroke="#e11d48" stroke-width="4" stroke-linecap="round" />
                              <circle cx="70" cy="75" r="10" fill="#e11d48" />

                              <circle cx="430" cy="90" r="35" fill="#fed7aa" />
                              <path d="M 415,115 Q 430,80 445,115" fill="none" stroke="#ea580c" stroke-width="4" stroke-linecap="round" />
                              <circle cx="430" cy="75" r="10" fill="#ea580c" />

                              <!-- Sleeves -->
                              <path d="M 0,80 L 170,80 L 190,110 L 0,110 Z" fill="#1877f2" opacity="0.95"/>
                              <path d="M 500,80 L 330,80 L 310,110 L 500,110 Z" fill="#1c1e21" opacity="0.95"/>

                              <!-- Handshake -->
                              <g transform="translate(190, 80)">
                                <path d="M 0,0 C 15,-10 30,-5 40,5 L 50,15 C 55,20 50,25 45,25 L 30,20 L 10,30 Z" fill="#fde047" stroke="#1c1e21" stroke-width="2"/>
                                <path d="M 120,0 C 105,-10 90,-5 80,5 L 70,15 C 65,20 70,25 75,25 L 90,20 L 110,30 Z" fill="#ca8a04" stroke="#1c1e21" stroke-width="2"/>
                                <path d="M 40,5 C 50,15 70,15 80,5" fill="none" stroke="#1c1e21" stroke-width="3" stroke-linecap="round"/>
                                <path d="M 45,15 C 55,25 65,25 75,15" fill="none" stroke="#1c1e21" stroke-width="3" stroke-linecap="round"/>
                              </g>

                              <!-- Floating Cards -->
                              <rect x="130" y="20" width="50" height="35" rx="6" fill="#ffffff" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.08))"/>
                              <circle cx="155" cy="38" r="8" fill="#1877f2" opacity="0.8" />
                              
                              <rect x="220" y="15" width="60" height="40" rx="8" fill="#ffffff" filter="drop-shadow(0px 4px 6px rgba(0,0,0,0.08))"/>
                              <path d="M 235,30 H 265 M 235,37 H 255" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>

                              <rect x="310" y="25" width="50" height="40" rx="6" fill="#ffffff" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.08))"/>
                              <rect x="320" y="45" width="6" height="12" fill="#25d366" rx="1"/>
                              <rect x="330" y="37" width="6" height="20" fill="#25d366" rx="1"/>
                              <rect x="340" y="32" width="6" height="25" fill="#25d366" rx="1"/>
                            </svg>
                        </div>

                        <div class="dialog-body">
                            <h2>Easily connect your account to Quantro</h2>
                            <p class="subtitle">This onboarding process will help you register your business account and connect with your partner.</p>

                            <h3 class="section-title">You will be able to:</h3>

                            <div class="feature-item">
                                <div class="feature-icon">
                                    <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
                                </div>
                                <div class="feature-text">
                                    <div class="feature-heading">Communicate with customers in large numbers</div>
                                    <p class="feature-desc">Cloud API allows you to securely send and receive messages and automatically manage conversations.</p>
                                    <ul class="feature-bullets">
                                        <li>Handle large volumes of messages easily</li>
                                        <li>Reduce costs associated with traditional SMS or voice calls</li>
                                    </ul>
                                </div>
                            </div>

                            <div class="divider"></div>

                            <p class="terms-text">
                                By continuing, you agree to the <a href="https://www.facebook.com/legal/terms/meta-hosting-terms-for-cloud-api" target="_blank">Meta Hosting Terms for Cloud API</a> and <a href="https://www.facebook.com/legal/waba_terms" target="_blank">Meta Terms for WhatsApp Business</a>.
                            </p>
                            
                            <p class="terms-text">
                                Quantro ERP <a href="#">Privacy Policy</a> and <a href="#">Terms</a>
                                <span class="session-id" style="display: block; margin-top: 8px;">Session ID: <span id="sess-id-val"></span></span>
                            </p>
                        </div>

                        <div class="dialog-footer">
                            <button class="btn btn-secondary" onclick="handleCancel()">Cancel</button>
                            <button class="btn btn-primary" onclick="launchRealMetaOnboarding()">Continue</button>
                        </div>
                    </div>

                    <!-- Step 2: Waiting Status Screen -->
                    <div id="step2" style="display: none;">
                        <div class="dialog-body" style="text-align: center; padding: 40px 24px;">
                            <div class="status-alert loading" id="status-box">
                                <div class="spinner"></div>
                                <div>
                                    <strong style="display: block;">Awaiting Meta Authorization...</strong>
                                    Please complete the signup wizard in the pop-up window.
                                </div>
                            </div>
                            
                            <h2 style="font-size: 18px; margin-top: 24px;">Connecting Quantro to WhatsApp</h2>
                            <p class="subtitle">Once authorized, your WABA ID and Phone Number will sync automatically.</p>
                            
                            <div class="account-preview-box" id="result-box" style="display: none; text-align: left; margin-top: 24px;">
                                <div class="account-icon" style="background-color: #d1fae5; color: #059669;">
                                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                                </div>
                                <div class="account-details">
                                    <div class="account-name" id="result-title">Account Linked successfully!</div>
                                    <div class="account-id" id="result-info">Syncing with local settings...</div>
                                </div>
                            </div>

                            <p class="terms-text" style="margin-top: 32px;">
                                Pop-up didn't open? <a href="#" onclick="launchRealMetaOnboarding(); return false;">Click here to reopen</a>
                                <br><br>
                                <a href="/auth/whatsapp/connect?mode=mock" style="color: #606770; text-decoration: underline;">Switch to manual mock integration mode</a>
                            </p>
                        </div>
                        <div class="dialog-footer">
                            <button class="btn btn-secondary" onclick="goToStep1()">Back</button>
                        </div>
                    </div>
                </div>

                <script>
                    function generateUUID() {
                        return '019e5d60-xxxx-4xxx-yxxx-5e047214ccc2'.replace(/[xy]/g, function(c) {
                            var r = Math.random() * 16 | 0,
                                v = c == 'x' ? r : (r & 0x3 | 0x8);
                            return v.toString(16);
                        });
                    }
                    document.getElementById('sess-id-val').innerText = generateUUID();

                    let popupWindow = null;

                    function launchRealMetaOnboarding() {
                        // Official Meta-hosted landing page URL
                        const onboardingUrl = 'https://business.facebook.com/messaging/whatsapp/onboard/?app_id=${appId}&config_id=${configId}&extras=%7B%22sessionInfoVersion%22%3A%223%22%2C%22version%22%3A%22v4%22%7D';
                        
                        const width = 600;
                        const height = 660;
                        const left = (window.screen.width / 2) - (width / 2);
                        const top = (window.screen.height / 2) - (height / 2);
                        
                        popupWindow = window.open(
                            onboardingUrl, 
                            'MetaWhatsAppOnboarding', 
                            \`width=\${width},height=\${height},left=\${left},top=\${top},status=no,resizable=yes,scrollbars=yes\`
                        );
                        
                        goToStep2();
                    }

                    // Listen for message events from the popup
                    window.addEventListener('message', function(event) {
                        // Accept events from both facebook.com and business.facebook.com
                        if (!event.origin.includes('facebook.com')) {
                            console.log('[Parent] Ignored event origin:', event.origin);
                            return;
                        }
                        
                        console.log('[Parent] Received Message Event:', event.data);
                        
                        try {
                            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                            
                            if (data.type === 'WA_EMBEDDED_SIGNUP') {
                                if (data.event === 'FINISH') {
                                    const sessionInfo = data.sessionInfo;
                                    const wabaId = sessionInfo.wabaID;
                                    const phoneId = sessionInfo.phoneID || sessionInfo.phoneNumberID;
                                    
                                    console.log('[Parent] Meta Signup Success! WABA ID:', wabaId, 'Phone ID:', phoneId);
                                    
                                    // Update UI to show success
                                    const statusBox = document.getElementById('status-box');
                                    statusBox.className = 'status-alert success';
                                    statusBox.innerHTML = '<div><strong>✓ Authorization Successful!</strong> Linking accounts...</div>';
                                    
                                    const resultBox = document.getElementById('result-box');
                                    resultBox.style.display = 'flex';
                                    document.getElementById('result-title').innerText = 'WhatsApp Connected!';
                                    document.getElementById('result-info').innerText = 'WABA: ' + wabaId + ' | Phone: ' + phoneId;
                                    
                                    if (popupWindow) popupWindow.close();
                                    
                                    // Redirect parent to callback to save token & credentials
                                    setTimeout(() => {
                                        window.location.href = '/auth/whatsapp/callback?waba_id=' + wabaId + '&phone_number_id=' + phoneId + '&token=${token}';
                                    }, 2000);
                                } else if (data.event === 'CANCEL') {
                                    alert('WhatsApp Signup was cancelled.');
                                    goToStep1();
                                }
                            }
                        } catch (e) {
                            console.error('[Parent] Failed to parse message event data:', e);
                        }
                    });

                    function goToStep2() {
                        document.getElementById('step1').style.display = 'none';
                        document.getElementById('step2').style.display = 'block';
                    }

                    function goToStep1() {
                        document.getElementById('step2').style.display = 'none';
                        document.getElementById('step1').style.display = 'block';
                    }

                    function handleCancel() {
                        if (confirm("Are you sure you want to cancel WhatsApp Business setup?")) {
                            window.close();
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

// OAuth Callback receiver
router.get('/callback', async (req, res, next) => {
    try {
        await db.ready;
        const { code } = req.query;

        // Fallback: If no auth code, look for direct manual parameters (e.g. from Mock Mode)
        if (!code) {
            const { waba_id, phone_number_id, token } = req.query;
            if (waba_id && phone_number_id && token) {
                db.run(
                    `INSERT OR REPLACE INTO whatsapp_connections (phone_number_id, waba_id, token, status)
                     VALUES (?, ?, ?, 'Active')`,
                    [phone_number_id, waba_id, token]
                );
                return res.redirect('http://localhost:5173/#/automation?whatsapp=success');
            }
            return res.status(400).send("Missing code or login parameters.");
        }

        // Real Meta OAuth flow: Exchange code for user access token
        const appId = db.get("SELECT value FROM settings WHERE key = 'whatsapp_app_id'")?.value || '1354185989887458';
        const appSecret = db.get("SELECT value FROM settings WHERE key = 'whatsapp_app_secret'")?.value || '678f644e1e7eafce62c29e5ba2dd17ff';
        const redirectUri = 'http://localhost:3001/auth/whatsapp/callback';

        console.log('[WhatsApp Auth] Exchanging authorization code for User Access Token...');
        
        // Exchange code for user access token
        const tokenResponse = await fetch(`https://graph.facebook.com/v23.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`);
        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || !tokenData.access_token) {
            console.error('[WhatsApp Auth] Token exchange failed:', tokenData);
            return res.status(400).send(`
                <h2>Meta Onboarding Callback Error</h2>
                <p>Failed to exchange authorization code: ${tokenData.error?.message || 'Unknown error'}</p>
                <p>To use mock connection mode instead, click <a href="/auth/whatsapp/connect?mode=mock">here</a>.</p>
            `);
        }

        const userAccessToken = tokenData.access_token;
        console.log('[WhatsApp Auth] Token exchange succeeded. Fetching user accounts...');

        // Fetch WhatsApp Business Accounts
        const accountsResponse = await fetch(`https://graph.facebook.com/v23.0/me/whatsapp_business_accounts?access_token=${userAccessToken}`);
        const accountsData = await accountsResponse.json();

        if (!accountsResponse.ok || !accountsData.data || accountsData.data.length === 0) {
            console.error('[WhatsApp Auth] Failed to fetch WABA accounts:', accountsData);
            return res.status(400).send(`
                <h2>Meta Onboarding Error</h2>
                <p>No WhatsApp Business Accounts (WABA) were found associated with your Facebook profile.</p>
                <p>Ensure you have created a WABA in your Meta Business Suite, or use <a href="/auth/whatsapp/connect?mode=mock">Mock Setup</a>.</p>
            `);
        }

        // Use the first returned WABA ID
        const wabaId = accountsData.data[0].id;
        console.log(`[WhatsApp Auth] Found WABA: ${wabaId}. Fetching phone numbers...`);

        // Fetch Phone Numbers for WABA
        const phoneResponse = await fetch(`https://graph.facebook.com/v23.0/${wabaId}/phone_numbers?access_token=${userAccessToken}`);
        const phoneData = await phoneResponse.json();

        if (!phoneResponse.ok || !phoneData.data || phoneData.data.length === 0) {
            console.error('[WhatsApp Auth] Failed to fetch phone numbers:', phoneData);
            return res.status(400).send(`
                <h2>Meta Onboarding Error</h2>
                <p>No phone numbers were found under WABA ID: ${wabaId}.</p>
                <p>Please register a number in your Meta Developer console or use <a href="/auth/whatsapp/connect?mode=mock">Mock Setup</a>.</p>
            `);
        }

        // Use the first phone number ID
        const phoneNumberId = phoneData.data[0].id;
        console.log(`[WhatsApp Auth] Resolved Phone Number ID: ${phoneNumberId}. Saving connection...`);

        // Save connection to database (falling back to userAccessToken or settings token)
        const tokenToSave = db.get("SELECT value FROM settings WHERE key = 'whatsapp_token'")?.value || userAccessToken;

        db.run(
            `INSERT OR REPLACE INTO whatsapp_connections (phone_number_id, waba_id, token, status)
             VALUES (?, ?, ?, 'Active')`,
            [phoneNumberId, wabaId, tokenToSave]
        );

        // Redirect back to electron frontend
        res.redirect('http://localhost:5173/#/automation?whatsapp=success');
    } catch (err) {
        next(err);
    }
});

// GET active connections
router.get('/connections', async (req, res, next) => {
    try {
        await db.ready;
        const rows = db.all("SELECT id, phone_number_id, waba_id, status, connected_at FROM whatsapp_connections");
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// POST disconnect WhatsApp
router.post('/disconnect', async (req, res, next) => {
    try {
        await db.ready;
        const { phone_number_id } = req.body;
        if (!phone_number_id) {
            return res.status(400).json({ error: "phone_number_id is required" });
        }

        db.run("DELETE FROM whatsapp_connections WHERE phone_number_id = ?", [phone_number_id]);
        res.json({ message: "WhatsApp service disconnected successfully." });
    } catch (err) {
        next(err);
    }
});

// POST test-message
router.post('/test-message', async (req, res, next) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ error: "recipient phone is required" });
        }

        const msgText = "Test Message from Quantro ERP WhatsApp Integration!\n\nYour WhatsApp Cloud API is successfully configured.";
        const result = await whatsappSender.sendText(phone, msgText);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Webhook Verification (GET /webhook)
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = db.get("SELECT value FROM settings WHERE key = 'whatsapp_webhook_verify_token'")?.value || 'maze_secure_verify_2026';

    if (mode && token) {
        if (mode === 'subscribe' && token === verifyToken) {
            console.log('[WhatsApp Webhook] Verified successfully.');
            return res.status(200).send(challenge);
        } else {
            return res.status(403).send('Forbidden');
        }
    }
    res.status(400).send('Bad Request');
});

// Webhook Event Receiver (POST /webhook)
router.post('/webhook', (req, res) => {
    const body = req.body;
    console.log('[WhatsApp Webhook] Received Event:', JSON.stringify(body, null, 2));

    // Handle statuses or incoming messages here if necessary.
    // Return standard success response to Meta
    res.status(200).send('EVENT_RECEIVED');
});

module.exports = router;
