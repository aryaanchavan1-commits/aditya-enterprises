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
const LOG_PATH = path.join(__dirname, 'bridge.log');
const API = (process.env.AE_API || 'https://aditya-enterprises-erp.vercel.app').replace(/\/+$/, '');
const POLL_MS = 3000;

let config = { printerName: '', printerShare: '' };
let lastReportAt = 0;

// Never die silently. Log every crash to bridge.log so problems can be
// diagnosed, and keep the process alive across recoverable errors.
process.on('uncaughtException', err => {
  log('FATAL uncaughtException: ' + (err && err.stack ? err.stack : String(err)));
  try { fs.appendFileSync(LOG_PATH, '\n[' + new Date().toISOString() + '] FATAL: ' + (err && err.stack || String(err)) + '\n'); } catch (e) { }
  setTimeout(() => { try { process.exit(1); } catch (e) { } }, 500);
});
process.on('unhandledRejection', (reason) => {
  log('unhandledRejection: ' + (reason && reason.stack ? reason.stack : String(reason)));
  try { fs.appendFileSync(LOG_PATH, '\n[' + new Date().toISOString() + '] REJECTION: ' + (reason && reason.stack || String(reason)) + '\n'); } catch (e) { }
});

// Tell the ERP server which printer this bridge detected, so the Settings
// page can show it even though the API runs in the cloud.
async function reportStatus(force) {
  if (!force && Date.now() - lastReportAt < 15000) return;
  lastReportAt = Date.now();
  await apiRequest('POST', '/api/devices/print/bridge/report', {
    printerName: config.printerName || '',
    printerShare: config.printerShare || '',
    printerMode: config.printerMode || '',
    version: 'bridge-3.0',
    lastError: config.lastError || ''
  });
}

function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_PATH, line + '\n');
    const size = fs.statSync(LOG_PATH).size;
    if (size > 500000) fs.writeFileSync(LOG_PATH, '');
  } catch (e) { }
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

// Thermal receipt/label printers understand raw ESC/POS. Everything else
// (HP inkjet/laser, Brother, Canon...) prints via the Windows driver (GDI).
const THERMAL_RE = /pos|thermal|receipt|58mm|58\s*mm|80mm|80\s*mm|esc\/pos|tsp|tevo|bixolon|zjiang|gs-|tm-|plus p80|p80|rpp|spp/i;

function isThermalName(name) {
  return THERMAL_RE.test(String(name));
}

function detectPrinters() {
  try {
    const out = execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      "Get-CimInstance Win32_Printer | Select-Object Name, ShareName, Default | ConvertTo-Json -Compress"
    ], { timeout: 15000, encoding: 'utf8' });
    let list = JSON.parse(out.trim() || 'null');
    if (!Array.isArray(list)) list = list ? [list] : [];
    return list
      .filter(p => p && p.Name && !VIRTUAL_PRINTERS.some(v => String(p.Name).toLowerCase().includes(v)))
      .map(p => ({ ...p, thermal: isThermalName(p.Name) }));
  } catch (e) {
    return [];
  }
}

function pickPrinter(printers) {
  const chosen = printers.find(p => p.thermal) || printers[0];
  if (!chosen) return null;
  const shared = printers.find(p => p.thermal === chosen.thermal && p.ShareName);
  return {
    printerName: chosen.Name,
    printerShare: shared ? shared.ShareName : '',
    printerMode: chosen.thermal ? 'thermal' : 'normal'
  };
}

// Re-detect when no printer was found, so plugging in / installing the
// printer later gets picked up automatically without restarting the bridge.
let noPrinterTicks = 0;

function maybeRedetect() {
  if (config.printerName) return;
  noPrinterTicks++;
  if (noPrinterTicks < 10) return; // every ~30s
  noPrinterTicks = 0;
  log('No printer yet - re-scanning for USB printers...');
  const picked = pickPrinter(detectPrinters());
  if (picked) {
    Object.assign(config, picked);
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); } catch (e) {}
    log(`Auto-detected printer "${config.printerName}" (${config.printerMode})`);
  }
}

function loadOrDetectConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
      if (config.printerName) {
        log(`Using printer: "${config.printerName}" (${config.printerMode || 'unknown'})`);
        return;
      }
    }
  } catch (e) { log('Could not read config.json: ' + e.message); }

  const picked = pickPrinter(detectPrinters());
  if (!picked) {
    log('WARNING: No printers found on this PC. Connect the USB printer first.');
    return;
  }
  Object.assign(config, picked);
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); } catch (e) {}

  log(`Auto-detected printer "${config.printerName}" (${config.printerMode})`);
}

