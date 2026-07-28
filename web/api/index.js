require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb, seedIfEmpty } = require('../src/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DATA_DIR = (process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/data' : path.join(__dirname, '..', 'data')));
const uploadsDir = path.join(DATA_DIR, 'uploads');
const barcodesDir = path.join(DATA_DIR, 'barcodes');
const invoicesDir = path.join(DATA_DIR, 'invoices');
const aiUploadsDir = path.join(DATA_DIR, 'ai_uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) {}
try { fs.mkdirSync(barcodesDir, { recursive: true }); } catch (e) {}
try { fs.mkdirSync(invoicesDir, { recursive: true }); } catch (e) {}
try { fs.mkdirSync(aiUploadsDir, { recursive: true }); } catch (e) {}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Aditya Enterprises ERP Web', version: '2.0.0', time: new Date().toISOString() });
});

app.use('/data/uploads', express.static(uploadsDir));
app.use('/data/barcodes', express.static(barcodesDir));
app.use('/uploads', express.static(uploadsDir));
app.use('/barcodes', express.static(barcodesDir));
app.use('/invoices', express.static(invoicesDir));

app.use('/api/products', require('../src/routes/products'));
app.use('/api/categories', require('../src/routes/categories'));
app.use('/api/sales', require('../src/routes/sales'));
app.use('/api/barcode', require('../src/routes/barcode'));
app.use('/api/gst', require('../src/routes/gst'));
app.use('/api/ai', require('../src/routes/ai'));
app.use('/api/upload', require('../src/routes/upload'));
app.use('/api/settings', require('../src/routes/settings'));
app.use('/api/devices', require('../src/routes/devices'));
app.use('/api/reports', require('../src/routes/reports'));
app.use('/api/purchases', require('../src/routes/purchases'));

if (!process.env.VERCEL) {
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
    const db = await getDb();
    await seedIfEmpty(db);
    console.log('Database initialized');
  } catch (err) {
    console.error('Database init error:', err.message);
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n╔══════════════════════════════════════════════════════════╗`);
      console.log(`║   Aditya Enterprises ERP Web - Server Running           ║`);
      console.log(`║   URL: http://localhost:${PORT}                               ║`);
      console.log(`║   API: http://localhost:${PORT}/api/health                    ║`);
      console.log(`╚══════════════════════════════════════════════════════════╝\n`);
    });
  }
}

start().catch(err => { console.error('Failed to start:', err.message); });

module.exports = app;
