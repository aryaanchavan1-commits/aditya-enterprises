require('dotenv').config();
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let turso = null;
let localDb = null;
let localSQL = null;

const DATA_DIR = (process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/data' : path.join(__dirname, '..', 'data')));
const DB_PATH = path.join(DATA_DIR, 'aditya_erp.db');
const ENABLE_LOCAL = process.env.ENABLE_LOCAL_FALLBACK !== 'false';

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {
  console.warn('Could not create DATA_DIR, using /tmp:', e.message);
  try { const tmpDir = '/tmp/aditya-erp-data'; fs.mkdirSync(tmpDir, { recursive: true }); process.env.DATA_DIR = tmpDir; } catch (e2) {}
}

async function getTurso() {
  if (turso) return turso;
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url) return null;
  try {
    const { createClient } = require('@libsql/client');
    turso = createClient({ url, authToken: token });
    await turso.execute('SELECT 1');
    await initTursoSchema();
    return turso;
  } catch (e) {
    console.warn('Turso connection failed:', e.message);
    return null;
  }
}

async function initTursoSchema() {
  if (!turso) return;
  const tables = ['categories', 'subcategories', 'products', 'parties', 'sales', 'purchases', 'stock_movements', 'ai_conversations', 'settings'];
  const createStmts = [
    `CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, is_editable INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS subcategories (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, image TEXT DEFAULT '', quantity INTEGER DEFAULT 0, description TEXT DEFAULT '', hsn_code TEXT DEFAULT '', sell_price REAL DEFAULT 0, inward_price REAL DEFAULT 0, serial_number TEXT UNIQUE, discount_percent REAL DEFAULT 0, barcode TEXT UNIQUE, barcode_image TEXT DEFAULT '', category_id INTEGER, subcategory_id INTEGER, gst_rate REAL DEFAULT 18, supplier_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS parties (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, party_type TEXT DEFAULT 'customer', phone TEXT DEFAULT '', email TEXT DEFAULT '', gstin TEXT DEFAULT '', address TEXT DEFAULT '', city TEXT DEFAULT '', state TEXT DEFAULT '', pincode TEXT DEFAULT '', opening_balance REAL DEFAULT 0, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT UNIQUE NOT NULL, sale_date TEXT NOT NULL, customer_id INTEGER, customer_name TEXT DEFAULT 'Walk-in Customer', customer_phone TEXT DEFAULT '', customer_gstin TEXT DEFAULT '', customer_address TEXT DEFAULT '', items TEXT NOT NULL, subtotal REAL DEFAULT 0, discount_total REAL DEFAULT 0, cgst_total REAL DEFAULT 0, sgst_total REAL DEFAULT 0, igst_total REAL DEFAULT 0, cess_total REAL DEFAULT 0, grand_total REAL DEFAULT 0, payment_mode TEXT DEFAULT 'cash', is_barcode_scan INTEGER DEFAULT 0, notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT UNIQUE NOT NULL, purchase_date TEXT NOT NULL, supplier_id INTEGER, supplier_name TEXT DEFAULT '', items TEXT NOT NULL, subtotal REAL DEFAULT 0, gst_total REAL DEFAULT 0, grand_total REAL DEFAULT 0, payment_status TEXT DEFAULT 'paid', notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS stock_movements (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, type TEXT, quantity_change INTEGER, reference TEXT, notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS ai_conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
  ];
  for (const sql of createStmts) {
    try { await turso.execute(sql); } catch (e) { console.warn('Schema create:', e.message); }
  }

  const productColumns = ['quantity', 'description', 'hsn_code', 'sell_price', 'inward_price', 'serial_number', 'discount_percent', 'barcode', 'barcode_image', 'category_id', 'subcategory_id', 'gst_rate', 'supplier_id', 'updated_at'];
  for (const col of productColumns) {
    try { await turso.execute(`ALTER TABLE products ADD COLUMN ${col} TEXT DEFAULT ''`); } catch (e) {}
  }
  const saleColumns = ['customer_id', 'customer_phone', 'customer_gstin', 'customer_address', 'discount_total', 'cgst_total', 'sgst_total', 'igst_total', 'cess_total', 'payment_mode', 'is_barcode_scan', 'notes'];
  for (const col of saleColumns) {
    try { await turso.execute(`ALTER TABLE sales ADD COLUMN ${col} TEXT DEFAULT ''`); } catch (e) {}
  }
  const purchaseColumns = ['supplier_id', 'notes'];
  for (const col of purchaseColumns) {
    try { await turso.execute(`ALTER TABLE purchases ADD COLUMN ${col} TEXT DEFAULT ''`); } catch (e) {}
  }

  const idxStmts = [
    `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)`,
    `CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)`,
    `CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(party_type)`,
  ];
  for (const sql of idxStmts) {
    try { await turso.execute(sql); } catch (e) { console.warn('Index:', e.message); }
  }
}

async function getLocalDb() {
  if (localDb) return localDb;
  if (!ENABLE_LOCAL) return null;
  const SQL = await initSqlJs();
  localSQL = SQL;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    localDb = new SQL.Database(buffer);
  } else {
    localDb = new SQL.Database();
  }
  localDb.run('PRAGMA journal_mode=WAL');
  localDb.run('PRAGMA foreign_keys=ON');
  initSchema(localDb);
  saveLocalDb();
  return localDb;
}

function initSchema(db) {
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    is_editable INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL,
    name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    image TEXT DEFAULT '', quantity INTEGER DEFAULT 0,
    description TEXT DEFAULT '', hsn_code TEXT DEFAULT '',
    sell_price REAL DEFAULT 0, inward_price REAL DEFAULT 0,
    serial_number TEXT UNIQUE, discount_percent REAL DEFAULT 0,
    barcode TEXT UNIQUE, barcode_image TEXT DEFAULT '',
    category_id INTEGER, subcategory_id INTEGER,
    gst_rate REAL DEFAULT 18, supplier_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    party_type TEXT DEFAULT 'customer', phone TEXT DEFAULT '',
    email TEXT DEFAULT '', gstin TEXT DEFAULT '',
    address TEXT DEFAULT '', city TEXT DEFAULT '', state TEXT DEFAULT '',
    pincode TEXT DEFAULT '', opening_balance REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT UNIQUE NOT NULL,
    sale_date TEXT NOT NULL, customer_id INTEGER,
    customer_name TEXT DEFAULT 'Walk-in Customer',
    customer_phone TEXT DEFAULT '', customer_gstin TEXT DEFAULT '',
    customer_address TEXT DEFAULT '', items TEXT NOT NULL,
    subtotal REAL DEFAULT 0, discount_total REAL DEFAULT 0,
    cgst_total REAL DEFAULT 0, sgst_total REAL DEFAULT 0,
    igst_total REAL DEFAULT 0, cess_total REAL DEFAULT 0,
    grand_total REAL DEFAULT 0, payment_mode TEXT DEFAULT 'cash',
    is_barcode_scan INTEGER DEFAULT 0, notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT UNIQUE NOT NULL,
    purchase_date TEXT NOT NULL, supplier_id INTEGER,
    supplier_name TEXT DEFAULT '', items TEXT NOT NULL,
    subtotal REAL DEFAULT 0, gst_total REAL DEFAULT 0,
    grand_total REAL DEFAULT 0, payment_status TEXT DEFAULT 'paid',
    notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER,
    type TEXT, quantity_change INTEGER, reference TEXT,
    notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS ai_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT,
    content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(party_type)');
}

function saveLocalDb() {
  if (!localDb) return;
  const data = localDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function seedIfEmpty(db) {
  const catCount = db.exec('SELECT COUNT(*) as c FROM categories');
  const count = catCount.length > 0 ? catCount[0].values[0][0] : 0;
  if (count === 0) {
    for (let i = 1; i <= 10; i++) {
      db.run('INSERT INTO categories (name) VALUES (?)', [`Category ${i}`]);
      const catId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      for (let j = 1; j <= 6; j++) {
        db.run('INSERT INTO subcategories (category_id, name) VALUES (?, ?)', [catId, `Subcategory ${i}.${j}`]);
      }
    }
    const settingsSeed = [
      ['company_name', 'Aditya Enterprises'], ['company_address', 'Shop No. 5, Main Market, City'],
      ['company_gstin', '27AXXXXX1234Z1'], ['company_phone', '+91-9876543210'],
      ['company_email', 'aditya@email.com'], ['company_pan', 'ABCDE1234F'],
      ['invoice_prefix', 'AE/'], ['gst_rate', '18'], ['cgst_rate', '9'],
      ['sgst_rate', '9'], ['igst_rate', '18'], ['printer_type', 'thermal'],
      ['printer_port', 'USB001'], ['scanner_mode', 'keyboard_wedge'],
      ['groq_api_key', ''], ['groq_model', 'llama-3.3-70b-versatile'],
    ];
    for (const [k, v] of settingsSeed) {
      db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [k, v]);
    }
    saveLocalDb();
  }
}

function toRows(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

async function query(sql, params = []) {
  const db = await getTurso();
  if (db) {
    try {
      const result = await db.execute({ sql, args: params });
      return result.rows || [];
    } catch (e) { console.warn('Turso query failed, falling back:', e.message); }
  }
  const local = await getLocalDb();
  if (!local) throw new Error('No database available');
  const stmt = local.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function run(sql, params = []) {
  const db = await getTurso();
  let tursoId = null;
  if (db) {
    try {
      const result = await db.execute({ sql, args: params });
      tursoId = Number(result.lastInsertRowid);
    } catch (e) { console.warn('Turso write failed, falling back:', e.message); }
  }
  const local = await getLocalDb();
  if (!local) throw new Error('No database available');
  local.run(sql, params);
  const res = local.exec('SELECT last_insert_rowid()');
  const localId = (res.length > 0 && res[0].values.length > 0) ? res[0].values[0][0] : 0;
  saveLocalDb();
  return { id: tursoId || localId, tursoId, localId };
}

async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function all(sql, params = []) {
  return await query(sql, params);
}

module.exports = { getTurso, getLocalDb, getDb: getLocalDb, query, run, get, all, initSchema, seedIfEmpty, dataDir: DATA_DIR };
