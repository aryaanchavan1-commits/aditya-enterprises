const express = require('express');
const router = express.Router();
const { get, all, run, lastInsertRowid } = require('../db');

router.get('/', (req, res) => {
  try {
    const categories = all('SELECT * FROM categories ORDER BY id');
    const result = categories.map(cat => ({
      ...cat,
      subcategories: all('SELECT * FROM subcategories WHERE category_id = ? ORDER BY id', [cat.id]),
      product_count: get('SELECT COUNT(*) as c FROM products WHERE category_id = ?', [cat.id]).c
    }));
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/:id', (req, res) => {
  try {
    const cat = get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!cat) return res.status(404).json({ success: false, error: 'Not found' });
    cat.subcategories = all('SELECT * FROM subcategories WHERE category_id = ? ORDER BY id', [cat.id]);
    cat.products = all('SELECT * FROM products WHERE category_id = ?', [cat.id]);
    res.json({ success: true, data: cat });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:id', (req, res) => {
  try { run('UPDATE categories SET name = ? WHERE id = ?', [req.body.name, req.params.id]); res.json({ success: true, message: 'Category updated' }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/:categoryId/subcategories', (req, res) => {
  try {
    run('INSERT INTO subcategories (category_id, name) VALUES (?, ?)', [req.params.categoryId, req.body.name]);
    const id = lastInsertRowid();
    res.json({ success: true, data: { id, category_id: req.params.categoryId, name: req.body.name } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:categoryId/subcategories/:subId', (req, res) => {
  try { run('UPDATE subcategories SET name = ? WHERE id = ? AND category_id = ?', [req.body.name, req.params.subId, req.params.categoryId]); res.json({ success: true, message: 'Subcategory updated' }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/:categoryId/subcategories/:subId', (req, res) => {
  try { run('DELETE FROM subcategories WHERE id = ? AND category_id = ?', [req.params.subId, req.params.categoryId]); res.json({ success: true, message: 'Subcategory deleted' }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
