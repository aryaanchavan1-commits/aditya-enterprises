import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/constants/app_constants.dart';

class Sidebar extends ConsumerWidget {
  const Sidebar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentRoute = GoRouterState.of(context).uri.path;

    return Container(
      width: 260,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          right: BorderSide(color: Theme.of(context).dividerTheme.color ?? AppTheme.lightBorder),
        ),
      ),
      child: Column(
        children: [
          // Logo Section
          Container(
            padding: const EdgeInsets.all(24),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppTheme.primaryColor, AppTheme.secondaryColor],
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.business, color: Colors.white, size: 28),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ArynoxTech',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primaryColor,
                        ),
                      ),
                      Text(
                        'ERP Suite 2026',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.lightTextSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(),

          // Navigation Items
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                _buildNavItem(context, 'Dashboard', Icons.dashboard, '/', currentRoute),
                _buildNavItem(context, 'Inventory', Icons.inventory_2, '/inventory', currentRoute),
                _buildNavItem(context, 'Sales', Icons.point_of_sale, '/sales', currentRoute),
                _buildNavItem(context, 'Purchase', Icons.shopping_bag, '/purchase', currentRoute),
                _buildNavItem(context, 'Accounting', Icons.account_balance, '/accounting', currentRoute),
                _buildNavItem(context, 'Reports', Icons.assessment, '/reports', currentRoute),
                _buildNavItem(context, 'Barcode', Icons.qr_code_scanner, '/barcode', currentRoute),
                _buildNavItem(context, 'AI Assistant', Icons.psychology, '/ai-assistant', currentRoute),
                const Divider(),
                _buildNavItem(context, 'Settings', Icons.settings, '/settings', currentRoute),
              ],
            ),
          ),

          // Bottom Section
          Container(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Divider(),
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.store, color: AppTheme.primaryColor),
                  title: const Text('Sainath Enterprises', style: TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text('v${AppConstants.version}', style: const TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem(BuildContext context, String label, IconData icon, String route, String currentRoute) {
    final isSelected = currentRoute == route || currentRoute.startsWith('$route/');

    return ListTile(
      dense: true,
      leading: Icon(
        icon,
        color: isSelected ? AppTheme.primaryColor : AppTheme.lightTextSecondary,
        size: 22,
      ),
      title: Text(
        label,
        style: TextStyle(
          color: isSelected ? AppTheme.primaryColor : null,
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          fontSize: 14,
        ),
      ),
      selected: isSelected,
      selectedTileColor: AppTheme.primaryColor.withOpacity(0.08),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      onTap: () => context.go(route),
    );
  }
}
