import React, { useState, useRef, useEffect } from 'react';

// Mobile barcode scanning via ZXing (https://github.com/zxing-js/browser,
// Apache-2.0) - the most battle-tested open-source barcode engine. Used when
// no physical scanner machine is available: point the phone camera at a
// barcode and it decodes Code128/EAN/UPC/QR reliably on both Android and iOS.
// Torch + beep + vibration give shop-floor feedback without looking at the
// screen.

export default function CameraScanner({ onScan, onClose }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [lastCode, setLastCode] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(false);

  const beep = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 1200; osc.type = 'square';
      gain.gain.value = 0.15;
      osc.start(); osc.stop(0.15);
      setTimeout(() => ctx.close().catch(() => {}), 300);
    } catch (e) {}
  };

  const onDecoded = (text) => {
    const clean = String(text || '').trim();
    if (!clean || scanningRef.current) return;
    scanningRef.current = true;
    try { if (navigator.vibrate) navigator.vibrate(120); } catch (e) {}
    beep();
    setLastCode(clean);
    setScanning(false);
    if (controlsRef.current) { try { controlsRef.current.stop(); } catch (e) {} controlsRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (onScan) onScan(clean);
  };

  const startScanning = async ({ silent = false } = {}) => {
    setError('');
    setScanning(true);
    setLastCode('');
    try {
      // Loaded on demand so the main bundle stays small.
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.QR_CODE,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints);
      const video = videoRef.current;
      if (!video) throw new Error('Scanner view not ready');

      // Rear camera first; some tablets/phones only expose the front one.
      const tryStart = async (facing) => {
        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: facing,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          video,
          (result) => onDecoded(result?.getText?.() || ''),
          () => {} // per-frame error, ignore
        );
        controlsRef.current = controls;
        const stream = video.srcObject;
        streamRef.current = stream;
        const track = stream?.getVideoTracks?.()[0];
        try {
          const caps = track?.getCapabilities?.();
          if (caps && caps.torch) { setTorchSupported(true); setTorchOn(false); }
        } catch (e) {}
        try { await video.play(); } catch (e) {}
      };

      try {
        await tryStart({ ideal: 'environment' });
      } catch (frontErr) {
        await tryStart({ ideal: 'user' });
      }
    } catch (err) {
      setScanning(false);
      if (silent) return; // auto-start failed (iOS needs a tap) - no scary error
      let msg = err.message || 'Camera failed to start';
      if (/NotAllowedError|PermissionDenied|permission/i.test(msg)) {
        msg = 'Camera permission was denied. Allow camera access for this site (lock icon in the address bar) and try again.';
      } else if (/NotFoundError|OverconstrainedError|no camera|not found|NotFound/i.test(msg)) {
        msg = 'No camera was found on this device.';
      } else if (/NotReadableError|in use|busy|NotReadable/i.test(msg)) {
        msg = 'The camera is being used by another app - close it and try again.';
      } else if (/insecure|https|NotAllowedError/i.test(msg) || (typeof window !== 'undefined' && window.location && window.location.protocol === 'http:' && window.location.hostname !== 'localhost')) {
        msg = 'Camera needs a secure (HTTPS) connection - open this app via the https:// address, not http://';
      }
      setError(msg);
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (e) {
      setError('Torch not supported on this camera');
    }
  };

  const stopScanning = () => {
    if (controlsRef.current) { try { controlsRef.current.stop(); } catch (e) {} controlsRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    scanningRef.current = false;
    setScanning(false);
    setTorchOn(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // Auto-start when the modal opens (Android: instant; iOS: needs a tap so it
  // silently falls back to the Start button).
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      try { await startScanning({ silent: true }); } catch (e) {}
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

      <div style={{
        width: '100%', maxWidth: 400, height: 300, margin: '0 auto',
        background: '#000', borderRadius: 8, overflow: 'hidden', position: 'relative'
      }}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {!scanning && !lastCode && (
          <div style={{ color: '#fff', fontSize: 14, position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
            <div style={{ fontSize: 36, marginBottom: 8, fontWeight: 300, opacity: 0.5 }}>Camera</div>
            Tap "Start Scanner" to begin
          </div>
        )}
        {scanning && (
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, background: 'rgba(255,80,80,0.85)', boxShadow: '0 0 8px rgba(255,0,0,.6)' }} />
        )}
      </div>

      {error && <p style={{ color: '#e74c3c', fontSize: 13, margin: '8px 0' }}>{error}</p>}

      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {!scanning ? (
          <button className="btn btn-primary btn-lg" onClick={startScanning}>Start Scanner</button>
        ) : (
          <>
            <button className="btn btn-danger" onClick={stopScanning}>Stop Scanner</button>
            {torchSupported && (
              <button className={`btn ${torchOn ? 'btn-warning' : 'btn-outline'}`} onClick={toggleTorch}>
                {torchOn ? 'Torch On' : 'Torch'}
              </button>
            )}
          </>
        )}
        {lastCode && (
          <div style={{ width: '100%', marginTop: 8 }}>
            <p style={{ fontSize: 13, color: '#555' }}>Scanned: <strong style={{ fontFamily: 'monospace', fontSize: 16, color: '#2c3e50' }}>{lastCode}</strong></p>
            <button className="btn btn-success" onClick={() => { setLastCode(''); scanningRef.current = false; startScanning(); }}>Scan Another</button>
          </div>
        )}
      </div>

      <p style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
        Point camera at a barcode. Works best in good lighting. Powered by ZXing (open-source barcode engine). Supported on Chrome/Edge/Safari mobile.
      </p>
    </div>
  );
}
