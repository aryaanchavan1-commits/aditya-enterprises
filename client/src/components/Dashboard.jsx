import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

const COLORS = ['#3498db','#2ecc71','#e74c3c','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e'];

function BarChart({ data, labelKey, valueKey, title, color }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  return (
    <div className="card">
      <div className="card-header"><h3>{title}</h3></div>
      <div style={{display:'flex', alignItems:'flex-end', gap:8, height:140, padding:'16px 8px 8px'}}>
        {data.map((d, i) => {
          const val = Number(d[valueKey]) || 0;
          const pct = (val / maxVal) * 100;
          const barColor = color || COLORS[i % COLORS.length];
          return (
            <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', height:'100%', justifyContent:'flex-end'}}>
              <span style={{fontSize:10, color:'#555', marginBottom:4, fontWeight:600}}>{val.toFixed(0)}</span>
              <div style={{width:'100%', height:`${Math.max(pct, 4)}%`, background:`linear-gradient(180deg, ${barColor}88, ${barColor})`, borderRadius:'6px 6px 2px 2px', transition:'height 0.4s ease', boxShadow:`0 2px 4px ${barColor}44`}} title={d[labelKey]}></div>
              <span style={{fontSize:9, color:'#888', marginTop:6, textAlign:'center', lineHeight:1.2, maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{String(d[labelKey]).length > 8 ? String(d[labelKey]).slice(0,7)+'…' : d[labelKey]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  const load = () => {
    setLoading(true);
    setError(null);
    api('/sales/stats/dashboard').then(d => {
      if (!mounted.current) return;
      setLoading(false);
      if (d.success) {
        setStats({
          ...d.data,
          recentSales: d.data.recentSales || [],
          stockMovements: d.data.stockMovements || [],
          lowStockProducts: d.data.lowStockProducts || [],
          dailySales: d.data.dailySales || [],
        });
      } else {
        setError(d.error || 'Failed to load dashboard');
      }
    });
  };

  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, []);

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#9888;</div>
        <p>Could not load dashboard data</p>
        <p style={{fontSize:12, color:'#999', marginTop:8}}>{error}</p>
        <button className="btn btn-primary" onClick={load}>Retry</button>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div>
        <h2 style={{marginBottom:20}}>Dashboard</h2>
        <div className="stats-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="stat-card" style={{opacity:0.5}}>
              <div className="stat-value" style={{background:'#eee', borderRadius:4, height:32, width:'60%', marginBottom:4}}></div>
              <div className="stat-label" style={{background:'#f0f0f0', borderRadius:4, height:12, width:'40%'}}></div>
            </div>
          ))}
        </div>
        <div style={{textAlign:'center', padding:20, color:'#999'}}>Loading dashboard data...</div>
      </div>
    );
  }

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

      <div className="dashboard-grid">
        <BarChart data={stats.dailySales} labelKey="sale_date" valueKey="total" title="Daily Sales (This Month)" color="#2ecc71" />
        <div className="card">
          <div className="card-header" style={{borderBottomColor: stats.lowStockProducts.length > 0 ? '#e74c3c' : '#eee'}}>
            <h3>Low Stock Items</h3>
            {stats.lowStockProducts.length > 0 && <span className="badge badge-danger">{stats.lowStockProducts.length} items</span>}
          </div>
          {stats.lowStockProducts.length > 0 ? (
            <div className="table-container">
              <table>
                <thead><tr><th>Product</th><th>Qty</th><th>Price</th></tr></thead>
                <tbody>
                  {stats.lowStockProducts.map(p => (
                    <tr key={p.id}>
                      <td>{p.name || 'N/A'}</td>
                      <td style={{color:'#e74c3c', fontWeight:'bold'}}>{p.quantity}</td>
                      <td>Rs.{Number(p.sell_price).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{color:'#27ae60', textAlign:'center', padding:20}}>All products are well stocked</p>
          )}
        </div>
      </div>

      <div className="dashboard-grid">
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
