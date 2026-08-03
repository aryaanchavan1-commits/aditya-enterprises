// Aditya ERP - USB Print Bridge
// Runs on the shop PC. Polls the ERP server for print jobs and prints them
// raw (ESC/POS) to the USB-connected thermal printer via its Windows share.
// No npm dependencies - just Node.js 14+.
//
// One-time setup:
//   1. Windows: right-click the printer -> Printer properties -> Sharing ->
//      tick "Share this printer" (note the share name).
//   2. Run start-bridge.bat and keep the window open.
//   3. In the web app: Settings -> Printers -> "Test Print via USB".

'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, execSync } = require('child_process');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const API = (process.env.AE_API || 'https://aditya-enterprises-erp.vercel.app').replace(/\/+$/, '');
const POLL_MS = 3000;

let config = { printerName: '', printerShare: '' };
let lastReportAt = 0;

// Tell the ERP server which printer this bridge detected, so the Settings
// page can show it even though the API runs in the cloud.
async function reportStatus(force) {
  if (!force && Date.now() - lastReportAt < 15000) return;
  lastReportAt = Date.now();
  await apiRequest('POST', '/api/devices/print/bridge/report', {
    printerName: config.printerName || '',
    printerShare: config.printerShare || '',
    version: 'bridge-2.0',
    lastError: config.lastError || ''
  });
}

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

// ---------------- HTTP helpers ----------------

function apiRequest(method, pathUrl, body) {
  return new Promise(resolve => {
    const lib = API.startsWith('https') ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const req = lib.request(API + pathUrl, {
      method,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
      timeout: 20000
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ success: false, error: 'Bad response' }); }
      });
    });
    req.on('error', e => resolve({ success: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------- Windows printer detection ----------------

// Real hardware printers only - ignore virtual ones (OneNote, PDF, Fax...)
const VIRTUAL_PRINTERS = ['onenote', 'print to pdf', 'microsoft print to pdf', 'fax', 'xps', 'pdf24', 'adobe', 'microsoft software printer', 'one drive', 'save as'];

function detectPrinters() {
  try {
    const out = execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      "Get-CimInstance Win32_Printer | Select-Object Name, ShareName, Default | ConvertTo-Json -Compress"
    ], { timeout: 15000, encoding: 'utf8' });
    let list = JSON.parse(out.trim() || 'null');
    if (!Array.isArray(list)) list = list ? [list] : [];
    return list.filter(p => p && p.Name && !VIRTUAL_PRINTERS.some(v => String(p.Name).toLowerCase().includes(v)));
  } catch (e) {
    return [];
  }
}

// Re-detect when no printer was found, so plugging in / installing the
// printer later gets picked up automatically without restarting the bridge.
let noPrinterTicks = 0;

function maybeRedetect() {
  if (config.printerName || config.printerShare) return;
  noPrinterTicks++;
  if (noPrinterTicks < 10) return; // every ~30s
  noPrinterTicks = 0;
  log('No printer yet - re-scanning for USB printers...');
  const printers = detectPrinters();
  if (printers.length) {
    const shared = printers.find(p => p.ShareName);
    config.printerName = printers[0].Name;
    config.printerShare = shared ? shared.ShareName : '';
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); } catch (e) {}
    if (config.printerShare) log(`Auto-detected printer "${config.printerName}" (share: ${config.printerShare})`);
    else log(`FOUND printer "${config.printerName}" but it is not shared - using text fallback.`);
  }
}

function loadOrDetectConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
      if (config.printerShare) {
        log(`Using printer: "${config.printerName}" (share: ${config.printerShare})`);
        return;
      }
    }
  } catch (e) { log('Could not read config.json: ' + e.message); }

  const printers = detectPrinters();
  if (!printers.length) {
    log('WARNING: No printers found on this PC. Connect the USB printer first.');
    return;
  }
  const shared = printers.find(p => p.ShareName);
  const any = printers.find(p => p.Name);
  config.printerName = any.Name;
  config.printerShare = (shared ? shared.ShareName : '');
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); } catch (e) {}

  if (config.printerShare) {
    log(`Auto-detected printer "${config.printerName}" (share: ${config.printerShare})`);
  } else {
    log('FOUND PRINTERS, but none are shared: ' + printers.map(p => p.Name).join(', '));
    log('Fix: right-click the printer -> Printer properties -> Sharing -> tick "Share this printer".');
    log(`Trying text print to "${config.printerName}" as fallback.`);
  }
}

