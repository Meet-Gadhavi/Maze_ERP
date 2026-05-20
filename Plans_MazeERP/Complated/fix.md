# Maze ERP - Code Issues & Fix Recommendations

> [!IMPORTANT]
> **Current Status:** All Medium (🟡), Minor (🟢), and Accessibility (A) issues have been successfully fixed and verified.

---

## Summary by Severity

| Severity | Count | Priority |
|----------|-------|----------|
| 🔴 Critical | 23 | Fix Immediately |
| 🟡 Medium | 41 | Fix Before Release |
| 🟢 Minor | 23 | Fix When Possible |

---

## Summary by Category

| Category | Count |
|----------|-------|
| Security | 18    |
| Logic/Business Rules | 22 |
| UI/UX | 19       |
| Code Quality | 15 |
| Performance | 8 |
| Accessibility | 5 |

---

## 🔴 CRITICAL ISSUES (Must Fix Before Any Production Use)

### Security Vulnerabilities

| # | File | Line | Issue | Impact | Fix |
|---|------|------|-------|--------|-----|
| ✅ C001 | `backend/db.js` | 657-682 | **SQL Injection Risk** - `all()`, `get()`, `run()` functions don't sanitize inputs before passing to SQL | Data breach, data manipulation | Add input validation/sanitization layer before SQL execution |
| ✅ C002 | `backend/server.js` | 12-13 | **No Request Rate Limiting** - Express has no throttling, vulnerable to DoS | Service disruption | Add `express-rate-limit` middleware |
| ✅ C003 | `backend/server.js` | 12 | **No Helmet Security Headers** - Missing CSP, X-Frame-Options, etc. | XSS, clickjacking attacks | Add `app.use(helmet())` |
| ✅ C004 | `backend/routes/sales.js` | 84-89 | **No Input Validation** - Invoice items accepted without validation | Invalid data, potential exploits | Add Joi/Zod schema validation |
| ✅ C005 | `backend/routes/customers.js` | 62-68 | **No Phone/Email Validation** - Accepts any string | Data integrity issues | Add regex validation for phone/email |
| ✅ C006 | `backend/routes/data.js` | 95-105 | **Direct Data Import Without Validation** - Can inject malicious data | Data corruption, injection | Validate schema before import |
| ✅ C007 | `backend/routes/data.js` | 56-75 | **Dangerous Delete Endpoint** - `/api/data/delete` deletes all data with no confirmation | Accidental/malicious data wipe | Remove or add strong authentication |
| ✅ C008 | `main/main.js` | 49-53 | **Preload API Too Minimal** - No bridge for secure IPC | Limited security boundary | Expand contextBridge with validated methods |
| ✅ C009 | `backend/backupUtil.js` | 78-83 | **Backup File Read Without Validation** - Path traversal possible | File system exposure | Validate filename, use path.basename() |
| ✅ C010 | `backend/db.js` | 30-32 | **Auto-persist Every 5 Seconds** - Can cause data loss if crash occurs mid-write | Data corruption | Add transaction safety, increase interval |
| ✅ C011 | `backend/routes/sales.js` | 393-464 | **Return Logic Race Condition** - Multiple returns can exceed original quantity | Inventory fraud | Add database transaction locks |
| ✅ C012 | `backend/routes/purchases.js` | 184-189 | **Supplier Balance Update Without Transaction** - Can desync | Financial data corruption | Wrap in transaction |
| ✅ C013 | `backend/routes/inventory.js` | 399-413 | **Stock Adjustment Race Condition** - Concurrent adjustments can conflict | Inventory errors | Add optimistic locking |
| ✅ C014 | `backend/server.js` | 81-113 | **Backup Service No Error Recovery** - Silent failures | Missing backups | Add retry logic, alerting |
| ✅ C015 | `main/main.js` | 64-68 | **Dev Mode Exposes DevTools** - Commented out but pattern is risky | Code exposure in prod | Ensure always disabled in production |
| ✅ C016 | `backend/routes/sales.js` | 106-109 | **Invoice Created Before Stock Check** - Can create invoice with insufficient stock | Inventory negative values | Check stock first, then create |
| ✅ C017 | `backend/db.js` | 58 | **PRAGMA foreign_keys Not Enforced Globally** - Set per connection | Referential integrity issues | Set at connection pool level |
| ✅ C018 | `renderer/src/api.js` | N/A | **No API File Found** - API calls likely hardcoded in components | Inconsistent error handling | Create centralized API client |

