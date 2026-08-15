import React, { useState, useRef, useEffect } from 'react';

// Mobile barcode scanning - three independent decode engines plus photo
// fallback, so it works on virtually every phone:
//   1. BarcodeDetector polyfill (@sec-ant/barcode-detector, ZXing-WASM) - a
//      drop-in for the native BarcodeDetector that accepts the live video
//      element directly and decodes Code128/EAN/UPC/QR on ALL browsers,
//      including iOS Safari and older Android. This is the primary engine.
//   2. Native BarcodeDetector API (instant, built into modern Android Chrome).
//   3. ZXing (@zxing/library) frame pipeline as a final fallback.
//   4. Photo/gallery fallback - snap the barcode and it is decoded from the
//      image, for cases where live camera permission is impossible.
// Camera MUST be started from a tap (iOS Safari blocks getUserMedia outside a
// user gesture) - the big "Start Camera" button guarantees that.

const FORMATS = ['code_128', 'ean_13', 'ean_8', 'code_39', 'code_93', 'upc_a', 'upc_e', 'qr_code'];

// Decode resolution ladder: start small + fast, escalate to hi-res so both
// close-up labels and distant screen barcodes get resolved.
const LEVELS = [
  { maxW: 480, attempts: 3 },       // fast pass - close labels
  { maxW: 800, attempts: 5 },       // mid pass - typical framing
  { maxW: 0, attempts: Infinity }   // native res - small/screen barcodes
];

const DECODE_INTERVAL_MS = 100;     // max ~10 decode attempts per second
const NATIVE_SWITCH_MS = 4000;      // native BarcodeDetector gets 4s, then ZXing takes over
const VIDEO_STALL_MS = 12000;       // if the stream never produces frames, fail loudly

