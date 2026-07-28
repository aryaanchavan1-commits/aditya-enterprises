import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../presentation/screens/dashboard/dashboard_screen.dart';
import '../presentation/screens/inventory/inventory_screen.dart';
import '../presentation/screens/inventory/product_detail_screen.dart';
import '../presentation/screens/inventory/add_product_screen.dart';
import '../presentation/screens/sales/sales_screen.dart';
import '../presentation/screens/sales/pos_screen.dart';
import '../presentation/screens/sales/invoice_screen.dart';
import '../presentation/screens/purchase/purchase_screen.dart';
import '../presentation/screens/accounting/accounting_screen.dart';
import '../presentation/screens/reports/reports_screen.dart';
import '../presentation/screens/ai_assistant/ai_assistant_screen.dart';
import '../presentation/screens/barcode/barcode_screen.dart';
import '../presentation/screens/settings/settings_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    debugLogDiagnostics: true,
    routes: [
      // Dashboard
      GoRoute(
        path: '/',
        name: 'dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),

      // Inventory
      GoRoute(
        path: '/inventory',
        name: 'inventory',
        builder: (context, state) => const InventoryScreen(),
      ),
      GoRoute(
        path: '/inventory/add',
        name: 'addProduct',
        builder: (context, state) => const AddProductScreen(),
      ),
      GoRoute(
        path: '/inventory/:id',
        name: 'productDetail',
        builder: (context, state) => ProductDetailScreen(
          productId: state.pathParameters['id']!,
        ),
      ),

      // Sales
      GoRoute(
        path: '/sales',
        name: 'sales',
        builder: (context, state) => const SalesScreen(),
      ),
      GoRoute(
        path: '/sales/pos',
        name: 'pos',
        builder: (context, state) => const POSScreen(),
      ),
      GoRoute(
        path: '/sales/invoice/:id',
        name: 'invoice',
        builder: (context, state) => InvoiceScreen(
          invoiceId: state.pathParameters['id']!,
        ),
      ),

      // Purchase
      GoRoute(
        path: '/purchase',
        name: 'purchase',
        builder: (context, state) => const PurchaseScreen(),
      ),

      // Accounting
      GoRoute(
        path: '/accounting',
        name: 'accounting',
        builder: (context, state) => const AccountingScreen(),
      ),

      // Reports
      GoRoute(
        path: '/reports',
        name: 'reports',
        builder: (context, state) => const ReportsScreen(),
      ),

      // AI Assistant
      GoRoute(
        path: '/ai-assistant',
        name: 'aiAssistant',
        builder: (context, state) => const AIAssistantScreen(),
      ),

      // Barcode
      GoRoute(
        path: '/barcode',
        name: 'barcode',
        builder: (context, state) => const BarcodeScreen(),
      ),

      // Settings
      GoRoute(
        path: '/settings',
        name: 'settings',
        builder: (context, state) => const SettingsScreen(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Text('Page not found: ${state.uri.path}'),
      ),
    ),
  );
});

// Theme mode provider
final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.system);