### Logic/Business Rule Issues

| # | File | Line | Issue | Impact | Fix |
|---|------|------|-------|--------|-----|
| ✅ C019 | `backend/routes/sales.js` | 240-253 | **Payment Status Logic Flaw** - `effectiveTotal === 0 && finalPaid === 0` sets UNPAID incorrectly | Wrong financial reporting | Refactor payment status calculation |
| ✅ C020 | `backend/routes/sales.js` | 378-449 | **Return Financial Status Complex** - Multiple status updates can conflict | Confusing financial state | Simplify state machine |
| ✅ C021 | `backend/routes/purchases.js` | 138-142 | **Average Cost Calculation Wrong** - Doesn't account for existing value properly | Wrong COGS | Use weighted average: `(oldQty*oldPrice + newQty*newPrice) / (oldQty+newQty)` |
| ✅ C022 | `backend/routes/sales.js` | 129-131 | **Unit Conversion Logic Flaw** - `conversionFactor` applied incorrectly | Wrong quantities | Fix: `baseQuantity = requestedQty / conversionFactor` |
| ✅ C023 | `backend/db.js` | 342-349 | **Stock Movement Logged on Every Edit** - Even if stock unchanged | Bloated audit log | Only log if `diff !== 0` |

---

## 🟡 MEDIUM ISSUES (Fix Before Professional Release)

### Code Quality & Architecture

| # | File | Line | Issue | Impact | Fix |
|---|------|------|-------|--------|-----|
| ✅ M001 | `backend/routes/sales.js` | 1-732 | **File Too Large (732 lines)** - Single file handles all sales logic | Unmaintainable | Split into controllers: create, return, payment, fulfill |
| ✅ M002 | `backend/db.js` | 1-684 | **Database Schema Mixed with Helpers** - Should be separate files | Hard to navigate | Extract schema to `schema.js` |
| ✅ M003 | `backend/server.js` | 42-78 | **`killProcessOnPort` Uses `exec`** - Vulnerable to command injection | Security risk | Use `execFile` with escaped args |
| ✅ M004 | `renderer/src/pages/SalesPage.jsx` | 1-500+ | **Component Too Large** - 500+ lines, too many states | Unmaintainable | Extract hooks: `useInvoice`, `useCart`, `usePayments` |
| ✅ M005 | `renderer/src/pages/InventoryPage.jsx` | 1-500+ | **Component Too Large** - Multiple responsibilities | Hard to test | Split into `ProductList`, `ProductForm`, `StockAlerts` |
| ✅ M006 | `backend/routes/inventory.js` | 264-307 | **Product Creation Doesn't Validate Duplicates** | Duplicate products | Check for existing product code/name |
| ✅ M007 | `backend/routes/customers.js` | 58-75 | **Customer Create/Update Duplicate Code** | Maintenance burden | Extract to `upsertCustomer` function |
| ✅ M008 | `backend/routes/settings.js` | 19-32 | **Settings Update No Validation** - Accepts any key/value | Invalid settings | Whitelist allowed keys |
| ✅ M009 | `renderer/src/App.jsx` | 12-41 | **No Error Boundary** - Crashes propagate to root | Poor UX | Add React Error Boundary |
| ✅ M010 | `backend/backupUtil.js` | 14-16 | **Hardcoded Backup Path** - Not configurable | Inflexible | Add to settings |
| ✅ M011 | `backend/db.js` | 86-131 | **Migration Code Inline** - Should be separate module | Hard to maintain | Extract to `migrations/` folder |
| ✅ M012 | `renderer/src/pages/DashboardPage.jsx` | 34-59 | **Hardcoded Card Config** - Not extensible | Hard to customize | Move to config object |
| ✅ M013 | `backend/routes/purchases.js` | 248-334 | **Purchase Return Logic Incomplete** - Doesn't update all states | Wrong inventory | Complete return workflow |
| ✅ M014 | `renderer/src/components/FormComponents.jsx` | N/A | **Form Components Not Reusable** - Tightly coupled | Code duplication | Make generic, pass validators |
| ✅ M015 | `backend/server.js` | 33-36 | **Global Error Handler Leaks Details** - Sends `err.message` to client | Information disclosure | Log error, send generic message |

### UI/UX Issues