// ---------------- Printing to Windows ----------------

function printRaw(shareName, bytes) {
  const tmp = path.join(os.tmpdir(), `ae_print_${Date.now()}.bin`);
  fs.writeFileSync(tmp, bytes);
  const unc = `\\\\localhost\\${shareName}`;
  // net use once (ignores errors - local shares usually need none)
  try { execSync(`net use ${unc} /persistent:no`, { stdio: 'pipe', timeout: 15000 }); } catch (e) {}
  try {
    fs.copyFileSync(tmp, unc);
    fs.unlinkSync(tmp);
    return { ok: true };
  } catch (e1) {
    try {
      execSync(`copy /b "${tmp}" "${unc}"`, { stdio: 'pipe', timeout: 30000 });
      fs.unlinkSync(tmp);
      return { ok: true };
    } catch (e2) {
      return { ok: false, error: `Cannot reach printer share "${shareName}": ${e2.message.slice(0, 120)}` };
    }
  }
}

function printTextFallback(printerName, text) {
  if (!printerName) return { ok: false, error: 'No printer configured' };
  const tmp = path.join(os.tmpdir(), `ae_print_${Date.now()}.txt`);
  fs.writeFileSync(tmp, text);
  const script = `Get-Content -Raw -Encoding Default '${tmp}' | Out-Printer -Name '${printerName}'`;
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 90000, stdio: 'pipe' });
    fs.unlinkSync(tmp);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Text print failed: ${e.message.slice(0, 120)}` };
  }
}

function doPrint(bytes, textFallback) {
  if (config.printerShare) {
    const r = printRaw(config.printerShare, bytes);
    if (r.ok) return r;
    log('Raw print failed, trying text fallback: ' + r.error);
  }
  return printTextFallback(config.printerName, textFallback);
}

// ---------------- ESC/POS builders ----------------

const ESC = 0x1b;
const GS = 0x1d;

function toBytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    out.push(c < 256 ? c : 63);
  }
  return out;
}

function pad(str, n, dir) {
  str = String(str);
  if (str.length > n) return str.slice(0, n);
  return dir === 'right' ? str.padStart(n)
    : dir === 'center' ? str.padStart(Math.floor((n + str.length) / 2)).padEnd(n)
      : str.padEnd(n);
}

// ---- Code128 (auto subset B/C for long digit runs) ----

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

function encodeCode128(text) {
  const t = String(text);
  let mode = 'B';
  const values = [];
  let i = 0;
  if (/^\d+$/.test(t) && t.length % 2 === 0) { values.push(105); mode = 'C'; }
  else values.push(104);

  while (i < t.length) {
    if (mode === 'C') {
      if (i + 1 < t.length && /\d/.test(t[i]) && /\d/.test(t[i + 1])) {
        values.push(parseInt(t.slice(i, i + 2), 10));
        i += 2;
      } else {
        values.push(100); // switch back to B
        mode = 'B';
      }
    } else {
      const run = t.slice(i).match(/^\d+/);
      if (run && run[0].length >= 4) {
        let r = run[0];
        if (r.length % 2 === 1) r = r.slice(0, -1);
        values.push(99); // switch to C
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
  for (const v of [...values, checksum, 106]) pattern.push(...CODE128[v].split('').map(Number));
  return pattern;
}

function rasterBitmap(pattern, maxWidthPx, heightPx) {
  const quiet = 10;
  const totalModules = quiet * 2 + pattern.length;
  const module = Math.max(1, Math.floor(maxWidthPx / totalModules));
  const widthPx = totalModules * module;
  const widthBytes = Math.ceil(widthPx / 8);
  const bitmap = Buffer.alloc(widthBytes * heightPx, 0);
  let x = quiet * module;
  let isBar = true;
  for (const m of pattern) {
    if (isBar) {
      for (let col = x; col < x + m * module; col++) {
        const byte = col >> 3;
        const bit = 7 - (col & 7);
        for (let row = 0; row < heightPx; row++) bitmap[row * widthBytes + byte] |= (1 << bit);
      }
    }
    x += m * module;
    isBar = !isBar;
  }
  return Buffer.concat([
    Buffer.from([GS, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, heightPx & 0xff, (heightPx >> 8) & 0xff]),
    bitmap
  ]);
}

function buildReceiptBytes({ companyName = '', invoiceNumber = '', date = '', customer = '', items = [], subtotal = 0, gstAmount = 0, grandTotal = 0, width = 32 }) {
  const b = [];
  const init = () => b.push(ESC, 0x40);
  const align = n => b.push(ESC, 0x61, n);
  const bold = on => b.push(ESC, 0x45, on ? 1 : 0);
  const size = n => b.push(GS, 0x21, n);
  const line = s => b.push(...toBytes(s), 0x0a);
  const divider = () => line('-'.repeat(width));
  const feed = n => b.push(ESC, 0x64, n);
  const cut = () => b.push(GS, 0x56, 66, 0);

  init();
  if (companyName) {
    align(1); size(17); bold(true); line(companyName.slice(0, Math.floor(width / 2))); size(0); bold(false);
  }
  align(1); line('');
  align(0); divider();
  line(pad('Invoice: ' + (invoiceNumber || ''), width));
  line(pad('Date: ' + (date || ''), width));
  line(pad('Customer: ' + (customer || 'Walk-in Customer'), width));
  divider();
  line(pad('Item', 22) + pad('Qty', 4, 'right') + pad('Amt', 6, 'right'));
  divider();
  (items || []).forEach(item => {
    const name = String(item.product_name || item.name || '');
    line(name.slice(0, width));
    const qty = Number(item.quantity) || 1;
    const price = Number(item.sell_price || item.price || 0);
    line(pad('', 22) + pad(String(qty), 4, 'right') + pad('Rs.' + (qty * price).toFixed(0), 6, 'right'));
  });
  divider();
  line(pad('Subtotal', width - 14, 'left') + pad('Rs.' + Number(subtotal).toFixed(2), 14, 'right'));
  line(pad('GST @18%', width - 14, 'left') + pad('Rs.' + Number(gstAmount).toFixed(2), 14, 'right'));
  bold(true);
  line(pad('TOTAL', width - 14, 'left') + pad('Rs.' + Number(grandTotal).toFixed(2), 14, 'right'));
  bold(false);
  divider();
  align(1); line('Thank you! Visit again.');
  align(1); line('');
  feed(4);
  cut();
  return Buffer.from(b);
}

function buildLabelBytes({ name = '', price = 0, barcode = '', sku = '', copies = 1 }) {
  const parts = [];
  const pattern = barcode ? encodeCode128(barcode) : null;

  for (let c = 0; c < Math.max(1, Number(copies) || 1); c++) {
    const b = [];
    b.push(ESC, 0x40);
    b.push(ESC, 0x61, 1); // center
    b.push(GS, 0x21, 17); // 2x
    b.push(ESC, 0x45, 1); // bold
    b.push(...toBytes(String(name).slice(0, 16)), 0x0a);
    b.push(GS, 0x21, 0);
    b.push(...toBytes('Rs. ' + (Number(price) || 0).toLocaleString ? (Number(price) || 0).toLocaleString('en-IN') : Number(price) || 0), 0x0a);
    if (pattern) {
      b.push(ESC, 0x61, 1);
      b.push(...rasterBitmap(pattern, 384, 96));
      b.push(0x0a);
    }
    b.push(ESC, 0x45, 0);
    b.push(...toBytes(String(sku).slice(0, 32)), 0x0a);
    b.push(ESC, 0x64, 2); // feed 2
    b.push(GS, 0x56, 66, 0); // cut
    parts.push(Buffer.from(b));
  }
  return Buffer.concat(parts);
}

function receiptTextFallback(p) {
  const W = 32;
  const items = (p.items || []).map(it => {
    const qty = Number(it.quantity) || 1;
    const price = Number(it.sell_price || it.price || 0);
    return `${String(it.product_name || it.name).slice(0, W)}\n` + pad('', 22) + pad(String(qty), 4, 'right') + pad('Rs.' + (qty * price).toFixed(0), 6, 'right');
  }).join('\n');
  return `${p.companyName || ''}\nInvoice: ${p.invoiceNumber || ''}\nDate: ${p.date || ''}\nCustomer: ${p.customer || ''}\n-------------------------------\nItem                   Qty   Amt\n${items}\n-------------------------------\nSubtotal             Rs.${Number(p.subtotal || 0).toFixed(2)}\nGST @18%             Rs.${Number(p.gstAmount || 0).toFixed(2)}\nTOTAL                Rs.${Number(p.grandTotal || 0).toFixed(2)}\n\nThank you! Visit again.\n`;
}

function labelTextFallback(p) {
  const copies = Math.max(1, Number(p.copies) || 1);
  return `\n${String(p.name || '').slice(0, 32)}\nRs. ${Number(p.price || 0)}\nBARCODE: ${p.barcode || ''}\n${String(p.sku || '')}\n\n`.repeat(copies);
}

// ---------------- Job processing ----------------

async function handleJob(job) {
  const p = job.payload || {};
  let result;
  let fallback = '';

  if (job.type === 'label') {
    fallback = labelTextFallback(p);
    result = doPrint(buildLabelBytes(p), fallback);
  } else {
    // receipt or test
    const receipt = {
      companyName: p.companyName || (job.type === 'test' ? 'Aditya Enterprises' : ''),
      invoiceNumber: p.invoiceNumber || (job.type === 'test' ? 'TEST-001' : ''),
      date: p.date || new Date().toLocaleString('en-IN'),
      customer: p.customer || (job.type === 'test' ? 'Test Print' : 'Walk-in Customer'),
      items: job.type === 'test' ? [{ product_name: 'Thermal Printer Test', quantity: 1, sell_price: 1 }] : (p.items || []),
      subtotal: job.type === 'test' ? 1 : Number(p.subtotal || 0),
      gstAmount: job.type === 'test' ? 0 : Number(p.gstAmount || 0),
      grandTotal: job.type === 'test' ? 1 : Number(p.grandTotal || 0)
    };
    fallback = receiptTextFallback(receipt);
    result = doPrint(buildReceiptBytes(receipt), fallback);
  }

  await apiRequest('POST', `/api/devices/print/job/${job.id}/status`, { status: result.ok ? 'done' : 'failed', error: result.error || '' });
  config.lastError = result.ok ? '' : result.error;
  log(result.ok ? `Job #${job.id} (${job.type}) printed` : `Job #${job.id} (${job.type}) FAILED: ${result.error}`);
}

async function tick() {
  maybeRedetect();
  await reportStatus(false);
  const res = await apiRequest('GET', '/api/devices/print/job/next');
  if (!res.success || !res.data) return;
  try { await handleJob(res.data); }
  catch (e) {
    log('Job error: ' + e.message);
    await apiRequest('POST', `/api/devices/print/job/${res.data.id}/status`, { status: 'failed', error: e.message.slice(0, 300) });
  }
}

// ---------------- Main ----------------

log('Aditya ERP USB Print Bridge');
log('Server: ' + API);
loadOrDetectConfig();
reportStatus(true);

if (!config.printerName) {
  log('No printer found. Reconnect the USB printer and restart this bridge.');
}

setInterval(tick, POLL_MS);
tick();
log('Listening for print jobs...');
