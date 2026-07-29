import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import CameraScanner from './CameraScanner';

const API = '/api';

export default function SalesPOS() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState({ name: 'Walk-in Customer', phone: '', gstin: '', address: '' });
  const [paymentMode, setPaymentMode] = useState('cash');
  const [toast, setToast] = useState(null);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [isGst, setIsGst] = useState(true);
  const [companyName, setCompanyName] = useState('Aditya Enterprises');
  const [showCamera, setShowCamera] = useState(false);
  const printRef = useRef(null);
  const thermalRef = useRef(null);
  const searchRef = useRef(null);
  const scanTimer = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetch(`${API}/products`).then(r => r.json()).then(d => { if (d.success) setProducts(d.data); });
    fetch(`${API}/settings`).then(r => r.json()).then(d => {
      if (d.success) {
        setCompanyName(d.data.company_name || 'Aditya Enterprises');
        setCustomer(prev => ({ ...prev, gstin: d.data.company_gstin || '' }));
      }
    });
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
        product_id: product.id, product_name: product.name, hsn_code: product.hsn_code,
        sell_price: product.sell_price, discount_percent: product.discount_percent || 0,
        quantity: 1, max_quantity: product.quantity, image: product.image
      }]);
    }
    setSearch('');
    searchRef.current?.focus();
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && search.trim()) {
      clearTimeout(scanTimer.current);
      const match = products.find(p =>
        p.barcode === search.trim() ||
        p.name.toLowerCase() === search.trim().toLowerCase()
      );
      if (match) {
        addToCart(match);
      }
    }
  };

  const handleCameraScan = (code) => {
    const match = products.find(p => p.barcode === code || p.name.toLowerCase() === code.toLowerCase());
    if (match) { addToCart(match); showToast(`Scanned: ${match.name}`); }
    else showToast(`No product found for barcode: ${code}`, 'error');
    setShowCamera(false);
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
  const cgstTotal = !isGst ? 0 : (isInterState ? 0 : afterDiscount * (9 / 100));
  const sgstTotal = !isGst ? 0 : (isInterState ? 0 : afterDiscount * (9 / 100));
  const igstTotal = !isGst ? 0 : (isInterState ? afterDiscount * (18 / 100) : 0);
  const grandTotal = afterDiscount + cgstTotal + sgstTotal + igstTotal;

  const handleCheckout = async () => {
    if (cart.length === 0) return showToast('Cart is empty', 'error');
    try {
      const r = await fetch(`${API}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            product_id: item.product_id, product_name: item.product_name, hsn_code: item.hsn_code,
            quantity: item.quantity, sell_price: item.sell_price, discount_percent: item.discount_percent
          })),
          customer_name: customer.name, customer_phone: customer.phone,
          customer_gstin: customer.gstin, customer_address: customer.address,
          payment_mode: paymentMode, is_gst: isGst
        })
      });
      const d = await r.json();
      if (d.success) {
        setLastInvoice(d.data);
        showToast(`Sale completed! Invoice: ${d.data.invoice_number}`);
        setCart([]);
        fetch(`${API}/products`).then(r => r.json()).then(d2 => { if (d2.success) setProducts(d2.data); });
        searchRef.current?.focus();
      } else showToast(d.error, 'error');
    } catch (err) { showToast('Checkout failed', 'error'); }
  };

  const handlePrintReceipt = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Receipt_${lastInvoice?.invoice_number || 'receipt'}`,
  });

  const handlePrintThermal = useReactToPrint({
    contentRef: thermalRef,
    documentTitle: `Thermal_${lastInvoice?.invoice_number || 'receipt'}`,
  });

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <h2 style={{marginBottom: 20}}>Sales Point of Sale (POS)</h2>

      <div className="pos-layout">
        <div className="pos-products">
          <div className="card">
            <div className="card-header"><h3>Products</h3></div>
            <div className="search-bar">
              <input ref={searchRef} placeholder="Scan barcode or search..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearchKeyDown} autoFocus />
              <button className="btn btn-sm btn-outline" onClick={() => setShowCamera(true)} title="Scan barcode with camera">📷</button>
            </div>
            <div className="pos-products-list">
              {filteredProducts.length > 0 ? (
                <table>
                  <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Action</th></tr></thead>
                  <tbody>
                    {filteredProducts.slice(0, 20).map(p => (
                      <tr key={p.id}>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            {p.image ? <img src={p.image} alt="" style={{width:30,height:30,borderRadius:4,objectFit:'cover'}} /> : <span style={{color:'#8a9aa8',fontWeight:600}}>NA</span>}
                            <div>
                              <strong style={{fontSize:13}}>{p.name}</strong>
                              <div style={{fontSize:10,color:'var(--text-muted)'}}>HSN: {p.hsn_code}</div>
                            </div>
                          </div>
                        </td>
                        <td>Rs.{Number(p.sell_price).toLocaleString('en-IN')}</td>
                        <td><span className={`badge ${p.quantity<=5?'badge-danger':'badge-success'}`}>{p.quantity}</span></td>
                        <td>
                          <button className="btn btn-sm btn-success" onClick={() => addToCart(p)} disabled={p.quantity <= 0}>
                            + Add
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center text-muted" style={{padding:30}}>No products found</div>
              )}
            </div>
          </div>
        </div>

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
                <input value={customer.gstin} onChange={e => setCustomer({...customer, gstin: e.target.value})} placeholder={companyName} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Payment Mode</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div className="form-group">
                <label>Bill Type</label>
                <div style={{display:'flex', gap:4}}>
                  <button className={`btn btn-sm ${isGst ? 'btn-primary' : 'btn-outline'}`} onClick={() => setIsGst(true)}>GST</button>
                  <button className={`btn btn-sm ${!isGst ? 'btn-primary' : 'btn-outline'}`} onClick={() => setIsGst(false)}>Non-GST</button>
                </div>
              </div>
            </div>

            <div className="pos-cart-items">
              {cart.map(item => (
                <div key={item.product_id} className="pos-cart-item">
                  <div className="pos-cart-info">
                    <strong>{item.product_name}</strong>
                    <small>Rs.{item.sell_price} &times; {item.quantity}</small>
                  </div>
                  <input type="number" min="1" max={item.max_quantity} value={item.quantity}
                    onChange={e => updateCartItem(item.product_id, 'quantity', Math.min(Number(e.target.value), item.max_quantity))}
                    className="pos-qty-input" />
                  <input type="number" min="0" max="100" value={item.discount_percent}
                    onChange={e => updateCartItem(item.product_id, 'discount_percent', Number(e.target.value))}
                    className="pos-disc-input" placeholder="%" />
                  <span className="pos-item-total">
                    Rs.{((item.sell_price * item.quantity) * (1 - item.discount_percent / 100)).toFixed(2)}
                  </span>
                  <button className="btn btn-sm btn-outline" onClick={() => removeFromCart(item.product_id)} style={{color:'var(--danger)'}}>&times;</button>
                </div>
              ))}
              {cart.length === 0 && <div className="text-center text-muted" style={{padding:20}}>Cart is empty. Add products to begin.</div>}
            </div>

            <div className="pos-totals">
              <div className="pos-total-row"><span>Subtotal:</span><span>Rs.{cartSubtotal.toFixed(2)}</span></div>
              {cartDiscount > 0 && (
                <div className="pos-total-row"><span>Discount:</span><span style={{color:'var(--success)'}}>-Rs.{cartDiscount.toFixed(2)}</span></div>
              )}
              {isGst && cgstTotal > 0 && <div className="pos-total-row"><span>CGST @9%:</span><span>Rs.{cgstTotal.toFixed(2)}</span></div>}
              {isGst && sgstTotal > 0 && <div className="pos-total-row"><span>SGST @9%:</span><span>Rs.{sgstTotal.toFixed(2)}</span></div>}
              {isGst && igstTotal > 0 && <div className="pos-total-row"><span>IGST @18%:</span><span>Rs.{igstTotal.toFixed(2)}</span></div>}
              <div className="pos-grand-total"><span>Grand Total:</span><span>Rs.{grandTotal.toFixed(2)}</span></div>
            </div>

            <button className="btn btn-success btn-lg pos-checkout-btn" onClick={handleCheckout} disabled={cart.length === 0}>
              Complete Sale - Rs.{grandTotal.toFixed(2)}
            </button>
          </div>
        </div>
      </div>

      {lastInvoice && (
        <div className="card pos-invoice-card">
          <div className="card-header">
            <h3>Invoice Generated: {lastInvoice.invoice_number}</h3>
          </div>
          {lastInvoice.items?.length > 0 ? (
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
          ) : <p style={{textAlign:'center',color:'#999',padding:12}}>No items in invoice</p>}
          <div style={{textAlign:'right', marginTop:12}}>
            <p><strong>Subtotal:</strong> Rs.{Number(lastInvoice.subtotal).toLocaleString('en-IN', {minimumFractionDigits:2})}</p>
            {lastInvoice.cgst_total > 0 && <p><strong>CGST @9%:</strong> Rs.{Number(lastInvoice.cgst_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</p>}
            {lastInvoice.sgst_total > 0 && <p><strong>SGST @9%:</strong> Rs.{Number(lastInvoice.sgst_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</p>}
            {lastInvoice.igst_total > 0 && <p><strong>IGST @18%:</strong> Rs.{Number(lastInvoice.igst_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</p>}
            <h3>Grand Total: Rs.{Number(lastInvoice.grand_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</h3>
          </div>
          <div className="pos-invoice-actions">
            <button className="btn btn-success" onClick={handlePrintThermal}>Print 58mm Receipt</button>
            <button className="btn btn-info" onClick={handlePrintReceipt}>Print A4 Receipt</button>
            <button className="btn btn-warning" onClick={() => window.open(`${API}/gst/bill/${lastInvoice.id}`, '_blank')}>Print GST Bill</button>
          </div>
        </div>
      )}

      {lastInvoice && (
        <div ref={thermalRef} className="thermal-receipt-print">
          <div className="thermal-receipt">
            <div className="tr-header">{companyName}</div>
            <div className="tr-sub">{customer.address || 'Shop Address'}</div>
            <div className="tr-divider"></div>
            <div className="tr-row"><span>Invoice:</span><span>{lastInvoice.invoice_number}</span></div>
            <div className="tr-row"><span>Date:</span><span>{lastInvoice.sale_date}</span></div>
            <div className="tr-row"><span>Customer:</span><span>{lastInvoice.customer_name}</span></div>
            {lastInvoice.customer_gstin && <div className="tr-row"><span>GSTIN:</span><span>{lastInvoice.customer_gstin}</span></div>}
            <div className="tr-divider"></div>
            <div className="tr-table-header">
              <span>Item</span><span>Qty</span><span>Rate</span><span>Amt</span>
            </div>
            <div className="tr-divider"></div>
            {lastInvoice.items?.map((item, i) => (
              <div key={i} className="tr-item-row">
                <span className="tr-item-name">{item.product_name}</span>
                <span>{item.quantity}</span>
                <span>{Number(item.sell_price).toFixed(0)}</span>
                <span>{((item.sell_price * item.quantity) * (1 - (item.discount_percent || 0) / 100)).toFixed(0)}</span>
              </div>
            ))}
            <div className="tr-divider"></div>
            <div className="tr-row"><span>Subtotal</span><span>Rs. {Number(lastInvoice.subtotal).toFixed(2)}</span></div>
            {lastInvoice.cgst_total > 0 && <div className="tr-row"><span>CGST @9%</span><span>Rs. {Number(lastInvoice.cgst_total).toFixed(2)}</span></div>}
            {lastInvoice.sgst_total > 0 && <div className="tr-row"><span>SGST @9%</span><span>Rs. {Number(lastInvoice.sgst_total).toFixed(2)}</span></div>}
            {lastInvoice.igst_total > 0 && <div className="tr-row"><span>IGST @18%</span><span>Rs. {Number(lastInvoice.igst_total).toFixed(2)}</span></div>}
            <div className="tr-total">Total: Rs. {Number(lastInvoice.grand_total).toFixed(2)}</div>
            <div className="tr-divider"></div>
            <div className="tr-footer">Thank you! Visit again.</div>
          </div>
        </div>
      )}

      {showCamera && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCamera(false)}>
          <div className="modal" style={{maxWidth:450}}>
            <CameraScanner onScan={handleCameraScan} onClose={() => setShowCamera(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
