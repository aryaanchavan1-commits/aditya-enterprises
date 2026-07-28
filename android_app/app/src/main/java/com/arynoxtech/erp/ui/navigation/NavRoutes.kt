package com.arynoxtech.erp.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.AddShoppingCart
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.ui.graphics.vector.ImageVector

sealed class NavRoutes(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    data object Dashboard : NavRoutes(
        route = "dashboard",
        title = "Dashboard",
        icon = Icons.Default.Dashboard
    )

    data object Inventory : NavRoutes(
        route = "inventory",
        title = "Inventory",
        icon = Icons.Default.Inventory
    )

    data object InventoryAdd : NavRoutes(
        route = "inventory/add?productId={productId}",
        title = "Add Product",
        icon = Icons.Default.Inventory
    ) {
        fun createRoute(productId: String? = null): String {
            return if (productId != null) "inventory/add?productId=$productId"
            else "inventory/add"
        }
    }

    data object InventoryDetail : NavRoutes(
        route = "inventory/{productId}",
        title = "Product Detail",
        icon = Icons.Default.Inventory
    ) {
        fun createRoute(productId: String): String = "inventory/$productId"
    }

    data object Sales : NavRoutes(
        route = "sales",
        title = "Sales",
        icon = Icons.Default.ShoppingCart
    )

    data object SalesPos : NavRoutes(
        route = "sales/pos",
        title = "POS",
        icon = Icons.Default.AddShoppingCart
    )

    data object SalesInvoice : NavRoutes(
        route = "sales/invoice/{saleId}",
        title = "Invoice",
        icon = Icons.Default.ShoppingCart
    ) {
        fun createRoute(saleId: String): String = "sales/invoice/$saleId"
    }

    data object Purchase : NavRoutes(
        route = "purchase",
        title = "Purchase",
        icon = Icons.Default.ShoppingBag
    )

    data object PurchaseAdd : NavRoutes(
        route = "purchase/add?purchaseId={purchaseId}",
        title = "Add Purchase",
        icon = Icons.Default.ShoppingBag
    ) {
        fun createRoute(purchaseId: String? = null): String {
            return if (purchaseId != null) "purchase/add?purchaseId=$purchaseId"
            else "purchase/add"
        }
    }

    data object PurchaseDetail : NavRoutes(
        route = "purchase/{purchaseId}",
        title = "Purchase Detail",
        icon = Icons.Default.ShoppingBag
    ) {
        fun createRoute(purchaseId: String): String = "purchase/$purchaseId"
    }

    data object Accounting : NavRoutes(
        route = "accounting",
        title = "Accounting",
        icon = Icons.Default.AccountBalance
    )

    data object Reports : NavRoutes(
        route = "reports",
        title = "Reports",
        icon = Icons.Default.Analytics
    )

    data object Ai : NavRoutes(
        route = "ai",
        title = "AI Assistant",
        icon = Icons.Default.SmartToy
    )

    data object Barcode : NavRoutes(
        route = "barcode",
        title = "Barcode",
        icon = Icons.Default.QrCodeScanner
    )

    data object Customers : NavRoutes(
        route = "customers",
        title = "Customers",
        icon = Icons.Default.People
    )

    data object CustomersAdd : NavRoutes(
        route = "customers/add?customerId={customerId}",
        title = "Add Customer",
        icon = Icons.Default.People
    ) {
        fun createRoute(customerId: String? = null): String {
            return if (customerId != null) "customers/add?customerId=$customerId" else "customers/add"
        }
    }

    data object Suppliers : NavRoutes(
        route = "suppliers",
        title = "Suppliers",
        icon = Icons.Default.People
    )

    data object SuppliersAdd : NavRoutes(
        route = "suppliers/add?supplierId={supplierId}",
        title = "Add Supplier",
        icon = Icons.Default.People
    ) {
        fun createRoute(supplierId: String? = null): String {
            return if (supplierId != null) "suppliers/add?supplierId=$supplierId" else "suppliers/add"
        }
    }

    data object Settings : NavRoutes(
        route = "settings",
        title = "Settings",
        icon = Icons.Default.Settings
    )

    companion object {
        val bottomNavItems = listOf(Dashboard, Inventory, Sales, Purchase)
        val moreNavItems = listOf(Accounting, Reports, Ai, Barcode, Customers, Suppliers, Settings)
    }
}
