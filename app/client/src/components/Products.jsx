import React, { useState, useEffect, useRef } from 'react';

const API = '/api';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);

  const emptyProduct = {
    name: '', image: '', quantity: 0, description: '', hsn_code: '',
    sell_price: 0, inward_price: 0, serial_number: '', discount_percent: 0,
    barcode: '', category_id: '', subcategory_id: ''
  };

  const [form, setForm] = useState(emptyProduct);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadProducts = () => {
    fetch(`${API}/products?search=${search}&category_id=${categoryFilter}`)
      .then(r => r.json()).then(d => { if (d.success) setProducts(d.data); })
      .catch(e => showToast('Failed to load products', 'error'));
  };

  const loadCategories = () => {
    fetch(`${API}/categories`)
      .then(r => r.json()).then(d => { if (d.success) setCategories(d.data); });
  };

  useEffect(() => { loadProducts(); loadCategories(); }, []);
  useEffect(() => { loadProducts(); }, [search, categoryFilter]);

  const openAdd = () => {
    setEditProduct(null);
    setForm(emptyProduct);
    setSubcategories([]);
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setForm({ ...p, category_id: p.category_id || '', subcategory_id: p.subcategory_id || '' });
    if (p.category_id) {
      const cat = categories.find(c => c.id == p.category_id);
      if (cat) setSubcategories(cat.subcategories || []);
    }
    setShowModal(true);
  };

  const handleCategoryChange = (catId) => {
    setForm({ ...form, category_id: catId, subcategory_id: '' });
    if (catId) {
      const cat = categories.find(c => c.id == catId);
      setSubcategories(cat?.subcategories || []);
    } else {
      setSubcategories([]);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
      const r = await fetch(`${API}/upload/image`, { method: 'POST', body: fd });
      const d = await r.json();
      if (d.success) setForm({ ...form, image: d.data.original });
    } catch (err) { showToast('Image upload failed', 'error'); }
  };

  const handleSave = async () => {
    if (!form.name) return showToast('Product name is required', 'error');
    const url = editProduct ? `${API}/products/${editProduct.id}` : `${API}/products`;
    const method = editProduct ? 'PUT' : 'POST';

    try {
      const r = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const d = await r.json();
      if (d.success) {
        showToast(editProduct ? 'Product updated' : 'Product created');
        setShowModal(false);
        loadProducts();
      } else {
        showToast(d.error, 'error');
      }
    } catch (err) { showToast('Save failed', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this product?')) return;
    try {
      const r = await fetch(`${API}/products/${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (d.success) { showToast('Product deleted'); loadProducts(); }
      else showToast(d.error, 'error');
    } catch (err) { showToast('Delete failed', 'error'); }
  };

  const handleGenerateBarcode = async (id) => {
    try {
      const r = await fetch(`${API}/barcode/generate/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await r.json();
      if (d.success) { showToast('Barcode generated'); loadProducts(); }
      else showToast(d.error, 'error');
    } catch (err) { showToast('Barcode generation failed', 'error'); }
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <h2>Products ({products.length})</h2>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
      </div>

      <div className="search-bar">
        <input
          type="text" placeholder="Search by name, HSN, serial, barcode, description..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{width:200}}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Image</th><th>Name</th><th>HSN</th><th>Sell Price</th><th>Inward</th>
                <th>Qty</th><th>Disc%</th><th>Serial</th><th>Barcode</th><th>Category</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>
                    {p.image ? <img src={p.image} alt="" style={{width:40,height:40,borderRadius:4,objectFit:'cover'}} /> : <div style={{width:40,height:40,background:'#eee',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📦</div>}
                  </td>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.hsn_code || '-'}</td>
                  <td>Rs.{Number(p.sell_price).toLocaleString('en-IN')}</td>
                  <td>Rs.{Number(p.inward_price).toLocaleString('en-IN')}</td>
                  <td><span className={`badge ${p.quantity <= 5 ? 'badge-danger' : p.quantity <= 20 ? 'badge-warning' : 'badge-success'}`}>{p.quantity}</span></td>
                  <td>{p.discount_percent}%</td>
                  <td style={{fontSize:11}}>{p.serial_number || '-'}</td>
                  <td style={{fontSize:11}}>
                    {p.barcode_image ? <img src={p.barcode_image} alt="barcode" style={{height:30}} /> : <button className="btn btn-sm btn-outline" onClick={() => handleGenerateBarcode(p.id)}>Generate</button>}
                  </td>
                  <td>{p.category_name || '-'}{p.subcategory_name ? ` / ${p.subcategory_name}` : ''}</td>
                  <td>
                    <button className="btn btn-sm btn-info" style={{marginRight:4}} onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>Del</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={11} style={{textAlign:'center',color:'#999',padding:30}}>No products found. Click "+ Add Product" to get started.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{maxWidth:800}}>
            <h3>{editProduct ? 'Edit Product' : 'Add New Product'}</h3>

            <div className="form-row">
              <div className="form-group">
                <label>Product Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Product name" />
              </div>
              <div className="form-group">
                <label>HSN Code</label>
                <input value={form.hsn_code} onChange={e => setForm({...form, hsn_code: e.target.value})} placeholder="e.g. 8471" />
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Product description..."></textarea>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Quantity</label>
                <input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: Number(e.target.value)})} />
              </div>
              <div className="form-group">
                <label>Sell Price (Rs.)</label>
                <input type="number" step="0.01" value={form.sell_price} onChange={e => setForm({...form, sell_price: Number(e.target.value)})} />
              </div>
              <div className="form-group">
                <label>Inward/Cost Price (Rs.)</label>
                <input type="number" step="0.01" value={form.inward_price} onChange={e => setForm({...form, inward_price: Number(e.target.value)})} />
              </div>
              <div className="form-group">
                <label>Discount % on Sale</label>
                <input type="number" step="0.1" value={form.discount_percent} onChange={e => setForm({...form, discount_percent: Number(e.target.value)})} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Serial Number</label>
                <input value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} placeholder="Auto-generated if empty" />
              </div>
              <div className="form-group">
                <label>Barcode</label>
                <input value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} placeholder="Auto-generated if empty" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select value={form.category_id} onChange={e => handleCategoryChange(e.target.value)}>
                  <option value="">-- Select Category --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Subcategory</label>
                <select value={form.subcategory_id} onChange={e => setForm({...form, subcategory_id: e.target.value})} disabled={!form.category_id}>
                  <option value="">-- Select Subcategory --</option>
                  {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Product Image</label>
              <div style={{display:'flex', gap:10, alignItems:'center'}}>
                <input type="file" accept="image/*" ref={fileRef} onChange={handleImageUpload} style={{display:'none'}} />
                <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>Choose Image</button>
                {form.image && <img src={form.image} alt="preview" style={{width:60,height:60,borderRadius:6,objectFit:'cover'}} />}
                {form.image && <button className="btn btn-sm btn-outline" onClick={() => setForm({...form, image: ''})}>Remove</button>}
              </div>
            </div>

            <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:16}}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editProduct ? 'Update' : 'Create'} Product</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
