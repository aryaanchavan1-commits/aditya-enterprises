const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');

router.get('/', async (req, res) => {
  try {
    const { type, search } = req.query;
    let sql = 'SELECT * FROM parties WHERE 1=1';
    const params = [];
    if (type === 'customer' || type === 'supplier') {
      sql += ' AND party_type = ?';
      params.push(type);
    }
    if (search) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR gstin LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY name ASC';
    const parties = await all(sql, params);
    res.json({ success: true, data: parties });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, party_type, phone, email, gstin, address, city, state, pincode, opening_balance } = req.body;
    if (!name) { res.json({ success: false, error: 'Name required' }); return; }
    const r = await run(
      'INSERT INTO parties (name, party_type, phone, email, gstin, address, city, state, pincode, opening_balance) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [name, party_type || 'customer', phone || '', email || '', gstin || '', address || '', city || '', state || '', pincode || '', opening_balance || 0]
    );
    const party = await get('SELECT * FROM parties WHERE id = ?', [r.id]);
    res.json({ success: true, data: party });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, party_type, phone, email, gstin, address, city, state, pincode, opening_balance, is_active } = req.body;
    await run(
      'UPDATE parties SET name=?, party_type=?, phone=?, email=?, gstin=?, address=?, city=?, state=?, pincode=?, opening_balance=?, is_active=? WHERE id=?',
      [name, party_type || 'customer', phone || '', email || '', gstin || '', address || '', city || '', state || '', pincode || '', opening_balance || 0, is_active !== undefined ? is_active : 1, req.params.id]
    );
    const party = await get('SELECT * FROM parties WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: party });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM parties WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
