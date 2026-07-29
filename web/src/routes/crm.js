const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');

router.get('/', async (req, res) => {
  try {
    const { search, phone } = req.query;
    let visits = [];
    if (phone) {
      visits = await all("SELECT * FROM customer_visits WHERE customer_phone = ? ORDER BY visit_date DESC", [phone]);
    } else if (search) {
      visits = await all("SELECT * FROM customer_visits WHERE customer_name LIKE ? OR customer_phone LIKE ? ORDER BY visit_date DESC", [`%${search}%`, `%${search}%`]);
    } else {
      visits = await all('SELECT * FROM customer_visits ORDER BY visit_date DESC LIMIT 100');
    }
    const customerMap = {};
    for (const v of visits) {
      const key = v.customer_phone || v.customer_name;
      if (!customerMap[key]) {
        customerMap[key] = { name: v.customer_name, phone: v.customer_phone || '', totalVisits: 0, totalAmount: 0, firstVisit: v.visit_date, lastVisit: v.visit_date, visits: [] };
      }
      customerMap[key].totalVisits++;
      customerMap[key].totalAmount += v.amount || 0;
      if (v.visit_date < customerMap[key].firstVisit) customerMap[key].firstVisit = v.visit_date;
      if (v.visit_date > customerMap[key].lastVisit) customerMap[key].lastVisit = v.visit_date;
      customerMap[key].visits.push(v);
    }
    const customers = Object.values(customerMap).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
    res.json({ success: true, data: { customers, totalCustomers: customers.length, repeatCustomers: customers.filter(c => c.totalVisits > 1).length } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/visits', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let sql = 'SELECT * FROM customer_visits WHERE 1=1'; const params = [];
    if (start_date) { sql += ' AND visit_date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND visit_date <= ?'; params.push(end_date); }
    sql += ' ORDER BY visit_date DESC, created_at DESC';
    const visits = await all(sql, params);
    res.json({ success: true, data: visits });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/visit', async (req, res) => {
  try {
    const { customer_name, customer_phone, visit_date, purpose, notes, amount } = req.body;
    if (!customer_name) res.json({ success: false, error: 'Customer name is required' }); return;
    const date = visit_date || new Date().toISOString().split('T')[0];
    await run('INSERT INTO customer_visits (customer_name, customer_phone, visit_date, purpose, notes, amount) VALUES (?,?,?,?,?,?)',
      [customer_name, customer_phone || '', date, purpose || '', notes || '', amount || 0]);
    const result = await get('SELECT * FROM customer_visits ORDER BY id DESC LIMIT 1');
    res.json({ success: true, data: result, message: 'Visit recorded' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.delete('/visit/:id', async (req, res) => {
  try { await run('DELETE FROM customer_visits WHERE id = ?', [req.params.id]); res.json({ success: true, message: 'Visit deleted' }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
