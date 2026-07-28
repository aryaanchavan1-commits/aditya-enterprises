import React, { useState, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useRef } from 'react';

const API = '/api';

export default function SalesPOS() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState({ name: 'Walk-in Customer', phone: '', gstin: '', address: '' });
  const [paymentMode, setPaymentMode] = useState('cash');
  const [toast, setToast] = useState(null);
  const [lastInvoice, setLastInvoice] = useState(null);
  const printRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetch(`${API}/products`)
      .then(r => r.json()).then(d => { if (d.success) setProducts(d.data); });
  }, []);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.hsn_code?.includes(search) ||
    p.barcode?.includes(search)
  );

  const addToCart = (product) => {
    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      if (existing.quantity >= product.quantity) {
        showToast(`Only ${product.quantity} left in stock!`, 'error');
        return;
      }
      setCart(cart.map(item =>
        item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        hsn_code: product.hsn_code,
        sell_price: product.sell_price,
        discount_percent: product.discount_percent || 0,
        quantity: 1,
        max_quantity: product.quantity,
        image: product.image
      }]);
    }
    setSearch('');
  };

  const updateCartItem = (productId, field, value) => {
    setCart(cart.map(item =>
      item.product_id === productId ? { ...item, [field]: value } : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.sell_price * item.quantity), 0);
  const cartDiscount = cart.reduce((sum, item) => sum + ((item.sell_price * item.quantity) * (item.discount_percent / 100)), 0);
  const afterDiscount = cartSubtotal - cartDiscount;
  const isInterState = customer.gstin && customer.gstin.substring(0, 2) !== '27';
  const cgstTotal = isInterState ? 0 : afterDiscount * (9 / 100);
  const sgstTotal = isInterState ? 0 : afterDiscount * (9 / 100);
  const igstTotal = isInterState ? afterDiscount * (18 / 100) : 0;
  const grandTotal = afterDiscount + cgstTotal + sgstTotal + igstTotal;

  const handleCheckout = async () => {
    if (cart.length === 0) return showToast('Cart is empty', 'error');

    try {
      const r = await fetch(`${API}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            hsn_code: item.hsn_code,
            quantity: item.quantity,
            sell_price: item.sell_price,
            discount_percent: item.discount_percent
          })),
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_gstin: customer.gstin,
          customer_address: customer.address,
          payment_mode: paymentMode
        })
      });
      const d = await r.json();
      if (d.success) {
        setLastInvoice(d.data);
        showToast(`Sale completed! Invoice: ${d.data.invoice_number}`);
        setCart([]);
        // Refresh products
        fetch(`${API}/products`).then(r => r.json()).then(d2 => { if (d2.success) setProducts(d2.data); });
      } else {
        showToast(d.error, 'error');
      }
    } catch (err) {
      showToast('Checkout failed', 'error');
    }
  };

  const handlePrintReceipt = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Receipt_${lastInvoice?.invoice_number || 'receipt'}`,
  });

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <h2 style={{marginBottom:20}}>Sales Point of Sale (POS)</h2>

      <div style={{display:'grid', gridTemplateColumns:'1fr 400px', gap:16}}>
        {/* Product selection */}
        <div>
          <div className="card">
            <div className="card-header"><h3>Products</h3></div>
            <div className="search-bar">
              <input
                placeholder="Search products by name, HSN, or barcode..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{maxHeight:400, overflowY:'auto'}}>
              <table>
                <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Action</th></tr></thead>
                <tbody>
                  {filteredProducts.slice(0, 20).map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          {p.image ? <img src={p.image} alt="" style={{width:30,height:30,borderRadius:4,objectFit:'cover'}} /> : <span>📦</span>}
                          <div>
                            <strong style={{fontSize:13}}>{p.name}</strong>
                            <div style={{fontSize:10,color:'#999'}}>HSN: {p.hsn_code}</div>
                          </div>
                        </div>
                      </td>
                      <td>Rs.{Number(p.sell_price).toLocaleString('en-IN')}</td>
                      <td><span className={`badge ${p.quantity<=5?'badge-danger':'badge-success'}`}>{p.quantity}</span></td>
                      <td>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => addToCart(p)}
                          disabled={p.quantity <= 0}
                        >
                          + Add
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && <tr><td colSpan={4} style={{textAlign:'center',padding:20,color:'#999'}}>No products found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Cart & Checkout */}
        <div>
          <div className="card">
            <div className="card-header"><h3>Cart ({cart.length} items)</h3></div>

            <div className="form-group">
              <label>Customer Name</label>
              <input value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone</label>
                <input value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label>GSTIN</label>
                <input value={customer.gstin} onChange={e => setCustomer({...customer, gstin: e.target.value})} placeholder="e.g. 27XXXXX1234Z1" />
              </div>
            </div>
            <div className="form-group">
              <label>Payment Mode</label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="credit">Credit</option>
              </select>
            </div>

            <div style={{maxHeight:300, overflowY:'auto', marginBottom:12}}>
              {cart.map(item => (
                <div key={item.product_id} style={{display:'flex',gap:8,alignItems:'center',padding:'8px 0',borderBottom:'1px solid #eee'}}>
                  <div style={{flex:1,fontSize:13}}>
                    <strong>{item.product_name}</strong>
                    <div style={{fontSize:11,color:'#777'}}>Rs.{item.sell_price} x {item.quantity}</div>
                  </div>
                  <input type="number" min="1" max={item.max_quantity} value={item.quantity}
                    onChange={e => updateCartItem(item.product_id, 'quantity', Math.min(Number(e.target.value), item.max_quantity))}
                    style={{width:50,textAlign:'center'}} />
                  <input type="number" min="0" max="100" value={item.discount_percent}
                    onChange={e => updateCartItem(item.product_id, 'discount_percent', Number(e.target.value))}
                    style={{width:45,textAlign:'center'}} placeholder="Disc%" />
                  <span style={{fontWeight:600,fontSize:13,width:80,textAlign:'right'}}>
                    Rs.{((item.sell_price * item.quantity) * (1 - item.discount_percent / 100)).toFixed(2)}
                  </span>
                  <button className="btn btn-sm btn-outline" onClick={() => removeFromCart(item.product_id)} style={{color:'#e74c3c'}}>✕</button>
                </div>
              ))}
              {cart.length === 0 && <div style={{textAlign:'center',color:'#999',padding:20}}>Cart is empty. Add products to begin.</div>}
            </div>

            <div style={{borderTop:'2px solid #eee',paddingTop:12}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                <span>Subtotal:</span><span>Rs.{cartSubtotal.toFixed(2)}</span>
              </div>
              {cartDiscount > 0 && (
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                  <span>Discount:</span><span style={{color:'#27ae60'}}>-Rs.{cartDiscount.toFixed(2)}</span>
                </div>
              )}
              {cgstTotal > 0 && (
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                  <span>CGST @9%:</span><span>Rs.{cgstTotal.toFixed(2)}</span>
                </div>
              )}
              {sgstTotal > 0 && (
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                  <span>SGST @9%:</span><span>Rs.{sgstTotal.toFixed(2)}</span>
                </div>
              )}
              {igstTotal > 0 && (
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                  <span>IGST @18%:</span><span>Rs.{igstTotal.toFixed(2)}</span>
                </div>
              )}
              <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:16,marginTop:8,paddingTop:8,borderTop:'2px solid #2c3e50'}}>
                <span>Grand Total:</span><span>Rs.{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              className="btn btn-success btn-lg"
              style={{width:'100%',marginTop:12}}
              onClick={handleCheckout}
              disabled={cart.length === 0}
            >
              Complete Sale - Rs.{grandTotal.toFixed(2)}
            </button>
          </div>
        </div>
      </div>

      {/* Last invoice */}
      {lastInvoice && (
        <div className="card" style={{marginTop:16, borderLeft:'4px solid #27ae60'}} ref={printRef}>
          <div className="card-header">
            <h3>Invoice Generated: {lastInvoice.invoice_number}</h3>
          </div>
          <table>
            <thead><tr><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Disc%</th><th>Total</th></tr></thead>
            <tbody>
              {lastInvoice.items?.map((item, i) => (
                <tr key={i}>
                  <td>{item.product_name}</td>
                  <td>{item.hsn_code}</td>
                  <td>{item.quantity}</td>
                  <td>Rs.{item.sell_price}</td>
                  <td>{item.discount_percent}%</td>
                  <td>Rs.{((item.sell_price * item.quantity) * (1 - (item.discount_percent || 0) / 100)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{textAlign:'right', marginTop:12}}>
            <p><strong>Subtotal:</strong> Rs.{Number(lastInvoice.subtotal).toLocaleString('en-IN', {minimumFractionDigits:2})}</p>
            {lastInvoice.cgst_total > 0 && <p><strong>CGST @9%:</strong> Rs.{Number(lastInvoice.cgst_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</p>}
            {lastInvoice.sgst_total > 0 && <p><strong>SGST @9%:</strong> Rs.{Number(lastInvoice.sgst_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</p>}
            {lastInvoice.igst_total > 0 && <p><strong>IGST @18%:</strong> Rs.{Number(lastInvoice.igst_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</p>}
            <h3>Grand Total: Rs.{Number(lastInvoice.grand_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</h3>
          </div>
          <div style={{display:'flex', gap:8, marginTop:8}}>
            <button className="btn btn-success" onClick={handlePrintReceipt}>Print Receipt</button>
            <button className="btn btn-info" onClick={() => window.open(`${API}/sales/${lastInvoice.id}/receipt`, '_blank')}>
              Download Receipt PDF
            </button>
            <button className="btn btn-warning" onClick={() => window.open(`${API}/gst/bill/${lastInvoice.id}`, '_blank')}>
              Download GST Bill PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
