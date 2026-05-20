# Maze ERP - AI Voice Agent + WhatsApp CRM Campaign System

**Document Created:** April 19, 2026  
**Module:** CRM + AI Communication Hub  
**Vision:** Turn every customer interaction into revenue using intelligent, automated campaigns

---

## 🎯 EXECUTIVE SUMMARY

### The Big Idea

Build a **multi-channel AI-powered campaign engine** where businesses can:
1. Create campaigns in 3 clicks
2. Choose channel: Voice AI Calls, WhatsApp Messages, or Email
3. AI targets the right customers at the right time
4. Track responses, conversions, and ROI in real-time

### Why This Wins

| Competitor | What They Offer | What Maze Offers (Better) |
|------------|-----------------|--------------------------|
| **Vyapar** | Basic SMS | AI Voice + WhatsApp + Email campaigns |
| **Tally** | Nothing | Full campaign automation with AI |
| **Zoho** | Separate products (Zoho Campaigns, Zoho SalesIQ) | All-in-one inside ERP |
| **Freshworks** | Generic tools | India-specific, vernacular AI |

**Unique Value:** "Run a Diwali sale campaign to 1,000 customers via WhatsApp + Voice AI in 5 minutes - all from your ERP."

---

## 📊 CAMPAIGN TYPES

### 1. 🤖 AI Voice Calling Campaigns