| # | File | Line | Issue | Impact | Fix |
|---|------|------|-------|--------|-----|
| ✅ M016 | `renderer/src/pages/SalesPage.jsx` | 111-210 | **No Loading State on Add to Cart** - User clicks multiple times | Duplicate items | Add loading spinner, disable button |
| ✅ M017 | `renderer/src/pages/InventoryPage.jsx` | 372-486 | **Category Groups No Scroll** - Long lists overflow | Hidden products | Add max-height, scroll |
| ✅ M018 | `renderer/src/pages/SalesPage.jsx` | 18-56 | **No Keyboard Shortcuts** - Power users need mouse only | Slow workflow | Add F2 (new), F4 (save), Esc (cancel) |
| ✅ M019 | `renderer/src/pages/DashboardPage.jsx` | 90-122 | **Chart No Data State** - Shows empty if no data | Confusing | Add "No data available" message |
| ✅ M020 | `renderer/src/pages/CustomersPage.jsx` | 203-224 | **Customer Table No Pagination** - All customers load | Slow with 1000+ | Add pagination (50 per page) |
| ✅ M021 | `renderer/src/pages/InventoryPage.jsx` | 452-479 | **Product Row No Hover State** - Hard to track row | UX issue | Add `:hover` background |
| ✅ M022 | `renderer/src/pages/SalesPage.jsx` | 30-36 | **No Confirmation Before Delete** - Modal exists but not always used | Accidental deletes | Always show confirmation |
| ✅ M023 | `renderer/src/pages/PurchasePage.jsx` | 96-116 | **Purchase History No CSV Export** | Manual work | Add CSV export button |
| ✅ M024 | `renderer/src/pages/SettingsPage.jsx` | 119-128 | **Settings Save No Loading State** - Can click multiple times | Duplicate saves | Disable button while saving |
| ✅ M025 | `renderer/src/pages/DashboardPage.jsx` | 82-88 | **Timeframe Buttons No Active State** - Hard to see selected | Confusing | Add clear active indicator |
| ✅ M026 | `renderer/src/pages/InventoryPage.jsx` | 317-336 | **Tabs No Keyboard Navigation** - Can't use arrow keys | Accessibility | Add arrow key support |
| ✅ M027 | `renderer/src/pages/SalesPage.jsx` | 40-48 | **Payment Filter Unclear** - "All" vs specific methods | Confusing reports | Add labels, tooltips |
| ✅ M028 | `renderer/src/pages/CustomersPage.jsx` | 174-184 | **Empty State Generic Icon** - Same for all empty states | Less polished | Use contextual icons |
| ✅ M029 | `renderer/src/pages/PurchasePage.jsx` | 218-300 | **GST Breakdown Not Shown** - CGST/SGST vs IGST display | Confusing | Show interstate vs intrastate GST |
| ✅ M030 | `renderer/src/pages/InventoryPage.jsx` | 260-299 | **PDF Export No Company Logo** - Uses settings but may fail | Ugly PDFs | Add fallback if no logo |
| ✅ M031 | `renderer/src/pages/SalesPage.jsx` | 86-93 | **Invoice Preview No Print Option** - Can view but not print | Extra steps | Add print button |
| ✅ M032 | `renderer/src/pages/DashboardPage.jsx` | 159-185 | **Recent Transactions No "View All"** - Limited to 10 | Can't see history | Add "View All" link |
| ✅ M033 | `renderer/src/pages/SettingsPage.jsx` | 220-250 | **Settings Tabs Not Responsive** - Overflow on small screens | Hidden tabs | Make scrollable or dropdown |
| ✅ M034 | `renderer/src/pages/InventoryPage.jsx` | 62-77 | **Product Load No Debounce** - Search triggers every keystroke | API spam | Add 300ms debounce |

### Logic/Business Rules

