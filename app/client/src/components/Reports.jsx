import React, { useState, useEffect, useRef } from 'react';

const API = '/api';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('daily');
  const [dailyData, setDailyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [productData, setProductData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const loadDaily = () => {
    setLoading(true);
    fetch(`${API}/reports/daily?date=${selectedDate}`)
      .then(r => r.json()).then(d => { if (d.success) setDailyData(d.data); })
      .catch(() => showToast('Failed to load daily report', 'error'))
      .finally(() => setLoading(false));
  };

  const loadMonthly = () => {
    setLoading(true);
    fetch(`${API}/reports/monthly?month=${selectedMonth}`)
      .then(r => r.json()).then(d => { if (d.success) setMonthlyData(d.data); })
      .catch(() => showToast('Failed to load monthly report', 'error'))
      .finally(() => setLoading(false));
  };

  const loadProducts = () => {
    setLoading(true);
    fetch(`${API}/reports/by-product`)
      .then(r => r.json()).then(d => { if (d.success) setProductData(d.data); })
      .catch(() => showToast('Failed to load product report', 'error'))
      .finally(() => setLoading(false));
  };

  const loadCustomers = () => {
    setLoading(true);
    fetch(`${API}/reports/by-customer`)
      .then(r => r.json()).then(d => { if (d.success) setCustomerData(d.data); })
      .catch(() => showToast('Failed to load customer report', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (activeTab === 'daily') loadDaily();
    else if (activeTab === 'monthly') loadMonthly();
    else if (activeTab === 'products') loadProducts();
    else if (activeTab === 'customers') loadCustomers();
  }, [activeTab, selectedDate, selectedMonth]);

  const downloadPDF = (url) => { window.open(`${API}${url}`, '_blank'); };
  const downloadCSV = () => { window.open(`${API}/reports/csv?start_date=${selectedMonth}-01`, '_blank'); };

  const formatINR = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      <h2 style={{marginBottom:20}}>Sales Reports</h2>

      <div style={{display:'flex', gap:8, marginBottom:20}}>
        {['daily','monthly','products','customers'].map(t => (
          <button key={t} className={`btn ${activeTab===t?'btn-primary':'btn-outline'}`} onClick={()=>setActiveTab(t)}>
            {t === 'daily' ? 'Daily Report' : t === 'monthly' ? 'Monthly Report' : t === 'products' ? 'By Product' : 'By Customer'}
          </button>
        ))}
      </div>

      {activeTab === 'daily' && (
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div className="form-row" style={{alignItems:'end'}}>
              <div className="form-group">
                <label>Select Date</label>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              </div>
              <div className="form-group" style={{display:'flex', gap:8, alignItems:'end'}}>
                <button className="btn btn-info btn-sm" onClick={loadDaily}>Refresh</button>
                <button className="btn btn-warning btn-sm" onClick={() => downloadPDF(`/reports/daily/pdf?date=${selectedDate}`)}>
                  Download PDF
                </button>
              </div>
            </div>
          </div>

          {dailyData && (
            <div>
              <div className="stats-grid">
                <div className="stat-card accent"><span className="stat-value">{dailyData.totalInvoices}</span><span className="stat-label">Invoices</span></div>
                <div className="stat-card success"><span className="stat-value">Rs.{formatINR(dailyData.totalRevenue)}</span><span className="stat-label">Revenue</span></div>
                <div className="stat-card warning"><span className="stat-value">Rs.{formatINR(dailyData.totalCgst)}</span><span className="stat-label">CGST</span></div>
                <div className="stat-card warning"><span className="stat-value">Rs.{formatINR(dailyData.totalSgst)}</span><span className="stat-label">SGST</span></div>
                <div className="stat-card accent"><span className="stat-value">Rs.{formatINR(dailyData.totalDiscount)}</span><span className="stat-label">Discounts</span></div>
              </div>

              <div className="card">
                <div className="card-header"><h3>Invoices for {selectedDate}</h3></div>
                <div className="table-container">
                  <table>
                    <thead><tr><th>Invoice</th><th>Customer</th><th>Items</th><th>Subtotal</th><th>CGST</th><th>SGST</th><th>Total</th><th>Payment</th></tr></thead>
                    <tbody>
                      {dailyData.sales.map(s => (
                        <tr key={s.id}>
                          <td><strong>{s.invoice_number}</strong></td>
                          <td>{s.customer_name}{s.is_barcode_scan ? <span className="badge badge-info" style={{marginLeft:4}}>Scan</span> : ''}</td>
                          <td style={{fontSize:11}}>{(s.items || []).map(i => `${i.product_name} x${i.quantity}`).join(', ')}</td>
                          <td>Rs.{formatINR(s.subtotal)}</td>
                          <td>Rs.{formatINR(s.cgst_total)}</td>
                          <td>Rs.{formatINR(s.sgst_total)}</td>
                          <td><strong>Rs.{formatINR(s.grand_total)}</strong></td>
                          <td><span className="badge badge-info">{s.payment_mode}</span></td>
                        </tr>
                      ))}
                      {dailyData.sales.length === 0 && <tr><td colSpan={8} style={{textAlign:'center',color:'#999',padding:20}}>No sales for this date</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {dailyData.paymentModes && Object.keys(dailyData.paymentModes).length > 0 && (
                <div className="card" style={{marginTop:16}}>
                  <div className="card-header"><h3>Payment Mode Breakdown</h3></div>
                  <div className="stats-grid">
                    {Object.entries(dailyData.paymentModes).map(([mode, amount]) => (
                      <div key={mode} className="stat-card accent">
                        <span className="stat-value">Rs.{formatINR(amount)}</span>
                        <span className="stat-label">{mode.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'monthly' && (
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div className="form-row" style={{alignItems:'end'}}>
              <div className="form-group">
                <label>Select Month</label>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
              </div>
              <div className="form-group" style={{display:'flex', gap:8, alignItems:'end'}}>
                <button className="btn btn-info btn-sm" onClick={loadMonthly}>Refresh</button>
                <button className="btn btn-warning btn-sm" onClick={() => downloadPDF(`/reports/monthly/pdf?month=${selectedMonth}`)}>
                  Download PDF
                </button>
                <button className="btn btn-info btn-sm" onClick={downloadCSV}>Download CSV</button>
              </div>
            </div>
          </div>

          {monthlyData && (
            <div>
              <div className="card"><div className="card-header"><h3>{monthlyData.period}</h3></div></div>
              <div className="stats-grid">
                <div className="stat-card accent"><span className="stat-value">{monthlyData.totalInvoices}</span><span className="stat-label">Total Invoices</span></div>
                <div className="stat-card success"><span className="stat-value">Rs.{formatINR(monthlyData.totalRevenue)}</span><span className="stat-label">Total Revenue</span></div>
                <div className="stat-card warning"><span className="stat-value">Rs.{formatINR(monthlyData.totalCgst + monthlyData.totalSgst)}</span><span className="stat-label">Total GST</span></div>
                <div className="stat-card accent"><span className="stat-value">Rs.{formatINR(monthlyData.totalDiscount)}</span><span className="stat-label">Total Discounts</span></div>
              </div>

              {monthlyData.dailyBreakdown && (
                <div className="card" style={{marginTop:16}}>
                  <div className="card-header"><h3>Daily Breakdown</h3></div>
                  <div className="table-container">
                    <table>
                      <thead><tr><th>Date</th><th>Invoices</th><th>Revenue</th></tr></thead>
                      <tbody>
                        {monthlyData.dailyBreakdown.map(d => (
                          <tr key={d.date}><td><strong>{d.date}</strong></td><td>{d.invoices}</td><td>Rs.{formatINR(d.revenue)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {monthlyData.productBreakdown && (
                <div className="card" style={{marginTop:16}}>
                  <div className="card-header"><h3>Top Products</h3></div>
                  <div className="table-container">
                    <table>
                      <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
                      <tbody>
                        {monthlyData.productBreakdown.slice(0, 15).map(p => (
                          <tr key={p.name}><td><strong>{p.name}</strong></td><td>{p.quantity}</td><td>Rs.{formatINR(p.revenue)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div>
          {productData && (
            <div className="card">
              <div className="card-header"><h3>Sales by Product (All Time)</h3></div>
              <div className="table-container">
                <table>
                  <thead><tr><th>Product</th><th>HSN</th><th>Qty Sold</th><th>Revenue</th><th>Sales Count</th></tr></thead>
                  <tbody>
                    {productData.map(p => (
                      <tr key={p.name}><td><strong>{p.name}</strong></td><td>{p.hsn}</td><td>{p.totalQuantity}</td><td>Rs.{formatINR(p.totalRevenue)}</td><td>{p.saleCount}</td></tr>
                    ))}
                    {productData.length === 0 && <tr><td colSpan={5} style={{textAlign:'center',color:'#999',padding:20}}>No product sales data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'customers' && (
        <div>
          {customerData && (
            <div>
              <div className="stats-grid" style={{marginBottom:16}}>
                <div className="stat-card accent"><span className="stat-value">{customerData.summary.totalCustomers}</span><span className="stat-label">Total Customers</span></div>
                <div className="stat-card success"><span className="stat-value">{customerData.summary.repeatCustomers}</span><span className="stat-label">Repeat Customers</span></div>
                <div className="stat-card info"><span className="stat-value">{customerData.summary.newCustomers}</span><span className="stat-label">New Customers</span></div>
                <div className="stat-card success"><span className="stat-value">Rs.{formatINR(customerData.summary.repeatRevenue)}</span><span className="stat-label">Repeat Revenue</span></div>
              </div>

              {customerData.summary.topCustomers && customerData.summary.topCustomers.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3>Top Repeat Customers</h3>
                    <span className="badge badge-info">{customerData.summary.topCustomers.length} repeat</span>
                  </div>
                  <div className="table-container">
                    <table>
                      <thead><tr><th>Customer</th><th>Visits</th><th>Total Spent</th><th>First Visit</th><th>Last Visit</th><th>Status</th></tr></thead>
                      <tbody>
                        {customerData.summary.topCustomers.map(c => (
                          <tr key={c.name}>
                            <td><strong>{c.name}</strong>{c.phone && <div style={{fontSize:10,color:'#999'}}>{c.phone}</div>}</td>
                            <td><span className="badge badge-success">{c.visitCount}</span></td>
                            <td>Rs.{formatINR(c.totalSpent)}</td>
                            <td>{c.firstVisit}</td>
                            <td>{c.lastVisit}</td>
                            <td><span className="badge badge-success">Repeat</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="card" style={{marginTop:16}}>
                <div className="card-header"><h3>All Customers</h3></div>
                <div className="table-container">
                  <table>
                    <thead><tr><th>Customer</th><th>Phone</th><th>GSTIN</th><th>Visits</th><th>Total Spent</th><th>First Visit</th><th>Last Visit</th><th>Type</th></tr></thead>
                    <tbody>
                      {customerData.customers.map(c => (
                        <tr key={c.name}>
                          <td><strong>{c.name}</strong></td>
                          <td>{c.phone || '-'}</td>
                          <td style={{fontSize:11}}>{c.gstin || '-'}</td>
                          <td>{c.visitCount}</td>
                          <td>Rs.{formatINR(c.totalSpent)}</td>
                          <td>{c.firstVisit}</td>
                          <td>{c.lastVisit}</td>
                          <td><span className={`badge ${c.isRepeat ? 'badge-success' : 'badge-info'}`}>{c.isRepeat ? 'Repeat' : 'New'}</span></td>
                        </tr>
                      ))}
                      {customerData.customers.length === 0 && <tr><td colSpan={8} style={{textAlign:'center',color:'#999',padding:20}}>No customers yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
