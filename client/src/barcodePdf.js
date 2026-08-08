// Client-side barcode label PDF generator (jsPDF).
// Quantity-wise: every product automatically gets exactly as many labels as
// its current stock, grouped by category with banners.
// Labels are laid out on an A4 grid of 62x35mm cells (3 cols x 7 rows).

import { jsPDF } from 'jspdf';
import { encodePattern } from './barcode';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 8;
const CELL_W = 62;
const CELL_H = 35;
const COLS = 3;
const ROWS = 7;
const BANNER_H = 13;

function drawLabel(doc, x, y, p) {
  const pad = 2.5;
  const inner = CELL_W - pad * 2;
  const cx = x + pad;

  // White card + light border.
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, CELL_W, CELL_H, 'F');
  doc.setDrawColor(190, 190, 190);
  doc.setLineWidth(0.2);
  doc.rect(x, y, CELL_W, CELL_H, 'S');

  // Product name - up to 2 lines, bold.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  let nameLines = doc.splitTextToSize(String(p.name || ''), inner);
  if (nameLines.length > 2) nameLines = [nameLines[0], nameLines[1].slice(0, 22) + '...'];
  doc.text(nameLines, cx, y + 5.2);
  const nameUsed = nameLines.length * 4.6;

  // Price - prominent, bold.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  const priceY = y + 5.2 + nameUsed + 4.4;
  doc.text('Rs. ' + Number(p.sell_price || 0).toLocaleString('en-IN'), cx, priceY);
  doc.setTextColor(0, 0, 0);

  // Barcode - drawn as vector bars directly into the PDF. No image embedding:
  // jsPDF's PNG pipeline can silently collapse canvas images (and vectors are
  // razor-sharp at any print DPI, so bars always stay scannable).
  const pattern = p.barcode ? encodePattern(String(p.barcode)) : null;
  if (pattern) {
    const skuTop = y + CELL_H - 2 - 3.2; // SKU baseline minus a margin
    const avail = skuTop - (priceY + 3);
    const barH = Math.min(14, Math.max(9, avail));
    const quiet = 10; // modules of quiet zone each side
    let moduleW = inner / (pattern.length + quiet * 2);
    if (moduleW < 0.25) moduleW = 0.25; // never below a printable X-dimension
    const totalW = (pattern.length + quiet * 2) * moduleW;
    let barX = cx + (inner - totalW) / 2;
    if (barX < x) barX = x; // very long codes may use the full card width
    const barY = priceY + 3;
    doc.setFillColor(0, 0, 0);
    let bx = barX + quiet * moduleW;
    let isBar = true;
    for (const m of pattern) {
      if (isBar) doc.rect(bx, barY, m * moduleW, barH, 'F');
      bx += m * moduleW;
      isBar = !isBar;
    }
  }

  // SKU at the bottom, small gray.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  const sku = String(p.serial_number || p.barcode || '');
  doc.text(sku.slice(0, 30), cx, y + CELL_H - 2);
  doc.setTextColor(0, 0, 0);
}

function categoryBanner(doc, name) {
  // No banner - products only. The blue category header wasted label space
  // and confused users into thinking it was a product. Categories are kept
  // together in order but every printed cell is a real product label.
}

// Quantity-wise, category-bannered barcode label PDF.
// Every product gets exactly as many labels as its current stock quantity.
export function generateBarcodesPdf(products) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  let row = 0;
  let col = 0;
  let yOffset = 0; // vertical shift when a banner sits above the grid
  let totalLabels = 0;

  const place = (p) => {
    if (row >= ROWS) { doc.addPage(); row = 0; col = 0; yOffset = 0; }
    const x = MARGIN + col * CELL_W;
    const y = MARGIN + yOffset + row * CELL_H;
    drawLabel(doc, x, y, p);
    totalLabels++;
    col++;
    if (col >= COLS) { col = 0; row++; }
  };

  // Group products by category name (blanks go to 'Uncategorised' last).
  const grouped = {};
  const uncat = [];
  for (const p of products) {
    const c = String(p.category_name || '').trim();
    if (c) (grouped[c] = grouped[c] || []).push(p);
    else uncat.push(p);
  }
  const names = Object.keys(grouped).sort();
  if (uncat.length > 0) names.push('Uncategorised');
  const listOf = (n) => (n === 'Uncategorised' ? uncat : grouped[n]);

  for (const name of names) {
    const list = listOf(name);
    let bannerPlaced = false;

    for (const p of list) {
      const copies = Math.max(0, Number(p.quantity) || 0);
      if (copies <= 0) continue;

      // Banner once per category - fresh page so the section starts clean.
      if (!bannerPlaced) {
        bannerPlaced = true;
        if (row !== 0 || col !== 0 || yOffset !== 0) { doc.addPage(); row = 0; col = 0; }
        categoryBanner(doc, name);
        yOffset = BANNER_H + 2;
      }

      for (let i = 0; i < copies; i++) place(p);
      // Blank cell separator between different products for easy cutting.
      if (col > 0) { col++; if (col >= COLS) { col = 0; row++; } }
    }
  }

  if (totalLabels === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('No barcode labels to print.', 20, 40);
  }

  return { doc, totalLabels };
}

// Convenience: generate + save directly. Returns the label count.
export function downloadBarcodesPdf(products) {
  const { doc, totalLabels } = generateBarcodesPdf(products);
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`barcodes_${stamp}.pdf`);
  return totalLabels;
}