const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');

router.get('/', async (req, res) => {
  try {
    const { search, start_date, end_date } = req.query;
    let sql = 'SELECT * FROM purchases WHERE 1=1'; const params = [];
    if (search) { sql += ' AND (invoice_number LIKE ? OR supplier_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (start_date) { sql += ' AND purchase_date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND purchase_date <= ?'; params.push(end_date); }
    sql += ' ORDER BY created_at DESC';
    const purchases = await all(sql, params);
    res.json({ success: true, data: purchases.map(p => ({ ...p, items: JSON.parse(p.items || '[]') })) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const purchase = await get('SELECT * FROM purchases WHERE id = ?', [req.params.id]);
    if (!purchase) res.json({ success: false, error: 'Purchase not found' }); return;
    purchase.items = JSON.parse(purchase.items || '[]');
    res.json({ success: true, data: purchase });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const items = data.items || [];
    if (items.length === 0) res.json({ success: false, error: 'No items in purchase' }); return;

    const invoiceNum = `PO/${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`;
    const purchaseDate = data.purchase_date || new Date().toISOString().split('T')[0];
    let subtotal = 0; let gstTotal = 0; let grandTotal = 0;

    for (const item of items) {
      const lineTotal = item.inward_price * item.quantity;
      const gstAmt = lineTotal * ((item.gst_rate || 18) / 100);
      subtotal += lineTotal;
      gstTotal += gstAmt;
      grandTotal += lineTotal + gstAmt;
    }
    grandTotal = Math.round(grandTotal * 100) / 100;

    const enrichedItems = items.map(item => ({
      ...item,
      product_name: item.product_name || ''
    }));

    await run(`INSERT INTO purchases (invoice_number, purchase_date, supplier_id, supplier_name, items, subtotal, gst_total, grand_total, payment_status, notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [invoiceNum, purchaseDate, data.supplier_id || null, data.supplier_name || 'Unknown Supplier', JSON.stringify(enrichedItems), Math.round(subtotal * 100) / 100, Math.round(gstTotal * 100) / 100, grandTotal, data.payment_status || 'paid', data.notes || '']);

    for (const item of items) {
      const existing = await get('SELECT * FROM products WHERE id = ?', [item.product_id]);
      if (existing) {
        await run('UPDATE products SET quantity = quantity + ?, inward_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.inward_price || existing.inward_price, item.product_id]);
      }
      await run('INSERT INTO stock_movements (product_id, type, quantity_change, reference) VALUES (?, ?, ?, ?)', [item.product_id, 'purchase', item.quantity, invoiceNum]);
    }

    const purchase = await get('SELECT * FROM purchases WHERE invoice_number = ?', [invoiceNum]);
    purchase.items = JSON.parse(purchase.items || '[]');
    res.json({ success: true, data: purchase, message: 'Purchase recorded' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const data = req.body;
    const existing = await get('SELECT * FROM purchases WHERE id = ?', [req.params.id]);
    if (!existing) res.json({ success: false, error: 'Purchase not found' }); return;

    await run('UPDATE purchases SET supplier_name=?, payment_status=?, notes=? WHERE id=?',
      [data.supplier_name || existing.supplier_name, data.payment_status || existing.payment_status, data.notes || existing.notes, req.params.id]);
    res.json({ success: true, data: await get('SELECT * FROM purchases WHERE id = ?', [req.params.id]) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const purchase = await get('SELECT * FROM purchases WHERE id = ?', [req.params.id]);
    if (!purchase) res.json({ success: false, error: 'Not found' }); return;
    purchase.items = JSON.parse(purchase.items || '[]');
    for (const item of purchase.items) {
      await run('UPDATE products SET quantity = quantity - ? WHERE id = ?', [item.quantity, item.product_id]);
    }
    await run('DELETE FROM purchases WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Purchase deleted' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