// ---------------- Printing to Windows ----------------

// RAW printing via the WinSpool API (OpenPrinter -> WritePrinter). This is
// the officially supported way to send raw ESC/POS data to a locally
// installed printer - no printer sharing, no net use, no copy-to-share.
// (Microsoft hardened the spooler after PrintNightmare, so copying bytes to
// a \\PC\printer share no longer works reliably on Windows 10 22H2+.)
const WINSPOOL_C = `
using System;
using System.Runtime.InteropServices;
public static class AERawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct DOC_INFO_1 {
    public string pDocName;
    public string pOutputFile;
    public string pDatatype;
  }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool OpenPrinter(string printerName, out IntPtr hPrinter, IntPtr pDefault);
  [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOC_INFO_1 docInfo);
  [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] data, int count, out int written);
  [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  public static string Win32Error() {
    int code = Marshal.GetLastWin32Error();
    return code + ": " + new System.ComponentModel.Win32Exception(code).Message;
  }
}`;

function printRawWinSpool(printerName, bytes) {
  const tmp = path.join(os.tmpdir(), `ae_print_${Date.now()}.bin`);
  fs.writeFileSync(tmp, bytes);
  const script = `
$ErrorActionPreference = 'Stop'
$script:src = ${psQuote(WINSPOOL_C)}
Add-Type -TypeDefinition $script:src -Language CSharp
$docName = 'AE-' + [DateTime]::Now.ToString('HHmmss')
$bytes = [System.IO.File]::ReadAllBytes(${psQuote(tmp)})
$h = [IntPtr]::Zero
if (-not [AERawPrint]::OpenPrinter(${psQuote(printerName)}, [ref]$h, [IntPtr]::Zero)) { throw 'OpenPrinter failed - ' + [AERawPrint]::Win32Error() }
try {
  $di = New-Object AERawPrint+DOC_INFO_1
  $di.pDocName = $docName
  $di.pDatatype = 'RAW'
  if (-not [AERawPrint]::StartDocPrinter($h, 1, [ref]$di)) { throw 'StartDocPrinter failed - ' + [AERawPrint]::Win32Error() }
  try {
    if (-not [AERawPrint]::StartPagePrinter($h)) { throw 'StartPagePrinter failed - ' + [AERawPrint]::Win32Error() }
    $written = 0
    if (-not [AERawPrint]::WritePrinter($h, $bytes, $bytes.Length, [ref]$written)) { throw 'WritePrinter failed - ' + [AERawPrint]::Win32Error() }
    [void][AERawPrint]::EndPagePrinter($h)
  } finally {
    [void][AERawPrint]::EndDocPrinter($h)
  }
} finally {
  [void][AERawPrint]::ClosePrinter($h)
}`;
  const psPath = path.join(os.tmpdir(), `ae_raw_${Date.now()}.ps1`);
  fs.writeFileSync(psPath, script);
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psPath], { timeout: 90000, stdio: 'pipe' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Raw print failed (${printerName}): ${e.message.slice(0, 120)}` };
  } finally {
    try { fs.unlinkSync(psPath); } catch (e) { }
    try { fs.unlinkSync(tmp); } catch (e) { }
  }
}

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

// ---------------- Windows-driver (GDI) printing for normal printers ----------------
// HP / Canon / Brother etc. cannot understand raw ESC/POS. For those we render
// the label/receipt with the Windows driver (System.Drawing) - barcode included.

// 1-bit BMP of the Code128 pattern (bars = black). BMP is trivial to write and
// GDI reads it natively.
function buildBarcodeBmp(pattern, heightPx) {
  const quiet = 12;
  const totalModules = quiet * 2 + pattern.length;
  const module = 3;
  const widthPx = totalModules * module;
  const rowBytes = Math.ceil(widthPx / 8);
  const rowPad = (4 - (rowBytes % 4)) % 4;
  const stride = rowBytes + rowPad;
  const pixelData = Buffer.alloc(stride * heightPx, 0);
  let x = quiet * module;
  let isBar = true;
  for (const m of pattern) {
    if (isBar) {
      for (let col = x; col < x + m * module; col++) {
        if (col >= widthPx) break;
        for (let row = 0; row < heightPx; row++) {
          const rowStart = (heightPx - 1 - row) * stride; // bottom-up
          pixelData[rowStart + (col >> 3)] |= (1 << (7 - (col & 7)));
        }
      }
    }
    x += m * module;
    isBar = !isBar;
  }
  const fileSize = 14 + 40 + 8 + pixelData.length;
  const buf = Buffer.alloc(fileSize);
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(62, 10); // pixel data offset
  buf.writeUInt32LE(40, 14); // info header size
  buf.writeInt32LE(widthPx, 18);
  buf.writeInt32LE(heightPx, 22);
  buf.writeUInt16LE(1, 26); // planes
  buf.writeUInt16LE(1, 28); // bits per pixel
  buf.writeUInt32LE(pixelData.length, 34);
  buf[54] = 0xFF; buf[55] = 0xFF; buf[56] = 0xFF; buf[57] = 0; // palette[0] = white
  buf[58] = 0x00; buf[59] = 0x00; buf[60] = 0x00; buf[61] = 0; // palette[1] = black
  pixelData.copy(buf, 62);
  return { bmp: buf, widthPx, heightPx };
}

function psQuote(str) {
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function wrapLines(text, maxLen) {
  const out = [];
  for (const raw of String(text).split('\n')) {
    let line = raw;
    while (line.length > maxLen) {
      out.push(line.slice(0, maxLen));
      line = line.slice(maxLen);
    }
    out.push(line);
  }
  return out;
}

// Print a label through the Windows driver: text via GDI fonts + barcode bitmap.
function printLabelViaGdi(printerName, { name = '', price = 0, barcode = '', sku = '', copies = 1 }) {
  const pattern = barcode ? encodeCode128(barcode) : null;
  let bmpPath = null;
  if (pattern) {
    const built = buildBarcodeBmp(pattern, 60);
    bmpPath = path.join(os.tmpdir(), `ae_barcode_${Date.now()}.bmp`);
    fs.writeFileSync(bmpPath, built.bmp);
  }
  return printLabelViaGdiAt(printerName, bmpPath, { name, price, barcode, sku, copies });
}

function printLabelViaGdiAt(printerName, bmpPath, { name = '', price = 0, barcode = '', sku = '', copies = 1 }) {
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = ${psQuote(printerName)}
$doc.PrinterSettings.Copies = ${Math.max(1, Number(copies) || 1)}
$doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('label', 300, 200)
${bmpPath ? `$script:bmp = [System.Drawing.Bitmap]::FromFile(${psQuote(bmpPath)})
$script:barcode = ${psQuote(barcode || '')}` : `$script:bmp = $null
$script:barcode = ''`}
$script:title = ${psQuote(String(name).slice(0, 30))}
$script:priceText = ${psQuote('Rs. ' + (Number(price) || 0))}
$script:skuText = ${psQuote(String(sku).slice(0, 40))}
$doc.add_PrintPage({ param($s, $e)
  $g = $e.Graphics
  $y = 55
  $f1 = New-Object System.Drawing.Font('Arial', 22, [System.Drawing.FontStyle]::Bold)
  $f2 = New-Object System.Drawing.Font('Arial', 16)
  $f3 = New-Object System.Drawing.Font('Consolas', 10)
  $g.DrawString($script:title, $f1, [System.Drawing.Brushes]::Black, 25, $y); $y += 45
  $g.DrawString($script:priceText, $f2, [System.Drawing.Brushes]::Black, 25, $y); $y += 38
  if ($script:bmp -ne $null) {
    $bw = [Math]::Min(250, $e.MarginBounds.Width - 50)
    $g.DrawImage($script:bmp, 25, $y, $bw, 60); $y += 70
  } elseif ($script:barcode -ne '') {
    $g.DrawString('BARCODE: ' + $script:barcode, $f3, [System.Drawing.Brushes]::Black, 25, $y); $y += 25
  }
  if ($script:skuText -ne '') {
    $g.DrawString($script:skuText, $f3, [System.Drawing.Brushes]::Black, 25, $y)
  }
})
$doc.Print()
if ($script:bmp -ne $null) { $script:bmp.Dispose() }
`;
  const psPath = path.join(os.tmpdir(), `ae_label_${Date.now()}.ps1`);
  fs.writeFileSync(psPath, script);
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psPath], { timeout: 120000, stdio: 'pipe' });
    if (bmpPath) { try { fs.unlinkSync(bmpPath); } catch (e) {} }
    fs.unlinkSync(psPath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Windows driver print failed: ${e.message.slice(0, 140)}` };
  }
}

// Print a receipt through the Windows driver as text lines.
function printReceiptViaGdi(printerName, lines) {
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$script:lines = @(${lines.map(psQuote).join(', ')})
$script:page = 0
$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = ${psQuote(printerName)}
$doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('receipt', 400, 1100)
$font = New-Object System.Drawing.Font('Consolas', 11)
$doc.add_PrintPage({ param($s, $e)
  $g = $e.Graphics
  $perPage = 48
  $start = $script:page * $perPage
  $y = 40
  for ($i = $start; $i -lt [Math]::Min($start + $perPage, $script:lines.Count); $i++) {
    $ln = $script:lines[$i]
    if ($ln -eq '') { $y += 12; continue }
    if ($ln -like '===*') {
      $g.DrawLine([System.Drawing.Pens]::Black, 20, $y + 8, 380, $y + 8)
    } else {
      $g.DrawString($ln, $font, [System.Drawing.Brushes]::Black, 20, $y)
    }
    $y += 20
  }
  $script:page++
  $e.HasMorePages = ($start + $perPage) -lt $script:lines.Count
})
$doc.Print()
`;
  const psPath = path.join(os.tmpdir(), `ae_receipt_${Date.now()}.ps1`);
  fs.writeFileSync(psPath, script);
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psPath], { timeout: 120000, stdio: 'pipe' });
    fs.unlinkSync(psPath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Windows driver print failed: ${e.message.slice(0, 140)}` };
  }
}

function doPrint(bytes, textFallback) {
  if (config.printerName) {
    const r = printRawWinSpool(config.printerName, bytes);
    if (r.ok) return r;
    log('Raw print failed, trying text fallback: ' + r.error);
    if (config.printerShare) {
      const r2 = printRaw(config.printerShare, bytes);
      if (r2.ok) return r2;
      log('Share print also failed: ' + r2.error);
    }
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

function buildReceiptBytes({ companyName = '', invoiceNumber = '', date = '', customer = '', items = [], subtotal = 0, gstAmount = 0, grandTotal = 0, width = 32, isGst = true, gstin = '', customerGstin = '', gstRate = 18 }) {
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
  if (isGst && gstin) { align(1); line('GSTIN: ' + gstin); }
  align(1); line('');
  align(0); divider();
  if (isGst) line(pad('Invoice: ' + (invoiceNumber || ''), width));
  line(pad('Date: ' + (date || ''), width));
  line(pad('Customer: ' + (customer || 'Walk-in Customer'), width));
  if (isGst && customerGstin) line(pad('GSTIN: ' + customerGstin, width));
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
  if (isGst) line(pad(`GST @${gstRate || 18}%`, width - 14, 'left') + pad('Rs.' + Number(gstAmount).toFixed(2), 14, 'right'));
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
  const isGst = p.isGst !== false;
  const gstRate = p.gstRate || 18;
  const items = (p.items || []).map(it => {
    const qty = Number(it.quantity) || 1;
    const price = Number(it.sell_price || it.price || 0);
    return `${String(it.product_name || it.name).slice(0, W)}\n` + pad('', 22) + pad(String(qty), 4, 'right') + pad('Rs.' + (qty * price).toFixed(0), 6, 'right');
  }).join('\n');
  const head = `${p.companyName || ''}\n${isGst && p.gstin ? 'GSTIN: ' + p.gstin + '\n' : ''}${isGst ? 'Invoice: ' + (p.invoiceNumber || '') + '\n' : ''}Date: ${p.date || ''}\nCustomer: ${p.customer || ''}${isGst && p.customerGstin ? '\nGSTIN: ' + p.customerGstin : ''}\n`;
  const totals = `${'Subtotal'.padEnd(22)}Rs.${Number(p.subtotal || 0).toFixed(2)}\n${isGst ? `GST @${gstRate}%`.padEnd(22) + 'Rs.' + Number(p.gstAmount || 0).toFixed(2) + '\n' : ''}${'TOTAL'.padEnd(22)}Rs.${Number(p.grandTotal || 0).toFixed(2)}\n`;
  return `${head}-------------------------------\nItem                   Qty   Amt\n${items}\n-------------------------------\n${totals}\nThank you! Visit again.\n`;
}

function labelTextFallback(p) {
  const copies = Math.max(1, Number(p.copies) || 1);
  return `\n${String(p.name || '').slice(0, 32)}\nRs. ${Number(p.price || 0)}\nBARCODE: ${p.barcode || ''}\n${String(p.sku || '')}\n\n`.repeat(copies);
}

// ---------------- Job processing ----------------

function buildReceiptLines(p) {
  const W = 52;
  const isGst = p.isGst !== false;
  const gstRate = p.gstRate || 18;
  const lines = [];
  lines.push(p.companyName || 'Aditya Enterprises');
  if (isGst && p.gstin) lines.push('GSTIN: ' + p.gstin);
  lines.push('====================================================');
  if (isGst) lines.push(`Invoice: ${p.invoiceNumber || ''}`);
  lines.push(`Date: ${p.date || ''}`);
  lines.push(`Customer: ${p.customer || 'Walk-in Customer'}`);
  if (isGst && p.customerGstin) lines.push(`GSTIN: ${p.customerGstin}`);
  lines.push('====================================================');
  lines.push('Item                    Qty       Amount');
  lines.push('====================================================');
  (p.items || []).forEach(item => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.sell_price || item.price || 0);
    lines.push(...wrapLines(String(item.product_name || item.name || ''), W));
    lines.push(''.padEnd(36) + String(qty).padStart(6) + ('Rs.' + (qty * price).toFixed(0)).padStart(12));
  });
  lines.push('====================================================');
  lines.push('Subtotal' + 'Rs.' + Number(p.subtotal || 0).toFixed(2).padStart(W - 8));
  if (isGst) lines.push(`GST @${gstRate}%` + 'Rs.' + Number(p.gstAmount || 0).toFixed(2).padStart(W - 7));
  lines.push('TOTAL' + 'Rs.' + Number(p.grandTotal || 0).toFixed(2).padStart(W - 5));
  lines.push('====================================================');
  lines.push('Thank you! Visit again.');
  return lines;
}

async function handleJob(job) {
  const p = job.payload || {};
  let result;

  const isNormal = config.printerMode === 'normal';

  if (job.type === 'label') {
    if (isNormal) {
      result = printLabelViaGdi(config.printerName, p);
    } else {
      result = doPrint(buildLabelBytes(p), labelTextFallback(p));
    }
  } else {
    // receipt or test
    const receipt = {
      companyName: p.companyName || (job.type === 'test' ? 'Aditya Enterprises' : ''),
      invoiceNumber: p.invoiceNumber || (job.type === 'test' ? 'TEST-001' : ''),
      date: p.date || new Date().toLocaleString('en-IN'),
      customer: p.customer || (job.type === 'test' ? 'Test Print' : 'Walk-in Customer'),
      items: job.type === 'test' ? [{ product_name: 'Printer Test', quantity: 1, sell_price: 1 }] : (p.items || []),
      subtotal: job.type === 'test' ? 1 : Number(p.subtotal || 0),
      gstAmount: job.type === 'test' ? 0 : Number(p.gstAmount || 0),
      grandTotal: job.type === 'test' ? 1 : Number(p.grandTotal || 0),
      isGst: job.type === 'test' ? true : (p.isGst !== false),
      gstin: p.gstin || '',
      customerGstin: p.customerGstin || '',
      gstRate: p.gstRate || 18
    };
    if (isNormal) {
      result = printReceiptViaGdi(config.printerName, buildReceiptLines(receipt));
    } else {
      result = doPrint(buildReceiptBytes(receipt), receiptTextFallback(receipt));
    }
  }

  await apiRequest('POST', `/api/devices/print/job/${job.id}/status`, { status: result.ok ? 'done' : 'failed', error: result.error || '' });
  config.lastError = result.ok ? '' : result.error;
  log(result.ok ? `Job #${job.id} (${job.type}) printed via ${config.printerMode}` : `Job #${job.id} (${job.type}) FAILED: ${result.error}`);
}

async function tick() {
  try {
    maybeRedetect();
    await reportStatus(false);
    const res = await apiRequest('GET', '/api/devices/print/job/next');
    if (!res.success || !res.data) return;
    try { await handleJob(res.data); }
    catch (e) {
      log('Job error: ' + e.message);
      await apiRequest('POST', `/api/devices/print/job/${res.data.id}/status`, { status: 'failed', error: e.message.slice(0, 300) });
    }
  } catch (e) {
    log('Poll error (will retry): ' + e.message);
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
