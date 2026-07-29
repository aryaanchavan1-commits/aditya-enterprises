import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const load = () => {
    setLoading(true);
    api('/sales/stats/dashboard').then(d => {
      if (!mounted.current) return;
      setLoading(false);
      if (d.success) setStats({ ...d.data, recentSales: d.data.recentSales || [], lowStockProducts: d.data.lowStockProducts || [] });
    });
  };

  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, []);

  if (loading || !stats) return <div><h2>Dashboard</h2><div style={{textAlign:'center',padding:30,color:'#999'}}>Loading...</div></div>;

  return (
    <div>
      <h2 style={{marginBottom:16}}>Dashboard</h2>
      <div className="stats-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))'}}>
        <div className="stat-card warning"><span className="stat-value">Rs.{Number(stats.todaySales).toLocaleString('en-IN')}</span><span className="stat-label">Today's Sale</span></div>
        <div className="stat-card accent"><span className="stat-value">Rs.{Number(stats.monthlyRevenue).toLocaleString('en-IN')}</span><span className="stat-label">This Month</span></div>
        <div className="stat-card success"><span className="stat-value">{stats.totalProducts}</span><span className="stat-label">Products</span></div>
        <div className="stat-card danger"><span className="stat-value">{stats.lowStock}</span><span className="stat-label">Low Stock</span></div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header"><h3>Low Stock Items</h3></div>
          {stats.lowStockProducts.length > 0 ? (
            <table><thead><tr><th>Product</th><th>Qty</th><th>Min</th><th>Price</th></tr></thead>
              <tbody>{stats.lowStockProducts.map(p => (
                <tr key={p.id}><td>{p.name}</td><td style={{color:'#e74c3c',fontWeight:'bold'}}>{p.quantity}</td><td>{p.low_stock_threshold || 5}</td><td>Rs.{Number(p.sell_price).toLocaleString('en-IN')}</td></tr>
              ))}</tbody></table>
          ) : <p style={{color:'#27ae60',textAlign:'center',padding:20}}>All products well stocked</p>}
        </div>

        <div className="card">
          <div className="card-header"><h3>Recent Sales</h3></div>
          {stats.recentSales.length > 0 ? (
            <table><thead><tr><th>Invoice</th><th>Customer</th><th>Total</th></tr></thead>
              <tbody>{stats.recentSales.map(s => (
                <tr key={s.id}><td><strong>{s.invoice_number}</strong></td><td>{s.customer_name}</td><td>Rs.{Number(s.grand_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</td></tr>
              ))}</tbody></table>
          ) : <p style={{textAlign:'center',color:'#999',padding:20}}>No sales yet</p>}
        </div>
      </div>
    </div>
  );
}
