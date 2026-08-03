const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const { get, all, run } = require('../db');

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

// ---------- Print job queue (for the local USB print bridge) ----------

// The web app creates a job here; the bridge app running on the shop PC
// polls for jobs and prints them raw (ESC/POS) to the USB printer.

router.post('/print/job', async (req, res) => {
  try {
    const { type, payload } = req.body || {};
    if (!['receipt', 'label', 'test'].includes(type)) { res.json({ success: false, error: 'Invalid print job type' }); return; }
    const r = await run('INSERT INTO print_jobs (type, payload) VALUES (?, ?)', [type, JSON.stringify(payload || {})]);
    res.json({ success: true, data: { id: r.id || r.lastID, type } });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// Polled by the bridge. Claims one pending job and reports heartbeat.
router.get('/print/job/next', async (req, res) => {
  try {
    // Recover jobs the bridge claimed but never finished (it crashed mid-print).
    await run("UPDATE print_jobs SET status = 'pending', claimed_at = NULL WHERE status = 'claimed' AND claimed_at < datetime('now', '-5 minutes')");
    await run("DELETE FROM print_jobs WHERE status IN ('done','failed') AND created_at < datetime('now', '-1 hour')");
    const job = await get("SELECT * FROM print_jobs WHERE status = 'pending' ORDER BY id LIMIT 1");
    if (job) {
      await run("UPDATE print_jobs SET status = 'claimed', claimed_at = datetime('now') WHERE id = ?", [job.id]);
      let payload = {};
      try { payload = JSON.parse(job.payload || '{}'); } catch (e) {}
      res.json({ success: true, data: { id: job.id, type: job.type, payload } });
      return;
    }
    await run("INSERT INTO settings (key, value) VALUES ('bridge_last_seen', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    res.json({ success: true, data: null });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// Called by the bridge after printing.
router.post('/print/job/:id/status', async (req, res) => {
  try {
    const { status, error } = req.body || {};
    const ok = status === 'done' || status === 'failed';
    await run(`UPDATE print_jobs SET status = ?, error = ?, done_at = datetime('now') WHERE id = ?`, [ok ? status : 'failed', (error || '').slice(0, 500), req.params.id]);
    res.json({ success: true });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// Called by the bridge to report which printer it detected on the shop PC.
router.post('/print/bridge/report', async (req, res) => {
  try {
    const { printerName, printerShare, version, lastError } = req.body || {};
    const vals = {
      bridge_printer: String(printerName || '').slice(0, 200),
      bridge_share: String(printerShare || '').slice(0, 100),
      bridge_version: String(version || '').slice(0, 50),
      bridge_last_error: String(lastError || '').slice(0, 300),
    };
    for (const [k, v] of Object.entries(vals)) {
      await run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [k, v]);
    }
    res.json({ success: true });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

// Status for the Settings page: is the bridge running?
router.get('/print/bridge/status', async (req, res) => {
  try {
    const seen = await get("SELECT value FROM settings WHERE key = 'bridge_last_seen'");
    const printer = await get("SELECT value FROM settings WHERE key = 'bridge_printer'");
    const share = await get("SELECT value FROM settings WHERE key = 'bridge_share'");
    const version = await get("SELECT value FROM settings WHERE key = 'bridge_version'");
    const lastError = await get("SELECT value FROM settings WHERE key = 'bridge_last_error'");
    const lastJob = await get("SELECT type, status, error, created_at, done_at FROM print_jobs ORDER BY id DESC LIMIT 1");
    let ts = seen?.value ? new Date(seen.value) : null;
    if (ts && isNaN(ts.getTime())) ts = new Date(seen.value.replace(' ', 'T') + 'Z');
    const online = !!ts && (Date.now() - ts.getTime()) < 25000;
    res.json({
      success: true,
      data: {
        bridgeOnline: online,
        lastSeen: ts ? ts.toISOString() : null,
        bridgePrinter: printer?.value || '',
        bridgeShare: share?.value || '',
        bridgeVersion: version?.value || '',
        bridgeLastError: lastError?.value || '',
        lastJob
      }
    });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
