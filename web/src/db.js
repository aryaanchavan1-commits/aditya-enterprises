require('dotenv').config();
const fs = require('fs');
const path = require('path');

let turso = null;

const DATA_DIR = (process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/data' : path.join(__dirname, '..', 'data')));
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out')), ms)),
  ]);
}

async function getDb() {
  if (turso) return turso;
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL not configured');
  try {
    const { createClient } = require('@libsql/client');
    turso = createClient({ url, authToken: token });
    await withTimeout(turso.execute('SELECT 1'), 8000);
    await withTimeout(initSchema(), 20000);
    return turso;
  } catch (e) {
    turso = null;
    throw new Error('Turso connection failed: ' + e.message);
  }
}

async function initSchema() {
  if (!turso) return;
  const stmts = [
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
  for (const sql of stmts) {
    try { await turso.execute(sql); } catch (e) { console.warn('Schema create:', e.message); }
  }
  const migs = [
    { table: 'products', col: 'quantity', def: 'INTEGER DEFAULT 0' },
    { table: 'products', col: 'description', def: 'TEXT DEFAULT ""' },
    { table: 'products', col: 'hsn_code', def: 'TEXT DEFAULT ""' },
    { table: 'products', col: 'sell_price', def: 'REAL DEFAULT 0' },
    { table: 'products', col: 'inward_price', def: 'REAL DEFAULT 0' },
    { table: 'products', col: 'serial_number', def: 'TEXT' },
    { table: 'products', col: 'discount_percent', def: 'REAL DEFAULT 0' },
    { table: 'products', col: 'barcode', def: 'TEXT' },
    { table: 'products', col: 'barcode_image', def: 'TEXT DEFAULT ""' },
    { table: 'products', col: 'category_id', def: 'INTEGER' },
    { table: 'products', col: 'subcategory_id', def: 'INTEGER' },
    { table: 'products', col: 'gst_rate', def: 'REAL DEFAULT 18' },
    { table: 'products', col: 'supplier_id', def: 'INTEGER' },
    { table: 'products', col: 'updated_at', def: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
    { table: 'sales', col: 'customer_id', def: 'INTEGER' },
    { table: 'sales', col: 'customer_phone', def: 'TEXT DEFAULT ""' },
    { table: 'sales', col: 'customer_gstin', def: 'TEXT DEFAULT ""' },
    { table: 'sales', col: 'customer_address', def: 'TEXT DEFAULT ""' },
    { table: 'sales', col: 'discount_total', def: 'REAL DEFAULT 0' },
    { table: 'sales', col: 'cgst_total', def: 'REAL DEFAULT 0' },
    { table: 'sales', col: 'sgst_total', def: 'REAL DEFAULT 0' },
    { table: 'sales', col: 'igst_total', def: 'REAL DEFAULT 0' },
    { table: 'sales', col: 'cess_total', def: 'REAL DEFAULT 0' },
    { table: 'sales', col: 'payment_mode', def: 'TEXT DEFAULT "cash"' },
    { table: 'sales', col: 'is_barcode_scan', def: 'INTEGER DEFAULT 0' },
    { table: 'sales', col: 'notes', def: 'TEXT DEFAULT ""' },
    { table: 'purchases', col: 'supplier_id', def: 'INTEGER' },
    { table: 'purchases', col: 'notes', def: 'TEXT DEFAULT ""' },
  ];
  for (const m of migs) {
    try { await turso.execute(`ALTER TABLE ${m.table} ADD COLUMN ${m.col} ${m.def}`); } catch (e) {}
  }
  const idx = [
    'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)',
    'CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)',
    'CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(party_type)',
  ];
  for (const sql of idx) {
    try { await turso.execute(sql); } catch (e) {}
  }
  await seedIfEmpty();
}

async function seedIfEmpty() {
  try {
    const r = await turso.execute('SELECT COUNT(*) as c FROM categories');
    if (r.rows[0]?.c > 0) return;
    for (let i = 1; i <= 5; i++) {
      const ins = await turso.execute({ sql: 'INSERT INTO categories (name) VALUES (?)', args: [`Category ${i}`] });
      const catId = Number(ins.lastInsertRowid);
      for (let j = 1; j <= 3; j++) {
        await turso.execute({ sql: 'INSERT INTO subcategories (category_id, name) VALUES (?, ?)', args: [catId, `Sub ${i}.${j}`] });
      }
    }
    const defaults = [
      ['company_name', 'Aditya Enterprises'],
      ['company_gstin', '27AXXXXX1234Z1'],
      ['company_phone', '+91-9876543210'],
      ['invoice_prefix', 'AE/'],
      ['gst_rate', '18'],
      ['cgst_rate', '9'],
      ['sgst_rate', '9'],
      ['igst_rate', '18'],
      ['printer_type', 'thermal'],
      ['groq_model', 'llama-3.3-70b-versatile'],
      ['groq_api_key', ''],
    ];
    for (const [k, v] of defaults) {
      try { await turso.execute({ sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', args: [k, v] }); } catch (e) {}
    }
  } catch (e) { console.warn('Seed:', e.message); }
}

function toRows(result) {
  if (!result || !result.rows) return [];
  return result.rows.map(r => ({ ...r }));
}

async function query(sql, params = []) {
  const db = await getDb();
  const result = await db.execute({ sql, args: params });
  return result.rows || [];
}

async function run(sql, params = []) {
  const db = await getDb();
  const result = await db.execute({ sql, args: params });
  return { id: Number(result.lastInsertRowid) };
}

async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function all(sql, params = []) {
  return await query(sql, params);
}

module.exports = { getDb, query, run, get, all, dataDir: DATA_DIR };