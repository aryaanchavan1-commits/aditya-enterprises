import React, { useState, useEffect } from 'react';

const API = '/api';
const UNITS = ['pcs', 'kg', 'meter', 'bag', 'box', 'dozen', 'liter', 'pack', 'set', 'roll', 'sheet', 'pair'];

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [cart, setCart] = useState([]);
  const [supplierName, setSupplierName] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [addNewMode, setAddNewMode] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', quantity: 1, inward_price: 0, unit: 'pcs', gst_rate: 18 });

  const showToast = (msg, type = 'success') => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    fetchPurchases();
    fetch(`${API}/products`).then(r => r.json()).then(d => { if (d.success) setProducts(d.data); });
  }, []);

  const fetchPurchases = () => {
    fetch(`${API}/purchases`).then(r => r.json()).then(d => { if (d.success) setPurchases(d.data); });
  };

  const addToCart = (product) => {
    const existing = cart.find(c => c.product_id === product.id);
    if (existing) {
      setCart(cart.map(c => c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { product_id: product.id, product_name: product.name, quantity: 1, inward_price: product.inward_price || 0, gst_rate: product.gst_rate || 18, unit: product.unit || 'pcs' }]);
    }
    setSearch('');
  };

  const addNewProductToCart = () => {
    if (!newProduct.name.trim()) { showToast('Enter product name', 'error'); return; }
    setCart([...cart, {
      product_id: null, product_name: newProduct.name.trim(), quantity: newProduct.quantity || 1,
      inward_price: newProduct.inward_price || 0, gst_rate: newProduct.gst_rate || 18, unit: newProduct.unit || 'pcs',
      isNew: true
    }]);
    setNewProduct({ name: '', quantity: 1, inward_price: 0, unit: 'pcs', gst_rate: 18 });
    setAddNewMode(false);
  };

  const updateCartItem = (productId, field, value) => {
    setCart(cart.map(c => (c.product_id === productId || (c.isNew && c.product_name === productId)) ? { ...c, [field]: value } : c));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(c => c.product_id !== productId && !(c.isNew && c.product_name === productId)));
  };

  const submitPurchase = async () => {
    if (cart.length === 0) { showToast('Add at least one product', 'error'); return; }

    const items = cart.map(c => ({
      product_id: c.product_id, product_name: c.product_name, quantity: c.quantity,
      inward_price: c.inward_price, gst_rate: c.gst_rate || 18, unit: c.unit || 'pcs',
      isNew: c.isNew || false
    }));

    const r = await fetch(`${API}/purchases`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_name: supplierName || 'Unknown Supplier', payment_status: paymentStatus, notes, items, purchase_date: new Date().toISOString().split('T')[0] })
    });
    const d = await r.json();
    if (d.success) {
      showToast('Purchase recorded! Stock updated.');
      setCart([]); setSupplierName(''); setNotes(''); setShowForm(false);
      fetchPurchases();
      fetch(`${API}/products`).then(r => r.json()).then(d2 => { if (d2.success) setProducts(d2.data); });
    } else { showToast(d.error, 'error'); }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.includes(search)
  );

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && search.trim() && !addNewMode) {
      const match = products.find(p => p.barcode === search.trim() || p.name.toLowerCase() === search.trim().toLowerCase());
      if (match) addToCart(match);
    }
  };

  const total = cart.reduce((sum, c) => sum + (c.inward_price * c.quantity), 0);
  const gstTotal = cart.reduce((sum, c) => sum + ((c.inward_price * c.quantity) * ((c.gst_rate || 18) / 100)), 0);

  return (
    <div>
      {toast && <div className="toast toast-success" style={{display: toast ? 'flex' : 'none'}}>{toast}</div>}

      <div className="page-header">
        <h3>Purchases</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'View History' : '+ New Purchase'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="form-row">
            <div className="form-group">
              <label>Supplier Name</label>
              <input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Distributor name" />
            </div>
            <div className="form-group">
              <label>Payment Status</label>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Search Existing Products</label>
            <div className="search-bar">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or barcode..." onKeyDown={handleSearchKeyDown} autoFocus />
              <button className="btn btn-sm btn-outline" onClick={() => setAddNewMode(!addNewMode)}>
                {addNewMode ? 'Cancel' : '+ New Product'}
              </button>
            </div>
          </div>

          {addNewMode && (
            <div className="card" style={{marginBottom:12, border:'2px dashed var(--accent2)', background:'#f0f8ff'}}>
              <h4 style={{marginBottom:8,color:'var(--accent2)'}}>Add New Product</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="e.g. PVC Pipe 2inch" autoFocus />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity</label>
                  <input type="number" min="1" value={newProduct.quantity} onChange={e => setNewProduct({...newProduct, quantity: Number(e.target.value) || 1})} />
                </div>
                <div className="form-group">
                  <label>Rate (Rs./{newProduct.unit})</label>
                  <input type="number" step="0.01" value={newProduct.inward_price} onChange={e => setNewProduct({...newProduct, inward_price: Number(e.target.value) || 0})} />
                </div>
                <div className="form-group">
                  <label>GST %</label>
                  <input type="number" step="0.1" value={newProduct.gst_rate} onChange={e => setNewProduct({...newProduct, gst_rate: Number(e.target.value) || 18})} />
                </div>
              </div>
              <button className="btn btn-sm btn-success" onClick={addNewProductToCart}>Add to Purchase Cart</button>
            </div>
          )}

          {search && !addNewMode && (
            <div className="purchases-search-results">
              {filteredProducts.map(p => (
                <div key={p.id} className="purchases-search-item">
                  <span><strong>{p.name}</strong> <span style={{color:'var(--text-muted)',fontSize:12}}>(Stock: {p.quantity} {p.unit || 'pcs'})</span></span>
                  <button className="btn btn-sm btn-primary" onClick={() => addToCart(p)}>+ Add</button>
                </div>
              ))}
              {filteredProducts.length === 0 && <div className="empty-state" style={{padding:20}}>No products found</div>}
            </div>
          )}

          {cart.length > 0 && (
            <div>
              <h4 style={{margin:'12px 0 8px'}}>Cart Items <span style={{fontWeight:400,fontSize:12,color:'var(--text-muted)'}}>({cart.length} items)</span></h4>
              <div className="table-container desktop-table">
                <table className="purchases-cart-table">
                  <thead>
                    <tr><th>Product</th><th>Qty</th><th>Unit</th><th>Rate</th><th>GST%</th><th>Total</th><th></th></tr>
                  </thead>
                  <tbody>
                    {cart.map((c, idx) => (
                      <tr key={c.product_id || 'new-' + idx}>
                        <td>{c.product_name} {c.isNew && <span className="badge badge-warning" style={{fontSize:10}}>New</span>}</td>
                        <td><input type="number" value={c.quantity} min="1" onChange={e => updateCartItem(c.product_id || c.product_name, 'quantity', parseInt(e.target.value) || 1)} /></td>
                        <td>
                          <select value={c.unit || 'pcs'} onChange={e => updateCartItem(c.product_id || c.product_name, 'unit', e.target.value)}>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td><input type="number" step="0.01" value={c.inward_price} onChange={e => updateCartItem(c.product_id || c.product_name, 'inward_price', parseFloat(e.target.value) || 0)} /></td>
                        <td><input type="number" step="0.1" value={c.gst_rate} onChange={e => updateCartItem(c.product_id || c.product_name, 'gst_rate', parseFloat(e.target.value) || 0)} /></td>
                        <td>Rs.{(c.inward_price * c.quantity).toFixed(2)}</td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => removeFromCart(c.product_id || c.product_name)}>&times;</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="show-mobile-cards">
                <div className="mobile-cards">
                  {cart.map((c, idx) => (
                    <div key={c.product_id || 'new-' + idx} className="mobile-card">
                      <div className="mobile-card-header">{c.product_name}</div>
                      {c.isNew && <div><span className="badge badge-warning" style={{fontSize:10}}>New</span></div>}
                      <div className="mobile-card-row">
                        <span className="label">Qty</span>
                        <input type="number" value={c.quantity} min="1" onChange={e => updateCartItem(c.product_id || c.product_name, 'quantity', parseInt(e.target.value) || 1)}
                          style={{width:60, textAlign:'center'}} />
                      </div>
                      <div className="mobile-card-row">
                        <span className="label">Unit</span>
                        <select value={c.unit || 'pcs'} onChange={e => updateCartItem(c.product_id || c.product_name, 'unit', e.target.value)}
                          style={{width:80}}>
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="mobile-card-row">
                        <span className="label">Rate</span>
                        <input type="number" step="0.01" value={c.inward_price} onChange={e => updateCartItem(c.product_id || c.product_name, 'inward_price', parseFloat(e.target.value) || 0)}
                          style={{width:90, textAlign:'right'}} />
                      </div>
                      <div className="mobile-card-row">
                        <span className="label">GST%</span>
                        <input type="number" step="0.1" value={c.gst_rate} onChange={e => updateCartItem(c.product_id || c.product_name, 'gst_rate', parseFloat(e.target.value) || 0)}
                          style={{width:60, textAlign:'right'}} />
                      </div>
                      <div className="mobile-card-row">
                        <span className="label">Total</span>
                        <span className="value">Rs.{(c.inward_price * c.quantity).toFixed(2)}</span>
                      </div>
                      <div className="mobile-card-actions">
                        <button className="btn btn-sm btn-danger" onClick={() => removeFromCart(c.product_id || c.product_name)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="purchases-cart-summary">
                Subtotal: Rs.{total.toFixed(2)} | GST: Rs.{gstTotal.toFixed(2)} | <span style={{fontSize:16}}>Total: Rs.{(total + gstTotal).toFixed(2)}</span>
              </div>
              <div className="form-group" style={{marginTop:8}}>
                <label>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows="2" />
              </div>
              <button className="btn btn-success btn-lg" style={{width:'100%'}} onClick={submitPurchase} disabled={cart.length === 0}>
                Save Purchase Order - Rs.{(total + gstTotal).toFixed(2)}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3>Purchase History</h3>
        {purchases.length === 0 ? (
          <div className="empty-state"><p>No purchases yet</p></div>
        ) : (
          <>
            <div className="table-container desktop-table">
              <table>
                <thead><tr><th>Invoice</th><th>Date</th><th>Supplier</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {purchases.map(p => (
                    <tr key={p.id}>
                      <td>{p.invoice_number}</td>
                      <td>{p.purchase_date}</td>
                      <td>{p.supplier_name}</td>
                      <td>{p.items?.length || 0} items</td>
                      <td>Rs.{Number(p.grand_total).toFixed(2)}</td>
                      <td><span className={`badge badge-${p.payment_status === 'paid' ? 'success' : 'warning'}`}>{p.payment_status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="show-mobile-cards">
              <div className="mobile-cards">
                {purchases.map(p => (
                  <div key={p.id} className="mobile-card">
                    <div className="mobile-card-header">{p.invoice_number}</div>
                    <div className="mobile-card-row">
                      <span className="label">Supplier</span>
                      <span className="value">{p.supplier_name}</span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="label">Date</span>
                      <span className="value">{p.purchase_date}</span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="label">Items</span>
                      <span className="value">{p.items?.length || 0}</span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="label">Total</span>
                      <span className="value">Rs.{Number(p.grand_total).toFixed(2)}</span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="label">Status</span>
                      <span className="value"><span className={`badge badge-${p.payment_status === 'paid' ? 'success' : 'warning'}`}>{p.payment_status}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
