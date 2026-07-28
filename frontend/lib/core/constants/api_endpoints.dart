class ApiEndpoints {
  static const String base = '/api/v1';

  // Auth (Optional - disabled by default)
  static const String login = '$base/auth/login';
  static const String register = '$base/auth/register';

  // Dashboard
  static const String dashboard = '$base/dashboard';
  static const String dashboardStats = '$base/dashboard/stats';
  static const String dashboardCharts = '$base/dashboard/charts';

  // Inventory
  static const String products = '$base/products';
  static const String productDetail = '$base/products/{id}';
  static const String productImages = '$base/products/{id}/images';
  static const String productBarcode = '$base/products/{id}/barcode';
  static const String categories = '$base/categories';
  static const String brands = '$base/brands';
  static const String warehouses = '$base/warehouses';
  static const String stockMovement = '$base/stock-movement';
  static const String inventoryAudit = '$base/inventory/audit';
  static const String lowStock = '$base/inventory/low-stock';
  static const String deadStock = '$base/inventory/dead-stock';

  // Sales
  static const String sales = '$base/sales';
  static const String saleDetail = '$base/sales/{id}';
  static const String quotations = '$base/quotations';
  static const String estimates = '$base/estimates';
  static const String salesReturns = '$base/sales-returns';
  static const String creditNotes = '$base/credit-notes';
  static const String pos = '$base/pos';
  static const String customers = '$base/customers';

  // Purchase
  static const String purchases = '$base/purchases';
  static const String purchaseDetail = '$base/purchases/{id}';
  static const String purchaseOrders = '$base/purchase-orders';
  static const String purchaseReturns = '$base/purchase-returns';
  static const String suppliers = '$base/suppliers';
  static const String supplierPayments = '$base/supplier-payments';

  // Accounting
  static const String cashBook = '$base/accounting/cash-book';
  static const String bankBook = '$base/accounting/bank-book';
  static const String expenses = '$base/accounting/expenses';
  static const String income = '$base/accounting/income';
  static const String payments = '$base/accounting/payments';
  static const String receipts = '$base/accounting/receipts';
  static const String journalEntries = '$base/accounting/journal-entries';
  static const String ledger = '$base/accounting/ledger';
  static const String profitLoss = '$base/accounting/profit-loss';
  static const String balanceSheet = '$base/accounting/balance-sheet';
  static const String gstReports = '$base/accounting/gst-reports';

  // Barcode
  static const String generateBarcode = '$base/barcodes/generate';
  static const String generateQR = '$base/barcodes/generate-qr';
  static const String bulkBarcode = '$base/barcodes/bulk';
  static const String scanBarcode = '$base/barcodes/scan';
  static const String barcodeLabels = '$base/barcodes/labels';

  // Reports
  static const String reports = '$base/reports';
  static const String exportReport = '$base/reports/export';
  static const String printReport = '$base/reports/print';

  // AI
  static const String aiModels = '$base/ai/models';
  static const String aiChat = '$base/ai/chat';
  static const String aiAnalyze = '$base/ai/analyze';
  static const String aiForecast = '$base/ai/forecast';
  static const String aiAgent = '$base/ai/agent';
  static const String aiReport = '$base/ai/report';

  // Backup
  static const String backup = '$base/backup';
  static const String restore = '$base/backup/restore';
  static const String autoBackup = '$base/backup/auto';

  // Settings
  static const String settings = '$base/settings';
  static const String companySettings = '$base/settings/company';
  static const String printSettings = '$base/settings/print';
  static const String taxSettings = '$base/settings/tax';
}
