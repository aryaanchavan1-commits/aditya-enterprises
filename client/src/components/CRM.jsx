import React, { useState, useEffect } from 'react';
const API = '/api';
export default function CRM() {
  const [customers, setCustomers] = useState([]);
  const [visits, setVisits] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [visitForm, setVisitForm] = useState({ customer_name: '', customer_phone: '', visit_date: new Date().toISOString().split('T')[0], purpose: '', notes: '', amount: 0 });
  const showToast = (msg, type) => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const loadCustomers = () => {
    fetch(`${API}/crm?search=${search}`).then(r => r.json()).then(d => { if (d.success) setCustomers(d.data.customers || []); }).catch(() => showToast('Failed to load', 'error'));
  };
  useEffect(() => { loadCustomers(); }, [search]);
  const loadVisits = (phone) => {
    fetch(`${API}/crm?phone=${phone}`).then(r => r.json()).then(d => { if (d.success) { setVisits(d.data.customers?.[0]?.visits || []); setSelectedCustomer(d.data.customers?.[0] || null); } }).catch(() => showToast('Failed', 'error'));
  };
  const handleAddVisit = async () => {
    if (!visitForm.customer_name) return showToast('Name required', 'error');
    try {
      const r = await fetch(`${API}/crm/visit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(visitForm) });
      const d = await r.json();
      if (d.success) { showToast('Visit recorded'); setShowVisitModal(false); setVisitForm({ customer_name: '', customer_phone: '', visit_date: new Date().toISOString().split('T')[0], purpose: '', notes: '', amount: 0 }); loadCustomers(); if (selectedCustomer) loadVisits(selectedCustomer.phone); }
      else showToast(d.error, 'error');
    } catch (e) { showToast('Failed', 'error'); }
  };
  const openVisitForm = (customer) => {
    setVisitForm({ customer_name: customer?.name || '', customer_phone: customer?.phone || '', visit_date: new Date().toISOString().split('T')[0], purpose: '', notes: '', amount: 0 });
    setShowVisitModal(true);
  };
  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <h2>CRM ({customers.length})</h2>
        <button className="btn btn-primary btn-sm hide-mobile" onClick={() => openVisitForm(null)}>+ Visit</button>
      </div>
      <button className="fab show-mobile" onClick={() => openVisitForm(null)}>+</button>
      <div className="search-bar">
        <input type="text" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="crm-grid">
        <div className="card">
          <div className="card-header"><h3>Customers</h3></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Name</th><th>Phone</th><th>Visits</th><th>Total</th><th>Last Visit</th></tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.phone || c.name} onClick={() => loadVisits(c.phone)} style={{cursor:'pointer', background: selectedCustomer?.phone === c.phone ? '#e8f4fd' : '' }}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.phone || '-'}</td>
                    <td><span className={`badge ${c.totalVisits > 1 ? 'badge-success' : 'badge-info'}`}>{c.totalVisits}</span></td>
                    <td>Rs.{Number(c.totalAmount).toLocaleString('en-IN')}</td>
                    <td style={{fontSize:11}}>{c.lastVisit}</td>
                  </tr>
                ))}
                {customers.length === 0 && <tr><td colSpan={5} style={{textAlign:'center',color:'#999',padding:20}}>No customers found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>{selectedCustomer ? selectedCustomer.name : 'Visit History'}</h3></div>
          {selectedCustomer ? (
            <div>
              <div style={{display:'flex', gap:8, marginBottom:12}}>
                <button className="btn btn-sm btn-primary" onClick={() => openVisitForm(selectedCustomer)}>Add Visit</button>
                <button className="btn btn-sm btn-outline" onClick={() => setSelectedCustomer(null)}>Clear</button>
              </div>
              <div className="table-container">
                <table>
                  <thead><tr><th>Date</th><th>Purpose</th><th>Amount</th><th>Notes</th></tr></thead>
                  <tbody>
                    {visits.map(v => (
                      <tr key={v.id}>
                        <td style={{fontSize:11}}>{v.visit_date}</td>
                        <td>{v.purpose || '-'}</td>
                        <td>Rs.{Number(v.amount).toLocaleString('en-IN')}</td>
                        <td style={{fontSize:11,color:'#666'}}>{v.notes || '-'}</td>
                      </tr>
                    ))}
                    {visits.length === 0 && <tr><td colSpan={4} style={{textAlign:'center',color:'#999'}}>No visits recorded</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p style={{color:'#999',textAlign:'center',padding:20}}>Select a customer to view visit history</p>
          )}
        </div>
      </div>
      {showVisitModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowVisitModal(false)}>
          <div className="modal" style={{maxWidth:500}}>
            <h3>Record Customer Visit</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Customer Name *</label>
                <input value={visitForm.customer_name} onChange={e => setVisitForm({...visitForm, customer_name: e.target.value})} placeholder="Customer name" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={visitForm.customer_phone} onChange={e => setVisitForm({...visitForm, customer_phone: e.target.value})} placeholder="Phone number" />
              </div>
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={visitForm.visit_date} onChange={e => setVisitForm({...visitForm, visit_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Purpose</label>
              <input value={visitForm.purpose} onChange={e => setVisitForm({...visitForm, purpose: e.target.value})} placeholder="e.g. Purchase, Inquiry, Service follow-up" />
            </div>
            <div className="form-group">
              <label>Amount (Rs.)</label>
              <input type="number" value={visitForm.amount} onChange={e => setVisitForm({...visitForm, amount: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={visitForm.notes} onChange={e => setVisitForm({...visitForm, notes: e.target.value})} placeholder="Additional notes..." />
            </div>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:16}}>
              <button className="btn btn-outline" onClick={() => setShowVisitModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddVisit}>Record Visit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