// One shared ZXing decoder (cached module promise so both camera and photo
// paths use the exact same decoder + hints). The returned object is a plain
// decode(text => rgba frame) function - no per-call import overhead.
let decoderPromise = null;
const getDecoder = () => {
  if (!decoderPromise) {
    decoderPromise = import('@zxing/library').then(({ MultiFormatReader, DecodeHintType, BarcodeFormat, RGBLuminanceSource, HybridBinarizer, BinaryBitmap }) => {
      // MultiFormatReader takes NO constructor args - hints must go through
      // setHints(), otherwise the reader runs unhinted (no TRY_HARDER / no
      // format filter) and silently fails on every frame.
      const reader = new MultiFormatReader();
      reader.setHints(new Map([
        [DecodeHintType.TRY_HARDER, true],
        [DecodeHintType.POSSIBLE_FORMATS, FORMATS.map(f => BarcodeFormat[f.toUpperCase()])]
      ]));
      // Decode one RGBA frame. Returns the text or null. reader.reset() after
      // each attempt is required - some decoders keep state between frames.
      // RGBLuminanceSource needs GRAYSCALE bytes (1B/px) or an Int32Array of
      // ARGB ints - a raw RGBA buffer silently decodes nothing. Conversion is
      // the standard Rec.601 luma formula (fast: ~4 adds + shift per px).
      // Alpha is flattened to WHITE: many barcode PNGs (e.g. bwip-js output)
      // have transparent backgrounds that decode as black-on-black otherwise.
      return (rgba, width, height) => {
        try {
          const size = width * height;
          const luma = new Uint8ClampedArray(size);
          for (let i = 0, p = 0; i < size; i++, p += 4) {
            if (rgba[p + 3] < 128) { luma[i] = 255; continue; }
            luma[i] = ((306 * rgba[p] + 601 * rgba[p + 1] + 117 * rgba[p + 2] + 0x200) >> 10) & 0xff;
          }
          const luminance = new RGBLuminanceSource(luma, width, height);
          const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
          const result = reader.decode(bitmap);
          reader.reset();
          return result && result.getText ? result.getText() : (result && result.text) || null;
        } catch (e) {
          try { reader.reset(); } catch (e2) {}
          return null;
        }
      };
    });
  }
  return decoderPromise;
};

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
  const foundRef = useRef(false); // true once a code has been reported this session
  const switchedDecoderRef = useRef(false);
  const startedAtRef = useRef(0);
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
    if (!clean || foundRef.current) return;
    foundRef.current = true;
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
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
    setDecoder('');
    switchedDecoderRef.current = false;
    foundRef.current = false;
  };

  // Own decode loop: BarcodeDetector polyfill first (accepts the live video
  // element directly - ZXing-WASM handles multi-frame binarization), then the
  // native BarcodeDetector, then our ZXing resolution ladder as a last resort.
  const startDecodeLoop = async (video) => {
    let polyfillDetector = null;
    try {
      const { BarcodeDetector: PolyfillBD } = await import('@sec-ant/barcode-detector');
      if (PolyfillBD) {
        polyfillDetector = new PolyfillBD({ formats: FORMATS });
      }
    } catch (e) { polyfillDetector = null; }

    const BarcodeDetectorCtor = window.BarcodeDetector;
    let nativeDetector = null;
    if (BarcodeDetectorCtor) {
      try {
        nativeDetector = await new BarcodeDetectorCtor({ formats: FORMATS });
      } catch (e) {
        try { nativeDetector = new BarcodeDetectorCtor(); } catch (e2) { nativeDetector = null; }
      }
    }

    let decode = null;
    try { decode = await getDecoder(); } catch (e) { decode = null; }

    if (!polyfillDetector && !nativeDetector && !decode) {
      setStatus('error');
      setError('No barcode decoder available on this browser. Try the "From Photo" option.');
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const switchAt = Date.now() + NATIVE_SWITCH_MS;
    let level = 0;
    let missCount = 0;
    let decodeAt = 0;

    const frame = async () => {
      if (!scanningRef.current) return;

      // Stream not producing frames yet - stall watchdog.
      if (video.readyState < 2 || !video.videoWidth) {
        if (Date.now() - startedAtRef.current > VIDEO_STALL_MS) {
          setStatus('error');
          setError('Camera opened but no frames are coming. Tap the lock icon in the address bar, allow Camera, reload, and retry. Or use "From Photo".');
          return;
        }
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      const now = performance.now();
      if (now < decodeAt) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      // Path 1 - BarcodeDetector polyfill on the live video element.
      if (polyfillDetector) {
        setDecoder('BarcodeDetector');
        try {
          const codes = await polyfillDetector.detect(video);
          if (!scanningRef.current) return; // stopped while this frame was in flight
          if (codes && codes.length > 0 && codes[0].rawValue) {
            onDecoded(codes[0].rawValue);
            return;
          }
        } catch (e) {}
      }

      // Path 2 - native BarcodeDetector.
      if (nativeDetector && !switchedDecoderRef.current) {
        setDecoder('native (BarcodeDetector)');
        try {
          const codes = await nativeDetector.detect(video);
          if (!scanningRef.current) return; // stopped while this frame was in flight
          if (codes && codes.length > 0 && codes[0].rawValue) {
            onDecoded(codes[0].rawValue);
            return;
          }
        } catch (e) {}
        if (Date.now() >= switchAt) {
          switchedDecoderRef.current = true;
          setDecoder('ZXing (continuous)');
        } else {
          decodeAt = now + 60;
          rafRef.current = requestAnimationFrame(frame);
          return;
        }
      }

      // Path 3 - ZXing on a downscaled/upscaled canvas frame.
      if (decode) {
        const cfg = LEVELS[Math.min(level, LEVELS.length - 1)];
        const scaleW = cfg.maxW > 0 ? Math.min(cfg.maxW, video.videoWidth) : video.videoWidth;
        const scaleH = Math.max(1, Math.round(scaleW * video.videoHeight / video.videoWidth));
        if (canvas.width !== scaleW || canvas.height !== scaleH) { canvas.width = scaleW; canvas.height = scaleH; }
        try {
          ctx.drawImage(video, 0, 0, scaleW, scaleH);
          const img = ctx.getImageData(0, 0, scaleW, scaleH);
          const text = decode(img.data, scaleW, scaleH);
          if (!scanningRef.current) return; // stopped while this frame was in flight
          if (text) { onDecoded(text); return; }
        } catch (e) {}

        missCount++;
        if (missCount >= cfg.attempts && level < LEVELS.length - 1) {
          level++;
          missCount = 0;
          setDecoder('ZXing (hi-res)');
        }
        decodeAt = now + DECODE_INTERVAL_MS;
      } else {
        decodeAt = now + 120;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  };

  // Start the live camera - MUST be called from a user tap on iOS.
  const startCamera = async () => {
    setError('');
    setStatus('starting');
    scanningRef.current = true;
    foundRef.current = false;
    startedAtRef.current = Date.now();
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

    // Try progressively simpler constraint sets: some Android browsers reject
    // the whole request if ANY advanced constraint is unsupported (e.g.
    // focusMode), so we peel options off one at a time and only give up on
    // the rear camera when every variant has failed.
    const tryFace = async (facing) => {
      const variants = [
        {
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: 'continuous' }]
          },
          audio: false
        },
        {
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        },
        { video: { facingMode: { ideal: facing } }, audio: false }
      ];
      let lastErr = null;
      for (const c of variants) {
        try { return await navigator.mediaDevices.getUserMedia(c); } catch (e) { lastErr = e; }
      }
      throw lastErr || new Error('camera unavailable');
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
    await startDecodeLoop(video);
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

  // Decode a photo/gallery image as a fallback - same decoder + same hints as
  // the live camera, decoded at up to 1600px wide (big enough for tiny bars).
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setStatus('starting');
    let decode = null;
    try { decode = await getDecoder(); } catch (err) {}
    let polyfillDetector = null;
    try {
      const { BarcodeDetector: PolyfillBD } = await import('@sec-ant/barcode-detector');
      if (PolyfillBD) polyfillDetector = new PolyfillBD({ formats: FORMATS });
    } catch (err) {}
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('not an image'));
      });

      // Polyfill accepts the image element directly - most reliable path.
      if (polyfillDetector) {
        try {
          const codes = await polyfillDetector.detect(img);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            onDecoded(codes[0].rawValue);
            return;
          }
        } catch (err2) {}
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const maxW = 1600;
      const w = Math.max(1, Math.min(img.naturalWidth || maxW, maxW));
      const h = Math.max(1, Math.round(w * (img.naturalHeight || w) / (img.naturalWidth || w)));
      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const text = decode ? decode(data.data, w, h) : null;
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (text) { onDecoded(text); return; }
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
        Works on Chrome/Edge/Safari (Android & iPhone) over HTTPS. Powered by BarcodeDetector (ZXing-WASM) and the native Barcode Detection API.
      </p>
    </div>
  );
}
