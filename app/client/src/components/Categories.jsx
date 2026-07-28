import React, { useState, useEffect } from 'react';

const API = '/api';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [editCat, setEditCat] = useState(null);
  const [catName, setCatName] = useState('');
  const [addSubCat, setAddSubCat] = useState(null);
  const [subName, setSubName] = useState('');
  const [editSub, setEditSub] = useState(null);
  const [editSubName, setEditSubName] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadCategories = () => {
    fetch(`${API}/categories`)
      .then(r => r.json()).then(d => { if (d.success) setCategories(d.data); });
  };

  useEffect(() => { loadCategories(); }, []);

  const updateCategory = async (id, name) => {
    try {
      const r = await fetch(`${API}/categories/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const d = await r.json();
      if (d.success) { showToast('Category updated'); loadCategories(); setEditCat(null); }
    } catch (err) { showToast('Update failed', 'error'); }
  };

  const addSubcategory = async (catId, name) => {
    try {
      const r = await fetch(`${API}/categories/${catId}/subcategories`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const d = await r.json();
      if (d.success) { showToast('Subcategory added'); loadCategories(); setAddSubCat(null); setSubName(''); }
    } catch (err) { showToast('Add failed', 'error'); }
  };

  const updateSubcategory = async (catId, subId, name) => {
    try {
      const r = await fetch(`${API}/categories/${catId}/subcategories/${subId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const d = await r.json();
      if (d.success) { showToast('Subcategory updated'); loadCategories(); }
    } catch (err) { showToast('Update failed', 'error'); }
  };

  const deleteSubcategory = async (catId, subId) => {
    if (!confirm('Delete this subcategory?')) return;
    try {
      const r = await fetch(`${API}/categories/${catId}/subcategories/${subId}`, { method: 'DELETE' });
      const d = await r.json();
      if (d.success) { showToast('Subcategory deleted'); loadCategories(); }
    } catch (err) { showToast('Delete failed', 'error'); }
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      <h2 style={{marginBottom:20}}>Categories & Subcategories</h2>
      <p style={{color:'#777', marginBottom:20}}>10 Categories with 6 subcategories each. Click category name to edit. Add products to subcategories from the Products page.</p>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(350px, 1fr))', gap:16}}>
        {categories.map(cat => (
          <div key={cat.id} className="card">
            <div className="card-header">
              {editCat === cat.id ? (
                <div style={{display:'flex', gap:6, flex:1}}>
                  <input value={catName} onChange={e => setCatName(e.target.value)} style={{flex:1}} autoFocus />
                  <button className="btn btn-sm btn-success" onClick={() => updateCategory(cat.id, catName)}>Save</button>
                  <button className="btn btn-sm btn-outline" onClick={() => setEditCat(null)}>X</button>
                </div>
              ) : (
                <>
                  <h3 onClick={() => { setEditCat(cat.id); setCatName(cat.name); }} style={{cursor:'pointer'}}>
                    {cat.name} <span style={{fontSize:12, color:'#999', fontWeight:400}}>({cat.product_count} products)</span>
                  </h3>
                  <span className="badge badge-info">{cat.subcategories?.length || 0}/6 subs</span>
                </>
              )}
            </div>

            <div>
              {cat.subcategories?.map(sub => (
                <div key={sub.id} style={{display:'flex', alignItems:'center', gap:6, padding:'6px 0', borderBottom:'1px solid #f0f0f0'}}>
                  {editSub?.catId === cat.id && editSub?.subId === sub.id ? (
                    <div style={{display:'flex', gap:6, flex:1}}>
                      <input value={editSubName} onChange={e => setEditSubName(e.target.value)} style={{flex:1, padding:'4px 8px', fontSize:13}} autoFocus />
                      <button className="btn btn-sm btn-success" onClick={() => { updateSubcategory(cat.id, sub.id, editSubName); setEditSub(null); }}>OK</button>
                      <button className="btn btn-sm btn-outline" onClick={() => setEditSub(null)}>X</button>
                    </div>
                  ) : (
                    <>
                      <span style={{flex:1, fontSize:13}}>{sub.name}</span>
                      <button className="btn btn-sm btn-outline" onClick={() => { setEditSub({catId: cat.id, subId: sub.id}); setEditSubName(sub.name); }}>✏</button>
                      <button className="btn btn-sm btn-outline" onClick={() => deleteSubcategory(cat.id, sub.id)} style={{color:'#e74c3c'}}>🗑</button>
                    </>
                  )}
                </div>
              ))}
              {(!cat.subcategories || cat.subcategories.length < 6) && (
                <div style={{marginTop:8}}>
                  {addSubCat === cat.id ? (
                    <div style={{display:'flex', gap:6}}>
                      <input value={subName} onChange={e => setSubName(e.target.value)} placeholder="Subcategory name" style={{flex:1}} autoFocus />
                      <button className="btn btn-sm btn-success" onClick={() => addSubcategory(cat.id, subName)}>Add</button>
                      <button className="btn btn-sm btn-outline" onClick={() => setAddSubCat(null)}>X</button>
                    </div>
                  ) : (
                    <button className="btn btn-sm btn-outline" onClick={() => { setAddSubCat(cat.id); setSubName(''); }}>
                      + Add Subcategory
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
