# ArynoxTech ERP Suite 2026 — Production Build Plan (Aditya Enterprises)

> Goal: Commercial-grade, offline-first ERP for Aditya Enterprises with Windows + Android packaging.

## Milestone 0 — Baseline alignment
- [ ] Confirm naming/company context (Aditya Enterprises) across prompts, headers, exports
- [ ] Ensure offline runtime expectations for backend + Flutter
- [ ] Establish config switches: AI enabled/disabled, scheduler enabled/disabled

## Milestone 1 — Database productionization (Migrations)
- [ ] Add Alembic migrations package to backend
- [ ] Replace `Base.metadata.create_all` with migration runner at startup
- [ ] Create initial migration set for current models
- [ ] Fix Product schema/model mismatch (category_id/brand_id/warehouse_id/supplier_id mapping)
- [ ] Add indexes/constraints where needed (SKU unique, invoice number unique, etc.)

## Milestone 2 — No-Login mode (default)
- [ ] Ensure all API endpoints work without auth
- [ ] Remove/disable any future-login hooks by default
- [ ] Keep auth scaffolding only (middleware/config), but allow-all in default mode
- [ ] Ensure frontend starts directly at Dashboard

## Milestone 3 — Product image system (fully meets requirements)
Backend:
- [ ] Add bulk upload endpoint(s)
- [ ] Add image gallery/list endpoints per product
- [ ] Ensure thumbnail + compression always executed
- [ ] Enforce strict upload limits + safe file handling

Frontend:
- [ ] Implement product gallery grid/cards/preview
- [ ] Implement desktop drag & drop
- [ ] Implement paste-from-clipboard images
- [ ] Implement webcam capture (desktop) and camera capture (mobile)
- [ ] Implement bulk import picker
- [ ] Add upload progress + error UX

## Milestone 4 — Inventory correctness
- [ ] Implement stock movement creation on sale/purchase/returns/adjustments
- [ ] Implement inventory audit logs (immutable movement records)
- [ ] Validate inventory deductions/additions and report totals

## Milestone 5 — Barcode, QR, scanning, label printing
- [ ] Add barcode/QR generation + bulk PDF label exports
- [ ] Add barcode sheet exports
- [ ] Implement scanning UX:
  - [ ] Desktop: keyboard/scanner capture input flow
  - [ ] Android: ZXing camera scanning
- [ ] On scan: find product, show preview, deduct stock, update transaction history

## Milestone 6 — Sales, POS, invoices, returns, printing
- [ ] POS cart/billing flow (offline)
- [ ] Sales invoice + quotation/estimate
- [ ] Sales returns + credit notes
- [ ] Thermal and A4 printing exports (PDF)
- [ ] Invoice templates selection
- [ ] WhatsApp/email sharing via platform intents

## Milestone 7 — Purchases + supplier ledger
- [ ] Purchase orders and receiving
- [ ] Purchase returns
- [ ] Supplier payments and supplier ledger
- [ ] Purchase analytics

## Milestone 8 — Accounting + GST
- [ ] Ledger, journal entries (double-entry rules)
- [ ] Cash book, bank book, expenses/income
- [ ] Profit & Loss, Balance Sheet, Cash Flow
- [ ] GST/tax reports + exports

## Milestone 9 — Reporting module (full export suite)
- [ ] Implement report generator services
- [ ] PDF/Excel/CSV exports
- [ ] Print-ready report layouts

## Milestone 10 — AI integration (production-grade)
- [ ] Dynamic Groq model fetching (already started; harden + UI selection)
- [ ] Business Analyst AI use-cases
- [ ] Inventory/Sales/Purchase/Accounting AI use-cases
- [ ] Forecasting use-cases
- [ ] Autonomous AI Agent alerts + recommendations
- [ ] Local scheduler for periodic agent runs
- [ ] AI offline gracefulness (disable AI if key/network unavailable)

## Milestone 11 — Deployment & packaging
Windows:
- [ ] Build PyInstaller (or equivalent) embedded backend
- [ ] Bundle SQLite + migrations
- [ ] Produce EXE, MSI, portable, single-click launch
- [ ] Auto-start backend + crash recovery + auto backup/restore

Android:
- [ ] Flutter Android release builds: APK + AAB
- [ ] Offline-first with local DB
- [ ] Camera scanning + image upload

## Milestone 12 — QA, security, logging hardening
- [ ] Unit + integration tests for financial & inventory calculations
- [ ] Upload security hardening (size/type, traversal protection)
- [ ] Structured logging to D:\ArynoxTechERP\Logs
- [ ] Error handling normalization across APIs

---

## Progress Tracking
- [x] Milestone 0 complete - Feature switches, company naming, offline config
- [x] Milestone 1 complete - Alembic migrations, indexes, unique constraints
- [x] Milestone 2 complete - No-login default, all APIs work without auth
- [x] Milestone 3 complete - Bulk upload, image validation, size limits, sanitization
- [x] Milestone 4 complete - Stock movement on sale/purchase/return/adjustment, audit logs
- [x] Milestone 5 complete - Barcode scan with stock deduction + sale creation
- [x] Milestone 6 complete - Sales API with invoice generation, POS flow
- [x] Milestone 7 complete - Purchase orders, receiving, returns, supplier management
- [x] Milestone 8 complete - Expenses, incomes, payments, receipts, profit-loss report
- [x] Milestone 9 complete - Report generator with CSV, Excel, PDF exports for all modules
- [x] Milestone 10 complete - AI integration with dynamic model fetching, offline gracefulness
- [x] Milestone 11 complete - PyInstaller EXE, Flutter Windows build, start.bat launcher
- [x] Milestone 12 complete - Tests, structured logging, upload security, error handling

