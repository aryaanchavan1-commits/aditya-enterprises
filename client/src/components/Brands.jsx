import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Brands() {
  const [brands, setBrands] = useState([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { api('/brands').then(d => { if (d.success) setBrands(d.data); }); }, []);

  const addBrand = async () => {
    if (!name.trim()) { showToast('Enter brand name', 'error'); return; }
    const d = await api('/brands', { method: 'POST', body: { name: name.trim(), description: desc } });
    if (d.success) { showToast('Brand added'); setName(''); setDesc(''); api('/brands').then(r => { if (r.success) setBrands(r.data); }); }
    else showToast(d.error || 'Failed', 'error');
  };

  const updateBrand = async (id) => {
    const d = await api('/brands/' + id, { method: 'PUT', body: { name: editName, description: editDesc } });
    if (d.success) { showToast('Updated'); setEditId(null); api('/brands').then(r => { if (r.success) setBrands(r.data); }); }
    else showToast(d.error || 'Failed', 'error');
  };

  const deleteBrand = async (id) => {
    if (!confirm('Delete this brand?')) return;
    const d = await api('/brands/' + id, { method: 'DELETE' });
    if (d.success) { showToast('Deleted'); api('/brands').then(r => { if (r.success) setBrands(r.data); }); }
    else showToast(d.error || 'Failed', 'error');
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      <h2 style={{marginBottom:16}}>Brands</h2>

      <div className="card" style={{marginBottom:16}}>
        <div className="form-row">
          <div className="form-group">
            <label>Brand Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Havells, Philips" autoFocus />
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief info" />
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={addBrand} disabled={!name.trim()}>+ Add Brand</button>
      </div>

      <div className="categories-grid">
        {brands.map(b => (
          <div key={b.id} className="card">
            {editId === b.id ? (
              <div>
                <div className="form-group">
                  <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                </div>
                <div className="form-group">
                  <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" />
                </div>
                <div style={{display:'flex', gap:6}}>
                  <button className="btn btn-sm btn-success" onClick={() => updateBrand(b.id)}>Save</button>
                  <button className="btn btn-sm btn-outline" onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <h4>{b.name}</h4>
                {b.description && <p style={{fontSize:12, color:'#888', marginTop:4}}>{b.description}</p>}
                <div style={{display:'flex', gap:6, marginTop:8}}>
                  <button className="btn btn-sm btn-info" onClick={() => { setEditId(b.id); setEditName(b.name); setEditDesc(b.description || ''); }}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteBrand(b.id)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {brands.length === 0 && <div style={{textAlign:'center',color:'#999',padding:40}}>No brands yet. Add your first brand above.</div>}
      </div>
    </div>
  );
}
