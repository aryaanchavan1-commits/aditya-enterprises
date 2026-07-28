package com.arynoxtech.erp.service

import android.util.Log
import com.arynoxtech.erp.data.local.*
import com.arynoxtech.erp.data.supabase.SupabaseClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

data class SyncProgress(
    val currentTable: String = "",
    val pulledCount: Int = 0,
    val totalTables: Int = 13,
    val isRunning: Boolean = false,
    val message: String = ""
)

@Singleton
class SyncManager @Inject constructor(
    private val supabase: SupabaseClient,
    private val connectivityObserver: ConnectivityObserver,
    private val productDao: ProductDao,
    private val categoryDao: CategoryDao,
    private val brandDao: BrandDao,
    private val customerDao: CustomerDao,
    private val supplierDao: SupplierDao,
    private val saleDao: SaleDao,
    private val purchaseDao: PurchaseDao,
    private val stockMovementDao: StockMovementDao,
    private val accountingDao: AccountingDao
) {

    val isOnline: Boolean get() = connectivityObserver.isCurrentlyOnline()
    val isConfigured: Boolean get() = supabase.isConfigured()

    suspend fun pullAll(): Result<SyncProgress> = withContext(Dispatchers.IO) {
        if (!supabase.isConfigured()) {
            Log.w("SyncManager", "Supabase not configured")
            return@withContext Result.success(SyncProgress(message = "Supabase not configured"))
        }
        try {
            pullProducts()
            pullCategories()
            pullBrands()
            pullSuppliers()
            pullCustomers()
            pullSales()
            pullPurchases()
            pullStockMovements()
            pullCashBook()
            Result.success(SyncProgress(message = "Sync completed"))
        } catch (e: Exception) {
            Log.e("SyncManager", "pullAll exception: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun pushAll(): Result<SyncProgress> = withContext(Dispatchers.IO) {
        if (!isOnline || !supabase.isConfigured()) {
            Log.w("SyncManager", "Offline or not configured")
            return@withContext Result.success(SyncProgress(message = "Offline or not configured"))
        }
        try {
            pushProducts()
            pushCategories()
            pushBrands()
            pushSuppliers()
            pushCustomers()
            Result.success(SyncProgress(message = "Push completed"))
        } catch (e: Exception) {
            Log.e("SyncManager", "pushAll exception: ${e.message}")
            Result.failure(e)
        }
    }

    private suspend fun pushProducts() {
        val products = productDao.getAll().first()
        Log.d("SyncManager", "pushProducts: ${products.size} products")
        if (products.isNotEmpty()) {
            val records = products.map { supabase.productToJson(it) }
            val result = supabase.upsert("products", records)
            Log.d("SyncManager", "pushProducts result: ${result.isSuccess}")
            if (result.isFailure) Log.e("SyncManager", "pushProducts error: ${result.exceptionOrNull()?.message}")
        }
    }

    private suspend fun pushCategories() {
        val items = categoryDao.getAll().first()
        Log.d("SyncManager", "pushCategories: ${items.size} categories")
        if (items.isNotEmpty()) {
            val records = items.map { supabase.categoryToJson(it) }
            val result = supabase.upsert("categories", records)
            Log.d("SyncManager", "pushCategories result: ${result.isSuccess}")
            if (result.isFailure) Log.e("SyncManager", "pushCategories error: ${result.exceptionOrNull()?.message}")
        }
    }

    private suspend fun pushBrands() {
        val items = brandDao.getAll().first()
        Log.d("SyncManager", "pushBrands: ${items.size} brands")
        if (items.isNotEmpty()) {
            val records = items.map { supabase.brandToJson(it) }
            val result = supabase.upsert("brands", records)
            Log.d("SyncManager", "pushBrands result: ${result.isSuccess}")
            if (result.isFailure) Log.e("SyncManager", "pushBrands error: ${result.exceptionOrNull()?.message}")
        }
    }

    private suspend fun pushSuppliers() {
        val items = supplierDao.getAll().first()
        Log.d("SyncManager", "pushSuppliers: ${items.size} suppliers")
        if (items.isNotEmpty()) {
            val records = items.map { supabase.supplierToJson(it) }
            val result = supabase.upsert("suppliers", records)
            Log.d("SyncManager", "pushSuppliers result: ${result.isSuccess}")
            if (result.isFailure) Log.e("SyncManager", "pushSuppliers error: ${result.exceptionOrNull()?.message}")
        }
    }

    private suspend fun pushCustomers() {
        val items = customerDao.getAll().first()
        Log.d("SyncManager", "pushCustomers: ${items.size} customers")
        if (items.isNotEmpty()) {
            val records = items.map { supabase.customerToJson(it) }
            val result = supabase.upsert("customers", records)
            Log.d("SyncManager", "pushCustomers result: ${result.isSuccess}")
            if (result.isFailure) Log.e("SyncManager", "pushCustomers error: ${result.exceptionOrNull()?.message}")
        }
    }

    private suspend fun pullProducts() {
        val result = supabase.fetchAll("products")
        if (result.isFailure) {
            Log.e("SyncManager", "pullProducts error: ${result.exceptionOrNull()?.message}")
            return
        }
        val rows = result.getOrNull() ?: return
        Log.d("SyncManager", "pullProducts: ${rows.size} rows")
        rows.forEach { json ->
            val entity = supabase.jsonToProduct(json)
            if (entity != null) productDao.upsert(entity)
        }
    }

    private suspend fun pullCategories() {
        val result = supabase.fetchAll("categories")
        if (result.isFailure) {
            Log.e("SyncManager", "pullCategories error: ${result.exceptionOrNull()?.message}"); return
        }
        val rows = result.getOrNull() ?: return
        Log.d("SyncManager", "pullCategories: ${rows.size} rows")
        rows.forEach { json ->
            val entity = supabase.jsonToCategory(json)
            if (entity != null) categoryDao.insert(entity)
        }
    }

    private suspend fun pullBrands() {
        val result = supabase.fetchAll("brands")
        if (result.isFailure) {
            Log.e("SyncManager", "pullBrands error: ${result.exceptionOrNull()?.message}"); return
        }
        val rows = result.getOrNull() ?: return
        Log.d("SyncManager", "pullBrands: ${rows.size} rows")
        rows.forEach { json ->
            val entity = supabase.jsonToBrand(json)
            if (entity != null) brandDao.insertAll(listOf(entity))
        }
    }

    private suspend fun pullSuppliers() {
        val result = supabase.fetchAll("suppliers")
        if (result.isFailure) {
            Log.e("SyncManager", "pullSuppliers error: ${result.exceptionOrNull()?.message}"); return
        }
        val rows = result.getOrNull() ?: return
        Log.d("SyncManager", "pullSuppliers: ${rows.size} rows")
        rows.forEach { json ->
            val entity = supabase.jsonToSupplier(json)
            if (entity != null) supplierDao.insert(entity)
        }
    }

    private suspend fun pullCustomers() {
        val result = supabase.fetchAll("customers")
        if (result.isFailure) {
            Log.e("SyncManager", "pullCustomers error: ${result.exceptionOrNull()?.message}"); return
        }
        val rows = result.getOrNull() ?: return
        Log.d("SyncManager", "pullCustomers: ${rows.size} rows")
        rows.forEach { json ->
            val entity = supabase.jsonToCustomer(json)
            if (entity != null) customerDao.insert(entity)
        }
    }

    private suspend fun pullSales() {
        val result = supabase.fetchAll("sales")
        result.getOrNull()?.forEach { json ->
            val entity = jsonToSale(json)
            if (entity != null) saleDao.insertSale(entity)
        }
        val itemsResult = supabase.fetchAll("sale_items")
        itemsResult.getOrNull()?.forEach { json ->
            val entity = jsonToSaleItem(json)
            if (entity != null) saleDao.insertSaleItem(entity)
        }
    }

    private suspend fun pullPurchases() {
        val result = supabase.fetchAll("purchases")
        result.getOrNull()?.forEach { json ->
            val entity = jsonToPurchase(json)
            if (entity != null) purchaseDao.insertPurchase(entity)
        }
        val itemsResult = supabase.fetchAll("purchase_items")
        itemsResult.getOrNull()?.forEach { json ->
            val entity = jsonToPurchaseItem(json)
            if (entity != null) purchaseDao.insertPurchaseItem(entity)
        }
    }

    private suspend fun pullStockMovements() {
        val result = supabase.fetchAll("stock_movements")
        result.getOrNull()?.let { rows ->
            val entities = rows.mapNotNull { jsonToStockMovement(it) }
            if (entities.isNotEmpty()) stockMovementDao.insertAll(entities)
        }
    }

    private suspend fun pullCashBook() {
        supabase.fetchAll("cash_book").getOrNull()?.forEach { json ->
            jsonToCashBook(json)?.let { accountingDao.insertCashEntry(it) }
        }
        supabase.fetchAll("expenses").getOrNull()?.forEach { json ->
            jsonToExpense(json)?.let { accountingDao.insertExpense(it) }
        }
        supabase.fetchAll("incomes").getOrNull()?.forEach { json ->
            jsonToIncome(json)?.let { accountingDao.insertIncome(it) }
        }
    }

    private fun jsonToSale(json: JSONObject): SaleEntity? {
        return try {
            SaleEntity(
                id = json.optString("id", ""),
                invoiceNumber = json.optString("invoiceNumber", ""),
                customerId = if (json.has("customerId") && !json.isNull("customerId")) json.optString("customerId") else null,
                customerName = json.optString("customerName", ""),
                customerPhone = json.optString("customerPhone", ""),
                customerGstin = json.optString("customerGstin", ""),
                saleDate = json.optLong("saleDate", 0L),
                subtotal = json.optDouble("subtotal", 0.0),
                discountAmount = json.optDouble("discountAmount", 0.0),
                taxAmount = json.optDouble("taxAmount", 0.0),
                cgstTotal = json.optDouble("cgstTotal", 0.0),
                sgstTotal = json.optDouble("sgstTotal", 0.0),
                igstTotal = json.optDouble("igstTotal", 0.0),
                roundOff = json.optDouble("roundOff", 0.0),
                totalAmount = json.optDouble("totalAmount", 0.0),
                paidAmount = json.optDouble("paidAmount", 0.0),
                balanceAmount = json.optDouble("balanceAmount", 0.0),
                paymentMethod = json.optString("paymentMethod", ""),
                paymentStatus = json.optString("paymentStatus", ""),
                status = json.optString("status", ""),
                notes = json.optString("notes", ""),
                createdAt = json.optLong("createdAt", 0L)
            )
        } catch (e: Exception) { null }
    }

    private fun jsonToSaleItem(json: JSONObject): SaleItemEntity? {
        return try {
            SaleItemEntity(
                id = json.optString("id", ""),
                saleId = json.optString("saleId", ""),
                productId = json.optString("productId", ""),
                productName = json.optString("productName", ""),
                productSku = json.optString("productSku", ""),
                quantity = json.optDouble("quantity", 0.0),
                unitPrice = json.optDouble("unitPrice", 0.0),
                discountPercent = json.optDouble("discountPercent", 0.0),
                discountAmount = json.optDouble("discountAmount", 0.0),
                taxableAmount = json.optDouble("taxableAmount", 0.0),
                gstRate = json.optDouble("gstRate", 0.0),
                cgstAmount = json.optDouble("cgstAmount", 0.0),
                sgstAmount = json.optDouble("sgstAmount", 0.0),
                igstAmount = json.optDouble("igstAmount", 0.0),
                totalAmount = json.optDouble("totalAmount", 0.0)
            )
        } catch (e: Exception) { null }
    }

    private fun jsonToPurchase(json: JSONObject): PurchaseEntity? {
        return try {
            PurchaseEntity(
                id = json.optString("id", ""),
                purchaseNumber = json.optString("purchaseNumber", ""),
                supplierId = if (json.has("supplierId") && !json.isNull("supplierId")) json.optString("supplierId") else null,
                supplierName = json.optString("supplierName", ""),
                purchaseDate = json.optLong("purchaseDate", 0L),
                subtotal = json.optDouble("subtotal", 0.0),
                discountAmount = json.optDouble("discountAmount", 0.0),
                taxAmount = json.optDouble("taxAmount", 0.0),
                shippingCost = json.optDouble("shippingCost", 0.0),
                otherCharges = json.optDouble("otherCharges", 0.0),
                totalAmount = json.optDouble("totalAmount", 0.0),
                paidAmount = json.optDouble("paidAmount", 0.0),
                balanceAmount = json.optDouble("balanceAmount", 0.0),
                paymentStatus = json.optString("paymentStatus", ""),
                status = json.optString("status", ""),
                notes = json.optString("notes", ""),
                createdAt = json.optLong("createdAt", 0L)
            )
        } catch (e: Exception) { null }
    }

    private fun jsonToPurchaseItem(json: JSONObject): PurchaseItemEntity? {
        return try {
            PurchaseItemEntity(
                id = json.optString("id", ""),
                purchaseId = json.optString("purchaseId", ""),
                productId = json.optString("productId", ""),
                productName = json.optString("productName", ""),
                quantity = json.optDouble("quantity", 0.0),
                unitPrice = json.optDouble("unitPrice", 0.0),
                discount = json.optDouble("discount", 0.0),
                taxAmount = json.optDouble("taxAmount", 0.0),
                totalAmount = json.optDouble("totalAmount", 0.0),
                receivedQuantity = json.optDouble("receivedQuantity", 0.0)
            )
        } catch (e: Exception) { null }
    }

    private fun jsonToStockMovement(json: JSONObject): StockMovementEntity? {
        return try {
            StockMovementEntity(
                id = json.optString("id", ""),
                productId = json.optString("productId", ""),
                productName = json.optString("productName", ""),
                movementType = json.optString("movementType", ""),
                quantity = json.optDouble("quantity", 0.0),
                beforeStock = json.optDouble("beforeStock", 0.0),
                afterStock = json.optDouble("afterStock", 0.0),
                referenceId = json.optString("referenceId", ""),
                referenceType = json.optString("referenceType", ""),
                notes = json.optString("notes", ""),
                createdAt = json.optLong("createdAt", 0L)
            )
        } catch (e: Exception) { null }
    }

    private fun jsonToCashBook(json: JSONObject): CashBookEntity? {
        return try {
            CashBookEntity(
                id = json.optString("id", ""),
                date = json.optLong("date", 0L),
                voucherNumber = json.optString("voucherNumber", ""),
                transactionType = json.optString("transactionType", ""),
                category = json.optString("category", ""),
                description = json.optString("description", ""),
                amount = json.optDouble("amount", 0.0),
                balance = json.optDouble("balance", 0.0),
                referenceId = json.optString("referenceId", ""),
                notes = json.optString("notes", "")
            )
        } catch (e: Exception) { null }
    }

    private fun jsonToExpense(json: JSONObject): ExpenseEntity? {
        return try {
            ExpenseEntity(
                id = json.optString("id", ""),
                date = json.optLong("date", 0L),
                category = json.optString("category", ""),
                subCategory = json.optString("subCategory", ""),
                description = json.optString("description", ""),
                amount = json.optDouble("amount", 0.0),
                paymentMethod = json.optString("paymentMethod", ""),
                vendor = json.optString("vendor", ""),
                receiptNumber = json.optString("receiptNumber", ""),
                gstAmount = json.optDouble("gstAmount", 0.0),
                notes = json.optString("notes", "")
            )
        } catch (e: Exception) { null }
    }

    private fun jsonToIncome(json: JSONObject): IncomeEntity? {
        return try {
            IncomeEntity(
                id = json.optString("id", ""),
                date = json.optLong("date", 0L),
                category = json.optString("category", ""),
                subCategory = json.optString("subCategory", ""),
                description = json.optString("description", ""),
                amount = json.optDouble("amount", 0.0),
                paymentMethod = json.optString("paymentMethod", ""),
                customer = json.optString("customer", ""),
                invoiceNumber = json.optString("invoiceNumber", ""),
                gstAmount = json.optDouble("gstAmount", 0.0),
                notes = json.optString("notes", "")
            )
        } catch (e: Exception) { null }
    }
}
