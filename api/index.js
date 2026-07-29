require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../src/db');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = !!process.env.VERCEL;
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || IS_VERCEL;

const ALLOWED_ORIGINS = [
  /\.vercel\.app$/,
  /\.onrender\.com$/,
  'http://localhost:3000',
  'http://localhost:5173',
];

app.use(cors({
  origin: IS_PRODUCTION ? (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = ALLOWED_ORIGINS.some(pattern =>
      typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
    );
    cb(null, allowed);
  } : '*',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (typeof BigInt !== 'undefined' && !BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function() { return Number(this); };
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

if (IS_PRODUCTION) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
  });
}

const DATA_DIR = (process.env.DATA_DIR || (IS_VERCEL ? '/tmp/data' : path.join(__dirname, '..', 'data')));
const uploadsDir = path.join(DATA_DIR, 'uploads');
const barcodesDir = path.join(DATA_DIR, 'barcodes');
const invoicesDir = path.join(DATA_DIR, 'invoices');
const aiUploadsDir = path.join(DATA_DIR, 'ai_uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) {}
try { fs.mkdirSync(barcodesDir, { recursive: true }); } catch (e) {}
try { fs.mkdirSync(invoicesDir, { recursive: true }); } catch (e) {}
try { fs.mkdirSync(aiUploadsDir, { recursive: true }); } catch (e) {}

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Aditya Enterprises ERP</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f0f2f5;color:#2c3e50;text-align:center}.card{background:#fff;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,.08)}.btn{display:inline-block;margin-top:16px;padding:10px 24px;background:#3498db;color:#fff;border-radius:6px;text-decoration:none}a{color:#3498db}</style></head><body><div class="card"><h2>Aditya Enterprises ERP</h2><p style="color:#7f8c8d">API Server is running</p><p style="font-size:13px">&#8226; <a href="/api/health">Health Check</a><br>&#8226; <a href="https://aditya-enterprises-erp.vercel.app">Open App (Vercel)</a></p></div></body></html>`);
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Aditya Enterprises ERP Web',
    version: '2.0.0',
    environment: IS_PRODUCTION ? 'production' : 'development',
    time: new Date().toISOString(),
  });
});

app.use('/data/uploads', express.static(uploadsDir));
app.use('/uploads', express.static(uploadsDir));
app.use('/invoices', express.static(invoicesDir));

// Dynamic barcode image serving — regenerates on-the-fly if file missing (Render's FS is ephemeral)
const bwipjs = require('bwip-js');
function serveBarcode(req, res, next) {
  const fileName = path.basename(req.path);
  const filePath = path.join(barcodesDir, fileName);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  const code = fileName.replace(/\.png$/i, '');
  if (!code) return next();
  bwipjs.toBuffer({ bcid: 'code128', text: code, scale: 3, height: 10, includetext: true, textxalign: 'center' }, (err, png) => {
    if (err) { console.error('Barcode regen failed:', err.message); return next(); }
    try { fs.mkdirSync(barcodesDir, { recursive: true }); fs.writeFileSync(filePath, png); } catch (e) {}
    res.set('Content-Type', 'image/png');
    res.send(png);
  });
}
app.use('/data/barcodes', serveBarcode);
app.use('/barcodes', serveBarcode);

app.use('/api/products', require('../src/routes/products'));
app.use('/api/categories', require('../src/routes/categories'));
app.use('/api/sales', require('../src/routes/sales'));
app.use('/api/barcode', require('../src/routes/barcode'));
app.use('/api/gst', require('../src/routes/gst'));
app.use('/api/ai', require('../src/routes/ai'));
app.use('/api/upload', require('../src/routes/upload'));
app.use('/api/settings', require('../src/routes/settings'));
app.use('/api/devices', require('../src/routes/devices'));
app.use('/api/parties', require('../src/routes/parties'));
app.use('/api/reports', require('../src/routes/reports'));
app.use('/api/purchases', require('../src/routes/purchases'));
app.use('/api/crm', require('../src/routes/crm'));
app.use('/api/services', require('../src/routes/services'));
app.use('/api/accounting', require('../src/routes/accounting'));
app.use('/api/brands', require('../src/routes/brands'));

