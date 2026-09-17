const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const { generateInvoiceNumber } = require('./invoiceUtils');
const bwipjs = require('bwip-js');
const path = require('path');
const fs = require('fs');

// Normalize a scanned/typed code so it matches what we stored:
// trim whitespace, strip AIM identifiers (e.g. "]C1" GS1 prefix) and any
// characters that scanners may decorate the code with.
function cleanCode(code) {
  return String(code || '')
    .trim()
    .replace(/^\]\w\d/, '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim();
}

// Safe filename version of a barcode (no path separators / traversal).
function safeCode(code) {
  return String(code || '').replace(/[^A-Za-z0-9.\-_]/g, '');
}

// ── UPC-A helpers ──────────────────────────────────────────────────

// UPC-A check digit: 11 data digits → 1 check digit (0-9).
function upcaCheckDigit(digits11) {
  const d = String(digits11).split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += d[i] * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

// Generate a random 12-digit UPC-A code (number system 0).
function randomUpca() {
  let d = '0';
  for (let i = 0; i < 10; i++) d += Math.floor(Math.random() * 10);
  d += upcaCheckDigit(d);
  return d;
}

// Check if a string is a valid 12-digit UPC-A code.
function isUpca(code) {
  const s = String(code || '');
  if (!/^\d{12}$/.test(s)) return false;
  return Number(s[11]) === upcaCheckDigit(s.slice(0, 11));
}

// Generate a unique UPC-A code that doesn't collide with any existing product.
// Retries up to 50 times — with 900 million possible codes, collision is
// essentially impossible but we guard against it anyway.
async function uniqueUpca(excludeId) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = randomUpca();
    const dup = await get('SELECT id FROM products WHERE barcode = ? AND id != ?', [code, excludeId || 0]);
    if (!dup) return code;
  }
  throw new Error('Could not generate unique UPC-A barcode after 50 attempts');
}

// Generate a UPC-A barcode PNG via bwip-js.
async function generateUpcaPng(code) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      { bcid: 'upca', text: code, scale: 4, height: 15, includetext: true, textxalign: 'center', backgroundcolor: 'FFFFFF' },
      (err, buf) => err ? reject(err) : resolve(buf)
    );
  });
}

// Write barcode PNG to disk, return the web path.
function saveBarcodePng(code, png) {
  const barcodesDir = path.join(require('../db').dataDir, 'barcodes');
  fs.mkdirSync(barcodesDir, { recursive: true });
  fs.writeFileSync(path.join(barcodesDir, `${code}.png`), png);
  return `/data/barcodes/${code}.png`;
}

// ── Lookup ─────────────────────────────────────────────────────────

// Lookup by barcode OR serial, case-insensitive, whitespace-tolerant.
async function findProductByCode(code) {
  const clean = cleanCode(code);
  if (!clean) return null;
  return get('SELECT * FROM products WHERE TRIM(barcode) = ? COLLATE NOCASE OR TRIM(serial_number) = ? COLLATE NOCASE', [clean, clean]);
}

