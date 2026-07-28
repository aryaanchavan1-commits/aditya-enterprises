const express = require('express');
const router = express.Router();
const { get, all } = require('../db');
const PDFDocument = require('pdfkit');
const path = require('path');

router.get('/bill/:saleId', (req, res) => {
  try {
    const sale = get('SELECT * FROM sales WHERE id = ?', [req.params.saleId]);
    if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });
    sale.items = JSON.parse(sale.items || '[]');

    const company = {
      name: get("SELECT value FROM settings WHERE key='company_name'", [])?.value || 'Aditya Enterprises',
      address: get("SELECT value FROM settings WHERE key='company_address'", [])?.value || '',
      gstin: get("SELECT value FROM settings WHERE key='company_gstin'", [])?.value || '',
      phone: get("SELECT value FROM settings WHERE key='company_phone'", [])?.value || '',
      email: get("SELECT value FROM settings WHERE key='company_email'", [])?.value || '',
      pan: get("SELECT value FROM settings WHERE key='company_pan'", [])?.value || '',
    };

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="GST_Invoice_${sale.invoice_number.replace(/\//g, '_')}.pdf"`);
      res.send(Buffer.concat(chunks));
    });

    doc.fontSize(18).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text(company.name, { align: 'center' });
    doc.fontSize(8).font('Helvetica').text(company.address, { align: 'center' });
    doc.text(`Phone: ${company.phone}  |  Email: ${company.email}`, { align: 'center' });
    doc.text(`GSTIN: ${company.gstin}  |  PAN: ${company.pan}`, { align: 'center' });
    doc.moveDown(1);

    const y0 = doc.y;
    doc.rect(40, y0, 515, 60).stroke();
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(`Invoice No: ${sale.invoice_number}`, 50, y0 + 5);
    doc.text(`Date: ${sale.sale_date}`, 50, y0 + 20);
    doc.text(`Payment: ${(sale.payment_mode || 'CASH').toUpperCase()}`, 50, y0 + 35);
    doc.text(`Place of Supply: Maharashtra (27)`, 50, y0 + 50);
    doc.text(`Customer: ${sale.customer_name}`, 320, y0 + 5);
    if (sale.customer_gstin) doc.text(`GSTIN: ${sale.customer_gstin}`, 320, y0 + 20);
    if (sale.customer_phone) doc.text(`Phone: ${sale.customer_phone}`, 320, y0 + 35);
    doc.moveDown(3);

    const tableTop = doc.y;
    const cols = { sno: 30, desc: 150, hsn: 60, qty: 40, rate: 55, disc: 45, taxable: 60, cgst: 50, sgst: 50, total: 55 };
    let cx = 40;
    const colX = {};
    for (const [k, w] of Object.entries(cols)) { colX[k] = cx; cx += w; }

    doc.rect(40, tableTop, cx - 40, 18).fill('#2c3e50');
    doc.fill('#ffffff').fontSize(7).font('Helvetica-Bold');
    doc.text('#', colX.sno + 2, tableTop + 4);
    doc.text('Description', colX.desc + 2, tableTop + 4);
    doc.text('HSN', colX.hsn + 2, tableTop + 4);
    doc.text('Qty', colX.qty + 2, tableTop + 4);
    doc.text('Rate', colX.rate + 2, tableTop + 4);
    doc.text('Disc%', colX.disc + 2, tableTop + 4);
    doc.text('Taxable', colX.taxable + 2, tableTop + 4);
    doc.text('CGST', colX.cgst + 2, tableTop + 4);
    doc.text('SGST', colX.sgst + 2, tableTop + 4);
    doc.text('Total', colX.total + 2, tableTop + 4);
    doc.fill('#000000').font('Helvetica');

    let y = tableTop + 20;
    sale.items.forEach((item, i) => {
      const lineTotal = item.sell_price * item.quantity;
      const discAmt = lineTotal * (item.discount_percent || 0) / 100;
      const taxable = lineTotal - discAmt;
      const cgst = taxable * (9 / 100);
      const sgst = taxable * (9 / 100);
      doc.fontSize(7);
      doc.text(String(i + 1), colX.sno + 2, y + 2);
      doc.text((item.product_name || '').substring(0, 22), colX.desc + 2, y + 2);
      doc.text(item.hsn_code || '-', colX.hsn + 2, y + 2);
      doc.text(String(item.quantity), colX.qty + 2, y + 2);
      doc.text(item.sell_price.toFixed(2), colX.rate + 2, y + 2);
      doc.text((item.discount_percent || 0).toFixed(0), colX.disc + 2, y + 2);
      doc.text(taxable.toFixed(2), colX.taxable + 2, y + 2);
      doc.text(cgst.toFixed(2), colX.cgst + 2, y + 2);
      doc.text(sgst.toFixed(2), colX.sgst + 2, y + 2);
      doc.text((taxable + cgst + sgst).toFixed(2), colX.total + 2, y + 2);
      y += 16;
      doc.moveTo(40, y).lineTo(cx, y).stroke('#cccccc');
    });

    y += 10;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Sub Total:', 330, y); doc.text(`Rs. ${sale.subtotal.toFixed(2)}`, 420, y);
    y += 14;
    if (sale.discount_total > 0) { doc.text('Discount:', 330, y); doc.text(`Rs. ${sale.discount_total.toFixed(2)}`, 420, y); y += 14; }
    doc.text('CGST @9%:', 330, y); doc.text(`Rs. ${sale.cgst_total.toFixed(2)}`, 420, y); y += 14;
    doc.text('SGST @9%:', 330, y); doc.text(`Rs. ${sale.sgst_total.toFixed(2)}`, 420, y); y += 14;
    doc.rect(320, y, 240, 20).fill('#2c3e50');
    doc.fill('#ffffff').text('GRAND TOTAL:', 330, y + 4); doc.text(`Rs. ${sale.grand_total.toFixed(2)}`, 420, y + 4);
    doc.fill('#000000');
    y += 40;
    doc.fontSize(7).font('Helvetica');
    doc.text('Terms: Payment due as per invoice. All disputes subject to local jurisdiction.', 40, y);
    doc.fontSize(8).font('Helvetica-Bold').text('For Aditya Enterprises', 370, y + 20).text('Authorized Signatory', 370, y + 40);
    doc.end();
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/report', (req, res) => {
  try {
    const { start_date, end_date, month } = req.query;
    let where = '1=1'; const params = [];
    if (start_date) { where += ' AND sale_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND sale_date <= ?'; params.push(end_date); }
    if (month) { const [y, m] = month.split('-'); where += ' AND sale_date >= ? AND sale_date <= ?'; params.push(`${y}-${String(m).padStart(2, '0')}-01`); const ld = new Date(y, m, 0).getDate(); params.push(`${y}-${String(m).padStart(2, '0')}-${ld}`); }
    const sales = all(`SELECT * FROM sales WHERE ${where} ORDER BY created_at DESC`, params);
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((s, sa) => s + sa.grand_total, 0);
    const totalCgst = sales.reduce((s, sa) => s + sa.cgst_total, 0);
    const totalSgst = sales.reduce((s, sa) => s + sa.sgst_total, 0);
    const totalIgst = sales.reduce((s, sa) => s + sa.igst_total, 0);
    const totalGst = totalCgst + totalSgst + totalIgst;
    res.json({ success: true, data: { totalSales, totalRevenue, totalCgst, totalSgst, totalIgst, totalGst, sales: sales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') })) } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/gstr1', (req, res) => {
  try {
    const { month } = req.query;
    const today = new Date();
    const [y, m] = month ? month.split('-') : [today.getFullYear(), today.getMonth() + 1];
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const ld = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${ld}`;
    const sales = all('SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ? ORDER BY sale_date', [startDate, endDate]);

    let b2b = [], b2c = [], totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
    sales.forEach(sale => { 
      const items = JSON.parse(sale.items || '[]');
      items.forEach(item => { const lt = item.sell_price * item.quantity; const da = lt * (item.discount_percent || 0) / 100; const tx = lt - da; totalTaxable += tx; totalCgst += tx * (9 / 100); totalSgst += tx * (9 / 100); });
      const entry = { invoice: sale.invoice_number, date: sale.sale_date, customer: sale.customer_name, gstin: sale.customer_gstin, taxable: sale.subtotal - sale.discount_total, cgst: sale.cgst_total, sgst: sale.sgst_total, igst: sale.igst_total, total: sale.grand_total };
      if (sale.customer_gstin) b2b.push(entry); else b2c.push(entry);
    });

    res.json({ success: true, data: { period: `${startDate} to ${endDate}`, summary: { totalSales: sales.length, totalTaxable: Math.round(totalTaxable * 100) / 100, totalCgst: Math.round(totalCgst * 100) / 100, totalSgst: Math.round(totalSgst * 100) / 100, totalIgst: Math.round(totalIgst * 100) / 100, totalGst: Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100 }, b2b, b2c } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
