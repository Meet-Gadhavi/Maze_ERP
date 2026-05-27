# Quantro ERP Changelog

All notable changes to the Quantro ERP application will be documented here.

---

## [2.5.6] - 2026-05-27
### Added
- **Persistent License Keys & Auto-Transfer**: Configured the website download page and simulator to persist and display the user's existing license key, avoiding generating multiple duplicates.
- **Subscription Expiration Handling**: Configured automatic expiration checks for active subscriptions (Pro/Professional); once the 30-day billing cycle ends, the subscription is marked as expired and the user is automatically migrated back to their existing or a new Free plan license key.
- **Automated Client Activation & Session Cleanup**: Configured the desktop application to automatically retrieve and verify the user's active license from Supabase upon login/re-login, bypassing manual activation key prompts. Added self-correcting sync if the user's active session email matches the registered license email. Added secure session cleanup that clears the cached license from local SQLite settings on logout.

### Fixed
- **Web Portal License Verification Check**: Resolved a `TypeError` and PostgREST status `400` Bad Request error on the download page when retrieving or generating license keys. Added strict UUID validation on client-side requests to prevent invalid or undefined user ID filters from querying Supabase. Added safety fallbacks to retrieve the user object directly from active Supabase sessions if state propagation is delayed.
- **Database Not-Null Constraints**: Fixed PostgreSQL `NOT NULL` constraint violations on the `licenses` table by ensuring that the `email`, `price`, and `invoice_id` fields are always populated during license creation and simulation.

---

## [2.5.4] - 2026-05-26
### Fixed
- **Critical App Crash — Missing Icon (KeyRound)**: Resolved a `TypeError: Cannot read properties of undefined` crash in the `ActivationGate` component caused by `Icons.KeyRound` being used in `App.jsx` but never imported or exported in `Icons.jsx`. Added `KeyRound` to both the `lucide-react` import list and the `Icons` export object. This was the primary cause of the "Something went wrong" error boundary screen shown on app startup.

---

## [2.5.3] - 2026-05-26
### Fixed
- **Critical App Crash on Startup**: Resolved a `ReferenceError: toast is not defined` error in `App.jsx` that was caused by a missing import of the `toast` function from `sonner`. This error was being silently caught by the global `AppErrorBoundary`, which displayed the "Something went wrong" fallback screen instead of the actual application. Added the missing `toast` import alongside the existing `Toaster` import.

---

## [2.5.2] - 2026-05-26
### Added
- **Licensing & Key Activation Gate**:
  - Implemented client setup activation locks. On desktop app startup, users are prompted for a unique activation key.
  - Verified activation keys against the Supabase `licenses` table. On validation, the activation key and active subscription plan are stored in SQLite `settings` locally to unlock the desktop app.
  - Created a license key registry on the web client's download dashboard (`Download.jsx`). When downloading the app, users select their desired plan tier (Free Starter, Business PRO, AI Professional) to dynamically generate and copy their new license key.
- **Dynamic Tiered Subscriptions & Auto-renew Billing**:
  - Overhauled subscription tier options (Free, Pro at ₹499/mo, Professional at ₹1199/mo) with active/cancel actions in the desktop client `BillingPage.jsx` and the web simulator.
  - Configured outstanding dues to dynamically accumulate active subscription plan fees when unpaid (`!hasPaidThisCycle`).
  - Added auto-renewal on successful due settlement, and grace suspension handling on unpaid overdue subscriptions.
- **Supabase Integration & Web Portal Upgrades**:
  - Re-routed the Express background campaign engine (`server.cjs`) to fetch, patch, and execute campaign automations via Supabase REST API instead of the old Render DB endpoints.
  - Refactored the web client simulator tabs (Customers, Automation, Settings, Billing) inside `Home.jsx` to perfectly clone the real desktop client layouts and interactively handle plan subscription management.

## [2.5.1] - 2026-05-26
### Added
- **Cloud-Synced Online Campaigns (Keep-Alive)**:
  - Swapped the local campaign scheduler dependency with an online cloud sync architecture. Scheduled campaigns (Email/WhatsApp) are pushed to the remote Mazeway DB (`https://mazeway-db.onrender.com`).
  - Implemented a high-availability Express server (`server.cjs`) deployed under `https://quantro-web.onrender.com` that processes pending campaign queues and sends messages 24/7.
  - Supported secure token refreshing on the cloud server: Gmail access tokens are refreshed automatically using client OAuth secrets, keeping campaign dispatches flowing.
  - Integrated automatic metadata sync hooks: customer list changes, Google/WhatsApp connection states, and company settings updates are automatically synced to the cloud database.
  - Added bidirectional status synchronization: the desktop client pulls campaign execution results from the cloud database to update local SQLite states.

---

## [Web Portal] - 2026-05-26
### Added
- **Quantro Web Portal & Try-It-Out Simulator**:
  - Launched official product marketing portal at `C:\Users\Meet\Music\Quantro Web` featuring a modern, light-theme design.
  - Implemented an interactive browser-based ERP Simulator replicating the actual desktop client's layout (sidebar, stats grid, and vector charts).
  - Integrated Supabase User Authentication gate requiring users to log in or register before downloading the stable desktop installer package.
  - Documented upcoming updates and added an "Upcoming Release" tag for version `v2.4.5`.
