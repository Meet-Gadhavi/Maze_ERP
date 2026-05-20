# Maze ERP Bug Audit

**Audit date:** April 26, 2026  
**Scope:** Current codebase review across backend routes, database layer, and key renderer-linked business workflows  
**Method:** Static code audit of the current implementation. This is a code-based bug review, not a full runtime or E2E test pass.

---

## Summary

| Severity | Count | Focus |
|---|---:|---|
| Critical | 5 | Data integrity, inventory correctness, security exposure |
| Major | 6 | Core workflow correctness, financial logic, destructive edge cases |
| Medium | 7 | Stability gaps, incomplete safeguards, operational drift |
| Minor | 6 | Smaller correctness and maintainability issues with user-visible risk over time |

---

## Best fix strategy

The best way to fix the bug layer in this app is:

1. **Stabilize the database boundary first**
   - Centralize validation
   - Restrict unsafe SQL usage
   - Make transactions the default for multi-step updates
2. **Then fix core business workflows**
   - Sales creation
   - Returns
   - Fulfillment
   - Purchases
   - Supplier/customer balances
3. **Then add guardrails around destructive and import/export flows**
   - Data delete
   - Backup restore
   - Import validation
4. **Then improve operational safety**
   - Generic error responses
   - Better logging
   - Reduced hidden side effects
5. **Finally add tests around the fixed workflows**
   - Inventory movement
   - Returns
   - Partial fulfillment
   - Credit usage
   - Purchase payment allocation

Without tests, many of these bugs can regress quietly.

---

## Critical Bugs

### C-BUG-01: Generic SQL helpers still allow unsafe arbitrary query execution
- **Files:** [backend/db.js](C:\Users\Meet\Music\Maze_ERP\backend\db.js)
- **Evidence:** Generic `all(sql, params)`, `get(sql, params)`, and `run(sql, params)` still execute raw SQL strings directly around lines 700-724.
- **Impact:** Any route that ever builds SQL from unsanitized input is one mistake away from injection or destructive query execution.
- **Why critical:** This is a trust-boundary problem at the database layer.
- **Best way to fix:** Limit DB helpers to parameterized statements only, add route-level schema validation everywhere, and avoid exposing raw SQL-building patterns as the default API.

### C-BUG-02: Server error handler still leaks raw internal error messages to the client
- **Files:** [backend/server.js](C:\Users\Meet\Music\Maze_ERP\backend\server.js)
- **Evidence:** The global error handler still returns `err.message` in the JSON response around line 35.
- **Impact:** Internal implementation details can leak to the client, including validation wording, route internals, filesystem hints, or SQL-related failures.
- **Why critical:** This creates unnecessary information disclosure and weakens safe failure behavior.
- **Best way to fix:** Log detailed errors server-side and always return a generic client-safe message plus optional error codes.

### C-BUG-03: Sales unit conversion still appears incorrect for secondary-unit requests
- **Files:** [backend/routes/sales.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\sales.js)
- **Evidence:** `baseQuantity` is calculated as `requestedQty * conversionFactor` around lines 206-207.
- **Impact:** If the business rule expects secondary unit requests to be converted back to base stock using division, sales, stock deduction, and pending quantities can all be wrong.
- **Why critical:** This directly affects inventory correctness and invoicing.
- **Best way to fix:** Confirm the intended unit model, then enforce one canonical conversion direction across sale creation, fulfillment, returns, and UI quantity display.

### C-BUG-04: Data delete/import/restore flows remain highly destructive without strong protection
- **Files:** [backend/routes/data.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\data.js)
- **Evidence:** `/delete`, `/import`, and `/restore-backup` still perform broad data mutations from request payloads with limited guardrails.
- **Impact:** Bad imports, malformed restore data, or accidental delete calls can corrupt or wipe operational records.
- **Why critical:** These are high-blast-radius endpoints touching the entire local business dataset.
- **Best way to fix:** Add strict schema validation, backup checkpoints before mutation, explicit confirmation tokens, and safer restore/import transaction handling.

### C-BUG-05: Sales return flow still has complex multi-step financial state mutation risk
- **Files:** [backend/routes/sales.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\sales.js)
- **Evidence:** The return flow recalculates returned amounts, stock, invoice financial state, P-credit behavior, and payment status across lines 398-557.
- **Impact:** Partial returns, refund-to-credit behavior, and paid-vs-returned reconciliation can still drift into inconsistent states.
- **Why critical:** This affects both inventory and money state in one path.
- **Best way to fix:** Refactor returns around a single explicit state machine with deterministic formulas for `effective_total`, `paid_amount`, `refund_balance`, and `financial_status`.

---

## Major Bugs

