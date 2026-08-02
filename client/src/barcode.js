// Client-side Code128 barcode renderer.
// Generates a crisp barcode as a data-URL PNG so labels always show and
// print perfectly - no web fonts, no network, no server files needed.

// Canonical Code 128 symbol table (index = symbol value, string = bar/space
// widths, alternating starting with a bar). Index 106 is the stop symbol.
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
const STOP = 106;

// Encode text to a flat module-width pattern (numbers alternating bar/space,
// starting with a bar). Uses subset C for even-length numeric codes (shorter
// barcode) and subset B otherwise.
export function encodePattern(text) {
  const t = String(text);
  if (!t) return null;

  const useC = /^\d+$/.test(t) && t.length % 2 === 0;
  const start = useC ? START_C : START_B;
  const values = [];

  if (useC) {
    for (let i = 0; i < t.length; i += 2) values.push(parseInt(t.slice(i, i + 2), 10));
  } else {
    for (let i = 0; i < t.length; i++) {
      const code = t.charCodeAt(i);
      if (code < 32 || code > 126) return null;
      values.push(code - 32);
    }
  }

  let checksum = start;
  values.forEach((v, i) => { checksum += v * (i + 1); });
  checksum %= 103;

  const pattern = [];
  for (const v of [start, ...values, checksum, STOP]) {
    pattern.push(...CODE128[v].split('').map(Number));
  }
  return pattern;
}

// Render barcode as a data-URL PNG sized to fit `maxWidthPx`, with a
// "module" of at least 2px (quiet zone = 10 modules each side).
export function barcodeDataUrl(text, { maxWidthPx = 900, heightPx = 320, showText = true } = {}) {
  const pattern = encodePattern(text);
  if (!pattern) return '';

  const quiet = 10;
  const totalModules = quiet * 2 + pattern.length;
  const quietPx = Math.max(20, Math.floor(maxWidthPx * 0.03));
  const module = Math.max(2, Math.floor((maxWidthPx - quietPx * 2) / totalModules));

  const canvas = document.createElement('canvas');
  canvas.width = quietPx * 2 + pattern.length * module;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const barHeight = showText ? heightPx - Math.floor(heightPx * 0.09) : heightPx;
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
    ctx.fillText(String(text), canvas.width / 2, heightPx - 4);
  }

  return canvas.toDataURL('image/png');
}
