import React, { useState, useEffect } from 'react';

const API = '/api';

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
      setCart([...cart, { product_id: product.id, product_name: product.name, quantity: 1, inward_price: product.inward_price || 0, gst_rate: product.gst_rate || 18 }]);
    }
  };

  const updateCartItem = (productId, field, value) => {
    setCart(cart.map(c => c.product_id === productId ? { ...c, [field]: value } : c));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(c => c.product_id !== productId));
  };

  const submitPurchase = async () => {
    if (cart.length === 0) { showToast('Add at least one product', 'error'); return; }
    const r = await fetch(`${API}/purchases`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_name: supplierName || 'Unknown Supplier', payment_status: paymentStatus, notes, items: cart, purchase_date: new Date().toISOString().split('T')[0] })
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
    p.barcode?.toLowerCase().includes(search.toLowerCase())
  );

  const total = cart.reduce((s, c) => s + (c.inward_price * c.quantity), 0);
  const gstTotal = cart.reduce((s, c) => s + (c.inward_price * c.quantity * (c.gst_rate || 18) / 100), 0);

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type || 'success'}`}>{toast}</div>}
      <div className="card-header">
        <h2>Purchase Orders</h2>
        <button className="btn btn-success" onClick={() => setShowForm(!showForm)}>{showForm ? '✕ Close' : '+ New Purchase'}</button>
      </div>

      {showForm && (
        <div className="card">
          <h3>New Purchase Order</h3>
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
            <label>Search Products to Add</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or barcode..." />
          </div>

          {search && (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, marginBottom: 12 }}>
              {filteredProducts.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ fontSize: 13 }}>{p.name} <span style={{ color: '#999' }}>(Stock: {p.quantity})</span></span>
                  <button className="btn btn-sm btn-primary" onClick={() => addToCart(p)}>+ Add</button>
                </div>
              ))}
              {filteredProducts.length === 0 && <div className="empty-state">No products found</div>}
            </div>
          )}

          {cart.length > 0 && (
            <div>
              <h4 style={{ margin: '12px 0 8px' }}>Cart Items</h4>
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Product</th><th>Qty</th><th>Rate</th><th>GST%</th><th>Total</th><th></th></tr>
                  </thead>
                  <tbody>
                    {cart.map(c => (
                      <tr key={c.product_id}>
                        <td>{c.product_name}</td>
                        <td><input type="number" value={c.quantity} min="1" onChange={e => updateCartItem(c.product_id, 'quantity', parseInt(e.target.value) || 1)} style={{ width: 60 }} /></td>
                        <td><input type="number" value={c.inward_price} onChange={e => updateCartItem(c.product_id, 'inward_price', parseFloat(e.target.value) || 0)} style={{ width: 80 }} /></td>
                        <td><input type="number" value={c.gst_rate} onChange={e => updateCartItem(c.product_id, 'gst_rate', parseFloat(e.target.value) || 0)} style={{ width: 60 }} /></td>
                        <td>Rs.{(c.inward_price * c.quantity).toFixed(2)}</td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => removeFromCart(c.product_id)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 600 }}>
                Subtotal: Rs.{total.toFixed(2)} | GST: Rs.{gstTotal.toFixed(2)} | <span style={{ fontSize: 16 }}>Total: Rs.{(total + gstTotal).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows="2" />
          </div>
          <button className="btn btn-success" onClick={submitPurchase} disabled={cart.length === 0}>Save Purchase Order</button>
        </div>
      )}

      <div className="card">
        <h3>Purchase History</h3>
        {purchases.length === 0 ? (
          <div className="empty-state"><p>No purchases yet</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>Invoice</th><th>Date</th><th>Supplier</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id}>
                    <td>{p.invoice_number}</td>
                    <td>{p.purchase_date}</td>
                    <td>{p.supplier_name}</td>
                    <td>{JSON.parse(p.items || '[]').length} items</td>
                    <td>Rs.{Number(p.grand_total).toFixed(2)}</td>
                    <td><span className={`badge badge-${p.payment_status === 'paid' ? 'success' : 'warning'}`}>{p.payment_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
