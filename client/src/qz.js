// QZ Tray (free desktop app from https://qz.io/download) printing support.
// QZ Tray sits in the Windows taskbar and lets this website - from ANY
// browser, even over HTTPS - print to:
//   - Thermal receipt/label printers  - raw ESC/POS, works for cheap 58mm/80mm
//     printers WITHOUT a Windows driver (QZ lists them as "usb:VID_xxxx").
//     This fixes the "No Printer Attached / ghost driver" problem.
//   - Normal paper printers (HP inkjet, Canon, Brother...) - rendered HTML.
// Pair once in Settings -> QZ Tray: connect, list printers, pick the thermal
// and normal printer. After that printing is automatic like the USB bridge.

import { barcodeDataUrl } from './barcode';

const THERMAL_KEY = 'ae_qz_thermal_printer';
const NORMAL_KEY = 'ae_qz_normal_printer';

const VIRTUAL = /pdf|microsoft print to|xps|fax|onenote|snagit|pdf24|dopdf|print to file/i;

export function qzSupported() {
  return typeof qz !== 'undefined' && !!qz && !!qz.websocket;
}

// Connect to the local QZ Tray app. Must be reachable during the page load.
// Retries a few times because QZ Tray can lag slightly on wake.
let connectPromise = null;

export async function connectQz() {
  if (!qzSupported()) {
    throw new Error('QZ Tray not loaded in this page. Reload the app with QZ Tray running.');
  }
  if (qz.websocket.isActive()) return true;
  if (connectPromise) return connectPromise;
  connectPromise = qz.websocket.connect()
    .then(() => true)
    .catch((e) => {
      connectPromise = null;
      const msg = (e && e.message) ? e.message : String(e);
      if (/certificate|trust|signature|untrusted/i.test(msg)) {
        throw new Error('QZ Tray is running but this website is not trusted yet. In QZ Tray (taskbar icon) open Settings and add "aditya-enterprises-erp.vercel.app" to the whitelist, then try again.');
      }
      throw new Error('Cannot reach QZ Tray on this PC. Is the QZ Tray app running? (look for its icon near the clock). Error: ' + msg);
    });
  try {
    await connectPromise;
    return true;
  } finally {
    setTimeout(() => { connectPromise = null; }, 3000);
  }
}

export async function disconnectQz() {
  if (qzSupported() && qz.websocket.isActive()) {
    try { await qz.websocket.disconnect(); } catch (e) {}
  }
}

export function qzConnected() {
  return qzSupported() && qz.websocket.isActive();
}

// List the printers QZ Tray can see. Returns [{name}]. Filters out the
// built-in virtual "print to PDF / XPS" devices so they don't confuse users.
export async function listQzPrinters() {
  await connectQz();
  const printers = await qz.printers.list();
  return (printers || [])
    .map((p) => (typeof p === 'string' ? { name: p } : p))
    .filter((p) => p && p.name && !VIRTUAL.test(p.name));
}

export function getQzThermal() {
  try { return localStorage.getItem(THERMAL_KEY) || ''; } catch (e) { return ''; }
}

export function saveQzThermal(name) {
  try {
    if (name) localStorage.setItem(THERMAL_KEY, name);
    else localStorage.removeItem(THERMAL_KEY);
  } catch (e) {}
}

export function getQzNormal() {
  try { return localStorage.getItem(NORMAL_KEY) || ''; } catch (e) { return ''; }
}

export function saveQzNormal(name) {
  try {
    if (name) localStorage.setItem(NORMAL_KEY, name);
    else localStorage.removeItem(NORMAL_KEY);
  } catch (e) {}
}

// ---- printers actually usable right now (QZ connected) ----

// base64-encode a byte array for QZ (which is a USB type that Chrome ESLint
// doesn't know about, so we hand-roll it).
function bytesToBase64(bytes) {
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return btoa(bin);
}

// Push raw ESC/POS bytecodes straight to the printer. Works for thermal
// printers even with no Windows driver (name like "usb:VID_6868&PID_0200").
export async function printQzRaw(printerName, bytes) {
  await connectQz();
  const config = qz.configs.create(printerName, { jobName: 'Aditya ERP Print' });
  await qz.print(config, [{ type: 'raw', format: 'base64', data: bytesToBase64(bytes) }]);
}

// Send a styled HTML page to a normal paper printer (inkjet/laser).
export async function printQzHtml(printerName, html) {
  await connectQz();
  const config = qz.configs.create(printerName, { jobName: 'Aditya ERP Print' });
  await qz.print(config, [{ type: 'html', format: 'plain', data: html }]);
}

