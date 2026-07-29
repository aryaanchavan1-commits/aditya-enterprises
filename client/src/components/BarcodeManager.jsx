import React, { useState, useEffect, useRef } from 'react';
import { api, exportToExcel } from '../api';
import { useReactToPrint } from 'react-to-print';

export default function BarcodeManager() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [labelProduct, setLabelProduct] = useState(null);
  const [labelQty, setLabelQty] = useState(1);
  const labelRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadProducts = () => {
    api(`/products?search=${search}`).then(d => {
      if (d.success) setProducts(d.data);
    });
  };

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { loadProducts(); }, [search]);

  const handlePrintLabel = useReactToPrint({ contentRef: labelRef, documentTitle: 'Product_Label' });

  const handleGenerateBarcode = async (id) => {
    const d = await api('/barcode/generate/' + id, { method: 'POST', body: {} });
    if (d.success) { showToast('Barcode generated'); loadProducts(); }
    else showToast(d.error || 'Generation failed', 'error');
  };

  const handleGenerateAll = async () => {
    const missing = products.filter(p => !p.barcode);
    if (!missing.length) return showToast('All products already have barcodes');
    if (!confirm(`Generate barcodes for ${missing.length} products?`)) return;
    const ids = missing.map(p => p.id);
    const d = await api('/barcode/generate-bulk', { method: 'POST', body: { product_ids: ids } });
    if (d.success) showToast(`Generated ${d.data.length} barcode(s)`);
    else showToast(d.error || 'Bulk generation failed', 'error');
    loadProducts();
  };

  const handleExport = () => {
    const data = products.map(p => ({
      Name: p.name, Barcode: p.barcode || '', Price: p.sell_price, Stock: p.quantity
    }));
    exportToExcel(data, `barcodes_${new Date().toISOString().slice(0, 10)}`);
    showToast('Exported to Excel');
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Barcodes ({products.length})</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm btn-outline" onClick={handleExport}>Export</button>
          <button className="btn btn-sm btn-outline" onClick={handleGenerateAll}>Generate All</button>
        </div>
      </div>

      <div className="search-bar">
        <input type="text" placeholder="Search by name or barcode..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card desktop-table">
        <div className="table-container">
          {products.length > 0 ? (
            <table>
              <thead>
                <tr><th>Product</th><th>Barcode</th><th>Price</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>
                      {p.barcode_image
                        ? <img src={p.barcode_image} alt="barcode" style={{ height: 36 }} />
                        : p.barcode
                          ? <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1, color: '#555' }}>{p.barcode}</span>
                          : <span className="badge badge-warning">None</span>}
                    </td>
                    <td>Rs.{Number(p.sell_price).toLocaleString('en-IN')}</td>
                    <td>
                      {p.barcode ? (
                        <button className="btn btn-sm btn-primary" onClick={() => { setLabelProduct(p); setLabelQty(1); }}>Label</button>
                      ) : (
                        <button className="btn btn-sm btn-outline" onClick={() => handleGenerateBarcode(p.id)}>Generate</button>
                      )}
                      {p.barcode && (
                        <button className="btn btn-sm btn-outline" style={{ marginLeft: 4 }} onClick={() => handleGenerateBarcode(p.id)}>Redo</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>No products found</div>
          )}
        </div>
      </div>

      <div className="show-mobile-cards">
        <div className="mobile-cards">
          {products.map(p => (
            <div key={p.id} className="mobile-card">
              <div className="mobile-card-header">{p.name}</div>
              <div className="mobile-card-row">
                <span className="label">Price</span>
                <span className="value">Rs.{Number(p.sell_price).toLocaleString('en-IN')}</span>
              </div>
              <div className="mobile-card-row">
                <span className="label">Barcode</span>
                <span className="value">
                  {p.barcode_image
                    ? <img src={p.barcode_image} alt="barcode" style={{ height: 30 }} />
                    : p.barcode || <span className="badge badge-warning">None</span>}
                </span>
              </div>
              <div className="mobile-card-actions">
                {p.barcode
                  ? <button className="btn btn-sm btn-primary" onClick={() => { setLabelProduct(p); setLabelQty(1); }}>Label</button>
                  : <button className="btn btn-sm btn-outline" onClick={() => handleGenerateBarcode(p.id)}>Generate</button>}
              </div>
            </div>
          ))}
          {products.length === 0 && <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>No products found</div>}
        </div>
      </div>

      {labelProduct && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setLabelProduct(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3>Print Label: {labelProduct.name}</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Copies:</label>
              <input type="number" min="1" max="100" value={labelQty}
                onChange={e => setLabelQty(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                style={{ width: 70, textAlign: 'center' }} />
            </div>
            <div ref={labelRef} className="label-print-area">
              {Array.from({ length: labelQty }).map((_, i) => (
                <div key={i} className="label-card" style={i > 0 ? { marginTop: 20, pageBreakBefore: 'always' } : {}}>
                  <div className="label-name">{labelProduct.name}</div>
                  <div className="label-price">Rs. {Number(labelProduct.sell_price).toLocaleString('en-IN')}</div>
                  {labelProduct.barcode_image
                    ? <img src={labelProduct.barcode_image} alt="barcode" className="label-barcode" />
                    : labelProduct.barcode
                      ? <div className="label-barcode-text">{labelProduct.barcode}</div>
                      : null}
                  <div className="label-sku">{labelProduct.serial_number || labelProduct.barcode || ''}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => { setLabelProduct(null); setLabelQty(1); }}>Close</button>
              <button className="btn btn-primary" onClick={handlePrintLabel}>Print {labelQty} Label{labelQty > 1 ? 's' : ''}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
