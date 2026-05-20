# Maze ERP - AI + E-commerce + WhatsApp Omnichannel Workflow

**Document Created:** April 19, 2026  
**Project Code:** MAZE-OMNI-001  
**Vision:** Unified commerce platform where orders from ANY channel flow into one intelligent system

---

## 🎯 EXECUTIVE SUMMARY

### The Big Idea

Build an **intelligent order orchestration platform** that:
1. Connects online stores (Shopify, MazeE-Comm, WooCommerce)
2. Connects WhatsApp Business with dedicated phone numbers
3. Adds Voice AI agent for phone orders
4. Centralizes ALL orders into "AI & E-commerce Orders" tab
5. Automates confirmations, inventory, delivery, payments, and feedback

### Why This Wins

| Competitor | What They Offer | What Maze Offers (Better) |
|------------|-----------------|--------------------------|
| **Vyapar** | Basic invoicing | Omnichannel orders + AI voice agent |
| **Tally** | E-commerce sync | WhatsApp ordering + Voice AI CRM |
| **Zoho** | Separate products | All-in-one unified workflow |
| **Shopify** | Online store only | Online + WhatsApp + Voice in one ERP |

**Unique Value:** "Your customers can order from website, WhatsApp, or phone call - everything syncs to one place."

---

## 📊 COMPLETE WORKFLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           MAZE ERP - OMNICHANNEL FLOW                          │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ORDER SOURCES
        ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
        │   E-COMM     │    │   WHATSAPP   │    │  VOICE CALL  │
        │   (Website)  │    │    Chat Bot  │    │   AI Agent   │
        └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
               │                   │                   │
               └───────────────────┼───────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  AI & E-COMM ORDERS TAB      │
                    │  (Central Order Queue)       │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │   ADMIN REVIEW & ACCEPT      │
                    │   (Accept/Reject/Modify)     │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │   REJECT        │  │   MODIFY        │  │   ACCEPT        │
    │   → Send reason │  │   → Update qty  │  │   → Next step   │
    │                 │  │   → Notify      │  │                 │
    └─────────────────┘  └─────────────────┘  └────────┬────────┘
                                                       │
                                                       ▼
                    ┌──────────────────────────────────────────────┐
                    │         POST-ACCEPT WORKFLOW                 │
                    └──────────────────────────────────────────────┘
                                                       │
              ┌────────────────────────────────────────┼────────────────────────────────────────┐
              │                                        │                                        │
              ▼                                        ▼                                        ▼
    ┌─────────────────────┐              ┌─────────────────────┐              ┌─────────────────────┐
    │  UPDATE INVENTORY   │              │  SEND CONFIRMATION  │              │  PAYMENT COLLECTION │
    │  → Deduct stock     │              │  → WhatsApp msg     │              │  → Prepaid: Ready   │
    │  → Sync e-comm      │              │  → E-comm status    │              │  → COD: Send QR     │
    │  → Reserve items    │              │  → Voice call       │              │  → Due tracking     │
    └─────────────────────┘              └─────────────────────┘              └─────────────────────┘
                                                       │
                                                       ▼
                    ┌──────────────────────────────────────────────┐
                    │         DELIVERY MANAGEMENT                  │
                    └──────────────────────────────────────────────┘
                                                       │
                                   ┌───────────────────┼───────────────────┐
                                   │                   │                   │
                                   ▼                   ▼                   ▼
                         ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
                         │   PORTER API    │ │  OWN DELIVERY   │ │  PICKUP         │
                         │  → Auto assign  │ │  → Staff notify │ │  → Ready msg    │
                         │  → Track        │ │  → Track        │ │                 │
                         └─────────────────┘ └─────────────────┘ └─────────────────┘
                                                       │
                                                       ▼
                    ┌──────────────────────────────────────────────┐
                    │         ORDER COMPLETION                     │
                    └──────────────────────────────────────────────┘
                                                       │
                                   ┌───────────────────┼───────────────────┐
                                   │                   │                   │
                                   ▼                   ▼                   ▼
                         ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
                         │  MOVE TO CRM    │ │  FEEDBACK CALL  │  │  INVOICE TO    │
                         │  → Purchase hist│ │  → AI voice     │  │  ACCOUNTING    │
                         │  → Loyalty pts  │ │  → Rating       │  │  → Books       │
                         └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 🏗️ SYSTEM ARCHITECTURE

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MAZE ERP CORE                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   POS       │  │   CRM       │  │  Inventory  │  │  Accounting │            │
│  │   Module    │  │   Module    │  │   Module    │  │   Module    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
        ┌───────────────────────┐       ┌───────────────────────┐
        │   AI & E-COMM TAB     │       │   NOTIFICATION ENGINE │
        │   (Order Queue)       │       │   (WhatsApp/Voice/SMS)│
        └───────────────────────┘       └───────────────────────┘
                    ▲                               ▲
                    │                               │
    ┌───────────────┼───────────────┐               │
    │               │               │               │
