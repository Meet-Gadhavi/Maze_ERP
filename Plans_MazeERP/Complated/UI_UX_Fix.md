# Maze ERP UI/UX Audit

**Audit date:** April 26, 2026  
**Scope:** Renderer shell, pages, shared modal/form patterns, page-level CSS  
**Method:** Code review of the current frontend implementation. This is a code-based audit, not a live browser screenshot audit.

---

## Summary

| Severity | Count | Focus | Status |
|---|---:|---|---|
| Critical | 3 | Cross-page modal behavior, purchase-page responsiveness, app-shell trust signals | ✓ Done |
| Medium | 8 | Navigation affordance, responsive density, theming consistency, nested scrolling | ✓ Done |
| Minor | 8 | Copy polish, visual consistency, stale labels, repeated style drift | ✓ Done |

### Best overall fix strategy

The best way to fix the UI issues in this codebase is **not** to patch each page visually one by one with more local CSS.  
The best approach is to:

1. **Create one shared UI system for overlays and forms**
   - Standardize `modal`, `drawer`, `confirmation dialog`, `form dialog`, and `preview dialog` behavior.
   - Shared things should include:
     - width rules
     - padding
     - header/footer structure
     - close button placement
     - radius
     - backdrop
     - mobile behavior
2. **Move repeated visual values into shared tokens**
   - Replace hardcoded `#fff`, `#f8fafc`, `#FAFBFC`, etc. with semantic theme tokens.
3. **Make page layouts responsive at the layout level**
   - Especially for `Purchase`, `Sales`, `Inventory`, and `Settings`.
   - Prefer breakpoint-based stacking over squeezing sidebars and tables into narrow widths.
4. **Unify product identity in the shell**
   - App name, version, sidebar labels, and page titles should all come from one consistent source.
5. **Then do page-level polish**
   - Empty states, toolbar behavior, tab grouping, button consistency, and spacing.

### Modal / popup inconsistency

This is one of the most important UI issues in the current app.

Right now there are multiple competing popup styles:
- **Settings / Data Management** popups use a premium large-radius modal system
- **Purchase page** popups define their own modal system
- **Shared add/edit dialogs** such as Add Product, Add Category, Add Sub-category, etc. use shared modal markup but are visually affected by page CSS collisions
- **Invoice preview** uses its own separate overlay pattern

#### Best way to fix popup inconsistency

The best fix is to create a **single shared modal design system** with a few approved variants:

1. **Form modal**
   - For Add Product, Add Category, Add Customer, Edit forms
   - Medium width, compact footer, operational styling
2. **Confirmation modal**
   - For delete/restore/danger actions
   - Small width, strong action hierarchy, concise messaging
3. **Utility modal**
   - For import/export/data actions
   - Medium to large width, supports multi-step content
4. **Preview modal**
   - For invoice/document preview
   - Larger width, content-first layout, optional print actions

And then:
- Move modal styling out of page CSS where possible
- Stop redefining generic `.modal`, `.modal-header`, `.modal-body`, `.modal-footer` in multiple pages
- Use variant classes or a shared modal component API instead
- Keep corner radius and spacing appropriate for an ERP tool, not a marketing surface

---

## Critical UI/UX Issues

### ✓ C-UI-01: Global modal styles collide across unrelated pages
- **Files:** [renderer/src/pages/SettingsPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\SettingsPage.css), [renderer/src/pages/PurchasePage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\PurchasePage.css), [renderer/src/components/FormComponents.jsx](C:\Users\Meet\Music\Maze_ERP\renderer\src\components\FormComponents.jsx)
- **Evidence:** `SettingsPage.css` defines global `.modal-overlay`, `.modal`, `.modal-header`, `.modal-body`, `.modal-footer` starting around lines 242/259/279/348/1037. `PurchasePage.css` defines the same global selectors around lines 348/359/370/389/393. Shared modal markup in `FormComponents.jsx` also uses those same generic class names.
- **Impact:** Modal appearance and spacing can change depending on CSS load order rather than component intent. Simple confirmation dialogs, premium data modals, and purchase modals are all competing for the same global visual contract.
- **Why it matters:** This is a cross-app UX instability issue. It can create unpredictable dialog sizing, padding, and footer behavior as the app grows.
- **Recommended fix:** Scope modal styles by page namespace or move all modal styling into one shared modal system. Avoid page CSS redefining generic modal class names.
- **Best way to fix:** Build one shared modal component with explicit variants like `form`, `confirm`, `utility`, and `preview`. Then migrate page CSS away from global modal selector overrides.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Shared CRUD dialogs now route through the unified modal component, Purchase page no longer ships page-level generic modal selectors, and Settings data modals were scoped to `settings-modal-*` instead of global `.modal*` classes.

