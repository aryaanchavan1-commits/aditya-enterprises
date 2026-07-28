import React, { useState, useRef, useEffect } from 'react';

export default function CameraScanner({ onScan, onClose }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [lastCode, setLastCode] = useState('');
  const previewRef = useRef(null);
  const scannerRef = useRef(null);

  const startScanning = async () => {
    setError('');
    setScanning(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('barcode-scanner-preview');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 },
        (decodedText) => {
          setLastCode(decodedText);
          scanner.stop().catch(() => {});
          setScanning(false);
          if (onScan) onScan(decodedText);
        },
        () => {}
      );
    } catch (err) {
      setError(err.message || 'Camera access denied or not supported');
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