// ---------- HTML builders for normal-paper printers ----------

export function buildQzReceiptHtml(payload = {}) {
  const {
    companyName = '', address = '', invoiceNumber = '', date = '', customer = '',
    items = [], subtotal = 0, gstAmount = 0, grandTotal = 0,
    isGst = true, gstin = '', customerGstin = '', gstRate = 18,
  } = payload;
  const rows = items.map((it) => {
    const nm = String(it.product_name || it.pname || it.name || '') || 'Item';
    const qty = Number(it.quantity) || 1;
    const price = Number(it.sell_price || it.price || 0);
    const lineTotal = qty * price;
    return `
      <div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0">
        <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${nm}</div>
        <div style="flex:0 0 46px;text-align:right">${qty}</div>
        <div style="flex:0 0 96px;text-align:right">Rs.${lineTotal.toFixed(2)}</div>
      </div>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  body { font-family:'Courier New',monospace; font-size:12px; color:#000; margin:0; }
  .rc { max-width:320px; margin:0 auto; }
  .c { text-align:center; }
  h1 { font-size:17px; margin:4px 0 2px; }
  .sep { border-top:1px dashed #000; margin:6px 0; }
  .row { display:flex; justify-content:space-between; gap:8px; padding:2px 0; }
  .total { font-weight:bold; display:flex; justify-content:space-between; padding:4px 0; border-top:1px dashed #000; }
  .tl { border-top:1px dashed #000; }
</style></head><body><div class="page">
  <div class="c">
    <h1>${companyName}</h1>
    ${address ? `<div>${address}</div>` : ''}
    ${isGst && gstin ? `<div>GSTIN: ${gstin}</div>` : ''}
    <div style="margin-top:4px">&nbsp;</div>
  </div>
  <div class="row"><span>Invoice: ${invoiceNumber}</span></div>
  <div class="row"><span>Date: ${date}</span></div>
  <div class="row"><span>Customer: ${customer}</span></div>
  ${isGst && customerGstin ? `<div class="row"><span>GSTIN: ${customerGstin}</span></div>` : ''}
  <div class="sep"></div>
  <div class="row" style="font-weight:bold"><span>Item</span><span>Qty</span><span>Amount</span></div>
  <div class="sep"></div>
  ${rows}
  <div class="sep"></div>
  <div class="row"><span>Subtotal</span><span>Rs.${Number(subtotal).toFixed(2)}</span></div>
  ${isGst ? `<div class="row"><span>GST @${gstRate}%</span><span>Rs.${Number(gstAmount).toFixed(2)}</span></div>` : ''}
  <div class="total"><span>TOTAL</span><span>Rs.${Number(grandTotal).toFixed(2)}</span></div>
  <div class="sep"></div>
  <div class="c">Thank you! Visit again.</div>
</div></body></html>`;
}

export function buildQzLabelHtml(payload = {}) {
  const { name = '', price = 0, barcode = '', sku = '', copies = 1 } = payload;
  let img = '';
  if (barcode) img = barcodeDataUrl(String(barcode), { maxWidthPx: 420, heightPx: 140, showText: true });
  const content = `
    <div style="text-align:center;padding:4px;font-family:Arial,sans-serif">
      <div style="font-size:13px;font-weight:bold;margin-bottom:2px">${name}</div>
      <div style="font-size:15px;font-weight:bold;margin-bottom:4px">Rs.${Number(price || 0).toLocaleString('en-IN')}</div>
      ${img ? `<img src="${img}" style="width:220px;height:auto;display:block;margin:0 auto" />` : ''}
      <div style="font-size:10px;margin-top:2px">${sku || ''}</div>
    </div>`;
  let out = '';
  const n = Math.max(1, Number(copies) || 1);
  out += '<html><head><meta charset="utf-8"></head><body style="margin:0">';
  for (let i = 0; i < n; i++) out += content;
  out += '</body></html>';
  return out;
}

export function buildQzTestHtml(companyName = 'Aditya Enterprises') {
  return `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Courier New',monospace;margin:8px">
  <h2>${companyName}</h2>
  <p>QZ Tray test print - normal paper printer.</p>
  <table><tr><td>Printer:</td><td><strong>This inkjet/laser printer</strong></td></tr></table>
  <div style="margin-top:24px;border:2px solid #000;padding:6px;width:200px;text-align:center;font-weight:bold">OK &mdash; it works!</div>
</body></html>`;
}