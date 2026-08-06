const express = require('express');
const router = express.Router();
const { get, all, getDb } = require('../db');

// Central dashboard aggregation - one endpoint powers the whole home page so
// the UI stays thin and the queries are consistent with the rest of the app.
router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    await getDb();

    const [
      totalProducts, totalStockUnits,
      todaySales, monthSales, totalSales,
      lowStockCount, lowStockProducts,
      recentSales, recentMovements,
      dailySales, pendingServices, pendingPurchases,
      todayExpenses, todayIncomes, cashBalance, dueCustomers
    ] = await Promise.all([
      get('SELECT COUNT(*) as c FROM products').then(r => r?.c || 0),
      get('SELECT COALESCE(SUM(quantity),0) as c FROM products').then(r => r?.c || 0),
      all('SELECT grand_total FROM sales WHERE sale_date = ?', [today]),
      all('SELECT grand_total FROM sales WHERE sale_date >= ?', [firstOfMonth]),
      get('SELECT COUNT(*) as c FROM sales').then(r => r?.c || 0),
      get('SELECT COUNT(*) as c FROM products WHERE quantity <= COALESCE(low_stock_threshold, 5)').then(r => r?.c || 0),
      all('SELECT p.id, p.name, p.quantity, p.unit, p.sell_price, p.low_stock_threshold, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.quantity <= COALESCE(p.low_stock_threshold, 5) ORDER BY p.quantity ASC, c.name LIMIT 20'),
      all('SELECT id, invoice_number, customer_name, grand_total, sale_date FROM sales ORDER BY created_at DESC LIMIT 8'),
      all('SELECT sm.*, p.name as product_name FROM stock_movements sm LEFT JOIN products p ON sm.product_id = p.id ORDER BY sm.created_at DESC LIMIT 8'),
      all("SELECT sale_date, SUM(grand_total) as total FROM sales WHERE sale_date >= ? GROUP BY sale_date ORDER BY sale_date ASC", [weekAgo]),
      all("SELECT COUNT(*) as c FROM services WHERE status = 'pending'").then(r => r?.c || 0),
      all("SELECT COUNT(*) as c FROM purchases WHERE payment_status != 'paid'").then(r => r?.c || 0),
      all("SELECT COALESCE(SUM(amount),0) as c FROM expenses WHERE date = ?", [today]).then(r => r?.c || 0),
      all("SELECT COALESCE(SUM(amount),0) as c FROM incomes WHERE date = ?", [today]).then(r => r?.c || 0),
      get("SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END),0) as c FROM cash_book").then(r => r?.c || 0),
      all("SELECT customer_name, customer_phone, COUNT(*) as c, SUM(grand_total) as total FROM sales WHERE payment_mode = 'credit' GROUP BY customer_name ORDER BY total DESC LIMIT 5").then(r => r || [])
    ]);

    const cash = Number(cashBalance);
    res.json({ success: true, data: {
      totalProducts, totalStockUnits,
      todaySales: Math.round(todaySales.reduce((s, x) => s + x.grand_total, 0) * 100) / 100,
      todayInvoices: todaySales.length,
      monthlyRevenue: Math.round(monthSales.reduce((s, x) => s + x.grand_total, 0) * 100) / 100,
      monthInvoices: monthSales.length,
      totalSales,
      lowStock: lowStockCount, lowStockProducts,
      recentSales, recentMovements,
      dailySales,
      pendingServices, pendingPurchases,
      todayExpenses: Math.round(todayExpenses * 100) / 100,
      todayIncomes: Math.round(todayIncomes * 100) / 100,
      cashBalance: Math.round(cash * 100) / 100,
      dueCustomers
    } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
