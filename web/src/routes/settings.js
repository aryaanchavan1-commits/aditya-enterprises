const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');

router.get('/', async (req, res) => {
  try {
    const settings = await all('SELECT * FROM settings');
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/:key', async (req, res) => {
  try {
    const setting = await get('SELECT * FROM settings WHERE key = ?', [req.params.key]);
    if (!setting) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: setting });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.put('/', async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
