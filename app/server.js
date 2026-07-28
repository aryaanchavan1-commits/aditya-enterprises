const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const uploadsDir = path.join(__dirname, 'data', 'uploads');
const barcodesDir = path.join(__dirname, 'data', 'barcodes');
const invoicesDir = path.join(__dirname, 'data', 'invoices');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(barcodesDir, { recursive: true });
fs.mkdirSync(invoicesDir, { recursive: true });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Aditya Enterprises ERP', version: '2.0.0', time: new Date().toISOString() });
});

app.use('/data/uploads', express.static(uploadsDir));
app.use('/data/barcodes', express.static(barcodesDir));
app.use('/invoices', express.static(invoicesDir));
app.use('/uploads', express.static(uploadsDir));
app.use('/barcodes', express.static(barcodesDir));

async function start() {
  await getDb();

  app.use('/api/products', require('./routes/products'));
  app.use('/api/categories', require('./routes/categories'));
  app.use('/api/sales', require('./routes/sales'));
  app.use('/api/barcode', require('./routes/barcode'));
  app.use('/api/gst', require('./routes/gst'));
  app.use('/api/ai', require('./routes/ai'));
  app.use('/api/upload', require('./routes/upload'));
  app.use('/api/settings', require('./routes/settings'));
  app.use('/api/devices', require('./routes/devices'));
  app.use('/api/reports', require('./routes/reports'));

  const clientBuild = path.join(__dirname, 'client', 'dist');
  if (fs.existsSync(clientBuild)) {
    app.use(express.static(clientBuild));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientBuild, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔══════════════════════════════════════════════════════════╗`);
    console.log(`║   Aditya Enterprises ERP Suite 2026 - Server Running     ║`);
    console.log(`║   URL: http://localhost:${PORT}                               ║`);
    console.log(`║   API: http://localhost:${PORT}/api/health                    ║`);
    console.log(`╚══════════════════════════════════════════════════════════╝\n`);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
