import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import CameraScanner from './CameraScanner';
import { bluetoothSupported, pairPrinter, getSavedPrinter, sendBytes, buildEscPos, printSmartReceipt } from '../printer';

const API = '/api';

export default function SalesPOS() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [toast, setToast] = useState(null);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [companyName, setCompanyName] = useState('Aditya Enterprises');
  const [showCamera, setShowCamera] = useState(false);
  const [btPrinter, setBtPrinter] = useState(null);
  const [btBusy, setBtBusy] = useState(false);
  const thermalRef = useRef(null);
  const searchRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetch(`${API}/products`).then(r => r.json()).then(d => { if (d.success) setProducts(d.data); });
    fetch(`${API}/settings`).then(r => r.json()).then(d => {
      if (d.success) setCompanyName(d.data.company_name || 'Aditya Enterprises');
    });
    setBtPrinter(getSavedPrinter());
  }, []);

  const handleUsbPrint = async () => {
    if (!lastInvoice) return showToast('Complete a sale first', 'error');
    setBtBusy(true);
    try {
      const r = await printSmartReceipt({
        companyName,
        invoiceNumber: lastInvoice.invoice_number,
        date: lastInvoice.sale_date,
        customer: lastInvoice.customer_name,
        items: lastInvoice.items || [],
        subtotal: Number(lastInvoice.subtotal || 0),
        gstAmount: Number((lastInvoice.cgst_total || 0) + (lastInvoice.sgst_total || 0) + (lastInvoice.igst_total || 0)),
        grandTotal: Number(lastInvoice.grand_total || 0)
      });
      if (r.via === 'usb') showToast('Receipt sent to USB printer');
      else if (r.via === 'bluetooth') showToast(`Receipt printed via Bluetooth (${r.target})`);
      else showToast('No printer detected - pair Bluetooth or run the USB bridge (Settings → Printers)', 'error');
    } catch (err) {
      showToast('Print failed: ' + (err.message || 'connection error'), 'error');
    } finally {
      setBtBusy(false);
    }
  };

  const connectBluetoothPrinter = async () => {
    if (!bluetoothSupported()) { showToast('Web Bluetooth needs Chrome/Edge over HTTPS', 'error'); return; }
    setBtBusy(true);
    try {
      const info = await pairPrinter();
      setBtPrinter(info);
      showToast(`Bluetooth printer connected: ${info.name}`);
    } catch (err) {
      showToast(err.message || 'Bluetooth pairing cancelled', 'error');
    } finally {
      setBtBusy(false);
    }
  };

  const handleBluetoothPrint = async () => {
    if (!lastInvoice) return showToast('Complete a sale first', 'error');
    if (!btPrinter) return connectBluetoothPrinter();
    if (btBusy) return;
    setBtBusy(true);
    try {
      await sendInvoiceToPrinter(lastInvoice);
      showToast(`Receipt sent to ${btPrinter.name}`);
    } catch (err) {
      if (/not found|connect it again|connect the printer again/i.test(err.message || '')) {
        showToast('Printer connection lost - pairing again...', 'error');
        try {
          const info = await pairPrinter();
          setBtPrinter(info);
          await sendInvoiceToPrinter(lastInvoice);
          showToast(`Receipt sent to ${info.name}`);
        } catch (e2) {
          showToast('Print failed: ' + (e2.message || 're-pairing failed'), 'error');
        }
      } else {
        showToast('Print failed: ' + (err.message || 'connection error'), 'error');
      }
    } finally {
      setBtBusy(false);
    }
  };

  const sendInvoiceToPrinter = async (invoice) => {
    const gstTotal = Number((invoice.cgst_total || 0) + (invoice.sgst_total || 0) + (invoice.igst_total || 0));
    const bytes = buildEscPos({
      companyName,
      invoiceNumber: invoice.invoice_number,
      date: invoice.sale_date,
      customer: invoice.customer_name,
      items: invoice.items || [],
      subtotal: Number(invoice.subtotal || 0),
      gstAmount: gstTotal,
      grandTotal: Number(invoice.grand_total || 0)
    });
    await sendBytes(bytes);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.includes(search)
  );

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, qty: item.qty + 1 } : item
      ));
    } else {
      setCart([...cart, {
        id: product.id, name: product.name, price: product.sell_price, qty: 1
      }]);
    }
    setSearch('');
    searchRef.current?.focus();
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && search.trim()) {
      const match = products.find(p =>
        p.barcode === search.trim() ||
        p.name.toLowerCase() === search.trim().toLowerCase()
      );
      if (match) addToCart(match);
    }
  };

  const handleCameraScan = (code) => {
    const match = products.find(p => p.barcode === code || p.name.toLowerCase() === code.toLowerCase());
    if (match) { addToCart(match); showToast(`Scanned: ${match.name}`); }
    else showToast(`No product found for: ${code}`, 'error');
    setShowCamera(false);
  };

  const updateQty = (id, val) => {
    if (val < 1) return;
    setCart(cart.map(item => item.id === id ? { ...item, qty: val } : item));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const gst = subtotal * 0.18;
  const grandTotal = subtotal + gst;

  const handleCheckout = async () => {
    if (cart.length === 0) return showToast('Cart is empty', 'error');
    try {
      const r = await fetch(`${API}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            product_id: item.id, product_name: item.name,
            quantity: item.qty, sell_price: item.price, discount_percent: 0
          })),
          customer_name: customerName, payment_mode: paymentMode, is_gst: true
        })
      });
      const d = await r.json();
      if (d.success) {
        setLastInvoice(d.data);
        showToast(`Sale done! Invoice: ${d.data.invoice_number}`);
        setCart([]);
        fetch(`${API}/products`).then(r2 => r2.json()).then(d2 => { if (d2.success) setProducts(d2.data); });
        searchRef.current?.focus();
      } else showToast(d.error, 'error');
    } catch (err) { showToast('Checkout failed', 'error'); }
  };

  const handlePrint = useReactToPrint({
    contentRef: thermalRef,
    documentTitle: `Receipt_${lastInvoice?.invoice_number || 'receipt'}`,
  });

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="pos-layout">
        <div className="pos-products">
          <div className="card">
            <div className="card-header"><h3>Products</h3></div>
            <div className="search-bar">
              <input ref={searchRef} placeholder="Search or scan barcode..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearchKeyDown} autoFocus />
              <button className="btn btn-sm btn-outline" onClick={() => setShowCamera(true)} title="Scan with camera">📷</button>
            </div>
            <div className="pos-products-list">
              {filteredProducts.length > 0 ? (
                <table>
                  <thead><tr><th>Product</th><th>Price</th><th></th></tr></thead>
                  <tbody>
                    {filteredProducts.slice(0, 30).map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.name}</strong></td>
                        <td>Rs.{Number(p.sell_price).toLocaleString('en-IN')}</td>
                        <td><button className="btn btn-sm btn-success" onClick={() => addToCart(p)} disabled={p.quantity <= 0}>+ Add</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{textAlign:'center',color:'#999',padding:30}}>No products found</div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-header"><h3>Cart ({cart.length})</h3></div>

            <div className="form-group">
              <label>Customer Name</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Walk-in Customer" />
            </div>
            <div className="form-group">
              <label>Payment</label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
            </div>

            <div className="pos-cart-items">
              {cart.map(item => (
                <div key={item.id} className="pos-cart-item" style={{display:'flex',alignItems:'center',gap:8, padding:'6px 0', borderBottom:'1px solid #eee'}}>
                  <div style={{flex:1}}>
                    <strong style={{fontSize:13}}>{item.name}</strong>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <button className="btn btn-sm btn-outline" onClick={() => updateQty(item.id, item.qty - 1)} style={{padding:'2px 8px',minHeight:'auto'}}>-</button>
                    <span style={{minWidth:24,textAlign:'center',fontWeight:600}}>{item.qty}</span>
                    <button className="btn btn-sm btn-outline" onClick={() => updateQty(item.id, item.qty + 1)} style={{padding:'2px 8px',minHeight:'auto'}}>+</button>
                  </div>
                  <span style={{minWidth:80,textAlign:'right',fontWeight:600}}>Rs.{(item.price * item.qty).toFixed(0)}</span>
                  <button className="btn btn-sm" onClick={() => removeFromCart(item.id)} style={{color:'var(--danger)',padding:'2px 6px',minHeight:'auto'}}>&times;</button>
                </div>
              ))}
              {cart.length === 0 && <div style={{textAlign:'center',color:'#999',padding:20}}>Cart is empty</div>}
            </div>

            <div className="pos-totals">
              <div className="pos-total-row"><span>Subtotal</span><span>Rs.{subtotal.toFixed(2)}</span></div>
              <div className="pos-total-row"><span>GST @18%</span><span>Rs.{gst.toFixed(2)}</span></div>
              <div className="pos-grand-total"><span>Total</span><span>Rs.{grandTotal.toFixed(2)}</span></div>
            </div>

            <button className="btn btn-success btn-lg pos-checkout-btn" onClick={handleCheckout} disabled={cart.length === 0} style={{width:'100%',padding:14,fontSize:16}}>
              Complete Sale - Rs.{grandTotal.toFixed(2)}
            </button>
          </div>
        </div>
      </div>

      {lastInvoice && (
        <div className="card" style={{marginTop:16}}>
          <div className="card-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <h3 style={{margin:0}}>Invoice: {lastInvoice.invoice_number}</h3>
              {btPrinter && <span className="badge badge-success" style={{fontSize:11}}>BT: {btPrinter.name}</span>}
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {!btPrinter && (
                <button className="btn btn-sm btn-outline" onClick={connectBluetoothPrinter} disabled={btBusy}>
                  {btBusy ? 'Working...' : 'Pair Bluetooth Printer'}
                </button>
              )}
              <button className="btn btn-sm btn-warning" onClick={handleUsbPrint} disabled={btBusy} title="USB bridge if online, else paired Bluetooth printer">
                Smart Print
              </button>
              <button className="btn btn-sm btn-success" onClick={handleBluetoothPrint} disabled={btBusy}>
                {btBusy ? 'Printing...' : 'Print Direct (Bluetooth)'}
              </button>
              <button className="btn btn-primary" onClick={handlePrint}>Print Receipt (Windows/USB)</button>
            </div>
          </div>
        </div>
      )}

      {lastInvoice && (
        <div ref={thermalRef} className="thermal-receipt-print">
          <div className="thermal-receipt">
            <div className="tr-header">{companyName}</div>
            <div className="tr-divider"></div>
            <div className="tr-row"><span>Invoice:</span><span>{lastInvoice.invoice_number}</span></div>
            <div className="tr-row"><span>Date:</span><span>{lastInvoice.sale_date}</span></div>
            <div className="tr-row"><span>Customer:</span><span>{lastInvoice.customer_name}</span></div>
            <div className="tr-divider"></div>
            <div className="tr-table-header"><span>Item</span><span>Qty</span><span>Amt</span></div>
            <div className="tr-divider"></div>
            {lastInvoice.items?.map((item, i) => (
              <div key={i} className="tr-item-row">
                <span className="tr-item-name">{item.product_name}</span>
                <span>{item.quantity}</span>
                <span>{((item.sell_price * item.quantity)).toFixed(0)}</span>
              </div>
            ))}
            <div className="tr-divider"></div>
            <div className="tr-row"><span>Subtotal</span><span>Rs. {Number(lastInvoice.subtotal).toFixed(2)}</span></div>
            <div className="tr-row"><span>GST @18%</span><span>Rs. {Number((lastInvoice.cgst_total||0)+(lastInvoice.sgst_total||0)+(lastInvoice.igst_total||0)).toFixed(2)}</span></div>
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
