package com.arynoxtech.erp.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.arynoxtech.erp.ui.screens.accounting.AccountingScreen
import com.arynoxtech.erp.ui.screens.ai.AIAssistantScreen
import com.arynoxtech.erp.ui.screens.barcode.BarcodeScreen
import com.arynoxtech.erp.ui.screens.dashboard.DashboardScreen
import com.arynoxtech.erp.ui.screens.inventory.AddProductScreen
import com.arynoxtech.erp.ui.screens.inventory.InventoryScreen
import com.arynoxtech.erp.ui.screens.inventory.ProductDetailScreen
import com.arynoxtech.erp.ui.screens.purchase.AddPurchaseScreen
import com.arynoxtech.erp.ui.screens.purchase.PurchaseDetailScreen
import com.arynoxtech.erp.ui.screens.purchase.PurchaseScreen
import com.arynoxtech.erp.ui.screens.reports.ReportsScreen
import com.arynoxtech.erp.ui.screens.sales.InvoiceScreen
import com.arynoxtech.erp.ui.screens.customers.AddCustomerScreen
import com.arynoxtech.erp.ui.screens.customers.CustomerListScreen
import com.arynoxtech.erp.ui.screens.sales.POSScreen
import com.arynoxtech.erp.ui.screens.sales.SalesScreen
import com.arynoxtech.erp.ui.screens.settings.SettingsScreen
import com.arynoxtech.erp.ui.screens.suppliers.AddSupplierScreen
import com.arynoxtech.erp.ui.screens.suppliers.SupplierListScreen

@Composable
fun AppNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = NavRoutes.Dashboard.route,
        modifier = modifier
    ) {
        composable(NavRoutes.Dashboard.route) {
            DashboardScreen(
                onNavigateToInventory = { navController.navigate(NavRoutes.Inventory.route) },
                onNavigateToAddProduct = { navController.navigate(NavRoutes.InventoryAdd.createRoute()) },
                onNavigateToSales = { navController.navigate(NavRoutes.Sales.route) },
                onNavigateToPurchase = { navController.navigate(NavRoutes.Purchase.route) },
                onNavigateToReports = { navController.navigate(NavRoutes.Reports.route) },
                onNavigateToAi = { navController.navigate(NavRoutes.Ai.route) },
                onNavigateToBarcode = { navController.navigate(NavRoutes.Barcode.route) }
            )
        }

        composable(NavRoutes.Inventory.route) {
            InventoryScreen(
                onNavigateToAddProduct = { navController.navigate(NavRoutes.InventoryAdd.createRoute()) },
                onNavigateToProductDetail = { productId ->
                    navController.navigate(NavRoutes.InventoryDetail.createRoute(productId))
                },
                onScanBarcode = { navController.navigate(NavRoutes.Barcode.route) }
            )
        }

        composable(
            route = NavRoutes.InventoryAdd.route,
            arguments = listOf(
                navArgument("productId") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val productId = backStackEntry.arguments?.getString("productId")
            AddProductScreen(
                productId = productId,
                onNavigateBack = { navController.popBackStack() },
                onSaveSuccess = { navController.popBackStack() }
            )
        }

        composable(
            route = NavRoutes.InventoryDetail.route,
            arguments = listOf(
                navArgument("productId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val productId = backStackEntry.arguments?.getString("productId") ?: ""
            ProductDetailScreen(
                productId = productId,
                onNavigateBack = { navController.popBackStack() },
                onEditProduct = { id ->
                    navController.navigate(NavRoutes.InventoryAdd.createRoute(id))
                },
                onPrintBarcode = { /* TODO */ }
            )
        }

        composable(NavRoutes.Sales.route) {
            SalesScreen(
                onNavigateToPos = { navController.navigate(NavRoutes.SalesPos.route) },
                onNavigateToInvoice = { saleId ->
                    navController.navigate(NavRoutes.SalesInvoice.createRoute(saleId))
                },
                onNewSale = { navController.navigate(NavRoutes.SalesPos.route) }
            )
        }

        composable(NavRoutes.SalesPos.route) {
            POSScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToInvoice = { saleId ->
                    navController.navigate(NavRoutes.SalesInvoice.createRoute(saleId))
                }
            )
        }

        composable(
            route = NavRoutes.SalesInvoice.route,
            arguments = listOf(
                navArgument("saleId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val saleId = backStackEntry.arguments?.getString("saleId") ?: ""
            InvoiceScreen(
                saleId = saleId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(NavRoutes.Purchase.route) {
            PurchaseScreen(navController = navController)
        }

        composable(
            route = NavRoutes.PurchaseAdd.route,
            arguments = listOf(
                navArgument("purchaseId") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) { backStackEntry ->
            val purchaseId = backStackEntry.arguments?.getString("purchaseId")
            AddPurchaseScreen(
                navController = navController,
                purchaseId = purchaseId
            )
        }

        composable(
            route = NavRoutes.PurchaseDetail.route,
            arguments = listOf(
                navArgument("purchaseId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val purchaseId = backStackEntry.arguments?.getString("purchaseId") ?: ""
            PurchaseDetailScreen(
                navController = navController,
                purchaseId = purchaseId
            )
        }

        composable(NavRoutes.Accounting.route) {
            AccountingScreen()
        }

        composable(NavRoutes.Reports.route) {
            ReportsScreen()
        }

        composable(NavRoutes.Ai.route) {
            AIAssistantScreen()
        }

        composable(NavRoutes.Barcode.route) {
            BarcodeScreen()
        }

        composable(NavRoutes.Customers.route) {
            CustomerListScreen(
                onAddCustomer = { navController.navigate(NavRoutes.CustomersAdd.createRoute()) },
                onEditCustomer = { customerId ->
                    navController.navigate(NavRoutes.CustomersAdd.createRoute(customerId))
                }
            )
        }

        composable(
            route = NavRoutes.CustomersAdd.route,
            arguments = listOf(navArgument("customerId") { type = NavType.StringType; nullable = true; defaultValue = null })
        ) { backStackEntry ->
            val customerId = backStackEntry.arguments?.getString("customerId")
            AddCustomerScreen(
                customerId = customerId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(NavRoutes.Suppliers.route) {
            SupplierListScreen(
                onAddSupplier = { navController.navigate(NavRoutes.SuppliersAdd.createRoute()) },
                onEditSupplier = { supplierId ->
                    navController.navigate(NavRoutes.SuppliersAdd.createRoute(supplierId))
                }
            )
        }

        composable(
            route = NavRoutes.SuppliersAdd.route,
            arguments = listOf(navArgument("supplierId") { type = NavType.StringType; nullable = true; defaultValue = null })
        ) { backStackEntry ->
            val supplierId = backStackEntry.arguments?.getString("supplierId")
            AddSupplierScreen(
                supplierId = supplierId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(NavRoutes.Settings.route) {
            SettingsScreen()
        }
    }
}