┌────────┐   ┌────────────┐  ┌────────────┐  ┌────────────┐
│Shopify │   │MazeE-Comm  │  │ WhatsApp   │  │ Voice AI   │
│Connector│  │(Built-in)  │  │ Business   │  │ Agent      │
│        │   │            │  │ API        │  │ (Twilio/   │
│        │   │            │  │            │  │  Exotel)   │
└────────┘   └────────────┘  └────────────┘  └────────────┘
```

---

## 📋 FEATURE BREAKDOWN BY MODULE

### Module 1: E-commerce Connectors

| Sub-Feature | Description | Tech Stack | Priority |
|-------------|-------------|------------|----------|
| **Shopify Integration** | Sync products, pull orders, update inventory | Shopify Admin API (GraphQL) | P0 |
| **MazeE-Comm (Built-in)** | Native e-commerce website builder | React + Node.js + SQLite | P1 |
| **WooCommerce Integration** | WordPress store sync | WooCommerce REST API | P2 |
| **Amazon/Flipkart Sync** | Marketplace order aggregation | SP-API (Selling Partner API) | P3 |
| **Unified Product Catalog** | One product master, sync everywhere | Central DB with mappings | P0 |

### Module 2: WhatsApp Business Integration

| Sub-Feature | Description | Tech Stack | Priority |
|-------------|-------------|------------|----------|
| **WhatsApp Business API** | Dedicated phone number, verified badge | Meta WhatsApp Cloud API | P0 |
| **Chatbot Builder** | Drag-drop flow builder for order bot | Node.js + Dialogflow/CX | P0 |
| **Product Catalog in Chat** | Browse products inside WhatsApp | WhatsApp Catalog API | P0 |
| **Cart & Checkout** | Add to cart, checkout within chat | Custom cart engine | P0 |
| **Order Status Updates** | Auto-send status via WhatsApp | WhatsApp Templates | P0 |
| **Payment Links** | Send UPI/payment links in chat | Razorpay/PhonePe API | P0 |

### Module 3: Voice AI Agent

| Sub-Feature | Description | Tech Stack | Priority |
|-------------|-------------|------------|----------|
| **Inbound Call Handling** | Answer calls 24/7 with AI | Twilio Voice + AI | P0 |
| **Voice Order Taking** | Understand & place orders via voice | OpenAI Whisper + GPT-4 | P0 |
| **Outbound Confirmation Calls** | Call customers to confirm orders | Twilio Voice API | P0 |
| **Feedback Collection Calls** | Post-delivery satisfaction survey | Voiceflow/Custom | P0 |
| **Multilingual Support** | Hindi, English, regional languages | Bhashini/AI4Bharat | P1 |
| **Sentiment Analysis** | Detect unhappy customers, alert human | AI sentiment API | P2 |

### Module 4: AI & E-commerce Orders Tab

| Sub-Feature | Description | UI Component | Priority |
|-------------|-------------|--------------|----------|
| **Order Queue View** | All pending orders in one list | Kanban/List view | P0 |
| **Source Tagging** | Shows if order from Web/WhatsApp/Voice | Badge component | P0 |
| **Bulk Actions** | Accept/reject multiple orders | Checkbox + action bar | P0 |
| **Order Details Panel** | Full order info, customer history | Slide-over panel | P0 |
| **Quick Modify** | Edit qty, price before accepting | Inline edit | P0 |
| **Auto-Accept Rules** | "Auto-accept prepaid orders under ₹5000" | Rule builder | P1 |
| **Fraud Detection** | Flag suspicious orders | AI scoring | P2 |

### Module 5: Post-Accept Automation

| Sub-Feature | Description | Integration | Priority |
|-------------|-------------|-------------|----------|
| **Inventory Sync** | Deduct stock, sync across channels | Internal API | P0 |
| **E-comm Status Update** | Mark "Processing" on Shopify/etc | Platform APIs | P0 |
| **WhatsApp Confirmation** | Send order confirmation message | WhatsApp API | P0 |
| **Voice Confirmation** | AI calls customer for confirmation | Twilio | P0 |
| **Invoice Generation** | Auto-create invoice in POS | Internal | P0 |
| **Payment QR Generation** | Dynamic QR for COD orders | Razorpay UPI | P0 |

### Module 6: Delivery Management

| Sub-Feature | Description | Integration | Priority |
|-------------|-------------|-------------|----------|
| **Porter Integration** | Auto-book delivery via API | Porter API | P0 |
| **Own Delivery Staff** | Assign to internal delivery person | Staff module | P0 |
| **Delivery Tracking** | Real-time tracking link | Porter/Google Maps | P0 |
| **Pickup Option** | "Ready for pickup" notification | WhatsApp/SMS | P0 |
| **Delivery Cost Calc** | Auto-calculate based on distance | Distance matrix API | P1 |
| **COD Reconciliation** | Track cash collected by delivery | Cash handling | P1 |

### Module 7: Payment Collection

| Sub-Feature | Description | Integration | Priority |
|-------------|-------------|-------------|----------|
| **Prepaid Orders** | Auto-verify payment, mark ready | Payment gateway | P0 |
| **COD with QR** | Send UPI QR after invoice | Razorpay/PhonePe | P0 |
| **Payment Reminders** | Auto-WhatsApp if payment due | WhatsApp API | P0 |
| **Late Payment Alerts** | Notify admin if customer delays | Internal alerts | P0 |
| **Partial Payments** | Accept advance, track balance | Ledger system | P1 |
| **EMI Options** | Offer No-cost EMI for large orders | Simpl/LazyPay | P2 |

### Module 8: Order Completion & CRM

| Sub-Feature | Description | Automation | Priority |
|-------------|-------------|------------|----------|
| **Move to CRM** | Customer record with purchase history | CRM module | P0 |
| **Loyalty Points** | Auto-add points for completed orders | Loyalty engine | P0 |
| **Feedback Call** | AI voice call for rating | Voice AI | P0 |
| **Thank You Message** | WhatsApp thank you + review link | WhatsApp API | P0 |
| **Repeat Order Nudge** | "Time to reorder?" after X days | Automated campaign | P1 |
| **Birthday/Anniversary** | Automated wishes with offers | CRM automation | P2 |

---

## 🛠️ TECH STACK RECOMMENDATIONS

### Backend Services

| Component | Technology | Why |
|-----------|------------|-----|
| **API Gateway** | Node.js + Express | Unified API for all connectors |
| **WhatsApp Bot** | Node.js + Dialogflow CX | Easy flow builder, Meta certified |
| **Voice AI** | Twilio Voice + OpenAI GPT-4 | Best-in-class voice + AI |
| **Order Queue** | Redis + Bull Queue | Reliable job processing |
| **Database** | SQLite (existing) + PostgreSQL (new) | Migrate for scale |
| **Real-time Sync** | Socket.io | Live order updates |

### Third-Party APIs Required

| Service | Purpose | Pricing |
|---------|---------|---------|
| **Meta WhatsApp Cloud API** | WhatsApp Business | Free (1K conversations/mo), then pay |
| **Twilio Voice** | Voice AI calls | $0.013/min (India) |
| **OpenAI API** | Voice AI intelligence | $0.01/1K tokens |
| **Razorpay Payment Links** | Payment collection | 2% + GST per transaction |
| **Porter API** | Delivery booking | Per-delivery charges |
| **Shopify API** | E-commerce sync | Free (included in Shopify plan) |

### Frontend Components

| Component | Technology | Notes |
|-----------|------------|-------|
| **AI & E-comm Tab** | React + TypeScript | New page in renderer |
| **Order Queue UI** | React + DnD (drag-drop) | Kanban-style board |
| **WhatsApp Preview** | React + WhatsApp Web clone | For testing bot flows |
| **Voice Call Dashboard** | React + Waveform viz | Live call monitoring |
| **Analytics Dashboard** | Recharts (existing) | Order source analytics |

---

## 📅 IMPLEMENTATION ROADMAP

### Phase 0: Foundation (Weeks 1-4)

**Prerequisites:** Fix critical issues from fix.md first!

| Week | Tasks | Deliverable |
|------|-------|-------------|
| 1-2 | Fix C001-C018 (Security issues) | Secure codebase |
| 3-4 | Fix M001-M015 (Architecture) | Modular code structure |

### Phase 1: Core Infrastructure (Weeks 5-10)

| Week | Tasks | Deliverable |
|------|-------|-------------|
| 5-6 | **Database Schema Extensions** | New tables for omnichannel |
| 7-8 | **API Gateway Setup** | Central API for all connectors |
| 9-10 | **WhatsApp Business API Integration** | Dedicated number, send/receive messages |

**Schema Additions:**
```sql
-- New tables for AI & E-commerce module
CREATE TABLE ecommerce_channels (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'shopify', 'maze-ecom', 'woocommerce'
    api_key TEXT,
    api_secret TEXT,
    store_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    last_sync_at TEXT
);

