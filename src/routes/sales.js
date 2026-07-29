const express = require('express');
const router = express.Router();
const { get, all, run, getDb } = require('../db');
const PDFDocument = require('pdfkit');

router.get('/', async (req, res) => {
  try {
    const { search, start_date, end_date } = req.query;
    let sql = 'SELECT * FROM sales WHERE 1=1'; const params = [];
    if (search) { sql += ' AND (invoice_number LIKE ? OR customer_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (start_date) { sql += ' AND sale_date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND sale_date <= ?'; params.push(end_date); }
    sql += ' ORDER BY created_at DESC';
    const sales = await all(sql, params);
    res.json({ success: true, data: sales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') })) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/stats/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    await getDb();
    const [totalProducts, totalQuantity, todaySalesArr, monthSalesArr, lowStock, lowStockProducts, totalSales, recentSales, stockMovements, dailySalesArr] = await Promise.all([
      get('SELECT COUNT(*) as c FROM products').then(r => r?.c || 0),
      get('SELECT COALESCE(SUM(quantity),0) as c FROM products').then(r => r?.c || 0),
      all("SELECT grand_total FROM sales WHERE sale_date = ?", [today]),
      all("SELECT grand_total FROM sales WHERE sale_date >= ?", [firstOfMonth]),
      get('SELECT COUNT(*) as c FROM products WHERE quantity <= COALESCE(low_stock_threshold, 5)').then(r => r?.c || 0),
      all('SELECT id, name, quantity, sell_price, low_stock_threshold FROM products WHERE quantity <= COALESCE(low_stock_threshold, 5) ORDER BY quantity ASC LIMIT 20'),
      get('SELECT COUNT(*) as c FROM sales').then(r => r?.c || 0),
      all('SELECT id, invoice_number, customer_name, grand_total, sale_date FROM sales ORDER BY created_at DESC LIMIT 10'),
      all('SELECT sm.*, p.name as product_name FROM stock_movements sm LEFT JOIN products p ON sm.product_id = p.id ORDER BY sm.created_at DESC LIMIT 10'),
      all("SELECT sale_date, SUM(grand_total) as total FROM sales WHERE sale_date >= ? GROUP BY sale_date ORDER BY sale_date ASC", [firstOfMonth])
    ]);
    res.json({ success: true, data: {
      totalProducts, totalQuantity,
      todaySales: Math.round(todaySalesArr.reduce((s, x) => s + x.grand_total, 0) * 100) / 100,
      monthlyRevenue: Math.round(monthSalesArr.reduce((s, x) => s + x.grand_total, 0) * 100) / 100,
      lowStock, lowStockProducts, totalSales,
      todayInvoices: todaySalesArr.length, monthInvoices: monthSalesArr.length,
      recentSales, stockMovements, dailySales: dailySalesArr
    } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const items = data.items || [];
    if (items.length === 0) { res.json({ success: false, error: 'No items' }); return; }
    const invoiceNum = `AE/${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`;
    const saleDate = new Date().toISOString().split('T')[0];
    let subtotal = 0, discountTotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0, cessTotal = 0, grandTotal = 0;

    const settings = {};
    const allSettings = await all('SELECT * FROM settings');
    allSettings.forEach(s => settings[s.key] = s.value);

    for (const item of items) {
      const product = await get('SELECT * FROM products WHERE id = ?', [item.product_id]);
      if (!product) continue;
      if (product.quantity < item.quantity) { res.json({ success: false, error: `Insufficient stock for ${product.name}. Available: ${product.quantity}` }); return; }
      const lineTotal = item.sell_price * item.quantity;
      const lineDiscount = lineTotal * (item.discount_percent || 0) / 100;
      const afterDiscount = lineTotal - lineDiscount;
      subtotal += lineTotal; discountTotal += lineDiscount;
      if (data.is_gst !== false) {
        const rate = parseInt(data.customer_gstin && data.customer_gstin.substring(0, 2) !== '27' ? (settings['igst_rate'] || 18) : (settings['gst_rate'] || 18));
        const isInterState = data.customer_gstin && data.customer_gstin.substring(0, 2) !== '27';
        const halfRate = rate / 2;
        const cgst = isInterState ? 0 : afterDiscount * (halfRate / 100);
        const sgst = isInterState ? 0 : afterDiscount * (halfRate / 100);
        const igst = isInterState ? afterDiscount * (rate / 100) : 0;
        cgstTotal += cgst; sgstTotal += sgst; igstTotal += igst;
        grandTotal += afterDiscount + cgst + sgst + igst;
      } else {
        grandTotal += afterDiscount;
      }
    }
    grandTotal = Math.round(grandTotal * 100) / 100;

    const enrichedItems = [];
    for (const item of items) {
      const p = await get('SELECT name, hsn_code FROM products WHERE id = ?', [item.product_id]);
      enrichedItems.push({ ...item, product_name: p?.name || '', hsn_code: p?.hsn_code || '' });
    }

    await run(`INSERT INTO sales (invoice_number, sale_date, customer_name, customer_phone, customer_gstin, customer_address, items, subtotal, discount_total, cgst_total, sgst_total, igst_total, cess_total, grand_total, payment_mode, is_barcode_scan) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [invoiceNum, saleDate, data.customer_name || 'Walk-in Customer', data.customer_phone || '', data.customer_gstin || '', data.customer_address || '', JSON.stringify(enrichedItems), subtotal, discountTotal, cgstTotal, sgstTotal, igstTotal, cessTotal, grandTotal, data.payment_mode || 'cash', data.is_barcode_scan || 0]);

    for (const item of items) {
      await run('UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.product_id]);
      await run('INSERT INTO stock_movements (product_id, type, quantity_change, reference) VALUES (?, ?, ?, ?)', [item.product_id, 'sale', -item.quantity, invoiceNum]);
    }

    const sale = await get('SELECT * FROM sales WHERE invoice_number = ?', [invoiceNum]);
    sale.items = JSON.parse(sale.items || '[]');
    sale.is_gst = data.is_gst !== false;
    res.json({ success: true, data: sale, message: 'Sale completed' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/:id/receipt', async (req, res) => {
  try {
    const sale = await get('SELECT * FROM sales WHERE id = ?', [req.params.id]);
    if (!sale) { res.json({ success: false, error: 'Sale not found' }); return; }
    sale.items = JSON.parse(sale.items || '[]');
    const settings = {};
    const allSettings = await all('SELECT * FROM settings');
    allSettings.forEach(s => settings[s.key] = s.value);

    const doc = new PDFDocument({ size: [226, 500], margin: 5 });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="receipt_${sale.invoice_number.replace(/\//g, '_')}.pdf"`);
      res.send(Buffer.concat(chunks));
    });

    doc.fontSize(10).font('Helvetica-Bold').text((settings.company_name || 'Aditya Enterprises'), { align: 'center' });
    doc.fontSize(7).font('Helvetica').text((settings.company_address || ''), { align: 'center' });
    doc.text(`GST: ${settings.company_gstin || ''}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.text(`Invoice: ${sale.invoice_number}`, { align: 'center' });
    doc.text(`Date: ${sale.sale_date}`, { align: 'center' });
    doc.text(`Customer: ${sale.customer_name}`, { align: 'center' });
    if (sale.customer_gstin) doc.text(`GSTIN: ${sale.customer_gstin}`, { align: 'center' });
    doc.moveDown(0.3);

    doc.fontSize(7).font('Helvetica-Bold');
    doc.text('Item'.padEnd(16) + 'Qty'.padStart(4) + 'Rate'.padStart(6) + 'Amt'.padStart(8), { underline: true });
    doc.fontSize(6).font('Helvetica');
    sale.items.forEach(item => {
      const name = (item.product_name || 'Item').substring(0, 14);
      const qty = String(item.quantity || 0);
      const rate = String(item.sell_price || 0);
      const amt = String(Math.round((item.sell_price || 0) * (item.quantity || 0) * 100) / 100);
      doc.text(name.padEnd(16) + qty.padStart(4) + rate.padStart(6) + amt.padStart(8));
    });
    doc.moveDown(0.2);
    doc.fontSize(7).font('Helvetica-Bold');
    doc.text('Subtotal:'.padEnd(26) + String(Math.round(sale.subtotal * 100) / 100).padStart(8));
    doc.text('CGST:'.padEnd(26) + String(Math.round(sale.cgst_total * 100) / 100).padStart(8));
    doc.text('SGST:'.padEnd(26) + String(Math.round(sale.sgst_total * 100) / 100).padStart(8));
    doc.text('Total:'.padEnd(26) + String(Math.round(sale.grand_total * 100) / 100).padStart(8));
    doc.text(`Payment: ${(sale.payment_mode || 'cash').toUpperCase()}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(6).font('Helvetica').text('Thank you! Visit again!', { align: 'center' });
    doc.end();
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const sale = await get('SELECT * FROM sales WHERE id = ?', [req.params.id]);
    if (!sale) { res.json({ success: false, error: 'Sale not found' }); return; }
    const items = JSON.parse(sale.items || '[]');
    for (const item of items) {
      await run('UPDATE products SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.product_id]);
    }
    await run('DELETE FROM stock_movements WHERE reference = ?', [sale.invoice_number]);
    await run('DELETE FROM sales WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Sale deleted, stock restored' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
