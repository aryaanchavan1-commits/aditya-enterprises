const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');

const isWindows = process.platform === 'win32';

function runPowerShell(script, cb) {
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    timeout: 15000,
    maxBuffer: 1024 * 1024,
    windowsHide: true
  }, (err, stdout, stderr) => cb(err, stdout || '', stderr || ''));
}

// Real printer enumeration only works when this API runs on the same
// Windows machine as the printer (e.g. `npm run dev` on the shop PC).
// On the cloud (Render/Vercel) there are no local printers, so we return
// guidance instead of fake entries.
router.get('/printers', (req, res) => {
  if (!isWindows) {
    return res.json({
      success: true,
      data: [],
      message: 'This API runs on the cloud, so it cannot see your USB printer. Pair your thermal printer via Bluetooth in the Settings page, or use the browser print dialog (Print Receipt) which shows printers installed in Windows.'
    });
  }

  const script = "Get-CimInstance Win32_Printer | Select-Object Name, PortName, DriverName, Default, Shared | ConvertTo-Json -Compress";
  runPowerShell(script, (err, stdout) => {
    if (err || !stdout.trim()) {
      return res.json({ success: true, data: [], message: 'No Windows printers found or PowerShell unavailable.' });
    }
    try {
      let list = JSON.parse(stdout);
      if (!Array.isArray(list)) list = [list];
      const printers = list
        .filter(p => p && p.Name)
        .map(p => ({
          type: 'printer',
          name: p.Name,
          port: p.PortName || '',
          driver: p.DriverName || '',
          source: 'windows',
          isDefault: !!p.Default
        }));
      res.json({ success: true, data: printers });
    } catch (e) {
      res.json({ success: true, data: [], message: 'Printer enumeration failed.' });
    }
  });
});

router.get('/scanners', (req, res) => {
  res.json({
    success: true, data: [],
    message: 'Barcode scanners work automatically - scan into any focused input field.'
  });
});

// Test print through the installed Windows driver when running locally.
router.post('/print-test', (req, res) => {
  if (!isWindows || !req.body || !req.body.printer_path) {
    return res.json({ success: true, message: 'Web version: use Print Receipt (browser dialog) or pair the printer via Bluetooth in Settings for direct printing.' });
  }
  const name = String(req.body.printer_path).replace(/[^a-zA-Z0-9 _\-()]/g, '');
  const script = `$t = 'Aditya Enterprises - Printer Test - ' + (Get-Date -Format 'HH:mm:ss'); $t | Out-Printer -Name '${name}'`;
  runPowerShell(script, (err, stdout, stderr) => {
    if (err && !stderr.includes('completed')) {
      return res.json({ success: false, error: `Print failed: ${(stderr || err.message).slice(0, 200)}` });
    }
    res.json({ success: true, message: `Test print sent to ${name}` });
  });
});

module.exports = router;