CREATE TABLE omnichannel_orders (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL, -- 'ecommerce', 'whatsapp', 'voice'
    source_order_id TEXT,
    channel_id INTEGER,
    customer_phone TEXT,
    customer_name TEXT,
    items_json TEXT,
    total_amount REAL,
    payment_status TEXT,
    payment_method TEXT,
    status TEXT DEFAULT 'pending', -- pending, accepted, rejected, processing, delivered, completed
    assigned_to INTEGER, -- delivery staff
    porter_tracking_id TEXT,
    whatsapp_conversation_id TEXT,
    voice_call_recording_url TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (channel_id) REFERENCES ecommerce_channels(id)
);

CREATE TABLE whatsapp_business (
    id INTEGER PRIMARY KEY,
    phone_number TEXT NOT NULL,
    display_name TEXT,
    verified BOOLEAN DEFAULT 0,
    api_token TEXT,
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT 1
);

CREATE TABLE voice_ai_calls (
    id INTEGER PRIMARY KEY,
    order_id INTEGER,
    call_sid TEXT,
    direction TEXT, -- inbound, outbound
    recording_url TEXT,
    transcription TEXT,
    sentiment_score REAL,
    duration_seconds INTEGER,
    created_at TEXT
);

CREATE TABLE delivery_partners (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'porter', 'own', 'pickup'
    phone TEXT,
    api_key TEXT, -- for Porter
    is_active BOOLEAN DEFAULT 1
);
```

### Phase 2: WhatsApp Chatbot (Weeks 11-16)

| Week | Tasks | Deliverable |
|------|-------|-------------|
| 11-12 | **Chatbot Flow Builder** | Dialogflow CX integration |
| 13-14 | **Product Catalog Sync** | Show products in WhatsApp |
| 15-16 | **Cart & Checkout in Chat** | Order placement via WhatsApp |

**WhatsApp Bot Flow:**
```
User: "Hi"
Bot: "Welcome to [Store Name]! 🛍️
      1. Browse Products
      2. Check Order Status
      3. Talk to Support
      
      Reply with number or type your query"

