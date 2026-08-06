import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  const load = () => {
    setLoading(true);
    api('/dashboard').then(d => {
      if (!mounted.current) return;
      setLoading(false);
      if (d.success) setStats({ ...d.data, lowStockProducts: d.data.lowStockProducts || [], recentSales: d.data.recentSales || [], recentMovements: d.data.recentMovements || [], dueCustomers: d.data.dueCustomers || [], dailySales: d.data.dailySales || [] });
      else setError(d.error || 'Failed to load dashboard');
    });
  };

  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, []);

  if (loading || !stats) return <div><h2>Dashboard</h2><div style={{ textAlign: 'center', padding: 30, color: '#999' }}>Loading...</div></div>;
  if (error) return <div className="card"><p style={{ color: '#e74c3c', textAlign: 'center', padding: 20 }}>{error}</p><p style={{ textAlign: 'center' }}><button className="btn btn-primary" onClick={load}>Retry</button></p></div>;

  const money = (n) => 'Rs.' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // 7-day sales mini chart (pure CSS bars - no chart library needed).
  const maxDay = Math.max(1, ...stats.dailySales.map(d => Number(d.total)));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayByDate = {};
  stats.dailySales.forEach(d => { dayByDate[d.sale_date] = Number(d.total); });
  const chartDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().split('T')[0];
    chartDays.push({ label: days[d.getDay()], key, total: dayByDate[key] || 0 });
  }

  const statCards = [
    { cls: 'success', label: "Today's Sale", value: money(stats.todaySales), sub: stats.todayInvoices + ' invoice' + (stats.todayInvoices === 1 ? '' : 's') },
    { cls: 'accent', label: 'This Month', value: money(stats.monthlyRevenue), sub: stats.monthInvoices + ' invoice' + (stats.monthInvoices === 1 ? '' : 's') },
    { cls: 'warning', label: 'Low Stock', value: stats.lowStock, sub: 'of ' + stats.totalProducts + ' products' },
    { cls: 'info', label: 'Cash Balance', value: money(stats.cashBalance), sub: 'Rs.' + Number(stats.todayIncomes).toLocaleString('en-IN') + ' in / ' + 'Rs.' + Number(stats.todayExpenses).toLocaleString('en-IN') + ' out today' },
  ];

  const quickActions = [
    { label: 'New Sale', target: 'pos', emoji: '🛒', cls: 'btn-success' },
    { label: 'Add Product', target: 'products', emoji: '📦', cls: 'btn-primary' },
    { label: 'New Purchase', target: 'purchases', emoji: '🧾', cls: 'btn-info' },
    { label: 'Camera Scan', target: 'products', emoji: '📷', cls: 'btn-warning', scan: true },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <button className="btn btn-sm btn-outline" onClick={load}>Refresh</button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginBottom: 16 }}>
        {statCards.map((c, i) => (
          <div className={`stat-card ${c.cls}`} key={i}>
            <span className="stat-value">{c.value}</span>
            <span className="stat-label">{c.label}</span>
            {c.sub && <span style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{c.sub}</span>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {quickActions.map((a, i) => (
          <button
            key={i}
            className={`btn ${a.cls}`}
            onClick={() => onNavigate && onNavigate(a.scan ? 'scan' : a.target)}
            style={{ fontSize: 13 }}
          >
            {a.emoji} {a.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3>Sales - Last 7 Days</h3></div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110, padding: '12px 8px' }}>
          {chartDays.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, color: '#999' }}>{d.total > 0 ? Math.round(d.total).toLocaleString('en-IN') : ''}</span>
              <div style={{ width: '100%', maxWidth: 40, height: `${Math.max(4, (d.total / maxDay) * 60)}px`, background: d.total > 0 ? 'var(--accent2, #3498db)' : '#ecf0f1', borderRadius: '4px 4px 0 0' }} />
              <span style={{ fontSize: 10, color: '#555' }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
        <div className="card">
          <div className="card-header"><h3>⚠️ Low Stock</h3><span className="badge badge-danger">{stats.lowStock}</span></div>
          {stats.lowStockProducts.length > 0 ? (
            <div className="table-container" style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Product</th><th>Stock</th><th>Min</th><th></th></tr></thead>
                <tbody>
                  {stats.lowStockProducts.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td style={{ color: '#e74c3c', fontWeight: 'bold' }}>{p.quantity} {p.unit || 'pcs'}</td>
                      <td style={{ color: '#999' }}>{p.low_stock_threshold || 5}</td>
                      <td><button className="btn btn-sm btn-primary" onClick={() => onNavigate && onNavigate('purchases')}>Restock</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p style={{ color: '#27ae60', textAlign: 'center', padding: 20 }}>✓ All products well stocked</p>}
        </div>

        <div className="card">
          <div className="card-header"><h3>📌 Pending Work</h3></div>
          <div style={{ padding: '4px 12px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span>Pending service jobs</span>
              <strong style={{ color: stats.pendingServices > 0 ? '#e67e22' : '#27ae60' }}>{stats.pendingServices}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span>Unpaid purchases</span>
              <strong style={{ color: stats.pendingPurchases > 0 ? '#e67e22' : '#27ae60' }}>{stats.pendingPurchases}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span>Total stock (units)</span>
              <strong>{Number(stats.totalStockUnits).toLocaleString('en-IN')}</strong>
            </div>
            {(stats.pendingServices > 0 || stats.pendingPurchases > 0) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {stats.pendingServices > 0 && <button className="btn btn-sm btn-outline" onClick={() => onNavigate && onNavigate('services')}>Open Services</button>}
                {stats.pendingPurchases > 0 && <button className="btn btn-sm btn-outline" onClick={() => onNavigate && onNavigate('purchases')}>Open Purchases</button>}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>🕒 Recent Activity</h3></div>
          {stats.recentMovements.length > 0 ? (
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {stats.recentMovements.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                  <div>
                    <span style={{ fontSize: 13 }}>{m.product_name || 'Product'}</span>
                    <span className={`badge ${m.change > 0 ? 'badge-success' : 'badge-danger'}`} style={{ marginLeft: 6 }}>{m.change > 0 ? '+' : ''}{m.change}</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#999' }}>{String(m.created_at || '').replace('T', ' ').slice(0, 16)}</span>
                </div>
              ))}
            </div>
          ) : <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>No stock activity yet</p>}
        </div>

        <div className="card">
          <div className="card-header"><h3>🧾 Recent Sales</h3></div>
          {stats.recentSales.length > 0 ? (
            <div>
              {stats.recentSales.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s.invoice_number}</span>
                    <span style={{ fontSize: 12, color: '#777', marginLeft: 8 }}>{s.customer_name}</span>
                  </div>
                  <strong style={{ fontSize: 13 }}>{money(s.grand_total)}</strong>
                </div>
              ))}
            </div>
          ) : <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>No sales yet</p>}
        </div>
      </div>
    </div>
  );
}