router.get('/scan/:code', async (req, res) => {
  try {
    const product = await findProductByCode(req.params.code);
    if (!product) { res.json({ success: false, error: 'Product not found for: ' + cleanCode(req.params.code) }); return; }
    res.json({ success: true, data: product });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// Add stock to an existing product found by scanning its barcode/serial.
router.post('/stock-in', async (req, res) => {
  try {
    const { barcode, quantity } = req.body;
    const qty = Math.max(1, Number(quantity) || 1);
    const product = await findProductByCode(barcode);
    if (!product) { res.json({ success: false, error: 'Product not found' }); return; }
    await run('UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [qty, product.id]);
    await run('INSERT INTO stock_movements (product_id, type, quantity_change, reference) VALUES (?, ?, ?, ?)', [product.id, 'stock_in', qty, 'SCAN-IN-' + Date.now()]);
    const updated = await get('SELECT * FROM products WHERE id = ?', [product.id]);
    res.json({ success: true, data: updated, message: `Added ${qty} to ${product.name}. New stock: ${updated.quantity}` });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/scan-sale', async (req, res) => {
  try {
    const { barcode, quantity } = req.body;
    const qty = quantity || 1;
    const product = await findProductByCode(barcode);
    if (!product) { res.json({ success: false, error: 'Product not found' }); return; }
    if (product.quantity < qty) { res.json({ success: false, error: `Only ${product.quantity} left in stock` }); return; }
    const invoiceNum = await generateInvoiceNumber();
    const saleDate = new Date().toISOString().split('T')[0];
    const lineTotal = product.sell_price * qty;
    const discountAmt = lineTotal * ((product.discount_percent || 0) / 100);
    const afterDiscount = lineTotal - discountAmt;
    const settings = {};
    (await all('SELECT * FROM settings')).forEach(s => settings[s.key] = s.value);
    const gstRate = Number(settings['gst_rate']) || 18;
    const halfRate = gstRate / 2;
    const cgst = afterDiscount * (halfRate / 100);
    const sgst = afterDiscount * (halfRate / 100);
    const grandTotal = afterDiscount + cgst + sgst;
    const items = [{ product_id: product.id, product_name: product.name, hsn_code: product.hsn_code, quantity: qty, sell_price: product.sell_price, discount_percent: product.discount_percent }];

    await run(`INSERT INTO sales (invoice_number, sale_date, customer_name, items, subtotal, discount_total, cgst_total, sgst_total, grand_total, payment_mode, is_barcode_scan, is_gst, gst_rate) VALUES (?, ?, 'Walk-in Customer', ?, ?, ?, ?, ?, ?, 'cash', 1, 1, ?)`,
      [invoiceNum, saleDate, JSON.stringify(items), lineTotal, discountAmt, cgst, sgst, grandTotal, gstRate]);
    await run('UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [qty, product.id]);
    await run('INSERT INTO stock_movements (product_id, type, quantity_change, reference) VALUES (?, ?, ?, ?)', [product.id, 'barcode_sale', -qty, invoiceNum]);

    const sale = await get('SELECT * FROM sales WHERE invoice_number = ?', [invoiceNum]);
    sale.items = JSON.parse(sale.items || '[]');
    res.json({ success: true, data: { sale, product }, message: `Sold ${qty}x ${product.name}. Receipt ready.` });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// ── Generate / regenerate UPC-A barcode for one product ─────────────

router.post('/generate/:productId', async (req, res) => {
  try {
    if (!req.params.productId || req.params.productId === 'undefined' || req.params.productId === 'null') {
      res.json({ success: false, error: 'Invalid product ID' }); return;
    }
    const product = await get('SELECT * FROM products WHERE id = ?', [req.params.productId]);
    if (!product) { res.json({ success: false, error: 'Not found' }); return; }

    // If already a valid UPC-A, keep it — just regenerate the image.
    let code = product.barcode;
    if (!isUpca(code)) code = await uniqueUpca(product.id);

    const png = await generateUpcaPng(code);
    const image = saveBarcodePng(code, png);
    await run('UPDATE products SET barcode = ?, barcode_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [code, image, product.id]);
    res.json({ success: true, data: { barcode: code, image } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// ── Bulk generate UPC-A for many products at once ───────────────────

router.post('/generate-bulk', async (req, res) => {
  try {
    const { product_ids } = req.body;
    const results = [];
    for (const pid of product_ids) {
      try {
        const product = await get('SELECT * FROM products WHERE id = ?', [pid]);
        if (!product) continue;
        let code = product.barcode;
        if (!isUpca(code)) code = await uniqueUpca(pid);
        const png = await generateUpcaPng(code);
        const image = saveBarcodePng(code, png);
        await run('UPDATE products SET barcode = ?, barcode_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [code, image, pid]);
        results.push({ product_id: pid, barcode: code, image });
      } catch (e) {
        console.error('Barcode generate failed for product ' + pid + ':', e.message);
        results.push({ product_id: pid, error: e.message });
      }
    }
    res.json({ success: true, data: results });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// ── Migrate ALL products to UPC-A (one-click fix for legacy barcodes) ─

router.post('/migrate-upca', async (req, res) => {
  try {
    const allProducts = await all('SELECT id, barcode FROM products');
    const results = { migrated: 0, skipped: 0, errors: 0 };

    for (const product of allProducts) {
      try {
        if (isUpca(product.barcode)) {
          results.skipped++;
          continue; // already UPC-A
        }
        const code = await uniqueUpca(product.id);
        const png = await generateUpcaPng(code);
        const image = saveBarcodePng(code, png);
        await run('UPDATE products SET barcode = ?, barcode_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [code, image, product.id]);
        results.migrated++;
      } catch (e) {
        console.error('Migration failed for product ' + product.id + ':', e.message);
        results.errors++;
      }
    }
    res.json({ success: true, data: results, message: `Migrated ${results.migrated} barcodes to UPC-A. ${results.skipped} already valid. ${results.errors} errors.` });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// ── Print helper ───────────────────────────────────────────────────

router.get('/print/:productId', async (req, res) => {
  try {
    const product = await get('SELECT * FROM products WHERE id = ?', [req.params.productId]);
    if (!product || !product.barcode) { res.json({ success: false, error: 'No barcode' }); return; }
    res.json({ success: true, data: { barcode: product.barcode, image: product.barcode_image, name: product.name, price: product.sell_price } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