### ✓ C-UI-02: Purchase page is still desktop-first and will break down on narrower viewports
- **Files:** [renderer/src/pages/PurchasePage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\PurchasePage.css), [renderer/src/pages/PurchasePage.jsx](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\PurchasePage.jsx)
- **Evidence:** `.bill-form` uses `grid-template-columns: 1fr 300px` at line 146, `.payments-container` uses `1fr 360px` at line 603, and `.expense-container` uses a side-by-side layout at line 762. The JSX also exposes six tabs in one row at lines 1074-1079.
- **Impact:** The purchase workflow depends on multiple fixed-width side panels and a long tab strip, but the file has no matching responsive fallback for these major layouts. On laptop-sized or split-window widths, the workflow will feel cramped or overflow.
- **Why it matters:** Purchase is a core workflow. If the layout compresses badly, users lose speed exactly where speed matters most.
- **Recommended fix:** Add explicit breakpoints that stack bill/sidebar, payment/main sidebar, and expense/form panes. Make the purchase tab strip horizontally scrollable or convert overflow items into a segmented/dropdown pattern.
- **Best way to fix:** Redesign purchase layouts at the container level first, not widget by widget. Define breakpoint behavior for `bill`, `payments`, `returns`, and `expenses` as full workflow layouts.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Bill, payment, and expense layouts now stack at narrower widths, the tab row scrolls horizontally, tab labels no longer shrink awkwardly, and header/toolbar actions collapse into a usable mobile-width layout.

### ✓ C-UI-03: Primary shell branding is inconsistent with the app identity
- **Files:** [renderer/src/components/Sidebar.jsx](C:\Users\Meet\Music\Maze_ERP\renderer\src\components\Sidebar.jsx)
- **Evidence:** Sidebar logo alt text says `Maze POS` at line 76, brand name says `Maze POS` at line 84, sublabel says `Mazelabs` at line 85, and footer shows `v1.0.0 — Mazelabs` at line 115.
- **Impact:** The app shell communicates a different product identity from the rest of the codebase (`Maze ERP` / `Quantro` / version `1.0.1`). That weakens user trust before they even start using the product.
- **Why it matters:** Shell branding is not decorative; it is the first reliability signal in desktop software.
- **Recommended fix:** Normalize the product name, subtitle, and version source in one place and render them consistently in the shell.
- **Best way to fix:** Store product identity in one shared config/source and render sidebar, window title, footer version, and related labels from that source.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Sidebar naming and version text now come from shared frontend constants and consistently show `Maze ERP`, `Maze Lab`, `v1.0.1`, and `Purchases`.

---

## Medium UI/UX Issues

### ✓ M-UI-01: Collapsed sidebar hides its own recovery control
- **Files:** [renderer/src/components/Sidebar.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\components\Sidebar.css), [renderer/src/components\Sidebar.jsx](C:\Users\Meet\Music\Maze_ERP\renderer\src\components\Sidebar.jsx)
- **Evidence:** `.collapsed .sidebar-toggle { display: none; }` at lines 58-59. Expansion then depends on clicking the brand area.
- **Impact:** The collapsed state has poor discoverability and creates a small usability trap for new users.
- **Recommended fix:** Keep a visible expand affordance in collapsed state or provide a persistent tooltip/button target.
- **Best way to fix:** Keep a compact visible toggle pinned in both expanded and collapsed states so reopening never depends on discovering the brand area.
- **Status:** Fixed on April 26, 2026.
- **What changed:** The sidebar toggle is now always visible in the collapsed state, pinned to the right edge with a reversed icon to indicate expansion.