### J-BUG-01: Fulfillment flow mixes stock deduction and batch deduction in a fragile way
- **Files:** [backend/routes/sales.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\sales.js)
- **Evidence:** Fulfillment checks product stock first around lines 695-714, then optionally adjusts batch quantities later around lines 726-728.
- **Impact:** Product-level stock and batch-level stock can diverge if the batch allocation does not fully mirror the product deduction path.
- **Best way to fix:** Treat batch-aware fulfillment as one atomic allocation step and derive product stock from batch movement, not parallel updates.

### J-BUG-02: Inventory stock adjustments still lack a robust concurrency model
- **Files:** [backend/routes/inventory.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\inventory.js)
- **Evidence:** Manual stock adjustment updates product quantity directly around lines 434-443.
- **Impact:** Concurrent edits or repeated submissions can overwrite the latest stock state rather than applying safe deltas.
- **Best way to fix:** Use optimistic locking or version checks, and model adjustments as delta-based stock movements first.

### J-BUG-03: Brand creation can report success even when a duplicate insert is ignored
- **Files:** [backend/routes/inventory.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\inventory.js)
- **Evidence:** Brand creation uses `INSERT OR IGNORE` around lines 197-203 and then returns a created response using `lastInsertRowid`.
- **Impact:** Duplicate brand submissions may look successful but not actually create a new distinct record, confusing the UI and the user.
- **Best way to fix:** Detect existing records explicitly and return either `409 Conflict` or the existing entity.

### J-BUG-04: Purchase return flow can still desynchronize supplier balance vs purchase-level due state
- **Files:** [backend/routes/purchases.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\purchases.js)
- **Evidence:** Purchase returns update supplier balances around lines 337-340 and then separately adjust purchase due/status.
- **Impact:** Edge cases around multiple returns, credits, and mixed payment history can leave supplier totals and purchase totals out of sync.
- **Best way to fix:** Recompute due/credit from ledger-like records inside one transaction rather than incrementally adjusting independent fields.

### J-BUG-05: Category rename still mutates both categories and products in one ad hoc path
- **Files:** [backend/routes/inventory.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\inventory.js)
- **Evidence:** Renaming a category updates `categories` and `products.category` directly around lines 115-123.
- **Impact:** This keeps category identity tied to a product text field instead of a true relational model, which increases the chance of future drift or orphan naming.
- **Best way to fix:** Normalize products to category IDs fully, then remove text-based category duplication.

### J-BUG-06: Invoice creation still creates header state before the full item-processing workflow is complete
- **Files:** [backend/routes/sales.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\sales.js)
- **Evidence:** Invoice row insertion happens early around lines 175-176 before all item stock/business conditions are resolved.
- **Impact:** Although wrapped better than before, this structure still makes the path harder to reason about and easier to break with future edits.
- **Best way to fix:** Validate the entire sale intent first, then create invoice header/items/payments inside one compact transactional commit phase.

---

## Medium Bugs

### M-BUG-01: Backup service failures are only logged, not surfaced operationally
- **Files:** [backend/server.js](C:\Users\Meet\Music\Maze_ERP\backend\server.js)
- **Evidence:** Backup check errors are logged around line 124, but no visible remediation or retry state is exposed.
- **Impact:** Users may assume backups are healthy when they are silently failing.
- **Best way to fix:** Persist backup job health in settings/state and surface failed-last-run information in the UI.

### M-BUG-02: Settings update route still accepts broad key/value payloads
- **Files:** [backend/routes/settings.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\settings.js)
- **Evidence:** The route iterates through request body entries and writes them directly into `settings`.
- **Impact:** Invalid, mistyped, or unsupported settings keys can enter the store and create unpredictable UI/backend behavior.
- **Best way to fix:** Whitelist allowed keys and validate value shapes per setting.

### M-BUG-03: Customer purchase history performance still risks degradation at scale
- **Files:** [backend/routes/customers.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\customers.js)
- **Evidence:** This was previously flagged in the audit and remains a likely scale risk unless the route was fully rewritten to filter in SQL.
- **Impact:** Large invoice history can slow customer detail/history views.
- **Best way to fix:** Keep filtering/pagination in SQL and avoid loading broad invoice sets into memory.

### M-BUG-04: Inventory search and list loading still rely on broad query patterns
- **Files:** [backend/routes/inventory.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\inventory.js)
- **Evidence:** Product listing joins multiple tables and conditionally filters on search/category/subcategory/brand in one route.
- **Impact:** As records grow, this route will become a hotspot for sluggish inventory browsing.
- **Best way to fix:** Add indexes for search/filter columns and consider separate optimized list endpoints for common views.