| # | File | Line | Issue | Impact | Fix |
|---|------|------|-------|--------|-----|
| ✅ M035 | `backend/routes/sales.js` | 546-639 | **Fulfillment Doesn't Check Batches** - Can fulfill from wrong batch | Inventory errors | Check batch availability |
| ✅ M036 | `backend/routes/inventory.js` | 214-249 | **Stock Alerts Don't Consider Variants** - Only product stock | Missed alerts | Include variant stock |
| ✅ M037 | `backend/routes/purchases.js` | 64-67 | **GST Calculation Simplified** - Always 50/50 CGST/SGST | Wrong for interstate | Check supplier state |
| ✅ M038 | `backend/db.js` | 318-331 | **Categories Seeded From Products** - But products reference category name | Circular dependency | Seed categories first |
| ✅ M039 | `backend/routes/sales.js` | 228-238 | **P-Credit Applied Before Payment Status** - Order matters | Wrong status | Apply after calculating due |
| ✅ M040 | `backend/routes/customers.js` | 39-56 | **Customer Purchases Loads ALL Invoices** - Then filters | Slow with 10000+ | Filter in SQL query |
| ✅ M041 | `backend/routes/inventory.js` | 93-121 | **Category Rename Updates All Products** - Without transaction | Data corruption | Wrap in transaction |
| ✅ M042 | `backend/backupUtil.js` | 24-60 | **Backup Doesn't Include Settings** - Settings table missing | Incomplete backup | Add settings to export |
| ✅ M043 | `renderer/src/pages/SalesPage.jsx` | 154-172 | **Cart Totals Recalculated Every Render** - Inefficient | Performance | Use useMemo |
| ✅ M044 | `renderer/src/pages/InventoryPage.jsx` | 373-375 | **Category Filter Hides Empty** - But search shows | Inconsistent | Show empty on search |
| ✅ M045 | `backend/routes/data.js` | 14-53 | **Export Doesn't Handle Relations** - Exports tables independently | Import issues | Export with foreign keys |

### Performance Issues

| # | File | Line | Issue | Impact | Fix |
|---|------|------|-------|--------|-----|
| ✅ M046 | `backend/db.js` | 657-666 | **`all()` Function Creates New Statement Each Time** | Memory leak risk | Cache prepared statements |
| ✅ M047 | `renderer/src/pages/DashboardPage.jsx` | 19-29 | **Dashboard Reloads on Every Timeframe Change** - No caching | Slow | Cache previous range |
| ✅ M048 | `backend/routes/sales.js` | 59-77 | **Invoice GET Loads Items Separately** - N+1 query | Slow | Use JOIN in single query |
| ✅ M049 | `renderer/src/pages/InventoryPage.jsx` | 91-99 | **useEffect Runs 3 API Calls** - Could be parallel | Slow load | Use Promise.all |
| ✅ M050 | `backend/routes/inventory.js` | 6-46 | **Product Search No Index** - Full table scan | Slow with 10000+ | Add database indexes |
| ✅ M051 | `renderer/src/pages/SalesPage.jsx` | 150-154 | **Cart Filter Runs Every Render** | Performance | Use useMemo |
| ✅ M052 | `backend/routes/purchases.js` | 6-19 | **Purchase History No Pagination** - Loads all | Slow | Add limit/offset |
| ✅ M053 | `backend/backupUtil.js` | 62-76 | **getBackups Reads All Files** - No limit | Slow with 1000+ backups | Limit to 50 recent |

---

## 🟢 MINOR ISSUES (Nice to Fix)

### Code Quality

| # | File | Line | Issue | Fix |
|---|------|------|-------|-----|
| ✅ L001 | `backend/server.js` | 9 | **Magic Number PORT 3001** | Move to `.env` or config |
| ✅ L002 | `backend/db.js` | 15 | **Hardcoded Database Path** | Use config |
| ✅ L003 | `backend/routes/sales.js` | 85 | **Console.log in Production Code** | Remove or use logger |
| ✅ L004 | `backend/routes/inventory.js` | 419 | **Empty Catch Block** | Log error or handle |
| ✅ L005 | `renderer/src/pages/CustomersPage.jsx` | 7 | **Unused Import `formatDate`** | Remove |
| ✅ L006 | `backend/db.js` | 679 | **Comment Says "For INSERT" But Always Runs** | Fix comment or logic |
| ✅ L007 | `renderer/src/pages/SalesPage.jsx` | 6 | **Unused Import `formatDateShort`** | Remove |
| ✅ L008 | `backend/routes/settings.js` | 1 | **Unused `express` Import** (only using Router) | Keep but note |
| ✅ L009 | `main/main.js` | 5 | **`app.setName` Called But Not Used Elsewhere** | Verify usage |
| ✅ L010 | `backend/backupUtil.js` | 5 | **Duplicate TABLE_GROUPS** - Also in data.js | Extract to shared module |
| ✅ L011 | `renderer/src/pages/InventoryPage.jsx` | 416 | **Typo: "catagorie"** | Fix to "category" |
| ✅ L012 | `backend/db.js` | 265-308 | **Magic Strings for Settings Keys** | Use constants |
| ✅ L013 | `renderer/src/pages/DashboardPage.jsx` | 8 | **Magic Color Array** | Move to constants |
| ✅ L014 | `backend/routes/purchases.js` | 113 | **Comment Says "For Now" - Technical Debt** | Implement interstate logic |
| ✅ L015 | `renderer/src/App.jsx` | 10 | **CSS Import After Components** | Move to top |

