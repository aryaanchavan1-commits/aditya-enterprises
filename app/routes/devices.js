const express = require('express');
const router = express.Router();
const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { get, all, run, dataDir } = require('../db');

function runPowershell(script) {
  try {
    const result = execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8', timeout: 10000, windowsHide: true
    });
    return result.trim();
  } catch (e) { return ''; }
}

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 8000, windowsHide: true }).trim();
  } catch (e) { return ''; }
}

// GET - Detect barcode scanners
router.get('/scanners', (req, res) => {
  try {
    const devices = [];

    // Method 1: Detect HID barcode scanners via WMI
    const wmicOutput = runCmd('wmic path Win32_PnPEntity where "Name like \'%scanner%\' or Name like \'%barcode%\' or Name like \'%Symbol%\' or Name like \'%Honeywell%\' or Name like \'%Zebra%\' or Name like \'%Datalogic%\' or Name like \'%Motorola%\' or Name like \'%Metrologic%\'" get Name,DeviceID /format:csv 2>nul');

    if (wmicOutput) {
      wmicOutput.split('\n').filter(l => l.includes(',')).forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 3 && parts[2]) {
          devices.push({ type: 'scanner', name: parts[2].trim(), deviceId: parts[1]?.trim() || '', source: 'wmi' });
        }
      });
    }

    // Method 2: Detect HID devices that could be scanners
    const hidOutput = runCmd('wmic path Win32_PnPEntity where "PNPClass=\'HIDClass\'" get Name,DeviceID /format:csv 2>nul');
    if (hidOutput) {
      hidOutput.split('\n').filter(l => l.includes('USB')).slice(0, 10).forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 3 && parts[2] && !devices.find(d => d.name === parts[2].trim())) {
          const name = parts[2].trim().toLowerCase();
          if (name.includes('keyboard') && (name.includes('usb') || name.includes('hid'))) {
            devices.push({
              type: 'scanner',
              name: parts[2].trim(),
              deviceId: parts[1]?.trim() || '',
              source: 'hid',
              note: 'May be a keyboard-wedge scanner (works automatically)'
            });
          }
        }
      });
    }

    // Method 3: COM port scanners via PowerShell
    const comOutput = runPowershell('[System.IO.Ports.SerialPort]::GetPortNames()');
    if (comOutput) {
      comOutput.split('\n').map(l => l.trim()).filter(l => l).forEach(port => {
        if (!devices.find(d => d.name === port)) {
          devices.push({ type: 'scanner', name: `COM Scanner on ${port}`, path: port, source: 'com' });
        }
      });
    }

    res.json({
      success: true,
      data: devices,
      message: devices.length > 0
        ? `Found ${devices.length} device(s). Keyboard-wedge scanners work automatically on any focused field.`
        : 'No dedicated scanners detected. USB barcode scanners (keyboard wedge type) work automatically - just scan into any input field.'
    });
  } catch (err) {
    res.json({ success: true, data: [], error: err.message });
  }
});

