import React, { useState, useEffect, useRef } from 'react';
import { bluetoothSupported, pairPrinter, reconnectPrinter, sendBytes, buildEscPosTest, getSavedPrinter, clearSavedPrinter, disconnectActive, isConnected, printViaBridge, serialSupported, connectSerialPrinter, disconnectSerial, serialConnected, usbSupported, connectUsbPrinter, disconnectUsb, usbConnected, getDirectPrinter, printViaSerial, printViaUsb } from '../printer';
import { qzSupported, connectQz, disconnectQz, qzConnected, listQzPrinters, printQzRaw, printQzHtml, getQzThermal, saveQzThermal, getQzNormal, saveQzNormal, buildQzTestHtml } from '../qz';

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
  const [fixBusy, setFixBusy] = useState(false);
  const [fixMsg, setFixMsg] = useState('');
  const [qzState, setQzState] = useState({ supported: false, connected: false, printers: [], thermal: '', normal: '', busy: false, msg: '' });

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

  const fixDriver = async () => {
    setFixBusy(true);
    setFixMsg('');
    try {
      const r = await fetch(`${API}/devices/print/job`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'fixdriver', payload: {} }) }).then(r => r.json());
      if (!r.success) throw new Error(r.error || 'Could not start');
      setFixMsg('The fix is running on the PC the printer is plugged into. If a Windows box asks for permission there, click Yes.');
      for (let i = 0; i < 36; i++) {
        await new Promise(res => setTimeout(res, 2500));
        const st = await fetch(`${API}/devices/print/bridge/status`).then(r => r.json());
        const s = st.success && st.data ? st.data : {};
        if (s.fixStatus && s.fixStatus !== 'running') {
          setFixMsg(s.fixMessage || 'Done. Try printing now.');
          setFixBusy(false);
          showToast(s.fixStatus === 'installed' || s.fixStatus === 'already' ? 'Printer driver is ready!' : (s.fixStatus === 'cancelled' || s.fixStatus === 'error' ? 'Driver fix needs attention' : 'Driver status updated'), s.fixStatus === 'installed' || s.fixStatus === 'already' ? 'success' : 'error');
          return;
        }
      }
      setFixMsg('Still waiting for the shop PC... check that PC for a Windows permission box.');
      setFixBusy(false);
    } catch (e) {
      setFixMsg('Could not start the fix: ' + e.message);
      setFixBusy(false);
    }
  };

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

  // QZ Tray state: available? connected? auto-restore the last choice.
  useEffect(() => {
    const supported = qzSupported();
    setQzState(s => ({ ...s, supported, thermal: getQzThermal(), normal: getQzNormal() }));
    if (supported) {
      connectQz().then(() => {
        setQzState(s => ({ ...s, connected: true }));
        refreshQzPrinters();
      }).catch(e => setQzState(s => ({ ...s, connected: false, msg: e.message })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshQzPrinters = async () => {
    setQzState(s => ({ ...s, busy: true, msg: '' }));
    try {
      const printers = await listQzPrinters();
      setQzState(s => ({ ...s, busy: false, printers, connected: true, msg: `${printers.length} printer(s) found by QZ Tray` }));
    } catch (e) {
      setQzState(s => ({ ...s, busy: false, msg: e.message || 'Could not list printers' }));
    }
  };

  const connectQzTray = async () => {
    setQzState(s => ({ ...s, busy: true, msg: '' }));
    try {
      await connectQz();
      const printers = await listQzPrinters();
      setQzState(s => ({ ...s, busy: false, connected: true, printers, thermal: getQzThermal(), normal: getQzNormal(), msg: `${printers.length} printer(s) found - pick the thermal and normal printer below` }));
      showToast('QZ Tray connected!');
    } catch (e) {
      setQzState(s => ({ ...s, busy: false, connected: false, msg: e.message || 'Could not connect' }));
      showToast('QZ Tray: ' + (e.message || 'not reachable'), 'error');
    }
  };

  const disconnectQzTray = async () => {
    try { await disconnectQz(); } catch (e) {}
    setQzState(s => ({ ...s, connected: false, msg: 'Disconnected from QZ Tray' }));
  };

  const pickQzThermal = (name) => {
    saveQzThermal(name);
    setQzState(s => ({ ...s, thermal: name }));
    showToast(name ? `Thermal printer set: ${name}` : 'Thermal printer cleared');
  };

  const pickQzNormal = (name) => {
    saveQzNormal(name);
    setQzState(s => ({ ...s, normal: name }));
    showToast(name ? `Normal printer set: ${name}` : 'Normal printer cleared');
  };

  const testQzThermal = async () => {
    if (!qzState.thermal) return showToast('Pick a thermal printer first', 'error');
    setQzState(s => ({ ...s, busy: true }));
    try {
      await printQzRaw(qzState.thermal, buildEscPosTest({ companyName: settings.company_name || 'Aditya Enterprises' }));
      showToast(`Test sent to ${qzState.thermal}`);
    } catch (e) {
      showToast('QZ thermal print failed: ' + (e.message || 'unknown'), 'error');
    } finally {
      setQzState(s => ({ ...s, busy: false }));
    }
  };

  const testQzNormal = async () => {
    if (!qzState.normal) return showToast('Pick a normal printer first', 'error');
    setQzState(s => ({ ...s, busy: true }));
    try {
      await printQzHtml(qzState.normal, buildQzTestHtml(settings.company_name || 'Aditya Enterprises'));
      showToast(`Test sent to ${qzState.normal}`);
    } catch (e) {
      showToast('QZ normal print failed: ' + (e.message || 'unknown'), 'error');
    } finally {
      setQzState(s => ({ ...s, busy: false }));
    }
  };

  const connectDirectUsb = async () => {
    setDirectBusy(true);
    try {
      let info;
      if (serialSupported()) info = await connectSerialPrinter(serialBaud);
      else if (usbSupported()) info = await connectUsbPrinter();
      else { showToast('Direct printing needs Chrome or Edge (Web Serial on PC, WebUSB on Android).', 'error'); return; }
      setDirectPrinter(info);
      showToast(`Printer connected: ${info.name}`);
    } catch (err) {
      if (err.name !== 'NotFoundError') showToast(err.message || 'Connection cancelled', 'error');
      else showToast('No printer selected. If the list was empty: install the CH340/CH341 driver, replug the printer, then click Connect again.', 'error');
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

          <div style={{marginBottom:12, padding:10, background:'#eef4ff', borderRadius:8, border:'1px solid #b3c8f0'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap'}}>
              <span style={{fontSize:13, fontWeight:600}}>QZ Tray (thermal + normal printers - recommended)</span>
              <span className={`badge ${qzState.connected ? 'badge-success' : 'badge-danger'}`} style={{fontSize:10}}>
                {qzState.connected ? 'QZ Tray Connected' : 'Not connected'}
              </span>
            </div>
            <div style={{fontSize:11, color:'#555', marginBottom:6}}>
              <strong>One-time setup:</strong> download &amp; install the free <a href="https://qz.io/download" target="_blank" rel="noreferrer" style={{color:'#2c6bdd'}}>QZ Tray</a> app on this PC (Windows/Mac/Linux), run it (it sits near the clock), then press Connect below. Works in any browser, over HTTPS, and prints to BOTH:
              <ul style={{margin:'4px 0 0 18px', padding:0}}>
                <li><strong>Thermal printers</strong> - raw ESC/POS, works even for cheap 58mm/80mm printers <em>without any Windows driver</em> (QZ shows them as "usb:VID_xxxx"). Fixes the "no printer attached" problem.</li>
                <li><strong>Normal paper printers</strong> (HP/Canon/Brother inkjet &amp; laser) - receipts, bills and barcode labels print automatically with no dialog.</li>
              </ul>
            </div>
            {qzState.msg && <div style={{fontSize:11, color:'#7f8c8d', marginBottom:6}}>{qzState.msg}</div>}
            <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:6}}>
              {!qzState.connected ? (
                <button className="btn btn-sm btn-primary" onClick={connectQzTray} disabled={qzState.busy || !qzState.supported}>
                  {qzState.busy ? 'Connecting...' : 'Connect QZ Tray'}
                </button>
              ) : (
                <>
                  <button className="btn btn-sm btn-info" onClick={refreshQzPrinters} disabled={qzState.busy}>Find Printers</button>
                  <button className="btn btn-sm btn-outline" onClick={disconnectQzTray}>Disconnect</button>
                </>
              )}
              {!qzState.supported && <span style={{fontSize:11, color:'#e74c3c'}}>QZ Tray script not loaded - refresh the page (Ctrl+F5) with QZ Tray running.</span>}
            </div>
            {qzState.connected && qzState.printers.length > 0 && (
              <div style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:6}}>
                <div style={{fontSize:11}}>
                  <label style={{display:'block', fontWeight:600, marginBottom:2}}>Thermal printer (receipts &amp; labels)</label>
                  <select value={qzState.thermal} onChange={e => pickQzThermal(e.target.value)} style={{fontSize:12, padding:'4px 6px', minWidth:180}}>
                    <option value="">-- none --</option>
                    {qzState.printers.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  {qzState.thermal && <button className="btn btn-sm btn-success" onClick={testQzThermal} disabled={qzState.busy} style={{marginLeft:6}}>Test</button>}
                </div>
                <div style={{fontSize:11}}>
                  <label style={{display:'block', fontWeight:600, marginBottom:2}}>Normal printer (inkjet/laser)</label>
                  <select value={qzState.normal} onChange={e => pickQzNormal(e.target.value)} style={{fontSize:12, padding:'4px 6px', minWidth:180}}>
                    <option value="">-- none --</option>
                    {qzState.printers.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  {qzState.normal && <button className="btn btn-sm btn-success" onClick={testQzNormal} disabled={qzState.busy} style={{marginLeft:6}}>Test</button>}
                </div>
              </div>
            )}
            <div style={{fontSize:11, color:'#888'}}>
              Pick at least one. Labels &amp; receipts use the thermal printer (fast), and when no thermal is set they fall back to the normal printer automatically.
            </div>
          </div>

          <div style={{marginBottom:12, padding:10, background:'#eafaf1', borderRadius:8, border:'1px solid #a9dfbf'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
              <span style={{fontSize:13, fontWeight:600}}>Direct USB Printing - no install needed</span>
              {directPrinter ? <span className="badge badge-success" style={{fontSize:10}}>Connected</span> : <span className="badge badge-secondary" style={{fontSize:10, background:'#ccc', color:'#333'}}>Not connected</span>}
            </div>
            {directPrinter ? (
              <div style={{fontSize:12, color:'#27ae60', marginBottom:6}}>Connected: <strong>{directPrinter.name}</strong> — labels, receipts &amp; bills print to it automatically</div>
            ) : (
              <div style={{fontSize:11, color:'#555', marginBottom:6}}>
                For <strong>thermal printers</strong> (receipt/label): plug the printer (USB) into this PC/phone and press Connect — the app picks the right way automatically (USB on PC, USB-OTG on Android), no software or bridge. After that, printing is fully automatic: sales, labels, receipts and GST/non-GST bills.
                <div style={{marginTop:4}}>
                  <strong>Normal paper printers</strong> (HP/Canon/Brother...) can't connect this way — they print automatically through their Windows driver using the <strong>USB Bridge</strong> below or the <strong>on-screen Print dialog</strong>.
                </div>
              </div>
            )}
            <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:6}}>
              <button className="btn btn-sm btn-success" onClick={connectDirectUsb} disabled={directBusy || !!directPrinter} title="Shows the browser's device list - pick your printer">
                {directBusy ? 'Connecting...' : (directPrinter ? 'Printer Connected' : 'Connect Printer')}
              </button>
              {!directPrinter && serialSupported() && (
                <select value={serialBaud} onChange={e => setSerialBaud(Number(e.target.value))} style={{fontSize:12, padding:'4px 6px'}} title="Most thermal printers use 9600. Try others if nothing prints.">
                  <option value={9600}>9600 baud</option>
                  <option value={19200}>19200 baud</option>
                  <option value={115200}>115200 baud</option>
                </select>
              )}
              {directPrinter && (
                <>
                  <button className="btn btn-sm btn-warning" onClick={testDirectPrint} disabled={directBusy}>Test Print</button>
                  <button className="btn btn-sm btn-outline" onClick={disconnectDirect} disabled={directBusy}>Disconnect</button>
                </>
              )}
            </div>
            {!directPrinter && (
              <details style={{fontSize:11, color:'#7f8c8d'}}>
                <summary style={{cursor:'pointer'}}>Printer not showing up? Fix it in one click</summary>
                {bridgeStatus.bridgeOnline ? (
                  <div style={{marginTop:6}}>
                    <button className="btn btn-sm btn-warning" onClick={fixDriver} disabled={fixBusy}>
                      {fixBusy ? 'Fixing...' : 'Fix my printer driver'}
                    </button>
                    <div style={{marginTop:4}}>
                      It installs the printer's driver for you - just click "Fix my printer driver". If Windows asks for permission, click Yes. Then unplug the printer, plug it back in, and press Connect Printer.
                    </div>
                  </div>
                ) : (
                  <div style={{marginTop:6}}>
                    The easiest fix: in Windows open <strong>Settings → Windows Update → Check for updates</strong>, let it finish, then restart the PC. The printer's driver installs by itself. If a Windows box asks for permission, click Yes.
                  </div>
                )}
                {fixMsg && <div style={{marginTop:6, color:'#555'}}>{fixMsg}</div>}
              </details>
            )}
            <div style={{fontSize:11, color:'#888'}}>
              Connect once per device - after that the app reconnects automatically and prints with no clicks.
            </div>
          </div>

          <div style={{marginBottom:12, padding:10, background:'#fffbe6', borderRadius:8, border:'1px solid #f1c40f'}}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>Detected printer</div>
            {qzState.connected && (qzState.thermal || qzState.normal) ? (
              <div style={{fontSize:12}}>🖨️ <strong>QZ Tray</strong>: thermal = {qzState.thermal || 'none'}, normal = {qzState.normal || 'none'} — automatic label, receipt &amp; bill printing uses it</div>
            ) : directPrinter ? (
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
              <div style={{fontSize:12, color:'#e74c3c'}}>No printer connected — plug one into this PC/phone and press "Connect Printer" above.</div>
            )}
          </div>

          <details style={{marginBottom:12}}>
            <summary style={{cursor:'pointer', fontSize:13, fontWeight:600, color:'#555'}}>
              Other printing options (Bluetooth · Shop-PC bridge · Windows-driver printers)
            </summary>
            <div style={{padding:'8px 0 0 4px'}}>

          <div style={{marginBottom:12, padding:10, background:'#f8f9fa', borderRadius:8, border:'1px solid #eee'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
              <span style={{fontSize:13, fontWeight:600}}>USB Bridge (printer on a different PC)</span>
              <span className={`badge ${bridgeStatus.bridgeOnline ? 'badge-success' : 'badge-danger'}`} style={{fontSize:10}}>
                {bridgeStatus.bridgeOnline ? 'Bridge Online' : 'Bridge Offline'}
              </span>
            </div>
            <div style={{fontSize:11, color:'#777', marginBottom:6}}>For when the printer stays plugged into a <strong>different</strong> PC than the device you're using. One-time setup on that PC: copy the <strong>print-bridge</strong> folder there and double-click <strong>install-bridge.bat</strong> - it installs everything itself, including the printer driver, and sets the bridge to start with Windows.</div>
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
              Thermal printers (Posiflow etc.) get fast ESC/POS codes, normal printers (HP/Canon/Brother) get a rendered print via the Windows driver. No dialog needed.
            </div>
          </div>

          <div style={{marginBottom:12, padding:10, background:'#f8f9fa', borderRadius:8, border:'1px solid #eee'}}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:6}}>Bluetooth Printer</div>
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
                Pair a Bluetooth thermal printer once (Chrome/Edge) - printer must be ON and in pairing mode.
              </div>
            )}
            {printerStatus && <div style={{fontSize:11, marginTop:4, color:'#777'}}>{printerStatus}</div>}
          </div>

          <div style={{marginBottom:12, padding:10, background:'#f8f9fa', borderRadius:8, border:'1px solid #eee'}}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:6}}>Windows-driver printers (HP/Canon/Brother)</div>
            <div style={{fontSize:11, color:'#777'}}>
              These can't receive raw data from a browser. Use the <strong>Print</strong> button in the POS / Products screen - it opens the browser's print dialog, which prints to any installed printer, including barcodes on labels.
            </div>
          </div>

            </div>
          </details>
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
