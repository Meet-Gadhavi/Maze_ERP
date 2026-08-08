# Quantro ERP Changelog

All notable changes to the Quantro ERP application will be documented here.

## [2.18.5] - 2026-08-08
### Added
- 🔄 **Supabase-to-Local SQLite Deletion Synchronization (`cloudSyncManager.js`)**: Configured the cloud pull service to automatically clean up and delete local records of products, customers, stores (excluding HQ), and employee profiles if they have been deleted from the cloud database on Supabase.
- 📐 **Dynamic Multi-Terminal Onboarding Workflows (`OnboardingModal.jsx`, `settings.js`)**: Redesigned onboarding modal flow dynamically based on selected terminal mode:
  - **HQ Terminal**: Standard 5-step detailed configuration.
  - **Store Terminal**: 2-step simplified onboarding verifying the HQ paired connection, linked company name, and logo.
  - **Remote Access**: 3-step remote onboarding prompting for access reasons and rendering a custom verified "Welcome Back" screen.
- ⚙️ **Settings Whitelist Expansion (`settings.js`)**: Added `onboarding_completed` and `terminal_type` to `ALLOWED_SETTINGS_KEYS` to allow persistence of onboarding meta-state.

---

## [2.18.4] - 2026-08-06
### Added
- 🛡️ **Onboarding Authentication & Key Verification Guard (`App.jsx`, `OnboardingModal.jsx`)**: Enforced user authentication checks prior to rendering the onboarding setup modal, preventing new installations from bypassing license activation or login screens.
- 🔑 **Pairing User Authorization Guard (`stores.js`, `OnboardingModal.jsx`)**: Updated `POST /api/stores/pair` endpoint to verify that the pairing requester's email exists as either a valid employee in the HQ `staff_profiles` or the active license owner in Supabase, preventing unregistered clients from pairing devices.

---

## [2.18.3] - 2026-08-06
### Added
- 🔌 **Store Branch Disconnect Action (`HRPayrollPage.jsx`, `api.js`)**: Linked the "Disconnect Branch" button in the Store Branches tab to trigger `api.deleteStore()`, allowing administrators to sever terminal pairing sessions and delete child branches.
- 🛠️ **Ref Forwarding on SidebarFooter (`ui/sidebar.jsx`)**: Wrapped `SidebarFooter` in `React.forwardRef` to properly forward refs to the underlying div element, fixing the React console warning: `"Function components cannot be given refs. Attempts to access this ref will fail."`

---

## [2.18.2] - 2026-08-06
### Added
- 📐 **Shopify Polaris Style SButton Action Alignment (`HRPayrollPage.jsx`, `HRPayrollPage.css`)**: Replaced all raw HTML `<button className="polaris-icon-btn">` inside the employee directory directory with the standard React `<SButton>` component. Converted the disconnect branch button in the Store Branches tab to `<SButton>` with critical styling.
- 🎨 **Shopify Polaris Style Tab Alignment (`HRPayrollPage.jsx`, `HRPayrollPage.css`)**: Refactored the HR & Payroll sub-tabs to use class names `tabs` and `tab-item` with scoped Polaris-like bottom borders and highlight animations.
- 🛡️ **Framer Motion Animated Icon Support (`Icons.jsx`)**: Added missing animated Lucide components (`Maximize`, `EyeOff`, `LayoutDashboard`, `Truck`) inside the bundle wrapper, fixing console warnings and broken layouts in the employee scope permission dropdown.

---

## [2.18.1] - 2026-08-05
### Added
- 🟢 **Live Terminal Pairing Status Sync (`stores.js`, `db.js`, `HRPayrollPage.jsx`)**: Resolved terminal pairing status persistence. When a child terminal pairs with a 16-character token, both local SQLite and Supabase cloud store records are updated to `is_paired = 1` and `status = 'CONNECTED'`. Parent HQ fetches live pairing status from cloud/local DB so terminals instantly transition from "Pending Pairing" to **Live / Connected**.
- 📐 **Vertical Custom Scope Matrix & Quantro Select (`HRPayrollPage.jsx`, `HRPayrollPage.css`)**: Redesigned the employee permissions scope matrix into a vertical stacked list with module icons, titles, and descriptions. Replaced standard native HTML `<select>` elements with a custom Quantro styled dropdown component (`QuantroScopeDropdown`) for smooth, styled scope selection (`Read & Edit`, `Read-Only`, `Hseen`, `Unseen`).
- 🎨 **Shopify Polaris Style Icon Buttons (`HRPayrollPage.jsx`, `HRPayrollPage.css`)**: Redesigned employee directory action buttons to match the exact Shopify Polaris spec (white container with subtle border `#d3d4d7`, inset bottom shadow, and clean outline icons: Eye `Icons.Eye`, Clock `Icons.Clock`, Rotate Payout `Icons.RotateCcw`, and Crimson Trashcan `Icons.Trash2`).
- 🗑️ **Employee Profile Deletion (`HRPayrollPage.jsx`, `api.js`, `backend/routes/hrPayroll.js`)**: Added `DELETE /api/hr/employees/:id` backend route and frontend `handleDeleteEmployee` function with confirmation prompts. Primary Owner profiles are protected from deletion.
- 📊 **Universal Multi-Terminal Branch Analytics Across All Dashboard Tabs (`dashboard.js`, `DashboardPage.jsx`)**: Extended the multi-terminal comparison system to **ALL 6 Dashboard Tabs** (Sales, Inventory, Customers, Payment, AI Automation, Financial). When any new child branch is paired (`stores`), the dashboard dynamically calculates its metrics, assigns a distinct color code (`#6366f1` HQ Indigo, `#ec4899` Child 1 Pink, `#10b981` Child 2 Emerald, `#f59e0b` Child 3 Amber), and renders live branch breakdown cards and multi-series comparison charts across all modules.

---

## [2.18.0] - 2026-08-04
### Added
- 🔒 **Employee Terminal Access Restriction (`HRPayrollPage.jsx`, `ProfileSwitcherScreen.jsx`, `AuthContext.jsx`, `backend/routes/hrPayroll.js`, `backend/db.js`)**: Introduced a new security boundary between the Parent HQ Terminal and Child Store Terminals. Admins can now mark any employee profile with **"Restrict login to paired child terminals and remote access sessions only (No HQ login)"**. When enabled, the employee's profile card shows a red **Terminal Only** lock badge on the HQ device, PIN login is blocked with a clear error message, and the backend `/hr/auth/login` endpoint enforces the same check via the `restrict_to_terminals` database flag. OWNER-role accounts are always unrestricted by default.
- 🏗️ **Automatic Terminal Restriction by Role (`HRPayrollPage.jsx`)**: When creating or editing an employee profile, changing the Job Role automatically toggles the terminal restriction — non-owner roles (Cashier, Store Manager, etc.) default to restricted, while OWNER automatically disables the restriction.
- 🔐 **Backend HQ Guard (`backend/routes/hrPayroll.js`)**: The `POST /api/hr/auth/login` endpoint now accepts an `is_hq` flag from the frontend. If a restricted employee attempts to log in from an HQ terminal, a `403 Access Denied` response is returned immediately.
- 📋 **Onboarding Primary Admin Unrestricted (`OnboardingModal.jsx`)**: During first-time ERP setup, the primary admin account created in onboarding is explicitly set as unrestricted (`restrict_to_terminals: 0`), ensuring the owner always has full HQ access.
- 🛡️ **Database Migration (`backend/db.js`)**: Added `restrict_to_terminals INTEGER DEFAULT 1` column to the `employees` table with an automatic `ALTER TABLE` migration for existing installations.

---

## [2.17.9] - 2026-08-03
### Changed
- 🔐 **Strict Supabase PIN Verification (`ProfileSwitcherScreen.jsx`)**: Enforced strict PIN checking in `verifyPinAndLogin` against the `pin` column in the Supabase `staff_profiles` table. Removed the fallback default PIN values (`1234`/`0000`) for logins.

---

## [2.17.8] - 2026-08-03
### Added
- ⌨️ **Physical Keyboard/Numpad Support (`ProfileSwitcherScreen.jsx`)**: Added global keyboard event listeners when the PIN overlay is active. Users can now type numbers using their physical keyboard or POS numeric pad (with Num Lock active), use Backspace to delete, 'C' to clear, and Escape to dismiss the modal.

---

## [2.17.7] - 2026-08-03
### Changed
- 🔐 **Enforced Security PIN for Admin Profiles (`ProfileSwitcherScreen.jsx`)**: Removed the direct dashboard login bypass for OWNER/HQ/ADMIN profiles. Now, all profiles (including the Primary Admin) are prompted for their 4-digit POS security PIN set during onboarding/creation.

---

## [2.17.6] - 2026-08-03
### Changed
- 🏬 **Migrated Branch Pairing UI to HR & Payroll Tab (`SettingsPage.jsx` & `HRPayrollPage.jsx`)**: Moved store pairing options and modals (`Add & Pair New Child Branch` and `Connect This Terminal to Parent HQ`) from Settings tab to HR & Payroll tab. Removed the redundant `Store Profiles & Branch Pairing` tab in Settings.
### Fixed
- 🟢 **HQ Branch Status Display (`HRPayrollPage.jsx`)**: Fixed status display for the Main HQ branch to show "Live" status (instead of "Pending Pairing") and marked as "Primary Admin (No Disconnect)" to prevent accidental disconnection.
- 🐛 **ReferenceError Fix for Settings (`SettingsPage.jsx`)**: Restored `stores` in the `useAuth()` destructuring hook, resolving the crash when loading the Profile settings tab (which displays stacked branch details).

---

