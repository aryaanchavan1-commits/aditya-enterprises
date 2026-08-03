const express = require('express');
const router = express.Router();
const { get, all, run, resetData } = require('../db');

router.get('/', async (req, res) => {
  try {
    const settings = await all('SELECT * FROM settings');
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    delete result['groq_api_key'];   // never send API keys to the browser
    delete result['admin_password']; // never send the auth hash
    res.json({ success: true, data: result });
  } catch (err) { res.json({ success: false, error: 'Could not load settings' }); }
});

router.get('/:key', async (req, res) => {
  try {
    const setting = await get('SELECT * FROM settings WHERE key = ?', [req.params.key]);
    if (!setting) { res.json({ success: false, error: 'Not found' }); return; }
    res.json({ success: true, data: setting });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.put('/', async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/reset', async (req, res) => {
  try {
    await resetData();
    res.json({ success: true, message: 'All data reset. Fresh schema re-initialized.' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
