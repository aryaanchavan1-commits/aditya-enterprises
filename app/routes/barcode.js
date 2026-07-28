const express = require('express');
const router = express.Router();
const { get, all, run, lastInsertRowid, dataDir } = require('../db');
const bwipjs = require('bwip-js');
const path = require('path');
const fs = require('fs');

router.get('/scan/:code', (req, res) => {
  try {
    const product = get('SELECT * FROM products WHERE barcode = ? OR serial_number = ?', [req.params.code, req.params.code]);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found for: ' + req.params.code });
    res.json({ success: true, data: product });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/scan-sale', (req, res) => {
  try {
    const { barcode, quantity } = req.body;
    const qty = quantity || 1;
    const product = get('SELECT * FROM products WHERE barcode = ? OR serial_number = ?', [barcode, barcode]);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (product.quantity < qty) return res.status(400).json({ success: false, error: `Only ${product.quantity} left in stock` });
    const invoiceNum = `AE/${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`;
    const saleDate = new Date().toISOString().split('T')[0];
    const lineTotal = product.sell_price * qty;
    const discountAmt = lineTotal * (product.discount_percent / 100);
    const afterDiscount = lineTotal - discountAmt;
    const cgst = afterDiscount * (9 / 100);
    const sgst = afterDiscount * (9 / 100);
    const grandTotal = afterDiscount + cgst + sgst;
    const items = [{ product_id: product.id, product_name: product.name, hsn_code: product.hsn_code, quantity: qty, sell_price: product.sell_price, discount_percent: product.discount_percent }];

    run(`INSERT INTO sales (invoice_number, sale_date, customer_name, items, subtotal, discount_total, cgst_total, sgst_total, grand_total, payment_mode, is_barcode_scan) VALUES (?, ?, 'Walk-in Customer', ?, ?, ?, ?, ?, ?, 'cash', 1)`,
      [invoiceNum, saleDate, JSON.stringify(items), lineTotal, discountAmt, cgst, sgst, grandTotal]);
    run('UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [qty, product.id]);
    run('INSERT INTO stock_movements (product_id, type, quantity_change, reference) VALUES (?, ?, ?, ?)', [product.id, 'barcode_sale', -qty, invoiceNum]);

    const sale = get('SELECT * FROM sales WHERE invoice_number = ?', [invoiceNum]);
    sale.items = JSON.parse(sale.items || '[]');
    res.json({ success: true, data: { sale, product }, message: `Sold ${qty}x ${product.name}. Receipt ready.` });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/generate/:productId', async (req, res) => {
  try {
    const product = get('SELECT * FROM products WHERE id = ?', [req.params.productId]);
    if (!product) return res.status(404).json({ success: false, error: 'Not found' });
    const code = product.barcode || `AE${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const png = await new Promise((resolve, reject) => {
      bwipjs.toBuffer({ bcid: req.body.type || 'code128', text: code, scale: 3, height: 10, includetext: true, textxalign: 'center' }, (err, buf) => err ? reject(err) : resolve(buf));
    });
    const dir = path.join(dataDir, 'barcodes');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${code}.png`), png);
    run('UPDATE products SET barcode = ?, barcode_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [code, `/data/barcodes/${code}.png`, product.id]);
    res.json({ success: true, data: { barcode: code, image: `/data/barcodes/${code}.png` } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/generate-bulk', async (req, res) => {
  try {
    const { product_ids } = req.body;
    const results = [];
    const dir = path.join(dataDir, 'barcodes');
    for (const pid of product_ids) {
      const product = get('SELECT * FROM products WHERE id = ?', [pid]);
      if (!product) continue;
      const code = product.barcode || `AE${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const png = await new Promise((resolve, reject) => {
        bwipjs.toBuffer({ bcid: 'code128', text: code, scale: 3, height: 10, includetext: true, textxalign: 'center' }, (e, b) => e ? reject(e) : resolve(b));
      });
      fs.writeFileSync(path.join(dir, `${code}.png`), png);
      run('UPDATE products SET barcode = ?, barcode_image = ? WHERE id = ?', [code, `/data/barcodes/${code}.png`, pid]);
      results.push({ product_id: pid, barcode: code, image: `/data/barcodes/${code}.png` });
    }
    res.json({ success: true, data: results });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/print/:productId', (req, res) => {
  try {
    const product = get('SELECT * FROM products WHERE id = ?', [req.params.productId]);
    if (!product || !product.barcode) return res.status(404).json({ success: false, error: 'No barcode' });
    res.json({ success: true, data: { barcode: product.barcode, image: product.barcode_image, name: product.name, price: product.sell_price } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