// GET - Detect printers
router.get('/printers', (req, res) => {
  try {
    const printers = [];

    // Method 1: PowerShell Get-Printer (Windows 8+)
    const psOutput = runPowershell('Get-Printer | Select-Object Name,DriverName,PortName,Shared,Published | ConvertTo-Csv -NoTypeInformation');

    if (psOutput) {
      const lines = psOutput.split('\n');
      if (lines.length > 1) {
        lines.slice(1).forEach(line => {
          const cols = line.replace(/^"|"$/g, '').split('","');
          if (cols.length >= 3 && cols[0]) {
            printers.push({
              type: 'printer',
              name: cols[0],
              driver: cols[1] || 'Unknown',
              port: cols[2] || 'Unknown',
              source: 'spooler',
              isDefault: cols[0].toLowerCase().includes('default')
            });
          }
        });
      }
    }

    // Method 2: Fallback with WMIC if PS didn't return anything
    if (printers.length === 0) {
      const wmicOut = runCmd('wmic printer get Name,DriverName,PortName /format:csv 2>nul');
      if (wmicOut) {
        wmicOut.split('\n').filter(l => l.includes(',')).forEach(line => {
          const parts = line.split(',');
          if (parts.length >= 4 && parts[3]) {
            printers.push({
              type: 'printer',
              name: parts[3].trim(),
              driver: parts[2]?.trim() || 'Unknown',
              port: parts[1]?.trim() || 'Unknown',
              source: 'wmi'
            });
          }
        });
      }
    }

    // Method 3: Detect USB-connected printers via WMI PnP
    const pnpOutput = runCmd('wmic path Win32_PnPEntity where "Name like \'%printer%\' or Name like \'%POS%\' or Name like \'%thermal%\' or Name like \'%Epson%\' or Name like \'%Zebra%\' or Name like \'%Brother%\' or Name like \'%Canon%\' or Name like \'%HP%\'" get Name /format:csv 2>nul');
    if (pnpOutput) {
      pnpOutput.split('\n').filter(l => l.includes(',')).forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 3 && parts[2] && !printers.find(p => p.name === parts[2].trim())) {
          printers.push({ type: 'printer', name: parts[2].trim(), source: 'pnp' });
        }
      });
    }

    // If nothing found at all, add fallback
    if (printers.length === 0) {
      printers.push({ type: 'printer', name: 'Default Windows Printer', port: 'WIN_DEFAULT', source: 'fallback' });
      printers.push({ type: 'printer', name: 'Save as PDF (Virtual)', port: 'PDF', source: 'fallback' });
    }

    res.json({ success: true, data: printers });
  } catch (err) {
    res.json({
      success: true,
      data: [
        { type: 'printer', name: 'Default Windows Printer', port: 'WIN_DEFAULT', source: 'fallback' },
        { type: 'printer', name: 'Save as PDF (Virtual)', port: 'PDF', source: 'fallback' }
      ],
      error: err.message
    });
  }
});

