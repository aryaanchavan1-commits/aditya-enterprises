import 'dart:io';

class AppConstants {
  static const String appName = 'ArynoxTech ERP Suite 2026';
  static const String companyName = 'Sainath Enterprises';
  static const String version = '1.0.0';
  static const String buildNumber = '2026.06.17';

  // Base Paths
  static String get basePath {
    if (Platform.isWindows) {
      return r'D:\ArynoxTechERP';
    } else if (Platform.isAndroid) {
      return '/storage/emulated/0/ArynoxTechERP';
    }
    return './ArynoxTechERP';
  }

  static String get databasePath => '$basePath\Database';
  static String get imagesPath => '$basePath\Images';
  static String get productImagesPath => '$basePath\data\images\products';
  static String get backupsPath => '$basePath\Backups';
  static String get reportsPath => '$basePath\Reports';
  static String get exportsPath => '$basePath\Exports';
  static String get logsPath => '$basePath\Logs';
  static String get aiPath => '$basePath\AI';
  static String get configPath => '$basePath\Config';
  static String get barcodesPath => '$basePath\Barcodes';
  static String get invoicesPath => '$basePath\Invoices';

  // API Configuration
  static const String apiBaseUrl = 'http://127.0.0.1:8000';
  static const String apiVersion = 'v1';
  static const int apiTimeout = 30000;

  // Groq AI
  static const String groqBaseUrl = 'https://api.groq.com/openai/v1';
  static const String groqApiKey = 'YOUR_GROQ_API_KEY'; // Store in secure storage

  // Platform Detection
  static bool get isDesktop => Platform.isWindows || Platform.isLinux || Platform.isMacOS;
  static bool get isMobile => Platform.isAndroid || Platform.isIOS;
  static bool get isWindows => Platform.isWindows;
  static bool get isAndroid => Platform.isAndroid;

  // Feature Flags
  static const bool enableLogin = false; // Disabled by default as per requirement
  static const bool enableCloudSync = false;
  static const bool enableAutoBackup = true;
  static const bool enableAI = true;
  static const bool enableBarcode = true;
  static const bool enableThermalPrint = true;

  // Pagination
  static const int defaultPageSize = 50;
  static const int maxPageSize = 500;

  // Image Settings
  static const int maxImageSizeMB = 10;
  static const int thumbnailWidth = 300;
  static const int thumbnailHeight = 300;
  static const int imageQuality = 85;
  static const List<String> allowedImageExtensions = ['jpg', 'jpeg', 'png', 'webp'];

  // Barcode Settings
  static const List<String> supportedBarcodeTypes = [
    'CODE128',
    'EAN13',
    'EAN8',
    'UPC',
    'QR',
  ];

  // GST Settings (India)
  static const double defaultGSTPercentage = 18.0;
  static const List<double> gstSlabs = [0, 5, 12, 18, 28];

  // Currency
  static const String currencySymbol = '₹';
  static const String currencyCode = 'INR';

  // Date Formats
  static const String dateFormat = 'dd-MM-yyyy';
  static const String dateTimeFormat = 'dd-MM-yyyy HH:mm:ss';
  static const String timeFormat = 'HH:mm:ss';
}
