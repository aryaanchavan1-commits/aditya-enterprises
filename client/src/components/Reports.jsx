import React, { useState, useEffect } from 'react';

const API = '/api';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('daily');
  const [dailyData, setDailyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [productData, setProductData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [balanceData, setBalanceData] = useState(null);
  const [lowStockData, setLowStockData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`);
  const [balanceYear, setBalanceYear] = useState(String(new Date().getFullYear()));
  const [balanceMonth, setBalanceMonth] = useState('');
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

  const loadBalanceSheet = () => {
    setLoading(true);
    let url = `${API}/reports/balance-sheet?year=${balanceYear}`;
    if (balanceMonth) url += `&month=${balanceMonth}`;
    fetch(url).then(r => r.json()).then(d => { if (d.success) setBalanceData(d.data); }).catch(() => showToast('Failed to load balance sheet', 'error')).finally(() => setLoading(false));
  };

  const loadLowStock = () => {
    setLoading(true);
    fetch(`${API}/reports/low-stock`).then(r => r.json()).then(d => { if (d.success) setLowStockData(d.data); }).catch(() => showToast('Failed', 'error')).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (activeTab === 'daily') loadDaily();
    else if (activeTab === 'monthly') loadMonthly();
    else if (activeTab === 'products') loadProducts();
    else if (activeTab === 'customers') loadCustomers();
    else if (activeTab === 'balance') loadBalanceSheet();
    else if (activeTab === 'lowstock') loadLowStock();
  }, [activeTab, selectedDate, selectedMonth, balanceYear, balanceMonth]);

  const formatINR = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const whatsappShare = (text) => { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      <h2 style={{marginBottom:20}}>Reports</h2>

      <div style={{display:'flex', gap:6, marginBottom:20, flexWrap:'wrap'}}>
        {['daily','monthly','balance','lowstock','products','customers'].map(t => (
          <button key={t} className={`btn btn-sm ${activeTab===t?'btn-primary':'btn-outline'}`} onClick={()=>setActiveTab(t)}>
            {t === 'daily' ? 'Daily Sales' : t === 'monthly' ? 'Monthly Sales' : t === 'balance' ? 'Balance Sheet' : t === 'lowstock' ? 'Low Stock' : t === 'products' ? 'By Product' : 'By Customer'}
          </button>
        ))}
      </div>

      {activeTab === 'daily' && (
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div className="form-row" style={{alignItems:'end'}}>
              <div className="form-group">
                <label>Select Date (click to view sales)</label>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              </div>
              <div className="form-group" style={{display:'flex', gap:8, alignItems:'end'}}>
                <button className="btn btn-info btn-sm" onClick={loadDaily}>Refresh</button>
                <button className="btn btn-warning btn-sm" onClick={() => window.open(`${API}/reports/daily/pdf?date=${selectedDate}`, '_blank')}>PDF</button>
                <button className="btn btn-success btn-sm" onClick={() => window.open(`${API}/reports/csv?start_date=${selectedDate}&end_date=${selectedDate}`, '_blank')}>CSV</button>
              </div>
            </div>
          </div>
          {loading && <div className="empty-state"><div className="spinner"></div><p style={{marginTop:12}}>Loading...</p></div>}
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
                    {dailyData.sales.length > 0 ? (
                      <table>
                        <thead><tr><th>Invoice</th><th>Customer</th><th>Items</th><th>Subtotal</th><th>CGST</th><th>SGST</th><th>Total</th><th>Payment</th><th>Share</th></tr></thead>
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
                              <td>
                                <button className="btn btn-sm btn-success" onClick={() => whatsappShare(`Aditya Enterprises - Invoice ${s.invoice_number}\nDate: ${s.sale_date}\nCustomer: ${s.customer_name}\nTotal: Rs.${formatINR(s.grand_total)}\n${(s.items || []).map(i => `${i.product_name} x${i.quantity} @ Rs.${i.sell_price}`).join('\n')}\n\nThank you!`)}>Share</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{textAlign:'center',color:'#999',padding:20}}>No sales for this date. Pick another date above.</div>
                    )}
                  </div>
                </div>
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
                <button className="btn btn-warning btn-sm" onClick={() => window.open(`${API}/reports/monthly/pdf?month=${selectedMonth}`, '_blank')}>PDF</button>
                <button className="btn btn-success btn-sm" onClick={() => window.open(`${API}/reports/csv?start_date=${selectedMonth}-01`, '_blank')}>CSV</button>
              </div>
            </div>
          </div>
          {loading && <div className="empty-state"><div className="spinner"></div><p style={{marginTop:12}}>Loading...</p></div>}
          {monthlyData && (
            <div>
              <div className="stats-grid">
                <div className="stat-card accent"><span className="stat-value">{monthlyData.totalInvoices}</span><span className="stat-label">Total Invoices</span></div>
                <div className="stat-card success"><span className="stat-value">Rs.{formatINR(monthlyData.totalRevenue)}</span><span className="stat-label">Total Revenue</span></div>
                <div className="stat-card warning"><span className="stat-value">Rs.{formatINR(monthlyData.totalCgst + monthlyData.totalSgst)}</span><span className="stat-label">Total GST</span></div>
                <div className="stat-card accent"><span className="stat-value">Rs.{formatINR(monthlyData.totalDiscount)}</span><span className="stat-label">Total Discounts</span></div>
              </div>
              {monthlyData.dailyBreakdown && monthlyData.dailyBreakdown.length > 0 && (
                <div className="card" style={{marginTop:16}}>
                  <div className="card-header"><h3>Daily Breakdown</h3></div>
                  <div className="table-container">
                    <table>
                      <thead><tr><th>Date</th><th>Invoices</th><th>Revenue</th></tr></thead>
                      <tbody>
                        {monthlyData.dailyBreakdown.map(d => (
                          <tr key={d.date} style={{cursor:'pointer'}} onClick={() => { setSelectedDate(d.date); setActiveTab('daily'); }}>
                            <td><strong>{d.date}</strong></td><td>{d.invoices}</td><td>Rs.{formatINR(d.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {monthlyData.dailyBreakdown && monthlyData.dailyBreakdown.length === 0 && (
                <div className="card" style={{marginTop:16, textAlign:'center',color:'#999',padding:20}}>No daily data for this month</div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'balance' && (
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div className="form-row" style={{alignItems:'end'}}>
              <div className="form-group">
                <label>Year</label>
                <input type="number" value={balanceYear} onChange={e => setBalanceYear(e.target.value)} min="2020" max="2030" />
              </div>
              <div className="form-group">
                <label>Month (optional - leave blank for yearly)</label>
                <select value={balanceMonth} onChange={e => setBalanceMonth(e.target.value)}>
                  <option value="">Full Year</option>
                  {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => <option key={m} value={m}>{new Date(2020, parseInt(m)-1).toLocaleString('en',{month:'long'})}</option>)}
                </select>
              </div>
              <div className="form-group" style={{display:'flex', gap:8, alignItems:'end'}}>
                <button className="btn btn-info btn-sm" onClick={loadBalanceSheet}>Generate</button>
                <button className="btn btn-warning btn-sm" onClick={() => window.open(`${API}/reports/balance-sheet/pdf?year=${balanceYear}${balanceMonth ? '&month='+balanceMonth : ''}`, '_blank')}>PDF</button>
                <button className="btn btn-success btn-sm" onClick={() => window.open(`${API}/reports/balance-sheet/csv?year=${balanceYear}${balanceMonth ? '&month='+balanceMonth : ''}`, '_blank')}>CSV</button>
                <button className="btn btn-primary btn-sm" onClick={() => window.print()}>Print</button>
              </div>
            </div>
          </div>
          {loading && <div className="empty-state"><div className="spinner"></div><p style={{marginTop:12}}>Loading...</p></div>}
          {balanceData && (
            <div>
              <div className="card"><div className="card-header"><h3>Balance Sheet - {balanceData.period}</h3></div></div>
              <div className="stats-grid">
                <div className="stat-card success"><span className="stat-value">Rs.{formatINR(balanceData.totalRevenue)}</span><span className="stat-label">Total Revenue</span></div>
                <div className="stat-card danger"><span className="stat-value">Rs.{formatINR(balanceData.totalPurchases)}</span><span className="stat-label">Total Purchases</span></div>
                <div className="stat-card warning"><span className="stat-value">Rs.{formatINR(balanceData.totalDiscount)}</span><span className="stat-label">Discounts Given</span></div>
                <div className="stat-card accent"><span className="stat-value">Rs.{formatINR(balanceData.netProfit)}</span><span className="stat-label">Net Profit / Loss</span></div>
                <div className="stat-card accent"><span className="stat-value">Rs.{formatINR(balanceData.netGstPayable)}</span><span className="stat-label">Net GST Payable</span></div>
                <div className="stat-card accent"><span className="stat-value">{balanceData.totalInvoices}</span><span className="stat-label">Total Invoices</span></div>
              </div>
              {balanceData.monthlyBreakdown && balanceData.monthlyBreakdown.length > 0 && (
                <div className="card" style={{marginTop:16}}>
                  <div className="card-header"><h3>Monthly Breakdown</h3></div>
                  <div className="table-container">
                    <table>
                      <thead><tr><th>Month</th><th>Revenue</th><th>Expenses</th><th>Profit</th><th>Invoices</th></tr></thead>
                      <tbody>
                        {balanceData.monthlyBreakdown.map(mb => (
                          <tr key={mb.month}>
                            <td><strong>{mb.month}</strong></td>
                            <td style={{color:'#27ae60'}}>Rs.{formatINR(mb.revenue)}</td>
                            <td style={{color:'#e74c3c'}}>Rs.{formatINR(mb.expenses)}</td>
                            <td style={{color: mb.profit >= 0 ? '#27ae60' : '#e74c3c', fontWeight:'bold'}}>Rs.{formatINR(mb.profit)}</td>
                            <td>{mb.invoices}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="reports-grid">
                {balanceData.sales && balanceData.sales.length > 0 && (
                  <div className="card">
                    <div className="card-header"><h3>Sales Invoices ({balanceData.sales.length})</h3></div>
                    <div className="table-container">
                      <table>
                        <thead><tr><th>Invoice</th><th>Customer</th><th>Total</th></tr></thead>
                        <tbody>
                          {balanceData.sales.map(s => (
                            <tr key={s.id}><td style={{fontSize:11}}>{s.invoice_number}</td><td>{s.customer_name}</td><td>Rs.{formatINR(s.grand_total)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {balanceData.purchases && balanceData.purchases.length > 0 && (
                  <div className="card">
                    <div className="card-header"><h3>Purchases ({balanceData.purchases.length})</h3></div>
                    <div className="table-container">
                      <table>
                        <thead><tr><th>Invoice</th><th>Supplier</th><th>Total</th></tr></thead>
                        <tbody>
                          {balanceData.purchases.map(p => (
                            <tr key={p.id}><td style={{fontSize:11}}>{p.invoice_number}</td><td>{p.supplier_name}</td><td>Rs.{formatINR(p.grand_total)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'lowstock' && (
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div className="card-header">
              <h3>Low Stock Items (Quantity {'<='} 5)</h3>
              <div style={{display:'flex', gap:8}}>
                <button className="btn btn-sm btn-warning" onClick={() => window.open(`${API}/reports/low-stock/pdf`, '_blank')}>PDF</button>
                <button className="btn btn-sm btn-success" onClick={() => window.open(`${API}/reports/low-stock/csv`, '_blank')}>CSV</button>
              </div>
            </div>
          </div>
          {loading && <div className="empty-state"><div className="spinner"></div><p style={{marginTop:12}}>Loading...</p></div>}
          {lowStockData && lowStockData.length > 0 && (
            <div className="card">
              <div className="table-container">
                <table>
                  <thead><tr><th>Product</th><th>Qty</th><th>Sell Price</th><th>Cost Price</th><th>Barcode</th></tr></thead>
                  <tbody>
                    {lowStockData.map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.name}</strong></td>
                        <td style={{color:'#e74c3c', fontWeight:'bold'}}>{p.quantity}</td>
                        <td>Rs.{formatINR(p.sell_price)}</td>
                        <td>Rs.{formatINR(p.inward_price)}</td>
                        <td style={{fontFamily:'monospace', fontSize:11}}>{p.barcode || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {lowStockData && lowStockData.length === 0 && !loading && (
            <div className="card" style={{textAlign:'center',color:'#999',padding:30}}>No low stock items. All products are well stocked.</div>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div>
          {loading && <div className="empty-state"><div className="spinner"></div><p style={{marginTop:12}}>Loading...</p></div>}
          {productData && productData.length > 0 && (
            <div className="card">
              <div className="card-header"><h3>Sales by Product (All Time)</h3></div>
              <div className="table-container">
                <table>
                  <thead><tr><th>Product</th><th>HSN</th><th>Qty Sold</th><th>Revenue</th><th>Sales Count</th></tr></thead>
                  <tbody>
                    {productData.map(p => (
                      <tr key={p.name}><td><strong>{p.name}</strong></td><td>{p.hsn}</td><td>{p.totalQuantity}</td><td>Rs.{formatINR(p.totalRevenue)}</td><td>{p.saleCount}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {productData && productData.length === 0 && !loading && (
            <div className="card" style={{textAlign:'center',color:'#999',padding:30}}>No product sales data</div>
          )}
        </div>
      )}

      {activeTab === 'customers' && (
        <div>
          {loading && <div className="empty-state"><div className="spinner"></div><p style={{marginTop:12}}>Loading...</p></div>}
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
                  <div className="card-header"><h3>Top Repeat Customers</h3><span className="badge badge-info">{customerData.summary.topCustomers.length} repeat</span></div>
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
                  {customerData.customers.length > 0 ? (
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
                      </tbody>
                    </table>
                  ) : (
                    <div style={{textAlign:'center',color:'#999',padding:20}}>No customers yet</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
