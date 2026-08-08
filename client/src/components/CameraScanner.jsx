import React, { useState, useRef, useEffect } from 'react';

// Mobile barcode scanning - three independent decode paths, so it works on
// virtually every phone:
//   1. Native BarcodeDetector API (instant, built into Android Chrome)
//   2. ZXing (https://github.com/zxing-js/browser, Apache-2.0) - decodes
//      Code128/EAN/UPC/QR on iOS Safari and any other browser
//   3. Photo/gallery fallback - snap the barcode and it is decoded from the
//      image, for cases where live camera permission is impossible.
// Camera MUST be started from a tap (iOS Safari blocks getUserMedia outside a
// user gesture) - the big "Start Camera" button guarantees that.

const FORMATS = ['code_128', 'ean_13', 'ean_8', 'code_39', 'code_93', 'upc_a', 'upc_e', 'qr_code'];

export default function CameraScanner({ onScan, onClose }) {
  const [status, setStatus] = useState('idle'); // idle | starting | running | error
  const [error, setError] = useState('');
  const [lastCode, setLastCode] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [decoder, setDecoder] = useState(''); // which engine is decoding
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const scanningRef = useRef(false);
  const zxingControlsRef = useRef(null);
  const decodeStartedAtRef = useRef(0);
  const switchedDecoderRef = useRef(false);
  const fileRef = useRef(null);

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
    setStatus('idle');
    stopCamera();
    if (onScan) onScan(clean);
  };

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (zxingControlsRef.current) {
      try { zxingControlsRef.current.stop(); } catch (e) {}
      zxingControlsRef.current = null;
    }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
    setDecoder('');
    switchedDecoderRef.current = false;
  };

  // Decode loop: native BarcodeDetector first, ZXing fallback.
  // NOTE: ZXing's decodeFromVideoElement() manages its own internal continuous
  // decode loop - it MUST be started only once and stopped via its controls.
  // Calling decodeOnceFromVideoElement() repeatedly stacks unbounded parallel
  // decode loops that choke the browser. We start it once and let its callback
  // fire on every scan attempt.
  //
  // A watchdog guarantees a decode path always works: if the native
  // BarcodeDetector produces nothing within 6s (some Android devices expose it
  // but never actually detect), we switch to the ZXing continuous loop.
  const startDecodeLoop = async () => {
    const video = videoRef.current;
    if (!video) return;

    const BarcodeDetectorCtor = window.BarcodeDetector;
    let detector = null;
    if (BarcodeDetectorCtor) {
      try {
        detector = await new BarcodeDetectorCtor({ formats: FORMATS });
      } catch (e) {
        try { detector = new BarcodeDetectorCtor(); } catch (e2) { detector = null; }
      }
    }

    // ZXing is ALWAYS loaded (even when BarcodeDetector exists) so the
    // watchdog can fall back to it if native never produces a result.
    let zxingReader = null;
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const { DecodeHintType, BarcodeFormat } = await import('@zxing/library');
      zxingReader = new BrowserMultiFormatReader(
        new Map([
          [DecodeHintType.TRY_HARDER, true],
          [DecodeHintType.POSSIBLE_FORMATS, FORMATS.map(f => BarcodeFormat[f.toUpperCase()])]
        ]),
        200 // scan attempt every 200ms for snappier detection
      );
    } catch (e) {
      zxingReader = null;
    }

    const startZxing = async () => {
      const v = videoRef.current;
      if (!v) return;
      if (!zxingReader) {
        // ZXing failed to load - surface it instead of scanning nothing.
        setStatus('error');
        setError('Barcode decoder could not be loaded. Try the "From Photo" option.');
        return;
      }
      if (zxingControlsRef.current) return;
      const cb = (result, err, controls) => {
        if (!scanningRef.current) { try { controls.stop(); } catch (e) {} return; }
        if (result && result.getText) {
          onDecoded(result.getText());
          try { controls.stop(); } catch (e) {}
        }
      };
      try {
        zxingControlsRef.current = await zxingReader.decodeFromVideoElement(v, cb);
      } catch (e) {
        setTimeout(() => { if (scanningRef.current && videoRef.current && !zxingControlsRef.current) startZxing(); }, 300);
      }
    };

    if (detector) {
      // Path 1 - native BarcodeDetector: light rAF loop, one detect() per frame.
      setDecoder('native (BarcodeDetector)');
      // Watchdog: if nothing decoded within 6s, fall back to ZXing.
      const switchAt = Date.now() + 6000;
      const frame = async () => {
        if (!scanningRef.current) return;
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            onDecoded(codes[0].rawValue);
            return;
          }
        } catch (e) {}
        if (Date.now() >= switchAt && !switchedDecoderRef.current) {
          switchedDecoderRef.current = true;
          setDecoder('ZXing (continuous)');
          startZxing();
          return; // ZXing loop now owns decoding; stop the rAF loop
        }
        rafRef.current = requestAnimationFrame(frame);
      };
      rafRef.current = requestAnimationFrame(frame);
      return;
    }

    if (zxingReader) {
      // Path 2 - ZXing: one continuous loop, callback fires after every attempt.
      setDecoder('ZXing (continuous)');
      await startZxing();
      return;
    }

    setStatus('error');
    setError('No barcode decoder available on this browser. Try the "From Photo" option.');
  };

  // Start the live camera - MUST be called from a user tap on iOS.
  const startCamera = async () => {
    setError('');
    setStatus('starting');
    scanningRef.current = true;
    const video = videoRef.current;
    if (!video) { setStatus('error'); setError('Scanner view not ready - tap Start again.'); return; }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('error');
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        setError('Camera needs HTTPS. Open this app via https:// (not http://) - e.g. https://aditya-enterprises-erp.vercel.app');
      } else {
        setError('This browser does not support camera access. Use the "From Photo" option instead.');
      }
      scanningRef.current = false;
      return;
    }

    const tryFace = async (facing) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      return stream;
    };

    let stream = null;
    try {
      stream = await tryFace('environment');
    } catch (envErr) {
      try {
        stream = await tryFace('user'); // some tablets have only a front camera
      } catch (frontErr) {
        // Last resort: no facing preference at all (some Android devices
        // reject facingMode entirely and only accept a bare video: true)
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (finalErr) {
          setStatus('error');
          setError('Camera could not be opened. Check the lock icon in the address bar -> allow Camera -> reload, then tap Start again. Or use "From Photo".');
          scanningRef.current = false;
          return;
        }
      }
    }

    // Android quirk: the stream's actual video track may be dead if the device
    // resolved facingMode to a camera without live frames. Verify we have a
    // working track and prefer the one labeled "back" if multiple exist.
    try {
      const tracks = stream.getVideoTracks();
      const back = tracks.find(t => /back|rear/i.test(t.label)) || tracks[0];
      if (back && back !== tracks[0]) {
        tracks.forEach(t => { if (t !== back) t.stop(); });
      }
    } catch (e) {}

    streamRef.current = stream;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.muted = true; // must be muted + playsinline for iOS
    video.srcObject = stream;
    try { await video.play(); } catch (e) {}

    const track = stream.getVideoTracks()[0];
    try {
      const caps = track.getCapabilities?.();
      if (caps && caps.torch) { setTorchSupported(true); setTorchOn(false); }
    } catch (e) {}

    setStatus('running');
    await startDecodeLoop();
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
    scanningRef.current = false;
    stopCamera();
  };

  // Decode a photo/gallery image as a fallback.
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setStatus('starting');
    try {
      const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library')
      ]);
      const reader = new BrowserMultiFormatReader(
        new Map([
          [DecodeHintType.TRY_HARDER, true],
          [DecodeHintType.POSSIBLE_FORMATS, FORMATS.map(f => BarcodeFormat[f.toUpperCase()])]
        ])
      );
      const url = URL.createObjectURL(file);
      try {
        const result = await reader.decodeFromImageUrl(url);
        if (result && result.getText) {
          onDecoded(result.getText());
          return;
        }
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setStatus('error');
      setError('No barcode could be read from that photo. Retake it in sharp, bright light, filling the frame.');
    } catch (err) {
      setStatus('error');
      setError('No barcode could be read from that photo. Retake it in sharp, bright light, filling the frame.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  useEffect(() => {
    return () => { scanningRef.current = false; stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {status !== 'running' && (
          <button
            onClick={startCamera}
            style={{
              position: 'absolute', inset: 0, border: 0, cursor: 'pointer',
              color: '#fff', background: 'rgba(0,0,0,0.75)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontFamily: 'inherit'
            }}
          >
            <span style={{ fontSize: 42, marginBottom: 8 }}>📷</span>
            <strong style={{ fontSize: 18, marginBottom: 4 }}>{status === 'starting' ? 'Starting camera…' : status === 'error' ? 'Camera failed - tap to retry' : 'Tap to Start Camera'}</strong>
            <span style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Point at the barcode and hold steady</span>
          </button>
        )}
        {status === 'running' && (
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, background: 'rgba(255,80,80,0.85)', boxShadow: '0 0 8px rgba(255,0,0,.6)' }} />
        )}
      </div>

      {status === 'running' && (
        <p style={{ fontSize: 12, color: '#2ecc71', margin: '8px 0 0' }}>● Scanning - point the camera at the barcode…{decoder ? <span style={{ color: '#888' }}> (via {decoder})</span> : ''}</p>
      )}
      {error && <p style={{ color: '#e74c3c', fontSize: 13, margin: '8px 0' }}>{error}</p>}

      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {status === 'running' ? (
          <>
            <button className="btn btn-danger" onClick={stopScanning}>Stop Camera</button>
            {torchSupported && (
              <button className={`btn ${torchOn ? 'btn-warning' : 'btn-outline'}`} onClick={toggleTorch}>
                {torchOn ? 'Torch On' : 'Torch'}
              </button>
            )}
          </>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={startCamera} disabled={status === 'starting'}>
            {status === 'starting' ? 'Starting…' : 'Start Scanner'}
          </button>
        )}
        <button className="btn btn-outline" onClick={() => fileRef.current?.click()}>📄 From Photo</button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        {lastCode && (
          <div style={{ width: '100%', marginTop: 8 }}>
            <p style={{ fontSize: 13, color: '#555' }}>Scanned: <strong style={{ fontFamily: 'monospace', fontSize: 16, color: '#2c3e50' }}>{lastCode}</strong></p>
          </div>
        )}
      </div>

      <p style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
        Works on Chrome/Edge/Safari (Android & iPhone) over HTTPS. Powered by the browser's native BarcodeDetector and ZXing (open-source).
      </p>
    </div>
  );
}
