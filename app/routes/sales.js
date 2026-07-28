const express = require('express');
const router = express.Router();
const { get, all, run, lastInsertRowid } = require('../db');

router.get('/', (req, res) => {
  try {
    const { search, start_date, end_date } = req.query;
    let sql = 'SELECT * FROM sales WHERE 1=1'; const params = [];
    if (search) { sql += ' AND (invoice_number LIKE ? OR customer_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (start_date) { sql += ' AND sale_date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND sale_date <= ?'; params.push(end_date); }
    sql += ' ORDER BY created_at DESC';
    const sales = all(sql, params);
    res.json({ success: true, data: sales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') })) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const data = req.body;
    const items = data.items || [];
    if (items.length === 0) return res.status(400).json({ success: false, error: 'No items' });
    const invoiceNum = `AE/${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`;
    const saleDate = new Date().toISOString().split('T')[0];
    let subtotal = 0, discountTotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0, cessTotal = 0, grandTotal = 0;

    for (const item of items) {
      const product = get('SELECT * FROM products WHERE id = ?', [item.product_id]);
      if (!product) continue;
      if (product.quantity < item.quantity) return res.status(400).json({ success: false, error: `Insufficient stock for ${product.name}. Available: ${product.quantity}` });
      const lineTotal = item.sell_price * item.quantity;
      const lineDiscount = lineTotal * (item.discount_percent || 0) / 100;
      const afterDiscount = lineTotal - lineDiscount;
      const rate = parseInt(data.customer_gstin && data.customer_gstin.substring(0, 2) !== '27' ? get("SELECT value FROM settings WHERE key='igst_rate'", [])?.value || 18 : get("SELECT value FROM settings WHERE key='gst_rate'", [])?.value || 18);
      const isInterState = data.customer_gstin && data.customer_gstin.substring(0, 2) !== '27';
      const halfRate = rate / 2;
      const cgst = isInterState ? 0 : afterDiscount * (halfRate / 100);
      const sgst = isInterState ? 0 : afterDiscount * (halfRate / 100);
      const igst = isInterState ? afterDiscount * (rate / 100) : 0;
      subtotal += lineTotal; discountTotal += lineDiscount; cgstTotal += cgst; sgstTotal += sgst; igstTotal += igst; grandTotal += afterDiscount + cgst + sgst + igst;
    }
    grandTotal = Math.round(grandTotal * 100) / 100;

    const enrichedItems = items.map(item => {
      const p = get('SELECT name, hsn_code FROM products WHERE id = ?', [item.product_id]);
      return { ...item, product_name: p?.name || '', hsn_code: p?.hsn_code || '' };
    });

    run(`INSERT INTO sales (invoice_number, sale_date, customer_name, customer_phone, customer_gstin, customer_address, items, subtotal, discount_total, cgst_total, sgst_total, igst_total, cess_total, grand_total, payment_mode, is_barcode_scan) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [invoiceNum, saleDate, data.customer_name || 'Walk-in Customer', data.customer_phone || '', data.customer_gstin || '', data.customer_address || '', JSON.stringify(enrichedItems), subtotal, discountTotal, cgstTotal, sgstTotal, igstTotal, cessTotal, grandTotal, data.payment_mode || 'cash', data.is_barcode_scan || 0]);

    for (const item of items) {
      run('UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.product_id]);
      run('INSERT INTO stock_movements (product_id, type, quantity_change, reference) VALUES (?, ?, ?, ?)', [item.product_id, 'sale', -item.quantity, invoiceNum]);
    }

    const sale = get('SELECT * FROM sales WHERE invoice_number = ?', [invoiceNum]);
    sale.items = JSON.parse(sale.items || '[]');
    res.json({ success: true, data: sale, message: 'Sale completed' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/:id/receipt', (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const sale = get('SELECT * FROM sales WHERE id = ?', [req.params.id]);
    if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });
    sale.items = JSON.parse(sale.items || '[]');
    const companyName = get("SELECT value FROM settings WHERE key='company_name'", [])?.value || 'Aditya Enterprises';
    const companyAddr = get("SELECT value FROM settings WHERE key='company_address'", [])?.value || '';
    const companyPhone = get("SELECT value FROM settings WHERE key='company_phone'", [])?.value || '';
    const companyGstin = get("SELECT value FROM settings WHERE key='company_gstin'", [])?.value || '';

    const doc = new PDFDocument({ size: [226, 500], margin: 5 });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="receipt_${sale.invoice_number.replace(/\//g, '_')}.pdf"`);
      res.send(Buffer.concat(chunks));
    });
    doc.fontSize(8).text(companyName, { align: 'center' });
    doc.fontSize(6).text(companyAddr, { align: 'center' });
    if (companyPhone) doc.fontSize(6).text(`Ph: ${companyPhone}`, { align: 'center' });
    if (companyGstin) doc.fontSize(6).text(`GSTIN: ${companyGstin}`, { align: 'center' });
    doc.text('--------------------------------');
    doc.fontSize(7).text(`Invoice: ${sale.invoice_number}`).text(`Date: ${sale.sale_date}`).text(`Customer: ${sale.customer_name}`).text('--------------------------------');
    doc.fontSize(6).text('Item Qty Rate Total').text('--------------------------------');
    for (const item of sale.items) {
      const name = (item.product_name || 'Product').substring(0, 15);
      doc.text(`${name.padEnd(14)} ${String(item.quantity).padStart(3)} ${String(item.sell_price.toFixed(0)).padStart(5)} ${String((item.sell_price * item.quantity).toFixed(2)).padStart(7)}`);
    }
    doc.text('--------------------------------');
    doc.fontSize(7).text(`Sub Total: Rs.${sale.subtotal.toFixed(2)}`);
    if (sale.discount_total > 0) doc.text(`Discount: Rs.${sale.discount_total.toFixed(2)}`);
    if (sale.cgst_total > 0) doc.text(`CGST: Rs.${sale.cgst_total.toFixed(2)}`);
    if (sale.sgst_total > 0) doc.text(`SGST: Rs.${sale.sgst_total.toFixed(2)}`);
    if (sale.igst_total > 0) doc.text(`IGST: Rs.${sale.igst_total.toFixed(2)}`);
    doc.text('--------------------------------');
    doc.fontSize(8).text(`GRAND TOTAL: Rs.${sale.grand_total.toFixed(2)}`, { align: 'right' });
    doc.text('--------------------------------');
    doc.fontSize(6).text('Thank you! Visit again.', { align: 'center' });
    doc.end();
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const sale = get('SELECT * FROM sales WHERE id = ?', [req.params.id]);
    if (!sale) return res.status(404).json({ success: false, error: 'Not found' });
    const items = JSON.parse(sale.items || '[]');
    for (const item of items) {
      run('UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.product_id]);
      run('INSERT INTO stock_movements (product_id, type, quantity_change, reference) VALUES (?, ?, ?, ?)', [item.product_id, 'sale_reversal', item.quantity, `REVERSED:${sale.invoice_number}`]);
    }
    run('DELETE FROM sales WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Sale reversed' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/stats/dashboard', (req, res) => {
  try {
    const totalProducts = get('SELECT COUNT(*) as c FROM products', []).c;
    const totalQuantity = get('SELECT COALESCE(SUM(quantity),0) as c FROM products', []).c;
    const lowStock = get('SELECT COUNT(*) as c FROM products WHERE quantity <= 5', []).c;
    const today = new Date().toISOString().split('T')[0];
    const todaySales = get('SELECT COALESCE(SUM(grand_total),0) as c FROM sales WHERE sale_date = ?', [today]).c;
    const totalSales = get('SELECT COUNT(*) as c FROM sales', []).c;
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const monthlyRevenue = get('SELECT COALESCE(SUM(grand_total),0) as c FROM sales WHERE sale_date >= ?', [firstOfMonth]).c;
    const recentSales = all('SELECT * FROM sales ORDER BY created_at DESC LIMIT 10').map(s => ({ ...s, items: JSON.parse(s.items || '[]') }));
    const stockMovements = all('SELECT sm.*, p.name as product_name FROM stock_movements sm LEFT JOIN products p ON sm.product_id = p.id ORDER BY sm.created_at DESC LIMIT 20');
    res.json({ success: true, data: { totalProducts, totalQuantity, lowStock, todaySales, totalSales, monthlyRevenue, recentSales, stockMovements } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
