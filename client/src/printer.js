// Web Bluetooth thermal (ESC/POS) printer support.
// Browsers cannot talk to USB printers directly, but Chrome/Edge can pair
// with BLE thermal receipt printers (58mm/80mm) and send raw ESC/POS bytes.

const SAVED_KEY = 'ae_bt_printer';

// Common BLE service UUIDs used by thermal receipt printers (16-bit ones
// expanded to 128-bit). ISSC "transparent UART" is the most widespread chip
// in 58mm printers; the others are common vendor implementations.
const PRINTER_SERVICES = [
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ff12-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '9eae1000-9d0d-48c5-aa55-093431f5b9a2',
  '0000dfb0-0000-1000-8000-00805f9b34fb',
  '0000a002-0000-1000-8000-00805f9b34fb',
  '0000ab00-0000-1000-8000-00805f9b34fb',
  '0000ef00-0000-1000-8000-00805f9b34fb'
];

// Common writable characteristics inside those services.
const PRINTER_CHARACTERISTICS = [
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '0000ff01-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ae01-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000dfb1-0000-1000-8000-00805f9b34fb',
  '0000a003-0000-1000-8000-00805f9b34fb',
  '0000ab01-0000-1000-8000-00805f9b34fb',
  '0000ef01-0000-1000-8000-00805f9b34fb'
];

const CHUNK_SIZE = 512;

// Live connection state - the SAME device/characteristic are reused across
// prints instead of re-fetching, which is far more reliable on Windows.
let activeDevice = null;
let activeCharacteristic = null;

function watchDisconnect(device) {
  try {
    device.addEventListener('gattserverdisconnected', () => {
      if (activeDevice === device) {
        activeDevice = null;
        activeCharacteristic = null;
      }
    });
  } catch (e) {}
}

export function bluetoothSupported() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

export function isConnected() {
  return !!(activeCharacteristic && activeDevice && activeDevice.gatt.connected);
}

export function getSavedPrinter() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function savePrinter(info) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(info));
  } catch (e) {}
}

export function clearSavedPrinter() {
  try {
    localStorage.removeItem(SAVED_KEY);
  } catch (e) {}
}

export async function disconnectActive() {
  if (activeDevice && activeDevice.gatt.connected) {
    try { activeDevice.gatt.disconnect(); } catch (e) {}
  }
  activeDevice = null;
  activeCharacteristic = null;
}

// Open the browser chooser and pair with a printer. Must be called from a
// user gesture (button click). Accepts any BLE device so unknown vendor
// chips still show up, then discovers the correct service/characteristic.
export async function pairPrinter() {
  if (!bluetoothSupported()) throw new Error('Web Bluetooth not supported in this browser. Use Chrome or Edge (with HTTPS).');

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES
  });

  const info = await resolvePrinterServices(device);
  info.id = device.id;
  info.name = device.name || 'Bluetooth Printer';
  savePrinter(info);
  return info;
}

// Reconnect to a previously paired printer without showing the chooser.
export async function reconnectPrinter() {
  if (!bluetoothSupported()) return null;
  const saved = getSavedPrinter();
  if (!saved) return null;
  try {
    const device = await findDevice(saved);
    if (!device) return null;
    await ensureConnected(saved, device);
    return { ...saved, name: device.name || saved.name };
  } catch (e) {
    return null;
  }
}

async function findDevice(saved) {
  if (activeDevice && activeDevice.id === saved.id) return activeDevice;
  const devices = await navigator.bluetooth.getDevices();
  return devices.find(d => d.id === saved.id) || null;
}

async function resolvePrinterServices(device) {
  const server = await device.gatt.connect().catch(e => {
    throw new Error('Could not connect: ' + (e.message || 'check the printer is ON and in pairing mode'));
  });

  let service = null;
  try {
    const services = await server.getPrimaryServices();
    service = services.find(s => PRINTER_SERVICES.includes(s.uuid));
    if (!service) {
      // Unknown chip - pick the first service that offers a writable
      // characteristic so vendor printers still print.
      for (const candidate of services) {
        const chars = await candidate.getCharacteristics().catch(() => []);
        if (chars.some(c => c.properties.write || c.properties.writeWithoutResponse)) {
          service = candidate;
          break;
        }
      }
    }
    if (!service) service = services[0];
  } catch (e) {
    device.gatt.disconnect();
    throw new Error('Could not read printer services: ' + e.message);
  }
  if (!service) {
    device.gatt.disconnect();
    throw new Error('No writable service found. Some printers only support classic Bluetooth and cannot be used from a browser. For USB printing use the browser print dialog instead.');
  }

  const chars = await service.getCharacteristics().catch(() => []);
  let characteristic = chars.find(c => PRINTER_CHARACTERISTICS.includes(c.uuid))
    || chars.find(c => c.properties.write || c.properties.writeWithoutResponse)
    || chars[0];
  if (!characteristic) {
    device.gatt.disconnect();
    throw new Error('No writable characteristic found on the printer.');
  }

  activeDevice = device;
  activeCharacteristic = characteristic;
  watchDisconnect(device);

  return {
    serviceUuid: service.uuid,
    characteristicUuid: characteristic.uuid
  };
}

