import React, { useState, useEffect, useRef } from 'react';
import { api, exportToExcel, readExcelFile } from '../api';
import { useReactToPrint } from 'react-to-print';
import { barcodeDataUrl } from '../barcode';
import { printSmartLabel } from '../printer';
import CameraScanner from './CameraScanner';

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
  const [scanOpen, setScanOpen] = useState(false);
  const [cameFromScan, setCameFromScan] = useState(false);
  const scanBarcodeRef = useRef(null);
  const scanNameRef = useRef(null);

  const emptyProduct = {
    name: '', image: '', quantity: 0, description: '', hsn_code: '',
    sell_price: 0, inward_price: 0, serial_number: '', discount_percent: 0,
    barcode: '', category_id: '', subcategory_id: '', low_stock_threshold: 5
  };

  const [form, setForm] = useState(emptyProduct);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadProducts = () => {
    api(`/products?search=${search}&category_id=${categoryFilter}`)
      .then(d => { if (d.success) setProducts(d.data); else showToast(d.error || 'Failed to load products', 'error'); });
  };

  const loadCategories = () => {
    api('/categories').then(d => { if (d.success) setCategories(d.data); });
  };

  useEffect(() => { loadProducts(); loadCategories(); }, []);
  useEffect(() => { loadProducts(); }, [search, categoryFilter]);

  const openAdd = () => {
    setEditProduct(null);
    setForm(emptyProduct);
    setSubcategories([]);
    setCameFromScan(false);
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setCameFromScan(false);
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
      const r = await fetch('/api/upload/image', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.success) setForm({ ...form, image: d.data.original });
    } catch (err) { showToast('Image upload failed', 'error'); }
  };

  // "Scan & Add" flow: camera (or a Bluetooth keyboard-wedge scanner typing
  // into the focused barcode field) fills in the barcode, then the user adds
  // name/price and saves. Label auto-prints on save.
  const startScanAdd = () => setScanOpen(true);

  const handleProductScan = async (code) => {
    setScanOpen(false);
    const clean = String(code || '').trim();
    if (!clean) return;
    try {
      const existing = await api('/barcode/' + encodeURIComponent(clean));
      if (existing.success && existing.data?.id) {
        const p = existing.data;
        showToast(`Already exists: ${p.name} (stock: ${p.quantity || 0})`);
        setLabelProduct(p);
        setLabelQty(Math.max(1, Math.min(100, Number(p.quantity) || 1)));
        return;
      }
    } catch (e) {}
    setEditProduct(null);
    setForm({ ...emptyProduct, barcode: clean });
    setSubcategories([]);
    setCameFromScan(true);
    setShowModal(true);
    setTimeout(() => scanBarcodeRef.current?.focus(), 150);
  };

  const handleScanBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      scanNameRef.current?.focus();
    }
  };

  const handleSave = async () => {
    if (!form.name) return showToast('Product name is required', 'error');
    const payload = { ...form };
    if (payload.barcode) payload.barcode = payload.barcode.replace(/[^A-Za-z0-9\-]/g, '').slice(0, 20);
    const path = editProduct ? `/products/${editProduct.id}` : '/products';
    const d = await api(path, { method: editProduct ? 'PUT' : 'POST', body: payload });
    if (d.success) {
      showToast(editProduct ? 'Product updated' : 'Product created');
      setShowModal(false);
      loadProducts();
      if (cameFromScan) {
        // Keep the scanner open for the next product - quick stock entry.
        setTimeout(() => setScanOpen(true), 400);
      }
      // New product -> print its barcode label automatically through
      // whichever printer is online (USB bridge first, else Bluetooth).
      if (!editProduct && d.data?.barcode) {
        printSmartLabel({
          name: d.data.name,
          price: Number(d.data.sell_price || 0),
          barcode: d.data.barcode,
          sku: d.data.serial_number || d.data.barcode,
          copies: 1
        }).then(r => {
          if (r.via === 'usb') showToast('Barcode label sent to USB printer');
          else if (r.via === 'bluetooth') showToast(`Barcode label printed via Bluetooth (${r.target})`);
          else showToast('No printer detected - pair Bluetooth or run the USB bridge (Settings → Printers)', 'error');
        }).catch(err => showToast('Label print failed: ' + err.message, 'error'));
      }
    } else {
      showToast(d.error || 'Save failed', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this product?')) return;
    const d = await api('/products/' + id, { method: 'DELETE' });
    if (d.success) { showToast('Product deleted'); loadProducts(); }
    else showToast(d.error || 'Delete failed', 'error');
  };

  const [labelProduct, setLabelProduct] = useState(null);
  const [labelQty, setLabelQty] = useState(1);
  const labelRef = useRef(null);
  const handlePrintLabel = useReactToPrint({ contentRef: labelRef, documentTitle: 'Product_Label' });

  const openLabel = (p) => {
    setLabelProduct(p);
    // One label per unit in stock, so multi-quantity products get a
    // complete set of identical, perfect labels.
    setLabelQty(Math.max(1, Math.min(100, Number(p.quantity) || 1)));
  };

  const labelBarcode = labelProduct?.barcode ? barcodeDataUrl(labelProduct.barcode, { maxWidthPx: 900, heightPx: 300 }) : '';

  const [labelPrinting, setLabelPrinting] = useState(false);

  const handleUsbLabels = async () => {
    if (!labelProduct?.barcode) return;
    setLabelPrinting(true);
    try {
      const r = await printSmartLabel({
        name: labelProduct.name,
        price: Number(labelProduct.sell_price || 0),
        barcode: labelProduct.barcode,
        sku: labelProduct.serial_number || labelProduct.barcode,
        copies: labelQty
      });
      if (r.via === 'usb') showToast(`${labelQty} label(s) sent to USB printer`);
      else if (r.via === 'bluetooth') showToast(`${labelQty} label(s) printed via Bluetooth (${r.target})`);
      else showToast('No printer detected - pair Bluetooth or run the USB bridge (Settings → Printers)', 'error');
    } catch (err) {
      showToast('Print failed: ' + err.message, 'error');
    } finally {
      setLabelPrinting(false);
    }
  };

  const handleGenerateBarcode = async (id) => {
    const d = await api('/barcode/generate/' + id, { method: 'POST', body: {} });
    if (d.success) { showToast('Barcode generated'); loadProducts(); }
    else showToast(d.error || 'Barcode generation failed', 'error');
  };

  const handleGenerateAllBarcodes = async () => {
    const missing = products.filter(p => !p.barcode);
    if (!missing.length) return showToast('All products already have barcodes');
    if (!confirm(`Generate barcodes for ${missing.length} products without barcodes?`)) return;
    const ids = missing.map(p => p.id);
    const d = await api('/barcode/generate-bulk', { method: 'POST', body: { product_ids: ids } });
    if (d.success) showToast(`Generated ${d.data.length} barcode(s)`);
    else showToast(d.error || 'Bulk generation failed', 'error');
    loadProducts();
  };

  const handleExportProducts = () => {
    const data = products.map(p => ({
      Name: p.name, HSN: p.hsn_code || '', Sell_Price: p.sell_price, Inward_Price: p.inward_price,
      Quantity: p.quantity, Unit: p.unit || 'pcs', Discount_Percent: p.discount_percent,
      Barcode: p.barcode || '', Serial: p.serial_number || '', Category: p.category_name || '',
      Description: p.description || ''
    }));
    exportToExcel(data, `products_export_${new Date().toISOString().slice(0,10)}`);
    showToast('Products exported to Excel');
  };

  const fileRefProducts = useRef(null);
  const handleImportProducts = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await readExcelFile(file);
      let ok = 0, fail = 0;
      for (const row of rows) {
        const payload = {
          name: row.Name || row.name || '',
          hsn_code: row.HSN || row.hsn_code || '',
          sell_price: parseFloat(row.Sell_Price || row.sell_price || 0),
          inward_price: parseFloat(row.Inward_Price || row.inward_price || 0),
          quantity: parseInt(row.Quantity || row.quantity || 0),
          unit: row.Unit || row.unit || 'pcs',
          discount_percent: parseFloat(row.Discount_Percent || row.discount_percent || 0),
          barcode: row.Barcode || row.barcode || '',
          serial_number: row.Serial || row.serial_number || '',
          description: row.Description || row.description || ''
        };
        if (!payload.name) { fail++; continue; }
        const d = await api('/products', { method: 'POST', body: payload });
        if (d.success) ok++; else fail++;
      }
      showToast(`Imported ${ok} product(s)${fail ? `, ${fail} failed` : ''}`);
      loadProducts();
    } catch (err) { showToast('Import failed: ' + err.message, 'error'); }
    e.target.value = '';
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <h2>Products ({products.length})</h2>
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          <button className="btn btn-sm btn-outline hide-mobile" onClick={handleExportProducts}>Export</button>
          <button className="btn btn-sm btn-outline hide-mobile" onClick={() => fileRefProducts.current?.click()}>Import</button>
          <input ref={fileRefProducts} type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={handleImportProducts} />
          <button className="btn btn-sm btn-outline hide-mobile" onClick={handleGenerateAllBarcodes} title="Generate barcodes for products without one">Barcode</button>
          <button className="btn btn-sm btn-info" onClick={startScanAdd} title="Scan a barcode with the camera or a Bluetooth scanner to add the product">Scan & Add</button>
          <button className="btn btn-primary btn-sm hide-mobile" onClick={openAdd}>+ Add Product</button>
        </div>
      </div>
      <button className="fab show-mobile" onClick={openAdd}>+</button>

      <div className="search-bar">
        <input
          type="text"           placeholder="Search by name or barcode..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="card desktop-table">
        <div className="table-container">
          {products.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Price</th><th>Stock</th><th>Barcode</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>Rs.{Number(p.sell_price).toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${p.quantity <= (p.low_stock_threshold || 5) ? 'badge-danger' : 'badge-success'}`}>{p.quantity} {p.unit || 'pcs'}</span></td>
                    <td style={{fontSize:11}}>
                      {p.barcode_image ? <img src={p.barcode_image} alt="barcode" style={{height:30, display:'block'}} /> : p.barcode || <span className="badge badge-warning">None</span>}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-info" style={{marginRight:4}} onClick={() => openEdit(p)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>Del</button>
                      {p.barcode ? <button className="btn btn-sm btn-outline" onClick={() => setLabelProduct(p)} style={{marginLeft:4}}>Label</button> : <button className="btn btn-sm btn-outline" onClick={() => handleGenerateBarcode(p.id)} style={{marginLeft:4}}>Barcode</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{textAlign:'center',color:'#999',padding:40}}>No products found.</div>
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
                <span className="label">Stock</span>
                <span className="value"><span className={`badge ${p.quantity <= (p.low_stock_threshold || 5) ? 'badge-danger' : 'badge-success'}`}>{p.quantity} {p.unit || 'pcs'}</span></span>
              </div>
              <div className="mobile-card-actions">
                <button className="btn btn-sm btn-info" onClick={() => openEdit(p)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>Delete</button>
                {p.barcode ? <button className="btn btn-sm btn-outline" onClick={() => openLabel(p)}>Label</button> : <button className="btn btn-sm btn-outline" onClick={() => handleGenerateBarcode(p.id)}>Barcode</button>}
              </div>
            </div>
          ))}
          {products.length === 0 && <div style={{textAlign:'center',color:'#999',padding:30}}>No products found.</div>}
        </div>
      </div>

      {labelProduct && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setLabelProduct(null)}>
          <div className="modal" style={{maxWidth:400}}>
            <h3>Print Label: {labelProduct.name}</h3>
            <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:12}}>
              <label style={{fontSize:13, fontWeight:600}}>Copies:</label>
              <input type="number" min="1" max="100" value={labelQty}
                onChange={e => setLabelQty(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                style={{width:70, textAlign:'center'}} />
            </div>
            <div ref={labelRef} className="label-print-area">
              {Array.from({ length: labelQty }).map((_, i) => (
                <div key={i} className="label-card">
                  <div className="label-name">{labelProduct.name}</div>
                  <div className="label-price">Rs. {Number(labelProduct.sell_price).toLocaleString('en-IN')}</div>
                  {labelBarcode
                    ? <img src={labelBarcode} alt="barcode" className="label-barcode" />
                    : labelProduct.barcode
                      ? <div className="label-barcode-text">{labelProduct.barcode}</div>
                      : null}
                  <div className="label-sku">{labelProduct.serial_number || labelProduct.barcode || ''}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:16}}>
              <button className="btn btn-outline" onClick={() => { setLabelProduct(null); setLabelQty(1); }}>Close</button>
              <button className="btn btn-warning" onClick={handleUsbLabels} disabled={labelPrinting} title="USB bridge if online, else paired Bluetooth printer">
                {labelPrinting ? 'Printing...' : `Print ${labelQty} via Printer`}
              </button>
              <button className="btn btn-primary" onClick={handlePrintLabel}>Print {labelQty} Label{labelQty > 1 ? 's' : ''}</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3>{editProduct ? 'Edit Product' : cameFromScan ? `Add Product - Barcode: ${form.barcode || '(scanned)'}` : 'Add New Product'}</h3>
            {cameFromScan && <p style={{fontSize:12, color:'#777', marginTop:-6}}>Barcode pre-filled from scan. Save, then scan the next product - or scan again with your Bluetooth scanner into the Barcode field.</p>}

            <div className="form-row">
              <div className="form-group">
                <label>Product Name *</label>
                <input ref={scanNameRef} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Product name" />
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
                <label>Unit</label>
                <select value={form.unit || 'pcs'} onChange={e => setForm({...form, unit: e.target.value})}>
                  {['pcs','kg','meter','bag','box','dozen','liter','pack','set','roll','sheet','pair'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
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
              <div className="form-group">
                <label>Low Stock Alert (qty)</label>
                <input type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm({...form, low_stock_threshold: Number(e.target.value)})} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Serial Number</label>
                <input value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} placeholder="Auto-generated if empty" />
              </div>
              <div className="form-group">
                <label>Barcode</label>
                <input ref={scanBarcodeRef} value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} onFocus={e => e.target.select()} onKeyDown={handleScanBarcodeKeyDown} placeholder="Auto-generated if empty" />
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
      {scanOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setScanOpen(false)}>
          <div className="modal" style={{maxWidth:450}}>
            <CameraScanner onScan={handleProductScan} onClose={() => setScanOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
