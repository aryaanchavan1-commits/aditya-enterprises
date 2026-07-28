import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/constants/app_constants.dart';
import '../../widgets/common/sidebar.dart';
import '../../widgets/common/custom_app_bar.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

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
                const CustomAppBar(title: 'Dashboard'),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildStatsCards(context),
                        const SizedBox(height: 24),
                        _buildChartsSection(context),
                        const SizedBox(height: 24),
                        _buildQuickActions(context),
                        const SizedBox(height: 24),
                        _buildRecentActivity(context),
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

  Widget _buildStatsCards(BuildContext context) {
    final stats = [
      _StatCard('Total Products', '1,234', Icons.inventory, AppTheme.successColor, '/inventory'),
      _StatCard('Low Stock', '23', Icons.warning_amber, AppTheme.warningColor, '/inventory'),
      _StatCard("Today's Sales", 'Rs.45,678', Icons.trending_up, AppTheme.secondaryColor, '/sales'),
      _StatCard('Monthly Revenue', 'Rs.12.4L', Icons.account_balance_wallet, AppTheme.primaryColor, '/reports'),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 900 ? 4 : constraints.maxWidth > 600 ? 2 : 1;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 1.6,
          ),
          itemCount: stats.length,
          itemBuilder: (context, index) => _buildStatCard(context, stats[index]),
        );
      },
    );
  }

  Widget _buildStatCard(BuildContext context, _StatCard stat) {
    return InkWell(
      onTap: () => context.push(stat.route),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: AppTheme.glassmorphismLight.copyWith(
          color: Theme.of(context).colorScheme.surface,
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: stat.color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(stat.icon, color: stat.color, size: 28),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  stat.value,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  stat.label,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.lightTextSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChartsSection(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth > 800;
        return isWide
            ? Row(
                children: [
                  Expanded(child: _buildChartCard(context, 'Sales Trend (Last 7 Days)', _buildSalesChart())),
                  const SizedBox(width: 16),
                  Expanded(child: _buildChartCard(context, 'Inventory Overview', _buildInventoryChart())),
                ],
              )
            : Column(
                children: [
                  _buildChartCard(context, 'Sales Trend (Last 7 Days)', _buildSalesChart()),
                  const SizedBox(height: 16),
                  _buildChartCard(context, 'Inventory Overview', _buildInventoryChart()),
                ],
              );
      },
    );
  }

  Widget _buildChartCard(BuildContext context, String title, Widget chart) {
    return Container(
      height: 350,
      decoration: AppTheme.glassmorphismLight.copyWith(
        color: Theme.of(context).colorScheme.surface,
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          Expanded(child: chart),
        ],
      ),
    );
  }

  Widget _buildSalesChart() {
    return const Center(child: Text('Sales Chart Widget'));
  }

  Widget _buildInventoryChart() {
    return const Center(child: Text('Inventory Chart Widget'));
  }

  Widget _buildQuickActions(BuildContext context) {
    final actions = [
      _QuickAction('New Sale', Icons.point_of_sale, AppTheme.secondaryColor, '/sales/pos'),
      _QuickAction('Add Product', Icons.add_box, AppTheme.successColor, '/inventory/add'),
      _QuickAction('Purchase', Icons.shopping_bag, AppTheme.infoColor, '/purchase'),
      _QuickAction('Reports', Icons.assessment, AppTheme.warningColor, '/reports'),
      _QuickAction('AI Assistant', Icons.psychology, AppTheme.accentColor, '/ai-assistant'),
      _QuickAction('Barcode', Icons.qr_code_scanner, AppTheme.primaryColor, '/barcode'),
    ];

    return Container(
      decoration: AppTheme.glassmorphismLight.copyWith(
        color: Theme.of(context).colorScheme.surface,
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Quick Actions', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: actions.map((a) => _buildActionChip(context, a)).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildActionChip(BuildContext context, _QuickAction action) {
    return ActionChip(
      avatar: Icon(action.icon, color: action.color, size: 20),
      label: Text(action.label),
      backgroundColor: action.color.withOpacity(0.1),
      side: BorderSide(color: action.color.withOpacity(0.3)),
      onPressed: () => context.push(action.route),
    );
  }

  Widget _buildRecentActivity(BuildContext context) {
    return Container(
      decoration: AppTheme.glassmorphismLight.copyWith(
        color: Theme.of(context).colorScheme.surface,
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Recent Activity', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
              TextButton(onPressed: () {}, child: const Text('View All')),
            ],
          ),
          const SizedBox(height: 12),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 5,
            separatorBuilder: (_, __) => const Divider(),
            itemBuilder: (context, index) => ListTile(
              leading: CircleAvatar(
                backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
                child: const Icon(Icons.receipt_long, color: AppTheme.primaryColor, size: 20),
              ),
              title: Text('Sale #${1000 + index}'),
              subtitle: Text('Customer ${index + 1} • 2 min ago'),
              trailing: Text(
                'Rs.${(index + 1) * 1250}',
                style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.successColor, fontSize: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final String route;
  _StatCard(this.label, this.value, this.icon, this.color, this.route);
}

class _QuickAction {
  final String label;
  final IconData icon;
  final Color color;
  final String route;
  _QuickAction(this.label, this.icon, this.color, this.route);
}
