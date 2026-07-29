const express = require('express');
const router = express.Router();
const { get, all } = require('../db');
const PDFDocument = require('pdfkit');

router.get('/bill/:saleId', async (req, res) => {
  try {
    const sale = await get('SELECT * FROM sales WHERE id = ?', [req.params.saleId]);
    if (!sale) res.json({ success: false, error: 'Sale not found' }); return;
    sale.items = JSON.parse(sale.items || '[]');

    const settings = {};
    const allSettings = await all('SELECT * FROM settings');
    allSettings.forEach(s => settings[s.key] = s.value);

    const company = {
      name: settings.company_name || 'Aditya Enterprises',
      address: settings.company_address || '',
      gstin: settings.company_gstin || '',
      phone: settings.company_phone || '',
      email: settings.company_email || '',
      pan: settings.company_pan || '',
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
    doc.text('HSN/SAC', colX.hsn + 2, tableTop + 4);
    doc.text('Qty', colX.qty + 2, tableTop + 4);
    doc.text('Rate', colX.rate + 2, tableTop + 4);
    doc.text('Disc%', colX.disc + 2, tableTop + 4);
    doc.text('Taxable', colX.taxable + 2, tableTop + 4);
    doc.text('CGST', colX.cgst + 2, tableTop + 4);
    doc.text('SGST', colX.sgst + 2, tableTop + 4);
    doc.text('Total', colX.total + 2, tableTop + 4);

    let y = tableTop + 18;
    sale.items.forEach((item, i) => {
      const lineTotal = item.sell_price * item.quantity;
      const discAmt = lineTotal * (item.discount_percent || 0) / 100;
      const taxable = lineTotal - discAmt;
      const halfGst = 9;
      const cgstAmt = taxable * halfGst / 100;
      const sgstAmt = taxable * halfGst / 100;
      const totalAmt = taxable + cgstAmt + sgstAmt;

      if (y > 750) { doc.addPage(); y = 40; }
      doc.fill('#000000').fontSize(7).font('Helvetica');
      doc.text(String(i + 1), colX.sno + 2, y + 2, { width: colX.sno - 2 });
      doc.text((item.product_name || '').substring(0, 20), colX.desc + 2, y + 2, { width: colX.desc - 2 });
      doc.text(item.hsn_code || '-', colX.hsn + 2, y + 2, { width: colX.hsn - 2 });
      doc.text(String(item.quantity || 0), colX.qty + 2, y + 2, { width: colX.qty - 2 });
      doc.text(Number(item.sell_price || 0).toFixed(2), colX.rate + 2, y + 2, { width: colX.rate - 2 });
      doc.text(String(item.discount_percent || 0), colX.disc + 2, y + 2, { width: colX.disc - 2 });
      doc.text(taxable.toFixed(2), colX.taxable + 2, y + 2, { width: colX.taxable - 2 });
      doc.text(cgstAmt.toFixed(2), colX.cgst + 2, y + 2, { width: colX.cgst - 2 });
      doc.text(sgstAmt.toFixed(2), colX.sgst + 2, y + 2, { width: colX.sgst - 2 });
      doc.text(totalAmt.toFixed(2), colX.total + 2, y + 2, { width: colX.total - 2 });
      y += 16;
    });

    y += 8;
    if (y > 750) { doc.addPage(); y = 40; }
    doc.rect(40, y, cx - 40, 90).stroke();
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(`Subtotal: Rs.${Number(sale.subtotal || 0).toFixed(2)}`, 50, y + 5);
    if (sale.discount_total > 0) doc.text(`Discount: -Rs.${Number(sale.discount_total).toFixed(2)}`, 50, y + 20);
    doc.text(`CGST (9%): Rs.${Number(sale.cgst_total || 0).toFixed(2)}`, 50, y + 35);
    doc.text(`SGST (9%): Rs.${Number(sale.sgst_total || 0).toFixed(2)}`, 50, y + 50);
    if (sale.igst_total > 0) doc.text(`IGST (18%): Rs.${Number(sale.igst_total).toFixed(2)}`, 50, y + 50);
    doc.fontSize(12).font('Helvetica-Bold').text(`GRAND TOTAL: Rs.${Number(sale.grand_total || 0).toFixed(2)}`, 250, y + 65);

    doc.fontSize(7).font('Helvetica').text('Generated by Aditya Enterprises ERP Web', 50, y + 95, { align: 'center' });
    doc.end();
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/report', async (req, res) => {
  try {
    const { month } = req.query;
    const m = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [y, mo] = m.split('-');
    const sd = `${y}-${mo}-01`;
    const ld = new Date(y, mo, 0).getDate();
    const ed = `${y}-${mo}-${String(ld).padStart(2, '0')}`;

    const sales = await all("SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ?", [sd, ed]);
    const totalTaxable = sales.reduce((s, x) => s + (x.subtotal || 0) - (x.discount_total || 0), 0);
    const totalCgst = sales.reduce((s, x) => s + (x.cgst_total || 0), 0);
    const totalSgst = sales.reduce((s, x) => s + (x.sgst_total || 0), 0);
    const totalIgst = sales.reduce((s, x) => s + (x.igst_total || 0), 0);

    res.json({
      success: true, data: {
        month: m, totalInvoices: sales.length,
        taxableValue: Math.round(totalTaxable * 100) / 100,
        cgst: Math.round(totalCgst * 100) / 100,
        sgst: Math.round(totalSgst * 100) / 100,
        igst: Math.round(totalIgst * 100) / 100,
        totalGst: Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100,
        sales: sales.map(s => ({
          invoice: s.invoice_number, date: s.sale_date, customer: s.customer_name,
          taxable: s.subtotal - s.discount_total, cgst: s.cgst_total, sgst: s.sgst_total, total: s.grand_total
        }))
      }
    });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/gstr1', async (req, res) => {
  try {
    const { month } = req.query;
    const m = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [y, mo] = m.split('-');
    const sd = `${y}-${mo}-01`;
    const ld = new Date(y, mo, 0).getDate();
    const ed = `${y}-${mo}-${String(ld).padStart(2, '0')}`;

    const sales = await all("SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ?", [sd, ed]);
    const b2bInvoices = sales.filter(s => s.customer_gstin).map(s => ({
      invoice: s.invoice_number, date: s.sale_date, customer: s.customer_name,
      gstin: s.customer_gstin, taxable: Math.round(((s.subtotal || 0) - (s.discount_total || 0)) * 100) / 100,
      cgst: Math.round((s.cgst_total || 0) * 100) / 100,
      sgst: Math.round((s.sgst_total || 0) * 100) / 100,
      igst: Math.round((s.igst_total || 0) * 100) / 100,
      total: Math.round((s.grand_total || 0) * 100) / 100
    }));
    const b2cCount = sales.filter(s => !s.customer_gstin).length;
    const b2cTotal = sales.filter(s => !s.customer_gstin).reduce((s, x) => s + (x.grand_total || 0), 0);

    res.json({
      success: true, data: {
        month: m, totalInvoices: sales.length,
        b2bInvoices, b2cCount, b2cTotal: Math.round(b2cTotal * 100) / 100,
        summary: {
          totalTaxable: Math.round(sales.reduce((s, x) => s + (x.subtotal || 0) - (x.discount_total || 0), 0) * 100) / 100,
          totalCgst: Math.round(sales.reduce((s, x) => s + (x.cgst_total || 0), 0) * 100) / 100,
          totalSgst: Math.round(sales.reduce((s, x) => s + (x.sgst_total || 0), 0) * 100) / 100,
          totalIgst: Math.round(sales.reduce((s, x) => s + (x.igst_total || 0), 0) * 100) / 100,
        }
      }
    });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
