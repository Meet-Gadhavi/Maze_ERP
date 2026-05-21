# Quantro ERP Changelog

All notable changes to the Quantro ERP application will be documented here.

---

## [2.0.0] - 2026-05-21
### Added
- **Subcategory Customer Distribution (Inventory Dashboard):** Added a new pie chart and category selector to analyze customer distributions across subcategories.
- **Double-Click POS Batch Add:** Implemented double-click events on Category and Subcategory headers in the POS to automatically add all in-stock products under the category/subcategory to the cart.
- **Checkout Cart Subcategories:** Displayed the subcategory name below the product name in both the checkout cart in Sales Page and the Customer Display cart.
### Fixed
- **Gross Profit (Est.) Dashboard Card:** Fixed database calculation query by joining product variants and batches to resolve cost prices accurately.
- **Payment Confirmation Dialog:** Resolved a scoping ReferenceError in sales confirmation route.
- **Category Deletion Modal:** Polished confirmation messages and warning styling.
- **SQLite Return Schema Migration:** Added automatic database migration for `return_type` column to resolve return transaction failures.

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