User: "1"
Bot: [Sends product catalog with images]
     "Tap on products to see details"

User: [Selects product]
Bot: "[Product Name] - ₹499
      Available: ✅ In Stock
      
      Options:
      1. Add to Cart
      2. See More Details
      3. Back to Browse"

User: "Add to Cart"
Bot: "Added! 🛒
      1. Continue Shopping
      2. Checkout Now"

User: "Checkout"
Bot: "Your cart:
      - Product A x 2 = ₹998
      - Delivery: ₹50
      - Total: ₹1,048
      
      Delivery Address: [Saved address]
      Payment:
      1. Prepaid (UPI/Card)
      2. Cash on Delivery
      
      Reply to confirm"

User: "1"
Bot: [Sends Razorpay payment link]
     "Complete payment to confirm order"

User: [Pays]
Bot: "✅ Payment received!
      Order #12345 confirmed
      Expected delivery: 2-3 days
      
      Track: [link]"
```

### Phase 3: Voice AI Agent (Weeks 17-22)

| Week | Tasks | Deliverable |
|------|-------|-------------|
| 17-18 | **Twilio Voice Integration** | Inbound call handling |
| 19-20 | **Voice Order Taking AI** | GPT-4 powered order bot |
| 21-22 | **Outbound Confirmation Calls** | Auto-call for order confirm |

**Voice AI Call Flow:**
```
Customer calls business number:

