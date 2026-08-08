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
// Used by the Products page "Scan & Add": scan -> product found -> add to
// inventory instead of creating a duplicate.
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

router.post('/generate/:productId', async (req, res) => {
  try {
    if (!req.params.productId || req.params.productId === 'undefined' || req.params.productId === 'null') {
      res.json({ success: false, error: 'Invalid product ID' }); return;
    }
    const product = await get('SELECT * FROM products WHERE id = ?', [req.params.productId]);
    if (!product) { res.json({ success: false, error: 'Not found' }); return; }
    // If the product has a barcode, use it as-is (never regenerate a
    // different code - otherwise printed labels won't match the DB).
    const raw = product.barcode || `AE${Date.now()}${Math.floor(Math.random() * 1000)}`;
    // safeCode can strip every character (e.g. a barcode of only special
    // chars) - fall back to a fresh AE code instead of failing silently.
    const code = safeCode(raw) || `AE${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const png = await new Promise((resolve, reject) => {
      bwipjs.toBuffer({ bcid: req.body.type || 'code128', text: code, scale: 3, height: 10, includetext: true, textxalign: 'center' }, (err, buf) => err ? reject(err) : resolve(buf));
    });
    const barcodesDir = path.join(require('../db').dataDir, 'barcodes');
    fs.mkdirSync(barcodesDir, { recursive: true });
    fs.writeFileSync(path.join(barcodesDir, `${code}.png`), png);
    await run('UPDATE products SET barcode = ?, barcode_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [code, `/data/barcodes/${code}.png`, product.id]);
    res.json({ success: true, data: { barcode: code, image: `/data/barcodes/${code}.png` } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/generate-bulk', async (req, res) => {
  try {
    const { product_ids } = req.body;
    const results = [];
    const barcodesDir = path.join(require('../db').dataDir, 'barcodes');
    fs.mkdirSync(barcodesDir, { recursive: true });
    for (const pid of product_ids) {
      try {
        const product = await get('SELECT * FROM products WHERE id = ?', [pid]);
        if (!product) continue;
        const raw = product.barcode || `AE${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const code = safeCode(raw) || `AE${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const png = await new Promise((resolve, reject) => {
          bwipjs.toBuffer({ bcid: 'code128', text: code, scale: 3, height: 10, includetext: true, textxalign: 'center' }, (e, b) => e ? reject(e) : resolve(b));
        });
        fs.writeFileSync(path.join(barcodesDir, `${code}.png`), png);
        await run('UPDATE products SET barcode = ?, barcode_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [code, `/data/barcodes/${code}.png`, pid]);
        results.push({ product_id: pid, barcode: code, image: `/data/barcodes/${code}.png` });
      } catch (e) {
        // One bad barcode must not kill the whole batch.
        console.error('Barcode generate failed for product ' + pid + ':', e.message);
        results.push({ product_id: pid, error: e.message });
      }
    }
    res.json({ success: true, data: results });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/print/:productId', async (req, res) => {
  try {
    const product = await get('SELECT * FROM products WHERE id = ?', [req.params.productId]);
    if (!product || !product.barcode) { res.json({ success: false, error: 'No barcode' }); return; }
    res.json({ success: true, data: { barcode: product.barcode, image: product.barcode_image, name: product.name, price: product.sell_price } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
