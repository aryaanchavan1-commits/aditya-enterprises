const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');

router.get('/cash-book', async (req, res) => {
  try {
    const { start, end } = req.query;
    let sql = 'SELECT * FROM cash_book WHERE 1=1';
    const params = [];
    if (start) { sql += ' AND date >= ?'; params.push(start); }
    if (end) { sql += ' AND date <= ?'; params.push(end); }
    sql += ' ORDER BY date DESC, id DESC';
    res.json({ success: true, data: await all(sql, params) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/cash-book', async (req, res) => {
  try {
    const { date, description, type, amount, category, reference } = req.body;
    if (!date || !description || !type || amount === undefined) { res.json({ success: false, error: 'date, description, type, amount required' }); return; }
    const ins = await run('INSERT INTO cash_book (date, description, type, amount, category, reference) VALUES (?,?,?,?,?,?)',
      [date, description, type, amount, category || '', reference || '']);
    res.json({ success: true, data: await get('SELECT * FROM cash_book WHERE id = ?', [ins.id]) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.delete('/cash-book/:id', async (req, res) => {
  try { await run('DELETE FROM cash_book WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/expenses', async (req, res) => {
  try {
    const { start, end } = req.query;
    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];
    if (start) { sql += ' AND date >= ?'; params.push(start); }
    if (end) { sql += ' AND date <= ?'; params.push(end); }
    sql += ' ORDER BY date DESC, id DESC';
    res.json({ success: true, data: await all(sql, params) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/expenses', async (req, res) => {
  try {
    const { date, description, category, amount, payment_mode, reference, notes } = req.body;
    if (!date || !description || amount === undefined) { res.json({ success: false, error: 'date, description, amount required' }); return; }
    const ins = await run('INSERT INTO expenses (date, description, category, amount, payment_mode, reference, notes) VALUES (?,?,?,?,?,?,?)',
      [date, description, category || '', amount, payment_mode || 'cash', reference || '', notes || '']);
    res.json({ success: true, data: await get('SELECT * FROM expenses WHERE id = ?', [ins.id]) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.delete('/expenses/:id', async (req, res) => {
  try { await run('DELETE FROM expenses WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/incomes', async (req, res) => {
  try {
    const { start, end } = req.query;
    let sql = 'SELECT * FROM incomes WHERE 1=1';
    const params = [];
    if (start) { sql += ' AND date >= ?'; params.push(start); }
    if (end) { sql += ' AND date <= ?'; params.push(end); }
    sql += ' ORDER BY date DESC, id DESC';
    res.json({ success: true, data: await all(sql, params) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/incomes', async (req, res) => {
  try {
    const { date, description, category, amount, payment_mode, reference, notes } = req.body;
    if (!date || !description || amount === undefined) { res.json({ success: false, error: 'date, description, amount required' }); return; }
    const ins = await run('INSERT INTO incomes (date, description, category, amount, payment_mode, reference, notes) VALUES (?,?,?,?,?,?,?)',
      [date, description, category || '', amount, payment_mode || 'cash', reference || '', notes || '']);
    res.json({ success: true, data: await get('SELECT * FROM incomes WHERE id = ?', [ins.id]) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.delete('/incomes/:id', async (req, res) => {
  try { await run('DELETE FROM incomes WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/summary', async (req, res) => {
  try {
    const totalSales = (await get("SELECT COALESCE(SUM(grand_total),0) as s FROM sales"))?.s || 0;
    const totalPurchases = (await get("SELECT COALESCE(SUM(grand_total),0) as s FROM purchases"))?.s || 0;
    const totalExpenses = (await get("SELECT COALESCE(SUM(amount),0) as s FROM expenses"))?.s || 0;
    const totalIncomes = (await get("SELECT COALESCE(SUM(amount),0) as s FROM incomes"))?.s || 0;
    const cashIn = (await get("SELECT COALESCE(SUM(amount),0) as s FROM cash_book WHERE type='in'"))?.s || 0;
    const cashOut = (await get("SELECT COALESCE(SUM(amount),0) as s FROM cash_book WHERE type='out'"))?.s || 0;
    res.json({ success: true, data: { totalSales, totalPurchases, totalExpenses, totalIncomes, cashIn, cashOut, cashBalance: cashIn - cashOut, netProfit: totalSales + totalIncomes - totalPurchases - totalExpenses } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