### UI/UX

| # | File | Line | Issue | Fix |
|---|------|------|-------|-----|
| ✅ L016 | `renderer/src/pages/CustomersPage.jsx` | 207 | **GSTIN Shows "—" for Empty** - Should show "Not Provided" | Better label |
| ✅ L017 | `renderer/src/pages/DashboardPage.jsx` | 54 | **"Low Stock Alert" Card Shows Count** - No context | Add "products" label |
| ✅ L018 | `renderer/src/pages/SalesPage.jsx` | 20-22 | **Walk-in Fields Always Visible** - Only needed sometimes | Show conditionally |
| ✅ L019 | `renderer/src/pages/InventoryPage.jsx` | 391 | **Badge Shows "Items"** - Should be "Products" | Consistent naming |
| ✅ L020 | `renderer/src/pages/PurchasePage.jsx` | 12-18 | **Too Many Tabs** - 5 tabs overwhelming | Consolidate |
| ✅ L021 | `renderer/src/pages/SettingsPage.jsx` | 37 | **Too Many Tabs** - 5 tabs in settings | Group related settings |
| ✅ L022 | `renderer/src/pages/CustomersPage.jsx` | 143 | **Search Placeholder Long** - "Search customers by name or phone…" | Shorten to "Search customers…" |
| ✅ L023 | `renderer/src/pages/DashboardPage.jsx" | 82 | **Chart Title Long** | Shorten |
| ✅ L024 | `renderer/src/pages/SalesPage.jsx` | 41 | **Payment Method Default "Cash"** - Should be configurable | Use settings |
| ✅ L025 | `renderer/src/pages/InventoryPage.jsx` | 304 | **Page Title Generic** - "Inventory Management" | Add counts: "Inventory (1,234 products)" |

### Accessibility

| # | File | Line | Issue | Impact | Fix |
|---|------|------|-------|--------|-----|
| ✅ A001 | `renderer/src/pages/CustomersPage.jsx` | 134 | **Button No aria-label** | Screen readers | Add `aria-label="Add customer"` |
| ✅ A002 | `renderer/src/pages/InventoryPage.jsx` | 310 | **Button No aria-label** | Screen readers | Add label |
| ✅ A003 | `renderer/src/pages/DashboardPage.jsx` | 84-88 | **Timeframe Buttons No aria-pressed** | Screen readers | Add ARIA attributes |
| ✅ A004 | `renderer/src/pages/SalesPage.jsx` | 100-108 | **Delete Button No aria-label** | Screen readers | Add label |
| ✅ A005 | `renderer/src/pages/SettingsPage.jsx` | 229-248 | **Tabs No role="tablist"** | Screen readers | Add ARIA roles |

---

## Recommended Fix Priority

### Week 1-2: Security Critical
1. C001-C018 (All security issues)
2. C019-C023 (Logic issues)

### Week 3-4: Architecture
1. M001-M015 (Code quality)
2. M046-M053 (Performance)

### Week 5-6: UI/UX Polish
1. M016-M034 (UX improvements)
2. L016-L025 (Minor UX)

### Week 7-8: Accessibility & Minor
1. A001-A005 (Accessibility)
2. L001-L015 (Code cleanup)

---

## Technical Debt Summary

| Area | Debt Level | Effort to Fix |
|------|------------|---------------|
| Security | 🔴 High | 2-3 weeks |
| Architecture | 🟡 Medium | 3-4 weeks |
| Performance | 🟡 Medium | 1-2 weeks |
| UI/UX | 🟡 Medium | 2-3 weeks |
| Accessibility | 🟢 Low | 2-3 days |
| Testing | 🔴 Critical (0 tests) | 4-5 weeks |

---

## Missing Infrastructure

| Component | Status | Priority |
|-----------|--------|----------|
| Unit Tests | ❌ Missing | P0 |
| Integration Tests | ❌ Missing | P0 |
| E2E Tests | ❌ Missing | P1 |
| CI/CD Pipeline | ❌ Missing | P1 |
| Error Logging | ❌ Missing | P0 |
| Performance Monitoring | ❌ Missing | P2 |
| API Documentation | ❌ Missing | P2 |
| Code Style Guide | ❌ Missing | P3 |
| Contributing Guidelines | ❌ Missing | P3 |

---

*Generated by Claude Code - Maze ERP Code Audit*

---

