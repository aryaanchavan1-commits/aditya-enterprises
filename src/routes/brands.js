const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');

router.get('/', async (req, res) => {
  try {
    const brands = await all('SELECT * FROM brands ORDER BY name ASC');
    res.json({ success: true, data: brands });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    if (!req.body.name) { res.json({ success: false, error: 'Brand name required' }); return; }
    const ins = await run('INSERT INTO brands (name, description) VALUES (?,?)', [req.body.name.trim(), req.body.description || '']);
    res.json({ success: true, data: await get('SELECT * FROM brands WHERE id = ?', [ins.id]) });
  } catch (err) {
    if (err.message.includes('UNIQUE')) { res.json({ success: false, error: 'Brand already exists' }); return; }
    res.json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM brands WHERE id = ?', [req.params.id]);
    if (!existing) { res.json({ success: false, error: 'Brand not found' }); return; }
    await run('UPDATE brands SET name=?, description=? WHERE id=?', [req.body.name || existing.name, req.body.description ?? existing.description, req.params.id]);
    res.json({ success: true, data: await get('SELECT * FROM brands WHERE id = ?', [req.params.id]) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM brands WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Brand deleted' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
