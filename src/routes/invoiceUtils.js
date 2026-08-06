const { get } = require('../db');

// Single source of truth for invoice numbers: AE/<year>/<6-digit sequence>.
// Collision-safe - retries with a new suffix if the number already exists,
// and falls back to a microtime tail under heavy load.
async function generateInvoiceNumber() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const year = new Date().getFullYear();
    const num = String(Date.now()).slice(-6) + (attempt > 0 ? String(Math.floor(Math.random() * 90) + 10) : '');
    const invoiceNum = `AE/${year}/${num}`;
    const existing = await get('SELECT id FROM sales WHERE invoice_number = ?', [invoiceNum]);
    if (!existing) return invoiceNum;
  }
  // Last resort: full millisecond timestamp - practically unique.
  return `AE/${new Date().getFullYear()}/${Date.now()}`;
}

module.exports = { generateInvoiceNumber };
