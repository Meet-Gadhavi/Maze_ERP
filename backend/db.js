const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_FILE_NAME = 'maze.db';

const SETTINGS_KEYS = {
  COMPANY_NAME: 'company_name',
  ADDRESS: 'address',
  PHONE: 'phone',
  EMAIL: 'email',
  LOGO_URL: 'logo_url',
  GSTIN: 'gstin',
  BANK_NAME: 'bank_name',
  ACCOUNT_NUMBER: 'account_number',
  IFSC_CODE: 'ifsc_code',
  ACCOUNT_HOLDER_NAME: 'account_holder_name',
  UPI_ID: 'upi_id',
  PAYMENT_QR_URL: 'payment_qr_url',
  DECLARATION: 'declaration',
  TERMS_AND_CONDITIONS: 'terms_and_conditions',
  BACKUP_CYCLE: 'backup_cycle',
  LAST_BACKUP_DATE: 'last_backup_date',
  ENABLE_GST_PER_ITEM: 'enable_gst_per_item',
  ENABLE_DISCOUNT_PER_ITEM: 'enable_discount_per_item',
  ENABLE_SKU: 'enable_sku',
  ENABLE_BATCH_SYSTEM: 'enable_batch_system',
  REQUIRE_BATCH_NUMBER: 'require_batch_number',
  ENABLE_EXPIRY_TRACKING: 'enable_expiry_tracking',
  AUTO_BATCH_SELECTION_METHOD: 'auto_batch_selection_method',
  EXPIRY_ALERT_DAYS: 'expiry_alert_days',
  ALLOW_NEGATIVE_BATCH_STOCK: 'allow_negative_batch_stock',
  MAZEWAY_CLOUD_ENABLED: 'mazeway_cloud_enabled',
  MAZEWAY_API_KEY: 'mazeway_api_key',
  MAZEWAY_WEBHOOK_URL: 'mazeway_webhook_url',
  CLOUD_BACKUPS_ENABLED: 'cloud_backups_enabled',
  AUTO_UPDATE_ENABLED: 'auto_update_enabled',
  DEFAULT_CURRENCY: 'default_currency',
  INVOICE_LANGUAGE: 'invoice_language',
  TIER_A_DISCOUNT: 'tier_a_discount',
  TIER_B_DISCOUNT: 'tier_b_discount',
  TIER_C_DISCOUNT: 'tier_c_discount',
  ENABLE_SERIAL_TRACKING: 'enable_serial_tracking',
  AUTO_EMAIL_INVOICE_CREATED: 'auto_email_invoice_created',
  AUTO_EMAIL_INVOICE_EDITED: 'auto_email_invoice_edited',
  AUTO_EMAIL_VOICE_REQUEST: 'auto_email_voice_request',
  AUTO_EMAIL_ORDER_CONFIRMATION: 'auto_email_order_confirmation',
  AUTO_EMAIL_PAYMENT_RECEIVED: 'auto_email_payment_received',
  AUTO_EMAIL_DUE_REMINDER: 'auto_email_due_reminder',
  AUTO_EMAIL_DUE_REMINDER_DAYS: 'auto_email_due_reminder_days',
  INCLUDE_PENDING_PRICE: 'include_pending_price',

  AUTO_WHATSAPP_INVOICE_CREATED: 'auto_whatsapp_invoice_created',
  AUTO_WHATSAPP_INVOICE_EDITED: 'auto_whatsapp_invoice_edited',
  AUTO_WHATSAPP_ORDER_CONFIRMATION: 'auto_whatsapp_order_confirmation',
  AUTO_WHATSAPP_VOICE_REQUEST: 'auto_whatsapp_voice_request',
  AUTO_WHATSAPP_PAYMENT_RECEIVED: 'auto_whatsapp_payment_received',
  AUTO_WHATSAPP_DUE_REMINDER: 'auto_whatsapp_due_reminder',
  AUTO_WHATSAPP_DUE_REMINDER_DAYS: 'auto_whatsapp_due_reminder_days',

  WHATSAPP_APP_ID: 'whatsapp_app_id',
  WHATSAPP_APP_SECRET: 'whatsapp_app_secret',
  WHATSAPP_TOKEN: 'whatsapp_token',
  WHATSAPP_PHONE_NUMBER_ID: 'whatsapp_phone_number_id',
  WHATSAPP_BUSINESS_ACCOUNT_ID: 'whatsapp_business_account_id',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'whatsapp_webhook_verify_token'
};

// In production, store database in %APPDATA%/Quantro/ (set by main.js).
// In dev, keep it in the project-local ./database/ folder.
const dbDir = path.join(process.env.MAZE_USER_DATA || path.join(__dirname, '..', 'data'), 'Live');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, DB_FILE_NAME);

let db = null;
let inTransaction = false;
let ready = null;