### ✓ M-UI-02: Fixed-height app shell increases nested-scroll fatigue
- **Files:** [renderer/src/components/Layout.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\components\Layout.css), [renderer/src/components/Sidebar.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\components\Sidebar.css)
- **Evidence:** Sidebar and layout both lock to `height: 100vh` and the sidebar is `position: fixed`.
- **Impact:** Pages with internal scroll regions inherit multiple scroll containers, which makes long ERP workflows feel heavier than they need to.
- **Recommended fix:** Prefer a shell that allows the page to own the main document scroll where possible, and reserve nested scrolls for truly bounded tools.
- **Best way to fix:** Reduce nested scroll zones and define one primary page scroll container per major workflow.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Refactored the app shell to use natural document-level scrolling by removing `height: 100vh` and `overflow: hidden` from the main layout container.

### ✓ M-UI-03: Sales flow relies on fixed-height nested pickers and lists
- **Files:** [renderer/src/pages/SalesPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\SalesPage.css)
- **Evidence:** `.categorized-product-picker` uses `max-height: 520px` at lines 44-45 and `.customer-list-grid` uses `max-height: 600px` at lines 305-309.
- **Impact:** Users may have to scroll inside a picker while also scrolling the page. On shorter displays, this makes browsing products/customers more tiring.
- **Recommended fix:** Tie heights to viewport-relative constraints or let the page own the primary scroll while preserving sticky local headers.
- **Best way to fix:** Use `max-height: min(..., vh)` style constraints and keep only one bounded scroll region where absolutely necessary.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Replaced fixed pixel max-heights with viewport-relative units (`vh`) to ensure pickers adapt to smaller laptop screens.

### ✓ M-UI-04: Toolbar layouts are not consistently responsive
- **Files:** [renderer/src/pages/SalesPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\SalesPage.css), [renderer/src/pages/InventoryPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\InventoryPage.css), [renderer/src/pages/PurchasePage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\PurchasePage.css)
- **Evidence:** Sales history uses `history-toolbar-top` and `history-toolbar-bottom` rows around lines 630 and 636 with no matching responsive rules. Inventory tabs and filters are also desktop-shaped, and Purchase page toolbars assume wide layouts.
- **Impact:** Search, filters, and status controls will bunch together and reduce scannability in smaller windows.
- **Recommended fix:** Add wrap/stack behavior for toolbar rows and ensure filters can collapse gracefully.
- **Best way to fix:** Standardize a shared responsive toolbar pattern with desktop, tablet, and narrow-window states.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Applied `flex-wrap` and stacking logic to toolbars across all major pages, ensuring controls remain accessible on narrower viewports.

### ✓ M-UI-05: Theme consistency is undermined by many hardcoded light surfaces
- **Files:** [renderer/src/pages/SalesPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\SalesPage.css), [renderer/src/pages/InventoryPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\InventoryPage.css), [renderer/src/pages/CustomersPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\CustomersPage.css), [renderer/src/components/InvoicePreviewModal.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\components\InvoicePreviewModal.css)
- **Evidence:** Repeated hardcoded `#fff`, `#FAFBFC`, `#f8fafc`, and similar values appear throughout these files.
- **Impact:** The interface stops behaving like one system and starts behaving like several separate themes pasted together. Any future dark-mode or token update will break unevenly.
- **Recommended fix:** Replace local hardcoded surfaces with shared semantic tokens.
- **Best way to fix:** Audit hardcoded colors page by page and replace them with semantic tokens like `bg-card`, `bg-surface-muted`, `border-subtle`, etc.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Normalized hardcoded background and border colors across multiple page CSS files to use shared semantic tokens (`--bg-card`, `--bg-primary`, etc.).

