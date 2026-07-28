package com.arynoxtech.erp.service

import android.content.Context
import android.os.Environment
import com.arynoxtech.erp.data.local.AppDatabase
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStreamReader
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BackupService @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private val backupDir: File
        get() {
            val dir = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS),
                "AdityaERP/Backups"
            )
            if (!dir.exists()) dir.mkdirs()
            return dir
        }

    suspend fun createDatabaseBackup(): Result<File> = withContext(Dispatchers.IO) {
        try {
            val dbFile = context.getDatabasePath("erp_database")
            if (!dbFile.exists()) {
                return@withContext Result.failure(Exception("Database file not found"))
            }

            val dateStr = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val backupFile = File(backupDir, "erp_backup_$dateStr.db")

            FileInputStream(dbFile).use { input ->
                FileOutputStream(backupFile).use { output ->
                    input.copyTo(output)
                }
            }

            Result.success(backupFile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun exportDataToJson(): Result<File> = withContext(Dispatchers.IO) {
        try {
            val db = AppDatabase.getDatabase(context)

            val exportJson = JSONObject().apply {
                put("export_date", SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date()))
                put("app_version", getAppVersion())

                put("products", JSONArray().apply {
                    db.productDao().getAll().let { flow ->
                        var list = emptyList<com.arynoxtech.erp.data.local.ProductEntity>()
                        flow.collect { list = it; return@collect }
                        list.forEach { put(it.toJson()) }
                    }
                })

                put("customers", JSONArray().apply {
                    db.customerDao().getAll().let { flow ->
                        var list = emptyList<com.arynoxtech.erp.data.local.CustomerEntity>()
                        flow.collect { list = it; return@collect }
                        list.forEach { put(it.toJson()) }
                    }
                })

                put("suppliers", JSONArray().apply {
                    db.supplierDao().getAll().let { flow ->
                        var list = emptyList<com.arynoxtech.erp.data.local.SupplierEntity>()
                        flow.collect { list = it; return@collect }
                        list.forEach { put(it.toJson()) }
                    }
                })

                put("cash_book", JSONArray().apply {
                    db.accountingDao().getCashBook().let { flow ->
                        var list = emptyList<com.arynoxtech.erp.data.local.CashBookEntity>()
                        flow.collect { list = it; return@collect }
                        list.forEach { put(it.toJson()) }
                    }
                })
            }

            val dateStr = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val exportFile = File(backupDir, "erp_export_$dateStr.json")

            FileOutputStream(exportFile).use { output ->
                output.write(exportJson.toString(2).toByteArray(Charsets.UTF_8))
            }

            Result.success(exportFile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun importDataFromJson(file: File): Result<Int> = withContext(Dispatchers.IO) {
        try {
            val content = StringBuilder()
            BufferedReader(InputStreamReader(FileInputStream(file))).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    content.append(line)
                }
            }

            val importJson = JSONObject(content.toString())
            val db = AppDatabase.getDatabase(context)
            var importedCount = 0

            val products = importJson.optJSONArray("products")
            if (products != null) {
                for (i in 0 until products.length()) {
                    val obj = products.getJSONObject(i)
                    val entity = jsonToProductEntity(obj)
                    db.productDao().upsert(entity)
                    importedCount++
                }
            }

            val customers = importJson.optJSONArray("customers")
            if (customers != null) {
                for (i in 0 until customers.length()) {
                    val obj = customers.getJSONObject(i)
                    val entity = jsonToCustomerEntity(obj)
                    db.customerDao().insert(entity)
                    importedCount++
                }
            }

            val suppliers = importJson.optJSONArray("suppliers")
            if (suppliers != null) {
                for (i in 0 until suppliers.length()) {
                    val obj = suppliers.getJSONObject(i)
                    val entity = jsonToSupplierEntity(obj)
                    db.supplierDao().insert(entity)
                    importedCount++
                }
            }

            Result.success(importedCount)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun restoreDatabaseFromBackup(backupFile: File): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val dbFile = context.getDatabasePath("erp_database")
            if (!backupFile.exists()) {
                return@withContext Result.failure(Exception("Backup file not found"))
            }

            val db = AppDatabase.getDatabase(context)
            db.clearAllTables()

            FileInputStream(backupFile).use { input ->
                FileOutputStream(dbFile).use { output ->
                    input.copyTo(output)
                }
            }

            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getBackupFiles(): List<File> {
        val dir = backupDir
        if (!dir.exists()) return emptyList()
        return dir.listFiles { file ->
            file.name.endsWith(".db") || file.name.endsWith(".json")
        }?.sortedByDescending { it.lastModified() } ?: emptyList()
    }

    fun getBackupDirectory(): File = backupDir

    private fun getAppVersion(): String {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "unknown"
        } catch (e: Exception) {
            "unknown"
        }
    }

    companion object {
        private const val DATABASE_NAME = "erp_database"
    }
}

private fun com.arynoxtech.erp.data.local.ProductEntity.toJson(): JSONObject = JSONObject().apply {
    put("id", id)
    put("name", name)
    put("sku", sku)
    put("hsnCode", hsnCode)
    put("barcode", barcode)
    put("description", description)
    put("category", category)
    put("subCategory", subCategory)
    put("brand", brand)
    put("unit", unit)
    put("purchasePrice", purchasePrice)
    put("sellingPrice", sellingPrice)
    put("mrp", mrp)
    put("currentStock", currentStock)
    put("minimumStock", minimumStock)
    put("maximumStock", maximumStock)
    put("isActive", isActive)
    put("createdAt", createdAt)
}

private fun jsonToProductEntity(json: JSONObject): com.arynoxtech.erp.data.local.ProductEntity =
    com.arynoxtech.erp.data.local.ProductEntity(
        id = json.optString("id", ""),
        name = json.optString("name", ""),
        sku = json.optString("sku", ""),
        hsnCode = json.optString("hsnCode", ""),
        barcode = json.optString("barcode", ""),
        description = json.optString("description", ""),
        category = json.optString("category", ""),
        subCategory = json.optString("subCategory", ""),
        brand = json.optString("brand", ""),
        unit = json.optString("unit", ""),
        purchasePrice = json.optDouble("purchasePrice", 0.0),
        sellingPrice = json.optDouble("sellingPrice", 0.0),
        mrp = json.optDouble("mrp", 0.0),
        currentStock = json.optDouble("currentStock", 0.0),
        minimumStock = json.optDouble("minimumStock", 0.0),
        maximumStock = json.optDouble("maximumStock", 0.0),
        isActive = json.optBoolean("isActive", true),
        createdAt = json.optLong("createdAt", System.currentTimeMillis()),
        updatedAt = System.currentTimeMillis()
    )

private fun com.arynoxtech.erp.data.local.CustomerEntity.toJson(): JSONObject = JSONObject().apply {
    put("id", id)
    put("name", name)
    put("code", code)
    put("type", type)
    put("email", email)
    put("phone", phone)
    put("gstin", gstin)
    put("address", address)
    put("city", city)
    put("state", state)
    put("pincode", pincode)
    put("creditLimit", creditLimit)
    put("creditDays", creditDays)
    put("isActive", isActive)
    put("notes", notes)
    put("createdAt", createdAt)
}

private fun jsonToCustomerEntity(json: JSONObject): com.arynoxtech.erp.data.local.CustomerEntity =
    com.arynoxtech.erp.data.local.CustomerEntity(
        id = json.optString("id", ""),
        name = json.optString("name", ""),
        code = json.optString("code", ""),
        type = json.optString("type", "retail"),
        email = json.optString("email", ""),
        phone = json.optString("phone", ""),
        gstin = json.optString("gstin", ""),
        address = json.optString("address", ""),
        city = json.optString("city", ""),
        state = json.optString("state", ""),
        pincode = json.optString("pincode", ""),
        creditLimit = json.optDouble("creditLimit", 0.0),
        creditDays = json.optInt("creditDays", 0),
        isActive = json.optBoolean("isActive", true),
        notes = json.optString("notes", ""),
        createdAt = json.optLong("createdAt", System.currentTimeMillis())
    )

private fun com.arynoxtech.erp.data.local.SupplierEntity.toJson(): JSONObject = JSONObject().apply {
    put("id", id)
    put("name", name)
    put("code", code)
    put("contactPerson", contactPerson)
    put("email", email)
    put("phone", phone)
    put("gstin", gstin)
    put("address", address)
    put("city", city)
    put("state", state)
    put("pincode", pincode)
    put("creditLimit", creditLimit)
    put("creditDays", creditDays)
    put("isActive", isActive)
    put("createdAt", createdAt)
}

private fun jsonToSupplierEntity(json: JSONObject): com.arynoxtech.erp.data.local.SupplierEntity =
    com.arynoxtech.erp.data.local.SupplierEntity(
        id = json.optString("id", ""),
        name = json.optString("name", ""),
        code = json.optString("code", ""),
        contactPerson = json.optString("contactPerson", ""),
        email = json.optString("email", ""),
        phone = json.optString("phone", ""),
        gstin = json.optString("gstin", ""),
        address = json.optString("address", ""),
        city = json.optString("city", ""),
        state = json.optString("state", ""),
        pincode = json.optString("pincode", ""),
        creditLimit = json.optDouble("creditLimit", 0.0),
        creditDays = json.optInt("creditDays", 0),
        isActive = json.optBoolean("isActive", true),
        notes = json.optString("notes", ""),
        createdAt = json.optLong("createdAt", System.currentTimeMillis())
    )

private fun com.arynoxtech.erp.data.local.CashBookEntity.toJson(): JSONObject = JSONObject().apply {
    put("id", id)
    put("date", date)
    put("voucherNumber", voucherNumber)
    put("transactionType", transactionType)
    put("category", category)
    put("description", description)
    put("amount", amount)
    put("balance", balance)
    put("referenceId", referenceId)
    put("notes", notes)
}
