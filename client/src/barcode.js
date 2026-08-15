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
const CODE_B_TO_C = 99;
const CODE_C_TO_B = 100;
const STOP = 106;

// Encode text to a flat module-width pattern (numbers alternating bar/space,
// starting with a bar). Uses optimal subset switching (B <-> C): runs of 4+
// digits go into subset C (2 digits per symbol) which makes the barcode up to
// 40% shorter - the same encoding the server (bwip-js) produces, so labels
// always fit and scanners read the client barcode exactly like the server one.
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

  let checksum = values[0];
  for (let k = 1; k < values.length; k++) checksum += values[k] * k;
  checksum %= 103;

  const pattern = [];
  for (const v of [...values, checksum, STOP]) {
    pattern.push(...CODE128[v].split('').map(Number));
  }
  return pattern;
}

// Render barcode as a data-URL PNG sized to fit `maxWidthPx`, with a
// "module" of at least 2px (quiet zone = 10 modules each side). Height is
// PROPORTIONAL to the width (~30% + text strip), never a fixed pixel height -
// a fixed height makes short codes come out as giant square images that
// overflow 58mm labels when scaled to a fixed mm width.
export function barcodeDataUrl(text, { maxWidthPx = 900, heightPx = 320, showText = true } = {}) {
  const img = barcodeImageData(text, { maxWidthPx, heightPx, showText });
  return img ? img.dataUrl : '';
}

// Like barcodeDataUrl but also returns the real pixel size, so callers
// (e.g. the PDF generator) can draw it at its true aspect ratio without
// stretching - critical for scannable barcodes.
export function barcodeImageData(text, { maxWidthPx = 900, heightPx = 320, showText = true } = {}) {
  const pattern = encodePattern(text);
  if (!pattern) return null;

const quiet = 10;
   const moduleCount = pattern.reduce((a, b) => a + b, 0);
   const totalModules = quiet * 2 + moduleCount;
   const quietPx = Math.max(20, Math.floor(maxWidthPx * 0.05));
   const module = Math.max(4, Math.floor((maxWidthPx - quietPx * 2) / totalModules));

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
