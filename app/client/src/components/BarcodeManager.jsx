import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';

const API = '/api';

export default function BarcodeManager() {
  const [products, setProducts] = useState([]);
  const [scannerInput, setScannerInput] = useState('');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [lastSale, setLastSale] = useState(null);
  const [mode, setMode] = useState('generate'); // generate, scan, history
  const [toast, setToast] = useState(null);
  const [printerStatus, setPrinterStatus] = useState('');
  const scannerRef = useRef(null);
  const printRef = useRef(null);
  const scanTimeout = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetch(`${API}/products`)
      .then(r => r.json()).then(d => { if (d.success) setProducts(d.data); });
  }, []);

  // Focus scanner input on mount and when switching to scan mode
  useEffect(() => {
    if (mode === 'scan' && scannerRef.current) {
      scannerRef.current.focus();
    }
  }, [mode]);

  // Handle barcode scanner input (keyboard wedge - rapid input followed by Enter)
  const handleScannerKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && scannerInput.trim()) {
      handleScan(scannerInput.trim());
      setScannerInput('');
    }
  }, [scannerInput]);

  // Also listen globally for barcode scanner (keyboard wedge)
  useEffect(() => {
    let buffer = '';
    let timer = null;

    const handleGlobalKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; // Don't intercept when typing in fields
      if (e.key === 'Enter' && buffer.length > 6) {
        handleScan(buffer);
        buffer = '';
        return;
      }
      if (e.key.length === 1) {
        buffer += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => { buffer = ''; }, 100);
      }
    };

    window.addEventListener('keypress', handleGlobalKey);
    return () => window.removeEventListener('keypress', handleGlobalKey);
  }, []);

  const handleScan = async (code) => {
    try {
      const r = await fetch(`${API}/barcode/scan/${code}`);
      const d = await r.json();
      if (d.success) {
        setScannedProduct(d.data);
        showToast(`Found: ${d.data.name}`);
      } else {
        showToast(`No product found for: ${code}`, 'error');
      }
    } catch (err) {
      showToast('Scanner lookup failed', 'error');
    }
  };

  const handleQuickSale = async (product, qty = 1) => {
    try {
      const r = await fetch(`${API}/barcode/scan-sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: product.barcode, quantity: qty })
      });
      const d = await r.json();
      if (d.success) {
        setLastSale(d.data);
        setScannedProduct(null);
        showToast(`Sold ${qty}x ${product.name} - Rs.${d.data.sale.grand_total.toFixed(2)}`);
        // Auto-open receipt
        window.open(`${API}/sales/${d.data.sale.id}/receipt`, '_blank');
      } else {
        showToast(d.error, 'error');
      }
    } catch (err) {
      showToast('Sale failed', 'error');
    }
  };

  const handleGenerateBarcode = async (productId) => {
    try {
      const r = await fetch(`${API}/barcode/generate/${productId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'code128' })
      });
      const d = await r.json();
      if (d.success) {
        showToast('Barcode generated');
        fetch(`${API}/products`).then(r => r.json()).then(d => { if (d.success) setProducts(d.data); });
      }
    } catch (err) { showToast('Generation failed', 'error'); }
  };

  const handleBulkGenerate = async () => {
    const ids = products.filter(p => !p.barcode).map(p => p.id);
    if (ids.length === 0) {
      showToast('All products already have barcodes', 'error');
      return;
    }
    try {
      const r = await fetch(`${API}/barcode/generate-bulk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: ids })
      });
      const d = await r.json();
      if (d.success) {
        showToast(`Generated ${d.data.length} barcodes`);
        fetch(`${API}/products`).then(r => r.json()).then(d2 => { if (d2.success) setProducts(d2.data); });
      }
    } catch (err) { showToast('Bulk generation failed', 'error'); }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Barcode_${scannedProduct?.barcode || 'print'}`,
    onAfterPrint: () => showToast('Barcode printed'),
  });

  const handlePrintInvoice = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Receipt_${lastSale?.sale?.invoice_number || 'receipt'}`,
  });

  const connectPrinter = async () => {
    try {
      const r = await fetch(`${API}/devices/printers`);
      const d = await r.json();
      if (d.success && d.data.length > 0) {
        setPrinterStatus(`Found: ${d.data[0].name}`);
        showToast('Printer detected');
      } else {
        setPrinterStatus('No printer found');
        showToast('No printer detected', 'error');
      }
    } catch (err) { showToast('Printer check failed', 'error'); }
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div style={{display:'flex', justifyContent:'space-between', marginBottom:20}}>
        <h2>Barcode Manager</h2>
        <div style={{display:'flex', gap:8}}>
          <button className={`btn ${mode==='generate'?'btn-primary':'btn-outline'}`} onClick={()=>setMode('generate')}>Generate</button>
          <button className={`btn ${mode==='scan'?'btn-primary':'btn-outline'}`} onClick={()=>setMode('scan')}>Scan & Sell</button>
          <button className={`btn ${mode==='history'?'btn-primary':'btn-outline'}`} onClick={()=>setMode('history')}>Print Queue</button>
        </div>
      </div>

      {mode === 'generate' && (
        <div>
          <div style={{marginBottom:16}}>
            <button className="btn btn-warning" onClick={handleBulkGenerate}>
              Generate Barcodes for All Products Without Barcodes
            </button>
          </div>
          <div className="card">
            <div className="table-container">
              <table>
                <thead><tr><th>Product</th><th>Barcode</th><th>Barcode Image</th><th>Actions</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong> <span style={{color:'#999',fontSize:11}}>Rs.{p.sell_price}</span></td>
                      <td style={{fontFamily:'monospace',fontSize:12}}>{p.barcode || 'No barcode'}</td>
                      <td>{p.barcode_image ? <img src={p.barcode_image} alt="barcode" style={{height:40}} /> : '-'}</td>
                      <td>
                        <button className="btn btn-sm btn-info" style={{marginRight:4}} onClick={() => handleGenerateBarcode(p.id)}>
                          {p.barcode ? 'Regenerate' : 'Generate'}
                        </button>
                        {p.barcode_image && (
                          <button className="btn btn-sm btn-success" onClick={() => {
                            const win = window.open('', '_blank', 'width=400,height=300');
                            win.document.write(`<html><body style="text-align:center;padding:20px"><h4>${p.name}</h4><h5>Rs.${p.sell_price}</h5><img src="${p.barcode_image}" style="max-width:300px"/><p style="font-family:monospace">${p.barcode}</p><script>window.print();<\\/script></body></html>`);
                          }}>Print</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {mode === 'scan' && (
        <div>
          <div className="card" style={{textAlign:'center'}}>
            <h3 style={{marginBottom:16}}>Barcode Scanner Mode</h3>
            <p style={{color:'#777',marginBottom:16}}>Scan a barcode or type it below. Barcode scanners connected via USB act as keyboard input.</p>
            <input
              ref={scannerRef}
              className="barcode-scanner-input"
              type="text"
              value={scannerInput}
              onChange={e => setScannerInput(e.target.value)}
              onKeyDown={handleScannerKeyDown}
              placeholder="Scan or type barcode here..."
              autoFocus
            />
            <button className="btn btn-primary" style={{marginTop:8}} onClick={() => { if(scannerInput.trim()) { handleScan(scannerInput.trim()); setScannerInput(''); } }}>
              Lookup
            </button>

            <div style={{marginTop:12, fontSize:11, color:'#999'}}>
              Tip: USB barcode scanners automatically type the code + Enter. Just scan any barcode!
            </div>
          </div>

          {scannedProduct && (
            <div className="card" style={{marginTop:16, borderLeft:'4px solid #27ae60'}}>
              <div ref={printRef} className="print-area">
                <h3>Product Found</h3>
                <div style={{display:'flex', gap:16, alignItems:'start', marginTop:12}}>
                  <div>
                    {scannedProduct.image ? <img src={scannedProduct.image} alt="" style={{width:100,height:100,borderRadius:8,objectFit:'cover'}} /> : <div style={{width:100,height:100,background:'#eee',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:40}}>📦</div>}
                  </div>
                  <div style={{flex:1}}>
                    <h4>{scannedProduct.name}</h4>
                    <p style={{color:'#777',fontSize:13}}>{scannedProduct.description}</p>
                    <p><strong>HSN:</strong> {scannedProduct.hsn_code || '-'} | <strong>Price:</strong> Rs.{Number(scannedProduct.sell_price).toLocaleString('en-IN')}</p>
                    <p><strong>Stock:</strong> <span className={`badge ${scannedProduct.quantity <= 5 ? 'badge-danger' : 'badge-success'}`}>{scannedProduct.quantity}</span></p>
                    <p><strong>Discount:</strong> {scannedProduct.discount_percent}%</p>
                    {scannedProduct.barcode_image && <img src={scannedProduct.barcode_image} alt="barcode" style={{height:50,marginTop:8}} />}
                  </div>
                </div>
                <div style={{display:'flex', gap:8, marginTop:16}}>
                  <button className="btn btn-success btn-lg" onClick={() => handleQuickSale(scannedProduct, 1)}>
                    Quick Sale (Qty: 1) - Rs.{Number(scannedProduct.sell_price).toLocaleString('en-IN')}
                  </button>
                  <button className="btn btn-primary" onClick={() => {
                    const qty = prompt('Enter quantity:', '1');
                    if (qty && Number(qty) > 0) handleQuickSale(scannedProduct, Number(qty));
                  }}>
                    Sale with Custom Qty
                  </button>
                  <button className="btn btn-outline" onClick={() => setScannedProduct(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {lastSale && (
            <div className="card" style={{marginTop:16, borderLeft:'4px solid #3498db'}}>
              <h3>Last Sale Completed</h3>
              <p><strong>Invoice:</strong> {lastSale.sale.invoice_number}</p>
              <p><strong>Product:</strong> {lastSale.product.name}</p>
              <p><strong>Amount:</strong> Rs.{Number(lastSale.sale.grand_total).toLocaleString('en-IN', {minimumFractionDigits:2})}</p>
              <div style={{display:'flex', gap:8, marginTop:8}}>
                <button className="btn btn-success btn-sm" onClick={() => window.open(`${API}/sales/${lastSale.sale.id}/receipt`, '_blank')}>
                  View & Print Receipt
                </button>
                <button className="btn btn-info btn-sm" onClick={() => window.open(`${API}/gst/bill/${lastSale.sale.id}`, '_blank')}>
                  Download GST Bill
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'history' && (
        <div>
          <div className="card">
            <div className="card-header">
              <h3>Printer Connection</h3>
            </div>
            <button className="btn btn-info" onClick={connectPrinter}>Detect Printers</button>
            {printerStatus && <p style={{marginTop:8,fontSize:13}}>Status: {printerStatus}</p>}
          </div>

          <div className="card" style={{marginTop:16}}>
            <div className="card-header"><h3>Products with Barcodes (Print Ready)</h3></div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:12}}>
              {products.filter(p => p.barcode_image).map(p => (
                <div key={p.id} className="card" style={{textAlign:'center',padding:12}}>
                  <strong style={{fontSize:12}}>{p.name}</strong>
                  <div style={{fontSize:11,color:'#777'}}>Rs.{p.sell_price}</div>
                  <img src={p.barcode_image} alt="barcode" style={{maxWidth:200, height:50, marginTop:8}} />
                  <div style={{fontSize:10, fontFamily:'monospace'}}>{p.barcode}</div>
                  <button className="btn btn-sm btn-success" style={{marginTop:6}} onClick={() => {
                    const win = window.open('', '_blank', 'width=400,height=300');
                    win.document.write(`<html><body style="text-align:center;padding:20px"><h4>${p.name}</h4><h5>Rs.${p.sell_price}</h5><img src="${p.barcode_image}" style="max-width:300px"/><p style="font-family:monospace">${p.barcode}</p><script>window.print();<\\/script></body></html>`);
                  }}>Print</button>
                </div>
              ))}
              {products.filter(p => p.barcode_image).length === 0 && (
                <div className="empty-state" style={{gridColumn:'1/-1'}}>
                  <div className="empty-icon">🔍</div>
                  <p>No barcodes generated yet. Go to "Generate" tab first.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
