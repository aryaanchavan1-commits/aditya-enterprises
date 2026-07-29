const express = require('express');
const router = express.Router();
const { get, all, run, cleanRow } = require('../db');

router.get('/', async (req, res) => {
  try {
    const categories = await all('SELECT * FROM categories ORDER BY id');
    const result = [];
    for (const cat of categories) {
      result.push({
        ...cleanRow(cat),
        subcategories: (await all('SELECT * FROM subcategories WHERE category_id = ? ORDER BY id', [cat.id])).map(cleanRow),
        product_count: (await get('SELECT COUNT(*) as c FROM products WHERE category_id = ?', [cat.id])).c
      });
    }
    res.json({ success: true, data: result });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    if (!req.body.name) { res.json({ success: false, error: 'Category name required' }); return; }
    const result = await run('INSERT INTO categories (name) VALUES (?)', [req.body.name]);
    const cat = await get('SELECT * FROM categories WHERE id = ?', [result.id]);
    res.json({ success: true, data: { ...cat, subcategories: [], product_count: 0 } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