- **Portal Security, Google Auth & Razorpay Upgrades**:
  - Fully converted the Download page (`Download.jsx`) to a light theme, replacing high-contrast/invisible white text labels and dark glass cards with clean slate typography and light-bordered containers.
  - Implemented client-side download restrictions, only allowing users to download the desktop ERP installer if they are signed in.
  - Added an automated licensing integration that retrieves or registers a unique client activation key in the Supabase `licenses` database when a download is requested, displaying the key directly on-screen for the user to copy.
  - **Google OAuth Redirect & Domain Lock Fix**: Fixed the Google Sign-in redirect flow where clicking "Sign in with Google" would redirect users back to `localhost` even on the live deployment. Dynamically resolved the redirect URL based on `window.location.origin`, ensuring users return to the hosted domain (`https://quantro-web.onrender.com`).
  - **Razorpay Secure Payment Gateway Integration**: Integrated a production-ready Razorpay Checkout overlay, replacing simulated input forms. Dynamically loads the Razorpay SDK to allow payments via UPI, Cards, Netbanking, or Wallets, which are verified on the Express backend (`server.cjs`) before issuing a license key.

## [2.5.0] - 2026-05-26
### Added
- **Two-way Communication Tracking**:
  - Implemented background email polling (Gmail) every 30 seconds for active connected email accounts. Automatically logs replies to communication logs.
  - Implemented webhook receiver integration for WhatsApp replies, tracking all customer responses and logging them to `customer_communication_logs`.
- **OpenCode Zen AI Responder**:
  - Created a robust context builder that dynamically retrieves customer information (contact details, outstanding balance, invoice history, payment records), inventory details (stock counts, pricing), and recent chat history to construct a highly context-aware prompt.
  - Connected the responder to OpenCode Zen completions endpoint using the free `deepseek-v4-flash-free` model with automatic failover to `nemotron-3-super-free` on rate limits or API outages.
- **AI Sales Leads & Automated Order Processing**:
  - Integrated smart classification in the AI Responder to distinguish between support/billing queries and order requests.
  - Implemented auto-profiling: for unregistered users, the AI detects missing contact information (Name, Email, Phone, Address) and prompts for them step-by-step. Once complete, it creates the customer profile and submits a new draft order in `mazeway_orders` (automatically calculating product pricing and totals).
  - Already registered customers can instantly place orders through conversational messages.
- **Draft Order-to-Invoice Conversion**:
  - Replaced the simple "Confirm" action button in the AI Sales panel with a premium "Convert to Invoice" action flow.
  - Clicking "Convert to Invoice" automatically redirects the user to the Standard Invoice builder, pre-selects the customer profile, matches cart items to catalog inventory, loads stock and batch numbers (if batch-management is enabled), and applies tier-based percentage discounts.
  - Saving the completed invoice automatically updates the original order status to `CONFIRMED` and dispatches a customer order notification via WhatsApp (utilizing the open Customer Service Window if active, otherwise falling back to the ₹0.20 `invoice_ready` template message).

## [2.4.5] - 2026-05-26
### Changed
- **Automation Cleanups**: Removed redundant separate "Agent List" layout sections from `AutomationPage.jsx` and unified agent display directly in the dashboard connection cards.
- **WhatsApp Icon Customization**: Integrated user-provided inline Bootstrap WhatsApp SVG branding inside both the "Get WhatsApp Service" header button and empty/disconnected state placeholder cards.
- **Voice Agent Warning Messages**: Polished warning text on the empty voice agent card to avoid "in the Automation page" phrasing, providing more context-aware guidelines.

## [2.4.4] - 2026-05-26
### Added
- **Automation Voice Agent Service Integration**: Added a dedicated **Voice Agent Service** section inside the Automation dashboard (`ConnectedServicesCard`) matching Gmail and WhatsApp cards.
  - Displays list of active/provisioning Voice Agents, their language, persona, monthly plan subscription, and provisioned VoIP phone number.
  - If no Voice Agent is created yet, displays a warning block matching Gmail and WhatsApp connection alerts: *"Please create your first voice calling agent in the Automation page to enable auto-notifications and campaign templates and furthermore transactions."*
  - Provides a **Get Voice Agent** action button in the section header to directly launch the agent creation dialog flow.
- **Enhanced Billing Verification**: Swapped the hardcoded active check for Voice Agent warnings on the Billing Page, ensuring it checks `voiceAgentCreated` state and differentiates between a provisioning status versus no agent at all.

### Changed
- **Connected Services Props Sync**: Structured prop callbacks to synchronize parent state changes in `AutomationPage` directly with `ConnectedServicesCard` for instant updates.

## [2.4.3] - 2026-05-25
### Added
- **Automation Billing & Services Subscriptions**: Created a premium **Billing** page in the ERP sidebar to track service usage, pricing structures, and subscriptions.
  - WhatsApp: Messages sent outside the Customer Service Window (without CSW) cost ₹0.20 per message.
  - Voice Agent: Call duration billed at ₹10.00 per minute.
  - Email: Free tier of 1,000 emails/mo, with overage billed at ₹0.05 per email. Support upgrading to the Transactional Email Package for ₹2,500/mo (adds 50,000 email quota) after reaching the free daily limit.
  - VoIP Phone Number Subscription: Replaced the flat number purchase with subscriptions dynamically linked to active Voice Agents (Starter ₹600/mo, Pro ₹700/mo, or Enterprise ₹1100/mo) and display their original provisioned numbers.
