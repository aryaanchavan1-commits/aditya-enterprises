import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [editCat, setEditCat] = useState(null);
  const [catName, setCatName] = useState('');
  const [addSubCat, setAddSubCat] = useState(null);
  const [subName, setSubName] = useState('');
  const [editSub, setEditSub] = useState(null);
  const [editSubName, setEditSubName] = useState('');
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [toast, setToast] = useState(null);
  const mounted = useRef(true);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadCategories = () => {
    api('/categories').then(d => { if (mounted.current && d.success) setCategories(d.data); });
  };

  useEffect(() => { mounted.current = true; loadCategories(); return () => { mounted.current = false; }; }, []);

  const updateCategory = async (id, name) => {
    const d = await api('/category?id=' + id, { method: 'PUT', body: { name } });
    if (d.success) { showToast('Category updated'); loadCategories(); setEditCat(null); }
    else { showToast(d.error || 'Update failed', 'error'); }
  };

  const addSubcategory = async (catId, name) => {
    const d = await api('/subcategory?catId=' + catId, { method: 'POST', body: { name } });
    if (d.success) { showToast('Subcategory added'); loadCategories(); setAddSubCat(null); setSubName(''); }
    else { showToast(d.error || 'Add failed', 'error'); }
  };

  const updateSubcategory = async (catId, subId, name) => {
    const d = await api('/subcategory?catId=' + catId + '&subId=' + subId, { method: 'PUT', body: { name } });
    if (d.success) { showToast('Subcategory updated'); loadCategories(); }
    else { showToast(d.error || 'Update failed', 'error'); }
  };

  const deleteSubcategory = async (catId, subId) => {
    if (!confirm('Delete this subcategory?')) return;
    const d = await api('/subcategory?catId=' + catId + '&subId=' + subId, { method: 'DELETE' });
    if (d.success) { showToast('Subcategory deleted'); loadCategories(); }
    else { showToast(d.error || 'Delete failed', 'error'); }
  };

  const addCategory = async () => {
    if (!newCatName.trim()) { showToast('Enter a category name', 'error'); return; }
    const d = await api('/categories', { method: 'POST', body: { name: newCatName.trim() } });
    if (d.success) { showToast('Category added'); loadCategories(); setNewCatName(''); setShowAddCat(false); }
    else { showToast(d.error || 'Failed to add category', 'error'); }
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:8}}>
        <h2 style={{margin:0}}>Categories & Subcategories</h2>
        {showAddCat ? (
          <div style={{display:'flex', gap:6, alignItems:'center'}}>
            <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name" style={{width:200}} autoFocus onKeyDown={e => e.key === 'Enter' && addCategory()} />
            <button className="btn btn-sm btn-success" onClick={addCategory}>Add</button>
            <button className="btn btn-sm btn-outline" onClick={() => setShowAddCat(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => setShowAddCat(true)}>+ New Category</button>
        )}
      </div>

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
                      <button className="btn btn-sm btn-outline" onClick={() => { setEditSub({catId: cat.id, subId: sub.id}); setEditSubName(sub.name); }}>Edit</button>
                      <button className="btn btn-sm btn-outline" onClick={() => deleteSubcategory(cat.id, sub.id)} style={{color:'#e74c3c'}}>Del</button>
                    </>
                  )}
                </div>
              ))}
              {(
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
