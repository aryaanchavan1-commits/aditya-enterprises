const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');

router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    let sql = 'SELECT * FROM services WHERE 1=1'; const params = [];
    if (search) { sql += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR device_type LIKE ? OR serial_number LIKE ?)'; const s = `%${search}%`; params.push(s, s, s, s); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const services = await all(sql, params);
    res.json({ success: true, data: services });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const service = await get('SELECT * FROM services WHERE id = ?', [req.params.id]);
    if (!service) { res.json({ success: false, error: 'Service not found' }); return; }
    res.json({ success: true, data: service });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data.customer_name) { res.json({ success: false, error: 'Customer name is required' }); return; }
    const partsCost = Number(data.parts_cost) || 0;
    const serviceCharge = Number(data.service_charge) || 0;
    const totalCharge = partsCost + serviceCharge;
    await run(`INSERT INTO services (customer_name, customer_phone, device_type, brand, model, serial_number, issue, parts, parts_cost, service_charge, total_charge, status, technician, received_date, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [data.customer_name, data.customer_phone || '', data.device_type || '', data.brand || '', data.model || '', data.serial_number || '', data.issue || '', data.parts || '', partsCost, serviceCharge, totalCharge, data.status || 'pending', data.technician || '', data.received_date || new Date().toISOString().split('T')[0], data.notes || '']);
    const result = await get('SELECT * FROM services ORDER BY id DESC LIMIT 1');
    res.json({ success: true, data: result, message: 'Service record created' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM services WHERE id = ?', [req.params.id]);
    if (!existing) { res.json({ success: false, error: 'Service not found' }); return; }
    const data = req.body;
    const partsCost = Number(data.parts_cost ?? existing.parts_cost);
    const serviceCharge = Number(data.service_charge ?? existing.service_charge);
    const totalCharge = partsCost + serviceCharge;
    const completedDate = data.status === 'completed' && existing.status !== 'completed' ? new Date().toISOString().split('T')[0] : (data.completed_date || existing.completed_date);
    await run(`UPDATE services SET customer_name=?, customer_phone=?, device_type=?, brand=?, model=?, serial_number=?, issue=?, parts=?, parts_cost=?, service_charge=?, total_charge=?, status=?, technician=?, completed_date=?, notes=? WHERE id=?`,
      [data.customer_name || existing.customer_name, data.customer_phone ?? existing.customer_phone, data.device_type ?? existing.device_type, data.brand ?? existing.brand, data.model ?? existing.model, data.serial_number ?? existing.serial_number, data.issue ?? existing.issue, data.parts ?? existing.parts, partsCost, serviceCharge, totalCharge, data.status || existing.status, data.technician ?? existing.technician, completedDate, data.notes ?? existing.notes, req.params.id]);
    res.json({ success: true, data: await get('SELECT * FROM services WHERE id = ?', [req.params.id]), message: 'Service updated' });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await run('DELETE FROM services WHERE id = ?', [req.params.id]); res.json({ success: true, message: 'Service record deleted' }); }
  catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