## [2.17.5] - 2026-08-03
### Fixed
- 🔓 **Offline / Local Session License Activation Bypass Fix (`App.jsx`)**: Updated initial session loader and auth state change listener to mark license activation status as active if a valid local-only profile session is running, resolving the `"No active authentication session found."` lockout error when local-only profile-switched users boot the app.
- 🎨 **Sidebar Quantro Logo Fallback Fix (`Sidebar.jsx`)**: Replaced the plain text "Q" brand fallback icon in the sidebar header with the actual Quantro brand logo image asset (`./icons/Logo.png`) when no custom business settings logo is uploaded.

---

## [2.17.4] - 2026-08-02
### Fixed
- 🐛 **Null Session User Property Access Fix (`App.jsx`)**: Guarded `checkActivation` and `handleVerify` inside `ActivationGate` to check if `session` or `session.user` is null/undefined before checking license details, eliminating the `"Cannot read properties of null (reading 'user')"` runtime crash when loading profile-switched sessions.

---

## [2.17.3] - 2026-08-02
### Fixed
- 🔓 **Profile Switcher Dashboard Navigation Fix (`AuthPage.jsx` & `App.jsx`)**: Persisted `quantro_local_session` and `quantro_current_user` in `localStorage` upon profile tile selection, resolving an issue where clicking a profile tile on the "Who's using Quantro?" screen refreshed the page without navigating into the main Dashboard.

---

## [2.17.2] - 2026-08-02
### Fixed
- 🐛 **Backend Syntax Error Fix (`cloudSyncManager.js`)**: Resolved a missing function closing bracket in `cloudSyncManager.js` that caused Node.js to fail on startup with `SyntaxError: Unexpected end of input`, restoring backend availability and resolving the `"Backend server is not running"` message.

---

## [2.17.1] - 2026-08-02
### Added
- 🔄 **Real-Time Supabase Cloud Sync & Pull Engine (`cloudSyncManager.js`)**: Implemented `pullFromCloudAndSyncLocal()` with a continuous 15-second background interval to sync live cloud data across all pages (Dashboard, Inventory, Customers, Purchases, Expenses, HR/Payroll, Settings).
- 🎨 **Sidebar Branding Icon Fallback (`Sidebar.jsx`)**: Updated top sidebar header to display a gradient brand icon box with fallback `Q` logo if custom business logo is not present.

---

## [2.17.0] - 2026-08-02
### Added
- 🖥️ **Full-Page Onboarding Screen (`OnboardingModal.jsx` & `OnboardingModal.css`)**: Expanded the onboarding wizard to full-page, purged all emojis from step cards, and made 16-character terminal key validation mandatory for Store Terminal and Remote Access modes.
- 🏬 **Store Branches & Pairing Keys Tab (`HRPayrollPage.jsx`)**: Transferred store branch pairing management into HR & Payroll tab with `Pending Pairing` and `Connected` status badges (preventing disconnect until key is paired).
- 🔓 **HQ Logout Auth Routing (`AuthPage.jsx`)**: Enforced default normal Auth page (Email + Password) when logging out on an HQ Terminal, bypassing profile switcher screen.

---

## [2.16.0] - 2026-08-02
### Added
- 🏬 **Multi-Store Architecture & Bifurcated Terminal Flow (`OnboardingModal.jsx` & `AuthPage.jsx`)**: Redesigned device onboarding into 3 clear terminal pathways: **🏢 HQ Terminal** (Full Admin access, direct dashboard login), **🏬 Store Terminal** (16-char store pairing key, Chrome profile switcher + 4-digit PIN), and **🏠 Remote Access** (Read-Only stock & POS safeguards).
- 🏷️ **Quantro / Mazelab ERP Branding (`Sidebar.jsx`)**: Reverted top sidebar branding to "Quantro" logo with primary title "Quantro" and sub-text "Mazelab ERP", and removed top store-selection dropdown.
- 🔐 **Granular Tab & Sub-Tab Scopes Matrix (`HRPayrollPage.jsx`)**: Integrated granular scope configuration (`unseen`, `hseen`, `read`, `edit`) across all tabs/sub-tabs (Dashboard, Inventory, Sales, Customers, Purchases, HR/Payroll, Settings).

---

## [2.15.6] - 2026-08-01
### Added
- 👥 **Real-Time Customer Cloud Sync (`customers.js`)**: Wired customer creation and updates directly to `cloudSyncManager.syncCustomer()` to guarantee instant upsert into Supabase `public.customers` table.

---

## [2.15.5] - 2026-08-01
### Added
- 🚀 **Per-Account Onboarding Evaluation (`App.jsx` & `OnboardingModal.jsx`)**: Updated onboarding trigger logic to evaluate onboarding per user account email (`quantro_onboarding_completed_${userEmail}`), ensuring the business onboarding modal pops up for every newly registered email account.

---

## [2.15.4] - 2026-08-01
### Added
- 🔓 **Admin Direct PIN Bypass (`ProfileSwitcherScreen.jsx`)**: Admin / Owner profiles now log directly back into the Dashboard without entering a PIN, reserving 4-digit PIN access strictly for staff/employee profiles.
- 💾 **Automatic Logged-In Profile Storage (`AuthPage.jsx`)**: Authenticated user accounts (Email / Google) are automatically saved to the device terminal's profile list upon login for easy profile switching.

---

## [2.15.3] - 2026-08-01
### Added
- 🔒 **Purged Legacy Hardcoded Email (`admin@quantro.app`)**: Completely removed `admin@quantro.app` string fallbacks from `db.js`, `AuthContext.jsx`, `Sidebar.jsx`, and `ProfileSwitcherScreen.jsx` so only real authenticated user emails are displayed.
- 🔁 **Restored "+ Add Account" Auth Page Redirect**: Reverted "+ Add Account" card click behavior in `ProfileSwitcherScreen.jsx` to redirect directly to the Auth sign-in screen as originally designed.

---

## [2.15.2] - 2026-08-01
### Added
- 🔑 **4-Digit POS Security PIN Setup in Onboarding Wizard (`OnboardingModal.jsx`)**: Integrated mandatory 4-digit PIN setup during business account onboarding (Step 4) for instant 1-second terminal profile login.
- 👤 **Automated Initial Staff Profile Creation**: Automatically provisions the primary admin staff profile with their 4-digit PIN into SQLite DB and Supabase `public.staff_profiles` upon completing onboarding setup.

---

## [2.15.1] - 2026-08-01
### Added
- 📥 **Automatic JSON Backup Import Categorization & Supabase Cloud Sync (`data.js`)**: When users import data JSON files in Settings Data Management, all imported tables (`products`, `customers`, `invoices`, `suppliers`, `purchases`, `expenses`, `employees`, `settings`) are automatically categorized and inserted directly into their respective Supabase cloud tables.
- 👤 **Dynamic Staff Profile Loading & In-Screen Staff Creator (`ProfileSwitcherScreen.jsx`)**: Fixed Profile Switcher screen to query real DB staff profiles, removed static default fallbacks, and added an in-screen "+ Add Staff Profile" modal for 1-second PIN setup.
- 🖼️ **Robust Avatar & Logo Image Fallbacks**: Built initial badge fallbacks (`GA`, `MG`, `JD`) with rich glassmorphism styling to prevent any broken image placeholders.

---

## [2.15.0] - 2026-08-01
### Added
- ☁️ **Universal Real-Time Supabase Cloud Sync (`cloudSyncManager.js`)**: Built an automated cloud sync manager that syncs all core ERP modules directly to Supabase PostgreSQL cloud tables.
- 📦 **Inventory Catalog Cloud Sync (`inventory.js`)**: Real-time upserting of products, SKUs, selling/purchase prices, tax rates, and stock levels to `public.products`.
- 🧾 **Sales & Billing Invoices Cloud Sync (`sales.js`)**: Instant cloud sync for all sales invoices, itemized line items (`public.invoice_items`), payment modes, and financial statuses.
- 🛒 **Purchases & Suppliers Cloud Sync (`purchases.js` & `suppliers.js`)**: Live synchronization of purchase orders, vendor profiles, and outstanding balances to `public.purchases` and `public.suppliers`.
- 💰 **Expenses & Staff Profiles Cloud Sync (`expenses.js` & `hrPayroll.js`)**: Automated cloud backup for operational expenses and staff profiles/POS PINs to `public.expenses` and `public.staff_profiles`.
- 🔄 **Startup Bulk Sync Engine**: Automatic background process that checks and uploads any missing local SQLite records to Supabase 5 seconds after application startup.

---

## [2.14.0] - 2026-08-01
### Added
- 👤 **Google Chrome-Style Light Theme Staff Profile Switcher (`ProfileSwitcherScreen.jsx`)**: Designed a clean, modern light-themed profile selection screen (`Who's using Quantro?`) featuring visual profile cards, real Google account profile pictures with initial fallbacks (**GA**), role badges, and an **"+ Add Account"** option.
- 🔑 **1-Second POS PIN Login**: Staff cards trigger a quick 4-digit PIN modal for 1-second instant profile switching on terminal devices.
- 🛡️ **Remote Change Inspection & Conflict Resolution (`RemoteChangesModal.jsx`)**: Added a multi-device remote change review modal to inspect laptop or external device modifications with IP address tracking, detailed summary of changes, and **[ Apply & Merge ]** or **[ Discard ]** options.
- ⚡ **Supabase Delta Cloud Sync Schema (`store_cloud_deltas`)**: Added PostgreSQL tables and indexes to log pending remote updates and active terminal device sessions.

---

