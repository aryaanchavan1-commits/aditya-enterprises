import React, { useState, useEffect } from 'react';

const API = '/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/sales/stats/dashboard`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setStats({
            ...d.data,
            recentSales: d.data.recentSales || [],
            stockMovements: d.data.stockMovements || [],
          });
        } else {
          setError(d.error || 'Failed to load dashboard');
        }
      })
      .catch(e => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: 36, color: '#e74c3c', marginBottom: 12 }}>!</p>
        <p style={{ color: '#666' }}>Could not load dashboard data</p>
        <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>{error}</p>
        <button className="btn btn-primary" style={{marginTop:16}} onClick={() => { setError(null); setStats(null); window.location.reload(); }}>Retry</button>
      </div>
    );
  }

  if (!stats) return <div className="empty-state"><div className="spinner"></div><p style={{marginTop:12}}>Loading dashboard...</p></div>;

  return (
    <div>
      <h2 style={{marginBottom:20}}>Dashboard</h2>

      <div className="stats-grid">
        <div className="stat-card accent">
          <span className="stat-value">{stats.totalProducts}</span>
          <span className="stat-label">Total Products</span>
        </div>
        <div className="stat-card success">
          <span className="stat-value">{stats.totalQuantity}</span>
          <span className="stat-label">Total Stock Units</span>
        </div>
        <div className="stat-card warning">
          <span className="stat-value">Rs.{Number(stats.todaySales).toLocaleString('en-IN')}</span>
          <span className="stat-label">Today's Sales</span>
        </div>
        <div className="stat-card accent">
          <span className="stat-value">Rs.{Number(stats.monthlyRevenue).toLocaleString('en-IN')}</span>
          <span className="stat-label">Monthly Revenue</span>
        </div>
        <div className="stat-card danger">
          <span className="stat-value">{stats.lowStock}</span>
          <span className="stat-label">Low Stock Alerts</span>
        </div>
        <div className="stat-card success">
          <span className="stat-value">{stats.totalSales}</span>
          <span className="stat-label">Total Invoices</span>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
        <div className="card">
          <div className="card-header"><h3>Recent Sales</h3></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Date</th></tr></thead>
              <tbody>
                {stats.recentSales.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.invoice_number}</strong></td>
                    <td>{s.customer_name}</td>
                    <td>Rs.{Number(s.grand_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    <td>{s.sale_date}</td>
                  </tr>
                ))}
                {stats.recentSales.length === 0 && <tr><td colSpan={4} style={{textAlign:'center',color:'#999'}}>No sales yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Stock Movements</h3></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>Ref</th></tr></thead>
              <tbody>
                {stats.stockMovements.map((m, i) => (
                  <tr key={i}>
                    <td>{m.product_name || 'N/A'}</td>
                    <td><span className={`badge ${m.type==='sale'?'badge-danger':m.type==='barcode_sale'?'badge-warning':'badge-info'}`}>{m.type}</span></td>
                    <td style={{color: m.quantity_change<0?'#e74c3c':'#27ae60', fontWeight:'bold'}}>{m.quantity_change>0?'+':''}{m.quantity_change}</td>
                    <td style={{fontSize:11}}>{m.reference}</td>
                  </tr>
                ))}
                {stats.stockMovements.length === 0 && <tr><td colSpan={4} style={{textAlign:'center',color:'#999'}}>No movements yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
