package com.arynoxtech.erp.domain.model

data class Product(
    val id: String,
    val name: String,
    val sku: String,
    val hsnCode: String = "",
    val barcode: String = "",
    val description: String = "",
    val category: String = "",
    val subCategory: String = "",
    val brand: String = "",
    val unit: String = "",
    val purchasePrice: Double = 0.0,
    val sellingPrice: Double = 0.0,
    val mrp: Double = 0.0,
    val discount: Double = 0.0,
    val tax: Double = 0.0,
    val gstRate: Double = 0.0,
    val minimumStock: Double = 0.0,
    val maximumStock: Double = 0.0,
    val openingStock: Double = 0.0,
    val currentStock: Double = 0.0,
    val warehouse: String = "",
    val supplier: String = "",
    val location: String = "",
    val expiryDate: Long? = null,
    val manufacturingDate: Long? = null,
    val batchNumber: String = "",
    val notes: String = "",
    val images: String = "",
    val isActive: Boolean = true,
    val createdAt: Long,
    val updatedAt: Long
)

data class Sale(
    val id: String,
    val invoiceNumber: String,
    val customerId: String? = null,
    val customerName: String = "",
    val customerPhone: String = "",
    val customerGstin: String = "",
    val saleDate: Long,
    val subtotal: Double = 0.0,
    val discountAmount: Double = 0.0,
    val taxAmount: Double = 0.0,
    val cgstTotal: Double = 0.0,
    val sgstTotal: Double = 0.0,
    val igstTotal: Double = 0.0,
    val roundOff: Double = 0.0,
    val totalAmount: Double = 0.0,
    val paidAmount: Double = 0.0,
    val balanceAmount: Double = 0.0,
    val paymentMethod: String = "cash",
    val paymentStatus: String = "pending",
    val status: String = "active",
    val notes: String = "",
    val createdAt: Long,
    val items: List<SaleItem> = emptyList()
)

data class SaleItem(
    val id: String = "",
    val saleId: String,
    val productId: String,
    val productName: String,
    val productSku: String = "",
    val quantity: Double = 0.0,
    val unitPrice: Double = 0.0,
    val discountPercent: Double = 0.0,
    val discountAmount: Double = 0.0,
    val taxableAmount: Double = 0.0,
    val gstRate: Double = 0.0,
    val cgstAmount: Double = 0.0,
    val sgstAmount: Double = 0.0,
    val igstAmount: Double = 0.0,
    val totalAmount: Double = 0.0
)

data class Purchase(
    val id: String,
    val purchaseNumber: String,
    val supplierId: String? = null,
    val supplierName: String = "",
    val purchaseDate: Long,
    val subtotal: Double = 0.0,
    val discountAmount: Double = 0.0,
    val taxAmount: Double = 0.0,
    val shippingCost: Double = 0.0,
    val otherCharges: Double = 0.0,
    val totalAmount: Double = 0.0,
    val paidAmount: Double = 0.0,
    val balanceAmount: Double = 0.0,
    val paymentStatus: String = "pending",
    val status: String = "ordered",
    val notes: String = "",
    val createdAt: Long,
    val items: List<PurchaseItem> = emptyList()
)

data class PurchaseItem(
    val id: String = "",
    val purchaseId: String,
    val productId: String,
    val productName: String,
    val quantity: Double = 0.0,
    val unitPrice: Double = 0.0,
    val discount: Double = 0.0,
    val taxAmount: Double = 0.0,
    val totalAmount: Double = 0.0,
    val receivedQuantity: Double = 0.0
)

data class DashboardData(
    val totalProducts: Int = 0,
    val lowStockCount: Int = 0,
    val todaySalesCount: Int = 0,
    val monthlyRevenue: Double = 0.0,
    val recentSales: List<RecentSale> = emptyList()
)

data class RecentSale(
    val id: String,
    val invoiceNumber: String,
    val customerName: String,
    val total: Double,
    val paymentStatus: String,
    val createdAt: Long
)

data class ChartDataPoint(
    val label: String,
    val value: Double
)

data class ReportData(
    val title: String,
    val headers: List<String>,
    val rows: List<List<String>>
)
