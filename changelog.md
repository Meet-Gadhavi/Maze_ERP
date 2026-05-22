# Quantro ERP Changelog

All notable changes to the Quantro ERP application will be documented here.

---

## [2.0.6] - 2026-05-22
### Added
- **Category Selection Double-Click:** Enabled double-clicking category buttons to add all in-stock products in that category directly to the cart.
- **Group Banners Redesign:** Redesigned subcategory and brand section headers as full-width banner cards, featuring hover translation animations, standard invoice styled icons, and double-click support to add all items in that group.
- **Custom Select Grouping Dropdown:** Integrated the premium custom `CustomSelect` dropdown for grouping options and styled it with a compact height to fit seamlessly in the toolbar.
- **POS Bottom Checkout Bar:** Moved payment actions (Cash, UPI, Card, Split Bill) into a dedicated sticky bottom bar with totals breakdown, live payable amount on each button, and a built-in Discount field (% or flat ₹) that updates all button amounts in real time.
### Changed / Fixed
- **POS Checkout Bar Alignment:** Aligned the Walk-In payment status, discount field, and payment buttons perfectly on the same horizontal line by assigning a uniform 38px height to the status banner and discount input wrappers, matching the payment buttons.
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