### M-BUG-05: Data export remains relation-light and migration-fragile
- **Files:** [backend/routes/data.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\data.js)
- **Evidence:** Export builds table payloads independently and date filters are table-specific.
- **Impact:** Backup/import cycles can succeed structurally while still producing logically incomplete restores.
- **Best way to fix:** Export a schema-aware package with relational ordering, metadata, and versioned restore rules.

### M-BUG-06: `db.js` still combines schema, migration, seeding, persistence, and query helpers in one file
- **Files:** [backend/db.js](C:\Users\Meet\Music\Maze_ERP\backend\db.js)
- **Evidence:** One file owns schema creation, migrations, seed logic, persistence, transactions, and query helpers.
- **Impact:** Changes to one area can easily destabilize another and make bugs harder to isolate.
- **Best way to fix:** Split into `schema`, `migrations`, `seed`, and `db client` modules.

### M-BUG-07: Advance invoice processing has separate logic from normal fulfillment and can drift
- **Files:** [backend/routes/sales.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\sales.js)
- **Evidence:** `/process-advance` has its own stock deduction and status logic around lines 779-866.
- **Impact:** Advance invoices can evolve differently from normal invoice fulfillment, producing inconsistent delivery or financial state.
- **Best way to fix:** Reuse one fulfillment engine for advance and standard sales paths.

---

## Minor Bugs

### N-BUG-01: Catch-and-ignore index creation hides initialization issues
- **Files:** [backend/routes/inventory.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\inventory.js)
- **Evidence:** Startup index creation uses `catch (_) { /* indexes may already exist */ }` around line 11.
- **Impact:** Real index-creation failures can be hidden.
- **Best way to fix:** Log non-benign failures explicitly.

### N-BUG-02: Some route logic still uses inline `res.status(...); throw Abort` style control flow
- **Files:** [backend/routes/sales.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\sales.js), [backend/routes/purchases.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\purchases.js), [backend/routes/inventory.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\inventory.js)
- **Impact:** This pattern is easy to break during refactors and makes failure flow harder to reason about.
- **Best way to fix:** Use small guard helpers or structured transaction wrappers that return early cleanly.

### N-BUG-03: Version and product identity drift can cause support/debug confusion
- **Files:** [renderer/src/components/Sidebar.jsx](C:\Users\Meet\Music\Maze_ERP\renderer\src\components\Sidebar.jsx), [package.json](C:\Users\Meet\Music\Maze_ERP\package.json)
- **Impact:** Users and maintainers may report bugs against the wrong product/version label.
- **Best way to fix:** Pull UI version/name from one source of truth.

### N-BUG-04: Hardcoded defaults in settings seeding can drift from actual product behavior
- **Files:** [backend/db.js](C:\Users\Meet\Music\Maze_ERP\backend\db.js)
- **Impact:** Existing installs and new installs may behave differently if defaults evolve in code but not in migration logic.
- **Best way to fix:** Version and test settings defaults explicitly.

### N-BUG-05: Auto-persist and transaction persistence behavior is still complex enough to deserve testing
- **Files:** [backend/db.js](C:\Users\Meet\Music\Maze_ERP\backend\db.js)
- **Evidence:** Persistence occurs both on a timer and around transaction boundaries.
- **Impact:** This is less obviously broken now, but still risky without direct crash-recovery testing.
- **Best way to fix:** Add persistence/recovery tests and document write guarantees.

### N-BUG-06: Several big workflow files remain too large for low-risk maintenance
- **Files:** [backend/routes/sales.js](C:\Users\Meet\Music\Maze_ERP\backend\routes\sales.js), [renderer/src/pages/SalesPage.jsx](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\SalesPage.jsx), [renderer/src/pages/InventoryPage.jsx](C:\Users\Meet\Music\Maze_ERP\renderer\src\pages\InventoryPage.jsx)
- **Impact:** Large files are not bugs by themselves, but they materially increase regression risk.
- **Best way to fix:** Split by workflow responsibility and add focused tests around each slice.

---

## Recommended fix order

1. **Critical data and security issues**
   - DB helper trust boundary
   - error leakage
   - destructive data endpoints
   - unit conversion correctness
   - sales return state consistency
2. **Core financial/inventory workflow correctness**
   - fulfillment + batches
   - purchase return / supplier balance reconciliation
   - category normalization
   - invoice creation sequencing
3. **Operational stability**
   - settings validation
   - backup health visibility
   - export/import relation safety
   - advance/normal fulfillment unification
4. **Regression prevention**
   - modularize `db.js`
   - reduce giant workflow files
   - add tests around money and stock flows

---

## Output

This file was created in the current plans folder:

- [Bugs.md](C:\Users\Meet\Music\Maze_ERP\Plans_MazeERP\Bugs.md)
