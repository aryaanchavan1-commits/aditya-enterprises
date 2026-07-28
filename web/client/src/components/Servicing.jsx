import React, { useState, useEffect } from 'react';
const API = '/api';
const STATUSES = ['pending', 'in_progress', 'awaiting_parts', 'completed', 'delivered', 'cancelled'];
export default function Servicing() {
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editService, setEditService] = useState(null);
  const [toast, setToast] = useState(null);
  const emptyForm = { customer_name: '', customer_phone: '', device_type: '', brand: '', model: '', serial_number: '', issue: '', parts: '', parts_cost: 0, service_charge: 0, status: 'pending', technician: '', received_date: new Date().toISOString().split('T')[0], notes: '' };
  const [form, setForm] = useState(emptyForm);
  const showToast = (msg, type) => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const loadServices = () => {
    fetch(`${API}/services?search=${search}&status=${statusFilter}`).then(r => r.json()).then(d => { if (d.success) setServices(d.data); }).catch(() => showToast('Failed to load', 'error'));
  };
  useEffect(() => { loadServices(); }, [search, statusFilter]);
  const openAdd = () => { setEditService(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (s) => { setEditService(s); setForm({ ...s }); setShowModal(true); };
  const handleSave = async () => {
    if (!form.customer_name) return showToast('Customer name required', 'error');
    const url = editService ? `${API}/services/${editService.id}` : `${API}/services`;
    const method = editService ? 'PUT' : 'POST';
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json();
      if (d.success) { showToast(editService ? 'Service updated' : 'Service created'); setShowModal(false); loadServices(); }
      else showToast(d.error, 'error');
    } catch (e) { showToast('Save failed', 'error'); }
  };
  const handleDelete = async (id) => {
    if (!confirm('Delete this service record?')) return;
    try { await fetch(`${API}/services/${id}`, { method: 'DELETE' }); showToast('Deleted'); loadServices(); }
    catch (e) { showToast('Delete failed', 'error'); }
  };
  const handleStatusChange = async (service, newStatus) => {
    try {
      const r = await fetch(`${API}/services/${service.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...service, status: newStatus }) });
      const d = await r.json();
      if (d.success) { showToast(`Status: ${newStatus}`); loadServices(); }
      else showToast(d.error, 'error');
    } catch (e) { showToast('Update failed', 'error'); }
  };
  const totalOutstanding = services.filter(s => s.status !== 'completed' && s.status !== 'delivered' && s.status !== 'cancelled').reduce((s, x) => s + Number(x.total_charge), 0);
  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <h2>Servicing ({services.length})</h2>
        <div style={{display:'flex', gap:12, alignItems:'center'}}>
          <span style={{fontSize:13, fontWeight:600}}>Outstanding: Rs.{totalOutstanding.toLocaleString('en-IN')}</span>
          <button className="btn btn-primary" onClick={openAdd}>New Service</button>
        </div>
      </div>
      <div className="search-bar">
        <input type="text" placeholder="Search by customer, device, serial..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{width:180}}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>)}
        </select>
      </div>
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Customer</th><th>Device</th><th>Issue</th><th>Parts Cost</th><th>Service Charge</th><th>Total</th><th>Status</th><th>Received</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.customer_name}</strong>{s.customer_phone && <div style={{fontSize:10,color:'#999'}}>{s.customer_phone}</div>}</td>
                  <td style={{fontSize:12}}>{s.device_type || '-'}{s.brand ? ` (${s.brand})` : ''}</td>
                  <td style={{fontSize:12, maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.issue || '-'}</td>
                  <td>Rs.{Number(s.parts_cost).toLocaleString('en-IN')}</td>
                  <td>Rs.{Number(s.service_charge).toLocaleString('en-IN')}</td>
                  <td><strong>Rs.{Number(s.total_charge).toLocaleString('en-IN')}</strong></td>
                  <td>
                    <select value={s.status} onChange={e => handleStatusChange(s, e.target.value)} className={`badge ${s.status === 'completed' || s.status === 'delivered' ? 'badge-success' : s.status === 'cancelled' ? 'badge-danger' : s.status === 'in_progress' ? 'badge-info' : s.status === 'awaiting_parts' ? 'badge-warning' : 'badge-info'}`} style={{fontSize:11, padding:'2px 6px', border:'none', cursor:'pointer'}}>
                      {STATUSES.map(st => <option key={st} value={st}>{st.replace('_', ' ').toUpperCase()}</option>)}
                    </select>
                  </td>
                  <td style={{fontSize:11}}>{s.received_date}</td>
                  <td>
                    <button className="btn btn-sm btn-info" style={{marginRight:4}} onClick={() => openEdit(s)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>Del</button>
                  </td>
                </tr>
              ))}
              {services.length === 0 && <tr><td colSpan={9} style={{textAlign:'center',color:'#999',padding:30}}>No service records. Click "New Service" to add one.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{maxWidth:700}}>
            <h3>{editService ? 'Edit Service' : 'New Service Record'}</h3>
            <div className="form-row">
              <div className="form-group"><label>Customer Name *</label><input value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} placeholder="Customer name" /></div>
              <div className="form-group"><label>Phone</label><input value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})} placeholder="Phone number" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Device Type</label><input value={form.device_type} onChange={e => setForm({...form, device_type: e.target.value})} placeholder="e.g. Laptop, Mobile, Printer" /></div>
              <div className="form-group"><label>Brand</label><input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} placeholder="e.g. HP, Samsung" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Model</label><input value={form.model} onChange={e => setForm({...form, model: e.target.value})} placeholder="Model number" /></div>
              <div className="form-group"><label>Serial Number</label><input value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} placeholder="Device serial number" /></div>
            </div>
            <div className="form-group"><label>Issue Reported</label><textarea value={form.issue} onChange={e => setForm({...form, issue: e.target.value})} placeholder="Describe the issue..." /></div>
            <div className="form-group"><label>Parts Used</label><textarea value={form.parts} onChange={e => setForm({...form, parts: e.target.value})} placeholder="List parts used, if any" /></div>
            <div className="form-row">
              <div className="form-group"><label>Parts Cost (Rs.)</label><input type="number" value={form.parts_cost} onChange={e => setForm({...form, parts_cost: Number(e.target.value)})} /></div>
              <div className="form-group"><label>Service Charge (Rs.)</label><input type="number" value={form.service_charge} onChange={e => setForm({...form, service_charge: Number(e.target.value)})} /></div>
              <div className="form-group"><label>Total: Rs.{Number(form.parts_cost + form.service_charge).toLocaleString('en-IN')}</label></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Technician</label><input value={form.technician} onChange={e => setForm({...form, technician: e.target.value})} placeholder="Assigned to" /></div>
              <div className="form-group"><label>Received Date</label><input type="date" value={form.received_date} onChange={e => setForm({...form, received_date: e.target.value})} /></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>{STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>)}</select></div>
            </div>
            <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Additional notes..." /></div>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:16}}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editService ? 'Update' : 'Create'} Service</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