### ✓ M-UI-06: Settings layout still assumes generous width even after the mobile breakpoint
- **Files:** [renderer/src/pages/SettingsPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\SettingsPage.css)
- **Evidence:** The sidebar is fixed to `260px` at line 26, the page uses a `1fr 1fr` content grid at line 105, and the premium modal uses `border-radius: 40px` at line 263.
- **Impact:** On mid-size desktop widths, the settings page can feel over-spread horizontally while also using a visually oversized modal language.
- **Recommended fix:** Add an intermediate breakpoint for tablet-ish widths and tighten spacing/radius on non-hero surfaces.
- **Best way to fix:** Add a mid breakpoint between full desktop and mobile, then reduce sidebar width, card padding, and modal radius for utility settings flows.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Added a `1024px` breakpoint to the Settings page, reducing sidebar width and collapsing the content grid to a single column for better legibility on mid-size screens.

### ✓ M-UI-07: Purchase page navigation density is too high for one flat tab row
- **Files:** [renderer/src/pages/PurchasePage.jsx](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\PurchasePage.jsx), [renderer/src/pages/PurchasePage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\PurchasePage.css)
- **Evidence:** Six tabs are rendered in a single line at lines 1074-1079, but the tabs CSS does not provide overflow handling.
- **Impact:** This is a scanning and prioritization problem even before it becomes a layout problem.
- **Recommended fix:** Group related tabs or allow horizontal scrolling with strong active-state visibility.
- **Best way to fix:** Group purchase workflows into primary vs secondary sections, or convert lower-priority tabs into a secondary control.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Improved tab strip behavior by adding horizontal scroll support and compacting tab labels on smaller viewports.

### ✓ M-UI-08: Sidebar/product naming is inconsistent across navigation and pages
- **Files:** [renderer/src/components/Sidebar.jsx](C:\Users\Meet\Music\Maze_ERP\renderer\src\components\Sidebar.jsx), [renderer/src/pages/PurchasePage.jsx](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\PurchasePage.jsx)
- **Evidence:** The shell says `Maze POS`, while the project folder and other pages imply `Maze ERP`; `Purchase` appears in the nav while the page title says `Purchases`.
- **Impact:** Small naming drift makes the product feel less finished than it is.
- **Recommended fix:** Define a canonical naming guide for shell labels, page titles, and product strings.
- **Best way to fix:** Create one naming map for nav labels, route labels, and page titles, then normalize the interface against it.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Normalized all product branding to `Maze ERP` and synchronized navigation labels (`Purchases`) with their respective page titles.

---

## Minor UI/UX Issues

### ✓ L-UI-01: Modal visual language is inconsistent across the app
- **Files:** [renderer/src/pages/SettingsPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\SettingsPage.css), [renderer/src/pages/PurchasePage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\PurchasePage.css), [renderer/src/components/InvoicePreviewModal.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\components\InvoicePreviewModal.css)
- **Issue:** Some dialogs are soft and premium, some are compact and operational, and some use very large radii. The app lacks one consistent dialog hierarchy.
- **Best way to fix:** Define a modal hierarchy and apply it consistently: compact operational modals for CRUD, stronger confirm dialogs for destructive flows, and larger previews/utilities only when content really needs it.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Settings, Purchase, and Invoice Preview modal shells now use a closer shared radius, spacing, overlay depth, and utility-first dialog scale.

### ✓ L-UI-02: Settings premium modal styling is visually oversized for utility workflows
- **Files:** [renderer/src/pages/SettingsPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\SettingsPage.css)
- **Issue:** `40px` corner radius and very large padding give destructive/import/export modals a marketing-like feel rather than an ERP utility feel.
- **Best way to fix:** Reduce modal radius and padding for utility dialogs so they feel operational, not promotional.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Utility modal radius, padding, icon scale, overlay blur, and drop-zone sizing were reduced to feel operational instead of promotional.

### ✓ L-UI-03: Inventory page duplicates small button styling patterns
- **Files:** [renderer/src/pages/InventoryPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\InventoryPage.css)
- **Issue:** `.btn-icon` and related helper styles are declared in multiple places, which tends to produce slow visual drift over time.
- **Best way to fix:** Move repeated button-size helpers into shared global/component CSS and reuse them everywhere.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Shared `.btn-icon` sizing now lives in [renderer/src/styles/index.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\styles\index.css), and the duplicate Inventory definitions were removed.

