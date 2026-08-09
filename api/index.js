require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { get, all, run, getDb } = require('../src/db');

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

// ---------------- Auth ----------------
// The whole API is protected by a password (hash). Source: env AE_PASSWORD,
// else the admin_password setting (set from Settings → Admin Password).
// The local print bridge polls its job queue without credentials, so the
// device endpoints are exempt. Everything else (data, settings, PDFs,
// reports, uploads) requires the password once one is configured.

const sha = s => crypto.createHash('sha256').update(String(s || '')).digest('hex');
const shaEquals = (a, b) => {
  try {
    const ba = Buffer.from(String(a)); const bb = Buffer.from(String(b));
    if (ba.length !== bb.length) return false;
    let d = 0;
    for (let i = 0; i < ba.length; i++) d |= ba[i] ^ bb[i];
    return d === 0;
  } catch (e) { return false; }
};

async function getAuthPassword() {
  if (process.env.AE_PASSWORD) return { hash: sha(process.env.AE_PASSWORD), fromEnv: true };
  try {
    const row = await get("SELECT value FROM settings WHERE key = 'admin_password'");
    if (row && row.value) return { hash: row.value, fromEnv: false };
  } catch (e) {}
  return null;
}

const PUBLIC_API = ['/health', '/auth/status', '/auth/login', '/auth/password'];

app.use('/api', async (req, res, next) => {
  try {
    if (PUBLIC_API.includes(req.path)) return next();
    if (req.path.startsWith('/devices/print/')) return next(); // local bridge - no credentials
    const auth = await getAuthPassword();
    if (!auth) return next(); // no password configured yet - data is open
    const provided = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (shaEquals(sha(provided), auth.hash)) return next();
    res.status(401).json({ success: false, error: 'Unauthorized - enter the admin password to continue.' });
  } catch (e) {
    next();
  }
});

app.get('/api/auth/status', async (req, res) => {
  const auth = await getAuthPassword();
  res.json({ success: true, data: { protected: !!auth } });
});

app.post('/api/auth/login', async (req, res) => {
  const auth = await getAuthPassword();
  if (!auth) return res.json({ success: true, data: { ok: true } }); // open - nothing to check
  if (shaEquals(sha(req.body?.password), auth.hash)) return res.json({ success: true, data: { ok: true } });
  res.status(401).json({ success: false, error: 'Wrong password' });
});

app.post('/api/auth/password', async (req, res) => {
  const pw = String(req.body?.password || '');
  if (pw.length < 4) return res.json({ success: false, error: 'Password must be at least 4 characters' });
  const auth = await getAuthPassword();
  if (auth) { // already protected - changing requires the current password
    const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!shaEquals(sha(given), auth.hash)) return res.status(401).json({ success: false, error: 'Enter the current password first' });
  }
  await run("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', ?)", [sha(pw)]);
  res.json({ success: true, message: 'Password saved - data is now protected' });
});

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

// Memory/disk hygiene: Render's filesystem is ephemeral and limited - prune
// generated files (barcodes regenerate on demand) and stale uploads daily.
function pruneDir(dir, maxAgeMs) {
  try {
    if (!fs.existsSync(dir)) return;
    const now = Date.now();
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      try {
        if (fs.statSync(p).isFile() && now - fs.statSync(p).mtimeMs > maxAgeMs) fs.unlinkSync(p);
      } catch (e) {}
    }
  } catch (e) {}
}
function pruneTmpData() {
  pruneDir(barcodesDir, 7 * 24 * 3600 * 1000);
  pruneDir(uploadsDir, 30 * 24 * 3600 * 1000);
  pruneDir(invoicesDir, 30 * 24 * 3600 * 1000);
  pruneDir(aiUploadsDir, 30 * 24 * 3600 * 1000);
}
setInterval(pruneTmpData, 24 * 3600 * 1000);
setTimeout(pruneTmpData, 10 * 60 * 1000);

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
  bwipjs.toBuffer({ bcid: 'code128', text: code, scale: 3, height: 10, includetext: true, textxalign: 'center', backgroundcolor: 'FFFFFF' }, (err, png) => {
    if (err) { console.error('Barcode regen failed:', err.message); return next(); }
    try { fs.mkdirSync(barcodesDir, { recursive: true }); fs.writeFileSync(filePath, png); } catch (e) {}
    res.set('Content-Type', 'image/png');
    res.send(png);
  });
}
app.use('/data/barcodes', serveBarcode);
app.use('/barcodes', serveBarcode);

app.use('/api/products', require('../src/routes/products'));
app.use('/api/dashboard', require('../src/routes/dashboard'));
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

    // Keep-alive every 10 min - prevents Render free-tier spin-down after 15min inactivity.
    // Pings Render directly (via RENDER_EXTERNAL_URL if available) plus the Vercel frontend
    // (whose /api rewrite reaches Render too). The GitHub Actions cron is the primary guard.
    const https = require('https');
    const KEEP_URLS = [
      process.env.RENDER_EXTERNAL_URL || 'https://aditya-enterprises-umgw.onrender.com',
      'https://aditya-enterprises-erp.vercel.app',
    ];
    function ping(url) {
      https.get(`${url.replace(/\/+$/, '')}/api/health`, r => { r.resume(); }).on('error', () => {});
    }
    setInterval(() => { KEEP_URLS.forEach(ping); }, 10 * 60 * 1000);
  }
}

start().catch(err => { console.error('Failed to start:', err.message); });

module.exports = app;