## [2.13.0] - 2026-08-01
### Added
- 🚪 **Working Switch Account & Real Supabase Signout**: Fixed profile card logout button to execute real `supabase.auth.signOut()`, clear local staff session state, and navigate straight to the Staff Login screen (`/#/auth`).
- 📧 **Logged-In Email & Role Display**: Sidebar footer profile badge dynamically displays the authenticated user's actual email address and role designation (e.g. `Child Branch Staff` vs `Primary Admin`).
- 🔒 **Role-Based Tab Access Control**: Enforced strict tab access rules across Cashiers (`Sales`), Inventory Clerks (`Inventory`), Store Managers, Accountants, and Owners.
- 🖼️ **Quantro Brand Header Logo**: Left brand box in the top store switcher automatically uses uploaded business logo or official Quantro logo; purged text/icon emojis from `All Outlets`.
- ⚡ **Supabase PostgreSQL Cloud Store Handshake**: Real cloud synchronization and 16-character token verification between Parent HQ and Child Terminals using `public.stores` and `public.store_pairing_tokens`.

---

## [2.12.0] - 2026-08-01
### Added
- 🚀 **Interactive Business Onboarding Wizard (`OnboardingModal.jsx`)**: 5-step onboarding flow with a broken/segmented progress bar for initial store setup immediately after login.
- 🏢 **Parent HQ vs Child Branch Setup**: Step 1 choice between setting up a new primary HQ business account or connecting to a Parent HQ network via a 16-character Branch Pairing Token.
- 🖼️ **Logo Upload & Branding**: Interactive drag-and-drop Logo Upload Dropzone with instant image preview in Step 5.
- ⚙️ **Auto-Population of Settings**: All onboarding details (Business Name, GSTIN, Place of Supply, Phone, Email, Logo) automatically populate into SQLite DB settings.
- 🔌 **Child Branch Disconnect**: Added "Disconnect Branch" button in `Settings > Store Profiles` tab so HQ admins can disconnect or remove child branch terminals at any time.
- 🎨 **Light Theme Animate UI Radix Sidebar**: Authentic Radix sidebar implementation with clean light palette, top store switcher, distinct Lucide icons, and bottom profile card.

---

## [2.11.0] - 2026-07-31
### Added
- 👥 **Dedicated HR & Workforce Payroll Module (`/hr-payroll`)**: Full workforce management suite for employee profiles, credentials, 6-role permission assignments, POS clock-in/out attendance, base salary structures, and 1-click monthly salary disbursements.
- 🔑 **Staff Email & 4-Digit POS PIN Authentication**: Staff members log in with their work email and password or 4-digit PIN; Quantro automatically opens the exact feature scope permitted for their role.
- 🏢 **Multi-Store Cloud Sync & Parent-Child System**: 16-character Branch Pairing Tokens to pair child ERP terminals with Parent HQ.
- ⚙️ **Universal Multi-Branch Stacked Settings UI**: Every settings tab automatically appends stacked configuration cards for each added/paired branch (`Company 1 Parent HQ`, `Branch 2 Child`, etc.).
- 📍 **Top Header Store Switcher & User Profile Badge**: Quick store branch selector (`STR-001 Main HQ`, `STR-002 Downtown Outlet`, `ALL STORES CONSOLIDATED`) and active staff user profile badge with quick logout.

---

## [2.10.68] - 2026-07-26
### Added
- **Quotation Preview Redesign**: Completely rebuilt the quotation preview with a premium construction-style green-themed layout featuring client/details side-by-side cards, branded header, signature lines, and green-accented items table.
- **Quotation Share via Email & WhatsApp**: Added full Share popup for quotations — send quotation via Gmail or WhatsApp PDF directly from the preview modal, matching the invoice sharing experience.
- **Backend Quotation Email Template**: Added `generateQuotationTemplate` in Gmail sender and `generateQuotationPDF` in PDF generator for server-side quotation rendering.
- **Backend Send-Quotation Endpoints**: New `/auth/google/send-quotation` and `/auth/whatsapp/send-quotation` API endpoints.

### Removed
- **Invoice Print Button**: Removed the Print / PDF button from the Invoice Preview modal footer to streamline the UI.

## [2.10.67] - 2026-07-25
### Changed
- **Forced Seeded Credit Reset**: Automatically resets any legacy/free seeded ₹500.00 wallet balances to ₹0.00 in the local SQLite settings database on startup, forcing users to top up manually.
- **Low Credit Warn Banner**: Display warnings on the Billing Page when the wallet balance drops below ₹50.00, prompting early top-ups.

## [2.10.66] - 2026-07-25
### Changed
- **Robust Offline Support**: Registered fallback custom web components for `s-button` and `s-modal` at the entry point level. This prevents the white screen crash on startup when internet is disconnected, and ensures buttons and modals render properly with native styling.

## [2.10.65] - 2026-07-25
### Changed
- **Dynamic Overage Cost Display**: Fixed the Overage Cost displays showing ₹0.00 for Gmail and WhatsApp. The cards now dynamically calculate and count usage costs (e.g. ₹0.30 per WhatsApp, ₹0.05 per email) based on active usage.
- **Improved Transaction Verification**: Documented SQL editor instructions to resolve the Supabase RLS policy issue, which previously prevented deductions and transactions from registering in the history log.

## [2.10.64] - 2026-07-25
### Changed
- **Zero Default Wallet Credits**: Removed default ₹500.00 wallet credit allocations on new installations, defaulting to ₹0.00 instead.
- **Local ERP Live Database Fallback**: Integrated automatic local SQLite live database fallback for reading and writing wallet balances. If the remote database has no transactions for a license, it inherits the local ERP settings table balance.
- **Path-Based Billing Routing**: Fixed broken query parameter URLs for billing top-up and scanner pages, shifting to path-based routing (`/top-up` and `/scanner`) on Quantro Web.

## [2.10.63] - 2026-07-24
### Fixed
- **Supabase Node.js WebSocket Crash**: Added a mock WebSocket polyfill at the server startup level to resolve a crash where the Supabase Realtime client checks for a global WebSocket constructor in Node environments and fails. This completely fixes the "Backend server is not running" error on client installations.

## [2.10.62] - 2026-07-24
### Added
- **Diagnostic Backend Startup Error Reporting**: Prepend the actual stack trace and diagnostic error details directly in the frontend UI activation panel if the local Express backend fails to start. This prevents silent crashes (e.g. port conflicts, database locks, permission errors, or missing runtime resources) on clean client machines and simplifies troubleshooting.

## [2.10.61] - 2026-07-24
### Fixed
- **Electron fs Module ReferenceError**: Imported the missing `fs` module in the main Electron thread (`main/main.js`), resolving a crash/ReferenceError that blocked the Express backend server from starting up in packaged production builds.
- **Backend Error Logging**: Added local logging to `main_error.log` in the application's user data directory to simplify troubleshooting startup errors.

## [2.10.60] - 2026-07-24
### Added
- **Auto-Send Success Feedback Toasts**: Added active visual status toasts when generating new sales invoices when auto-send for WhatsApp or Email is enabled.

## [2.10.59] - 2026-07-24
### Fixed
- **WhatsApp Share Link**: Corrected the dynamic button URL suffix parameter format to resolve directly to `invoice/{token}`, matching the real web client path mapping instead of `invoice/{id}?token={token}`.

## [2.10.58] - 2026-07-24
### Added
- **WhatsApp Rating Webhook Interceptor**: Integrated support in the webhook receiver for handling Quick Reply button response events. Customer 1-5 star feedback selections are now automatically logged directly into the communication history logs in SQLite, followed by a thank-you reply message.

## [2.10.57] - 2026-07-24
### Added
- **Named Variable Support for WhatsApp Templates**: Integrated support for Meta's Named Variable template format. The ERP now maps positional parameters to custom names (`customer_name`, `inv_id`, and `buniness`) in the API payload to prevent validation crashes.

## [2.10.56] - 2026-07-24
### Changed
- **WhatsApp Invoice Template Variables**: Modified the `invoice_ready` template parameters sent by the ERP to only include 3 body variables (`customerName`, `invoiceNumber`, `companyName`), shifting the invoice share link completely to the "View Invoice" call-to-action button to support clean, link-free text bodies.

## [2.10.55] - 2026-07-24
### Fixed
- **Gmail Overage and Limit Displays**: Corrected transactional status and email limit logic on the Free plan so it accurately displays the standard free limit of 1,000 emails instead of the premium 50,000 threshold.
- **Account Summary Cleanup**: Removed the monthly dues summary card from the Billing page, fully transitioning the layout to the prepaid wallet model.

## [2.10.54] - 2026-07-24
### Added
- **Supabase-Driven Billing Page**: Migrated all license and wallet verification data from the local SQLite store to query live from the remote Supabase database.
- **Pre-Paid Wallet Model**: Removed legacy outstanding dues blocks and card payment setups. Usage costs are now deducted in real-time from pre-paid wallet balance credits.
- **Subscription Expiry Banners**: Added orange-gradient Apple-style warning notifications to the dashboard alerting users when their ERP subscription is within 5 days of expiration.
- **Vobiz Number Expiry Banners & Renewals**: Added upcoming expiration banners for Vobiz VoIP number subscriptions, with a warning that numbers will be released to other users after a 2-day grace period. Added conditional "Renew Subscription" and "Renew Vobiz Number" action buttons that open the `/renews` portal.

## [2.10.19] - 2026-07-18
### Fixed
- **Purchase Tab Navigation**: Corrected asynchronous fallback redirects in the Purchase Center. Free plan cashiers can now fully browse other tabs (such as Bill Center, History, Suppliers, Payments, Returns, and Expenses), while only the **Upload Invoice** scanner tab remains restricted.

