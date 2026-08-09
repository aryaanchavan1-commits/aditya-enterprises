const express = require('express');
const router = express.Router();
const { get, all, run, cleanRow } = require('../db');
const bwipjs = require('bwip-js');
const path = require('path');
const fs = require('fs');

function generateBarcodeImage(code) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer({
      bcid: 'code128', text: code, scale: 3, height: 10, includetext: true, textxalign: 'center', backgroundcolor: 'FFFFFF',
    }, (err, png) => { if (err) return reject(err); resolve(png); });
  });
}

// Normalize a barcode for storage + filename (no control chars, no path
// separators - same rules as the barcode route so lookups always line up).
function cleanBarcode(code) {
  return String(code || '')
    .trim()
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[^A-Za-z0-9.\-_]/g, '')
    .slice(0, 32);
}

router.get('/', async (req, res) => {
  try {
    const { search, category_id, subcategory_id, low_stock } = req.query;
    let sql = `SELECT p.*, c.name as category_name, sc.name as subcategory_name FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN subcategories sc ON p.subcategory_id = sc.id WHERE 1=1`;
    const params = [];
    if (search) { sql += ` AND (p.name LIKE ? OR p.hsn_code LIKE ? OR p.serial_number LIKE ? OR p.barcode LIKE ? OR p.description LIKE ?)`; const s = `%${search}%`; params.push(s, s, s, s, s); }
    if (category_id) { sql += ` AND p.category_id = ?`; params.push(category_id); }
    if (subcategory_id) { sql += ` AND p.subcategory_id = ?`; params.push(subcategory_id); }
    if (low_stock === 'true') { sql += ` AND p.quantity <= COALESCE(p.low_stock_threshold, 5)`; }
    sql += ` ORDER BY p.updated_at DESC`;
    const data = (await all(sql, params)).map(cleanRow);
    res.json({ success: true, data });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await get(`SELECT p.*, c.name as category_name, sc.name as subcategory_name FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN subcategories sc ON p.subcategory_id = sc.id WHERE p.id = ?`, [req.params.id]);
    if (!product) { res.json({ success: false, error: 'Product not found' }); return; }
    res.json({ success: true, data: cleanRow(product) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const barcode = cleanBarcode(data.barcode) || `AE${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const serial = data.serial_number || `AE-SN-${Date.now()}`;
    let barcode_image = '';
    try {
      const barcodesDir = path.join(require('../db').dataDir, 'barcodes');
      fs.mkdirSync(barcodesDir, { recursive: true });
      const png = await generateBarcodeImage(barcode);
      fs.writeFileSync(path.join(barcodesDir, `${barcode}.png`), png);
      barcode_image = `/data/barcodes/${barcode}.png`;
    } catch (e) { console.error('Barcode gen failed:', e.message); }

    const ins = await run(`INSERT INTO products (name, image, quantity, unit, description, hsn_code, sell_price, inward_price, serial_number, discount_percent, barcode, barcode_image, category_id, subcategory_id, low_stock_threshold) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [data.name, data.image || '', data.quantity || 0, data.unit || 'pcs', data.description || '', data.hsn_code || '', data.sell_price || 0, data.inward_price || 0, serial, data.discount_percent || 0, barcode, barcode_image, data.category_id || null, data.subcategory_id || null, data.low_stock_threshold ?? 5]);

    const product = await get('SELECT * FROM products WHERE id = ?', [ins.id || ins.lastID]);
    res.json({ success: true, data: product });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const data = req.body;
    const existing = await get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) { res.json({ success: false, error: 'Not found' }); return; }
    const barcode = cleanBarcode(data.barcode) || existing.barcode;
    let barcode_image = existing.barcode_image;
    if (data.barcode && data.barcode !== existing.barcode) {
      try {
        const barcodesDir = path.join(require('../db').dataDir, 'barcodes');
        fs.mkdirSync(barcodesDir, { recursive: true });
        const png = await generateBarcodeImage(barcode);
        fs.writeFileSync(path.join(barcodesDir, `${barcode}.png`), png);
        barcode_image = `/data/barcodes/${barcode}.png`;
      } catch (e) {}
    }
    await run(`UPDATE products SET name=?, image=?, quantity=?, description=?, hsn_code=?, sell_price=?, inward_price=?, discount_percent=?, barcode=?, barcode_image=?, category_id=?, subcategory_id=?, low_stock_threshold=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [data.name || existing.name, data.image || existing.image, data.quantity ?? existing.quantity, data.description || existing.description, data.hsn_code || existing.hsn_code, data.sell_price ?? existing.sell_price, data.inward_price ?? existing.inward_price, data.discount_percent ?? existing.discount_percent, barcode, barcode_image, data.category_id ?? existing.category_id, data.subcategory_id ?? existing.subcategory_id, data.low_stock_threshold ?? existing.low_stock_threshold ?? 5, req.params.id]);
    res.json({ success: true, data: await get('SELECT * FROM products WHERE id = ?', [req.params.id]) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.delete('/', async (req, res) => {
  try {
    await run('DELETE FROM stock_movements');
    await run('DELETE FROM products');
    res.json({ success: true, message: 'All products deleted' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM stock_movements WHERE product_id = ?', [req.params.id]);
    await run('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/:id/barcode', async (req, res) => {
  try {
    const product = await get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) { res.json({ success: false, error: 'Not found' }); return; }
    if (!product.barcode) { res.json({ success: false, error: 'No barcode' }); return; }
    const barcodePath = path.join(require('../db').dataDir, 'barcodes', `${product.barcode}.png`);
    if (!fs.existsSync(barcodePath)) { const png = await generateBarcodeImage(product.barcode); fs.writeFileSync(barcodePath, png); }
    res.json({ success: true, data: { barcode: product.barcode, image: `/data/barcodes/${product.barcode}.png` } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
