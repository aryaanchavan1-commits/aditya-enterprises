const express = require('express');
const router = express.Router();
const { get, all } = require('../db');
const PDFDocument = require('pdfkit');

function getCompany(settings) {
  return { name: settings['company_name'] || 'Aditya Enterprises', address: settings['company_address'] || '', gstin: settings['company_gstin'] || '', phone: settings['company_phone'] || '' };
}

function formatINR(n) { return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }

router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const todaySales = await all("SELECT * FROM sales WHERE sale_date = ? ORDER BY created_at DESC", [today]);
    const monthSales = await all("SELECT * FROM sales WHERE sale_date >= ? ORDER BY created_at DESC", [firstOfMonth]);
    const allSales = await all("SELECT * FROM sales ORDER BY created_at DESC");
    const todayTotal = todaySales.reduce((s, sale) => s + sale.grand_total, 0);
    const monthTotal = monthSales.reduce((s, sale) => s + sale.grand_total, 0);
    res.json({ success: true, data: { today: { count: todaySales.length, revenue: Math.round(todayTotal * 100) / 100, sales: todaySales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') })) }, month: { count: monthSales.length, revenue: Math.round(monthTotal * 100) / 100, sales: monthSales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') })) }, allTime: { count: allSales.length, revenue: Math.round(allSales.reduce((s, sale) => s + sale.grand_total, 0) * 100) / 100 } } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/by-product', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let where = '1=1'; const params = [];
    if (start_date) { where += ' AND s.sale_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND s.sale_date <= ?'; params.push(end_date); }
    const sales = await all(`SELECT * FROM sales WHERE ${where} ORDER BY sale_date`, params);
    const productMap = {};
    sales.forEach(sale => { const items = JSON.parse(sale.items || '[]'); items.forEach(item => { const key = item.product_name || 'Unknown'; if (!productMap[key]) productMap[key] = { name: key, hsn: item.hsn_code || '', totalQuantity: 0, totalRevenue: 0, saleCount: 0 }; productMap[key].totalQuantity += item.quantity || 0; productMap[key].totalRevenue += (item.sell_price || 0) * (item.quantity || 0); productMap[key].saleCount += 1; }); });
    res.json({ success: true, data: Object.values(productMap).sort((a, b) => b.totalRevenue - a.totalRevenue) });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/by-customer', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let where = '1=1'; const params = [];
    if (start_date) { where += ' AND sale_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND sale_date <= ?'; params.push(end_date); }
    const sales = await all(`SELECT * FROM sales WHERE ${where} ORDER BY sale_date`, params);
    const customerMap = {};
    sales.forEach(sale => {
      const name = sale.customer_name || 'Walk-in Customer';
      if (!customerMap[name]) { customerMap[name] = { name, phone: sale.customer_phone || '', gstin: sale.customer_gstin || '', address: sale.customer_address || '', visitCount: 0, totalSpent: 0, firstVisit: sale.sale_date, lastVisit: sale.sale_date, invoices: [], isRepeat: false }; }
      const c = customerMap[name]; c.visitCount += 1; c.totalSpent += sale.grand_total || 0;
      if (sale.sale_date < c.firstVisit) c.firstVisit = sale.sale_date;
      if (sale.sale_date > c.lastVisit) c.lastVisit = sale.sale_date;
      c.invoices.push(sale.invoice_number); c.isRepeat = c.visitCount > 1;
    });
    const customers = Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent);
    res.json({ success: true, data: { customers, summary: { totalCustomers: customers.length, repeatCustomers: customers.filter(c => c.isRepeat).length, newCustomers: customers.filter(c => !c.isRepeat).length, repeatRevenue: customers.filter(c => c.isRepeat).reduce((s, c) => s + c.totalSpent, 0), topCustomers: customers.filter(c => c.isRepeat).slice(0, 10) } } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];
    const sales = await all("SELECT * FROM sales WHERE sale_date = ? ORDER BY created_at", [reportDate]);
    const parsed = sales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') }));
    const totalRevenue = parsed.reduce((sum, s) => sum + s.grand_total, 0);
    const totalCgst = parsed.reduce((sum, s) => sum + s.cgst_total, 0);
    const totalSgst = parsed.reduce((sum, s) => sum + s.sgst_total, 0);
    const totalIgst = parsed.reduce((sum, s) => sum + s.igst_total, 0);
    const totalDiscount = parsed.reduce((sum, s) => sum + s.discount_total, 0);
    const paymentModes = {};
    parsed.forEach(s => { const m = s.payment_mode || 'cash'; paymentModes[m] = (paymentModes[m] || 0) + s.grand_total; });
    res.json({ success: true, data: { date: reportDate, totalInvoices: parsed.length, totalRevenue: Math.round(totalRevenue * 100) / 100, totalCgst: Math.round(totalCgst * 100) / 100, totalSgst: Math.round(totalSgst * 100) / 100, totalIgst: Math.round(totalIgst * 100) / 100, totalDiscount: Math.round(totalDiscount * 100) / 100, paymentModes, sales: parsed } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/monthly', async (req, res) => {
  try {
    const { month } = req.query;
    const today = new Date();
    const [y, m] = month ? month.split('-') : [today.getFullYear(), today.getMonth() + 1];
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    const sales = await all("SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ? ORDER BY sale_date", [startDate, endDate]);
    const parsed = sales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') }));
    const totalRevenue = parsed.reduce((sum, s) => sum + s.grand_total, 0);
    const totalCgst = parsed.reduce((sum, s) => sum + s.cgst_total, 0);
    const totalSgst = parsed.reduce((sum, s) => sum + s.sgst_total, 0);
    const totalIgst = parsed.reduce((sum, s) => sum + s.igst_total, 0);
    const totalDiscount = parsed.reduce((sum, s) => sum + s.discount_total, 0);
    const dailyBreakdown = {};
    parsed.forEach(s => { if (!dailyBreakdown[s.sale_date]) dailyBreakdown[s.sale_date] = { date: s.sale_date, invoices: 0, revenue: 0 }; dailyBreakdown[s.sale_date].invoices += 1; dailyBreakdown[s.sale_date].revenue += s.grand_total; });
    const productMap = {};
    parsed.forEach(sale => { sale.items.forEach(item => { const k = item.product_name || 'Unknown'; if (!productMap[k]) productMap[k] = { name: k, quantity: 0, revenue: 0 }; productMap[k].quantity += item.quantity || 0; productMap[k].revenue += (item.sell_price || 0) * (item.quantity || 0); }); });
    res.json({ success: true, data: { period: `${startDate} to ${endDate}`, totalInvoices: parsed.length, totalRevenue: Math.round(totalRevenue * 100) / 100, totalCgst: Math.round(totalCgst * 100) / 100, totalSgst: Math.round(totalSgst * 100) / 100, totalIgst: Math.round(totalIgst * 100) / 100, totalDiscount: Math.round(totalDiscount * 100) / 100, dailyBreakdown: Object.values(dailyBreakdown).sort((a, b) => a.date.localeCompare(b.date)), productBreakdown: Object.values(productMap).sort((a, b) => b.revenue - a.revenue), sales: parsed } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/daily/pdf', async (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];
    const sales = await all("SELECT * FROM sales WHERE sale_date = ? ORDER BY created_at", [reportDate]);
    const parsed = sales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') }));
    const settings = {}; (await all('SELECT * FROM settings')).forEach(s => settings[s.key] = s.value);
    const company = getCompany(settings);
    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    const chunks = []; doc.on('data', c => chunks.push(c));
    doc.on('end', () => { res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="Daily_Sales_Report_${reportDate}.pdf"`); res.send(Buffer.concat(chunks)); });
    doc.fontSize(16).font('Helvetica-Bold').text('DAILY SALES REPORT', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(company.name, { align: 'center' }); doc.text(`Date: ${reportDate}`, { align: 'center' }); doc.moveDown();
    const totalRev = parsed.reduce((s, x) => s + x.grand_total, 0); const totalCGST = parsed.reduce((s, x) => s + x.cgst_total, 0); const totalSGST = parsed.reduce((s, x) => s + x.sgst_total, 0);
    doc.fontSize(11).font('Helvetica-Bold'); doc.text(`Total Invoices: ${parsed.length}`); doc.text(`Total Revenue: Rs.${formatINR(totalRev)}`); doc.text(`Total CGST: Rs.${formatINR(totalCGST)}  |  SGST: Rs.${formatINR(totalSGST)}`); doc.moveDown();
    doc.fontSize(9).font('Helvetica-Bold').text('INVOICE DETAILS', { underline: true }); doc.moveDown(0.5);
    parsed.forEach((sale, i) => {
      doc.fontSize(8).font('Helvetica-Bold').text(`#${i + 1}  ${sale.invoice_number}  |  ${sale.customer_name}  |  Rs.${formatINR(sale.grand_total)}`);
      doc.fontSize(7).font('Helvetica'); sale.items.forEach(item => { doc.text(`   ${item.product_name}  x${item.quantity}  @Rs.${item.sell_price}  Disc:${item.discount_percent || 0}%`); });
      if (i < parsed.length - 1) doc.moveDown(0.3);
    });
    doc.moveDown(); doc.fontSize(10).font('Helvetica-Bold').text(`Total for ${reportDate}: Rs.${formatINR(totalRev)}`, { align: 'right' });
    doc.fontSize(7).font('Helvetica').text('Generated by Aditya Enterprises ERP Web', { align: 'center' }); doc.end();
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/monthly/pdf', async (req, res) => {
  try {
    const { month } = req.query; const today = new Date();
    const [y, m] = month ? month.split('-') : [today.getFullYear(), today.getMonth() + 1];
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`; const lastDay = new Date(y, m, 0).getDate(); const endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; const periodName = `${monthNames[parseInt(m)-1]} ${y}`;
    const sales = await all("SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ? ORDER BY sale_date", [startDate, endDate]);
    const parsed = sales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') }));
    const settings = {}; (await all('SELECT * FROM settings')).forEach(s => settings[s.key] = s.value);
    const company = getCompany(settings);
    const doc = new PDFDocument({ size: 'A4', margin: 30 }); const chunks = [];
    doc.on('data', c => chunks.push(c)); doc.on('end', () => { res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="Monthly_Sales_Report_${periodName.replace(' ','_')}.pdf"`); res.send(Buffer.concat(chunks)); });
    const totalRev = parsed.reduce((s, x) => s + x.grand_total, 0); const totalCGST = parsed.reduce((s, x) => s + x.cgst_total, 0); const totalSGST = parsed.reduce((s, x) => s + x.sgst_total, 0); const totalDisc = parsed.reduce((s, x) => s + x.discount_total, 0);
    const dailyMap = {}; parsed.forEach(s => { if (!dailyMap[s.sale_date]) dailyMap[s.sale_date] = { invoices: 0, revenue: 0 }; dailyMap[s.sale_date].invoices++; dailyMap[s.sale_date].revenue += s.grand_total; });
    const prodMap = {}; parsed.forEach(sale => { sale.items.forEach(item => { const k = item.product_name || 'Unknown'; if (!prodMap[k]) prodMap[k] = { qty: 0, rev: 0 }; prodMap[k].qty += item.quantity || 0; prodMap[k].rev += (item.sell_price || 0) * (item.quantity || 0); }); });
    const custMap = {}; parsed.forEach(sale => { const n = sale.customer_name || 'Walk-in'; if (!custMap[n]) custMap[n] = { visits: 0, spent: 0 }; custMap[n].visits++; custMap[n].spent += sale.grand_total; });
    const repeatCust = Object.values(custMap).filter(c => c.visits > 1);
    doc.fontSize(16).font('Helvetica-Bold').text('MONTHLY SALES REPORT', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`${company.name}  |  ${company.address}`, { align: 'center' }); doc.text(`Period: ${periodName}  (${startDate} to ${endDate})`, { align: 'center' }); doc.moveDown();
    doc.rect(30, doc.y, 535, 60).stroke(); const sy = doc.y + 5;
    doc.fontSize(9).font('Helvetica-Bold'); doc.text(`Total Invoices: ${parsed.length}`, 40, sy); doc.text(`Total Revenue: Rs.${formatINR(totalRev)}`, 200, sy); doc.text(`Total Discount: Rs.${formatINR(totalDisc)}`, 370, sy);
    doc.text(`CGST: Rs.${formatINR(totalCGST)}`, 40, sy + 22); doc.text(`SGST: Rs.${formatINR(totalSGST)}`, 200, sy + 22); doc.text(`Repeat Customers: ${repeatCust.length}`, 370, sy + 22);
    doc.text(`Avg. Invoice: Rs.${parsed.length > 0 ? formatINR(totalRev / parsed.length) : '0'}`, 40, sy + 42); doc.text(`Avg. Daily: Rs.${formatINR(totalRev / lastDay)}`, 200, sy + 42); doc.moveDown(4);
    doc.fontSize(11).font('Helvetica-Bold').text('Daily Breakdown'); doc.moveDown(0.3);
    const dailyArr = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0]));
    doc.fontSize(8); doc.text('Date              Invoices        Revenue', { underline: true });
    dailyArr.forEach(([date, d]) => { doc.text(`${date}        ${String(d.invoices).padStart(8)}        Rs.${formatINR(d.revenue).padStart(12)}`); }); doc.moveDown();
    if (doc.y > 600) doc.addPage(); doc.fontSize(11).font('Helvetica-Bold').text('Top Products'); doc.moveDown(0.3);
    const topProd = Object.values(prodMap).sort((a, b) => b.rev - a.rev).slice(0, 10);
    doc.fontSize(8); doc.text('Product                    Qty Sold        Revenue');
    topProd.forEach(p => { doc.text(`${(p.name || '').substring(0, 25).padEnd(27)} ${String(p.qty).padStart(8)}    Rs.${formatINR(p.rev).padStart(12)}`); }); doc.moveDown();
    if (repeatCust.length > 0) { if (doc.y > 680) doc.addPage(); doc.fontSize(11).font('Helvetica-Bold').text('Repeat Customers'); doc.moveDown(0.3); const topCust = Object.entries(custMap).filter(([,c]) => c.visits > 1).sort((a,b) => b[1].spent - a[1].spent).slice(0, 15); doc.fontSize(8); doc.text('Customer                          Visits        Total Spent'); topCust.forEach(([name, c]) => { doc.text(`${name.substring(0, 33).padEnd(35)} ${String(c.visits).padStart(5)}    Rs.${formatINR(c.spent).padStart(12)}`); }); }
    doc.moveDown(2); doc.fontSize(7).font('Helvetica').text('Generated by Aditya Enterprises ERP Web', { align: 'center' });
    doc.addPage(); doc.fontSize(12).font('Helvetica-Bold').text('Invoice Details', { align: 'center' }); doc.moveDown();
    parsed.forEach((sale, i) => { if (doc.y > 720) doc.addPage(); doc.fontSize(8).font('Helvetica-Bold').text(`${sale.invoice_number}  |  ${sale.sale_date}  |  ${sale.customer_name}  |  Rs.${formatINR(sale.grand_total)}  |  ${sale.payment_mode}`); doc.fontSize(7).font('Helvetica'); sale.items.forEach(item => { doc.text(`  ${item.product_name}  x${item.quantity}  @Rs.${item.sell_price || 0}  Disc:${item.discount_percent || 0}%`); }); doc.moveDown(0.2); });
    doc.end();
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/csv', async (req, res) => {
  try {
    const { start_date, end_date } = req.query; let where = '1=1'; const params = [];
    if (start_date) { where += ' AND sale_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND sale_date <= ?'; params.push(end_date); }
    const sales = await all(`SELECT * FROM sales WHERE ${where} ORDER BY sale_date`, params);
    let csv = 'Invoice No,Date,Customer,Phone,GSTIN,Items,Subtotal,Discount,CGST,SGST,IGST,Grand Total,Payment Mode\n';
    sales.forEach(sale => { const items = JSON.parse(sale.items || '[]'); const itemDesc = items.map(i => `${i.product_name} x${i.quantity}`).join('; '); csv += `${sale.invoice_number},${sale.sale_date},"${sale.customer_name}","${sale.customer_phone}","${sale.customer_gstin}","${itemDesc}",${sale.subtotal},${sale.discount_total},${sale.cgst_total},${sale.sgst_total},${sale.igst_total},${sale.grand_total},${sale.payment_mode}\n`; });
    res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', `attachment; filename="Sales_Report_${start_date || 'all'}_${end_date || 'all'}.csv"`); res.send(csv);
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/balance-sheet', async (req, res) => {
  try {
    const { year, month } = req.query;
    const today = new Date();
    const y = year || today.getFullYear();
    const m = month || null;
    let startDate, endDate, periodLabel;
    if (m) {
      startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      periodLabel = `${monthNames[parseInt(m)-1]} ${y}`;
    } else {
      startDate = `${y}-01-01`;
      endDate = `${y}-12-31`;
      periodLabel = `Year ${y}`;
    }
    const sales = await all("SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ? ORDER BY sale_date", [startDate, endDate]);
    const purchases = await all("SELECT * FROM purchases WHERE purchase_date >= ? AND purchase_date <= ? ORDER BY purchase_date", [startDate, endDate]);
    const parsedSales = sales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') }));
    const totalRevenue = parsedSales.reduce((sum, s) => sum + s.grand_total, 0);
    const totalCgst = parsedSales.reduce((sum, s) => sum + s.cgst_total, 0);
    const totalSgst = parsedSales.reduce((sum, s) => sum + s.sgst_total, 0);
    const totalDiscount = parsedSales.reduce((sum, s) => sum + s.discount_total, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.grand_total, 0);
    const purchaseGst = purchases.reduce((sum, p) => sum + p.gst_total, 0);
    const totalInvoices = parsedSales.length;
    const totalQuantity = parsedSales.reduce((sum, s) => sum + s.items.reduce((q, i) => q + (i.quantity || 0), 0), 0);
    const netGstPayable = totalCgst + totalSgst - purchaseGst;
    const netProfit = totalRevenue - totalPurchases - totalDiscount;
    const monthlyBreakdown = {};
    for (let i = 1; i <= 12; i++) {
      const ms = `${y}-${String(i).padStart(2, '0')}`;
      monthlyBreakdown[ms] = { month: ms, revenue: 0, expenses: 0, invoices: 0, profit: 0 };
    }
    parsedSales.forEach(s => {
      const key = s.sale_date.substring(0, 7);
      if (monthlyBreakdown[key]) { monthlyBreakdown[key].revenue += s.grand_total; monthlyBreakdown[key].invoices++; }
    });
    purchases.forEach(p => {
      const key = p.purchase_date.substring(0, 7);
      if (monthlyBreakdown[key]) monthlyBreakdown[key].expenses += p.grand_total;
    });
    Object.values(monthlyBreakdown).forEach(mb => mb.profit = mb.revenue - mb.expenses);
    res.json({ success: true, data: { period: periodLabel, startDate, endDate, totalRevenue: Math.round(totalRevenue * 100) / 100, totalCgst: Math.round(totalCgst * 100) / 100, totalSgst: Math.round(totalSgst * 100) / 100, totalDiscount: Math.round(totalDiscount * 100) / 100, totalPurchases: Math.round(totalPurchases * 100) / 100, purchaseGst: Math.round(purchaseGst * 100) / 100, netGstPayable: Math.round(netGstPayable * 100) / 100, netProfit: Math.round(netProfit * 100) / 100, totalInvoices, totalQuantity, sales: parsedSales, purchases, monthlyBreakdown: Object.values(monthlyBreakdown).filter(mb => mb.revenue > 0 || mb.expenses > 0) } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/balance-sheet/pdf', async (req, res) => {
  try {
    const { year, month } = req.query;
    const today = new Date();
    const y = year || today.getFullYear();
    const m = month || null;
    let startDate, endDate, periodLabel, fileName;
    if (m) {
      startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      periodLabel = `${monthNames[parseInt(m)-1]} ${y}`;
      fileName = `Balance_Sheet_${periodLabel.replace(' ','_')}`;
    } else {
      startDate = `${y}-01-01`; endDate = `${y}-12-31`;
      periodLabel = `Year ${y}`;
      fileName = `Balance_Sheet_${y}`;
    }
    const sales = await all("SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ? ORDER BY sale_date", [startDate, endDate]);
    const purchases = await all("SELECT * FROM purchases WHERE purchase_date >= ? AND purchase_date <= ? ORDER BY purchase_date", [startDate, endDate]);
    const parsedSales = sales.map(s => ({ ...s, items: JSON.parse(s.items || '[]') }));
    const totalRevenue = parsedSales.reduce((sum, s) => sum + s.grand_total, 0);
    const totalCgst = parsedSales.reduce((sum, s) => sum + s.cgst_total, 0);
    const totalSgst = parsedSales.reduce((sum, s) => sum + s.sgst_total, 0);
    const totalDiscount = parsedSales.reduce((sum, s) => sum + s.discount_total, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.grand_total, 0);
    const netGstPayable = totalCgst + totalSgst;
    const netProfit = totalRevenue - totalPurchases - totalDiscount;
    const settings = {}; (await all('SELECT * FROM settings')).forEach(s => settings[s.key] = s.value);
    const company = { name: settings['company_name'] || 'Aditya Enterprises', address: settings['company_address'] || '', gstin: settings['company_gstin'] || '' };
    const doc = new PDFDocument({ size: 'A4', margin: 30 }); const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => { res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`); res.send(Buffer.concat(chunks)); });
    doc.fontSize(16).font('Helvetica-Bold').text('BALANCE SHEET', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(company.name, { align: 'center' }); doc.text(`Period: ${periodLabel} (${startDate} to ${endDate})`, { align: 'center' }); doc.moveDown();
    doc.rect(30, doc.y, 535, 80).stroke(); const sy = doc.y + 5;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Total Revenue: Rs.${formatINR(totalRevenue)}`, 40, sy);
    doc.text(`Total Purchases: Rs.${formatINR(totalPurchases)}`, 40, sy + 20);
    doc.text(`Total Discounts: Rs.${formatINR(totalDiscount)}`, 40, sy + 40);
    doc.text(`Gross Profit: Rs.${formatINR(totalRevenue - totalPurchases - totalDiscount)}`, 40, sy + 60);
    doc.text(`Total Invoices: ${parsedSales.length}`, 300, sy);
    doc.text(`CGST Collected: Rs.${formatINR(totalCgst)}`, 300, sy + 20);
    doc.text(`SGST Collected: Rs.${formatINR(totalSgst)}`, 300, sy + 40);
    doc.text(`Net GST Payable: Rs.${formatINR(netGstPayable)}`, 300, sy + 60);
    doc.moveDown(5);
    if (parsedSales.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').text('Sales Invoices'); doc.moveDown(0.3);
      doc.fontSize(8); doc.text('Date         Invoice No         Customer                     Amount');
      parsedSales.forEach(s => {
        doc.text(`${s.sale_date}   ${s.invoice_number.padEnd(18)} ${(s.customer_name || 'Walk-in').substring(0, 22).padEnd(24)} Rs.${formatINR(s.grand_total).padStart(10)}`);
      });
    }
    doc.moveDown(1);
    doc.fontSize(7).font('Helvetica').text('Generated by Aditya Enterprises ERP Web', { align: 'center' });
    doc.end();
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/balance-sheet/csv', async (req, res) => {
  try {
    const { year, month } = req.query;
    const today = new Date();
    const y = year || today.getFullYear();
    const m = month || null;
    let startDate, endDate;
    if (m) {
      startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    } else { startDate = `${y}-01-01`; endDate = `${y}-12-31`; }
    const sales = await all("SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ? ORDER BY sale_date", [startDate, endDate]);
    const purchases = await all("SELECT * FROM purchases WHERE purchase_date >= ? AND purchase_date <= ? ORDER BY purchase_date", [startDate, endDate]);
    let csv = 'Type,Date,Invoice/Ref,Customer/Supplier,Amount,GST,Total\n';
    sales.forEach(s => { csv += `Sale,${s.sale_date},${s.invoice_number},"${s.customer_name}",${s.subtotal},${s.cgst_total + s.sgst_total + s.igst_total},${s.grand_total}\n`; });
    purchases.forEach(p => { csv += `Purchase,${p.purchase_date},${p.invoice_number},"${p.supplier_name}",${p.subtotal},${p.gst_total},${p.grand_total}\n`; });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Balance_Sheet_${y}${m ? '_'+m : ''}.csv"`);
    res.send(csv);
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/low-stock', async (req, res) => {
  try {
    const products = await all('SELECT id, name, quantity, sell_price, inward_price, barcode FROM products WHERE quantity <= 5 ORDER BY quantity ASC');
    res.json({ success: true, data: products });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/low-stock/csv', async (req, res) => {
  try {
    const products = await all('SELECT id, name, quantity, sell_price, inward_price, barcode FROM products WHERE quantity <= 5 ORDER BY quantity ASC');
    let csv = 'Product Name,Quantity,Sell Price,Cost Price,Barcode\n';
    products.forEach(p => { csv += `"${p.name}",${p.quantity},${p.sell_price},${p.inward_price},${p.barcode || ''}\n`; });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Low_Stock_Report.csv"');
    res.send(csv);
  } catch (err) { res.json({ success: false, error: err.message }); }
});

router.get('/low-stock/pdf', async (req, res) => {
  try {
    const products = await all('SELECT id, name, quantity, sell_price, inward_price, barcode FROM products WHERE quantity <= 5 ORDER BY quantity ASC');
    const settings = {}; (await all('SELECT * FROM settings')).forEach(s => settings[s.key] = s.value);
    const company = { name: settings['company_name'] || 'Aditya Enterprises' };
    const doc = new PDFDocument({ size: 'A4', margin: 30 }); const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => { res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'attachment; filename="Low_Stock_Report.pdf"'); res.send(Buffer.concat(chunks)); });
    doc.fontSize(16).font('Helvetica-Bold').text('LOW STOCK REPORT', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(company.name, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' }); doc.moveDown();
    products.forEach(p => {
      doc.fontSize(10).font('Helvetica-Bold').text(`${p.name}  |  Qty: ${p.quantity}  |  Price: Rs.${formatINR(p.sell_price)}`);
    });
    if (products.length === 0) doc.text('No low stock items found.');
    doc.moveDown(2);
    doc.fontSize(7).font('Helvetica').text('Generated by Aditya Enterprises ERP Web', { align: 'center' });
    doc.end();
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