## [2.10.18] - 2026-07-18
### Added
- **CRM Tab Locks & Disabling**: Locked the **Price Lists** tab and **Tier Configuration & Default Auto-Discounts** strip on the Free Starter plan (making them usable only on Business PRO and AI Professional plans). Custom-styled the UI blocks with reduced opacity, standard gray lock indicators (`#94a3b8`), and custom click handlers to toast upgrade instructions.

## [2.10.17] - 2026-07-18
### Added
- **UI & Feature Lock Standardizations**: Stacked subscription shields and text badges directly above the cashier name/avatar in the sidebar. Standardized all lock icons to a uniform premium gray color (`#94a3b8`) across settings, automation settings, and CRM fields. Wrapped disabled controls to trigger helpful upgrade toast notifications upon click, and locked the **Upload Invoice** scanner tab in Purchases for Free Starter users.

## [2.10.16] - 2026-07-18
### Added
- **Session Crash Recovery System**: Implemented a stateful session recovery tracker. When the app is opened, it checks if the previous session closed cleanly (e.g., from power outages, sudden lights off, force quits, or crashes). If it didn't, a premium "Session Recovery" modal is shown, allowing the cashier to restore the previous session state and automatically return to their active page/tab.

## [2.10.15] - 2026-07-18
### Fixed
- **OS Shutdown Interceptor for Backups**: Added a listener for the Windows `query-session-end` OS shutdown event. This prevents Windows from forcefully closing the application and corrupting database files during a session-end database backup. Instead, it triggers the standard visual backup progress screen, blocking Windows shutdown until files are secured, or offering "Shut down anyway" / "Cancel" options.

## [2.10.14] - 2026-07-18
### Added
- **Subscription Tier locks & Tier Badging**: Implemented subscription locks for Free Starter, Business PRO, and AI Professional plans. Features like Customer Tiers (locked to Tier C on Free), Credit Limit controls (locked to 0 on Free), Cloud backups, WhatsApp Campaign scheduling, and Outbound Voice Agents are now locked with status badges, tooltips, and toast warnings.
- **Shiny Tier Badge Shimmer**: Added an elegant, moving shiny shimmer/sheen gradient animation to the subscription tier badges in the sidebar footer (for all three plans) to make them stand out.

## [2.10.13] - 2026-07-18
### Changed
- **Admin Console Drawer Portal Refactor**: Refactored the slide-over resource diagnostics details drawer on the website Admin Console to render using a React Portal. This completely resolves parent container border clipping and top-edge alignment mismatches.
- **Header Line & Breadcrumb Cleanup**: Cleaned up top-level vertical dividers, replaced the sidebar toggle icon with a hamburger `Menu`, and aligned drawer bottom borders with the workspace header for a premium, clean aesthetic.
- **Hosted Invoices Sync Search Query Fix**: Fixed hosted invoice lookup queries on the Admin Panel's analytics page to match by license key, license email, or invoice settings email, resolving discrepancies when displaying client ownership.
- **Routing & Navigation Upgrades**: Implemented clean nested routes support on the hosted website client-side router for direct access to `/invoice/:id` endpoints without losing query variables.

## [2.10.12] - 2026-07-14
### Fixed
- **Companion Scanner Sync ID Mismatch**: Fixed a parameter casing discrepancy between the desktop ERP QR code URL and the hosted website companion parser. The QR code links now supply both `syncId` (camelCase) and `sync_id` (snake_case) query parameters concurrently to guarantee successful companion scanner pairing on all devices.

## [2.10.11] - 2026-07-13
### Changed
- **Hosted Invoice DB Migration**: Migrated the shared cloud database backend for hosted invoices from Mazeway DB on Vercel to Supabase. Updated sync services, merge/deletion route cleanup, and the public index template to read and write directly to Supabase using PostgREST syntax.
- **Authentication Domain Reversion**: Reverted the desktop-to-web OAuth login helper, billing links, and campaign checkout endpoints back to the production Render host (`https://quantro-web.onrender.com`).

## [2.10.10] - 2026-06-20
### Fixed
- **Taskbar & App Frame Icons Rebranding**: Regenerated the multi-size `Appicon.ico` from the new custom high-res logo. This replaces the old legacy icon across the Windows taskbar, application window frame, installer executable, and uninstaller panel.

## [2.10.9] - 2026-06-15
### Fixed
- **Hosted Invoice Overlapping & Collision Fix**: Fixed a critical issue where opening a hosted invoice link showed a different invoice (overlapping data) or overwrote existing cloud records. Enforced strict dual-matching (matching both `invoice_id` and `token` concurrently) across the client-side viewer page, the cloud sync pre-check, database update (`PATCH`), and deletion/merge cleanup operations. This isolates identical invoice IDs from different stores or database sessions, ensuring each unique link renders only its own correct invoice.

## [2.10.8] - 2026-06-15
### Fixed
- **Hosted Invoice Cloud Sync Pre-Check**: Fixed a critical bug in the cloud sync pre-check condition where the existence check for an invoice evaluated to `true` if any invoice existed in the database (due to the serverless DB API returning all rows on GET and ignoring query parameters). Corrected this to verify the specific invoice ID locally, ensuring new invoices are correctly inserted (`POST` request) rather than updated (`PATCH` request) on non-existent records.
- **Hosted Invoice Client Page Token Mismatch**: Fixed the client-facing hosted invoice viewer (`billing.maze`) which required an exact token match between the URL and cloud DB record. When tokens got desynchronized due to link regeneration or the previous sync bug, invoices showed "Access Denied" even though the data existed in the database. Updated the lookup to match by `invoice_id` only and always use the latest record, resolving the "Access Denied" error for all existing hosted invoice links.

## [2.10.7] - 2026-06-14
### Fixed
- **Hosted Invoice Sync Session Expiry**: Upgraded the cloud DB sync service error parsing to handle and display detailed Vercel/Mazeway DB session expiration responses. Intercepted expiration errors during link generation in the desktop app to guide cashiers on how to temporarily and permanently refresh their Google Drive-backed database session. Refactored the public hosted invoice template to display a professional, customer-friendly "Invoice Temporarily Unavailable" status page instead of a generic connection error when the Vercel token expires.

## [2.10.6] - 2026-06-13
### Fixed
- **Taskbar Application Icon**: Fixed a runtime path resolution bug where the taskbar and window icon would fail to load due to path differences and ASAR packaging constraints. Resolved by dynamically loading the icon using `nativeImage.createFromPath` from `renderer/dist` in production, and restricted the App User Model ID registration to packaged environments to prevent icon grouping/hiding issues in dev mode.
- **Hosted Invoice Domain**: Verified and standardized Netlify hosting routes (`billing-mazelab.netlify.app`) for public bill access.

## [2.10.5] - 2026-06-13
### Added
- **Quotation-to-Order Conversion:** Added a "Create Order" button directly inside the Quotation Preview modal. Users can instantly convert any saved quotation into a live sales invoice — a customer assignment modal appears for confirmation or override before loading items to checkout.
- **Quotation Builder Save & Convert:** Added a "Save & Create Order" action in the Quotation Builder tab that saves the draft quotation and immediately triggers the order conversion flow.


## [2.10.4] - 2026-06-13
### Fixed
- **Hosted Invoice Database Infrastructure**: Migrated hosted invoice synchronization database backend to high-speed server instances at Vercel (`https://mazeway-db.vercel.app`) to eliminate DNS connection issues, timeout delays, and fetch errors on client-facing share links.
- **Hosted Invoice QR Code Padding**: Added white background, padding, and box-sizing to payment QR codes on hosted client invoices (both classic and formal templates) to prevent QR scanner clipping when dark modes or dark elements are active.


## [2.10.3] - 2026-06-10
### Fixed
- **Quotation Builder UI Synchronization**: Refactored the Quotation Builder's product picker interface and cart layouts to match the standard invoice UI system perfectly.
- **Unified Product Selection Grid**: Integrated structured categories, subcategory tags, SKUs, and stock availability grids alongside inline quantity increment/decrement controls inside the quotation picker.

## [2.10.2] - 2026-06-10
### Added
- **Global Quotation Management System**: Cashiers can now create global quotation templates, search and filter quotations, view quotation details, print high-fidelity quotation sheets, and track quotation histories inside a dedicated "Quotations" tab on the Sales page.
- **Convert Quotation to Invoice**: Integrated a "Create Order" process. Selecting a quotation loads its items directly into the billing checkout cart, prompting the user to choose an existing registered customer or process as a walk-in customer to finalize the sales invoice.

## [2.10.1] - 2026-06-06
### Fixed
- **Shared Hosted Invoice Blank Screen**: Resolved a rendering bug on client-facing hosted invoices where the error screen and pay CTA box remained completely invisible due to `.hidden { display: none !important; }` CSS rule overriding `.style.display = 'flex'`. Switched toggles to use standard `classList.remove('hidden')` and `classList.add('hidden')`.
- **Robust Share URL ID Parsing**: Upgraded invoice ID extraction in `DOMContentLoaded` inside the public viewer page to robustly parse the invoice ID from query parameters (`?invoiceId=`, `?id=`, `?invoice=`) in addition to pathname routing, resolving failures when hosted invoices are loaded on local servers or static environments without clean URL path rewrites.

## [2.10.0] - 2026-06-05
### Added
- **Price List Coupon Code Integration at Billing**: Connected custom supplier/manufacturer Price List coupon systems directly to standard billing and POS checkout systems. Users can now apply custom price lists from a select dropdown in POS/Quick Sale.
- **Dynamic Price List Discounts**: Implemented automatic calculations that apply percentage or currency discounts from selected Price Lists to the invoice grand total dynamically.
- **Coupon vs Price List Coexistence Safeguards**: Added coupon logic validation in POS and Quick Sale checkout views that automatically clears active coupon codes when a Price List is selected, and clears/resets selected Price Lists when a coupon code is successfully applied.