// POST - Print barcode to thermal printer using ESC/POS
router.post('/print-thermal', (req, res) => {
  try {
    const { barcode, productName, price, printerPath, copies } = req.body;
    const numCopies = copies || 1;
    const barcodeFile = path.join(dataDir, 'barcodes', `${barcode}.png`);

    // Build HTML for printing via Windows spooler
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body { margin:0; padding:10px; font-family: Arial; text-align:center; width:58mm; }
h3 { font-size:12px; margin:4px 0; }
.price { font-size:14px; font-weight:bold; margin:4px 0; }
.barcode-img { max-width:200px; height:50px; }
.info { font-size:9px; color:#555; margin:4px 0; }
</style></head><body>
${productName ? `<h3>${productName}</h3>` : ''}
${fs.existsSync(barcodeFile) ? `<img class="barcode-img" src="file:///${barcodeFile.replace(/\\/g, '/')}" />` : ''}
<div class="info">${barcode}</div>
${price ? `<div class="price">Rs.${Number(price).toLocaleString('en-IN')}</div>` : ''}
<div class="info">Aditya Enterprises</div>
<script>
  for(let i=0;i<${numCopies-1};i++) document.body.innerHTML+=document.body.innerHTML;
  window.onload=function(){ window.print(); setTimeout(function(){ window.close(); },2000); };
</script></body></html>`;

    const tempHtml = path.join(dataDir, `print_${Date.now()}.html`);
    fs.writeFileSync(tempHtml, htmlContent);

    // Try ESC/POS first (for thermal printers), fall back to browser print
    let escpos = null;
    try { escpos = require('escpos'); } catch (e) { /* optional */ }

    if (escpos && printerPath && printerPath.startsWith('COM')) {
      try {
        const device = new escpos.USB();
        const printer = new escpos.Printer(device);
        device.open(() => {
          printer
            .align('ct')
            .style('b')
            .size(1, 1)
            .text(productName || 'Product')
            .style('normal')
            .size(0, 0)
            .barcode(barcode, 'CODE128', { width: 2, height: 80 })
            .text(barcode)
            .text(price ? `Rs.${Number(price).toLocaleString('en-IN')}` : '')
            .text('Aditya Enterprises')
            .cut()
            .close();
        });
        return res.json({ success: true, message: 'Printed via ESC/POS thermal printer' });
      } catch (escposErr) {
        console.log('ESC/POS failed, falling back to Windows print:', escposErr.message);
      }
    }

    // Fallback: Open HTML in print dialog
    const startCmd = `start "" "${tempHtml}"`;
    exec(startCmd, (err) => {
      if (err) {
        // Alternative: use PowerShell to print
        exec(`powershell -Command "Start-Process -FilePath '${tempHtml}' -Verb Print"`, (err2) => {
          if (err2) return res.status(500).json({ success: false, error: 'Print failed' });
          res.json({ success: true, message: 'Sent to printer' });
        });
      } else {
        res.json({ success: true, message: 'Print dialog opened' });
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST - Print barcode image directly
router.post('/print-barcode', (req, res) => {
  try {
    const { barcode, printerName } = req.body;
    const barcodeFile = path.join(dataDir, 'barcodes', `${barcode}.png`);

    if (!fs.existsSync(barcodeFile)) {
      return res.status(404).json({ success: false, error: 'Barcode image not found' });
    }

    // Use PowerShell to print the image
    if (printerName) {
      const psCmd = `Start-Process -FilePath '${barcodeFile}' -Verb Print -ArgumentList '"${printerName}"'`;
      exec(`powershell -Command "${psCmd}"`, (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: `Sent to ${printerName}` });
      });
    } else {
      exec(`mspaint /p "${barcodeFile}"`, (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: 'Sent to default printer' });
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST - Print receipt/invoice
router.post('/print-receipt', (req, res) => {
  try {
    const { saleId } = req.body;

    const sale = get('SELECT * FROM sales WHERE id = ?', [saleId]);
    if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });

    sale.items = JSON.parse(sale.items || '[]');
    const company = get("SELECT value FROM settings WHERE key='company_name'")?.value || 'Aditya Enterprises';
    const companyAddr = get("SELECT value FROM settings WHERE key='company_address'")?.value || '';
    const companyPhone = get("SELECT value FROM settings WHERE key='company_phone'")?.value || '';
    const companyGstin = get("SELECT value FROM settings WHERE key='company_gstin'")?.value || '';

    const itemsHtml = sale.items.map(item => `
      <tr>
        <td>${item.product_name?.substring(0,20) || 'Item'}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${Number(item.sell_price).toFixed(2)}</td>
        <td style="text-align:right">${(item.sell_price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body { margin:0; padding:10px; font-family: 'Courier New', monospace; font-size:11px; width:72mm; }
h2 { font-size:14px; text-align:center; margin:4px 0; }
.center { text-align:center; font-size:10px; }
table { width:100%; border-collapse:collapse; margin:6px 0; }
td, th { padding:2px 4px; }
th { border-bottom:1px dashed #000; border-top:1px dashed #000; }
.total { font-size:13px; font-weight:bold; text-align:right; margin-top:8px; padding-top:4px; border-top:1px dashed #000; }
.footer { text-align:center; font-size:9px; margin-top:10px; }
</style></head><body>
<h2>${company}</h2>
<div class="center">${companyAddr}</div>
<div class="center">Ph: ${companyPhone} | GSTIN: ${companyGstin}</div>
<hr>
<div>Invoice: ${sale.invoice_number}</div>
<div>Date: ${sale.sale_date} | Customer: ${sale.customer_name}</div>
<hr>
<table>
<tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr>
${itemsHtml}
</table>
<hr>
<div style="text-align:right">Subtotal: Rs.${Number(sale.subtotal).toFixed(2)}</div>
${sale.discount_total > 0 ? `<div style="text-align:right">Discount: -Rs.${Number(sale.discount_total).toFixed(2)}</div>` : ''}
${sale.cgst_total > 0 ? `<div style="text-align:right">CGST 9%: Rs.${Number(sale.cgst_total).toFixed(2)}</div>` : ''}
${sale.sgst_total > 0 ? `<div style="text-align:right">SGST 9%: Rs.${Number(sale.sgst_total).toFixed(2)}</div>` : ''}
${sale.igst_total > 0 ? `<div style="text-align:right">IGST 18%: Rs.${Number(sale.igst_total).toFixed(2)}</div>` : ''}
<div class="total">GRAND TOTAL: Rs.${Number(sale.grand_total).toFixed(2)}</div>
<div class="footer">Thank you! Visit again.<br>This is a computer generated receipt.</div>
<script>window.onload=function(){ window.print(); setTimeout(function(){ window.close(); },3000); };</script>
</body></html>`;

    const tempHtml = path.join(dataDir, `receipt_${saleId}_${Date.now()}.html`);
    fs.writeFileSync(tempHtml, htmlContent);

    exec(`start "" "${tempHtml}"`, (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      // Clean up after a delay
      setTimeout(() => { try { fs.unlinkSync(tempHtml); } catch(e) {} }, 30000);
      res.json({ success: true, message: 'Receipt sent to printer' });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