async function ensureConnected(saved, device) {
  if (activeCharacteristic && activeDevice === device && device.gatt.connected) {
    return activeCharacteristic;
  }
  const server = await device.gatt.connect().catch(e => {
    activeDevice = null;
    activeCharacteristic = null;
    throw new Error('Could not connect to ' + (device.name || 'printer') + ': ' + (e.message || 'check it is switched ON'));
  });

  let service;
  try {
    service = await server.getPrimaryService(saved.serviceUuid);
  } catch (e) {
    // Service may not be in the permission set anymore - search everything.
    const services = await server.getPrimaryServices();
    service = services.find(s => s.uuid === saved.serviceUuid);
  }
  if (!service) {
    activeDevice = null;
    activeCharacteristic = null;
    throw new Error('Printer services lost. Connect the printer again.');
  }

  const characteristic = await service.getCharacteristic(saved.characteristicUuid);
  activeDevice = device;
  activeCharacteristic = characteristic;
  watchDisconnect(device);
  return characteristic;
}

async function writeChunk(characteristic, chunk) {
  const props = characteristic.properties;
  if (props.write) {
    try {
      if (characteristic.writeValueWithResponse) {
        return await characteristic.writeValueWithResponse(chunk);
      }
      return await characteristic.writeValue(chunk);
    } catch (e) {
      if (e.name === 'NotSupportedError' && props.writeWithoutResponse) {
        return await characteristic.writeValueWithoutResponse(chunk);
      }
      throw e;
    }
  }
  if (props.writeWithoutResponse) {
    return await characteristic.writeValueWithoutResponse(chunk);
  }
  if (characteristic.writeValue) {
    return await characteristic.writeValue(chunk);
  }
  throw new Error('Printer port is not writable.');
}

// Write ESC/POS bytes in small chunks (older printers overflow the BLE
// buffer if the whole job is written at once). Reconnects automatically if
// the printer drops mid-job.
export async function sendBytes(bytes) {
  const saved = getSavedPrinter();
  if (!saved) throw new Error('No printer paired yet. Tap "Pair Bluetooth Printer" first.');

  let device = activeDevice;
  if (!device) {
    device = await findDevice(saved);
    if (!device) throw new Error('Paired printer not found. Tap "Pair Bluetooth Printer" to reconnect it.');
  }

  let characteristic = await ensureConnected(saved, device);
  let reconnected = false;

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    try {
      await writeChunk(characteristic, chunk);
    } catch (e) {
      if (!reconnected && device.gatt && !device.gatt.connected) {
        await new Promise(r => setTimeout(r, 600));
        characteristic = await ensureConnected(saved, device);
        reconnected = true;
        i -= CHUNK_SIZE;
        continue;
      }
      throw e;
    }
  }
}

// Send a print job to the local USB print bridge via the server queue.
// The bridge app on the shop PC picks it up and prints it raw (ESC/POS)
// to the USB printer - no browser print dialog, no driver needed.
export async function printViaBridge(type, payload) {
  const r = await fetch('/api/print/job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, payload })
  });
  const d = await r.json();
  if (!d.success) throw new Error(d.error || 'Could not send print job');
  return d.data;
}

// Is the local USB print bridge (shop PC) online right now?
export async function getBridgeStatus() {
  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
    const r = await fetch('/api/print/bridge/status', ctrl ? { signal: ctrl.signal } : {});
    const d = await r.json();
    if (t) clearTimeout(t);
    return { online: !!(d.success && d.data && d.data.bridgeOnline), lastJob: d.data?.lastJob || null };
  } catch (e) {
    return { online: false, lastJob: null };
  }
}