## [2.9.9] - 2026-06-05
### Added
- **CRM Loyalty Points System**: Added a fully optional Loyalty Points program for customers. Customers earn points dynamically on purchases, which can be redeemed at checkout billing as a flat cash discount.
- **Nested Loyalty Settings Configuration**: Implemented a nested configuration section under App Settings to toggle the Loyalty Points program, configure earning rules (e.g., points per rupee spent), redemption rate, minimum redemption threshold, and point expiry schedules (nested choices: toggle switch, predefined days of 30, 90, 180, or 365, and a custom number of days input).
- **Loyalty CRM History and Tracking**: Integrated point balances inside the customer list/directory. Customer Details modal now includes a dedicated "Loyalty Points" tab showing total points balance, cash value, and chronological point transaction history (earns, redemptions, reversals, adjustments, and expirations).
- **Manual Point Adjustments**: Cashiers/managers can manually adjust (add or subtract) a customer's loyalty points with custom notes for customer service corrections directly from the CRM profile.
- **Dynamic Billing Redemption**: Integrated point redemption directly into POS/Standard checkout billing. The grand total is adjusted dynamically in real time when points are applied.
- **Point Reversals on Return/Deletion**: Earned points are automatically reversed when invoices are deleted or returned to prevent program abuse.

## [2.9.8] - 2026-06-05
### Added
- **Manual Batch & Expiry Management**: Added tab interface to manually register or delete batches, input stock levels, and set custom cost prices and expiration dates.
- **Enhanced Settings Warnings**: Added inline guidance links and warnings under the Batch and Serial tracking checkboxes to guide users if global features are turned off in Settings.
- **Robust SQLite Self-Healing Migrations**: Implemented auto-creation for batch and serial tracking fields in the database schema.

### Fixed
- **Email Auto-Reply Loop (mailer-daemon / DSN)**: Prevented the AI email receiver from sending replies to system-generated emails. Added three layers of protection — a sender blocklist (`mailer-daemon`, `postmaster`, `noreply`, `bounce`, `donotreply`, etc.), a subject blocklist (`Delivery Status Notification`, `Undeliverable`, `Mail Delivery Failed`, `Out of Office`, `Automatic Reply`), and RFC 3834 header checks (`Auto-Submitted`, `Precedence: bulk/list/junk`). Blocked emails are silently marked as read without any AI response.
- **Tracking Hint Text Overflow**: Moved the batch/serial tracking guidance messages inside the `option-row-label` flex column so they are constrained within the light-blue tinted Settings section container and no longer overflow its borders.

## [2.9.7] - 2026-06-05
### Fixed
- **System Print Dialogue & Interactive Preview**: Routed printing commands directly to the native Windows system dialogue using a secure IPC tunnel (`webContents.print({ useSystemDialogue: true })`), enabling fully interactive OS-level print previews for invoices and daily Z-reports.
- **Widescreen Print & PDF Accuracy**: Removed restrictive print overrides (such as `font-weight: 400 !important` and flat `color: #000 !important`), ensuring that printed documents and saved PDFs preserve their original colors, typography, layout structures, and bold emphasis exactly as shown on the screen preview.
- **Invoice PDF Quality Enhancements**: Increased the `html2canvas` render scale factor to `4` inside the Invoice Preview Modal to output high-resolution vectors, resolving blurry text on invoice PDF downloads.

## [2.9.6] - 2026-06-05
### Added
- **Dedicated Stock Adjustment UI**: Replaced single-item adjustments with a comprehensive bulk adjustments history and management suite, supporting write-offs, stock take audits, and custom notes.
- **Dynamic Inventory Valuation**: Built an interactive valuation panel calculating total asset value across FIFO, LIFO, and Weighted Average Cost (WAC) models using real-time purchase cost layers.
- **Kit & Bundle Product Management**: Integrated bundle product configuration. Stock is dynamically calculated from component availability, and sales checkout automatically decrements component stocks (with automatic return restoral).
- **Automated Reorder Point Triggers**: Added smart suggestions for low-stock items with one-click draft purchase order generation, grouped by preferred/last used supplier.

## [2.9.5] - 2026-06-04
### Added
- **Admin Console Edit & Delete Provisioned Agents**: Integrated options to edit voice agent configurations (name, language, model, voice ID, system prompt, first message) or delete them permanently directly from the online admin console. Deletes are automatically synchronized to local ERP client databases on their next status sync cycle.
- **Dynamic Autopay Resolution**: Resolved placeholder Card templates during payment setup on the Quantro Web Portal. The system now dynamically fetches actual Razorpay transaction details to configure Autopay for UPI and Net Banking users.
- **Enhanced Payment Method Renderer**: Styled Net Banking visual elements with a dedicated blue `BANK` badge, clean bank name labels, and hidden expiry date metrics inside the local Billing dashboard.
- **ElevenLabs Non-English Agent Fix**: Fixed conversational voice agent creation and updates for non-English languages (Hindi, Gujarati, Tamil, etc.) by dynamically selecting the ElevenLabs multilingual model (eleven_flash_v2_5) to prevent the "Non-english Agents must use turbo or flash v2_5" validation error.

## [2.9.4] - 2026-06-04
### Added
- **Outbound Voice Agent Campaigns**: Integrated ElevenLabs Conversational AI Voice Agents into the CRM Campaigns system, enabling automated outbound phone calls for customer engagement.
- **Daily Dispatcher Scheduler**: Implemented a daily rolling scheduler in the backend (`campaignScheduler.js`) that automatically chunks multi-day campaigns into daily dispatcher jobs, scheduling call batches with ElevenLabs on a daily rolling basis at 12:00 AM (midnight) to optimize telephony trunk operations.
- **Dynamic Phone Trunk Resolution**: Configured the dispatcher to dynamically fetch the ElevenLabs agent's bound phone/SIP trunk ID required to trigger the batch call payload automatically.
- **Interactive Daily Checklist & Progress Tracker**: Designed a premium horizontal tabbed daily progress checklist modal in the CRM. It pulls real-time call statuses from ElevenLabs batches, rendering individual completion counters, progress bars, visual status indicators (pending, dispatched spinner, called tick, failed warning), and date-based tabs.

## [2.9.3] - 2026-06-04
### Added
- **Horizontal Funnel Chart for Category-wise Selling**: Converted the Category-wise Selling RadarChart into a custom SVG horizontal Funnel flow chart. It renders smooth bezier curves, matching colors (Blue, Red, Orange, Yellow, Green), value text indicators inside segments, hover shadow triggers, and a detailed bottom legend.
- **Brand Blue Heatmap Palette**: Refined the Peak Selling Hours activity heatmap to color-scale based on the brand's blue palette (gray for zero, and light gray-blue to deep dark blue for higher activities).