const { get, all, run } = require('../src/db');

function ok(res, data) { res.json(data !== undefined ? { success: true, data } : { success: true }); }
function fail(res, error) { res.json({ success: false, error }); }

app.get('/api/category', async (req, res) => {
  try {
    if (!req.query.id) { fail(res, 'id query param required'); return; }
    const cat = await get('SELECT * FROM categories WHERE id = ?', [req.query.id]);
    if (!cat) { fail(res, 'Not found'); return; }
    const subs = await all('SELECT * FROM subcategories WHERE category_id = ? ORDER BY id', [cat.id]);
    const prods = await all('SELECT * FROM products WHERE category_id = ?', [cat.id]);
    ok(res, { ...cat, subcategories: subs, products: prods });
  } catch (err) { fail(res, err.message); }
});

app.put('/api/category', async (req, res) => {
  try { await run('UPDATE categories SET name = ? WHERE id = ?', [req.body.name, req.query.id]); ok(res); }
  catch (err) { fail(res, err.message); }
});

app.delete('/api/category', async (req, res) => {
  try {
    const id = req.query.id;
    await run('DELETE FROM subcategories WHERE category_id = ?', [id]);
    await run('UPDATE products SET category_id = NULL, subcategory_id = NULL WHERE category_id = ?', [id]);
    await run('DELETE FROM categories WHERE id = ?', [id]);
    ok(res);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/subcategory', async (req, res) => {
  try {
    const r = await run('INSERT INTO subcategories (category_id, name) VALUES (?, ?)', [req.query.catId, req.body.name]);
    ok(res, { id: r.id, category_id: parseInt(req.query.catId), name: req.body.name });
  } catch (err) { fail(res, err.message); }
});

app.put('/api/subcategory', async (req, res) => {
  try { await run('UPDATE subcategories SET name = ? WHERE id = ? AND category_id = ?', [req.body.name, req.query.subId, req.query.catId]); ok(res); }
  catch (err) { fail(res, err.message); }
});

app.delete('/api/subcategory', async (req, res) => {
  try { await run('DELETE FROM subcategories WHERE id = ? AND category_id = ?', [req.query.subId, req.query.catId]); ok(res); }
  catch (err) { fail(res, err.message); }
});

app.get('/api/status', async (req, res) => {
  let dbOk = false;
  let dbError = null;
  try {
    const db = require('../src/db');
    await db.getDb();
    dbOk = true;
  } catch (e) { dbError = e.message; }
  res.json({
    success: true,
    data: {
      server: 'ok',
      database: dbOk ? 'turso' : 'error',
      db_connected: dbOk,
      db_error: dbError,
      environment: IS_PRODUCTION ? 'production' : 'development',
    },
  });
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.json({ success: false, error: `API route not found: ${req.method} ${req.originalUrl}` });
  }
  next();
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.json({
    success: false,
    error: IS_PRODUCTION ? 'Internal server error' : err.message,
  });
});

if (!IS_VERCEL) {
  const clientBuild = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(clientBuild)) {
    app.use(express.static(clientBuild));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(clientBuild, 'index.html'));
      }
    });
  }
}

async function start() {
  try {
    await getDb();
    console.log('Database connected');
  } catch (err) {
    console.error('Database init error:', err.message);
  }

  if (!IS_VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Aditya Enterprises ERP Web running on http://localhost:${PORT}`);
    });

    // Keep-alive every 10 min — prevents Render free-tier spin-down after 15min inactivity
    const https = require('https');
    const KEEP_URLS = [
      process.env.RENDER_EXTERNAL_URL,
      'https://aditya-enterprises-erp.vercel.app',
    ].filter(Boolean);
    function ping(url) {
      https.get(`${url.replace(/\/+$/,'')}/api/health`, r => { r.resume(); }).on('error', () => {});
    }
    setInterval(() => { KEEP_URLS.forEach(ping); }, 10 * 60 * 1000);
  }
}

start().catch(err => { console.error('Failed to start:', err.message); });

module.exports = app;