**Use Cases:**
- Festival sale announcements
- Payment reminders for overdue invoices
- Birthday/anniversary wishes
- Re-engagement (haven't purchased in X days)
- New product launches
- Event invitations
- Feedback collection

**How It Works:**
```
1. User creates campaign → "Diwali Sale Announcement"
2. Selects audience → "All customers who spent >₹10,000 last year"
3. AI writes script → Auto-generates call script
4. User reviews/edits script
5. Set schedule → "Call between 10 AM - 6 PM"
6. Launch → AI calls each customer
7. Track responses → Interested/Not Interested/Callback
8. Auto-follow-up → WhatsApp message with offer link
```

**Sample Voice Campaign Script:**
```
AI: "Namaste [Customer Name]! This is [Store Name] calling with 
     an exclusive Diwali offer just for you!
     
     Get 25% OFF on all purchases above ₹5,000.
     Valid till [Date].
     
     Would you like to hear today's special deals?"

Customer: "Yes"

AI: "Great! Here are our top 3 deals:
     1. Premium Rice 5kg - Now ₹225 (was ₹300)
     2. Organic Dal 2kg - Now ₹180 (was ₹240)
     3. Basmati Rice 10kg - Now ₹850 (was ₹1,200)
     
     Would you like to place an order now?"

Customer: "Yes, 5kg Rice please"

AI: "Perfect! 5kg Premium Rice at ₹225.
     Delivery tomorrow between 2-4 PM.
     Payment: COD or UPI?
     
     [Completes order]
     
     You'll get a WhatsApp confirmation shortly.
     Happy Diwali! 🪔"
```

---

### 2. 💬 WhatsApp Campaign Messages

**Use Cases:**
- Product catalog broadcasts
- Flash sale alerts
- Abandoned cart recovery
- Order status updates
- Loyalty rewards notification
- Referral program invites

**How It Works:**
```
1. Create campaign → "Weekend Flash Sale"
2. Design message → Use template builder
3. Add products → Attach product cards
4. Select audience → "Customers in Delhi NCR"
5. Schedule → "Send Saturday 11 AM"
6. Launch → Sends via WhatsApp Business API
7. Track → Delivered, Read, Clicked, Replied
8. Auto-respond → AI handles replies
```

**WhatsApp Campaign Template:**
```
┌─────────────────────────────────────────────────────────────┐
│  🎉 WEEKEND MEGA SALE! 🎉                                   │
│                                                             │
│  Hi [Name], exclusive 48-hour sale just for you!           │
│                                                             │
│  🛍️ Offers:                                                 │
│  • Flat 20% OFF on orders above ₹1,000                     │
│  • Free delivery on orders above ₹2,000                    │
│  • Extra 5% cashback on UPI                                 │
│                                                             │
│  📦 Featured Products:                                      │
│  [Product Card 1] [Product Card 2] [Product Card 3]        │
│                                                             │
│  ⏰ Valid till Sunday midnight!                            │
│                                                             │
│  🛒 Shop Now: [Short Link]                                  │
│  📞 Call to order: [Click to Call]                          │
│                                                             │
│  Reply STOP to unsubscribe                                 │
└─────────────────────────────────────────────────────────────┘
```

---

### 3. 📧 Email Campaigns

**Use Cases:**
- Monthly newsletters
- Detailed product catalogs
- Invoice/payment reminders
- Educational content
- Event invitations

**How It Works:**
```
1. Choose template → Professional/Modern/Festive
2. Add content → Drag-drop editor
3. Personalize → AI suggests based on purchase history
4. A/B test → Test 2 subject lines
5. Send → Via SMTP/SendGrid
6. Analytics → Open rate, click rate, conversions
```

---

## 🏗️ CAMPAIGN BUILDER UI

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAMPAIGN CREATION WIZARD                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Campaign Basics                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Campaign Name: [Diwali Sale 2026____________]           │   │
│  │ Campaign Type:  [Voice AI Calls ▼]                      │   │
│  │ Goal:           [Drive Sales ▼]                         │   │
│  │                                                         │   │
│  │ Budget:         ₹[5,000]                                │   │
│  │ Expected Reach: ~450 customers                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 2: Select Audience                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Target: [Custom Segment ▼]                              │   │
│  │                                                         │   │
│  │ Filters:                                                │   │
│  │ • Location: [Delhi, Noida, Gurgaon]                     │   │
│  │ • Min Purchase: ₹[10,000]                               │   │
│  │ • Last Purchase: Last [6] months                        │   │
│  │ • Customer Type: [Retail ▼]                             │   │
│  │                                                         │   │
│  │ Matching Customers: 453                                 │   │
│  │ [Preview List]                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 3: AI Script/Message Generator                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Campaign Message:                                       │   │
│  │                                                         │   │
│  │ [AI has generated a script based on your goal...]      │   │
│  │                                                         │   │
│  │ "Hello! This is [Store] calling with an exclusive      │   │
│  │ Diwali offer! Get 25% OFF on all purchases..."         │   │
│  │                                                         │   │
│  │ [🎨 Regenerate] [✏️ Edit] [🎙️ Preview Voice]            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 4: Schedule & Launch                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Start Date: [20 Oct 2026]                               │   │
│  │ End Date:   [25 Oct 2026]                               │   │
│  │ Call Time:  [10:00 AM] to [6:00 PM]                     │   │
│  │ Max Calls/Day: [100]                                    │   │
│  │                                                         │   │
│  │ Estimated Cost:                                         │   │
│  │ • Voice Calls: ₹2,340 (450 × ₹5.2/call)                │   │
│  │ • WhatsApp: ₹225 (450 × ₹0.5/msg)                      │   │
│  │ • Total: ₹2,565                                         │   │
│  │                                                         │   │
│  │ [💰 Add Budget]  [🚀 Launch Campaign]                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 CAMPAIGN MANAGEMENT FEATURES

### Campaign Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAMPAIGN DASHBOARD                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Active Campaigns (3)                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🎉 Diwali Sale 2026                    Voice + WhatsApp │   │
│  │ ████████████░░░░░░░░ 65% complete                      │   │
│  │ 📞 293/450 called | 💬 189 WhatsApp sent               │   │
│  │ 💰 ₹18,450 revenue | 📈 7.2x ROI                       │   │
│  │ [Pause] [Edit] [View Details]                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🎂 Birthday Wishes                     WhatsApp Only    │   │
│  │ ████████████████████ 100% complete                     │   │
│  │ 💬 45/45 sent | 😊 38 positive replies                 │   │
│  │ 💰 ₹5,200 revenue | 📈 12.4x ROI                       │   │
│  │ [Duplicate] [View Details]                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ⏰ Payment Reminders                   Voice + Email    │   │
│  │ ████████░░░░░░░░░░░░ 40% complete                      │   │
│  │ 📞 32/80 called | 📧 28 emails sent                    │   │
│  │ 💰 ₹45,000 collected | 📈 15.8x ROI                    │   │
│  │ [Pause] [Edit] [View Details]                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Quick Stats                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Total    │ │ Total    │ │ Total    │ │ Avg ROI  │         │
│  │ Campaigns│ │ Spent    │ │ Revenue  │ │          │         │
│  │   47     │ │ ₹1.2L   │ │ ₹8.7L   │ │  7.3x    │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Campaign Analytics

| Metric | Description |
|--------|-------------|
| **Delivery Rate** | % of messages/calls successfully delivered |
| **Response Rate** | % of recipients who responded |
| **Conversion Rate** | % who made a purchase |
| **Cost Per Conversion** | Total spend / conversions |
| **ROI** | (Revenue - Cost) / Cost × 100 |
| **Optimal Time** | Best time to contact each customer |
| **Channel Preference** | Which channel each customer responds to |

---

## 🤖 AI INTELLIGENCE FEATURES

### 1. Smart Audience Selection

**AI analyzes:**
- Purchase history
- Last contact date
- Previous campaign responses
- Preferred contact channel
- Best time to contact
- Price sensitivity

**AI suggests:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 AI Audience Recommendations                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  For "Diwali Sale" campaign, AI recommends:                    │
│                                                                 │
│  ✅ HIGH PRIORITY (127 customers)                              │
│  • Spent >₹15,000 last Diwali                                  │
│  • Haven't purchased in 60 days                                │
│  • Usually responds to Voice calls                             │
│  • Best time: 11 AM - 1 PM                                     │
│  • Expected conversion: 35%                                    │
│                                                                 │
│  ✅ MEDIUM PRIORITY (234 customers)                            │
│  • Regular buyers (2-3 purchases/year)                         │
│  • Opened last 3 WhatsApp messages                             │
│  • Best time: 6 PM - 8 PM                                      │
│  • Expected conversion: 18%                                    │
│                                                                 │
│  ⚠️ LOW PRIORITY (89 customers)                                │
│  • Haven't responded to last 2 campaigns                       │
│  • Low engagement score                                        │
│  • Consider excluding to save budget                           │
│                                                                 │
│  [Apply Recommendations] [View Full List]                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. AI Script Optimization

**A/B Testing:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🎙️ AI Script A/B Testing                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Version A (Formal):                                           │
│  "Good morning! This is [Store] calling with an exclusive..." │
│                                                                 │
│  Version B (Casual):                                           │
│  "Hi [Name]! Great news - we have a special Diwali..."        │
│                                                                 │
│  AI Prediction:                                                │
│  • Version A: 12% conversion (based on similar campaigns)      │
│  • Version B: 18% conversion (+50% better)                     │
│                                                                 │
│  Recommendation: Use Version B for customers <40 years         │
│                                                                 │
│  [Use Version A] [Use Version B] [Test Both (50/50 split)]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Sentiment Analysis

**During Voice Calls:**
```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Real-Time Sentiment Analysis                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Call #234 - Rajesh Kumar                                      │
│  Sentiment: 😊 Positive (87%)                                  │
│  Interest Level: 🔥 High                                       │
│  Likely to Convert: ✅ Yes (92% confidence)                    │
│                                                                 │
│  Key Phrases Detected:                                         │
│  • "Sounds good"                                               │
│  • "Tell me more"                                              │
│  • "What's the offer?"                                         │
│                                                                 │
│  AI Action: Transfer to human agent for closing               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Optimal Contact Time

**AI learns from past behavior:**
```
┌─────────────────────────────────────────────────────────────────┐
│  ⏰ Best Contact Times (AI-Predicted)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Monday    ████████░░░░░░░░░░░░  Best: 10-11 AM               │
│  Tuesday   ██████████░░░░░░░░░░  Best: 11-12 PM               │
│  Wednesday ███████░░░░░░░░░░░░░  Best: 6-7 PM                 │
│  Thursday  ████████████░░░░░░░░  Best: 11 AM-12 PM            │
│  Friday    ██████░░░░░░░░░░░░░░  Best: 5-6 PM                 │
│  Saturday  ██████████████░░░░░░  Best: 12-1 PM                │
│  Sunday    ████████████████░░░░  Best: 11 AM-1 PM             │
│                                                                 │
│  Customer Segment Insights:                                     │
│  • Working professionals: Best evenings/weekends              │
│  • Homemakers: Best 10 AM - 2 PM                              │
│  • Students: Best after 6 PM                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📱 CUSTOMER PREFERENCES & COMPLIANCE

### DND (Do Not Disturb) Management

```
┌─────────────────────────────────────────────────────────────────┐
│  🚫 DND & Communication Preferences                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Customer: Rajesh Kumar (+91 98765 43210)                      │
│                                                                 │
│  Preferences:                                                   │
│  ☑️ WhatsApp Messages                                          │
│  ☑️ Voice Calls (10 AM - 7 PM only)                           │
│  ☐ Email                                                       │
│  ☐ SMS                                                         │
│                                                                 │
│  Campaign Types:                                                │
│  ☑️ Order Updates                                               │
│  ☑️ Special Offers                                              │
│  ☐ Promotional (Opted out)                                     │
│                                                                 │
│  Best Contact Time: 11 AM - 1 PM (AI-learned)                  │
│  Preferred Language: Hindi                                     │
│                                                                 │
│  Last Contacted: 3 days ago (Diwali Campaign)                  │
│  Next Allowed Contact: 7 days (for promotional)                │
│                                                                 │
│  [Update Preferences] [View History]                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### TRAI Compliance (India)

| Requirement | How Maze Handles |
|-------------|------------------|
| **DND Registry Check** | Auto-scrub numbers against TRAI DND before campaigns |
| **Consent Management** | Track opt-in/opt-out for each channel |
| **Caller ID** | Use verified business number |
| **Time Restrictions** | No calls before 9 AM or after 9 PM |
| **Frequency Capping** | Max 2 promotional calls/month per customer |
| **Opt-Out Handling** | "Press 9 to unsubscribe" in voice, "STOP" in WhatsApp |

---

## 🔄 CAMPAIGN WORKFLOW EXAMPLES

### Example 1: Payment Reminder Campaign

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 CAMPAIGN: Overdue Payment Reminders                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TRIGGER: Invoice overdue >7 days                              │
│                                                                 │
│  Step 1: WhatsApp Message (Day 7)                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ "Hi [Name], gentle reminder: Invoice #12345 of ₹5,000  │   │
│  │ is due since 7 days. Pay now: [UPI Link]"              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 2: AI Voice Call (Day 10)                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ "Hello [Name], this is [Store] calling regarding your  │   │
│  │ outstanding payment of ₹5,000. Would you like to pay   │   │
│  │ now via UPI or schedule a pickup?"                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 3: Email + Final Notice (Day 15)                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Formal email with payment options + legal notice info  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 4: Human Agent Escalation (Day 20)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Assign to collection agent for personal follow-up      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  RESULTS:                                                       │
│  • 45% pay after WhatsApp                                       │
│  • 30% pay after Voice call                                     │
│  • 15% pay after Email                                          │
│  • 10% require human intervention                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Example 2: Re-Engagement Campaign

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 CAMPAIGN: Win Back Inactive Customers                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TRIGGER: No purchase in 90 days                               │
│                                                                 │
│  AI Segmentation:                                               │
│  • Was a regular customer (purchased 4+ times)                 │
│  • Average order value: ₹2,500                                 │
│  • Last purchase: 95 days ago                                  │
│  • Preferred channel: WhatsApp                                  │
│                                                                 │
│  Campaign Flow:                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Day 1: "We miss you!" WhatsApp with 20% OFF coupon     │   │
│  │ Day 3: Voice call: "Special offer just for you..."     │   │
│  │ Day 7: "Last chance!" - 30% OFF flash offer            │   │
│  │ Day 14: Final survey: "Help us improve"                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  RESULTS:                                                       │
│  • 22% return with first offer                                  │
│  • 15% return after voice call                                  │
│  • 8% return with flash offer                                   │
│  • 5% provide feedback                                          │
│                                                                 │
│  ROI: 8.5x (₹15,000 spent → ₹1,27,500 revenue)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Example 3: Birthday Campaign

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 CAMPAIGN: Birthday Wishes + Special Offer                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TRIGGER: Customer birthday (from CRM)                         │
│                                                                 │
│  Step 1: Birthday WhatsApp (9 AM on birthday)                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ "🎂 Happy Birthday [Name]! 🎉                            │   │
│  │ Wishing you a wonderful year ahead!                     │   │
│  │ Here's a special gift: 25% OFF today only!             │   │
│  │ Use code: BDAY25                                        │   │
│  │ Shop now: [link]"                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 2: Birthday Voice Call (12 PM)                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ "Happy Birthday [Name]! This is [Store] with a special │   │
│  │ birthday surprise. We've added a FREE gift to your    │   │
│  │ account. Use code BDAYGIFT on your next order!"        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  RESULTS:                                                       │
│  • 65% open rate on WhatsApp                                    │
│  • 40% use the birthday coupon                                  │
│  • 25% make additional purchases                                │
│  • High positive sentiment (92% happy responses)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ TECHNICAL ARCHITECTURE

### Database Schema

```sql
-- Campaigns table
CREATE TABLE campaigns (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'voice', 'whatsapp', 'email', 'multi-channel'
    status TEXT DEFAULT 'draft', -- draft, scheduled, active, paused, completed
    goal TEXT, -- 'sales', 'reminder', 'engagement', 'feedback'
    budget REAL,
    spent REAL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- Campaign audience
CREATE TABLE campaign_audience (
    id INTEGER PRIMARY KEY,
    campaign_id INTEGER,
    customer_id INTEGER,
    status TEXT DEFAULT 'pending', -- pending, sent, delivered, responded, converted
    channel TEXT, -- voice, whatsapp, email
    scheduled_at TEXT,
    sent_at TEXT,
    responded_at TEXT,
    converted_at TEXT,
    response_sentiment TEXT, -- positive, neutral, negative
    revenue_generated REAL DEFAULT 0,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Campaign templates
CREATE TABLE campaign_templates (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT, -- 'festival', 'reminder', 'birthday', 'sale'
    script_template TEXT,
    whatsapp_template TEXT,
    email_template TEXT,
    variables TEXT, -- JSON array of variables like [name, offer, date]
    is_active BOOLEAN DEFAULT 1
);

-- Voice call logs
CREATE TABLE voice_call_logs (
    id INTEGER PRIMARY KEY,
    campaign_id INTEGER,
    customer_id INTEGER,
    call_sid TEXT,
    duration_seconds INTEGER,
    recording_url TEXT,
    transcription TEXT,
    sentiment_score REAL,
    outcome TEXT, -- 'interested', 'not_interested', 'callback', 'voicemail'
    created_at TEXT
);

-- WhatsApp message logs
CREATE TABLE whatsapp_logs (
    id INTEGER PRIMARY KEY,
    campaign_id INTEGER,
    customer_id INTEGER,
    message_id TEXT,
    status TEXT, -- sent, delivered, read, replied
    reply_text TEXT,
    clicked_link BOOLEAN DEFAULT 0,
    created_at TEXT
);

-- Email logs
CREATE TABLE email_logs (
    id INTEGER PRIMARY KEY,
    campaign_id INTEGER,
    customer_id INTEGER,
    email_id TEXT,
    opened BOOLEAN DEFAULT 0,
    clicked BOOLEAN DEFAULT 0,
    bounced BOOLEAN DEFAULT 0,
    created_at TEXT
);

-- Customer communication preferences
CREATE TABLE customer_preferences (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER UNIQUE,
    whatsapp_opt_in BOOLEAN DEFAULT 1,
    voice_call_opt_in BOOLEAN DEFAULT 1,
    email_opt_in BOOLEAN DEFAULT 1,
    sms_opt_in BOOLEAN DEFAULT 0,
    promotional_opt_in BOOLEAN DEFAULT 1,
    preferred_channel TEXT DEFAULT 'whatsapp',
    preferred_time_start TEXT DEFAULT '10:00',
    preferred_time_end TEXT DEFAULT '19:00',
    language TEXT DEFAULT 'en',
    dnd_registered BOOLEAN DEFAULT 0,
    last_contacted_date TEXT,
    max_contacts_per_month INTEGER DEFAULT 4
);
```

### API Endpoints

```javascript
// Campaign Management
POST   /api/campaigns/create          - Create new campaign
GET    /api/campaigns/list            - List all campaigns
GET    /api/campaigns/:id             - Get campaign details
PUT    /api/campaigns/:id             - Update campaign
DELETE /api/campaigns/:id             - Delete campaign
POST   /api/campaigns/:id/launch      - Launch campaign
POST   /api/campaigns/:id/pause       - Pause campaign
POST   /api/campaigns/:id/duplicate   - Duplicate campaign

// AI Features
POST   /api/campaigns/ai/generate-script   - AI generates script
POST   /api/campaigns/ai/suggest-audience  - AI suggests target audience
GET    /api/campaigns/ai/optimal-time      - Get best contact times
POST   /api/campaigns/ai/ab-test           - Run A/B test prediction

// Voice AI
POST   /api/voice/call                - Initiate AI voice call
GET    /api/voice/call-logs           - Get call history
GET    /api/voice/recording/:id       - Get call recording
POST   /api/voice/transcribe          - Transcribe call

// WhatsApp
POST   /api/whatsapp/send             - Send WhatsApp message
POST   /api/whatsapp/send-template    - Send template message
GET    /api/whatsapp/logs             - Get message history
POST   /api/whatsapp/webhook          - Receive replies

// Email
POST   /api/email/send                - Send email
GET    /api/email/logs                - Get email history

// Analytics
GET    /api/campaigns/analytics/:id   - Campaign performance
GET    /api/campaigns/roi             - ROI across campaigns
GET    /api/campaigns/compare         - Compare campaigns

// Customer Preferences
GET    /api/customers/:id/preferences - Get preferences
PUT    /api/customers/:id/preferences - Update preferences
POST   /api/customers/opt-out         - Opt out of all campaigns
```

---

## 📅 IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-6)

| Week | Tasks | Deliverable |
|------|-------|-------------|
| 1-2 | Database schema + migrations | Tables ready |
| 3-4 | WhatsApp Business API integration | Send/receive messages |
| 5-6 | Twilio Voice integration | Make/receive calls |

### Phase 2: Campaign Builder (Weeks 7-12)

| Week | Tasks | Deliverable |
|------|-------|-------------|
| 7-8 | Campaign CRUD APIs | Create, read, update, delete |
| 9-10 | Audience selection UI | Filter + segment builder |
| 11-12 | Script/message editor | Rich text + AI generator |

### Phase 3: AI Features (Weeks 13-18)

| Week | Tasks | Deliverable |
|------|-------|-------------|
| 13-14 | AI script generation (OpenAI) | Auto-write scripts |
| 15-16 | Audience recommendations | ML-based suggestions |
| 17-18 | Sentiment analysis | Real-time call analysis |

### Phase 4: Execution Engine (Weeks 19-24)

| Week | Tasks | Deliverable |
|------|-------|-------------|
| 19-20 | Campaign scheduler | Queue + execute campaigns |
| 21-22 | Rate limiting + DND compliance | TRAI compliance |
| 23-24 | Response handling | Auto-process replies |

### Phase 5: Analytics & Optimization (Weeks 25-30)

| Week | Tasks | Deliverable |
|------|-------|-------------|
| 25-26 | Campaign dashboard | Performance metrics |
| 27-28 | A/B testing framework | Test variations |
| 29-30 | ROI tracking | Revenue attribution |

---

## 💰 PRICING STRATEGY

### Campaign Pricing Tiers

| Tier | Voice Calls | WhatsApp Msgs | Emails | Price |
|------|-------------|---------------|--------|-------|
| **Starter** | 100/month | 1,000/month | 5,000/month | ₹1,499/mo |
| **Growth** | 500/month | 5,000/month | 25,000/month | ₹4,999/mo |
| **Professional** | 2,000/month | 20,000/month | 1,00,000/month | ₹9,999/mo |
| **Enterprise** | 10,000/month | 1,00,000/month | Unlimited | ₹24,999/mo |

### Pay-As-You-Go Add-Ons

| Add-On | Price |
|--------|-------|
| Extra Voice Calls | ₹5/call |
| Extra WhatsApp Messages | ₹0.50/msg |
| Extra Emails | ₹0.10/email |
| AI Script Generation | ₹99/script |
| Advanced Analytics | ₹499/month |

### Cost Breakdown (Example)

```
Diwali Campaign - 1,000 customers
├── Voice AI Calls: 1,000 × ₹5 = ₹5,000
├── WhatsApp Messages: 1,000 × ₹0.50 = ₹500
├── AI Script Generation: ₹99
└── Total: ₹5,599

If 10% convert (100 customers) with avg order ₹2,000:
Revenue: ₹2,00,000
ROI: 35.7x (₹2,00,000 / ₹5,599)
```

---

## 🔗 THIRD-PARTY INTEGRATIONS

| Service | Purpose | Pricing |
|---------|---------|---------|
| **Twilio** | Voice calls | $0.013/min (India) |
| **Meta WhatsApp Cloud API** | WhatsApp messages | Free 1K, then ~$0.01/msg |
| **SendGrid** | Email delivery | Free 100/day, then paid |
| **OpenAI** | AI script generation | $0.01/1K tokens |
| **Razorpay** | Payment links in messages | 2% + GST |
| **Truecaller** | Caller ID verification | Custom pricing |
| **TRAI API** | DND registry check | Free |

---

## 📊 SUCCESS METRICS

| Metric | Target (6 months) |
|--------|-------------------|
| Campaigns created/month | 500+ |
| Avg customers per campaign | 250+ |
| Voice call answer rate | >65% |
| WhatsApp open rate | >85% |
| Email open rate | >35% |
| Avg conversion rate | >12% |
| Avg ROI | >8x |
| Customer satisfaction | >4.5/5 |
| DND compliance | 100% |

---

## ⚠️ COMPLIANCE & LEGAL

### India-Specific Requirements

| Regulation | Requirement | How Maze Ensures |
|------------|-------------|------------------|
| **TRAI DND** | Don't call DND-registered numbers | Auto-scrub before campaigns |
| **DPDP Act 2023** | Data privacy | Explicit consent, easy opt-out |
| **RBI Guidelines** | Payment links | Only via licensed gateways |
| **IT Rules 2021** | Grievance officer | In-app complaint mechanism |
| **Spam Laws** | Max frequency | 2 promotional msgs/month cap |

### Consent Management

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 CONSENT RECORD - Rajesh Kumar                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  WhatsApp Opt-In: ✅ Granted                                   │
│  Date: 15 Mar 2026                                             │
│  Method: Website checkout checkbox                             │
│  IP: 103.45.67.89                                              │
│                                                                 │
│  Voice Call Opt-In: ✅ Granted                                 │
│  Date: 15 Mar 2026                                             │
│  Method: Verbal consent during order call                     │
│  Recording: [Listen]                                           │
│                                                                 │
│  Email Opt-In: ❌ Not Granted                                  │
│                                                                 │
│  Promotional Opt-In: ✅ Granted                                │
│  Date: 20 Mar 2026                                             │
│  Method: WhatsApp campaign reply "YES"                        │
│                                                                 │
│  Last Updated: 20 Mar 2026                                     │
│                                                                 │
│  [Export Consent Log] [Revoke All]                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 COMPETITIVE ADVANTAGE

### Why Businesses Will Choose Maze

1. **All-in-One** - Voice + WhatsApp + Email in single platform
2. **AI-Powered** - Smart scripts, audience selection, timing
3. **India-First** - Vernacular languages, DND compliance, UPI
4. **ERP Integration** - Campaigns tied to inventory, orders, CRM
5. **Affordable** - 1/10th cost of hiring call center

### Comparison Table

| Feature | Maze ERP | Vyapar | Tally | Zoho |
|---------|----------|--------|-------|------|
| AI Voice Campaigns | ✅ | ❌ | ❌ | ❌ |
| WhatsApp Campaigns | ✅ | ⚠️ Basic | ❌ | ✅ |
| Email Campaigns | ✅ | ❌ | ❌ | ✅ |
| AI Script Generation | ✅ | ❌ | ❌ | ❌ |
| Sentiment Analysis | ✅ | ❌ | ❌ | ❌ |
| DND Compliance | ✅ | ❌ | ❌ | ❌ |
| Payment Links | ✅ | ⚠️ Limited | ❌ | ✅ |
| ROI Tracking | ✅ | ❌ | ❌ | ⚠️ Basic |

---

## 📚 TECHNICAL REFERENCES

- [Twilio Voice API](https://www.twilio.com/docs/voice)
- [WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [SendGrid Email API](https://docs.sendgrid.com/)
- [TRAI DND Regulations](https://www.trai.gov.in/)
- [DPDP Act 2023 Compliance](https://www.meity.gov.in/data-protection-framework)

---

## 🚀 QUICK START GUIDE

### Create Your First Campaign (5 Minutes)

```
1. Go to CRM → Campaigns → New Campaign

2. Basics:
   Name: "Weekend Flash Sale"
   Type: WhatsApp + Voice AI
   Budget: ₹2,000

3. Audience:
   Filter: "Customers in Delhi, spent >₹5,000, last 6 months"
   AI suggests: 234 customers

4. Message:
   Click "AI Generate"
   Review script: "Hi [Name], exclusive weekend sale..."
   [Preview Voice] [Edit]

5. Schedule:
   Start: Saturday 11 AM
   End: Sunday 11 PM
   Max calls/day: 100

6. Launch! 🚀

7. Watch real-time:
   - 89 calls made, 62 answered
   - 156 WhatsApp sent, 134 read
   - 23 orders placed (₹45,000 revenue)
   - ROI: 22.5x
```

---

*Generated by Claude Code - Maze ERP AI Voice + WhatsApp CRM Campaign System*
