import React, { useState, useRef, useEffect } from 'react';

export default function CameraScanner({ onScan, onClose }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [lastCode, setLastCode] = useState('');
  const previewRef = useRef(null);
  const scannerRef = useRef(null);

  const startScanning = async ({ silent = false } = {}) => {
    setError('');
    setScanning(true);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      // Constructor config: formats + native BarcodeDetector go HERE, not in
      // start() (start() only accepts fps/qrbox/aspectRatio/videoConstraints).
      // useBarCodeDetectorIfSupported uses the phone's built-in BarcodeDetector
      // on Android Chrome - instant decode, no jank. Falls back to zxing on iOS.
      const formats = [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];
      const scanner = new Html5Qrcode('barcode-scanner-preview', {
        verbose: false,
        formatsToSupport: formats,
        useBarCodeDetectorIfSupported: true,
      });
      scannerRef.current = scanner;

      const tryStart = (facing) => scanner.start(
        { facingMode: facing },
        {
          fps: 10, // zxing fallback is slow on phones - 15fps just drops frames
          // No aspectRatio: it causes black video / failed start on many phones.
          qrbox: (vw, vh) => ({
            width: Math.min(280, Math.floor(vw * 0.8)),
            height: Math.min(170, Math.floor(vh * 0.45)),
          }),
          disableFlip: true,
        },
        (decodedText) => {
          const clean = String(decodedText || '').trim();
          setLastCode(clean);
          scanner.stop().catch(() => {});
          setScanning(false);
          if (onScan) onScan(clean);
        },
        () => {}
      );

      try {
        await tryStart('environment');
      } catch (frontErr) {
        // Some tablets/phones only expose a front camera - retry with it
        // before giving up.
        await tryStart('user');
      }
    } catch (err) {
      setScanning(false);
      if (silent) return; // auto-start failed (iOS needs a tap) - no scary error
      let msg = err.message || 'Camera failed to start';
      // Browser names the permission error differently per platform - catch
      // the common ones with an actionable message.
      if (/NotAllowedError|PermissionDenied|permission/i.test(msg)) {
        msg = 'Camera permission was denied. Allow camera access for this site (lock icon in the address bar) and try again.';
      } else if (/NotFoundError|OverconstrainedError|no camera|not found|NotFound/i.test(msg)) {
        msg = 'No rear camera was found on this device.';
      } else if (/NotReadableError|in use|busy|NotReadable/i.test(msg)) {
        msg = 'The camera is being used by another app - close it and try again.';
      } else if (/insecure|https|NotAllowedError/i.test(msg) || (typeof window !== 'undefined' && window.location && window.location.protocol === 'http:' && window.location.hostname !== 'localhost')) {
        msg = 'Camera needs a secure (HTTPS) connection - open this app via the https:// address, not http://';
      }
      setError(msg);
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch (e) {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  // Auto-start the camera when the modal opens - on Android the permission
  // prompt appears immediately and the user just points at the barcode. On
  // iOS the permission needs a tap, so if auto-start fails we just show the
  // Start button (silent - the user hasn't tapped yet).
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      try {
        await startScanning({ silent: true });
      } catch (e) { /* Start button is the fallback */ }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    return () => { stopScanning(); };
  }, []);

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Camera Barcode Scanner</h3>
        <button className="btn btn-sm btn-outline" onClick={onClose}>Close</button>
      </div>

      <div id="barcode-scanner-preview" ref={previewRef} style={{
        width: '100%', maxWidth: 400, height: 300, margin: '0 auto',
        background: '#000', borderRadius: 8, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {!scanning && !lastCode && (
          <div style={{ color: '#fff', fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 8, fontWeight: 300, opacity: 0.5 }}>Camera</div>
            Tap "Start Scanner" to begin
          </div>
        )}
      </div>

      {error && <p style={{ color: '#e74c3c', fontSize: 13, margin: '8px 0' }}>{error}</p>}

      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {!scanning ? (
          <button className="btn btn-primary btn-lg" onClick={startScanning}>Start Scanner</button>
        ) : (
          <button className="btn btn-danger" onClick={stopScanning}>Stop Scanner</button>
        )}
        {lastCode && (
          <div style={{ width: '100%', marginTop: 8 }}>
            <p style={{ fontSize: 13, color: '#555' }}>Scanned: <strong style={{ fontFamily: 'monospace', fontSize: 16, color: '#2c3e50' }}>{lastCode}</strong></p>
            <button className="btn btn-success" onClick={() => { setLastCode(''); }}>Scan Another</button>
          </div>
        )}
      </div>

      <p style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
        Point camera at a barcode. Works best in good lighting. Supported on Chrome/Edge mobile browsers.
      </p>
    </div>
  );
}