### ✓ L-UI-04: Empty-state styling is inconsistent page to page
- **Files:** [renderer/src/pages/InventoryPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\InventoryPage.css), [renderer/src/pages/SalesPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\SalesPage.css), [renderer/src/pages/CustomersPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\CustomersPage.css)
- **Issue:** Some empty states are premium cards, some are plain text blocks, and some use translucent dashed boxes. The system lacks one empty-state pattern family.
- **Best way to fix:** Define 2-3 approved empty-state variants such as `full-page`, `table-empty`, and `compact tool-empty`.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Shared `mini` and `compact` empty-state variants were normalized in the global stylesheet and the Inventory local variant was reduced to spacing-only customization.

### ✓ L-UI-05: Invoice preview uses pure white surfaces outside the shared token system
- **Files:** [renderer/src/components/InvoicePreviewModal.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\components\InvoicePreviewModal.css)
- **Issue:** The invoice preview is readable, but it is visually detached from the rest of the app shell and theme model.
- **Best way to fix:** Keep invoice readability high, but align surrounding preview chrome with shared modal/surface tokens.
- **Status:** Fixed on April 26, 2026.
- **What changed:** The preview shell, top bar, and non-print surfaces now use shared app tokens while keeping the printable invoice body readable.

### ✓ L-UI-06: Sidebar version label is stale
- **Files:** [renderer/src/components/Sidebar.jsx](C:\Users\Meet\Music\Maze_ERP\renderer\src\components\Sidebar.jsx)
- **Issue:** Footer still shows `v1.0.0`, which makes the app feel unsynchronized with its own release state.
- **Best way to fix:** Pull version text from one real version source instead of hardcoding it in the sidebar.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Sidebar identity strings now come from shared frontend constants and the visible version was updated to `1.0.1`.

### ✓ L-UI-07: Navigation copy is slightly uneven
- **Files:** [renderer/src/components/Sidebar.jsx](C:\Users\Meet\Music\Maze_ERP\renderer\src\components\Sidebar.jsx), [renderer/src/pages/PurchasePage.jsx](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\PurchasePage.jsx)
- **Issue:** `Purchase` in the sidebar vs `Purchases` in the page title is a tiny but noticeable polish miss.
- **Best way to fix:** Normalize singular/plural route naming rules and apply them across nav and page headings.
- **Status:** Fixed on April 26, 2026.
- **What changed:** The sidebar label now uses `Purchases` to match the page title and shared navigation language.

### ✓ L-UI-08: Some list/table surfaces still use hardcoded hover/background colors
- **Files:** [renderer/src/pages/PurchasePage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\PurchasePage.css), [renderer/src/pages/InventoryPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\InventoryPage.css), [renderer/src/pages/SalesPage.css](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\SalesPage.css)
- **Issue:** The app uses good tokens overall, but enough local color overrides remain that visual polish will keep diverging unless they are normalized.
- **Best way to fix:** Replace local hover/background overrides with shared table-row and surface utility styles.
- **Status:** Fixed on April 26, 2026.
- **What changed:** Shared muted-surface tokens were added and applied to key table headers, row hovers, badges, and utility surfaces across Purchase, Inventory, and Sales.

---

## Recommended Fix Order

1. **Stabilize shared dialogs first**
   - Unify modal styles and remove page-level collisions.
2. **Make core workflows resilient on narrower widths**
   - Purchase page first, then Sales/Inventory toolbars.
3. **Normalize shell trust signals**
   - Product name, version, and page naming.
4. **Reduce theme drift**
   - Replace hardcoded surface colors with semantic tokens.
5. **Polish visual consistency**
   - Empty states, tabs, button helpers, and utility cards.

---

## Output

This file was created in the existing `Plans_MazeERP` folder because that is the actual folder present in the project:

- [UI_UX_Fix.md](C:\Users\Meet\Music\Maze_ERP\Plans_MazeERP\UI_UX_Fix.md)
