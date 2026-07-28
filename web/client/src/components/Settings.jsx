import React, { useState, useEffect } from 'react';

const API = '/api';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [toast, setToast] = useState(null);
  const [printerStatus, setPrinterStatus] = useState('');
  const [scannerStatus, setScannerStatus] = useState('');
  const [detectedPrinters, setDetectedPrinters] = useState([]);
  const [detectedScanners, setDetectedScanners] = useState([]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetch(`${API}/settings`)
      .then(r => r.json()).then(d => { if (d.success) setSettings(d.data); });
  }, []);

  const updateSetting = async (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    try {
      await fetch(`${API}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: String(value) })
      });
    } catch (err) { showToast('Failed to save', 'error'); }
  };

  const detectPrinters = async () => {
    try {
      const r = await fetch(`${API}/devices/printers`);
      const d = await r.json();
      if (d.success) {
        setDetectedPrinters(d.data);
        setPrinterStatus(d.data.length > 0 ? `${d.data.length} printer(s) detected` : 'No printers found');
        showToast(d.data.length > 0 ? 'Printers detected' : 'No printers detected', d.data.length > 0 ? 'success' : 'error');
      }
    } catch (err) { showToast('Printer detection failed', 'error'); }
  };

  const detectScanners = async () => {
    try {
      const r = await fetch(`${API}/devices/scanners`);
      const d = await r.json();
      const allScanners = [...(d.data || [])];

      // Web Bluetooth scanner detection
      if (navigator.bluetooth) {
        try {
          const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['battery_service']
          });
          if (device) {
            allScanners.push({ type: 'scanner', name: `Bluetooth: ${device.name || 'Unknown'}`, deviceId: device.id, source: 'bluetooth_web', note: 'Bluetooth scanner connected via Web Bluetooth API' });
          }
        } catch (btErr) {
          if (btErr.name !== 'NotFoundError') console.log('BT scan:', btErr.message);
        }
      }

      // WebUSB scanner detection
      if (navigator.usb) {
        try {
          const devices = await navigator.usb.getDevices();
          devices.forEach(dev => {
            if (!allScanners.find(s => s.deviceId === dev.serialNumber)) {
              allScanners.push({ type: 'scanner', name: `USB: ${dev.productName || 'HID Scanner'}`, deviceId: dev.serialNumber || dev.productName, source: 'usb_web', note: 'USB device detected via WebUSB' });
            }
          });
        } catch (usbErr) { console.log('USB scan:', usbErr.message); }
      }

      setDetectedScanners(allScanners);
      setScannerStatus(allScanners.length > 0 ? `${allScanners.length} scanner(s) detected` : 'No scanners found (keyboard wedge scanners work automatically)');
      showToast(allScanners.length > 0 ? 'Scanners detected' : 'Check connections', allScanners.length > 0 ? 'success' : 'error');
    } catch (err) { showToast('Scanner detection failed', 'error'); }
  };

  const connectBluetoothScanner = async () => {
    if (!navigator.bluetooth) { showToast('Web Bluetooth not supported on this browser/device', 'error'); return; }
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service']
      });
      if (device) {
        showToast(`Connected to: ${device.name || 'Bluetooth Scanner'}`, 'success');
        detectScanners();
      }
    } catch (err) { showToast(err.message || 'Bluetooth connection cancelled', 'error'); }
  };

  const connectUsbDevice = async () => {
    if (!navigator.usb) { showToast('WebUSB not supported on this browser/device', 'error'); return; }
    try {
      const device = await navigator.usb.requestDevice({ filters: [] });
      if (device) {
        await device.open();
        showToast(`USB device connected: ${device.productName || 'Unknown'}`, 'success');
        detectScanners();
      }
    } catch (err) { showToast(err.message || 'USB connection cancelled', 'error'); }
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <h2 style={{marginBottom:20}}>Settings</h2>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
        {/* Company Settings */}
        <div className="card">
          <div className="card-header"><h3>Company Details</h3></div>
          <div className="form-group">
            <label>Company Name</label>
            <input value={settings.company_name || ''} onChange={e => updateSetting('company_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea value={settings.company_address || ''} onChange={e => updateSetting('company_address', e.target.value)} rows={2} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>GSTIN</label>
              <input value={settings.company_gstin || ''} onChange={e => updateSetting('company_gstin', e.target.value)} placeholder="27XXXXX1234Z1" />
            </div>
            <div className="form-group">
              <label>PAN</label>
              <input value={settings.company_pan || ''} onChange={e => updateSetting('company_pan', e.target.value)} placeholder="ABCDE1234F" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input value={settings.company_phone || ''} onChange={e => updateSetting('company_phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={settings.company_email || ''} onChange={e => updateSetting('company_email', e.target.value)} />
            </div>
          </div>
        </div>

        {/* GST Settings */}
        <div className="card">
          <div className="card-header"><h3>GST Configuration</h3></div>
          <div className="form-row">
            <div className="form-group">
              <label>GST Rate (%)</label>
              <input type="number" value={settings.gst_rate || 18} onChange={e => updateSetting('gst_rate', e.target.value)} />
            </div>
            <div className="form-group">
              <label>CGST Rate (%)</label>
              <input type="number" value={settings.cgst_rate || 9} onChange={e => updateSetting('cgst_rate', e.target.value)} />
            </div>
            <div className="form-group">
              <label>SGST Rate (%)</label>
              <input type="number" value={settings.sgst_rate || 9} onChange={e => updateSetting('sgst_rate', e.target.value)} />
            </div>
            <div className="form-group">
              <label>IGST Rate (%)</label>
              <input type="number" value={settings.igst_rate || 18} onChange={e => updateSetting('igst_rate', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Invoice Prefix</label>
            <input value={settings.invoice_prefix || 'AE/'} onChange={e => updateSetting('invoice_prefix', e.target.value)} />
          </div>
        </div>

        {/* AI/API Settings */}
        <div className="card">
          <div className="card-header"><h3>AI / Groq API</h3></div>
          <div className="form-group">
            <label>Groq API Key</label>
            <input type="password" value={settings.groq_api_key || ''} onChange={e => updateSetting('groq_api_key', e.target.value)} placeholder="gsk_your_api_key..." />
            <span style={{fontSize:11, color:'#777'}}>Free tier available at console.groq.com</span>
          </div>
          <div className="form-group">
            <label>Default Model</label>
            <select value={settings.groq_model || ''} onChange={e => updateSetting('groq_model', e.target.value)}>
              <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Versatile)</option>
              <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
              <option value="gemma2-9b-it">Gemma 2 9B IT</option>
              <option value="deepseek-r1-distill-llama-70b">DeepSeek R1 (Llama 70B)</option>
              <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
              <option value="qwen-2.5-32b">Qwen 2.5 32B</option>
              <option value="qwen-2.5-coder-32b">Qwen 2.5 Coder 32B</option>
              <option value="llama-4-maverick-17b-128e-instruct">Llama 4 Maverick 17B</option>
            </select>
          </div>
        </div>

        {/* Printer & Scanner */}
        <div className="card">
          <div className="card-header"><h3>Connected Devices</h3></div>

          <h4 style={{fontSize:14, marginBottom:8}}>Barcode Scanners</h4>
          <div style={{marginBottom:12}}>
            <button className="btn btn-sm btn-info" onClick={detectScanners}>Scan for Scanners</button>
            <button className="btn btn-sm btn-primary" style={{marginLeft:4}} onClick={connectBluetoothScanner}>🔵 Connect Bluetooth Scanner</button>
            <button className="btn btn-sm btn-warning" style={{marginLeft:4}} onClick={connectUsbDevice}>🔌 Connect USB Device</button>
            {scannerStatus && <div style={{fontSize:12, marginTop:4, color: scannerStatus.includes('No')?'#e74c3c':'#27ae60'}}>{scannerStatus}</div>}
          </div>
          {detectedScanners.length > 0 ? (
            detectedScanners.map((s, i) => (
              <div key={i} style={{fontSize:12, padding:'6px 8px', marginBottom:4, background:'#f0f8ff', borderRadius:6, borderLeft:'3px solid #3498db'}}>
                <div><strong>{s.name}</strong></div>
                <div style={{fontSize:10, color:'#777'}}>
                  {s.deviceId && <span>ID: {s.deviceId.substring(0,40)}... | </span>}
                  {s.path && <span>Port: {s.path} | </span>}
                  {s.source && <span>Source: {s.source} | </span>}
                  {s.note && <span>{s.note}</span>}
                </div>
                <div style={{marginTop:4}}>
                  <span className="badge badge-success">Detected</span>
                  {s.source === 'hid' && <span className="badge badge-info" style={{marginLeft:4}}>Keyboard Wedge (Auto)</span>}
                  {s.source === 'com' && <span className="badge badge-warning" style={{marginLeft:4}}>Serial Scanner</span>}
                </div>
              </div>
            ))
          ) : (
            <p style={{fontSize:11, color:'#777', marginBottom:12}}>
              No dedicated scanners detected. USB barcode scanners (keyboard wedge type) work automatically on any screen - just scan a barcode into any focused input field. This is the most common scanner type.
            </p>
          )}

          <h4 style={{fontSize:14, marginTop:20, marginBottom:8}}>Printers</h4>
          <div style={{marginBottom:12}}>
            <button className="btn btn-sm btn-info" onClick={detectPrinters}>Scan for Printers</button>
            {printerStatus && <span style={{fontSize:12, marginLeft:8, color: printerStatus.includes('No')?'#e74c3c':'#27ae60'}}>{printerStatus}</span>}
          </div>
          {detectedPrinters.length > 0 ? (
            detectedPrinters.map((p, i) => (
              <div key={i} style={{fontSize:12, padding:'6px 8px', marginBottom:4, background:'#f0fff0', borderRadius:6, borderLeft:'3px solid #27ae60'}}>
                <div><strong>🖨 {p.name}</strong></div>
                <div style={{fontSize:10, color:'#777'}}>
                  {p.driver && <span>Driver: {p.driver} | </span>}
                  {p.port && <span>Port: {p.port} | </span>}
                  {p.source && <span>Source: {p.source}</span>}
                  {p.isDefault && <span className="badge badge-info" style={{marginLeft:4}}>Default</span>}
                </div>
                <div style={{marginTop:4}}>
                  <button className="btn btn-sm btn-success" style={{marginRight:4}}
                    onClick={async () => {
                      try { await fetch(`${API}/devices/print-test`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ barcode:'AE1781782184962387', printer_path:p.port || p.name }) }); showToast('Test print sent to: ' + p.name); }
                      catch(e) { showToast('Print failed', 'error'); }
                    }}>Test Print</button>
                  {p.source === 'spooler' && <span className="badge badge-success" style={{marginLeft:4}}>Ready</span>}
                  {p.source === 'pnp' && <span className="badge badge-info" style={{marginLeft:4}}>USB Connected</span>}
                </div>
              </div>
            ))
          ) : (
            <p style={{fontSize:11, color:'#777'}}>
              No printers detected. For barcode/thermal printers, connect via USB and install drivers. Receipt printing uses your default Windows printer.
            </p>
          )}
        </div>

        {/* Danger Zone */}
        <div className="card" style={{borderLeft:'4px solid #e74c3c'}}>
          <div className="card-header"><h3>Data Management</h3></div>
          <p style={{fontSize:13, color:'#777', marginBottom:12}}>
            All data is stored locally at: <code>app\data\aditya_erp.db</code>
          </p>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <button className="btn btn-sm btn-outline" onClick={async () => {
              await fetch(`${API}/ai/history`, { method: 'DELETE' });
              showToast('Chat history cleared');
            }}>Clear AI History</button>
            <button className="btn btn-sm btn-outline" onClick={() => {
              showToast('Tip: Backup app/data/aditya_erp.db to save all data');
            }}>Backup Info</button>
          </div>
        </div>
      </div>
    </div>
  );
}
