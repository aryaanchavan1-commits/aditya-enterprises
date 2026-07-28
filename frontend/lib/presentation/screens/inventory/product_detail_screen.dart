import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../widgets/common/custom_app_bar.dart';
import '../../widgets/common/sidebar.dart';

class ProductDetailScreen extends ConsumerWidget {
  final String productId;
  const ProductDetailScreen({super.key, required this.productId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDesktop = MediaQuery.of(context).size.width > 1200;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.background,
      body: Row(
        children: [
          if (isDesktop) const Sidebar(),
          Expanded(
            child: Column(
              children: [
                CustomAppBar(
                  title: 'Product Details',
                  showBackButton: true,
                  actions: [
                    TextButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.edit),
                      label: const Text('Edit'),
                    ),
                    const SizedBox(width: 8),
                    TextButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.print),
                      label: const Text('Print Barcode'),
                    ),
                    const SizedBox(width: 16),
                  ],
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        _buildProductHeader(context),
                        const SizedBox(height: 24),
                        _buildProductInfo(context),
                        const SizedBox(height: 24),
                        _buildStockHistory(context),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductHeader(BuildContext context) {
    return Container(
      decoration: AppTheme.glassmorphismLight.copyWith(
        color: Theme.of(context).colorScheme.surface,
      ),
      padding: const EdgeInsets.all(24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Product Image
          Container(
            width: 200,
            height: 200,
            decoration: BoxDecoration(
              color: AppTheme.lightBorder,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.image, size: 64, color: AppTheme.lightTextSecondary),
          ),
          const SizedBox(width: 24),
          // Product Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Product Name #$productId',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text('SKU: SKU-$productId | HSN: 1234', style: TextStyle(color: AppTheme.lightTextSecondary)),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  children: [
                    Chip(label: const Text('Electronics'), backgroundColor: AppTheme.primaryColor.withOpacity(0.1)),
                    Chip(label: const Text('In Stock'), backgroundColor: AppTheme.successColor.withOpacity(0.1)),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    _buildPriceCard('Purchase Price', 'Rs.850', AppTheme.infoColor),
                    const SizedBox(width: 16),
                    _buildPriceCard('Selling Price', 'Rs.1,250', AppTheme.successColor),
                    const SizedBox(width: 16),
                    _buildPriceCard('Profit Margin', '47%', AppTheme.warningColor),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPriceCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
          Text(label, style: TextStyle(fontSize: 12, color: color)),
        ],
      ),
    );
  }

  Widget _buildProductInfo(BuildContext context) {
    return Container(
      decoration: AppTheme.glassmorphismLight.copyWith(
        color: Theme.of(context).colorScheme.surface,
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Product Information', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          _buildInfoRow('Brand', 'Brand Name'),
          _buildInfoRow('Unit', 'PCS'),
          _buildInfoRow('GST Rate', '18%'),
          _buildInfoRow('Minimum Stock', '10'),
          _buildInfoRow('Maximum Stock', '500'),
          _buildInfoRow('Current Stock', '45'),
          _buildInfoRow('Warehouse', 'Main Warehouse'),
          _buildInfoRow('Location', 'A-12'),
          _buildInfoRow('Supplier', 'Supplier Name'),
          _buildInfoRow('Barcode', 'ARNXSKU-$productId'),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(label, style: TextStyle(color: AppTheme.lightTextSecondary)),
          ),
          Expanded(
            flex: 3,
            child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }

  Widget _buildStockHistory(BuildContext context) {
    return Container(
      decoration: AppTheme.glassmorphismLight.copyWith(
        color: Theme.of(context).colorScheme.surface,
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Stock Movement History', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 5,
            itemBuilder: (context, index) => ListTile(
              leading: CircleAvatar(
                backgroundColor: index % 2 == 0 ? AppTheme.successColor.withOpacity(0.1) : AppTheme.errorColor.withOpacity(0.1),
                child: Icon(
                  index % 2 == 0 ? Icons.arrow_downward : Icons.arrow_upward,
                  color: index % 2 == 0 ? AppTheme.successColor : AppTheme.errorColor,
                ),
              ),
              title: Text(index % 2 == 0 ? 'Stock Received' : 'Stock Sold'),
              subtitle: Text('${index + 1} units • ${DateTime.now().subtract(Duration(days: index)).toString().split(" ")[0]}'),
              trailing: Text(
                '${index % 2 == 0 ? "+" : "-"}${index + 1}',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: index % 2 == 0 ? AppTheme.successColor : AppTheme.errorColor,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
