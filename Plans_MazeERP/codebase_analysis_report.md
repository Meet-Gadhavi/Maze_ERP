# Maze ERP Codebase Analysis Report

This report outlines key logical defects, UI/UX issues, and feature discrepancies found during a deep audit of the Maze ERP codebase.

---

## 1. Logical Bugs

### Critical Severity

#### A. Sales Returns Stock & Financial Mismatch
- **Location**: [sales.js](file:///c:/Users/Meet/Music/Maze_ERP/backend/routes/sales.js#L734-L740)
- **Impact**: Allows returning items never delivered, inflating physical stock counts and leaking cash.
- **Description**: 
  When verifying returned quantity limits, `/api/invoices/:id/return` calculates `totalOriginalQty` using `line.quantity` (which maps to the requested quantity, `qty_requested`), instead of the actual delivered quantity `qty_delivered`.
  For advance or partial invoices where `qty_delivered < qty_requested`, a merchant can return items they never received. This has two critical side effects:
  1. It updates the database setting `stock_quantity = stock_quantity + returnQtyForLine`, incrementing stock levels with items that never left the inventory.
  2. If `include_pending_price === 'false'`, the client only paid for the delivered portion, but the return refund is calculated using `line.price * returnQtyForLine`. Thus, the customer gets refunded for the full requested quantity value, resulting in a direct cash leak.

#### B. Historical Invoice Alteration on Real-time Price Update
- **Location**: [inventory.js](file:///c:/Users/Meet/Music/Maze_ERP/backend/routes/inventory.js#L418-L437) & [inventory.js](file:///c:/Users/Meet/Music/Maze_ERP/backend/routes/inventory.js#L580-L597)
- **Impact**: Corrupts historical records, taxes, payments, and invoice statuses.
- **Description**: 
  When a product or variant's selling price is modified, and the setting `enable_realtime_price_update` is enabled, the backend updates the prices and totals in `invoice_items` for **all past invoices** containing this product.
  In a real ERP system, past invoices must be immutable. Changing today's selling price should never alter historical invoices. In addition to corrupting past tax/GST reports and revenue stats:
  1. It calls `recalculateInvoiceTotalsInline(invoice_id)`, which recalculates the final total and can toggle the `payment_status` of a previously fully-paid historical invoice to `PARTIAL` (if the price went up) or `OVERPAID`.
  2. It does NOT update the customer's overall `due_balance` in the `customers` database table, resulting in a total desync between the customer ledger and invoice dues.

---

### Major Severity

#### A. WhatsApp OAuth Authentication Loopback Failure in Production
- **Location**: [whatsappAuth.js](file:///c:/Users/Meet/Music/Maze_ERP/backend/routes/whatsappAuth.js#L55), [whatsappAuth.js](file:///c:/Users/Meet/Music/Maze_ERP/backend/routes/whatsappAuth.js#L105) & [whatsappAuth.js](file:///c:/Users/Meet/Music/Maze_ERP/backend/routes/whatsappAuth.js#L155)
- **Impact**: Prevents users from completing Meta connection in production, displaying a browser network error.
- **Description**: 
  After receiving the Meta connection callback, the local node server redirects the user's browser back to `http://localhost:5175/#/automation?whatsapp=success`.
  In production, the Electron application is loaded directly from a local build file, and there is no Vite server running at `http://localhost:5175`. Redirecting to this URL fails, prompting a "Site cannot be reached" error in the browser. 
  *(Note: The Gmail OAuth flow correctly uses the `maze-erp://` deep-linking protocol registered in [main.js](file:///c:/Users/Meet/Music/Maze_ERP/main/main.js#L15) to callback directly into Electron).*

#### B. Stock Adjustment De-synchronization for Batches and Serials
- **Location**: [inventory.js](file:///c:/Users/Meet/Music/Maze_ERP/backend/routes/inventory.js#L478-L508)
- **Impact**: Causes database inconsistency and sales page crashes for tracked products.
- **Description**: 
  The manual stock adjustment endpoint `POST /api/products/:id/adjust` modifies the parent product's `stock_quantity` directly but contains no logic to add/remove records from `product_batches` or `product_serials`.
  For batch or serial-tracked items, this results in a direct mismatch: the parent product says 10 are in stock, but when the checkout flow attempts to fetch available serial numbers or batches, it finds 0 records, blocking the sale or causing errors.

#### C. Return Records Loss on Invoice Merging
- **Location**: [sales.js](file:///c:/Users/Meet/Music/Maze_ERP/backend/routes/sales.js#L1716-L1717)
- **Impact**: Deletes historical returns audit trail and allows double-returns.
- **Description**: 
  When merging invoices, the original invoices are deleted (`DELETE FROM invoices WHERE id IN (...)`). Because of the `ON DELETE CASCADE` constraint on the database table, this automatically deletes all related return logs in `invoice_returns` for the merged invoices.
  The merge code aggregates the original invoice items and payments, but has **no logic** to preserve or migrate returned item counters/amounts. Thus, past return records are permanently lost, the new merged invoice starts with 0 returned history, and the customer could theoretically return the same items again.

---

### Medium Severity

#### A. Multiple Returns of the Same Supplier Serial Number
- **Location**: [purchases.js](file:///c:/Users/Meet/Music/Maze_ERP/backend/routes/purchases.js#L356-L359)
- **Impact**: Duplicates stock deductions and credit balance updates.
- **Description**: 
  In the purchase return route `/api/purchases/:id/return`, the backend verifies if a serial number can be returned to a supplier. It checks:
  ```javascript
  if (serialRecord.status === 'Sold') {
      return res.status(400).json({ error: `Serial number "${sn}" has already been sold and cannot be returned to supplier` });
  }
  ```
  It does not block serials whose status is already `'Returned_To_Supplier'`. This allows a user to return the same serial number multiple times, causing duplicate inventory deductions and overestimating supplier credits.

#### B. Origin Mismatch on Mazeway Handshake Callback
- **Location**: [mazeway.js](file:///c:/Users/Meet/Music/Maze_ERP/backend/routes/mazeway.js#L346-L352)
- **Impact**: PostMessage notification is blocked, and the automation setup page does not automatically refresh.
- **Description**: 
  Upon a successful callback connection, the handshake page returns script instructions to message the opener window:
  ```javascript
  window.opener.postMessage({ type: 'mazeway-connected', ... }, window.location.origin);
  ```
  Because the callback is served at `http://localhost:3001/api/mazeway/callback`, `window.location.origin` resolves to `http://localhost:3001`. However, the opener (Electron) has a different origin (`file://` or `http://localhost:5175` in dev). The browser blocks the postMessage delivery due to the target origin mismatch.

---

### Minor Severity

#### A. Missing Variant Buying Capability on Purchases
- **Location**: [purchases.js](file:///c:/Users/Meet/Music/Maze_ERP/backend/routes/purchases.js#L162-L178)
- **Impact**: Purchase receipts cannot select variants, leaving variant stocks unpopulated.
- **Description**: 
  The `purchase_items` table doesn't have a `variant_id` column. When a Purchase receipt is saved, the inventory logic only updates the parent product's `stock_quantity`.
  If a merchant tracks stock via variants, they have to manually edit each variant's stock level in the inventory page to update it, as buying stock through a purchase receipt cannot route quantity to a variant.

---

## 2. UI/UX Issues

### Major Severity

#### A. Out-of-sync Parent Product Stock in Inventory View
- **Location**: [InventoryPage.jsx](file:///c:/Users/Meet/Music/Maze_ERP/renderer/src/pages/InventoryPage.jsx#L744-L745)
- **Impact**: Displays wrong stock numbers to the merchant.
- **Description**: 
  The inventory table renders product stock levels using `p.stock_quantity`. However, if the product uses variants, the parent product's `stock_quantity` field is not recalculated or updated to represent the sum of its variants.
  On the Sales page, stock is checked via `variants_stock` (the actual sum), but in the Inventory view, it displays the parent product's stock (often 0 or outdated), causing a severe UI mismatch.

#### B. Dead Autopay and Card Setup Redirection in Production
- **Location**: [BillingPage.jsx](file:///c:/Users/Meet/Music/Maze_ERP/renderer/src/pages/BillingPage.jsx#L103)
- **Impact**: Breaks credit card and payment setups.
- **Description**: 
  Clicking "Add Card" or setting up payment options redirects the user's browser to `http://localhost:5180/?page=add-card`.
  No server starts on port 5180 during production. The browser opens a blank page showing "This site cannot be reached," making it impossible for the user to complete subscription upgrades or add payment details.

---

## 3. Discrepancies & Simulated Feature Claims ("Fake Claims")

The following settings or features are present in the settings page, menu sidebars, or logs but are actually stubbed out or simulated in code:

### 1. Cash Drawer Integration
- **Setting**: `enable_cash_drawer`
- **Claimed Function**: *"Automatically triggers the cash drawer kick command (via thermal printer) when a POS receipt is printed"*
- **Reality**: There is no thermal printing integration or raw byte command dispatcher linked to this setting. Setting this toggle to true has no functional impact. (The Electron IPC bridge only responds to a manual "Test Drawer" button click in settings with a simulated success toast).

### 2. VoIP minute counting & AI calling
- **Claimed Function**: Premium AI agent voice calls and VoIP configuration.
- **Reality**: While the app does link with a web app at `mazeway.up.railway.app` using Supabase records, there are no actual Twilio or voice gateway credentials saved in the ERP itself. The statistics for VoIP usage (e.g. `totalMinutes`) are generated programmatically:
  ```javascript
  const estimatedMinutes = (orderStats.total_leads * 5) + (agentCount * 2);
  ```
  The ERP calculates call duration and logs on a simulated basis instead of fetching actual telephony logs.

---

### Verification Summary

These findings are derived from a code inspection of the core routes:
1. `backend/routes/sales.js` (Return and merge validation processes)
2. `backend/routes/inventory.js` (Realtime price changes and adjustment constraints)
3. `backend/routes/whatsappAuth.js` (OAuth redirect targets)
4. `backend/routes/mazeway.js` (Handshake callback origins)
5. `renderer/src/pages/InventoryPage.jsx` & `BillingPage.jsx` (Redirection URLs and stock rendering parameters)
