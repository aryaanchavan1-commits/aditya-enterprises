import React, { useState, useEffect, useRef } from 'react';
import { bluetoothSupported, pairPrinter, reconnectPrinter, sendBytes, buildEscPosTest, getSavedPrinter, clearSavedPrinter, disconnectActive, isConnected, printViaBridge, serialSupported, connectSerialPrinter, disconnectSerial, serialConnected, usbSupported, connectUsbPrinter, disconnectUsb, usbConnected, getDirectPrinter, printViaSerial, printViaUsb } from '../printer';

const API = '/api';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const saveTimer = useRef(null);
  const [toast, setToast] = useState(null);
  const [printerStatus, setPrinterStatus] = useState('');
  const [scannerStatus, setScannerStatus] = useState('');
  const [detectedPrinters, setDetectedPrinters] = useState([]);
  const [detectedScanners, setDetectedScanners] = useState([]);
  const [directPrinter, setDirectPrinter] = useState(null);
  const [directBusy, setDirectBusy] = useState(false);
  const [serialBaud, setSerialBaud] = useState(9600);
  const [btPrinter, setBtPrinter] = useState(null);
  const [btBusy, setBtBusy] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState({ bridgeOnline: false, bridgePrinter: '', bridgeShare: '', bridgePrinterMode: '', bridgeVersion: '', bridgeLastError: '', lastJob: null });
  const [bridgeBusy, setBridgeBusy] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const checkBridge = () => {
        fetch(`${API}/devices/print/bridge/status`).then(r => r.json()).then(d => {
        if (d.success) setBridgeStatus(d.data);
      }).catch(() => {});
    };
    checkBridge();
    const int = setInterval(checkBridge, 8000);
    return () => clearInterval(int);
  }, []);

  const testBridgePrint = async () => {
    if (bridgeStatus.bridgeOnline && !bridgeStatus.bridgePrinter) {
      showToast('Bridge is online, but no printer is connected to the shop PC yet. Plug in the USB printer - it auto-detects within 30 seconds.', 'error');
      return;
    }
    if (!bridgeStatus.bridgeOnline) {
      showToast('USB bridge is not running. Start start-bridge.bat on the shop PC first (see below).', 'error');
      return;
    }
    setBridgeBusy(true);
    try {
      await printViaBridge('test', { companyName: settings.company_name || 'Aditya Enterprises' });
      showToast('Print job sent to USB printer');
      setTimeout(() => {
      fetch(`${API}/devices/print/bridge/status`).then(r => r.json()).then(d => {
          if (d.success && d.data.lastJob?.status === 'failed') showToast('USB print failed: ' + (d.data.lastJob.error || 'unknown'), 'error');
        }).catch(() => {});
      }, 5000);
    } catch (err) {
      showToast('Could not send print job: ' + err.message, 'error');
    } finally {
      setBridgeBusy(false);
    }
  };

  useEffect(() => {
    fetch(`${API}/settings`)
      .then(r => r.json()).then(d => { if (d.success) setSettings(d.data); });
    const saved = getSavedPrinter();
    if (saved) {
      setBtPrinter(saved);
      setPrinterStatus(`Printer "${saved.name}" is paired. Reconnecting...`);
      reconnectPrinter().then(info => {
        if (info) { setBtPrinter(info); setPrinterStatus(`Connected to ${info.name}`); }
        else setPrinterStatus(`Paired with "${saved.name}" - press Connect to re-establish the link`);
      }).catch(() => {});
    }
  }, []);

  const updateSetting = async (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`${API}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: value })
        });
      } catch (err) { showToast('Failed to save', 'error'); }
    }, 800);
  };

  // Re-attach to a previously allowed USB printer without the chooser.
  useEffect(() => {
    getDirectPrinter().then(p => { if (p) setDirectPrinter(p); }).catch(() => {});
  }, []);

  const connectDirectUsb = async () => {
    if (!serialSupported()) { showToast('Direct USB needs Chrome or Edge on a PC (Web Serial). For phones use "Connect via USB-OTG" below.', 'error'); return; }
    setDirectBusy(true);
    try {
      const info = await connectSerialPrinter(serialBaud);
      setDirectPrinter(info);
      showToast(`USB printer connected: ${info.name}`);
    } catch (err) {
      if (err.name !== 'NotFoundError') showToast(err.message || 'Connection cancelled', 'error');
      else showToast('No port selected. If the list was empty: install the CH340/CH341 driver, replug the printer, then click Connect again (see the notes above).', 'error');
    } finally {
      setDirectBusy(false);
    }
  };

  const connectAndroidUsb = async () => {
    if (!usbSupported()) { showToast('USB-OTG needs Chrome/Edge on Android or a PC with WebUSB.', 'error'); return; }
    setDirectBusy(true);
    try {
      const info = await connectUsbPrinter();
      setDirectPrinter(info);
      showToast(`USB printer connected: ${info.name}`);
    } catch (err) {
      if (err.name !== 'NotFoundError') showToast(err.message || 'Connection cancelled', 'error');
    } finally {
      setDirectBusy(false);
    }
  };

  const testDirectPrint = async () => {
    if (!directPrinter) { showToast('Connect a USB printer first', 'error'); return; }
    setDirectBusy(true);
    try {
      const bytes = buildEscPosTest({ companyName: settings.company_name || 'Aditya Enterprises' });
      if (directPrinter.type === 'serial') await printViaSerial('test', bytes);
      else await printViaUsb('test', bytes);
      showToast('Test page sent to the printer');
    } catch (err) {
      showToast('USB print failed: ' + (err.message || 'printer unreachable'), 'error');
      setDirectPrinter(null);
    } finally {
      setDirectBusy(false);
    }
  };

  const disconnectDirect = async () => {
    setDirectBusy(true);
    try {
      if (directPrinter?.type === 'serial') await disconnectSerial();
      else await disconnectUsb();
      setDirectPrinter(null);
      showToast('USB printer disconnected');
    } finally {
      setDirectBusy(false);
    }
  };

  const detectPrinters = async () => {
    try {
      const r = await fetch(`${API}/devices/printers`);
      const d = await r.json();
      const real = (d.data || []).filter(p => p.source !== 'web');
      setDetectedPrinters(real);
      setPrinterStatus(real.length > 0 ? `${real.length} printer(s) detected` : '');
      if (real.length > 0) showToast(`${real.length} printer(s) detected`);
      else if (d.message) showToast(d.message);
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

  const connectBluetoothPrinter = async () => {
    if (!bluetoothSupported()) { showToast('Web Bluetooth needs Chrome/Edge over HTTPS', 'error'); return; }
    setBtBusy(true);
    try {
      const info = await pairPrinter();
      setBtPrinter(info);
      setPrinterStatus(`Connected to ${info.name}`);
      showToast(`Bluetooth printer connected: ${info.name}`);
      // Immediate confirmation print so you know the selected printer works.
      setTimeout(() => {
        sendBytes(buildEscPosTest({ companyName: settings.company_name || 'Aditya Enterprises' }))
          .then(() => showToast('Test print sent - check the printer'))
          .catch(e => setPrinterStatus(`Paired with "${info.name}" but test print failed: ${e.message}`));
      }, 400);
    } catch (err) {
      showToast(err.message || 'Bluetooth printer pairing cancelled', 'error');
    } finally {
      setBtBusy(false);
    }
  };

  const disconnectBluetoothPrinter = async () => {
    await disconnectActive();
    clearSavedPrinter();
    setBtPrinter(null);
    setPrinterStatus('');
    showToast('Bluetooth printer disconnected');
  };

  const testBluetoothPrint = async () => {
    if (!btPrinter) return showToast('Connect a Bluetooth printer first', 'error');
    setBtBusy(true);
    try {
      await sendBytes(buildEscPosTest({ companyName: settings.company_name || 'Aditya Enterprises' }));
      showToast('Test print sent to: ' + btPrinter.name);
    } catch (err) {
      if (/not found|connect it again|connect the printer again/i.test(err.message || '')) {
        showToast(err.message, 'error');
        setPrinterStatus('Printer connection lost - press "Reconnect Bluetooth Printer"');
      } else {
        showToast('Print failed: ' + (err.message || 'connection error'), 'error');
      }
    } finally {
      setBtBusy(false);
    }
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <h2 style={{marginBottom:20}}>Settings</h2>

      <div className="settings-grid">
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
            <button className="btn btn-sm btn-primary" style={{marginLeft:4}} onClick={connectBluetoothScanner}>Connect Bluetooth Scanner</button>
            <button className="btn btn-sm btn-warning" style={{marginLeft:4}} onClick={connectUsbDevice}>Connect USB Device</button>
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
              No dedicated scanners detected. USB / RF / Bluetooth-HID barcode scanners (keyboard wedge type) work automatically on any screen - just scan a barcode and the app catches it, even without clicking a field. On the Sales page a scan adds the item to the cart; on Products it opens the label/add flow. This is the most common scanner type.
            </p>
          )}

          <h4 style={{fontSize:14, marginTop:20, marginBottom:8}}>Printers</h4>

          <div style={{marginBottom:12, padding:10, background:'#eafaf1', borderRadius:8, border:'1px solid #a9dfbf'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
              <span style={{fontSize:13, fontWeight:600}}>Direct USB Printing - no install needed</span>
              {directPrinter ? <span className="badge badge-success" style={{fontSize:10}}>Connected</span> : <span className="badge badge-secondary" style={{fontSize:10, background:'#ccc', color:'#333'}}>Not connected</span>}
            </div>
            {directPrinter ? (
              <div style={{fontSize:12, color:'#27ae60', marginBottom:6}}>Connected: <strong>{directPrinter.name}</strong> {directPrinter.type === 'serial' ? '(Web Serial)' : '(WebUSB)'}</div>
            ) : (
              <div style={{fontSize:11, color:'#555', marginBottom:6}}>
                Plug the thermal printer (USB) into <strong>this</strong> PC or phone and connect it straight from the browser - no bridge, no software. Everything (labels, receipts, GST/non-GST bills) prints directly. Needs Chrome or Edge.
              </div>
            )}
            <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:6}}>
              <button className="btn btn-sm btn-success" onClick={connectDirectUsb} disabled={directBusy || !!directPrinter} title="Opens the browser's device list - pick your printer's USB port">
                {directBusy ? 'Connecting...' : 'Connect USB Printer (PC)'}
              </button>
              <button className="btn btn-sm btn-info" onClick={connectAndroidUsb} disabled={directBusy || !!directPrinter} title="Android phone/tablet with a USB-OTG cable, or a PC with WebUSB">
                Connect via USB-OTG (Android)
              </button>
              <select value={serialBaud} onChange={e => setSerialBaud(Number(e.target.value))} disabled={!!directPrinter} style={{fontSize:12, padding:'4px 6px'}} title="Most thermal printers use 9600. Check the printer manual / sticker if nothing prints.">
                <option value={9600}>9600 baud (default)</option>
                <option value={19200}>19200 baud</option>
                <option value={115200}>115200 baud</option>
              </select>
              {directPrinter && (
                <>
                  <button className="btn btn-sm btn-warning" onClick={testDirectPrint} disabled={directBusy}>Test Print</button>
                  <button className="btn btn-sm btn-outline" onClick={disconnectDirect} disabled={directBusy}>Disconnect</button>
                </>
              )}
            </div>
            <div style={{fontSize:11, lineHeight:1.5, color:'#7f8c8d', borderTop:'1px dashed #b8d4c9', paddingTop:6}}>
              <strong>No port shows up in the list?</strong> Most 58mm/80mm printers use a CH340/CH341 USB-serial chip - the COM port only appears after its driver is installed (Windows usually installs it automatically). Check &amp; fix:
              <ul style={{margin:'4px 0 0 16px', padding:0}}>
                <li>Open Device Manager → <strong>Ports (COM &amp; LPT)</strong> / <strong>Universal Serial Bus devices</strong>. If you see "CH340" with a warning icon, right-click → Update driver (online).</li>
                <li>Unplug the printer, <strong>close any printer software</strong> that may have claimed the port, plug it back in, then press Connect again.</li>
                <li>If the printer installs as a <strong>Windows printer with its own driver</strong> (no COM port appears - some POS-58 models), the browser cannot reach it directly - use the USB Bridge below or the <strong>Print dialog</strong> for that one.</li>
              </ul>
            </div>
          </div>

          <div style={{marginBottom:12, padding:10, background:'#fffbe6', borderRadius:8, border:'1px solid #f1c40f'}}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>Detected printer</div>
            {directPrinter ? (
              <div style={{fontSize:12}}>🖨️ <strong>{directPrinter.name}</strong> (direct USB via browser) — automatic label &amp; receipt printing uses it</div>
            ) : bridgeStatus.bridgeOnline ? (
              bridgeStatus.bridgePrinter ? (
                <div style={{fontSize:12}}>🖨️ <strong>{bridgeStatus.bridgePrinter}</strong>{bridgeStatus.bridgeShare ? ` (share: ${bridgeStatus.bridgeShare})` : ''} — {bridgeStatus.bridgePrinterMode === 'thermal' ? 'thermal printer, prints fast via ESC/POS' : 'normal printer (HP/Canon/Brother...), prints via the Windows driver'} — automatic label &amp; receipt printing uses it</div>
              ) : (
                <div style={{fontSize:12, color:'#e67e22'}}>USB bridge is online, but it found <strong>no printer</strong> on that PC. Plug the printer in (USB) and install its Windows driver - the bridge auto-detects it within 30 seconds.</div>
              )
            ) : btPrinter ? (
              <div style={{fontSize:12}}>🖨️ <strong>{btPrinter.name}</strong> (Bluetooth paired) — printing will use Bluetooth</div>
            ) : (
              <div style={{fontSize:12, color:'#e74c3c'}}>No printer connected — plug one into this PC/phone and tap "Connect USB Printer" above, or pair the Bluetooth printer below.</div>
            )}
          </div>

          <div style={{marginBottom:12, padding:10, background:'#f8f9fa', borderRadius:8, border:'1px solid #eee'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
              <span style={{fontSize:13, fontWeight:600}}>Optional: USB Bridge (prints to a different shop PC)</span>
              <span className={`badge ${bridgeStatus.bridgeOnline ? 'badge-success' : 'badge-danger'}`} style={{fontSize:10}}>
                {bridgeStatus.bridgeOnline ? 'Bridge Online' : 'Bridge Offline'}
              </span>
            </div>
            <div style={{fontSize:11, color:'#777', marginBottom:6}}>Only needed if the printer stays plugged into a <strong>different</strong> PC than the one you're using the app from (e.g. sales from a phone, printer on the shop PC). With "Direct USB Printing" above, no bridge is needed at all.</div>
            <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:6}}>
              <button className="btn btn-sm btn-success" onClick={testBridgePrint} disabled={bridgeBusy}>
                {bridgeBusy ? 'Sending...' : 'Test Print via USB'}
              </button>
            </div>
            {bridgeStatus.lastJob?.error && (
              <div style={{fontSize:11, color:'#e74c3c', marginBottom:4}}>Last job failed: {bridgeStatus.lastJob.error}</div>
            )}
            {bridgeStatus.bridgeOnline && !bridgeStatus.bridgePrinter && (
              <div style={{fontSize:11, color:'#e67e22', marginBottom:4}}>Bridge running, but it reported no printer found on the shop PC.</div>
            )}
            <div style={{fontSize:11, color:'#777', lineHeight:1.5}}>
              Prints automatically to ANY printer on that PC - thermal printers (Posiflow etc.) get fast ESC/POS codes, normal printers (HP/Canon/Brother) get a proper rendered print via the Windows driver. No dialog needed. One-time setup on the Windows PC where the printer is plugged in:
              <ol style={{margin:'4px 0 0 16px', padding:0}}>
                <li>Plug in the Posiflow (USB) and install its Windows driver if Windows asks.</li>
                <li>Copy the <strong>print-bridge</strong> folder onto that PC and run <strong>install-bridge.bat</strong> once. It installs everything and sets the bridge to start automatically with Windows.</li>
              </ol>
              When the bridge is running, the green badge above turns Online and printing uses USB automatically (falls back to Bluetooth when the bridge is off).
            </div>
          </div>

          <div style={{marginBottom:12, padding:10, background:'#f8f9fa', borderRadius:8, border:'1px solid #eee'}}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:6}}>Bluetooth Printer (direct printing, no dialog)</div>
            <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:6}}>
              <button className="btn btn-sm btn-primary" onClick={connectBluetoothPrinter} disabled={btBusy}>
                {btBusy ? 'Working...' : (btPrinter ? 'Reconnect Bluetooth Printer' : 'Connect Bluetooth Printer')}
              </button>
              {btPrinter && (
                <>
                  <button className="btn btn-sm btn-success" onClick={testBluetoothPrint} disabled={btBusy}>Test Print</button>
                  <button className="btn btn-sm btn-outline" onClick={disconnectBluetoothPrinter}>Disconnect</button>
                </>
              )}
            </div>
            {btPrinter ? (
              <div style={{fontSize:12, color:'#27ae60'}}>Connected: <strong>{btPrinter.name}</strong></div>
            ) : (
              <div style={{fontSize:11, color:'#777'}}>
                Pair your Posiflow / thermal receipt printer with the browser (Chrome/Edge). After pairing, the POS prints receipts directly to it. Printer must be switched on and in Bluetooth pairing mode.
              </div>
            )}
            {printerStatus && <div style={{fontSize:11, marginTop:4, color:'#777'}}>{printerStatus}</div>}
          </div>

          <div style={{marginBottom:12, padding:10, background:'#eef6ff', borderRadius:8, border:'1px solid #bcd9f5'}}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>How does printing work? (choose your setup)</div>
            <div style={{fontSize:11, color:'#555', lineHeight:1.6}}>
              <ul style={{margin:'0 0 6px 16px', padding:0}}>
                <li><strong>Direct USB (recommended, no install):</strong> plug the thermal printer into the same PC or phone you use the app on, tap "Connect USB Printer" once, done. Chrome/Edge talks to the printer directly (Web Serial on PC, USB-OTG on Android). Auto-reconnects on that device afterwards.</li>
                <li><strong>Bluetooth:</strong> pair a Bluetooth thermal printer once (Chrome/Edge). Works from PC or Android.</li>
                <li><strong>USB Bridge (optional):</strong> only when the printer is plugged into a <strong>different</strong> PC than the device you're using. A tiny free program runs once on that PC (install-bridge.bat) and prints jobs sent from anywhere. Setup steps below.</li>
                <li><strong>Normal printers (HP/Canon/Brother):</strong> use "Print Receipt" — the browser's own print dialog handles them on any device.</li>
              </ul>
              Bridge setup (only for that shop-PC scenario): plug in the printer, copy the <strong>print-bridge</strong> folder there, run <strong>install-bridge.bat</strong> once — it starts automatically with Windows afterwards.
            </div>
          </div>

          <div style={{marginBottom:12}}>
            <button className="btn btn-sm btn-info" onClick={detectPrinters}>Scan for Printers (Windows/USB)</button>
            {detectedPrinters.length > 0 && printerStatus && <span style={{fontSize:12, marginLeft:8, color:'#27ae60'}}>{printerStatus}</span>}
          </div>
          {detectedPrinters.length > 0 ? (
            detectedPrinters.map((p, i) => (
              <div key={i} style={{fontSize:12, padding:'6px 8px', marginBottom:4, background:'#f0fff0', borderRadius:6, borderLeft:'3px solid #27ae60'}}>
                <div><strong>{p.name}</strong></div>
                <div style={{fontSize:10, color:'#777'}}>
                  {p.driver && <span>Driver: {p.driver} | </span>}
                  {p.port && <span>Port: {p.port} | </span>}
                  {p.source && <span>Source: {p.source}</span>}
                  {p.isDefault && <span className="badge badge-info" style={{marginLeft:4}}>Default</span>}
                </div>
              </div>
            ))
          ) : (
            <p style={{fontSize:11, color:'#777'}}>
              The cloud API cannot see your USB printer - only the <strong>bridge running on the shop PC</strong> can detect it. Start <strong>start-bridge.bat</strong> there and this page will show the detected printer name automatically. Alternatively pair the printer over <strong>Bluetooth</strong> using the button above.
            </p>
          )}
        </div>

        {/* Danger Zone */}
        <div className="card" style={{borderLeft:'4px solid #e74c3c'}}>
          <div className="card-header"><h3>Data Management</h3></div>
          <p style={{fontSize:13, color:'#777', marginBottom:12}}>
            All data is stored in Turso cloud database.
          </p>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <button className="btn btn-sm btn-outline" onClick={async () => {
              await fetch(`${API}/ai/history`, { method: 'DELETE' });
              showToast('Chat history cleared');
            }}>Clear AI History</button>
            <button className="btn btn-sm btn-danger" onClick={async () => {
              if (!window.confirm('Reset ALL data? This will delete all products, sales, purchases, categories and start fresh. This cannot be undone.')) return;
              if (!window.confirm('Are you absolutely sure? All your business data will be permanently deleted.')) return;
              try {
                const r = await fetch(`${API}/settings/reset`, { method: 'POST' });
                const d = await r.json();
                if (d.success) {
                  showToast('All data has been reset. Refreshing...');
                  setTimeout(() => window.location.reload(), 1500);
                } else {
                  showToast(d.error || 'Reset failed', 'error');
                }
              } catch (e) {
                showToast('Reset failed: ' + e.message, 'error');
              }
            }}>Reset All Data</button>
          </div>
        </div>
      </div>
    </div>
  );
}