- **Service Blocking & Grace Period Enforcer**: Implemented auto-blocking rules. Dues must be settled by the 5th of the next month. Past the 5th, any outstanding balance immediately suspends WhatsApp template campaigns, Email automations, and Voice Agent calls until dues are cleared.
- **Razorpay Checkout Integration**: Added a "Pay All Dues" Razorpay payment gate simulation that securely processes transactions and instantly unblocks all suspended services.
- **Automated Billing Test Suite**: Created a command-line script (`npm run test:billing`) to instantly simulate and test the auto-suspension behavior across different days of the billing cycle (Grace period, grace overdue, and block clearance).
- **Environment Billing Day Simulator**: Replaced the "Developer Time Machine" UI card with a process environment variable override (`BILLING_SIMULATED_DAY=X`) to test billing behavior instantly without polluting user interfaces.
- **Connection Warnings & Transactions Control**: Added checks for connection status (Gmail/WhatsApp). Displays warning messages "Gmail/WhatsApp is not connected to enable transactions" if services are not connected.
- **Card Authorization & Autopay Modal**: Replaced simple payment card addition with a modal that processes a ₹1 authorization fee, displays Terms and Conditions, Privacy Policy, and Refund Policy agreements, and configures Autopay via Razorpay.
- **Voice Webhook Restrictions**: Restricts Voice Agent webhooks and activations if an agent is approved/active but no payment method has been added in settings.
- **Dynamic Brand Logo Integration**: Company settings logo (`logo_url`) is now dynamically rendered in the ERP sidebar, customer checkout display, and all four cloud-hosted A4 HTML invoice templates. Saving settings instantly triggers a background settings update on all active shared invoice links.
- **Hosted Invoice Deletion Sync**: Deleting an invoice locally in the ERP automatically triggers a delete action on the remote Mazeway DB to remove the hosted invoice row and clean up the sharing token.
- **Changelog Settings Tab Updates**: Fully synchronized the System Changelog tab inside settings to display the release history details up to v2.4.3.

### Changed
- **Hosted Viewer Print Action Removal**: Removed the download/print PDF button action from the top navigation bar of the hosted HTML viewer for a cleaner client-facing design.
- **Campaign Scheduling Polish**: Removed the redundant "Campaign Channel" FormGroup dropdown in the Schedule Campaign modal, rendering the Template Selection input as a full-width field.
- **Sidebar Version Restoration**: Restored the application version indicator in the bottom footer of the main navigation sidebar.

## [2.4.2] - 2026-05-25
### Added
- **WhatsApp Campaigns Upgrades**: Implemented locked Meta WhatsApp channel flows inside CRM scheduling dialog. Fixed a Babel compilation syntax error caused by a missing closing brace on `wrapCampaignPreviewHtml`. Prefilled campaign dispatch times to `'09:00'`.
- **Premium WhatsApp Chat Mock Preview**: Implemented a responsive WhatsApp chat thread bubble mockup rendering plain text campaign template contents against selected customer data, complete with double blue checkmarks and online contact headers.
- **WhatsApp Dashboard Analytics**: Added a dedicated WhatsApp Delivery Analytics dashboard card to the AI/Automation analytics tab. Tracks total WhatsApp messages sent, active channels, daily transmission quotas (1800 limit), and daily volume charts.
- **Voice Agent WhatsApp Auto-Dispatch**: Expanded Voice calling agent webhook triggers to automatically dispatch invoice PDFs to customer numbers via WhatsApp in Hindi, Gujarati, or English, active when the setting `auto_whatsapp_voice_request` is enabled.
- **Daily Transmission Tracker Bar**: Integrated message transmission usage indicator bars on active WhatsApp Service cards showing current usage relative to the 1800 message limit.
- **WhatsApp CSW & Template Fallback**: Upgraded WhatsApp delivery architecture to support 24-hour Customer Service Window (CSW) tracking. Configured automatic fallback to Meta-approved 'invoice_ready' utility template when sending invoices outside active user sessions.
- **Invoice Shareable Links**: Configured dynamic URL generation for copying invoice links to match the user's running protocol, host, and port. Added automated URL search parameter listeners to load and display the invoice preview modal instantly on page load when a share link is opened.
- **Cloud-Hosted HTML Invoice Delivery**: Integrated secure cloud-hosted HTML invoice delivery via Netlify (`https://billing-mazelab.netlify.app`) and synchronization to the custom database at `https://maze-erp-hosted-invoice.376591.dbmz`. Generated a static deployment directory `Billing.maze` containing production-ready viewer assets, including a `_redirects` and `netlify.toml` configuration to ensure seamless single-page application routing. Updated the copy actions and WhatsApp dispatch routines to send cloud-hosted invoice URLs instead of PDF attachments.

### Fixed
- **Hosted Invoice Database Resolution**: Resolved DNS "failed to fetch" errors on Copy Link clicks by swapping the custom `.dbmz` virtual domains for the public online instance at `https://mazeway-db.onrender.com`. Rewrote client-side fetching and analytics updating workflows to use Mazeway DB's standard API endpoints (`/api/v1/tables/.../rows` and `{ match, update }` PATCH payloads) instead of Supabase PostgREST query parameter filters.
- **Hosted Invoice Payload Optimization**: Avoided "Payload Too Large" (HTTP 413) errors during synchronization by extracting and syncing only the specific metadata keys needed by the viewer, excluding heavy base64 company logos and unrelated configuration keys.

