const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

function getCompany() {
  return {
    name: get("SELECT value FROM settings WHERE key='company_name'")?.value || 'Aditya Enterprises',
    address: get("SELECT value FROM settings WHERE key='company_address'")?.value || '',
    gstin: get("SELECT value FROM settings WHERE key='company_gstin'")?.value || '',
    phone: get("SELECT value FROM settings WHERE key='company_phone'")?.value || '',
  };
}

function formatINR(n) { return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }

// GET dashboard summary data (JSON)
router.get('/dashboard', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const todaySales = all("SELECT * FROM sales WHERE sale_date = ? ORDER BY created_at DESC", [today]);
    const monthSales = all("SELECT * FROM sales WHERE sale_date >= ? ORDER BY created_at DESC", [firstOfMonth]);
    const allSales = all("SELECT * FROM sales ORDER BY created_at DESC");

    const todayTotal = todaySales.reduce((s, sale) => s + sale.grand_total, 0);
    const monthTotal = monthSales.reduce((s, sale) => s + sale.grand_total, 0);
    const todayCount = todaySales.length;
    const monthCount = monthSales.length;

    res.json({
      success: true, data: {
        today: { count: todayCount, revenue: Math.round(todayTotal * 100) / 100, sales: todaySales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') })) },
        month: { count: monthCount, revenue: Math.round(monthTotal * 100) / 100, sales: monthSales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') })) },
        allTime: { count: allSales.length, revenue: Math.round(allSales.reduce((s, sale) => s + sale.grand_total, 0) * 100) / 100 }
      }
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET per-product sales analysis
router.get('/by-product', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let where = '1=1'; const params = [];
    if (start_date) { where += ' AND s.sale_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND s.sale_date <= ?'; params.push(end_date); }

    const sales = all(`SELECT * FROM sales WHERE ${where} ORDER BY sale_date`, params);

    const productMap = {};
    sales.forEach(sale => {
      const items = JSON.parse(sale.items || '[]');
      items.forEach(item => {
        const key = item.product_name || 'Unknown';
        if (!productMap[key]) productMap[key] = { name: key, hsn: item.hsn_code || '', totalQuantity: 0, totalRevenue: 0, saleCount: 0 };
        productMap[key].totalQuantity += item.quantity || 0;
        productMap[key].totalRevenue += (item.sell_price || 0) * (item.quantity || 0);
        productMap[key].saleCount += 1;
      });
    });

    const products = Object.values(productMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
    res.json({ success: true, data: products });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET customer analysis with repeat detection
router.get('/by-customer', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let where = '1=1'; const params = [];
    if (start_date) { where += ' AND sale_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND sale_date <= ?'; params.push(end_date); }

    const sales = all(`SELECT * FROM sales WHERE ${where} ORDER BY sale_date`, params);

    const customerMap = {};
    sales.forEach(sale => {
      const name = sale.customer_name || 'Walk-in Customer';
      if (!customerMap[name]) {
        customerMap[name] = {
          name, phone: sale.customer_phone || '', gstin: sale.customer_gstin || '',
          address: sale.customer_address || '', visitCount: 0, totalSpent: 0,
          firstVisit: sale.sale_date, lastVisit: sale.sale_date, invoices: [], isRepeat: false
        };
      }
      const c = customerMap[name];
      c.visitCount += 1;
      c.totalSpent += sale.grand_total || 0;
      if (sale.sale_date < c.firstVisit) c.firstVisit = sale.sale_date;
      if (sale.sale_date > c.lastVisit) c.lastVisit = sale.sale_date;
      c.invoices.push(sale.invoice_number);
      c.isRepeat = c.visitCount > 1;
    });

    const customers = Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent);
    const repeatCustomers = customers.filter(c => c.isRepeat);
    const newCustomers = customers.filter(c => !c.isRepeat);

    res.json({
      success: true, data: {
        customers,
        summary: {
          totalCustomers: customers.length,
          repeatCustomers: repeatCustomers.length,
          newCustomers: newCustomers.length,
          repeatRevenue: repeatCustomers.reduce((s, c) => s + c.totalSpent, 0),
          topCustomers: repeatCustomers.slice(0, 10)
        }
      }
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET daily sales report (JSON)
router.get('/daily', (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];
    const sales = all("SELECT * FROM sales WHERE sale_date = ? ORDER BY created_at", [reportDate]);
    const parsed = sales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') }));

    const totalRevenue = parsed.reduce((sum, s) => sum + s.grand_total, 0);
    const totalCgst = parsed.reduce((sum, s) => sum + s.cgst_total, 0);
    const totalSgst = parsed.reduce((sum, s) => sum + s.sgst_total, 0);
    const totalIgst = parsed.reduce((sum, s) => sum + s.igst_total, 0);
    const totalDiscount = parsed.reduce((sum, s) => sum + s.discount_total, 0);

    const paymentModes = {};
    parsed.forEach(s => { const m = s.payment_mode || 'cash'; paymentModes[m] = (paymentModes[m] || 0) + s.grand_total; });

    res.json({
      success: true, data: {
        date: reportDate, totalInvoices: parsed.length, totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCgst: Math.round(totalCgst * 100) / 100, totalSgst: Math.round(totalSgst * 100) / 100,
        totalIgst: Math.round(totalIgst * 100) / 100, totalDiscount: Math.round(totalDiscount * 100) / 100,
        paymentModes, sales: parsed
      }
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET monthly sales report (JSON)
router.get('/monthly', (req, res) => {
  try {
    const { month } = req.query;
    const today = new Date();
    const [y, m] = month ? month.split('-') : [today.getFullYear(), today.getMonth() + 1];
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    const sales = all("SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ? ORDER BY sale_date", [startDate, endDate]);
    const parsed = sales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') }));

    const totalRevenue = parsed.reduce((sum, s) => sum + s.grand_total, 0);
    const totalCgst = parsed.reduce((sum, s) => sum + s.cgst_total, 0);
    const totalSgst = parsed.reduce((sum, s) => sum + s.sgst_total, 0);
    const totalIgst = parsed.reduce((sum, s) => sum + s.igst_total, 0);
    const totalDiscount = parsed.reduce((sum, s) => sum + s.discount_total, 0);

    // Daily breakdown
    const dailyBreakdown = {};
    parsed.forEach(s => {
      if (!dailyBreakdown[s.sale_date]) dailyBreakdown[s.sale_date] = { date: s.sale_date, invoices: 0, revenue: 0 };
      dailyBreakdown[s.sale_date].invoices += 1;
      dailyBreakdown[s.sale_date].revenue += s.grand_total;
    });

    // Product breakdown
    const productMap = {};
    parsed.forEach(sale => {
      sale.items.forEach(item => {
        const k = item.product_name || 'Unknown';
        if (!productMap[k]) productMap[k] = { name: k, quantity: 0, revenue: 0 };
        productMap[k].quantity += item.quantity || 0;
        productMap[k].revenue += (item.sell_price || 0) * (item.quantity || 0);
      });
    });

    res.json({
      success: true, data: {
        period: `${startDate} to ${endDate}`, totalInvoices: parsed.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100, totalCgst: Math.round(totalCgst * 100) / 100,
        totalSgst: Math.round(totalSgst * 100) / 100, totalIgst: Math.round(totalIgst * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        dailyBreakdown: Object.values(dailyBreakdown).sort((a, b) => a.date.localeCompare(b.date)),
        productBreakdown: Object.values(productMap).sort((a, b) => b.revenue - a.revenue),
        sales: parsed
      }
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET daily report PDF
router.get('/daily/pdf', (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];
    const sales = all("SELECT * FROM sales WHERE sale_date = ? ORDER BY created_at", [reportDate]);
    const parsed = sales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') }));
    const company = getCompany();

    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Daily_Sales_Report_${reportDate}.pdf"`);
      res.send(Buffer.concat(chunks));
    });

    doc.fontSize(16).font('Helvetica-Bold').text('DAILY SALES REPORT', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(company.name, { align: 'center' });
    doc.text(`Date: ${reportDate}`, { align: 'center' });
    doc.moveDown();

    const totalRev = parsed.reduce((s, x) => s + x.grand_total, 0);
    const totalCGST = parsed.reduce((s, x) => s + x.cgst_total, 0);
    const totalSGST = parsed.reduce((s, x) => s + x.sgst_total, 0);

    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`Total Invoices: ${parsed.length}`, { continued: false });
    doc.text(`Total Revenue: Rs.${formatINR(totalRev)}`);
    doc.text(`Total CGST: Rs.${formatINR(totalCGST)}  |  SGST: Rs.${formatINR(totalSGST)}`);
    doc.moveDown();

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('INVOICE DETAILS', { underline: true });
    doc.moveDown(0.5);

    parsed.forEach((sale, i) => {
      doc.fontSize(8).font('Helvetica-Bold').text(`#${i + 1}  ${sale.invoice_number}  |  ${sale.customer_name}  |  Rs.${formatINR(sale.grand_total)}`);
      doc.fontSize(7).font('Helvetica');
      sale.items.forEach(item => {
        doc.text(`   ${item.product_name}  x${item.quantity}  @Rs.${item.sell_price}  Disc:${item.discount_percent || 0}%`);
      });
      if (i < parsed.length - 1) doc.moveDown(0.3);
    });

    const y = doc.y + 10;
    if (y > 700) doc.addPage();
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Total for ${reportDate}: Rs.${formatINR(totalRev)}`, { align: 'right' });
    doc.moveDown();
    doc.fontSize(7).font('Helvetica').text('Generated by Aditya Enterprises ERP 2026', { align: 'center' });
    doc.end();
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET monthly report PDF
router.get('/monthly/pdf', (req, res) => {
  try {
    const { month } = req.query;
    const today = new Date();
    const [y, m] = month ? month.split('-') : [today.getFullYear(), today.getMonth() + 1];
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const periodName = `${monthNames[parseInt(m)-1]} ${y}`;

    const sales = all("SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ? ORDER BY sale_date", [startDate, endDate]);
    const parsed = sales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') }));
    const company = getCompany();

    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Monthly_Sales_Report_${periodName.replace(' ','_')}.pdf"`);
      res.send(Buffer.concat(chunks));
    });

    const totalRev = parsed.reduce((s, x) => s + x.grand_total, 0);
    const totalCGST = parsed.reduce((s, x) => s + x.cgst_total, 0);
    const totalSGST = parsed.reduce((s, x) => s + x.sgst_total, 0);
    const totalDisc = parsed.reduce((s, x) => s + x.discount_total, 0);

    // Daily breakdown
    const dailyMap = {};
    parsed.forEach(s => { if (!dailyMap[s.sale_date]) dailyMap[s.sale_date] = { invoices: 0, revenue: 0 }; dailyMap[s.sale_date].invoices++; dailyMap[s.sale_date].revenue += s.grand_total; });

    // Product breakdown
    const prodMap = {};
    parsed.forEach(sale => { sale.items.forEach(item => { const k = item.product_name || 'Unknown'; if (!prodMap[k]) prodMap[k] = { qty: 0, rev: 0 }; prodMap[k].qty += item.quantity || 0; prodMap[k].rev += (item.sell_price || 0) * (item.quantity || 0); }); });

    // Customer breakdown
    const custMap = {};
    parsed.forEach(sale => { const n = sale.customer_name || 'Walk-in'; if (!custMap[n]) custMap[n] = { visits: 0, spent: 0 }; custMap[n].visits++; custMap[n].spent += sale.grand_total; });
    const repeatCust = Object.values(custMap).filter(c => c.visits > 1);

    // HEADER
    doc.fontSize(16).font('Helvetica-Bold').text('MONTHLY SALES REPORT', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`${company.name}  |  ${company.address}`, { align: 'center' });
    doc.text(`Period: ${periodName}  (${startDate} to ${endDate})`, { align: 'center' });
    doc.moveDown();

    // SUMMARY BOX
    doc.rect(30, doc.y, 535, 60).stroke();
    const sy = doc.y + 5;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(`Total Invoices: ${parsed.length}`, 40, sy);
    doc.text(`Total Revenue: Rs.${formatINR(totalRev)}`, 200, sy);
    doc.text(`Total Discount: Rs.${formatINR(totalDisc)}`, 370, sy);
    doc.text(`CGST: Rs.${formatINR(totalCGST)}`, 40, sy + 22);
    doc.text(`SGST: Rs.${formatINR(totalSGST)}`, 200, sy + 22);
    doc.text(`Repeat Customers: ${repeatCust.length}`, 370, sy + 22);
    doc.text(`Avg. Invoice: Rs.${parsed.length > 0 ? formatINR(totalRev / parsed.length) : '0'}`, 40, sy + 42);
    doc.text(`Avg. Daily: Rs.${formatINR(totalRev / lastDay)}`, 200, sy + 42);
    doc.moveDown(4);

    // DAILY BREAKDOWN TABLE
    doc.fontSize(11).font('Helvetica-Bold').text('Daily Breakdown');
    doc.moveDown(0.3);
    const dailyArr = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0]));
    doc.fontSize(8);
    doc.text('Date              Invoices        Revenue', { underline: true });
    dailyArr.forEach(([date, d]) => {
      doc.text(`${date}        ${String(d.invoices).padStart(8)}        Rs.${formatINR(d.revenue).padStart(12)}`);
    });
    doc.moveDown();

    // TOP PRODUCTS
    if (doc.y > 600) doc.addPage();
    doc.fontSize(11).font('Helvetica-Bold').text('Top Products');
    doc.moveDown(0.3);
    const topProd = Object.values(prodMap).sort((a, b) => b.rev - a.rev).slice(0, 10);
    doc.fontSize(8);
    doc.text('Product                    Qty Sold        Revenue');
    topProd.forEach(p => {
      doc.text(`${(p.name || '').substring(0, 25).padEnd(27)} ${String(p.qty).padStart(8)}    Rs.${formatINR(p.rev).padStart(12)}`);
    });
    doc.moveDown();

    // REPEAT CUSTOMERS
    if (repeatCust.length > 0) {
      if (doc.y > 680) doc.addPage();
      doc.fontSize(11).font('Helvetica-Bold').text('Repeat Customers');
      doc.moveDown(0.3);
      const topCust = Object.entries(custMap).filter(([,c]) => c.visits > 1).sort((a,b) => b[1].spent - a[1].spent).slice(0, 15);
      doc.fontSize(8);
      doc.text('Customer                          Visits        Total Spent');
      topCust.forEach(([name, c]) => {
        doc.text(`${name.substring(0, 33).padEnd(35)} ${String(c.visits).padStart(5)}    Rs.${formatINR(c.spent).padStart(12)}`);
      });
    }

    doc.moveDown(2);
    doc.fontSize(7).font('Helvetica').text('Generated by Aditya Enterprises ERP 2026', { align: 'center' });

    // INVOICE DETAIL
    doc.addPage();
    doc.fontSize(12).font('Helvetica-Bold').text('Invoice Details', { align: 'center' });
    doc.moveDown();
    parsed.forEach((sale, i) => {
      if (doc.y > 720) doc.addPage();
      doc.fontSize(8).font('Helvetica-Bold').text(`${sale.invoice_number}  |  ${sale.sale_date}  |  ${sale.customer_name}  |  Rs.${formatINR(sale.grand_total)}  |  ${sale.payment_mode}`);
      doc.fontSize(7).font('Helvetica');
      sale.items.forEach(item => {
        doc.text(`  ${item.product_name}  x${item.quantity}  @Rs.${item.sell_price || 0}  Disc:${item.discount_percent || 0}%`);
      });
      doc.moveDown(0.2);
    });

    doc.end();
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET CSV export
router.get('/csv', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let where = '1=1'; const params = [];
    if (start_date) { where += ' AND sale_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND sale_date <= ?'; params.push(end_date); }
    const sales = all(`SELECT * FROM sales WHERE ${where} ORDER BY sale_date`, params);

    let csv = 'Invoice No,Date,Customer,Phone,GSTIN,Items,Subtotal,Discount,CGST,SGST,IGST,Grand Total,Payment Mode\n';
    sales.forEach(sale => {
      const items = JSON.parse(sale.items || '[]');
      const itemDesc = items.map(i => `${i.product_name} x${i.quantity}`).join('; ');
      csv += `${sale.invoice_number},${sale.sale_date},"${sale.customer_name}","${sale.customer_phone}","${sale.customer_gstin}","${itemDesc}",${sale.subtotal},${sale.discount_total},${sale.cgst_total},${sale.sgst_total},${sale.igst_total},${sale.grand_total},${sale.payment_mode}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Sales_Report_${start_date || 'all'}_${end_date || 'all'}.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
