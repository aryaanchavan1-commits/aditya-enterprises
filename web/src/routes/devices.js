const express = require('express');
const router = express.Router();

router.get('/printers', (req, res) => {
  res.json({
    success: true, data: [
      { type: 'printer', name: 'Browser Print (PDF)', port: 'PDF', source: 'web' },
      { type: 'printer', name: 'System Default Printer', port: 'DEFAULT', source: 'web' }
    ],
    message: 'Web version uses browser print. Connect a printer to your device and use Ctrl+P / Cmd+P.'
  });
});

router.get('/scanners', (req, res) => {
  res.json({
    success: true, data: [],
    message: 'Barcode scanners work automatically - scan into any focused input field.'
  });
});

router.post('/print-test', (req, res) => {
  res.json({ success: true, message: 'Print test: Use browser print (Ctrl+P) for the web version.' });
});

module.exports = router;