## [2.4.0] - 2026-05-25
### Added
- **WhatsApp Cloud API Integration:** Added a premium "Get WhatsApp Service" integration. Supports simulated Meta Embedded Signup flow to save WABA ID, Phone Number ID, and Permanent System User Tokens. Keep developer credentials hidden from the frontend.
- **Headless Server-Side Invoice PDF Generation:** Integrated server-side PDF generator using `pdfkit` to compile itemized invoice documents.
- **WhatsApp Automations:** Enable auto-sending invoice PDFs, order confirmation texts, payment receipts, and voice agent request replies via WhatsApp Cloud API.
- **Gmail Automation Upgrades:** Moved Invoice Template and Order Confirmation templates from campaigns to settings-controlled automated emails, adding Payment Received and configurable Due Payment Reminder toggles to Gmail Manage Settings.
- **New Campaign Marketing Templates:** Expanded campaigns with template selections for Due Balance Statement (exclusively for customers with outstanding due), Festival Offer (Diwali/Holi/Eid sale), Discount Coupon (links latest promo codes), New Arrivals, Flash Sale, Clearance Sale, and Back in Stock.
- **WhatsApp Text Campaigns:** Added channel selector to marketing campaigns supporting both Gmail (HTML template dispatches) and WhatsApp (text-only campaign dispatches).

## [2.3.1] - 2026-05-24
### Fixed
- **Google OAuth Packaging Bug:** Included the `Public/` resources directory in the production build files array so that `Email Service.json` is correctly bundled in the final application installer, resolving the Google OAuth initialization error.

## [2.3.0] - 2026-05-24
### Added
- **Gmail Automation Settings & Toggles:** Added general settings toggles to Connected Gmail Service card (`Manage` modal) allowing users to enable/disable automated invoice emails on creation, on edits (payments, fulfillment, returns), and via Voice Agent interaction.
- **Voice Agent Call Request Auto-Dispatch:** Integrated Voice Agent call summary analysis to match customer details (name or phone) and detect request intents (like "send invoice" or "order progress"). If matched and enabled, the system automatically dispatches their latest sales invoice.
- **Premium Purchase History Bill Preview:** Redesigned the Purchase Page bill preview modal with a matching premium invoice template layout, including user company details (address, phone, gstin) from settings, vendor details from suppliers catalog, itemized lists with GST details, signature blocks, and amount-to-words translation.
- **Dashboard Email Analytics & Trends:** Added Email Delivery Analytics inside the AI/Automation dashboard tab displaying total emails sent in the selected timeframe, active connections count, progress bars for daily Gmail limit utilization by account, and daily dispatch trend charts.

## [2.0.9] - 2026-05-24
### Added
- **Daily Gmail Limit Tracking:** Configured a strict 1000 daily email limit per connected email account. Decrements on every email sent (including test emails, invoices, and campaigns).
- **Daily Gmail Limit Header Text:** Placed the remaining/sent email limit status text directly in the card header, removing the progress bar per user request.
- **Custom Business Branding Support:** Added support to dynamically render custom company logo and name (from settings) in all outgoing email templates (Invoice classic/minimalist, order confirmation, feedback request, and test email), with default fallback to Maze ERP branding if not customized by the user.
- **Premium Marketing Tabs:** Redesigned Coupons and Email Campaigns tab switcher with a modern pill-shaped Glassmorphism slider layout.
- **Searchable Customer Selection Cards:** Upgraded the campaign recipient list with search input, check-state card styling, selected count badge, a full-width vertical list layout for clear readability of names and emails (preventing cramped truncation), and inline chip tags for all selected customer names.
- **Campaign Template Preview with Custom Branding:** Expanded the campaign modal to a premium split-screen design featuring a real-time, responsive email template preview (supporting custom logos and company details) and a recipient dropdown selector to dynamically preview emails with individual customer names.
- **Invoice Template Campaign Option:** Added an "Invoice Template" campaign option that retrieves each recipient customer's latest invoice (with mock invoice fallback) and formats it using the specific default invoice style (Classic, Minimalist, etc.) configured in Settings.
- **Invoice Campaign Preview:** Integrated live mock rendering of the invoice template inside the campaign creation modal preview pane according to the chosen default invoice style.
- **Automatic Recipient Email Resolution:** Updated sales backend routes to join `customers.email` and `customers.phone` with invoice results. If a registered customer already has an email in their profile, it is automatically resolved and displayed statically in the share popup rather than prompting the user for manual entry. Walk-in or blank-email invoices will still prompt the user to input the recipient's email address.
- **Clean Sales History Actions:** Removed the redundant "Share Invoice" button from the Sales History actions column, standardizing the sharing workflow through the dedicated "Share" button inside the Invoice Preview Modal.
### Fixed
- **Share Modal Stacking Context Fix:** Fixed an issue where the Share popup modal appeared behind the invoice preview modal by nesting it inside the preview modal container to inherit its elevated portalled stacking context.
- **Category Table Sticky Headers Fix:** Resolved an overlapping text bug in the Category list table. Set the sticky table header cells to a solid background color (`var(--bg-card)`) rather than `transparent`, preventing scrolled table items from mixing with the header text.
- **Customer List Scroll Fade Effect:** Added a premium fade-out linear gradient overlay to the bottom of the Customer Selection scrollable list in the sales creation flow.
- **Campaign Recipient Checklist Layout:** Resolved a layout squishing bug where global input styles caused the checkbox inputs in the Select Recipients list to stretch across the card, squishing the customer details div to zero-width. Stacked customer names and emails vertically inside the cards and added robust inline style overrides to ensure checkboxes render in their standard compact size.
- **Campaign Expiry and End Date Verification:** Added an expiry check in the background campaign scheduler to automatically cancel campaigns that are executed past their scheduled optional End Date.
- **Invoice Share and Email Totals Resolution:** Resolved an issue where emailed invoices showed 0 totals and 0 due amounts by adding fallback database column mapping resolutions for `invoice.total` and `invoice.paid_amount`.

