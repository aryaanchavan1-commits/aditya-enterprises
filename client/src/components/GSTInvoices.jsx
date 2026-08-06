import React, { useState, useEffect } from 'react';
import { exportToExcel } from '../api';
import { confirmAction } from '../confirm';

const API = '/api';

export default function GSTInvoices() {
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [gstReport, setGstReport] = useState(null);
  const [activeTab, setActiveTab] = useState('invoices');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (id) => {
    if (!(await confirmAction({ title: 'Delete sale?', message: 'This sale will be permanently deleted and the stock will be restored.', danger: true, confirmText: 'Delete' }))) return;
    const r = await fetch(`${API}/sales/${id}`, { method: 'DELETE' });
    const d = await r.json();
    if (d.success) { showToast('Sale deleted, stock restored'); fetchSales(); }
    else showToast(d.error || 'Delete failed', 'error');
  };

  const handleExport = () => {
    const data = sales.map(s => ({
      Invoice: s.invoice_number, Date: s.sale_date, Customer: s.customer_name,
      GSTIN: s.customer_gstin || '', Subtotal: s.subtotal, CGST: s.cgst_total,
      SGST: s.sgst_total, IGST: s.igst_total || 0, Grand_Total: s.grand_total,
      Payment_Mode: s.payment_mode
    }));
    exportToExcel(data, `sales_export_${new Date().toISOString().slice(0,10)}`);
    showToast('Sales exported to Excel');
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = () => {
    fetch(`${API}/sales?search=${search}`)
      .then(r => r.json()).then(d => { if (d.success) setSales(d.data); });
  };

  useEffect(() => { fetchSales(); }, [search]);

  const loadGstReport = (month) => {
    fetch(`${API}/gst/report?month=${month}`)
      .then(r => r.json()).then(d => { if (d.success) setGstReport(d.data); });
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <h2 style={{marginBottom:20}}>GST & Invoices</h2>

      <div style={{display:'flex', gap:8, marginBottom:16}}>
        <button className={`btn ${activeTab==='invoices'?'btn-primary':'btn-outline'}`} onClick={()=>setActiveTab('invoices')}>
          Invoices
        </button>
        <button className={`btn ${activeTab==='report'?'btn-primary':'btn-outline'}`} onClick={()=>setActiveTab('report')}>
          GST Report
        </button>
        <button className="btn btn-outline" onClick={handleExport}>Export Excel</button>
      </div>

      {activeTab === 'invoices' && (
        <div className="card">
          <div className="search-bar">
            <input
              placeholder="Search invoices by number or customer name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="table-container desktop-table">
            {sales.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th><th>Date</th><th>Customer</th>
                    <th>Total</th><th>Mode</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.invoice_number}</strong>{' '}
                        {s.is_gst === 0 || s.is_gst === false ? (
                          <span className="badge badge-secondary" style={{background:'#bdc3c7',color:'#2c3e50',fontSize:10}}>Non-GST</span>
                        ) : (
                          <span className="badge badge-warning" style={{fontSize:10}}>GST</span>
                        )}
                      </td>
                      <td>{s.sale_date}</td>
                      <td>{s.customer_name}</td>
                      <td><strong>Rs.{Number(s.grand_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></td>
                      <td><span className="badge badge-info">{s.payment_mode}</span></td>
                      <td style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                        <button className="btn btn-sm btn-info" onClick={() => window.open(`${API}/sales/${s.id}/receipt`, '_blank')}>Receipt</button>
                        <button className="btn btn-sm btn-warning" onClick={() => window.open(`${API}/gst/bill/${s.id}`, '_blank')}>{s.is_gst === 0 || s.is_gst === false ? 'Bill' : 'GST Bill'}</button>
                        <button className="btn btn-sm btn-success" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`*Aditya Enterprises - Invoice ${s.invoice_number}*\nDate: ${s.sale_date}\nCustomer: ${s.customer_name}\nTotal: Rs.${Number(s.grand_total).toLocaleString('en-IN')}\n\nView Bill: ${window.location.origin}${API}/gst/bill/${s.id}\nThank you!`)}`, '_blank')}>Share</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>Del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{textAlign:'center',color:'#999',padding:30}}>No invoices yet</div>
            )}
          </div>
          <div className="show-mobile-cards">
            <div className="mobile-cards">
              {sales.map(s => (
                <div key={s.id} className="mobile-card">
                  <div className="mobile-card-header">{s.invoice_number} {s.is_gst === 0 || s.is_gst === false ? <span className="badge badge-secondary" style={{background:'#bdc3c7',color:'#2c3e50',fontSize:10}}>Non-GST</span> : <span className="badge badge-warning" style={{fontSize:10}}>GST</span>}</div>
                  <div className="mobile-card-row">
                    <span className="label">Customer</span>
                    <span className="value">{s.customer_name}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="label">Date</span>
                    <span className="value">{s.sale_date}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="label">Amount</span>
                    <span className="value"><strong>Rs.{Number(s.grand_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="label">Mode</span>
                    <span className="value"><span className="badge badge-info">{s.payment_mode}</span></span>
                  </div>
                  <div className="mobile-card-actions">
                    <button className="btn btn-sm btn-info" onClick={() => window.open(`${API}/sales/${s.id}/receipt`, '_blank')}>Receipt</button>
                    <button className="btn btn-sm btn-warning" onClick={() => window.open(`${API}/gst/bill/${s.id}`, '_blank')}>{s.is_gst === 0 || s.is_gst === false ? 'Bill' : 'GST Bill'}</button>
                    <button className="btn btn-sm btn-success" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('*Aditya Enterprises - Invoice ' + s.invoice_number + '*\nDate: ' + s.sale_date + '\nCustomer: ' + s.customer_name + '\nTotal: Rs.' + Number(s.grand_total).toLocaleString('en-IN') + '\n\nView Bill: ' + window.location.origin + API + '/gst/bill/' + s.id + '\nThank you!')}`, '_blank')}>Share</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>Del</button>
                  </div>
                </div>
              ))}
              {sales.length === 0 && <div style={{textAlign:'center',color:'#999',padding:20}}>No invoices yet</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'report' && (
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div className="form-row">
              <div className="form-group">
                <label>Select Month</label>
                <input type="month" value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); loadGstReport(e.target.value); }} />
              </div>
            </div>
          </div>

          {gstReport && (
            <div className="card">
              <div className="card-header"><h3>GST Report</h3></div>
              <div className="stats-grid">
                <div className="stat-card accent">
                  <span className="stat-value">{gstReport.totalInvoices}</span>
                  <span className="stat-label">Total Invoices</span>
                </div>
                <div className="stat-card success">
                  <span className="stat-value">Rs.{Number(gstReport.taxableValue).toLocaleString('en-IN')}</span>
                  <span className="stat-label">Taxable Value</span>
                </div>
                <div className="stat-card warning">
                  <span className="stat-value">Rs.{Number(gstReport.totalCgst).toLocaleString('en-IN')}</span>
                  <span className="stat-label">Total CGST</span>
                </div>
                <div className="stat-card warning">
                  <span className="stat-value">Rs.{Number(gstReport.totalSgst).toLocaleString('en-IN')}</span>
                  <span className="stat-label">Total SGST</span>
                </div>
                <div className="stat-card accent">
                  <span className="stat-value">Rs.{Number(gstReport.totalIgst).toLocaleString('en-IN')}</span>
                  <span className="stat-label">Total IGST</span>
                </div>
                <div className="stat-card danger">
                  <span className="stat-value">Rs.{Number(gstReport.totalGst).toLocaleString('en-IN')}</span>
                  <span className="stat-label">Total GST Payable</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


    </div>
  );
}
