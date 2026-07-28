import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../widgets/common/custom_app_bar.dart';
import '../../widgets/common/sidebar.dart';

class InventoryScreen extends ConsumerWidget {
  const InventoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDesktop = MediaQuery.of(context).size.width > 1200;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.background,
      drawer: isDesktop ? null : const Drawer(child: Sidebar()),
      body: Row(
        children: [
          if (isDesktop) const Sidebar(),
          Expanded(
            child: Column(
              children: [
                const CustomAppBar(title: 'Inventory Management'),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildActionBar(context),
                        const SizedBox(height: 16),
                        _buildFilterBar(context),
                        const SizedBox(height: 16),
                        Expanded(child: _buildProductTable(context)),
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

  Widget _buildActionBar(BuildContext context) {
    return Row(
      children: [
        ElevatedButton.icon(
          onPressed: () => context.push('/inventory/add'),
          icon: const Icon(Icons.add),
          label: const Text('Add Product'),
        ),
        const SizedBox(width: 12),
        OutlinedButton.icon(
          onPressed: () {},
          icon: const Icon(Icons.upload_file),
          label: const Text('Import'),
        ),
        const SizedBox(width: 12),
        OutlinedButton.icon(
          onPressed: () {},
          icon: const Icon(Icons.download),
          label: const Text('Export'),
        ),
        const Spacer(),
        OutlinedButton.icon(
          onPressed: () {},
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('Scan Barcode'),
        ),
      ],
    );
  }

  Widget _buildFilterBar(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: AppTheme.glassmorphismLight.copyWith(
        color: Theme.of(context).colorScheme.surface,
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search by name, SKU, barcode...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Theme.of(context).colorScheme.background,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              hint: const Text('Category'),
              items: const [
                DropdownMenuItem(value: 'all', child: Text('All Categories')),
                DropdownMenuItem(value: 'electronics', child: Text('Electronics')),
                DropdownMenuItem(value: 'clothing', child: Text('Clothing')),
              ],
              onChanged: (v) {},
            ),
          ),
          const SizedBox(width: 12),
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              hint: const Text('Stock Status'),
              items: const [
                DropdownMenuItem(value: 'all', child: Text('All')),
                DropdownMenuItem(value: 'low', child: Text('Low Stock')),
                DropdownMenuItem(value: 'out', child: Text('Out of Stock')),
              ],
              onChanged: (v) {},
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductTable(BuildContext context) {
    final columns = [
      'Image', 'Product Name', 'SKU', 'Category', 'Price', 'Stock', 'Status', 'Actions'
    ];

    return Container(
      decoration: AppTheme.glassmorphismLight.copyWith(
        color: Theme.of(context).colorScheme.surface,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Table Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withOpacity(0.05),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: columns.map((col) => 
                Expanded(
                  flex: col == 'Product Name' ? 3 : col == 'Actions' ? 2 : 1,
                  child: Text(col, style: const TextStyle(fontWeight: FontWeight.w600)),
                )
              ).toList(),
            ),
          ),
          const Divider(height: 1),
          // Table Body
          Expanded(
            child: ListView.builder(
              itemCount: 10,
              itemBuilder: (context, index) {
                final isLowStock = index % 3 == 0;
                return InkWell(
                  onTap: () => context.push('/inventory/prod-$index'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: isLowStock ? AppTheme.warningColor.withOpacity(0.05) : null,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: AppTheme.lightBorder,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.image, color: AppTheme.lightTextSecondary),
                          ),
                        ),
                        Expanded(
                          flex: 3,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Product ${index + 1}', style: const TextStyle(fontWeight: FontWeight.w500)),
                              Text('Brand ${index + 1}', style: TextStyle(color: AppTheme.lightTextSecondary, fontSize: 12)),
                            ],
                          ),
                        ),
                        Expanded(child: Text('SKU-${1000 + index}')),
                        Expanded(child: Text('Category ${index % 5 + 1}')),
                        Expanded(child: Text('Rs.${(index + 1) * 150}')),
                        Expanded(child: Text('${50 - index * 5}')),
                        Expanded(
                          child: Chip(
                            label: Text(isLowStock ? 'Low Stock' : 'In Stock', style: const TextStyle(fontSize: 11)),
                            backgroundColor: isLowStock ? AppTheme.warningColor.withOpacity(0.2) : AppTheme.successColor.withOpacity(0.2),
                            side: BorderSide.none,
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                        Expanded(
                          flex: 2,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              IconButton(icon: const Icon(Icons.edit, size: 18), onPressed: () {}),
                              IconButton(icon: const Icon(Icons.barcode_reader, size: 18), onPressed: () {}),
                              IconButton(icon: const Icon(Icons.delete, size: 18, color: AppTheme.errorColor), onPressed: () {}),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
