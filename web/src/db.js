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
  const allCols = [
    { table: 'products', cols: ['name', 'image', 'quantity', 'description', 'hsn_code', 'sell_price', 'inward_price', 'serial_number', 'discount_percent', 'barcode', 'barcode_image', 'category_id', 'subcategory_id', 'gst_rate', 'supplier_id', 'created_at', 'updated_at'] },
    { table: 'sales', cols: ['invoice_number', 'sale_date', 'customer_id', 'customer_name', 'customer_phone', 'customer_gstin', 'customer_address', 'items', 'subtotal', 'discount_total', 'cgst_total', 'sgst_total', 'igst_total', 'cess_total', 'grand_total', 'payment_mode', 'is_barcode_scan', 'notes', 'created_at'] },
    { table: 'purchases', cols: ['invoice_number', 'purchase_date', 'supplier_id', 'supplier_name', 'items', 'subtotal', 'gst_total', 'grand_total', 'payment_status', 'notes', 'created_at'] },
    { table: 'parties', cols: ['name', 'party_type', 'phone', 'email', 'gstin', 'address', 'city', 'state', 'pincode', 'opening_balance', 'is_active', 'created_at'] },
    { table: 'stock_movements', cols: ['product_id', 'type', 'quantity_change', 'reference', 'notes', 'created_at'] },
    { table: 'ai_conversations', cols: ['role', 'content', 'created_at'] },
    { table: 'categories', cols: ['name', 'is_editable', 'created_at'] },
    { table: 'subcategories', cols: ['category_id', 'name', 'created_at'] },
    { table: 'settings', cols: ['value'] },
  ];
  const migs = [];
  for (const t of allCols) {
    for (const col of t.cols) {
      let def = 'TEXT DEFAULT ""';
      if (['id', 'quantity', 'category_id', 'subcategory_id', 'supplier_id', 'customer_id', 'product_id', 'is_editable', 'is_active', 'is_barcode_scan'].includes(col)) def = 'INTEGER DEFAULT 0';
      if (['sell_price', 'inward_price', 'discount_percent', 'gst_rate', 'subtotal', 'discount_total', 'cgst_total', 'sgst_total', 'igst_total', 'cess_total', 'grand_total', 'gst_total', 'opening_balance'].includes(col)) def = 'REAL DEFAULT 0';
      if (['serial_number', 'barcode'].includes(col)) def = 'TEXT';
      if (['name', 'invoice_number'].includes(col)) def = 'TEXT DEFAULT ""';
      if (['sale_date', 'purchase_date', 'created_at', 'updated_at'].includes(col)) def = 'DATETIME DEFAULT CURRENT_TIMESTAMP';
      migs.push({ table: t.table, col, def });
    }
  }
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
  await migrateLegacyData();
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

function cleanValue(val) {
  if (typeof val !== 'string') return val;
  let parsed = val;
  for (let i = 0; i < 10; i++) {
    try {
      const obj = JSON.parse(parsed);
      if (obj && typeof obj === 'object' && 'value' in obj) {
        parsed = obj.value;
      } else {
        break;
      }
    } catch (e) {
      break;
    }
  }
  if (typeof parsed === 'string' && parsed !== val) return cleanValue(parsed);
  return parsed;
}

function cleanRow(row) {
  if (!row || typeof row !== 'object') return row;
  const clean = {};
  for (const [k, v] of Object.entries(row)) {
    clean[k] = cleanValue(v);
  }
  return clean;
}

async function migrateLegacyData() {
  try {
    const r = await turso.execute("SELECT id, name, description, hsn_code, serial_number, barcode, image, barcode_image FROM products WHERE name LIKE '{%' LIMIT 1");
    if (r.rows.length === 0) return;
    const allProducts = await turso.execute('SELECT id, name, description, hsn_code, serial_number, barcode, image, barcode_image FROM products');
    for (const row of allProducts.rows) {
      const updates = [];
      const params = [];
      for (const col of ['name', 'description', 'hsn_code', 'serial_number', 'barcode', 'image', 'barcode_image']) {
        const cleaned = cleanValue(row[col]);
        if (cleaned !== row[col]) {
          updates.push(`${col} = ?`);
          params.push(cleaned);
        }
      }
      if (updates.length > 0) {
        params.push(row.id);
        await turso.execute({ sql: `UPDATE products SET ${updates.join(', ')} WHERE id = ?`, args: params });
      }
    }
    const allSettings = await turso.execute('SELECT key, value FROM settings');
    for (const row of allSettings.rows) {
      const cleaned = cleanValue(row.value);
      if (cleaned !== row.value) {
        await turso.execute({ sql: 'UPDATE settings SET value = ? WHERE key = ?', args: [cleaned, row.key] });
      }
    }
  } catch (e) { console.warn('Legacy migration:', e.message); }
}

module.exports = { getDb, query, run, get, all, dataDir: DATA_DIR, cleanRow, cleanValue };