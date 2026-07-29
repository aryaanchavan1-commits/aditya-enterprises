import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';

const API = '/api';

export default function GSTInvoices() {
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [gstReport, setGstReport] = useState(null);
  const [gstr1, setGstr1] = useState(null);
  const [activeTab, setActiveTab] = useState('invoices');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [toast, setToast] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const printRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
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

  const loadGSTR1 = (month) => {
    fetch(`${API}/gst/gstr1?month=${month}`)
      .then(r => r.json()).then(d => { if (d.success) setGstr1(d.data); });
  };

  const handlePrintInvoice = useReactToPrint({
    contentRef: printRef,
    documentTitle: `GST_Invoice_${selectedInvoice?.invoice_number || 'invoice'}`,
  });

  const company = {
    name: 'Aditya Enterprises',
    address: 'Shop No. 5, Main Market',
    gstin: '27AXXXXX1234Z1',
    phone: '+91-9876543210',
    pan: 'ABCDE1234F',
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <h2 style={{marginBottom:20}}>GST & Invoices</h2>

      <div style={{display:'flex', gap:8, marginBottom:16}}>
        <button className={`btn ${activeTab==='invoices'?'btn-primary':'btn-outline'}`} onClick={()=>setActiveTab('invoices')}>
          All Invoices
        </button>
        <button className={`btn ${activeTab==='report'?'btn-primary':'btn-outline'}`} onClick={()=>setActiveTab('report')}>
          GST Report
        </button>
        <button className={`btn ${activeTab==='gstr1'?'btn-primary':'btn-outline'}`} onClick={()=>setActiveTab('gstr1')}>
          GSTR-1 Filing
        </button>
        <button className={`btn ${activeTab==='preview'?'btn-primary':'btn-outline'}`} onClick={()=>setActiveTab('preview')}>
          Invoice Preview
        </button>
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
                    <th>Invoice #</th><th>Date</th><th>Customer</th><th>GSTIN</th>
                    <th>Subtotal</th><th>CGST</th><th>SGST</th><th>IGST</th>
                    <th>Grand Total</th><th>Mode</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.invoice_number}</strong></td>
                      <td>{s.sale_date}</td>
                      <td>{s.customer_name}</td>
                      <td>{s.customer_gstin || '-'}</td>
                      <td>Rs.{Number(s.subtotal).toLocaleString('en-IN')}</td>
                      <td>{s.cgst_total > 0 ? `Rs.${s.cgst_total.toFixed(2)}` : '-'}</td>
                      <td>{s.sgst_total > 0 ? `Rs.${s.sgst_total.toFixed(2)}` : '-'}</td>
                      <td>{s.igst_total > 0 ? `Rs.${s.igst_total.toFixed(2)}` : '-'}</td>
                      <td><strong>Rs.{Number(s.grand_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></td>
                      <td><span className="badge badge-info">{s.payment_mode}</span></td>
                      <td style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                        <button className="btn btn-sm btn-info" onClick={() => window.open(`${API}/sales/${s.id}/receipt`, '_blank')}>Receipt</button>
                        <button className="btn btn-sm btn-warning" onClick={() => window.open(`${API}/gst/bill/${s.id}`, '_blank')}>GST Bill</button>
                        <button className="btn btn-sm btn-success" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`*Aditya Enterprises - Invoice ${s.invoice_number}*\nDate: ${s.sale_date}\nCustomer: ${s.customer_name}\nTotal: Rs.${Number(s.grand_total).toLocaleString('en-IN')}\n\nView Bill: ${window.location.origin}${API}/gst/bill/${s.id}\nThank you!`)}`, '_blank')}>Share</button>
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
                  <div className="mobile-card-header">{s.invoice_number}</div>
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
                    <button className="btn btn-sm btn-warning" onClick={() => window.open(`${API}/gst/bill/${s.id}`, '_blank')}>GST Bill</button>
                    <button className="btn btn-sm btn-success" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('*Aditya Enterprises - Invoice ' + s.invoice_number + '*\nDate: ' + s.sale_date + '\nCustomer: ' + s.customer_name + '\nTotal: Rs.' + Number(s.grand_total).toLocaleString('en-IN') + '\n\nView Bill: ' + window.location.origin + API + '/gst/bill/' + s.id + '\nThank you!')}`, '_blank')}>Share</button>
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
                  <span className="stat-value">{gstReport.totalSales}</span>
                  <span className="stat-label">Total Invoices</span>
                </div>
                <div className="stat-card success">
                  <span className="stat-value">Rs.{Number(gstReport.totalRevenue).toLocaleString('en-IN')}</span>
                  <span className="stat-label">Total Revenue</span>
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

      {activeTab === 'gstr1' && (
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div className="form-row">
              <div className="form-group">
                <label>GSTR-1 Filing Month</label>
                <input type="month" value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); loadGSTR1(e.target.value); }} />
              </div>
            </div>
          </div>

          {gstr1 && (
            <div>
              <div className="card">
                <div className="card-header"><h3>GSTR-1 Summary - {gstr1.period}</h3></div>
                <div className="stats-grid">
                  <div className="stat-card accent"><span className="stat-value">Rs.{Number(gstr1.summary.totalTaxable).toLocaleString('en-IN')}</span><span className="stat-label">Taxable Value</span></div>
                  <div className="stat-card warning"><span className="stat-value">Rs.{Number(gstr1.summary.totalCgst).toLocaleString('en-IN')}</span><span className="stat-label">CGST</span></div>
                  <div className="stat-card warning"><span className="stat-value">Rs.{Number(gstr1.summary.totalSgst).toLocaleString('en-IN')}</span><span className="stat-label">SGST</span></div>
                  <div className="stat-card accent"><span className="stat-value">Rs.{Number(gstr1.summary.totalIgst).toLocaleString('en-IN')}</span><span className="stat-label">IGST</span></div>
                  <div className="stat-card danger"><span className="stat-value">Rs.{Number(gstr1.summary.totalGst).toLocaleString('en-IN')}</span><span className="stat-label">Total GST</span></div>
                  <div className="stat-card success"><span className="stat-value">{gstr1.b2b.length + gstr1.b2c.length}</span><span className="stat-label">Total Entries</span></div>
                </div>
              </div>

              {gstr1.b2b.length > 0 && (
                <div className="card" style={{marginTop:16}}>
                  <div className="card-header"><h3>B2B Invoices (GSTIN Customers) - {gstr1.b2b.length}</h3></div>
                  <div className="table-container">
                    <table>
                      <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>GSTIN</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>Total</th></tr></thead>
                      <tbody>
                        {gstr1.b2b.map((e, i) => (
                          <tr key={i}>
                            <td>{e.invoice}</td><td>{e.date}</td><td>{e.customer}</td><td>{e.gstin}</td>
                            <td>Rs.{Number(e.taxable).toFixed(2)}</td>
                            <td>Rs.{Number(e.cgst).toFixed(2)}</td>
                            <td>Rs.{Number(e.sgst).toFixed(2)}</td>
                            <td><strong>Rs.{Number(e.total).toFixed(2)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {gstr1.b2c.length > 0 && (
                <div className="card" style={{marginTop:16}}>
                  <div className="card-header"><h3>B2C Invoices (Non-GSTIN) - {gstr1.b2c.length}</h3></div>
                  <div className="table-container">
                    <table>
                      <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>Total</th></tr></thead>
                      <tbody>
                        {gstr1.b2c.map((e, i) => (
                          <tr key={i}>
                            <td>{e.invoice}</td><td>{e.date}</td><td>{e.customer}</td>
                            <td>Rs.{Number(e.taxable).toFixed(2)}</td>
                            <td>Rs.{Number(e.cgst).toFixed(2)}</td>
                            <td>Rs.{Number(e.sgst).toFixed(2)}</td>
                            <td><strong>Rs.{Number(e.total).toFixed(2)}</strong></td>
                          </tr>
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

      {activeTab === 'preview' && (
        <div className="card">
          <div className="card-header">
            <h3>GST Invoice Preview (2026 Format)</h3>
          </div>
          <div ref={printRef} className="gst-invoice-preview">
            <h3 style={{fontSize:20, marginBottom:4}}>TAX INVOICE</h3>
            <h4 style={{fontSize:16, marginBottom:2}}>{company.name}</h4>
            <p style={{textAlign:'center',fontSize:11}}>{company.address} | Ph: {company.phone}</p>
            <p style={{textAlign:'center',fontSize:11}}>GSTIN: {company.gstin} | PAN: {company.pan}</p>

            <div style={{display:'flex', justifyContent:'space-between', marginTop:20, border:'1px solid #000', padding:10}}>
              <div>
                <p><strong>Invoice No:</strong> AE/2026/000001</p>
                <p><strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}</p>
                <p><strong>Payment:</strong> CASH</p>
              </div>
              <div>
                <p><strong>Customer:</strong> Walk-in Customer</p>
                <p><strong>Place of Supply:</strong> Maharashtra (27)</p>
              </div>
            </div>

            <table style={{marginTop:20}}>
              <thead>
                <tr><th style={{width:30}}>#</th><th>Description</th><th style={{width:70}}>HSN</th><th style={{width:50}}>Qty</th><th style={{width:80}}>Rate</th><th style={{width:70}}>Disc</th><th style={{width:90}}>Taxable</th><th style={{width:70}}>CGST</th><th style={{width:70}}>SGST</th><th style={{width:90}}>Total</th></tr>
              </thead>
              <tbody>
                <tr style={{borderTop:'2px solid #000'}}>
                  <td>1</td><td>Sample Product</td><td>8471</td><td>1</td><td>1000.00</td><td>0%</td><td>1000.00</td><td>90.00</td><td>90.00</td><td>1180.00</td>
                </tr>
                <tr><td>2</td><td>Another Item</td><td>8504</td><td>2</td><td>500.00</td><td>5%</td><td>950.00</td><td>85.50</td><td>85.50</td><td>1121.00</td></tr>
              </tbody>
            </table>

            <div style={{textAlign:'right', marginTop:20, borderTop:'2px solid #000', paddingTop:10}}>
              <p><strong>Subtotal:</strong> Rs. 2,000.00</p>
              <p><strong>Discount:</strong> Rs. 50.00</p>
              <p><strong>CGST @9%:</strong> Rs. 175.50</p>
              <p><strong>SGST @9%:</strong> Rs. 175.50</p>
              <h3 style={{fontSize:16, marginTop:8}}>Grand Total: Rs. 2,301.00</h3>
            </div>

            <div style={{marginTop:30, display:'flex', justifyContent:'space-between'}}>
              <div style={{fontSize:10}}>
                <p>Terms & Conditions:</p>
                <p>1. Payment due as per invoice terms.</p>
                <p>2. All disputes subject to local jurisdiction.</p>
              </div>
              <div style={{textAlign:'right'}}>
                <p><strong>For Aditya Enterprises</strong></p>
                <p style={{marginTop:20}}>Authorized Signatory</p>
              </div>
            </div>
          </div>
          <button className="btn btn-success" style={{marginTop:12}} onClick={handlePrintInvoice}>Print GST Invoice</button>
        </div>
      )}
    </div>
  );
}
