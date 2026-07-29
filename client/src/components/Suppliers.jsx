import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', gstin: '', address: '', city: '', state: '', pincode: '', opening_balance: '' });
  const [error, setError] = useState('');

  const load = async () => {
    const r = await api('/parties?type=supplier');
    if (r.success) setSuppliers(r.data);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Supplier name is required'); return; }
    setError('');
    const r = editItem
      ? await api(`/parties/${editItem.id}`, { method: 'PUT', body: { ...form, party_type: 'supplier' } })
      : await api('/parties', { method: 'POST', body: { ...form, party_type: 'supplier' } });
    if (r.success) {
      setShowForm(false); setEditItem(null);
      setForm({ name: '', phone: '', email: '', gstin: '', address: '', city: '', state: '', pincode: '', opening_balance: '' });
      await load();
    } else setError(r.error || 'Failed to save');
  };

  const handleEdit = (s) => {
    setEditItem(s);
    setForm({ name: s.name, phone: s.phone || '', email: s.email || '', gstin: s.gstin || '', address: s.address || '', city: s.city || '', state: s.state || '', pincode: s.pincode || '', opening_balance: s.opening_balance?.toString() || '' });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this supplier?')) return;
    const r = await api(`/parties/${id}`, { method: 'DELETE' });
    if (r.success) await load();
    else setError(r.error);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h3>Suppliers</h3>
        <button className="btn btn-primary" onClick={() => { setEditItem(null); setForm({ name: '', phone: '', email: '', gstin: '', address: '', city: '', state: '', pincode: '', opening_balance: '' }); setShowForm(true); }}>
          + Add Supplier
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {showForm && (
        <div className="card mb-3">
          <div className="card-body">
            <h5>{editItem ? 'Edit Supplier' : 'New Supplier'}</h5>
            <div className="form-row">
              <input className="form-input" placeholder="Supplier Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <input className="form-input" placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              <input className="form-input" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              <input className="form-input" placeholder="GSTIN" value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value})} />
              <input className="form-input" placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
              <input className="form-input" placeholder="City" value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
              <input className="form-input" placeholder="State" value={form.state} onChange={e => setForm({...form, state: e.target.value})} />
              <input className="form-input" placeholder="Pincode" value={form.pincode} onChange={e => setForm({...form, pincode: e.target.value})} />
              <input className="form-input" placeholder="Opening Balance" type="number" value={form.opening_balance} onChange={e => setForm({...form, opening_balance: e.target.value})} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleSave}>{editItem ? 'Update' : 'Save'}</button>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditItem(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-responsive desktop-table">
        {suppliers.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>GSTIN</th>
                <th>City</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.phone}</td>
                  <td>{s.email}</td>
                  <td>{s.gstin}</td>
                  <td>{s.city}</td>
                  <td>&#8377;{Number(s.opening_balance || 0).toFixed(2)}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(s)}>Edit</button>
                    <button className="btn btn-sm btn-danger ml-1" onClick={() => handleDelete(s.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{textAlign:'center',color:'#999',padding:30}}>No suppliers found</div>
        )}
      </div>
      <div className="show-mobile-cards">
        <div className="mobile-cards">
          {suppliers.map(s => (
            <div key={s.id} className="mobile-card">
              <div className="mobile-card-header">{s.name}</div>
              <div className="mobile-card-row">
                <span className="label">Phone</span>
                <span className="value">{s.phone || '-'}</span>
              </div>
              <div className="mobile-card-row">
                <span className="label">Email</span>
                <span className="value" style={{fontSize:12}}>{s.email || '-'}</span>
              </div>
              {s.gstin && <div className="mobile-card-row">
                <span className="label">GSTIN</span>
                <span className="value" style={{fontSize:11}}>{s.gstin}</span>
              </div>}
              <div className="mobile-card-row">
                <span className="label">City</span>
                <span className="value">{s.city || '-'}</span>
              </div>
              <div className="mobile-card-row">
                <span className="label">Balance</span>
                <span className="value">&#8377;{Number(s.opening_balance || 0).toFixed(2)}</span>
              </div>
              <div className="mobile-card-actions">
                <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(s)}>Edit</button>
                <button className="btn btn-sm btn-danger ml-1" onClick={() => handleDelete(s.id)}>Delete</button>
              </div>
            </div>
          ))}
          {suppliers.length === 0 && <div style={{textAlign:'center',color:'#999',padding:20}}>No suppliers found</div>}
        </div>
      </div>
    </div>
  );
}
