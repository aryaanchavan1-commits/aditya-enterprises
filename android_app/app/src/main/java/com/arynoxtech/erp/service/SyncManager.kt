package com.arynoxtech.erp.service

import android.util.Log
import com.arynoxtech.erp.data.local.*
import com.arynoxtech.erp.data.local.datastore.SettingsDataStore
import com.arynoxtech.erp.data.turso.EntitySqlMapper
import com.arynoxtech.erp.data.turso.TursoClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
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
    private val tursoClient: TursoClient,
    private val settingsDataStore: SettingsDataStore,
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
    val isConfigured: Boolean get() = tursoClient.isConfigured()

    suspend fun configureFromSettings() {
        val settings = settingsDataStore.settings.first()
        tursoClient.configure(settings.tursoUrl, settings.tursoAuthToken)
    }

    suspend fun pullAll(): Result<SyncProgress> = withContext(Dispatchers.IO) {
        configureFromSettings()
        if (!tursoClient.isConfigured()) {
            Log.w("SyncManager", "Turso not configured - go to Settings and enter database credentials")
            return@withContext Result.success(SyncProgress(message = "Turso not configured"))
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
        configureFromSettings()
        if (!isOnline || !tursoClient.isConfigured()) {
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
            val statements = products.map { EntitySqlMapper.productToSql(it) }
            val result = tursoClient.executeBatch(statements)
            Log.d("SyncManager", "pushProducts result: ${result.isSuccess}")
            if (result.isFailure) Log.e("SyncManager", "pushProducts error: ${result.exceptionOrNull()?.message}")
        }
    }

    private suspend fun pushCategories() {
        val items = categoryDao.getAll().first()
        Log.d("SyncManager", "pushCategories: ${items.size} categories")
        if (items.isNotEmpty()) {
            val statements = items.map { EntitySqlMapper.categoryToSql(it) }
            val result = tursoClient.executeBatch(statements)
            Log.d("SyncManager", "pushCategories result: ${result.isSuccess}")
            if (result.isFailure) Log.e("SyncManager", "pushCategories error: ${result.exceptionOrNull()?.message}")
        }
    }

    private suspend fun pushBrands() {
        val items = brandDao.getAll().first()
        Log.d("SyncManager", "pushBrands: ${items.size} brands")
        if (items.isNotEmpty()) {
            val statements = items.map { EntitySqlMapper.brandToSql(it) }
            val result = tursoClient.executeBatch(statements)
            Log.d("SyncManager", "pushBrands result: ${result.isSuccess}")
            if (result.isFailure) Log.e("SyncManager", "pushBrands error: ${result.exceptionOrNull()?.message}")
        }
    }

    private suspend fun pushSuppliers() {
        val items = supplierDao.getAll().first()
        Log.d("SyncManager", "pushSuppliers: ${items.size} suppliers")
        if (items.isNotEmpty()) {
            val statements = items.map { EntitySqlMapper.supplierToSql(it) }
            val result = tursoClient.executeBatch(statements)
            Log.d("SyncManager", "pushSuppliers result: ${result.isSuccess}")
            if (result.isFailure) Log.e("SyncManager", "pushSuppliers error: ${result.exceptionOrNull()?.message}")
        }
    }

    private suspend fun pushCustomers() {
        val items = customerDao.getAll().first()
        Log.d("SyncManager", "pushCustomers: ${items.size} customers")
        if (items.isNotEmpty()) {
            val statements = items.map { EntitySqlMapper.customerToSql(it) }
            val result = tursoClient.executeBatch(statements)
            Log.d("SyncManager", "pushCustomers result: ${result.isSuccess}")
            if (result.isFailure) Log.e("SyncManager", "pushCustomers error: ${result.exceptionOrNull()?.message}")
        }
    }

    private suspend fun pullProducts() {
        val result = tursoClient.execute("SELECT * FROM products")
        if (result.isFailure) {
            Log.e("SyncManager", "pullProducts error: ${result.exceptionOrNull()?.message}")
            return
        }
        val data = result.getOrNull() ?: return
        if (data.size < 2) return
        val cols = data[0] as? List<String> ?: return
        val rows = data[1] as? List<List<Any?>> ?: return
        Log.d("SyncManager", "pullProducts: ${rows.size} rows")
        rows.forEach { vals ->
            val entity = rowToProduct(cols, vals)
            if (entity != null) productDao.upsert(entity)
        }
    }

    private suspend fun pullCategories() {
        val result = tursoClient.execute("SELECT * FROM categories")
        if (result.isFailure) { Log.e("SyncManager", "pullCategories error: ${result.exceptionOrNull()?.message}"); return }
        val data = result.getOrNull() ?: return
        if (data.size < 2) return
        val cols = data[0] as? List<String> ?: return
        val rows = data[1] as? List<List<Any?>> ?: return
        rows.forEach { vals ->
            rowToCategory(cols, vals)?.let { categoryDao.insert(it) }
        }
    }

    private suspend fun pullBrands() {
        val result = tursoClient.execute("SELECT * FROM brands")
        if (result.isFailure) { Log.e("SyncManager", "pullBrands error: ${result.exceptionOrNull()?.message}"); return }
        val data = result.getOrNull() ?: return
        if (data.size < 2) return
        val cols = data[0] as? List<String> ?: return
        val rows = data[1] as? List<List<Any?>> ?: return
        rows.forEach { vals ->
            rowToBrand(cols, vals)?.let { brandDao.insertAll(listOf(it)) }
        }
    }

    private suspend fun pullSuppliers() {
        val result = tursoClient.execute("SELECT * FROM suppliers")
        if (result.isFailure) { Log.e("SyncManager", "pullSuppliers error: ${result.exceptionOrNull()?.message}"); return }
        val data = result.getOrNull() ?: return
        if (data.size < 2) return
        val cols = data[0] as? List<String> ?: return
        val rows = data[1] as? List<List<Any?>> ?: return
        rows.forEach { vals ->
            rowToSupplier(cols, vals)?.let { supplierDao.insert(it) }
        }
    }

    private suspend fun pullCustomers() {
        val result = tursoClient.execute("SELECT * FROM customers")
        if (result.isFailure) { Log.e("SyncManager", "pullCustomers error: ${result.exceptionOrNull()?.message}"); return }
        val data = result.getOrNull() ?: return
        if (data.size < 2) return
        val cols = data[0] as? List<String> ?: return
        val rows = data[1] as? List<List<Any?>> ?: return
        rows.forEach { vals ->
            rowToCustomer(cols, vals)?.let { customerDao.insert(it) }
        }
    }

    private suspend fun pullSales() {
        val result = tursoClient.execute("SELECT * FROM sales")
        result.getOrNull()?.let { data ->
            if (data.size >= 2) {
                val cols = data[0] as? List<String> ?: return@let
                val rows = data[1] as? List<List<Any?>> ?: return@let
                rows.forEach { rowToSale(cols, it)?.let { saleDao.insertSale(it) } }
            }
        }
        val itemsResult = tursoClient.execute("SELECT * FROM sale_items")
        itemsResult.getOrNull()?.let { data ->
            if (data.size >= 2) {
                val cols = data[0] as? List<String> ?: return@let
                val rows = data[1] as? List<List<Any?>> ?: return@let
                rows.forEach { rowToSaleItem(cols, it)?.let { saleDao.insertSaleItem(it) } }
            }
        }
    }

    private suspend fun pullPurchases() {
        val result = tursoClient.execute("SELECT * FROM purchases")
        result.getOrNull()?.let { data ->
            if (data.size >= 2) {
                val cols = data[0] as? List<String> ?: return@let
                val rows = data[1] as? List<List<Any?>> ?: return@let
                rows.forEach { rowToPurchase(cols, it)?.let { purchaseDao.insertPurchase(it) } }
            }
        }
        val itemsResult = tursoClient.execute("SELECT * FROM purchase_items")
        itemsResult.getOrNull()?.let { data ->
            if (data.size >= 2) {
                val cols = data[0] as? List<String> ?: return@let
                val rows = data[1] as? List<List<Any?>> ?: return@let
                rows.forEach { rowToPurchaseItem(cols, it)?.let { purchaseDao.insertPurchaseItem(it) } }
            }
        }
    }

    private suspend fun pullStockMovements() {
        val result = tursoClient.execute("SELECT * FROM stock_movements")
        result.getOrNull()?.let { data ->
            if (data.size >= 2) {
                val cols = data[0] as? List<String> ?: return@let
                val rows = data[1] as? List<List<Any?>> ?: return@let
                val entities = rows.mapNotNull { rowToStockMovement(cols, it) }
                if (entities.isNotEmpty()) stockMovementDao.insertAll(entities)
            }
        }
    }

    private suspend fun pullCashBook() {
        tursoClient.execute("SELECT * FROM cash_book").getOrNull()?.let { data ->
            if (data.size >= 2) {
                val cols = data[0] as? List<String> ?: return@let
                val rows = data[1] as? List<List<Any?>> ?: return@let
                rows.forEach { rowToCashBook(cols, it)?.let { accountingDao.insertCashEntry(it) } }
            }
        }
        tursoClient.execute("SELECT * FROM expenses").getOrNull()?.let { data ->
            if (data.size >= 2) {
                val cols = data[0] as? List<String> ?: return@let
                val rows = data[1] as? List<List<Any?>> ?: return@let
                rows.forEach { rowToExpense(cols, it)?.let { accountingDao.insertExpense(it) } }
            }
        }
        tursoClient.execute("SELECT * FROM incomes").getOrNull()?.let { data ->
            if (data.size >= 2) {
                val cols = data[0] as? List<String> ?: return@let
                val rows = data[1] as? List<List<Any?>> ?: return@let
                rows.forEach { rowToIncome(cols, it)?.let { accountingDao.insertIncome(it) } }
            }
        }
    }

    private fun str(cols: List<String>, vals: List<Any?>, name: String): String =
        strOrNull(cols, vals, name) ?: ""

    private fun strOrNull(cols: List<String>, vals: List<Any?>, name: String): String? {
        val idx = cols.indexOf(name)
        if (idx < 0 || idx >= vals.size) return null
        return vals[idx]?.toString()
    }

    private fun dbl(cols: List<String>, vals: List<Any?>, name: String): Double {
        val idx = cols.indexOf(name)
        if (idx < 0 || idx >= vals.size) return 0.0
        val v = vals[idx]
        return when (v) {
            is Number -> v.toDouble()
            is String -> v.toDoubleOrNull() ?: 0.0
            else -> 0.0
        }
    }

    private fun int(cols: List<String>, vals: List<Any?>, name: String): Int {
        val idx = cols.indexOf(name)
        if (idx < 0 || idx >= vals.size) return 0
        val v = vals[idx]
        return when (v) {
            is Number -> v.toInt()
            is String -> v.toIntOrNull() ?: 0
            else -> 0
        }
    }

    private fun lng(cols: List<String>, vals: List<Any?>, name: String): Long? {
        val idx = cols.indexOf(name)
        if (idx < 0 || idx >= vals.size) return null
        val v = vals[idx] ?: return null
        return when (v) {
            is Number -> v.toLong()
            is String -> v.toLongOrNull()
            else -> null
        }
    }

    private fun bool(cols: List<String>, vals: List<Any?>, name: String): Boolean {
        val idx = cols.indexOf(name)
        if (idx < 0 || idx >= vals.size) return true
        val v = vals[idx]
        return when (v) {
            is Boolean -> v
            is Number -> v.toInt() != 0
            is String -> v == "1" || v.equals("true", ignoreCase = true)
            else -> true
        }
    }

    private fun rowToProduct(cols: List<String>, vals: List<Any?>): ProductEntity? {
        if (vals.isEmpty()) return null
        return ProductEntity(
            id = str(cols, vals, "id"), name = str(cols, vals, "name"), sku = str(cols, vals, "sku"),
            hsnCode = str(cols, vals, "hsnCode"), barcode = str(cols, vals, "barcode"),
            description = str(cols, vals, "description"), category = str(cols, vals, "category"),
            subCategory = str(cols, vals, "subCategory"), brand = str(cols, vals, "brand"),
            unit = str(cols, vals, "unit"), purchasePrice = dbl(cols, vals, "purchasePrice"),
            sellingPrice = dbl(cols, vals, "sellingPrice"), mrp = dbl(cols, vals, "mrp"),
            discount = dbl(cols, vals, "discount"), tax = dbl(cols, vals, "tax"),
            gstRate = dbl(cols, vals, "gstRate"), minimumStock = dbl(cols, vals, "minimumStock"),
            maximumStock = dbl(cols, vals, "maximumStock"), openingStock = dbl(cols, vals, "openingStock"),
            currentStock = dbl(cols, vals, "currentStock"), warehouse = str(cols, vals, "warehouse"),
            supplier = str(cols, vals, "supplier"), location = str(cols, vals, "location"),
            expiryDate = lng(cols, vals, "expiryDate"), manufacturingDate = lng(cols, vals, "manufacturingDate"),
            batchNumber = str(cols, vals, "batchNumber"), notes = str(cols, vals, "notes"),
            images = str(cols, vals, "images"), isActive = bool(cols, vals, "isActive"),
            createdAt = lng(cols, vals, "createdAt") ?: 0L, updatedAt = lng(cols, vals, "updatedAt") ?: 0L
        )
    }

    private fun rowToCategory(cols: List<String>, vals: List<Any?>): CategoryEntity? {
        if (vals.isEmpty()) return null
        return CategoryEntity(id = str(cols, vals, "id"), name = str(cols, vals, "name"), description = str(cols, vals, "description"))
    }

    private fun rowToBrand(cols: List<String>, vals: List<Any?>): BrandEntity? {
        if (vals.isEmpty()) return null
        return BrandEntity(id = str(cols, vals, "id"), name = str(cols, vals, "name"), description = str(cols, vals, "description"))
    }

    private fun rowToSupplier(cols: List<String>, vals: List<Any?>): SupplierEntity? {
        if (vals.isEmpty()) return null
        return SupplierEntity(
            id = str(cols, vals, "id"), name = str(cols, vals, "name"), code = str(cols, vals, "code"),
            contactPerson = str(cols, vals, "contactPerson"), email = str(cols, vals, "email"),
            phone = str(cols, vals, "phone"), alternatePhone = str(cols, vals, "alternatePhone"),
            gstin = str(cols, vals, "gstin"), pan = str(cols, vals, "pan"),
            address = str(cols, vals, "address"), city = str(cols, vals, "city"),
            state = str(cols, vals, "state"), pincode = str(cols, vals, "pincode"),
            creditLimit = dbl(cols, vals, "creditLimit"), creditDays = int(cols, vals, "creditDays"),
            isActive = bool(cols, vals, "isActive"), notes = str(cols, vals, "notes"),
            createdAt = lng(cols, vals, "createdAt") ?: 0L
        )
    }

    private fun rowToCustomer(cols: List<String>, vals: List<Any?>): CustomerEntity? {
        if (vals.isEmpty()) return null
        return CustomerEntity(
            id = str(cols, vals, "id"), name = str(cols, vals, "name"), code = str(cols, vals, "code"),
            type = str(cols, vals, "type"), email = str(cols, vals, "email"), phone = str(cols, vals, "phone"),
            gstin = str(cols, vals, "gstin"), address = str(cols, vals, "address"),
            city = str(cols, vals, "city"), state = str(cols, vals, "state"),
            pincode = str(cols, vals, "pincode"), creditLimit = dbl(cols, vals, "creditLimit"),
            creditDays = int(cols, vals, "creditDays"), isActive = bool(cols, vals, "isActive"),
            notes = str(cols, vals, "notes"), createdAt = lng(cols, vals, "createdAt") ?: 0L
        )
    }

    private fun rowToSale(cols: List<String>, vals: List<Any?>): SaleEntity? {
        if (vals.isEmpty()) return null
        return SaleEntity(
            id = str(cols, vals, "id"), invoiceNumber = str(cols, vals, "invoiceNumber"),
            customerId = strOrNull(cols, vals, "customerId"), customerName = str(cols, vals, "customerName"),
            customerPhone = str(cols, vals, "customerPhone"), customerGstin = str(cols, vals, "customerGstin"),
            saleDate = lng(cols, vals, "saleDate") ?: 0L, subtotal = dbl(cols, vals, "subtotal"),
            discountAmount = dbl(cols, vals, "discountAmount"), taxAmount = dbl(cols, vals, "taxAmount"),
            cgstTotal = dbl(cols, vals, "cgstTotal"), sgstTotal = dbl(cols, vals, "sgstTotal"),
            igstTotal = dbl(cols, vals, "igstTotal"), roundOff = dbl(cols, vals, "roundOff"),
            totalAmount = dbl(cols, vals, "totalAmount"), paidAmount = dbl(cols, vals, "paidAmount"),
            balanceAmount = dbl(cols, vals, "balanceAmount"), paymentMethod = str(cols, vals, "paymentMethod"),
            paymentStatus = str(cols, vals, "paymentStatus"), status = str(cols, vals, "status"),
            notes = str(cols, vals, "notes"), createdAt = lng(cols, vals, "createdAt") ?: 0L
        )
    }

    private fun rowToSaleItem(cols: List<String>, vals: List<Any?>): SaleItemEntity? {
        if (vals.isEmpty()) return null
        return SaleItemEntity(
            id = str(cols, vals, "id"), saleId = str(cols, vals, "saleId"), productId = str(cols, vals, "productId"),
            productName = str(cols, vals, "productName"), productSku = str(cols, vals, "productSku"),
            quantity = dbl(cols, vals, "quantity"), unitPrice = dbl(cols, vals, "unitPrice"),
            discountPercent = dbl(cols, vals, "discountPercent"), discountAmount = dbl(cols, vals, "discountAmount"),
            taxableAmount = dbl(cols, vals, "taxableAmount"), gstRate = dbl(cols, vals, "gstRate"),
            cgstAmount = dbl(cols, vals, "cgstAmount"), sgstAmount = dbl(cols, vals, "sgstAmount"),
            igstAmount = dbl(cols, vals, "igstAmount"), totalAmount = dbl(cols, vals, "totalAmount")
        )
    }

    private fun rowToPurchase(cols: List<String>, vals: List<Any?>): PurchaseEntity? {
        if (vals.isEmpty()) return null
        return PurchaseEntity(
            id = str(cols, vals, "id"), purchaseNumber = str(cols, vals, "purchaseNumber"),
            supplierId = strOrNull(cols, vals, "supplierId"), supplierName = str(cols, vals, "supplierName"),
            purchaseDate = lng(cols, vals, "purchaseDate") ?: 0L, subtotal = dbl(cols, vals, "subtotal"),
            discountAmount = dbl(cols, vals, "discountAmount"), taxAmount = dbl(cols, vals, "taxAmount"),
            shippingCost = dbl(cols, vals, "shippingCost"), otherCharges = dbl(cols, vals, "otherCharges"),
            totalAmount = dbl(cols, vals, "totalAmount"), paidAmount = dbl(cols, vals, "paidAmount"),
            balanceAmount = dbl(cols, vals, "balanceAmount"), paymentStatus = str(cols, vals, "paymentStatus"),
            status = str(cols, vals, "status"), notes = str(cols, vals, "notes"),
            createdAt = lng(cols, vals, "createdAt") ?: 0L
        )
    }

    private fun rowToPurchaseItem(cols: List<String>, vals: List<Any?>): PurchaseItemEntity? {
        if (vals.isEmpty()) return null
        return PurchaseItemEntity(
            id = str(cols, vals, "id"), purchaseId = str(cols, vals, "purchaseId"),
            productId = str(cols, vals, "productId"), productName = str(cols, vals, "productName"),
            quantity = dbl(cols, vals, "quantity"), unitPrice = dbl(cols, vals, "unitPrice"),
            discount = dbl(cols, vals, "discount"), taxAmount = dbl(cols, vals, "taxAmount"),
            totalAmount = dbl(cols, vals, "totalAmount"), receivedQuantity = dbl(cols, vals, "receivedQuantity")
        )
    }

    private fun rowToStockMovement(cols: List<String>, vals: List<Any?>): StockMovementEntity? {
        if (vals.isEmpty()) return null
        return StockMovementEntity(
            id = str(cols, vals, "id"), productId = str(cols, vals, "productId"),
            productName = str(cols, vals, "productName"), movementType = str(cols, vals, "movementType"),
            quantity = dbl(cols, vals, "quantity"), beforeStock = dbl(cols, vals, "beforeStock"),
            afterStock = dbl(cols, vals, "afterStock"), referenceId = str(cols, vals, "referenceId"),
            referenceType = str(cols, vals, "referenceType"), notes = str(cols, vals, "notes"),
            createdAt = lng(cols, vals, "createdAt") ?: 0L
        )
    }

    private fun rowToCashBook(cols: List<String>, vals: List<Any?>): CashBookEntity? {
        if (vals.isEmpty()) return null
        return CashBookEntity(
            id = str(cols, vals, "id"), date = lng(cols, vals, "date") ?: 0L,
            voucherNumber = str(cols, vals, "voucherNumber"), transactionType = str(cols, vals, "transactionType"),
            category = str(cols, vals, "category"), description = str(cols, vals, "description"),
            amount = dbl(cols, vals, "amount"), balance = dbl(cols, vals, "balance"),
            referenceId = str(cols, vals, "referenceId"), notes = str(cols, vals, "notes")
        )
    }

    private fun rowToExpense(cols: List<String>, vals: List<Any?>): ExpenseEntity? {
        if (vals.isEmpty()) return null
        return ExpenseEntity(
            id = str(cols, vals, "id"), date = lng(cols, vals, "date") ?: 0L,
            category = str(cols, vals, "category"), subCategory = str(cols, vals, "subCategory"),
            description = str(cols, vals, "description"), amount = dbl(cols, vals, "amount"),
            paymentMethod = str(cols, vals, "paymentMethod"), vendor = str(cols, vals, "vendor"),
            receiptNumber = str(cols, vals, "receiptNumber"), gstAmount = dbl(cols, vals, "gstAmount"),
            notes = str(cols, vals, "notes")
        )
    }

    private fun rowToIncome(cols: List<String>, vals: List<Any?>): IncomeEntity? {
        if (vals.isEmpty()) return null
        return IncomeEntity(
            id = str(cols, vals, "id"), date = lng(cols, vals, "date") ?: 0L,
            category = str(cols, vals, "category"), subCategory = str(cols, vals, "subCategory"),
            description = str(cols, vals, "description"), amount = dbl(cols, vals, "amount"),
            paymentMethod = str(cols, vals, "paymentMethod"), customer = str(cols, vals, "customer"),
            invoiceNumber = str(cols, vals, "invoiceNumber"), gstAmount = dbl(cols, vals, "gstAmount"),
            notes = str(cols, vals, "notes")
        )
    }
}
