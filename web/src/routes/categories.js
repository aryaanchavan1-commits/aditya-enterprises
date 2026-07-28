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
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const cat = await get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!cat) return res.status(404).json({ success: false, error: 'Not found' });
    cat.subcategories = await all('SELECT * FROM subcategories WHERE category_id = ? ORDER BY id', [cat.id]);
    cat.products = await all('SELECT * FROM products WHERE category_id = ?', [cat.id]);
    res.json({ success: true, data: cat });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ success: false, error: 'Category name required' });
    const result = await run('INSERT INTO categories (name) VALUES (?)', [req.body.name]);
    const cat = await get('SELECT * FROM categories WHERE id = ?', [result.id]);
    res.json({ success: true, data: { ...cat, subcategories: [], product_count: 0 } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try { await run('UPDATE categories SET name = ? WHERE id = ?', [req.body.name, req.params.id]); res.json({ success: true, message: 'Category updated' }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/:categoryId/subcategories', async (req, res) => {
  try {
    const result = await run('INSERT INTO subcategories (category_id, name) VALUES (?, ?)', [req.params.categoryId, req.body.name]);
    res.json({ success: true, data: { id: result.id, category_id: parseInt(req.params.categoryId), name: req.body.name } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:categoryId/subcategories/:subId', async (req, res) => {
  try { await run('UPDATE subcategories SET name = ? WHERE id = ? AND category_id = ?', [req.body.name, req.params.subId, req.params.categoryId]); res.json({ success: true, message: 'Subcategory updated' }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/:categoryId/subcategories/:subId', async (req, res) => {
  try { await run('DELETE FROM subcategories WHERE id = ? AND category_id = ?', [req.params.subId, req.params.categoryId]); res.json({ success: true, message: 'Subcategory deleted' }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