AI: "Thank you for calling [Store Name]! 
     I'm your virtual assistant. 
     Are you calling to place an order or check order status?"

Customer: "I want to place an order"

AI: "Great! Are you a returning customer?"

Customer: "Yes"

AI: "Let me find you... [phone number lookup]
     Found you! Welcome back, [Name].
     What would you like to order today?"

Customer: "I need 5kg Rice and 2kg Sugar"

AI: "Let me check availability...
     ✅ Rice (₹45/kg) - Available
     ✅ Sugar (₹42/kg) - Available
     
     Total: ₹309
     Should I place this order?"

Customer: "Yes"

AI: "Perfect! Order #12346 placed.
     Payment: COD or Prepaid?
     
     [Customer chooses]
     
     Expected delivery: Tomorrow 2-4 PM
     You'll get a WhatsApp with details.
     
     Anything else?"
```

### Phase 4: AI & E-commerce Orders Tab (Weeks 23-28)

| Week | Tasks | Deliverable |
|------|-------|-------------|
| 23-24 | **Order Queue UI** | React component in renderer |
| 25-26 | **Accept/Reject Workflow** | Backend + notifications |
| 27-28 | **Post-Accept Automation** | Inventory, confirmations |

### Phase 5: Delivery & Payments (Weeks 29-34)

| Week | Tasks | Deliverable |
|------|-------|-------------|
| 29-30 | **Porter API Integration** | Auto-book deliveries |
| 31-32 | **Own Delivery Staff Module** | Assign & track |
| 33-34 | **Payment Collection Automation** | QR, reminders, tracking |

### Phase 6: CRM & Completion (Weeks 35-40)

| Week | Tasks | Deliverable |
|------|-------|-------------|
| 35-36 | **Order to CRM Migration** | Move completed orders |
| 37-38 | **Feedback Automation** | Voice calls, WhatsApp |
| 39-40 | **Loyalty & Retention** | Points, repeat nudges |

---

## 💰 PRICING & PACKAGING

### Feature Tiers

| Tier | E-comm | WhatsApp | Voice AI | Price |
|------|--------|----------|----------|-------|
| **Starter** | 1 channel | ❌ | ❌ | ₹999/mo |
| **Growth** | 3 channels | ✅ (1K msgs) | ❌ | ₹2,499/mo |
| **Professional** | Unlimited | ✅ (10K msgs) | ✅ (100 min) | ₹4,999/mo |
| **Enterprise** | Unlimited + API | ✅ Unlimited | ✅ Unlimited | ₹9,999/mo |

### Usage-Based Add-Ons

| Add-On | Pricing |
|--------|---------|
| Extra WhatsApp conversations | ₹0.50/conversation |
| Extra Voice AI minutes | ₹1/minute |
| Porter delivery | At actual + 5% convenience |
| Payment gateway | 2% + GST per transaction |

---

## 🔗 INTEGRATION CHECKLIST

### Before Launch

- [ ] Meta WhatsApp Business API verified
- [ ] Twilio account + phone number provisioned
- [ ] OpenAI API key + rate limits configured
- [ ] Razorpay payment links tested
- [ ] Porter API sandbox + production access
- [ ] Shopify partner account (for app development)
- [ ] SSL certificates for webhooks
- [ ] Database migration scripts ready

### Testing Checklist

- [ ] End-to-end order flow (all 3 sources)
- [ ] Inventory sync across channels
- [ ] Payment link generation + verification
- [ ] Delivery booking via Porter
- [ ] Voice call transcription accuracy
- [ ] WhatsApp bot edge cases
- [ ] Load testing (100 concurrent orders)
- [ ] Error handling (API failures, timeouts)

---

## 📊 SUCCESS METRICS

| Metric | Target (6 months) |
|--------|-------------------|
| E-comm channels connected | 500+ stores |
| WhatsApp orders/month | 10,000+ |
| Voice AI orders/month | 2,000+ |
| Order acceptance time | <2 hours avg |
| Delivery booking rate | 60%+ auto-booked |
| Payment collection (COD→Prepaid) | 40% conversion |
| Customer satisfaction (feedback) | 4.5/5 avg |
| Repeat order rate | 35%+ |

---

## 🚀 GO-TO-MARKET STRATEGY

### Beta Launch (Month 1-2)
- 10 friendly merchants
- Free for 3 months
- Weekly feedback calls
- Fix critical bugs

### Soft Launch (Month 3-4)
- 100 merchants (invite-only)
- Early adopter pricing (50% off)
- Case study creation
- Refine onboarding

### Public Launch (Month 5-6)
- Full marketing push
- Integration marketplace listing
- Partner with Shopify India
- WhatsApp Business solution partner badge

---

## 🎯 COMPETITIVE MOAT

### Why Competitors Can't Copy Easily

1. **Unified Data Model** - Single customer view across all channels
2. **Voice + WhatsApp + Web in One** - Competitors have 1-2, not all 3
3. **Offline-First Architecture** - Works in low-connectivity areas
4. **India-Specific AI** - Trained on Indian languages, payment habits
5. **Network Effects** - More merchants = better delivery rates with Porter

---

## ⚠️ RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|------------|
| WhatsApp API policy changes | High | Build SMS fallback, own app |
| Voice AI accuracy issues | Medium | Human handoff option |
| Porter API downtime | Medium | Multiple delivery partners |
| Payment fraud (fake screenshots) | Medium | Server-side verification |
| Data privacy concerns | High | GDPR-style compliance, local hosting |

---

## 📚 TECHNICAL REFERENCES

- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Twilio Voice API](https://www.twilio.com/docs/voice)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Shopify Admin API](https://shopify.dev/docs/admin-api)
- [Porter for Business API](https://porter.in/business-api)
- [Razorpay Payment Links](https://razorpay.com/payment-links/)

---

## 📝 NEXT STEPS (Immediate Actions)

1. **Complete fix.md issues first** (Weeks 1-4)
2. **Set up WhatsApp Business API sandbox** (Week 5)
3. **Design database schema** (Week 5)
4. **Build API gateway skeleton** (Week 6-7)
5. **Create React component for Orders Tab** (Week 8)
6. **Test first end-to-end WhatsApp order** (Week 10)

---

*Generated by Claude Code - Maze ERP Omnichannel Strategy*
