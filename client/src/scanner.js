// Global keyboard-wedge barcode scanner support.
// USB / 2.4GHz / Bluetooth-HID scanners type the code + Enter at ~30-80ms
// per key - far faster than a human can type. We catch that pattern ANYWHERE
// in the app (no focused input needed) and dispatch a custom event
// 'ae-barcode-scan' with the code. Pages listen and act on it.
// When a text field IS focused, we stay out of the way - the scanner types
// into the field normally (e.g. the Scan & Add barcode input or POS search).

const MAX_KEY_GAP_MS = 90;
const MIN_CODE_LEN = 4;

export function startBarcodeScanner() {
  if (typeof window === 'undefined') return () => {};
  let buf = '';
  let lastKeyAt = 0;
  let flushTimer = null;

  const isFormField = () => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  };

  const fire = (code) => {
    if (!code) return;
    window.dispatchEvent(new CustomEvent('ae-barcode-scan', { detail: code }));
  };

  const flush = () => {
    if (buf.length >= MIN_CODE_LEN) fire(buf);
    buf = '';
  };

  const onKeyDown = (e) => {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.isComposing) return;
    const now = Date.now();

    if (e.key === 'Enter') {
      if (buf.length >= MIN_CODE_LEN) {
        e.preventDefault();
        clearTimeout(flushTimer);
        flush();
        lastKeyAt = 0;
        return;
      }
      buf = '';
      lastKeyAt = 0;
      return;
    }

    if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

    if (isFormField()) {
      // Let it type into the focused field; its own handler deals with it.
      buf = '';
      return;
    }

    if (now - lastKeyAt > MAX_KEY_GAP_MS) buf = '';
    buf += e.key;
    lastKeyAt = now;

    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 250);
  };

  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}
