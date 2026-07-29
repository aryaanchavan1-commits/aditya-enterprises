import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Accounting() {
  const [stats, setStats] = useState({ totalSales: 0, totalPurchases: 0, balance: 0, recentTransactions: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [salesR, purchasesR] = await Promise.all([
          api('/sales'),
          api('/purchases'),
        ]);
        const sales = salesR.success ? salesR.data : [];
        const purchases = purchasesR.success ? purchasesR.data : [];
        const totalSales = sales.reduce((s, i) => s + Number(i.grand_total || 0), 0);
        const totalPurchases = purchases.reduce((s, i) => s + Number(i.grand_total || 0), 0);
        const allTxns = [
          ...sales.map(s => ({ date: s.sale_date || s.created_at, type: 'Sale', ref: s.invoice_number, amount: Number(s.grand_total || 0), party: s.customer_name })),
          ...purchases.map(p => ({ date: p.purchase_date || p.created_at, type: 'Purchase', ref: p.invoice_number, amount: -Number(p.grand_total || 0), party: p.supplier_name })),
        ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 20);
        setStats({ totalSales, totalPurchases, balance: totalSales - totalPurchases, recentTransactions: allTxns });
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="page-container"><p className="text-muted">Loading...</p></div>;

  return (
    <div className="page-container">
      <h3>Accounting</h3>
      <div className="row" style={{ gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Sales</div>
          <div className="stat-value" style={{ color: '#27ae60' }}>&#8377;{stats.totalSales.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Purchases</div>
          <div className="stat-value" style={{ color: '#e74c3c' }}>&#8377;{stats.totalPurchases.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net Balance</div>
          <div className="stat-value" style={{ color: stats.balance >= 0 ? '#27ae60' : '#e74c3c' }}>
            &#8377;{stats.balance.toFixed(2)}
          </div>
        </div>
      </div>

      <h4>Recent Transactions</h4>
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Party</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentTransactions.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted">No transactions yet</td></tr>
            )}
            {stats.recentTransactions.map((t, i) => (
              <tr key={i}>
                <td>{t.date?.split('T')[0]}</td>
                <td><span className={`badge ${t.type === 'Sale' ? 'badge-success' : 'badge-danger'}`}>{t.type}</span></td>
                <td>{t.ref}</td>
                <td>{t.party}</td>
                <td style={{ textAlign: 'right', color: t.amount >= 0 ? '#27ae60' : '#e74c3c' }}>
                  {t.amount >= 0 ? '+' : ''}&#8377;{Math.abs(t.amount).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
