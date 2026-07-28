import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:window_manager/window_manager.dart';
import '../../../core/theme/app_theme.dart';

class CustomAppBar extends ConsumerWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final bool showBackButton;

  const CustomAppBar({
    super.key,
    required this.title,
    this.actions,
    this.showBackButton = false,
  });

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDesktop = MediaQuery.of(context).size.width > 1200;

    return Container(
      height: 60,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          bottom: BorderSide(color: Theme.of(context).dividerTheme.color ?? AppTheme.lightBorder),
        ),
      ),
      child: Row(
        children: [
          // Window Controls (Desktop only)
          if (!isDesktop) ...[
            IconButton(
              icon: const Icon(Icons.menu),
              onPressed: () => Scaffold.of(context).openDrawer(),
            ),
          ],

          // Back Button
          if (showBackButton)
            IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => context.pop(),
            ),

          const SizedBox(width: 8),

          // Title
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),

          const Spacer(),

          // Global Search
          Container(
            width: 300,
            height: 40,
            margin: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search products, sales, customers...',
                prefixIcon: const Icon(Icons.search, size: 20),
                filled: true,
                fillColor: Theme.of(context).colorScheme.background,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16),
              ),
            ),
          ),

          // Actions
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.dark_mode_outlined),
            onPressed: () {},
          ),
          const SizedBox(width: 8),

          // User Profile
          Container(
            margin: const EdgeInsets.only(right: 16),
            child: CircleAvatar(
              radius: 18,
              backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
              child: const Icon(Icons.person, color: AppTheme.primaryColor, size: 20),
            ),
          ),

          // Window Controls (Windows only)
          if (Theme.of(context).platform == TargetPlatform.windows) ...[
            _buildWindowButton(Icons.remove, () => windowManager.minimize()),
            _buildWindowButton(Icons.crop_square, () async {
              if (await windowManager.isMaximized()) {
                windowManager.unmaximize();
              } else {
                windowManager.maximize();
              }
            }),
            _buildWindowButton(Icons.close, () => windowManager.close(), isClose: true),
          ],
        ],
      ),
    );
  }

  Widget _buildWindowButton(IconData icon, VoidCallback onPressed, {bool isClose = false}) {
    return InkWell(
      onTap: onPressed,
      child: Container(
        width: 46,
        height: 60,
        alignment: Alignment.center,
        child: Icon(icon, size: 18, color: isClose ? Colors.red : null),
      ),
    );
  }
}
