# USB Print Bridge (for the shop PC)

Browser apps **cannot** send raw data to a USB printer directly, so printing
via USB goes through this tiny bridge: it runs on the Windows PC where the
thermal printer is connected, polls the ERP server for queued print jobs, and
prints them as raw ESC/POS (receipts, test prints, and barcode labels).

## Requirements

- Windows 10/11 with the Posiflow thermal printer connected via USB
- Node.js 14+ installed (https://nodejs.org)
- No npm dependencies - nothing to install

## One-time setup

1. **Share the printer in Windows**
   - Settings -> Bluetooth & devices -> Printers & scanners
   - Select the Posiflow printer -> Printer properties -> Sharing tab
   - Tick **"Share this printer"** and note the share name (e.g. `POS58`).

2. **Start the bridge**
   - Double-click `start-bridge.bat`
   - First run auto-detects your printer and saves it to `config.json`.
   - You should see: `Auto-detected printer "Posiflow..." (share: POS58)`.
   - If it says printers are not shared, redo step 1.
   - Keep this window open - closing it stops the bridge.

3. **Test from the web app**
   - Open the ERP web app -> Settings -> USB Bridge -> **Test Print via USB**.
   - The test receipt should print within ~5 seconds.

## config.json

Created automatically on first run. To point at a different printer, edit it:

```json
{
  "printerName": "Posiflow 58mm",
  "printerShare": "POS58"
}
```

(`printerName` is the Windows name used for text fallback; `printerShare`
is the share name used for raw ESC/POS printing.)

## How it works

1. Web app posts a job to `POST /api/print/job` (receipt / label / test).
2. Bridge polls `GET /api/print/job/next` every 3 seconds, claims the job,
   and marks itself online (`bridge_last_seen` heartbeat).
3. Bridge builds ESC/POS bytes (Code128 barcode raster for labels) and copies
   them to the printer's Windows share (`\\localhost\SHARE`) as a raw print.
4. If the share copy fails, it falls back to plain text via PowerShell.
5. Result is posted back to `POST /api/print/job/:id/status`.

## Troubleshooting

- **"No printer found"** - printer not connected or Windows driver not
  installed. Reconnect USB and restart the bridge.
- **"none are shared"** - share the printer (step 1 above), or let the bridge
  fall back to text-only printing.
- **Bridge shows Offline in the app** - the server marks it offline if no job
  poll/heartbeat is seen for 20 seconds; check the window is open and the PC
  has internet.
- **Wrong server** - set the `AE_API` env var to your API URL before starting:
  `set AE_API=https://your-api.onrender.com` (or edit the API constant at the
  top of `bridge.js`).
