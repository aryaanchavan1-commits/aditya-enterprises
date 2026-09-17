// Client-side barcode renderer.
// Generates crisp UPC-A (12-digit) barcodes as data-URL PNGs for labels.
// Falls back to Code128 for non-UPC-A barcodes.

// ── UPC-A encoding ──────────────────────────────────────────────────

// L-codes (left half, odd parity): each entry is [space, bar, space, bar] widths
const UPCA_L = [
  [3,2,1,1], [2,2,2,1], [2,1,2,2], [1,4,1,1], [1,1,3,2],
  [1,2,3,1], [1,1,1,4], [1,3,1,2], [1,2,1,3], [3,1,1,2],
];

// R-codes (right half, even parity): each entry is [bar, space, bar, space] widths
const UPCA_R = [
  [3,2,1,1], [2,2,2,1], [2,1,2,2], [1,4,1,1], [1,1,3,2],
  [1,2,3,1], [1,1,1,4], [1,3,1,2], [1,2,1,3], [3,1,1,2],
];

// Calculate UPC-A check digit for 11 data digits.
export function upcaCheckDigit(digits11) {
  const d = String(digits11).split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += d[i] * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

// Generate a random 12-digit UPC-A code (number system 0).
export function randomUpca() {
  let d = '0';
  for (let i = 0; i < 9; i++) d += Math.floor(Math.random() * 10);
  d += upcaCheckDigit(d);
  return d;
}

// Validate a 12-digit UPC-A string (digits only, correct check digit).
export function isValidUpca(code) {
  if (!/^\d{12}$/.test(code)) return false;
  return Number(code[11]) === upcaCheckDigit(code.slice(0, 11));
}

// Check if a barcode value should be rendered as UPC-A.
export function isUpca(text) {
  return /^\d{12}$/.test(String(text));
}

// Encode a 12-digit UPC-A string into a flat module-width pattern
// (alternating bar/space widths starting with a bar).  Returns null on
// invalid input.
export function encodeUpca(text) {
  const t = String(text);
  if (!/^\d{12}$/.test(t)) return null;

  const digits = t.split('').map(Number);
  const pattern = [];

  // Start guard: 101
  pattern.push(1, 1, 1);

  // Left 6 digits (L-codes, start with space)
  for (let i = 0; i < 6; i++) pattern.push(...UPCA_L[digits[i]]);

  // Center guard: 01010
  pattern.push(1, 1, 1, 1, 1);

  // Right 6 digits (R-codes, start with bar)
  for (let i = 6; i < 12; i++) pattern.push(...UPCA_R[digits[i]]);

  // End guard: 101
  pattern.push(1, 1, 1);

  return pattern;
}

// ── Code128 encoding (fallback for non-UPC-A barcodes) ──────────────

const CODE128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

const START_B = 104;
const START_C = 105;
const CODE_B_TO_C = 99;
const CODE_C_TO_B = 100;
const STOP = 106;

export function encodePattern(text) {
  const t = String(text);
  if (!t) return null;

  const values = [];
  let mode = 'B';
  if (/^\d+$/.test(t) && t.length % 2 === 0) { values.push(START_C); mode = 'C'; }
  else values.push(START_B);

  let i = 0;
  while (i < t.length) {
    if (mode === 'C') {
      if (i + 1 < t.length && /\d/.test(t[i]) && /\d/.test(t[i + 1])) {
        values.push(parseInt(t.slice(i, i + 2), 10));
        i += 2;
      } else {
        values.push(CODE_C_TO_B);
        mode = 'B';
      }
    } else {
      const run = t.slice(i).match(/^\d+/);
      if (run && run[0].length >= 4) {
        let r = run[0];
        if (r.length % 2 === 1) r = r.slice(0, -1);
        values.push(CODE_B_TO_C);
        mode = 'C';
        for (let j = 0; j < r.length; j += 2) values.push(parseInt(r.slice(j, j + 2), 10));
        i += r.length;
      } else {
        const c = t.charCodeAt(i);
        if (c < 32 || c > 126) return null;
        values.push(c - 32);
        i++;
      }
    }
  }

  let checksum = 0;
  for (let k = 0; k < values.length; k++) checksum += values[k] * (k + 1);
  checksum %= 103;

  const pattern = [];
  for (const v of [...values, checksum, STOP]) {
    pattern.push(...CODE128[v].split('').map(Number));
  }
  return pattern;
}

// ── Unified renderer ────────────────────────────────────────────────

// Render barcode as a data-URL PNG.  Auto-detects UPC-A (12 digits)
// and renders with the correct structure; falls back to Code128.
export function barcodeDataUrl(text, { maxWidthPx = 900, heightPx = 320, showText = true } = {}) {
  const img = barcodeImageData(text, { maxWidthPx, heightPx, showText });
  return img ? img.dataUrl : '';
}

// Like barcodeDataUrl but also returns the real pixel size, so callers
// (e.g. the PDF generator) can draw it at its true aspect ratio.
export function barcodeImageData(text, { maxWidthPx = 900, heightPx = 320, showText = true } = {}) {
  const t = String(text || '');
  const pattern = isUpca(t) ? encodeUpca(t) : encodePattern(t);
  if (!pattern) return null;

  // UPC-A quiet zone: 11 modules each side (spec minimum 9, use 11 for safety)
  // Code128 quiet zone: 10 modules each side
  const QUIET_MODULES = isUpca(t) ? 11 : 10;
  const moduleCount = pattern.reduce((a, b) => a + b, 0);
  const totalModules = QUIET_MODULES * 2 + moduleCount;
  const module = Math.max(4, Math.floor(maxWidthPx / totalModules));
  const quietPx = QUIET_MODULES * module;

  const canvas = document.createElement('canvas');
  canvas.width = quietPx * 2 + moduleCount * module;
  const ratio = showText ? 0.40 : 0.35;
  canvas.height = Math.min(heightPx, Math.max(60, Math.round(canvas.width * ratio)));
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const barHeight = showText ? canvas.height - Math.floor(canvas.height * 0.09) : canvas.height;
  ctx.fillStyle = '#000000';
  let x = quietPx;
  let isBar = true;
  for (const m of pattern) {
    if (isBar) ctx.fillRect(x, 0, m * module, barHeight);
    x += m * module;
    isBar = !isBar;
  }

  if (showText) {
    ctx.fillStyle = '#000000';
    ctx.font = `${Math.max(10, Math.floor(module * 3))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(text), canvas.width / 2, canvas.height - 4);
  }

  return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}
