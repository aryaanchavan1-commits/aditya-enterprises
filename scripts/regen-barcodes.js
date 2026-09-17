// Standalone script: regenerate ALL product barcodes as fresh unique UPC-A,
// save new PNG images, and delete old barcode files from disk.
// Run: node scripts/regen-barcodes.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createClient } = require('@libsql/client');
const bwipjs = require('bwip-js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const BARCODES_DIR = path.join(DATA_DIR, 'barcodes');

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url) { console.error('TURSO_DATABASE_URL not set'); process.exit(1); }

  const db = createClient({ url, authToken: token });
  await db.execute('SELECT 1');
  console.log('Connected to Turso.');

  // 1. Fetch all products.
  const { rows } = await db.execute('SELECT id, name, barcode, barcode_image FROM products ORDER BY id');
  console.log(`Found ${rows.length} product(s).`);

  if (!rows.length) { console.log('No products to process.'); return; }

  // 2. Build set of old barcode PNG filenames to delete later.
  const oldFiles = new Set();
  for (const r of rows) {
    if (r.barcode_image) {
      const fname = path.basename(String(r.barcode_image));
      if (fname && fname !== '.png') oldFiles.add(fname);
    }
  }

  // 3. Generate fresh unique UPC-A for every product.
  const usedCodes = new Set();

  function upcaCheckDigit(digits11) {
    const d = String(digits11).split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 11; i++) sum += d[i] * (i % 2 === 0 ? 3 : 1);
    return (10 - (sum % 10)) % 10;
  }

  function randomUpca() {
    let d = '0';
    for (let i = 0; i < 10; i++) d += Math.floor(Math.random() * 10);
    d += upcaCheckDigit(d);
    return d;
  }

  async function uniqueUpca() {
    for (let i = 0; i < 100; i++) {
      const code = randomUpca();
      if (usedCodes.has(code)) continue;
      const dup = await db.execute({ sql: 'SELECT id FROM products WHERE barcode = ?', args: [code] });
      if (dup.rows.length === 0) { usedCodes.add(code); return code; }
    }
    throw new Error('Could not generate unique UPC-A');
  }

  // Ensure barcodes dir exists.
  fs.mkdirSync(BARCODES_DIR, { recursive: true });

  let migrated = 0;
  for (const product of rows) {
    const code = await uniqueUpca();
    const png = await new Promise((resolve, reject) => {
      bwipjs.toBuffer(
        { bcid: 'upca', text: code, scale: 4, height: 15, includetext: true, textxalign: 'center', backgroundcolor: 'FFFFFF' },
        (err, buf) => err ? reject(err) : resolve(buf)
      );
    });
    const fname = `${code}.png`;
    fs.writeFileSync(path.join(BARCODES_DIR, fname), png);
    const webPath = `/data/barcodes/${fname}`;
    await db.execute({
      sql: 'UPDATE products SET barcode = ?, barcode_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [code, webPath, product.id]
    });
    migrated++;
    console.log(`  [${migrated}/${rows.length}] ${product.name} -> ${code}`);
  }

  // 4. Delete old barcode PNG files that are no longer referenced.
  let deleted = 0;
  for (const fname of oldFiles) {
    const fpath = path.join(BARCODES_DIR, fname);
    try {
      if (fs.existsSync(fpath)) { fs.unlinkSync(fpath); deleted++; }
    } catch (e) { console.warn(`  Could not delete ${fname}: ${e.message}`); }
  }

  console.log(`\nDone. Migrated ${migrated} barcodes. Deleted ${deleted} old PNG file(s).`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