// Print through whichever printer is available: the USB bridge on the shop
// PC if it is online, otherwise the paired Bluetooth printer. Returns
// { via: 'usb' | 'bluetooth' | null, target } so callers can tell the user
// which printer actually printed.
async function printViaBest(type, bytes, payload) {
  const st = await getBridgeStatus();
  if (st.online) {
    await printViaBridge(type, payload);
    return { via: 'usb', target: 'USB printer (shop PC bridge)' };
  }
  const saved = getSavedPrinter();
  if (saved) {
    if (!isConnected()) {
      const re = await reconnectPrinter();
      if (!re) return { via: null, target: '' };
    }
    await sendBytes(bytes);
    return { via: 'bluetooth', target: saved.name || 'Bluetooth printer' };
  }
  return { via: null, target: '' };
}

export async function printSmartLabel(payload) {
  return printViaBest('label', buildLabelEscPos(payload), payload);
}

export async function printSmartReceipt(payload) {
  return printViaBest('receipt', buildEscPos(payload), payload);
}

// ---------------- ESC/POS receipt builder (58mm = 32 chars, 80mm = 42) ----------------

const ESC = 0x1b;
const GS = 0x1d;

function text(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out.push(code < 256 ? code : 63); // non-ASCII -> '?'
  }
  return out;
}

function pad(str, n, dir) {
  str = String(str);
  if (str.length > n) return str.slice(0, n);
  return dir === 'right' ? str.padStart(n) : dir === 'center' ? str.padStart(Math.floor((n + str.length) / 2)).padEnd(n) : str.padEnd(n);
}

export function buildEscPos({ companyName = '', address = '', invoiceNumber = '', date = '', customer = '', items = [], subtotal = 0, gstAmount = 0, grandTotal = 0, width = 32 }) {
  const b = [];
  const init = () => b.push(ESC, 0x40);
  const align = n => b.push(ESC, 0x61, n);
  const bold = on => b.push(ESC, 0x45, on ? 1 : 0);
  const size = n => b.push(GS, 0x21, n); // 0 = 1x1, 17 = 2x2
  const line = s => b.push(...text(s), 0x0a);
  const divider = () => line('-'.repeat(width));
  const feed = n => b.push(ESC, 0x64, n);
  const cut = () => b.push(GS, 0x56, 66, 0);

  init();

  if (companyName) {
    align(1); size(17); bold(true); line(companyName.slice(0, Math.floor(width / 2))); size(0); bold(false);
  }
  if (address) { align(1); line(address); }
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

  return Uint8Array.from(b);
}

export function buildEscPosTest({ companyName = 'Aditya Enterprises', width = 32 } = {}) {
  return buildEscPos({
    companyName,
    address: 'Printer Test',
    invoiceNumber: 'TEST-001',
    date: new Date().toLocaleString('en-IN'),
    customer: 'Test Print',
    items: [{ product_name: 'Thermal Printer Test', quantity: 1, sell_price: 1 }],
    subtotal: 1, gstAmount: 0, grandTotal: 1,
    width
  });
}

// ---------------- ESC/POS barcode label builder (58mm x 40mm) ----------------

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
        values.push(100);
        mode = 'B';
      }
    } else {
      const run = t.slice(i).match(/^\d+/);
      if (run && run[0].length >= 4) {
        let r = run[0];
        if (r.length % 2 === 1) r = r.slice(0, -1);
        values.push(99);
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
  const bitmap = new Uint8Array(widthBytes * heightPx);
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
  const header = [GS, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, heightPx & 0xff, (heightPx >> 8) & 0xff];
  const out = new Uint8Array(header.length + bitmap.length);
  out.set(header, 0);
  out.set(bitmap, header.length);
  return out;
}

export function buildLabelEscPos({ name = '', price = 0, barcode = '', sku = '', copies = 1 }) {
  const parts = [];
  const pattern = barcode ? encodeCode128(barcode) : null;

  for (let c = 0; c < Math.max(1, Number(copies) || 1); c++) {
    const b = [];
    b.push(ESC, 0x40);
    b.push(ESC, 0x61, 1);
    b.push(GS, 0x21, 17);
    b.push(ESC, 0x45, 1);
    b.push(...text(String(name).slice(0, 16)), 0x0a);
    b.push(GS, 0x21, 0);
    b.push(...text('Rs. ' + (Number(price) || 0).toLocaleString('en-IN')), 0x0a);
    if (pattern) {
      b.push(ESC, 0x61, 1);
      b.push(...rasterBitmap(pattern, 384, 96));
      b.push(0x0a);
    }
    b.push(ESC, 0x45, 0);
    b.push(...text(String(sku).slice(0, 32)), 0x0a);
    b.push(ESC, 0x64, 2);
    b.push(GS, 0x56, 66, 0);
    parts.push(Uint8Array.from(b));
  }

  if (parts.length === 1) return parts[0];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