## [2.9.2] - 2026-06-04
### Added
- **Peak Selling Hours Heatmap Grid**: Converted the Peak Selling Hours BarChart into a premium 7x24 weekday-by-hour activity heatmap grid (similar to GitHub's contribution graph and modern Figma chart UI components). It visualizes hourly sales intensities colored by revenue thresholds with interactive scale-ups, hover brightness filters, and descriptive hover tooltips.
- **Red Required Indicators on Auth Page**: Styled the mandatory indicator `(REQUIRED)` in red color next to Email, Password, and Captcha labels on the login/signup gateway.

## [2.9.1] - 2026-06-04
### Added
- **Global Loading Skeletons**: Integrated modern shimmering loader elements across Customers, Inventory, Sales/Billing, Purchases, Settings, and Dashboard views to improve visual perception and create a premium fluid app experience.
- **Direct Cash Refund for Sales Returns**: Added a dedicated "Direct Cash Refund" option in the returns window. It allows users to issue physical cash back immediately without modifying or adjusting outstanding credit balances.
- **Dashboard Visual Analytics Diversification**: Complete overhaul of the Recharts components inside `DashboardPage.jsx` to ensure each panel has a unique visual representation:
  - *Inventory*: Subcategory PieChart replaced with a horizontal BarChart.
  - *Customers*: Customer Growth AreaChart replaced with a vertical column BarChart.
  - *Customers*: Invoice Status PieChart replaced with custom styled percentage progress bars.
  - *Payments*: Method Distribution PieChart replaced with custom grid KPI cards.
  - *Payments*: Transactions count BarChart replaced with a clean donut PieChart.
  - *AI*: AI vs Manual orders PieChart replaced with custom progress comparison cards.
  - *AI*: Orders Over Time AreaChart replaced with a smooth LineChart.
  - *Financials*: Revenue vs Expenses AreaChart replaced with a dual LineChart.
  - *Financials*: Expenses by Category PieChart replaced with a horizontal BarChart.
- **Auto-Sync Push Metadata**: Added a "Last Sync/Push" metadata log underneath the auto-sync configuration panel to track the exact date and time the ElevenLabs agent prompt file was updated.

## [2.9.0] - 2026-06-04
### Added
- **AI Agent Knowledge Base Folder Synchronization**: Added a complete, automated synchronization system to map local ERP data snapshots into the ElevenLabs Conversational AI Agent's Knowledge Base.
- **Dynamic Markdown Snapshot Generation**: Implemented a backend utility to automatically format crucial SQLite business tables (Products, Customers, Suppliers, Sales, and Invoices) into a clean, structured Markdown format (`.md`) optimized for LLM readability.
- **Folder and Document Lifecycle Management**: Configured the sync workflow to create/find a designated ElevenLabs Knowledge Base folder named after the Agent's ID, automatically purge outdated Markdown snapshots, upload the fresh ERP database snapshot, and register/select it directly inside the target agent's `knowledge_base` configuration array.
- **Multi-Agent Select Prompts**: Implemented dynamic agent selection picker modals in settings for manual pushes ("Push Latest"), enabling Auto-Sync, and selecting "End of Session" backup frequency when more than one active agent is configured.

### Fixed
- **Knowledge Base Prompt Mode Constraint**: Resolved the `document_cannot_be_used_in_prompt_mode` error by linking the individual `.md` backup file locator rather than the parent folder (which is not allowed in agent prompt lists).
- **Stable Document Referencing**: Implemented in-place text document updates via ElevenLabs `PATCH /v1/convai/knowledge-base/{docId}`. This keeps the file ID stable across all sync runs, eliminating deletion conflicts and preventing broken agent configurations.

## [2.8.0] - 2026-06-04
### Added
- **Global Timezone Support**: Automatically configured the process timezone to `Asia/Kolkata` (Indian Standard Time) at system initialization for uniform tracking and date formatting.
- **Provisioning Agent Editing**: Added full support for editing voice agents in the `PROVISIONING` state directly from the manage voice console. Edits dynamically update the local SQLite database configurations and sync metadata updates to the cloud-hosted Mazeway table on Supabase.
### Fixed
- **ElevenLabs Agent Customization**: Fixed a critical bug in the ElevenLabs integration payload mapping where the selected voice, model, and language options were ignored. Correctly mapped the keys to `conversation_config.tts.voice_id` and `conversation_config.agent.prompt.llm`.
- **Payment Config Propagation**: Fixed a bug where configuring an agent through "Buy Now" checkout would lose the user's custom settings on completion by dynamically merging UI form inputs upon payment success.
- **Orphaned Provisioning Cleanup**: Fixed SQLite duplication by automatically removing outdated temporary agent records when provisioned agents are successfully activated.

## [2.7.9] - 2026-06-04
### Added
- **AI Voice Agent Customization**: Added dropdown inputs to choose **Model Selection** (Cheap: GPT-4o-Mini, Medium: GPT-4o, Expensive: Claude 3.5 Sonnet) and **Voice Agent Voice** (Vraj, Monika) inside both the desktop app creation modal and web console page.
- **Deep Link Param Syncing**: Updated deep link callbacks and payment message handlers to propagate language, model, and voice_id parameters seamlessly from web checkouts to local SQLite database records.
- **Bound Telephony Auto-Cleanup**: Configured the desktop client agent deletion process to query ElevenLabs and automatically delete any phone numbers/SIP trunks bound to the agent ID from ElevenLabs telephony list.
- **Interactive KPI Navigation Indicators**: Added a sleek, premium inclined arrow icon (`ArrowUpRight`) in the top-right corner of interactive KPI cards ("Low Stock", "Pending Dues", "AI Orders") on the Dashboard overview to clearly guide users that clicking the cards redirects them directly to their corresponding pages/tabs.
### Fixed
- **Persona & Language Display**: Resolved a mapping bug in the voice agents listing card where Persona and Language fields were displayed as blank, and replaced raw prompt texts and language codes with user-friendly label values.

## [2.7.8] - 2026-06-04
### Added
- **Native ElevenLabs Conversational AI Integration**: Completely removed Mazeway dependencies, transitioning all real-time voice agents to direct ElevenLabs APIs with custom SIP Trunking configuration.
- **Voice Agent Management Console**: Built a secure verification-protected configuration page (`/managevoice=2008` or password verification) to set up agent behaviors, languages, prompts, and detailed inbound/outbound SIP Trunk parameters directly.
- **Dynamic Telephony Control**: Allowed prompt, first message, and full SIP configurations (Label, phone number, and outbound parameters) to be edited, updated, or deleted directly from the desktop ERP client.
- **Local Agent Isolation Filtering**: Filtered the ElevenLabs voice agents list using local SQLite metadata mappings to isolate and display only the user's own agents rather than showing all agents on the shared account.
- **Direct Active Provisioning**: Configured both own provider (SIP Trunk) and managed (paid) voice agents to bypass provisioning states and create directly as active.
- **Cleaned Settings Integration**: Removed legacy Mazeway AI Integration panel, connection state, handshake listeners, and the connect authorization modal from app settings.

## [2.7.7] - 2026-06-04
### Added
- **Live Razorpay Web Checkout for Managed Agents**: Replaced simulated checkout with a live Razorpay integration. Managed Voice Agent purchases are redirected to the web portal where payments (Starter ₹600, Pro ₹700, Enterprise ₹1100) are securely processed via Razorpay. Once confirmed, users receive the "Provision Agent" button to deep-link back and unlock their AI voice agent.
- **Voice Agent Campaigns CRM marketing tab**: Added a new tab for scheduling Voice Agent Campaigns inside the CRM's Marketing module, configured with placeholder layout details and "Coming Soon!" scheduling alerts.

## [2.7.6] - 2026-06-04
### Fixed
- **Professional Google Auth Redirection**: Integrated desktop-to-web Google Sign-In routing. The desktop application now initiates authentication requests through the hosted marketing domain (`https://quantro-web.onrender.com`), eliminating raw Supabase OAuth authorize links for a secure, branded, and professional auth experience.
- **Google OAuth Captcha Enforcement**: Enforced visual Canvas security verification captcha checks on Google Sign-In inside the desktop auth view, blocking bot or automated sign-in triggers before launching the browser.

## [2.7.5] - 2026-06-03
### Added
- **Authentication Security Captcha**: Implemented a secure, custom HTML5 Canvas-based alphanumeric verification captcha in `AuthPage.jsx`. It includes dynamic character rotation, color variations, random background noise lines, and distorting dots to block bot or robot automated login attempts.
- **Nested Hardware Settings**: Restructured the hardware integration settings tab layout in `SettingsPage.jsx` to nest and conditionally hide barcode scanner connection tests and cash drawer trigger tests under their respective feature-enabled toggle switches.
- **UPI Autopay & Account Support**: Added native support for registering UPI accounts for Autopay. Users paying outstanding dues via UPI inside the simulated Razorpay Checkout portal can save their UPI VPA directly as their default payment method (saved as brand `'UPI'` with no card expiry dates) instead of dummy Visa details.
- **Variant Buying & Return Capability on Purchases**: Added variant-level stock and average cost updates on purchase receipt saving. Updated the Purchase Bill interface to allow searching, selecting, and adding specific variants to the cart, and submitting them in the purchase payload. Added support for processing purchase returns at the variant level, including composite variant-aware key tracking on the return table.

### Fixed
- **Dashboard Cards Border Line**: Modified the KPI cards design system inside `DashboardPage.css` to render a colored accent line at the left edge of all dashboard cards for cohesive aesthetics, matching custom status variants.
- **Cash Drawer Integration Trigger**: Configured the POS print process inside `InvoicePreviewModal.jsx` to automatically trigger the cash drawer kick command via Electron IPC bridge if the `enable_cash_drawer` setting is enabled.
- **Real VoIP Minute Counts**: Corrected telephony minute reporting in `mazeway.js` by querying and summing actual duration seconds (`duration_seconds`) from the `mazeway_orders` database table rather than generating calculated simulated estimates.
- **WhatsApp OAuth Loopback Redirect**: Resolved Meta connection failures in production. Switched callback redirects from a hardcoded localhost port to the `maze-erp://whatsapp-auth-callback` deep link protocol, allowing successful OAuth completion inside the desktop Electron environment.
- **Stock Adjustment Tracking Sync**: Fixed inventory de-synchronization for tracked products. Manual adjustments now automatically sync serial numbers (inserting placeholder serials on increases or LIFO-purging available serials on decreases) and batches (LIFO-deducting quantities or creating adjustment batches).
- **Return Records Migration during Invoice Merge**: Fixed data loss of return history on invoice merging. Merging invoices now preserves associated invoice return logs, stock movements, and audit logs by re-linking them to the newly generated merged invoice.
- **Duplicate Supplier Serial Returns**: Prevented returning the same supplier serial number multiple times by adding status validation checking for `'Returned_To_Supplier'` in the return route.
- **Mazeway Callback Handshake Origin Mismatch**: Fixed handshake message blocking by changing `postMessage` target origin to `'*'` to resolve the origin mismatch between Electron and local callback servers.
- **Out-of-sync Parent Product Stock**: Synchronized parent product stock quantities automatically when variants are created, edited, deleted, sold, returned, fulfilled, or converted, and updated the Inventory view to display correct summed stock for variant products.
- **Dashboard Financial Mismatch & Low Stock Count**: Corrected net KPI calculation using range-specific summed revenue in the financial tab, and aligned low stock counts and products list queries on the dashboard.

## [2.7.4] - 2026-06-03
### Fixed
- **Sales Return Quantity Cap**: Fixed a stock and financial leak vulnerability inside the invoice return processor. Enforced returned quantity verification limits based on actual delivered products (`qty_delivered`) rather than ordered/requested quantities (`qty_requested`). This prevents inventory inflation (ghost stock) and financial refund leaks for undelivered items in advance or partial checkout flows.
- **Dynamic Price Sync Control**: Added a sub-toggle "Restrict Sync to Unpaid & $0 Price" under "Real-time Price Dynamic Sync" in the settings page. When enabled, catalog price updates will only affect unpaid invoices and items originally checked out at $0, preventing retroactive changes to finalized historical invoices, GST reports, and customer ledgers.

## [2.7.3] - 2026-06-03
### Added
- **Invoice Activity Logs**: Added an interactive chronological activity log modal for invoices in the Sales page. Users can view all historical edits and events (creation, payments received, returns/refunds processed, fulfillments completed, and advance conversions).
- **Backend Audit Log Capture**: Integrated automatic audit log writes for returns, refunds, payment additions, and advance invoice processing.

### Fixed
- **Mobile Scanner Viewfinder Overlay**: Overrode default `html5-qrcode` white viewfinder borders to display our custom blue-corner reticle, creating a clean, modern aesthetic.

## [2.7.2] - 2026-06-03
### Fixed
- **Quick Sale Scanner Modal**: Replaced the custom Shopify Polaris-inspired `<SModal>` component with the standard, unified `<Modal>` component in the Sales View (Quick Sale) for the mobile barcode scanner link layout.
- **Mobile Scanner Accuracy & Cooldowns**: Restricted camera decoding formats to standard retail barcodes/QR codes (EAN-13, EAN-8, UPC-A, UPC-E, CODE-128, CODE-39, QR_CODE) to prevent false-positives. Added 2-frame consecutive scan verification to resolve camera misreads and implemented a 2.5-second duplicate scan cooldown buffer.
- **Google Lens Viewfinder UI**: Restructured the viewfinder layout to a large square shape (`aspect-square`) enabling easier scanning of large items. Added neon scan lines, success green border animations, and target ripple checkmark overlays on scan detection.

## [2.7.1] - 2026-06-02
### Added
- **Wireless Barcode Mobile Camera Scanner**:
  - Implemented mobile-to-desktop wireless camera-based barcode scanning using Supabase Realtime Broadcast.
  - Added a "Quick Scanner" button and connection modal displaying a dynamic QR code and clickable browser link on the Sales View (Quick Sale) and Purchases View (Bill Center tab).
  - Users scan the QR code using a mobile device to open the hosted mobile companion scanner at `https://quantro-web.onrender.com/?page=scanner` (synced via `online_sync_id`).
  - Barcodes scanned using the phone camera are broadcast in real-time, matching local inventory and automatically adding the product or incrementing quantities directly into the active sales or purchase cart.

## [2.7.0] - 2026-06-02
### Fixed
- **On-Screen Keyboard & Autofocus Cleanups**: Removed all automatic focus-stealing `autoFocus` attributes from text input fields (including Customer forms, settings modals, Category/Sub-category/Brand forms, Payment modals, and Campaign builders). This prevents the Windows On-Screen Keyboard (OSK) from automatically popping up and stealing page/scroll focus when modals or views are opened.
- **Fulfillment & Advance Total Recalculation**: Fixed invoice total price recalculation during advance processing (`process-advance` endpoint) to respect the `include_pending_price === 'false'` (price exclusion) setting, ensuring that fulfilling/delivering products increases the invoice total. Added dynamic row total calculators inside the Invoice Preview templates (Classic, Minimalist, Formal, POS) to prevent line item totals from mismatching the overall subtotal when settings toggle state changes. Also fixed a checkout-time total price calculation mismatch for advance invoices under the price exclusion option by ensuring the live cart displays 0/excludes pending items before they are delivered.


## [2.6.9] - 2026-06-01
### Fixed
- **Pending Items Pricing Option & Invoice Rendering**:
  - Fixed an issue where the pending items price exclusion toggle (`include_pending_price === 'false'`) was not respected in the desktop invoice preview modal (Classic, Formal, POS, and Minimalist styles) and tax calculations, causing the preview to recalculate the full price using the requested quantity.
  - Adjusted subtotal and tax calculation functions in the Sales page checkout to correctly handle conversion factors for secondary units when computing charge quantities under the price exclusion option.
- **Invoice Return & Refund Logic**:
  - Corrected the invoice return uploader/processor to only hide the "Return" button on the Sales page when the entire invoice is fully returned (matching total items sold to total items returned).
  - Resolved an issue where a partial return with a refund balance erroneously set the invoice's financial status to "Returned"; it now correctly marks it as "Partially Returned".
  - Properly sets the status of fully returned/refunded invoices to "Returned".
- **Hosted/Shared Invoice Quantity & Badge Rendering**:
  - Synced local invoice returns to the cloud database payload, enabling dynamic remaining quantity tracking on client-facing hosted pages.
  - Pre-calculates net quantities and renders them inside a bold red span on all four cloud-hosted styles (Classic, Minimalist, Formal, and POS).
  - Supports displaying "Returned" status badges across all public hosted templates.
- **Return / Refund Dashboard Analytics**:
  - Corrected the dashboard database query inside the backend controller to sum `return_amount` instead of the non-existent `total_returned_amount` column. This resolves the empty state bug, allowing the Sales and Payment tab charts to load Return / Refund counts and refund amount trends over time.

## [2.6.8] - 2026-06-01
### Added
- **Variant Catalog Enhancements**:
  - Added fields to variants in the "Variants & SKUs" tab for Buying Price (`cost_price`), Selling Price (`selling_price`), Min Stock Alert (`min_stock_level`), and Max Stock Alert (`max_stock_level`).
  - Implemented interactive, inline editing inputs for variant Buying Price, Selling Price, Min Alert, and Max Alert within the variant details table on the Inventory Page.
  - Added support for configuring initial alerts (Min & Max Stock Alert levels) when creating/editing variants.

### Fixed
- **POS Catalog Product Variants Availability**:
  - Resolved the issue where products with stock-carrying variants were falsely showing as "Out of Stock" (faded with red borders and unavailable for selection) in the POS catalog.
  - Dynamically calculates parent product stock levels on the Sales page using the sum of its variants' stock quantities, ensuring they are discoverable and can be added to the cart correctly.

## [2.6.7] - 2026-06-01
### Added
- **Merge Invoices Feature**:
  - Added checkbox selections next to invoices in the Sales Page history tab.
  - Enabled merging of two or more selected invoices into a single combined invoice with an interactive modal to assign a customer (registered or walk-in) for the merged invoice.
  - Aggregates invoice items and quantities, automatically restores and re-deducts inventory stock to prevent double deduction, updates batch quantities, relinks serial numbers, and copies all payments to preserve payment history.
- **Bulk Invoices & Customers Deletion**:
  - Added checkboxes and premium custom-styled actions toolbars to delete multiple invoices or customers simultaneously.
- **Table Pagination**:
  - Added modern paginated layouts (50 records per page) and orange-accent pagination footers to Customer Directory, Sales History, Purchase History, Suppliers, Expenses, and Returns tables.
- **Real-Time Variant Price Sync**:
  - Implemented selling price synchronization for main products and variants across all related invoices when catalog prices change.

### Changed
- **Credit Invoice Naming**:
  - Dynamically updates the document title to "CREDIT INVOICE" or "CREDIT INVOICE DETAILS" for all unpaid or partially-paid invoices (replacing "TAX INVOICE" or "INVOICE DETAILS" headers) across Classic, Minimalist, and Formal templates in both the desktop preview and public billing pages.
- **Fulfillment & Payment Badges**:
  - Rendered both primary fulfillment and secondary payment status badges side-by-side at the bottom-left of the invoice preview modal.
- **Smooth Animations**:
  - Redesigned selection checkboxes with spring-scale transitions and added floating sliding/fading animation entry/exit effects for the bulk action toolbar.
- **Customer Directory Layout Cleaned**:
  - Simplified Customer Page tabs, changing the label "Marketing (Coupons)" to "Marketing".

### Fixed
- **Modal Scroll Layout Fixes**:
  - Resolved double scrollbar render errors and subtle column/grid shifting inside the invoice preview modal for the Formal template by removing redundant local height and scroll container rules.
- **Hosted Link Improvements**:
  - Restored payment QR code rendering on client-facing billing pages.
  - Enabled pending product quantity indicators on minimalist and formal templates, while excluding POS template billing view.
- **Tab Reference & Hook Crashes**:
  - Resolved Rules of Hooks violation inside Suppliers and Expenses renderers that caused crashes.

---

## [2.6.6] - 2026-05-30
### Added
- **Real-time Price Dynamic Sync Toggle**:
  - Added a new configuration toggle under the "Business & Invoice" tab in settings (`enable_realtime_price_update`) to enable automatic price synchronization across existing invoices.
  - When enabled, updating a product's selling price in the inventory catalog automatically finds all existing unpaid invoices where that product's line-item price was set to `0`, updates it to the new price, recalculates totals, adjusts payment status, and syncs changes to cloud-hosted shared invoice links.
- **Invoice Product Category Configuration Toggle**:
  - Added a configuration toggle (`show_category_in_invoice`) under the "Business & Invoice" tab in settings to allow users to show or hide product categories on generated invoices.
  - When enabled, the unique list of categories billed on the invoice is displayed in the customer/invoice metadata section at the top across all desktop preview templates, PDF templates, and all four cloud-hosted viewer styles.

### Fixed
- **Company Logo Auto-Compression & PDF Rendering**:
  - Implemented canvas-based logo auto-compression on upload and on startup/settings load, reducing base64 payload sizes from ~8.5MB to under 15KB to prevent cloud sync failures (HTTP 413 Payload Too Large).
  - Fixed company logo rendering in PDF invoices — the logo now draws at the top-left of the document and the business details text block shifts right automatically to avoid overlap.
- **Fully Dynamic Cloud Invoice Syncing**:
  - Resolved cloud database sync payloads failing due to oversized logo data. All settings and invoice updates (returns, payments, fulfillments, price changes) now successfully propagate to the cloud database in real-time, making shared hosted invoice links update dynamically without needing regeneration.

---

## [2.6.5] - 2026-05-30

### Added
- **Centralized Secure Payment Method Authorization**:
  - Implemented ₹1.00 secure verification payment flow via Razorpay SDK on the Quantro Web Portal (`?page=add-card`).
  - Automatically synchronizes verified payment method details (mocked card brand, last4, and expiry) from the Web Portal client directly to the running local Maze ERP desktop backend server.
- **Subscription Cancellation Verification Emails**:
  - Integrated 6-digit confirmation code verification flow when a user cancels their subscription from either the desktop ERP or the online Web Portal.
  - Automatically generates and sends the cancellation code email using the configured Google OAuth Gmail API connection matching the user's active tenant connections. If offline or no connection exists, the code is printed to the system logs/console.
  - Verification of the code downgrades the active license in the Supabase `licenses` table (setting `plan = 'Free'`, `price = 0`, and `status = 'Active'`) and local settings.
- **Auto-pay Scheduler on Day 5**:
  - Added a scheduler routine in the ERP backend that checks for outstanding dues on simulated or actual Day 5. If card payment and autopay are enabled, outstanding dues are automatically paid and usage counters are reset.
- **Pricing Tier Navigation Restrictions**:
  - Displays subscription end dates (30 days from `created_at`) on active paid plans.
  - Forces "Free Starter" plan to always show "Active" alongside active paid plans.
  - Restricts paid users (Pro/Professional) from buying a different plan directly, displaying a warning message: `Cancel your [Plan] plan before switching`.
- **Invoice Product Category Configuration Toggle**:
  - Added a configuration toggle under the "Business & Invoice" tab in settings (`show_category_in_invoice`) to allow users to easily show or hide product categories on generated invoices.
  - Automatically respects this preference by showing the unique list of categories billed on the invoice in the invoice/customer details metadata section at the top, and removing category descriptors from individual item row tables to avoid row clutter across all local desktop preview templates, printed PDF templates, and all four cloud-hosted template styles in the online viewer.
- **Real-time Price Dynamic Sync Toggle**:
  - Added a configuration toggle under the "Business & Invoice" tab in settings (`enable_realtime_price_update`) to enable/disable real-time product price updates on existing unpaid invoices.
  - When enabled, editing a product's price in the inventory catalog automatically updates all occurrences of that product in existing unpaid/draft invoices where the original price was 0 to the new selling price, dynamically recalculating the invoice totals, payment status, and syncing changes to the cloud-hosted portals.
- **Terms Checkbox & Policy Links**:
  - Embedded mandatory Terms of Service, Privacy Policy, and Refund Policy check agreement on the payment authorization modal. Links open in the system default web browser.
- **Visual Enhancements**:
  - Corrected image assets path resolution to relative paths (e.g. `./gmail-icon.png`) on the desktop BillingPage to fix broken icons post-installation.
  - Refined margins and padding to resolve overlapping text and buttons on card displays.
### Fixed
- **Oversized Logo Storage & Cloud Sync**:
  - Implemented canvas-based auto-compression for uploaded business logos on the Settings page to resize images to a maximum of 300x150 pixels and encode as JPEG (quality 0.75), reducing base64 payload size from ~8.5MB to <15KB.
  - Added global client-side self-healing to automatically compress and re-save oversized logos on app startup or settings load, enabling successful synchronization of the company logo to the cloud-hosted viewer database without triggering HTTP 413 Payload Too Large errors.
  - Implemented company logo rendering at the top-left of generated PDF invoices, dynamically shifting the billing details block to the right.
- **Fully Dynamic Cloud Invoice Syncing**:
  - Resolved cloud database sync payloads failing due to oversized logo data. Now, all settings and invoice updates (returns, payments, fulfillments) successfully propagate to the cloud database in real-time, making the shared hosted invoice links update dynamically without needing regeneration.

---

## [2.6.4] - 2026-05-30
### Added
- **Auto-Extract and Pre-Fill Supplier Address & Phone**:
  - Upgraded OCR system prompts (for Vision models and text LLMs) to extract the supplier's contact phone number and full physical address into `supplier_phone` and `supplier_address`.
  - Added contact/address parsing heuristics (first 15 lines scan) to the local Javascript regex fallback parser.
  - Configured backend response to clean and include these properties in the `supplierResult` object.
  - Linked the details to the frontend "Add Supplier" action, pre-filling the registration modal form with the parsed phone number and address automatically.

---

## [2.6.3] - 2026-05-30
### Added
- **DeepSeek V3 Fallback for OCR Text Structuring**:
  - Integrated `deepseek-ai/DeepSeek-V3-0324` and `deepseek-ai/DeepSeek-V3` directly into the OCR pipeline fallback sequence.
  - They are called using the same GitHub Models API endpoint and token if the OpenAI GPT-4o models hit rate limits or are exhausted, adding another layer of free cloud capability before local offline fallback triggers.

---

## [2.6.2] - 2026-05-30
### Changed
- **GitHub Models Integration for Invoice OCR**:
  - Deprecated and removed all rate-limited OpenCode Zen model URLs and keys from the OCR parser.
  - Switched the OCR parser to utilize the official GitHub Models API (`https://models.github.ai/inference`) with the user's free GitHub Personal Access Token (PAT).
  - Configured `openai/gpt-4o-mini` and `openai/gpt-4o` as primary models for vision-based invoice scanning and local text structuring, ensuring extremely fast, premium, and rate-limit-free parsing.

---

## [2.6.1] - 2026-05-30
### Fixed
- **Premium OCR Parser & Post-Processing Filters**:
  - Upgraded OCR system prompts (for both Vision models and local OCR fallback LLMs) to ignore buyer billing/shipping addresses, customer/user names, email addresses, websites, phone numbers, and GSTINs, preventing them from being incorrectly parsed as products.
  - Implemented a robust unified Javascript helper `isAddressOrContactLine` that dynamically filters out phone numbers, emails, websites, GSTINs, pincodes (in address contexts), and address keywords with precise word boundary matching.
  - Refactored `cleanSupplierName` and `cleanProductName` to completely strip out formatting symbols (`*`, `|`, `_`, `#`, etc.) from both product and supplier names, ensuring high-end, clean output strings (e.g., `H2036-UNIQUE CHITRAKALAVI` rather than `* H2036-UNIQUE CHITRAKALAVI |`).
  - Added post-processing validation that runs both cleaners and the address filters on the output of all models, completely preventing address blocks from leaking as cart items.

---

## [2.6.0] - 2026-05-30
### Added
- **Resilient OCR Bill Scanner Fallback**:
  - Implemented a multi-model vision try-sequence (`mimo-v2.5-free` -> `qwen3.6-plus-free` -> `minimax-m2.5-free`) to handle 429 Rate Limit Exceeded or other API errors when uploading purchase invoice images.
  - Integrated a hybrid local-cloud OCR fallback engine: if all vision models are rate-limited or fail, the system runs local text extraction via `tesseract.js` directly on the machine.
  - Automatically dispatches the raw extracted text to highly available text LLMs (`deepseek-v4-flash-free` or `nemotron-3-super-free`) to structure and correct spelling/layout errors into standard invoice JSON format.
  - Added a last-resort local regex/heuristic-based text parser: if all online text LLM models are also rate-limited (Status 429) or unavailable, the backend parses the raw OCR text completely offline in Javascript using regex patterns to extract supplier, date, bill number, and items, guaranteeing 100% offline uploader resilience.

### Fixed
- **Gmail AI Integration Auto-Reply Check**:
  - Restrained the background AI email receiver from auto-replying to random unread emails or unauthorized threads.
  - Implemented a thread validation check that queries the Gmail API to verify if the connected email address has previously sent a message in the thread.
  - The AI will now strictly only auto-reply to threads we initiated (e.g. via campaigns, invoice notifications, or manual outgoing emails). Any other unread emails are skipped and left unread in Gmail.

---

## [2.5.9] - 2026-05-29
### Added
- **Upload Purchase Invoice OCR & Catalog Matching**:
  - Implemented a new drag-and-drop file upload tab ("Upload Invoice") as the default view in the Purchases module.
  - Connected the uploader to a backend parser using OpenCode Zen's vision/multimodal model `mimo-v2.5-free` to process low-quality scans, hand-written, and computer-printed receipts.
  - Integrated local SQLite database queries to auto-match extracted supplier names and items to the local ERP catalogs.
  - Added an unresolved catalog resolution modal popup allowing users to register new suppliers or new products in one click, pre-filling details from the AI parsed invoice, before automatically populating the cart.

---

## [2.5.8] - 2026-05-29
### Fixed
- **Billing Page UI Crash**: Resolved a crash inside the Billing page caused by a missing import of the `Award` icon in `Icons.jsx` component mapping.
- **Voice Calling Agent Logo**: Fixed the voice agent logo visibility inside `ConnectedServicesCard.jsx` by converting the image path to a relative URL (`./mazeway.png`) to load correctly inside the Electron environment.
- **Authentication Submission Fix**: Fixed a bug on the login and registration page (`AuthPage.jsx`) where clicking "Sign In" or "Create Account" did nothing. This was caused by the custom `SButton` defaulting to `type="button"` and not receiving the correct `type="submit"` attribute required to trigger form submission.
- **Activation Gate Verification Button**: Fixed the verify button in the desktop `ActivationGate` (inside `App.jsx`) to correctly use `type="submit"` instead of the invalid `submit` attribute, allowing the verification process to trigger.
- **Web Portal License Persistence & Error Handling**: Refactored the web portal's `Download.jsx` to capture, throw, and alert Supabase transaction errors (such as RLS policy violations or constraint issues) during license queries and insertions. This prevents the page from silently swallowing database failures and randomly regenerating duplicate license keys on reload.

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