## [2.2.0] - 2026-05-23
### Added
- **Gmail OAuth Integration Service:** Enabled multi-tenant SaaS architecture allowing businesses to securely link their own Gmail accounts using official Google OAuth consent screens (scopes: `gmail.send`, `userinfo.email`, `userinfo.profile`) rather than insecure SMTP passwords.
- **Automation Tab Integration Card:** Added a premium "Get Gmail Service" card under the Automation page featuring the official Gmail icon, active connection status badge, connection date, usage quota tracking (Free 1800 Emails), and Connect/Disconnect/Send Test Email actions.
- **Automated Email Campaigns:** Introduced campaign scheduling under the Customers -> Marketing tab. Users can schedule campaigns by selecting multiple customers, templates (Order Confirmation, Feedback request, General Newsletter), start date, and daily send time.
- **Invoice Sharing Popup:** Added a "Share" option next to the Print/PDF button in the Invoice Preview screen. Users can instantly copy the invoice link or select a connected Gmail sender to email the styled invoice directly to the customer.
- **Background Campaign Scheduler:** Added a background interval process in the backend server that polls SQLite for scheduled campaigns and sends templated HTML emails automatically when the scheduled date/time is met.

## [2.1.1] - 2026-05-23
### Added
- **Multi-Product Reward Coupon Support:** Updated the "Create Coupon" catalog selector to support selecting multiple product rewards. Users can configure individual reward quantities for each selected product inline.
- **Space-Efficient Coupon Catalog Layout:** Replaced the tall bottom reward details row in the customer coupon modal with a compact, flex-wrapped tag list of selected products, solving the extra bottom margin issue.
- **POS & Standard Checkout Multi-Product Integration:** Enabled applying multi-product coupons to automatically add all associated free products with their respective quantities to both standard invoice and POS Quick Sale carts.
- **Automatic Coupon Invalidation on Item Removal:** Removing the coupon code or manually deleting any of the free reward products from standard or POS carts automatically clears the applied coupon state.
### Fixed
- **POS Quick Sale Selection Active Styles:** Inverted active/inactive styling for payment selection buttons (Cash, UPI, Card), category selection buttons, and layout grid/list toggle buttons, rendering the active selections in solid black (#202223) and inactive ones in white/light grey. Added a built-in `selected` prop to `SButton` to automatically apply the black theme (by accessing the shadow DOM of `<s-button>` web components directly using React refs and modifying internal button style properties, bypassing scoped CSS variable hash limitations).
- **POS Quick Sale Payment and Checkout Clicks:** Wrapped checkout payment method (Cash, UPI, Card) and Create Invoice action buttons inside standard browser elements with pointer-event bypasses, resolving custom element click interception issues that prevented payment selection.

## [2.1.0] - 2026-05-23
### Added
- **Coupon Reward Quantity Integration:** Updated standard invoice and POS Quick Sale checkout to add the free product reward to the cart with its configured reward quantity (instead of defaulting to 1 unit).
- **Empty States Standardization:** Standardized the design and size of empty state panels across all main tabs (such as the "Pending Product" tab in Inventory Page) to match the premium empty state card styling. Updated search filter empty states (such as suppliers search in Purchase Page and communication logs in CRM) to use the standard compact layout, resolving layout mismatches.

## [2.0.9] - 2026-05-23
### Added
- **Coupon Management System:** Added a "Marketing (Coupons)" sub-tab under the Customers section to create, view, and delete promo coupons. Supports Percentage Discount, Currency Flat Discount, and Free Product Reward coupons with configurable expiration dates, usage limits (unlimited or custom), and automated tracking.
- **Promo Coupon Checkout Integration:** Integrated coupon code entry fields inside the standard checkout invoice sidebar and POS Quick Sale checkout. Applying valid coupons automatically adds free product rewards to the cart or deducts the coupon discount amount from the grand total.
- **Custom Customer Name & Phone in POS Quick Sale:** Replaced the hardcoded Walk-in guest default in Quick Sale checkout with editable input fields, allowing users to record custom walk-in customer names and phone numbers.
- **Shopify Button Active Selection in POS Quick Sale:** Changed POS payment buttons (Cash, UPI, Card) to highlight the selected payment method with a white background, accent border, and subtle glow (the Shopify-like active state effect), keeping unselected options dark and allowing checkout completion only after selecting a payment method.
- **Invoice Templates Coupon Breakdown:** Enabled Classic, Formal, POS, and Minimalist invoice templates to display applied coupon codes and discount amounts in the totals breakdown section.
### Fixed
- **POS Quick Sale Category Switcher:** Restored the Shopify Polaris `SButton` aesthetics for categories by wrapping them in pointer-event-transparent containers, resolving both the Shopify look-and-feel and category selection bugs.

## [2.0.8] - 2026-05-23
### Added
- **POS Quick Sale List View:** Added a layout toggle next to category selection to switch between standard Box/Grid view and detailed List view for product tiles, styled as native Shopify SButtons.
- **POS Quick Sale Payment Selection:** Changed payment method buttons (Cash, UPI, Card, Split Bill) to toggle selection state (highlighting selected in white and unselected in black) rather than checking out instantly. Checking out is now performed by clicking the primary "Create Invoice" button.
- **POS Categories Horizontal Swipe & Blurs:** Added horizontal categories overflow scroll mask with left/right linear-gradient edge blurs and drag-swipe sliding functionality.
- **Serial & IMEI Tracking Settings Toggle:** Added a global toggle under settings (Batch & Lot Management) to enable or disable Serial/IMEI tracking throughout the application. When disabled, serial tracking options and tabs are hidden.
- **Manual Serial CRUD:** Enabled adding and deleting available serial/IMEI numbers directly from the Product Inventory Serial tab, automatically adjusting stock counts and logging stock movements.
- **POS Out of Stock Add:** Allowed double-clicking category or subcategory header banners to add all items to the cart, including out-of-stock items (controlled by global flexible inventory rules).
- **Paid Invoice Payment Validation:** Enforced that the sum of payments exactly matches the grand total for normal Walk-in or PAID status invoices.
- **Manage Subcategories Polish:** Fixed button spacing in subcategory actions and implemented a controlled Save action instead of Edit labels.
### Fixed
- **Print Daily Report Blank PDF:** Resolved print media stylesheet layout hide constraints by cloning the Z-report element to the body before printing, and exposed text values for starting/actual drawer cash.
- **Empty Inventory Box Sizing:** Aligned the custom styled empty inventory container to match the exact size and styling of the global premium empty state card.
- **Delete Modals Button Styling:** Fixed delete customer and supplier modal action buttons to render in critical red tone by using the correct Polaris-style props.

## [2.0.7] - 2026-05-22
### Fixed
- **Stock Movement Trend Analytic:** Resolved a database query bug where the date values from stock movements (stored with full timestamps) failed to match calendar date strings in string comparison. Appended the SQLite `date()` function to convert full timestamps into matching date strings, enabling the trend dashboard to correctly display stock-in and stock-out activity.

## [2.0.6] - 2026-05-22
### Added
- **Category Selection Double-Click:** Enabled double-clicking category buttons to add all in-stock products in that category directly to the cart.
- **Group Banners Redesign:** Redesigned subcategory and brand section headers as full-width banner cards, featuring hover translation animations, standard invoice styled icons, and double-click support to add all items in that group.
- **Custom Select Grouping Dropdown:** Integrated the premium custom `CustomSelect` dropdown for grouping options and styled it with a compact height to fit seamlessly in the toolbar.
- **POS Bottom Checkout Bar:** Moved payment actions (Cash, UPI, Card, Split Bill) into a dedicated sticky bottom bar with totals breakdown, live payable amount on each button, and a built-in Discount field (% or flat ₹) that updates all button amounts in real time.
### Changed / Fixed
- **POS Checkout Bar Alignment:** Aligned the Walk-In payment status banner, discount inputs, and payment buttons perfectly on the same horizontal line by using a bottom flex alignment (`align-items: flex-end`) while restoring their original compact/thin heights.
- **Quick Sale Payment Revert:** Reverted to standard Shopify `SButton` components for payment buttons (Cash, UPI, Card, Split Bill), making the Split Bill button span 100% of the grid container width in the second row.
- **Category Button Accent Overhaul:** Restored standard Shopify `SButton` components for category selection, eliminating the custom oval backgrounds, custom borders, and native blue focus highlights.
- **Continuous Add Quantity Bug Fix:** Resolved a stale closure issue in the click-and-hold interval handler, ensuring that quantities correctly increment during continuous addition.
- **Colored Payment Buttons:** Each payment method button now has a distinct gradient color (Cash=green, UPI=purple, Card=blue, Split=amber) with hover glow and press-scale animations.


## [2.0.5] - 2026-05-22
### Changed
- **POS Quick Sale Payment Layout Refinement:** Moved the Split Bill checkout action directly into the payment buttons grid as a 4th button, styled identically with a custom Lucide Layers icon.
- **Button Transparency Polish:** Removed the high-contrast white card background from Cash, UPI, Card, and Split Bill buttons, making them transparent to match the POS toolbar aesthetics and transition smoothly on hover.

## [2.0.4] - 2026-05-22
### Added
- **Quick Sale Split Bill Checkout:** Integrated a Split Bill checkout option supporting Equal Split (split bill among N shares with payment method per share), Item Split (assign specific items/quantities to buyers with custom payment methods), and Payment Method Split (split total bill by payment amounts for Cash, UPI, and Card).
- **Click-and-Hold Continuous Product Addition:** Enabled rapid product addition to the cart by long-pressing (click-and-hold) any product tile.
- **Subcategory & Brand Quick Sale Groupings:** Grouped product tiles dynamically by Subcategory or Brand in the Quick Sale interface, featuring clear section headers with an "+ Add All" button to add all products in a group instantly.
- **Category Select "Add All" and Tighter Spacing:** Added a quick select option to add all products in a category to the cart, and optimized spacing between categories.
- **Product Tile Visual Enhancements:** Added visible borders to product tiles and displayed subcategory and brand name metadata labels inside tiles.
- **Activity (CRM) Modal Sizing**: Set `#customer-history-modal` size to automatically match the Shopify Polaris standard `large` size by removing the custom size overrides.
### Changed / Fixed
- **Customer Communication Logs Polish:** Redesigned communication log timeline feeds into premium cards with colored left-borders matching the interaction types (green for Call, blue for Email, orange for SMS, purple for Meeting, gray for Other) and removed vertical connector lines.
- **Quick Sale Payment Alignment**: Aligned Exact Cash, UPI, and Card checkout buttons horizontally into a single clean row, eliminating high-contrast solid backgrounds.

## [2.0.3] - 2026-05-22
### Added
- **Customer Categorization (Tiers A/B/C):** Integrated customer categorization system into the database schema and frontend UI, enabling customers to be assigned to Gold (Tier A), Silver (Tier B), or Bronze (Tier C).
- **Credit Limit Management:** Introduced custom credit limits for customer accounts, allowing sales transactions to exceed standard P-Credit balances up to their configured limit.
- **Customer Communication Logs:** Added interaction logging for tracking customer calls, emails, SMS, and meetings, featuring a chronological timeline and log creation/removal tools in the Customer Activity Modal.
- **Tier-based Discount Settings:** Created a settings interface on the Customers page to configure default percentage discounts per tier, which are stored in system settings.
- **Tier Configuration Cards:** Overhauled the Tier Configuration stats cards on the Customers page to display solid, border-only color accents representing each tier (Gold for A, Silver for B, and Bronze for C) with clean neutral backgrounds by default, plus unique, subtle tier-specific color glows (Gold, Silver, Bronze) and lift translations on hover.
- **Enlarged Customer Activity Modal:** Expanded the Customer Details & History Modal to a larger layout (90vw width and 85vh height) for a more spacious purchase history table and interaction logs timeline view.
- **Sales POS Dynamic Discounts:** Integrated dynamic discount rate mapping in the POS checkout screen. Selecting a customer automatically applies their corresponding tier discount rate with instant toast feedback.
### Fixed
- **Wallet & Credit Checkout Validation:** Refactored checkout and payment updating APIs to validate transactions against the combined customer credit line (`p_credit_balance + credit_limit`), returning clear validation errors if exceeded.

## [2.0.2] - 2026-05-21
### Added
- **POS Subcategory & Product List Full-Width Styling:** Overhauled subcategory titles and aligned product lists in the Standard Invoice page to match the full-width header bar design in the Inventory page.
- **POS Checkout Custom Payment Selector:** Integrated `CustomSelect` dropdown component for checkout payment method/split selection in the Standard Invoice page to achieve cohesive, premium styling.
- **P-Credit Wallet Deduction & Validation:** Integrated Wallet payment deductions directly from the customer's P-Credit balance with strict transactional validation. If the customer lacks sufficient balance, a standard bad request error is raised: `"Customer does not have sufficient balance in P-Credit to pay."`
- **Dashboard Orders vs Revenue Active Bar Hover Style:** Configured activeBar rendering for the Orders bar in the "Orders vs Revenue" composed chart to darken it to opacity `0.4` when hovered, making active chart columns easily visible.
### Fixed
- **Variant-Aware Batch Add:** Refactored product picker bulk additions to check variant-level stock, allowing items with variants to be correctly batch added.
- **Uncategorized Group Harmonization:** Aligned empty subcategory fallback to 'Uncategorized' across Inventory and Sales pages.
- **Subcategory Mismatch in Add Product Modal:** Resolved issue where certain subcategories were not showing up in the "Add Product" dropdown due to an alphabetical index mismatch between front-end arrays and database IDs. Implemented self-healing SQLite startup script to repair orphaned subcategory mappings automatically.
- **Cloud Storage Backups Icon Path:** Corrected absolute image source for the Mazeway Cloud Backups icon, resolving the issue where the icon failed to render in the installed production build due to file protocol loading constraints.

---

## [2.0.1] - 2026-05-21
### Added
- **Double-Click POS Batch Add:** Implemented double-click events on Category and Subcategory headers in the POS to automatically add all in-stock products under the category/subcategory to the cart.
- **Checkout Cart Subcategories:** Displayed the subcategory name below the product name in both the checkout cart in Sales Page and the Customer Display cart.
### Fixed
- **SQLite Return Schema Migration:** Added automatic database migration for `return_type` column to resolve return transaction failures.

---

## [2.0.0] - 2026-05-21
### Added
- **Subcategory Customer Distribution (Inventory Dashboard):** Added a new pie chart and category selector to analyze customer distributions across subcategories.
### Fixed
- **Gross Profit (Est.) Dashboard Card:** Fixed database calculation query by joining product variants and batches to resolve cost prices accurately.
- **Payment Confirmation Dialog:** Resolved a scoping ReferenceError in sales confirmation route.
- **Category Deletion Modal:** Polished confirmation messages and warning styling.

---

## [1.1.9] - 2026-05-21
### Added
- **Subcategory Selling Analytics:** Integrated a new Subcategory Selling Analytics pie chart card to the Inventory Dashboard tab. It lists unique customer counts per subcategory dynamically filtered by a parent category selector.

---

## [1.1.8] - 2026-05-21
### Added
- **Category-wise Selling Analytics:** Added unique customer count per product category in the Dashboard inventory tab.
- **Category Filter Dropdown:** Integrated a category-based filter in the Sales History toolbar.
### Changed
- **Global Rebranding and Icon Update:** Replaced all legacy application icons (`Appicon.ico`, `Mazelabs.png`, `Mazelab.png`) with the new custom Quantro logo across the taskbar, titlebar header, settings page, customer display, and installer panels.
- **Window Title Branding:** Renamed window title metadata from "Maze ERP" to "Quantro" for titlebar consistency.
- **Sidebar Subtext:** Updated sidebar subtext to display "Maze ERP" under the "Quantro" brand name.

---

## [1.1.7] - 2026-05-21
### Added
- **Advanced Serial/IMEI Tracking for Sales:** Implemented interactive serial number selection for the POS / Sales module. Added validation on sales flow to match cart quantities, client-side filters, and barcode scanning support with automatic quantity adjustment.

---

## [1.1.6] - 2026-05-21
### Fixed
- **Local Data & Backup Paths Display:** Exposed absolute backend paths to the settings page so users can see exactly where their data is stored inside AppData/Roaming rather than showing generic relative paths.

---

## [1.1.5] - 2026-05-20
### Added
- **Analytical Changes:** Completely overhauled the Dashboard with 6 new tabbed analytics pages (Sales, Inventory, Customers, Payment, AI/Automation, Financial) and an expanded 3-column KPI summary grid at the top.
- **Enhanced Visual Layout:** Polished chart styling, removed emojis from moving product headers, and improved card layout spacing.
### Fixed
- **Dashboard Failed to Load:** Resolved the rate-limiter block on localhost that occurred during multiple dashboard reloads.

---

## [1.1.4] - 2026-05-20
### Added
- **AI Sales Search & Filters:** Added a real-time search bar and custom drop-down filters (Channel and Status categories) to the AI Sales tab to easily manage and confirm automated sales.
### Changed
- **Unified Page Headers:** Standardized header structures, alignments, and descriptions across all tabs (Dashboard, Inventory, Sales, Customers, Purchases, Automation, Settings) for a highly polished, Apple-inspired premium feel.

---


## [1.1.3] - 2026-05-20
### Fixed
- **Seamless Mazeway Handshake Connection:** Bypassed the state parameter mismatch block when the state is missing or undefined due to redirect URL drops from the external Mazeway Auth dashboard, allowing the connection to complete 100% automatically and close the browser connection window instantly.

---

## [1.1.2] - 2026-05-20
### Added
- **Automatic System Updates:** Introduced an auto-update toggle switch in the "Version & Updates" settings. When enabled, Quantro will silently download official update binaries when an internet connection is detected, prompting the user with a "Restart to Update" button once ready.
- **Agent Modal Layout Polish:** Polished grid alignments and resolved absolute select element overflow issues within the "Own Provider" settings inside the Create Agent popup.

---

## [1.1.1] - 2026-05-20
### Fixed
- **Mazeway Handshake Resiliency:** Implemented detailed validation diagnostics and a secure browser-based link bypass option for state/token mismatches during external OAuth loops.

---

## [1.1.0] - 2026-05-20
### Fixed
- **Mazeway Handshake Connection:** Restructured authentication callbacks to use robust Express backend handshake routes with automated database sync, fixing empty key states.

---

## [1.0.9] - 2026-05-20
### Added
- **Ultimate Phone Calling AI Agent:** Integrated voice automation channels inside the Automation tab for real-time automated phone calls and business response triggers.

---

## [1.0.8] - 2026-05-20
### Added
- **WhatsApp AI Agent Update:** Introduced new Automation tab with advanced AI customer handling, messaging streams, and order integrations for Maze ERP and Quantro.

---

## [1.0.7] - 2026-05-19
### Fixed
- **Renderer Sandbox Security Bypass:** Relayed system browser auth URLs through secure IPC tunnel mapping to avoid renderer exceptions.
- **Interactive Update Architecture:** Integrated background download stream pipes with React UI state for real-time progress bars.

---

## [1.0.6] - 2026-05-19
### Fixed
- **React Component Crash Fix:** Added missing `ArrowRight` icon to `Icons.jsx` definition array to prevent dashboard settings tab from crashing.
- **Build Script Integration:** Bumped installer builds path for production setup releases.

---

## [1.0.5] - 2026-05-19
### Fixed
- **Windows 11 Print Engine Restructuring:** Replaced the faulty `enable-print-preview` dialog sequence with standard bypass mechanisms.
- **Native Print Integration:** Mapped direct legacy print configuration calls to let printer spoolers launch instantly.

---

## [1.0.4] - 2026-05-15
### Changed
- **AppData Roaming Relocation:** Moved SQL database store paths outside "Program Files" directory to prevent permission locks on Windows.
- **Dynamic Profile Paths:** Enabled user profile dynamic folders for SQLite operations.