// Save database to file
function persist() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Initialize database
ready = (async () => {
  const isPackaged = !!process.env.MAZE_USER_DATA;
  
  const SQL = await initSqlJs({
    locateFile: file => {
      if (isPackaged && process.resourcesPath) {
        return path.join(process.resourcesPath, file);
      }
      return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file);
    }
  });

  console.log(`[Maze ERP] SQLite engine initialized (Data Dir: ${dbDir})`);

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');


  // --------------- Schema Creation ---------------
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      category    TEXT    NOT NULL DEFAULT 'General',
      subcategory_id INTEGER DEFAULT NULL,
      brand_id    INTEGER DEFAULT NULL,
      tags        TEXT    DEFAULT '',
      cost_price  REAL    NOT NULL DEFAULT 0,
      selling_price REAL  NOT NULL DEFAULT 0,
      stock_quantity REAL NOT NULL DEFAULT 0,
      product_code TEXT    DEFAULT '',
      unit        TEXT    DEFAULT 'PCS',
      secondary_unit TEXT DEFAULT NULL,
      conversion_factor REAL DEFAULT 1,
      allow_decimal BOOLEAN DEFAULT 0,
      conversion_rate REAL  DEFAULT 1,
      min_stock_level REAL DEFAULT 5,
      max_stock_level REAL DEFAULT 0,
      track_batches BOOLEAN DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  // Migration: Add product_code column if missing
  try {
    const res = db.exec('PRAGMA table_info(products)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('product_code')) {
        db.run('ALTER TABLE products ADD COLUMN product_code TEXT DEFAULT ""');
      }
      if (!columns.includes('unit')) {
        db.run('ALTER TABLE products ADD COLUMN unit TEXT DEFAULT "PCS"');
      }
      if (!columns.includes('allow_decimal')) {
        db.run('ALTER TABLE products ADD COLUMN allow_decimal BOOLEAN DEFAULT 0');
      }
      if (!columns.includes('conversion_rate')) {
        db.run('ALTER TABLE products ADD COLUMN conversion_rate REAL DEFAULT 1');
      }
      if (!columns.includes('subcategory_id')) {
        db.run('ALTER TABLE products ADD COLUMN subcategory_id INTEGER DEFAULT NULL');
      }
      if (!columns.includes('brand_id')) {
        db.run('ALTER TABLE products ADD COLUMN brand_id INTEGER DEFAULT NULL');
      }
      if (!columns.includes('tags')) {
        db.run('ALTER TABLE products ADD COLUMN tags TEXT DEFAULT ""');
      }
      if (!columns.includes('secondary_unit')) {
        db.run('ALTER TABLE products ADD COLUMN secondary_unit TEXT DEFAULT NULL');
      }
      if (!columns.includes('conversion_factor')) {
        db.run('ALTER TABLE products ADD COLUMN conversion_factor REAL DEFAULT 1');
      }
      if (!columns.includes('min_stock_level')) {
        db.run('ALTER TABLE products ADD COLUMN min_stock_level REAL DEFAULT 5');
      }
      if (!columns.includes('max_stock_level')) {
        db.run('ALTER TABLE products ADD COLUMN max_stock_level REAL DEFAULT 0');
      }
      if (!columns.includes('track_batches')) {
        db.run('ALTER TABLE products ADD COLUMN track_batches BOOLEAN DEFAULT 0');
      }
      if (!columns.includes('track_serials')) {
        db.run('ALTER TABLE products ADD COLUMN track_serials BOOLEAN DEFAULT 0');
      }
      // Note: SQLite doesn't directly support changing column types. 
      // Existing data will be handled as REAL when read/written.
    }
  } catch (err) {
    console.error('Products migration failed', err);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      phone       TEXT    NOT NULL DEFAULT '',
      email       TEXT    NOT NULL DEFAULT '',
      address     TEXT    NOT NULL DEFAULT '',
      gstin       TEXT    DEFAULT '',
      p_credit_balance REAL NOT NULL DEFAULT 0,
      tier        TEXT    NOT NULL DEFAULT 'C',
      credit_limit REAL   NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  // Migration: Add columns to customers if missing
  try {
    const res = db.exec('PRAGMA table_info(customers)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('email')) {
        db.run('ALTER TABLE customers ADD COLUMN email TEXT NOT NULL DEFAULT ""');
      }
      if (!columns.includes('gstin')) {
        db.run('ALTER TABLE customers ADD COLUMN gstin TEXT DEFAULT ""');
      }
      if (!columns.includes('p_credit_balance')) {
        db.run('ALTER TABLE customers ADD COLUMN p_credit_balance REAL NOT NULL DEFAULT 0');
      }
      if (!columns.includes('tier')) {
        db.run("ALTER TABLE customers ADD COLUMN tier TEXT NOT NULL DEFAULT 'C'");
      }
      if (!columns.includes('credit_limit')) {
        db.run('ALTER TABLE customers ADD COLUMN credit_limit REAL NOT NULL DEFAULT 0');
      }
    }
  } catch (err) {
    console.error('Migration failed', err);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS customer_communication_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      type        TEXT    NOT NULL, -- 'Call', 'Email', 'SMS', 'Meeting', 'Other'
      notes       TEXT    NOT NULL DEFAULT '',
      date        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      total       REAL    NOT NULL DEFAULT 0,
      gst_rate    REAL    NOT NULL DEFAULT 0,
      discount_rate REAL  NOT NULL DEFAULT 0,
      date        TEXT    NOT NULL DEFAULT (date('now','localtime')),
      walk_in_name TEXT   NOT NULL DEFAULT '',
      walk_in_phone TEXT  NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    )
  `);

  // Migration: Add gst_rate and discount_rate to invoices if missing
  try {
    const res = db.exec('PRAGMA table_info(invoices)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('gst_rate')) {
        db.run('ALTER TABLE invoices ADD COLUMN gst_rate REAL NOT NULL DEFAULT 0');
      }
      if (!columns.includes('discount_rate')) {
        db.run('ALTER TABLE invoices ADD COLUMN discount_rate REAL NOT NULL DEFAULT 0');
      }
      if (!columns.includes('paid_amount')) {
        db.run('ALTER TABLE invoices ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0');
      }
      if (!columns.includes('payment_status')) {
        db.run('ALTER TABLE invoices ADD COLUMN payment_status TEXT NOT NULL DEFAULT "Paid"');
      }
      if (!columns.includes('walk_in_name')) {
        db.run('ALTER TABLE invoices ADD COLUMN walk_in_name TEXT NOT NULL DEFAULT ""');
      }
      if (!columns.includes('walk_in_phone')) {
        db.run('ALTER TABLE invoices ADD COLUMN walk_in_phone TEXT NOT NULL DEFAULT ""');
      }
      if (!columns.includes('financial_status')) {
        db.run('ALTER TABLE invoices ADD COLUMN financial_status TEXT NOT NULL DEFAULT "Paid"');
      }
      if (!columns.includes('total_returned_amount')) {
        db.run('ALTER TABLE invoices ADD COLUMN total_returned_amount REAL NOT NULL DEFAULT 0');
      }
      if (!columns.includes('return_type')) {
        db.run('ALTER TABLE invoices ADD COLUMN return_type TEXT DEFAULT NULL');
      }
      if (!columns.includes('p_credit_amount')) {
        db.run('ALTER TABLE invoices ADD COLUMN p_credit_amount REAL NOT NULL DEFAULT 0');
      }
      if (!columns.includes('is_advance')) {
        db.run('ALTER TABLE invoices ADD COLUMN is_advance INTEGER DEFAULT 0');
      }
      if (!columns.includes('advance_amount')) {
        db.run('ALTER TABLE invoices ADD COLUMN advance_amount REAL DEFAULT 0');
      }
      if (!columns.includes('is_stock_deducted')) {
        db.run('ALTER TABLE invoices ADD COLUMN is_stock_deducted INTEGER DEFAULT 1');
      }
      if (!columns.includes('coupon_code')) {
        db.run('ALTER TABLE invoices ADD COLUMN coupon_code TEXT DEFAULT NULL');
      }
      if (!columns.includes('coupon_discount_amount')) {
        db.run('ALTER TABLE invoices ADD COLUMN coupon_discount_amount REAL NOT NULL DEFAULT 0');
      }
    }
  } catch (err) {
    console.error('Invoices migration failed', err);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_returns (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id  INTEGER NOT NULL,
      product_id  INTEGER NOT NULL,
      return_qty  INTEGER NOT NULL,
      return_amount REAL NOT NULL,
      return_date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      refund_method TEXT NOT NULL,
      batch_id    INTEGER DEFAULT NULL,
      created_by  TEXT,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id  INTEGER NOT NULL,
      product_id  INTEGER,
      product_name TEXT   NOT NULL,
      quantity    REAL    NOT NULL DEFAULT 1,
      unit        TEXT    DEFAULT 'PCS',
      price       REAL   NOT NULL DEFAULT 0,
      total       REAL   NOT NULL DEFAULT 0,
      batch_id    INTEGER DEFAULT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id  INTEGER NOT NULL,
      amount      REAL    NOT NULL DEFAULT 0,
      method      TEXT    NOT NULL DEFAULT 'Cash', -- Cash, UPI, Card, Cheque, etc.
      transaction_id TEXT,
      notes       TEXT,
      payment_date TEXT   NOT NULL DEFAULT (datetime('now','localtime')),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT PRIMARY KEY,
      value       TEXT
    )
  `);

  // Seed default settings if empty
  try {
    const settingsCount = get('SELECT COUNT(*) as count FROM settings').count;
    if (settingsCount === 0) {
      const defaultSettings = [
        [SETTINGS_KEYS.COMPANY_NAME, 'Quantro'],
        [SETTINGS_KEYS.ADDRESS, ''],
        [SETTINGS_KEYS.PHONE, ''],
        [SETTINGS_KEYS.EMAIL, ''],
        [SETTINGS_KEYS.LOGO_URL, ''],
        [SETTINGS_KEYS.GSTIN, ''],
        [SETTINGS_KEYS.BANK_NAME, ''],
        [SETTINGS_KEYS.ACCOUNT_NUMBER, ''],
        [SETTINGS_KEYS.IFSC_CODE, ''],
        [SETTINGS_KEYS.ACCOUNT_HOLDER_NAME, ''],
        [SETTINGS_KEYS.UPI_ID, ''],
        [SETTINGS_KEYS.DECLARATION, 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'],
        [SETTINGS_KEYS.TERMS_AND_CONDITIONS, '1. Goods once sold will not be taken back.\n2. Interest @18% will be charged if payment is not made within due date.\n3. Subject to local jurisdiction.'],
        [SETTINGS_KEYS.AUTO_UPDATE_ENABLED, 'false'],
        [SETTINGS_KEYS.DEFAULT_CURRENCY, 'INR'],
        [SETTINGS_KEYS.INVOICE_LANGUAGE, 'en'],
        [SETTINGS_KEYS.TIER_A_DISCOUNT, '10'],
        [SETTINGS_KEYS.TIER_B_DISCOUNT, '5'],
        [SETTINGS_KEYS.TIER_C_DISCOUNT, '0'],
        [SETTINGS_KEYS.AUTO_EMAIL_INVOICE_CREATED, 'false'],
        [SETTINGS_KEYS.AUTO_EMAIL_INVOICE_EDITED, 'false'],
        [SETTINGS_KEYS.AUTO_EMAIL_VOICE_REQUEST, 'false'],
        [SETTINGS_KEYS.AUTO_EMAIL_ORDER_CONFIRMATION, 'false'],
        [SETTINGS_KEYS.AUTO_EMAIL_PAYMENT_RECEIVED, 'false'],
        [SETTINGS_KEYS.AUTO_EMAIL_DUE_REMINDER, 'false'],
        [SETTINGS_KEYS.AUTO_EMAIL_DUE_REMINDER_DAYS, '7'],
        [SETTINGS_KEYS.AUTO_WHATSAPP_INVOICE_CREATED, 'false'],
        [SETTINGS_KEYS.AUTO_WHATSAPP_INVOICE_EDITED, 'false'],
        [SETTINGS_KEYS.AUTO_WHATSAPP_ORDER_CONFIRMATION, 'false'],
        [SETTINGS_KEYS.AUTO_WHATSAPP_VOICE_REQUEST, 'false'],
        [SETTINGS_KEYS.AUTO_WHATSAPP_PAYMENT_RECEIVED, 'false'],
        [SETTINGS_KEYS.AUTO_WHATSAPP_DUE_REMINDER, 'false'],
        [SETTINGS_KEYS.AUTO_WHATSAPP_DUE_REMINDER_DAYS, '7'],
        [SETTINGS_KEYS.WHATSAPP_APP_ID, '1354185989887458'],
        [SETTINGS_KEYS.WHATSAPP_APP_SECRET, '678f644e1e7eafce62c29e5ba2dd17ff'],
        [SETTINGS_KEYS.WHATSAPP_TOKEN, 'EAATPnZC7jFeIBRqggccKGFX3E8Q3UNUmNf4bS59ZCV8MpbzIvfaIHmFrMRvDIHRkiS91DlU110DKgvY5EHWqKzzKL3mgPO9iuv8iFnR5ZAr6GC3CKZC4jmBkZBzSNoFB1v7ArepgYwCUoAeM2UFca2wudIVnPZCJRVgc9W3n0k2S5BG9EmA95Q6g8x1ZAuMjvdkCgZDZD'],
        [SETTINGS_KEYS.WHATSAPP_PHONE_NUMBER_ID, '1117813404753239'],
        [SETTINGS_KEYS.WHATSAPP_BUSINESS_ACCOUNT_ID, '3150419608479658'],
        [SETTINGS_KEYS.WHATSAPP_WEBHOOK_VERIFY_TOKEN, 'maze_secure_verify_2026'],
        [SETTINGS_KEYS.INCLUDE_PENDING_PRICE, 'true']
      ];
      defaultSettings.forEach(([key, value]) => {
        db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
      });
    } else {
      // Ensure specific keys exist for existing users
      const keys = [
        SETTINGS_KEYS.BANK_NAME, SETTINGS_KEYS.ACCOUNT_NUMBER, SETTINGS_KEYS.IFSC_CODE, SETTINGS_KEYS.ACCOUNT_HOLDER_NAME, SETTINGS_KEYS.UPI_ID, SETTINGS_KEYS.PAYMENT_QR_URL,
        SETTINGS_KEYS.BACKUP_CYCLE, SETTINGS_KEYS.LAST_BACKUP_DATE,
        SETTINGS_KEYS.ENABLE_GST_PER_ITEM, SETTINGS_KEYS.ENABLE_DISCOUNT_PER_ITEM, SETTINGS_KEYS.ENABLE_SKU,
        SETTINGS_KEYS.ENABLE_BATCH_SYSTEM, SETTINGS_KEYS.REQUIRE_BATCH_NUMBER, SETTINGS_KEYS.ENABLE_EXPIRY_TRACKING,
        SETTINGS_KEYS.AUTO_BATCH_SELECTION_METHOD, SETTINGS_KEYS.EXPIRY_ALERT_DAYS, SETTINGS_KEYS.ALLOW_NEGATIVE_BATCH_STOCK,
        SETTINGS_KEYS.CLOUD_BACKUPS_ENABLED, SETTINGS_KEYS.AUTO_UPDATE_ENABLED, SETTINGS_KEYS.DEFAULT_CURRENCY, SETTINGS_KEYS.INVOICE_LANGUAGE,
        SETTINGS_KEYS.TIER_A_DISCOUNT, SETTINGS_KEYS.TIER_B_DISCOUNT, SETTINGS_KEYS.TIER_C_DISCOUNT,
        SETTINGS_KEYS.ENABLE_SERIAL_TRACKING, SETTINGS_KEYS.AUTO_EMAIL_INVOICE_CREATED, SETTINGS_KEYS.AUTO_EMAIL_INVOICE_EDITED,
        SETTINGS_KEYS.AUTO_EMAIL_VOICE_REQUEST,
        SETTINGS_KEYS.AUTO_EMAIL_ORDER_CONFIRMATION, SETTINGS_KEYS.AUTO_EMAIL_PAYMENT_RECEIVED, SETTINGS_KEYS.AUTO_EMAIL_DUE_REMINDER, SETTINGS_KEYS.AUTO_EMAIL_DUE_REMINDER_DAYS,
        SETTINGS_KEYS.AUTO_WHATSAPP_INVOICE_CREATED, SETTINGS_KEYS.AUTO_WHATSAPP_INVOICE_EDITED, SETTINGS_KEYS.AUTO_WHATSAPP_ORDER_CONFIRMATION,
        SETTINGS_KEYS.AUTO_WHATSAPP_VOICE_REQUEST, SETTINGS_KEYS.AUTO_WHATSAPP_PAYMENT_RECEIVED, SETTINGS_KEYS.AUTO_WHATSAPP_DUE_REMINDER,
        SETTINGS_KEYS.AUTO_WHATSAPP_DUE_REMINDER_DAYS,
        SETTINGS_KEYS.WHATSAPP_APP_ID, SETTINGS_KEYS.WHATSAPP_APP_SECRET, SETTINGS_KEYS.WHATSAPP_TOKEN,
        SETTINGS_KEYS.WHATSAPP_PHONE_NUMBER_ID, SETTINGS_KEYS.WHATSAPP_BUSINESS_ACCOUNT_ID, SETTINGS_KEYS.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
        'billing_payment_method_added', 'billing_phone_number_purchased', 'billing_phone_number_details',
        'billing_whatsapp_non_csw_count', 'billing_voice_agent_seconds', 'billing_email_sent_count',
        'billing_email_package_active', 'billing_email_package_due', 'billing_simulated_day',
        SETTINGS_KEYS.INCLUDE_PENDING_PRICE
      ];
      keys.forEach(k => {
        let defaultValue = '';
        if (k === SETTINGS_KEYS.BACKUP_CYCLE) defaultValue = 'off';
        else if (k === SETTINGS_KEYS.INCLUDE_PENDING_PRICE) defaultValue = 'true';
        else if (k === SETTINGS_KEYS.ENABLE_BATCH_SYSTEM) defaultValue = 'true';
        else if (k === SETTINGS_KEYS.AUTO_BATCH_SELECTION_METHOD) defaultValue = 'FIFO';
        else if (k === SETTINGS_KEYS.ENABLE_SERIAL_TRACKING) defaultValue = 'true';
        else if (k === SETTINGS_KEYS.EXPIRY_ALERT_DAYS) defaultValue = '30';
        else if (k === SETTINGS_KEYS.MAZEWAY_CLOUD_ENABLED) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.MAZEWAY_API_KEY) defaultValue = '';
        else if (k === SETTINGS_KEYS.MAZEWAY_WEBHOOK_URL) defaultValue = '';
        else if (k === SETTINGS_KEYS.AUTO_UPDATE_ENABLED) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.DEFAULT_CURRENCY) defaultValue = 'INR';
        else if (k === SETTINGS_KEYS.INVOICE_LANGUAGE) defaultValue = 'en';
        else if (k === SETTINGS_KEYS.TIER_A_DISCOUNT) defaultValue = '10';
        else if (k === SETTINGS_KEYS.TIER_B_DISCOUNT) defaultValue = '5';
        else if (k === SETTINGS_KEYS.TIER_C_DISCOUNT) defaultValue = '0';
        else if (k === SETTINGS_KEYS.AUTO_EMAIL_INVOICE_CREATED) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.AUTO_EMAIL_INVOICE_EDITED) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.AUTO_EMAIL_VOICE_REQUEST) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.AUTO_EMAIL_ORDER_CONFIRMATION) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.AUTO_EMAIL_PAYMENT_RECEIVED) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.AUTO_EMAIL_DUE_REMINDER) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.AUTO_EMAIL_DUE_REMINDER_DAYS) defaultValue = '7';
        else if (k === SETTINGS_KEYS.AUTO_WHATSAPP_INVOICE_CREATED) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.AUTO_WHATSAPP_INVOICE_EDITED) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.AUTO_WHATSAPP_ORDER_CONFIRMATION) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.AUTO_WHATSAPP_VOICE_REQUEST) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.AUTO_WHATSAPP_PAYMENT_RECEIVED) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.AUTO_WHATSAPP_DUE_REMINDER) defaultValue = 'false';
        else if (k === SETTINGS_KEYS.AUTO_WHATSAPP_DUE_REMINDER_DAYS) defaultValue = '7';
        else if (k === SETTINGS_KEYS.WHATSAPP_APP_ID) defaultValue = '1354185989887458';
        else if (k === SETTINGS_KEYS.WHATSAPP_APP_SECRET) defaultValue = '678f644e1e7eafce62c29e5ba2dd17ff';
        else if (k === SETTINGS_KEYS.WHATSAPP_TOKEN) defaultValue = 'EAATPnZC7jFeIBRqggccKGFX3E8Q3UNUmNf4bS59ZCV8MpbzIvfaIHmFrMRvDIHRkiS91DlU110DKgvY5EHWqKzzKL3mgPO9iuv8iFnR5ZAr6GC3CKZC4jmBkZBzSNoFB1v7ArepgYwCUoAeM2UFca2wudIVnPZCJRVgc9W3n0k2S5BG9EmA95Q6g8x1ZAuMjvdkCgZDZD';
        else if (k === SETTINGS_KEYS.WHATSAPP_PHONE_NUMBER_ID) defaultValue = '1117813404753239';
        else if (k === SETTINGS_KEYS.WHATSAPP_BUSINESS_ACCOUNT_ID) defaultValue = '3150419608479658';
        else if (k === SETTINGS_KEYS.WHATSAPP_WEBHOOK_VERIFY_TOKEN) defaultValue = 'maze_secure_verify_2026';
        else if (k === 'billing_payment_method_added') defaultValue = 'false';
        else if (k === 'billing_phone_number_purchased') defaultValue = 'false';
        else if (k === 'billing_phone_number_details') defaultValue = '';
        else if (k === 'billing_whatsapp_non_csw_count') defaultValue = '0';
        else if (k === 'billing_voice_agent_seconds') defaultValue = '0';
        else if (k === 'billing_email_sent_count') defaultValue = '0';
        else if (k === 'billing_email_package_active') defaultValue = 'false';
        else if (k === 'billing_email_package_due') defaultValue = '0';
        else if (k === 'billing_simulated_day') defaultValue = '';
        else if (k.startsWith('enable_') || k.startsWith('require_') || k.startsWith('allow_')) defaultValue = 'false';
        
        db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [k, defaultValue]);
      });
    }
  } catch (err) {
    console.error('Settings seeding failed', err);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  // Seed categories from products if empty
  try {
    const catCount = get('SELECT COUNT(*) as count FROM categories').count;
    if (catCount === 0) {
      db.run(`
        INSERT OR IGNORE INTO categories (name)
        SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ''
      `);
      // Ensure 'General' exists
      db.run("INSERT OR IGNORE INTO categories (name) VALUES ('General')");
    }
  } catch (err) {
    console.error('Categories seeding failed', err);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS sub_categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      category_id INTEGER NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE(name, category_id)
    )
  `);

  // Heal orphaned subcategories: if a subcategory's category_id does not exist in categories table,
  // we try to associate it with the correct category.
  try {
    const orphaned = all(`
      SELECT sc.* FROM sub_categories sc 
      LEFT JOIN categories c ON sc.category_id = c.id 
      WHERE c.id IS NULL
    `);
    for (const sc of orphaned) {
      // Find products using this subcategory to see what category name they belong to
      const prod = get('SELECT category FROM products WHERE subcategory_id = ? LIMIT 1', [sc.id]);
      let targetCatId = null;
      if (prod && prod.category) {
        const cat = get('SELECT id FROM categories WHERE name = ?', [prod.category]);
        if (cat) targetCatId = cat.id;
      }
      
      // If no product is found, fall back to first category in database or General
      if (!targetCatId) {
        const firstCat = get("SELECT id FROM categories ORDER BY id LIMIT 1");
        if (firstCat) targetCatId = firstCat.id;
      }
      
      if (targetCatId) {
        console.log(`Healing subcategory "${sc.name}" (ID: ${sc.id}) by setting category_id to ${targetCatId}`);
        run('UPDATE sub_categories SET category_id = ? WHERE id = ?', [targetCatId, sc.id]);
      }
    }
  } catch (err) {
    console.error('Failed to heal subcategories:', err);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS brands (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  INTEGER NOT NULL,
      name        TEXT    NOT NULL,
      sku         TEXT    DEFAULT '',
      cost_price  REAL    NOT NULL DEFAULT 0,
      selling_price REAL  NOT NULL DEFAULT 0,
      stock_quantity REAL NOT NULL DEFAULT 0,
      min_stock_level REAL DEFAULT 0,
      max_stock_level REAL DEFAULT 0,
      attributes  TEXT    DEFAULT '{}', -- JSON string
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // Migration: Add min_stock_level and max_stock_level to product_variants if missing
  try {
    const res = db.exec('PRAGMA table_info(product_variants)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('min_stock_level')) {
        db.run('ALTER TABLE product_variants ADD COLUMN min_stock_level REAL DEFAULT 0');
      }
      if (!columns.includes('max_stock_level')) {
        db.run('ALTER TABLE product_variants ADD COLUMN max_stock_level REAL DEFAULT 0');
      }
    }
  } catch (err) {
    console.error('Failed to migrate product_variants:', err);
  }

  // Migration: Add total to invoice_items if missing (for existing users)
  try {
    const res = db.exec('PRAGMA table_info(invoice_items)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('total')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN total REAL NOT NULL DEFAULT 0');
      }
      if (!columns.includes('unit')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN unit TEXT DEFAULT "PCS"');
      }
      // Backorder Support
      if (!columns.includes('qty_requested')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN qty_requested REAL DEFAULT 0');
        // Backfill existing data
        db.run('UPDATE invoice_items SET qty_requested = quantity WHERE qty_requested IS NULL OR qty_requested = 0');
      }
      if (!columns.includes('qty_delivered')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN qty_delivered REAL DEFAULT 0');
        // Backfill existing data
        db.run('UPDATE invoice_items SET qty_delivered = quantity WHERE qty_delivered IS NULL OR qty_delivered = 0');
      }
      if (!columns.includes('delivery_status')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN delivery_status TEXT DEFAULT "Delivered"');
      }
      if (!columns.includes('pending_qty')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN pending_qty REAL DEFAULT 0');
        // Backfill pending_qty
        db.run('UPDATE invoice_items SET pending_qty = qty_requested - qty_delivered WHERE pending_qty IS NULL OR pending_qty = 0');
      }
      if (!columns.includes('is_free')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN is_free BOOLEAN DEFAULT 0');
      }
      if (!columns.includes('original_price')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN original_price REAL DEFAULT 0');
      }
      if (!columns.includes('promo_expense')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN promo_expense REAL DEFAULT 0');
      }
      if (!columns.includes('variant_id')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN variant_id INTEGER');
      }
      if (!columns.includes('variant_name')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN variant_name TEXT');
      }
      if (!columns.includes('item_gst_rate')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN item_gst_rate REAL DEFAULT 0');
      }
      if (!columns.includes('item_discount_rate')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN item_discount_rate REAL DEFAULT 0');
      }
    }
  } catch (err) { }

  // Migration: Add delivery_status, fulfillment_status, is_pending_product to invoices
  try {
    const res = db.exec('PRAGMA table_info(invoices)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('delivery_status')) {
        db.run('ALTER TABLE invoices ADD COLUMN delivery_status TEXT DEFAULT "Delivered"');
      }
      if (!columns.includes('fulfillment_status')) {
        db.run('ALTER TABLE invoices ADD COLUMN fulfillment_status TEXT DEFAULT "CONFIRMED"');
        // Backfill existing
        db.run("UPDATE invoices SET fulfillment_status = 'COMPLETED' WHERE delivery_status = 'Delivered'");
        db.run("UPDATE invoices SET fulfillment_status = 'PENDING_PRODUCT' WHERE delivery_status IN ('Pending', 'Partial')");
      }
      if (!columns.includes('is_pending_product')) {
        db.run('ALTER TABLE invoices ADD COLUMN is_pending_product INTEGER DEFAULT 0');
        db.run("UPDATE invoices SET is_pending_product = 1 WHERE delivery_status IN ('Pending', 'Partial')");
      }
    }
  } catch (err) { }

  // Migration: Add batch_id to invoice_items
  try {
    const res = db.exec('PRAGMA table_info(invoice_items)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('batch_id')) {
        db.run('ALTER TABLE invoice_items ADD COLUMN batch_id INTEGER DEFAULT NULL');
      }
    }
  } catch (err) { }
  // Migration: Add batch_id to invoice_returns
  try {
    const res = db.exec('PRAGMA table_info(invoice_returns)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('batch_id')) {
        db.run('ALTER TABLE invoice_returns ADD COLUMN batch_id INTEGER DEFAULT NULL');
      }
    }
  } catch (err) { }

  // Migration: Add invoice_item_id to invoice_returns (for precise variant tracking)
  try {
    const res = db.exec('PRAGMA table_info(invoice_returns)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('invoice_item_id')) {
        db.run('ALTER TABLE invoice_returns ADD COLUMN invoice_item_id INTEGER DEFAULT NULL');
      }
    }
  } catch (err) { }


  // Audit Logs Table
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id  INTEGER,
      action      TEXT    NOT NULL,
      details     TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `);

  // Purchase System Tables
  db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      phone       TEXT    NOT NULL DEFAULT '',
      gstin       TEXT    DEFAULT '',
      address     TEXT    NOT NULL DEFAULT '',
      opening_balance REAL NOT NULL DEFAULT 0,
      due_balance REAL NOT NULL DEFAULT 0,
      credit_balance REAL NOT NULL DEFAULT 0,
      notes       TEXT    DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS purchases (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      bill_number TEXT,
      purchase_date TEXT NOT NULL DEFAULT (date('now','localtime')),
      due_date    TEXT,
      subtotal    REAL NOT NULL DEFAULT 0,
      gst_total   REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      due_amount  REAL NOT NULL DEFAULT 0,
      discount_total REAL NOT NULL DEFAULT 0,
      status      TEXT NOT NULL DEFAULT 'Unpaid', -- Paid, Partial, Unpaid, Draft
      payment_mode TEXT DEFAULT 'Cash',
      is_draft    INTEGER DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id  INTEGER,
      product_name TEXT NOT NULL,
      hsn_code    TEXT,
      quantity    REAL NOT NULL DEFAULT 1,
      unit        TEXT DEFAULT 'PCS',
      purchase_price REAL NOT NULL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      cgst        REAL DEFAULT 0,
      sgst        REAL DEFAULT 0,
      igst        REAL DEFAULT 0,
      line_total  REAL NOT NULL DEFAULT 0,
      batch_id    INTEGER DEFAULT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS supplier_payments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      amount      REAL NOT NULL,
      payment_date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      payment_mode TEXT DEFAULT 'Cash',
      notes       TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_returns (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id  INTEGER NOT NULL,
      quantity    REAL NOT NULL,
      return_amount REAL NOT NULL,
      refund_method TEXT NOT NULL, -- Refund, Supplier Credit
      batch_id    INTEGER DEFAULT NULL,
      return_date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  // Migration: Add batch_id to purchase_items
  try {
    const res = db.exec('PRAGMA table_info(purchase_items)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('batch_id')) {
        db.run('ALTER TABLE purchase_items ADD COLUMN batch_id INTEGER DEFAULT NULL');
      }
    }
  } catch (err) { }
  // Migration: Add batch_id to purchase_returns
  try {
    const res = db.exec('PRAGMA table_info(purchase_returns)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('batch_id')) {
        db.run('ALTER TABLE purchase_returns ADD COLUMN batch_id INTEGER DEFAULT NULL');
      }
    }
  } catch (err) { }

  // Inventory System Extensions
  db.run(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  INTEGER NOT NULL,
      variant_id  INTEGER DEFAULT NULL,
      type        TEXT    NOT NULL, -- 'IN', 'OUT', 'ADJUSTMENT', 'RETURN'
      quantity    REAL    NOT NULL,
      reference_type TEXT, -- e.g., 'Invoice', 'Purchase', 'Manual', 'Return'
      reference_id INTEGER,
      date        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      batch_id    INTEGER DEFAULT NULL,
      notes       TEXT    DEFAULT '',
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS product_batches (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  INTEGER NOT NULL,
      variant_id  INTEGER DEFAULT NULL,
      batch_number TEXT   NOT NULL,
      expiry_date TEXT,
      purchase_id INTEGER,
      initial_quantity REAL NOT NULL DEFAULT 0,
      current_quantity REAL NOT NULL DEFAULT 0,
      cost_price  REAL    DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS product_serials (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id    INTEGER NOT NULL,
      serial_number TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'Available', -- 'Available', 'Sold', 'Returned_To_Supplier'
      purchase_id   INTEGER DEFAULT NULL,
      purchase_item_id INTEGER DEFAULT NULL,
      invoice_id    INTEGER DEFAULT NULL,
      invoice_item_id  INTEGER DEFAULT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
      FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE SET NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
      FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id) ON DELETE SET NULL,
      UNIQUE(product_id, serial_number)
    )
  `);

  // Expense System Tables
  db.run(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      amount      REAL    NOT NULL DEFAULT 0,
      date        TEXT    NOT NULL DEFAULT (date('now','localtime')),
      description TEXT,
      payment_mode TEXT   DEFAULT 'Cash',
      reference   TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS coupons (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      code                TEXT    NOT NULL UNIQUE,
      type                TEXT    NOT NULL,
      value               REAL    NOT NULL,
      expiry_date         TEXT,
      usage_limit_type    TEXT    NOT NULL DEFAULT 'unlimited',
      usage_limit         INTEGER DEFAULT NULL,
      times_used          INTEGER NOT NULL DEFAULT 0,
      reward_quantity     INTEGER DEFAULT 1,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  try {
    const res = db.exec("PRAGMA table_info(coupons)");
    if (res && res.length > 0) {
      const couponColumns = res[0].values.map(v => v[1]);
      if (!couponColumns.includes('reward_quantity')) {
        db.run('ALTER TABLE coupons ADD COLUMN reward_quantity INTEGER DEFAULT 1');
      }
    }
  } catch (err) {
    console.error('Coupons migration failed', err);
  }

  // Seed default expense categories if empty
  try {
    const expCatCount = get('SELECT COUNT(*) as count FROM expense_categories').count;
    if (expCatCount === 0) {
      const defaultExpCats = ['Rent', 'Utilities', 'Salary', 'Marketing', 'Repairs', 'Logistics', 'Others'];
      defaultExpCats.forEach(name => {
        db.run('INSERT OR IGNORE INTO expense_categories (name) VALUES (?)', [name]);
      });
    }
  } catch (err) {
    console.error('Expense categories seeding failed', err);
  }

  // Mazeway Orders Table
  db.run(`
    CREATE TABLE IF NOT EXISTS mazeway_orders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      mazeway_id  TEXT    UNIQUE,
      customer_name TEXT,
      customer_phone TEXT,
      items       TEXT, -- JSON string
      total       REAL,
      notes       TEXT,
      type        TEXT, -- 'Voice' or 'WhatsApp'
      status      TEXT    DEFAULT 'NEW', -- NEW, CONFIRMED, REJECTED
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  // Migration: Add duration_seconds column to mazeway_orders if missing
  try {
    const res = db.exec('PRAGMA table_info(mazeway_orders)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('duration_seconds')) {
        db.run('ALTER TABLE mazeway_orders ADD COLUMN duration_seconds INTEGER DEFAULT 0');
      }
    }
  } catch (err) {
    console.error('mazeway_orders duration_seconds column migration failed', err);
  }
  
  // Mazeway Persistent Agents Table
  db.run(`
    CREATE TABLE IF NOT EXISTS mazeway_agents (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL,
      persona     TEXT,
      status      TEXT DEFAULT 'PROVISIONING',
      is_active   BOOLEAN DEFAULT 1,
      config      TEXT, -- JSON string for SIP details
      created_at  TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // Gmail/Email Connections Table
  db.run(`
    CREATE TABLE IF NOT EXISTS email_connections (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      provider      TEXT DEFAULT 'gmail',
      email         TEXT UNIQUE NOT NULL,
      access_token  TEXT NOT NULL,
      refresh_token TEXT,
      expiry_date   INTEGER,
      status        TEXT DEFAULT 'Active',
      connected_at  TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // Email Campaigns Table
  db.run(`
    CREATE TABLE IF NOT EXISTS email_campaigns (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      customers     TEXT, -- JSON string array of customer IDs or emails
      start_date    TEXT,
      end_date      TEXT,
      time_to_send  TEXT,
      template      TEXT, -- 'invoice_minimalist', 'invoice_classic', 'order_confirmation', 'feedback', etc.
      status        TEXT DEFAULT 'scheduled', -- 'scheduled', 'sending', 'completed', 'cancelled'
      created_at    TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // Migration: Add channel column if missing in email_campaigns
  try {
    const res = db.exec('PRAGMA table_info(email_campaigns)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('channel')) {
        db.run("ALTER TABLE email_campaigns ADD COLUMN channel TEXT DEFAULT 'email'");
      }
    }
  } catch (err) {
    console.error('Email campaigns channel column migration failed', err);
  }

  // Migration: Add custom_content column if missing in email_campaigns
  try {
    const res = db.exec('PRAGMA table_info(email_campaigns)');
    if (res && res.length > 0) {
      const columns = res[0].values.map(v => v[1]);
      if (!columns.includes('custom_content')) {
        db.run("ALTER TABLE email_campaigns ADD COLUMN custom_content TEXT DEFAULT NULL");
      }
    }
  } catch (err) {
    console.error('Email campaigns custom_content column migration failed', err);
  }

  // Email Daily Usage Table
  db.run(`
    CREATE TABLE IF NOT EXISTS email_daily_usage (
      email         TEXT NOT NULL,
      date          TEXT NOT NULL,
      emails_sent   INTEGER DEFAULT 0,
      PRIMARY KEY (email, date)
    )
  `);

  // WhatsApp Connections Table
  db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_connections (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number_id TEXT UNIQUE NOT NULL,
      waba_id       TEXT,
      token         TEXT,
      status        TEXT DEFAULT 'Active',
      connected_at  TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // WhatsApp Daily Usage Table
  db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_daily_usage (
      phone_number_id TEXT NOT NULL,
      date            TEXT NOT NULL,
      messages_sent   INTEGER DEFAULT 0,
      PRIMARY KEY (phone_number_id, date)
    )
  `);

  // WhatsApp Customer Service Window (CSW) Session States Table
  db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      phone_number                    TEXT PRIMARY KEY,
      last_customer_message_timestamp INTEGER,
      csw_expiration_timestamp        INTEGER,
      conversation_state              TEXT
    )
  `);

  // Hosted Invoice Secure Tokens Table
  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_tokens (
      invoice_id INTEGER PRIMARY KEY,
      token TEXT NOT NULL,
      expires_at INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  persist();
  return db;
})();

// Helper: run a query that returns rows
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run a query that returns one row
function get(sql, params = []) {
  const rows = all(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: run a statement (INSERT/UPDATE/DELETE)
function run(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  // Return the last inserted row id when SQLite reports one.
  const lastId = get('SELECT last_insert_rowid() AS id');
  if (!inTransaction) persist();
  return { changes, lastInsertRowid: lastId ? lastId.id : 0 };
}


function transaction(cb) {
  if (inTransaction) {
    return cb();
  }

  inTransaction = true;
  try {
    // Start transaction manually to avoid the run() helper's persist() logic
    db.run('BEGIN TRANSACTION');
    
    try {
      cb();
      db.run('COMMIT');
    } catch (err) {
      // If cb() or COMMIT failed, try to rollback
      try {
        db.run('ROLLBACK');
      } catch (rollbackErr) {
        // Rollback might fail if the transaction was already closed by a database error
        console.warn('[Maze DB] Rollback skipped or failed:', rollbackErr.message);
      }
      throw err;
    }
  } catch (err) {
    // Re-throw the error to the caller (e.g., the route handler)
    throw err;
  } finally {
    inTransaction = false;
    // Always persist at the very end of the top-level transaction
    persist();
  }
}

module.exports = { ready, all, get, run, persist, transaction, dbDir };
