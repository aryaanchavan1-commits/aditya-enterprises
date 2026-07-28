package com.arynoxtech.erp.service

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.arynoxtech.erp.data.local.PurchaseDao
import com.arynoxtech.erp.data.local.PurchaseEntity
import com.arynoxtech.erp.data.local.SaleDao
import com.arynoxtech.erp.data.local.SaleEntity
import com.arynoxtech.erp.data.local.ProductDao
import com.arynoxtech.erp.data.local.ProductEntity
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import org.apache.poi.ss.usermodel.WorkbookFactory
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ImportExportService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val productDao: ProductDao,
    private val saleDao: SaleDao,
    private val purchaseDao: PurchaseDao
) {
    suspend fun exportAllData(): Result<Uri> = withContext(Dispatchers.IO) {
        try {
            val workbook = XSSFWorkbook()
            val products = productDao.getAll().first()
            val sales = saleDao.getAllSales().first()
            val purchases = purchaseDao.getAllPurchases().first()

            exportProductsSheet(workbook, products)
            exportSalesSheet(workbook, sales)
            exportPurchasesSheet(workbook, purchases)

            val fileName = "AdityaERP_Export_${System.currentTimeMillis()}.xlsx"
            val outputDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!outputDir.exists()) outputDir.mkdirs()
            val file = File(outputDir, fileName)

            FileOutputStream(file).use { workbook.write(it) }
            workbook.close()

            val uri: Uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val resolver = context.contentResolver
                val itemUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                itemUri?.let {
                    resolver.openOutputStream(it)?.use { outputStream ->
                        file.inputStream().copyTo(outputStream)
                    }
                }
                file.delete()
                itemUri ?: Uri.fromFile(file)
            } else {
                Uri.fromFile(file)
            }

            Result.success(uri)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun shareFile(uri: Uri) {
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(shareIntent, "Share ERP Data").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }

    suspend fun importFromUri(uri: Uri): Result<String> = withContext(Dispatchers.IO) {
        try {
            val inputStream = context.contentResolver.openInputStream(uri)
                ?: return@withContext Result.failure(Exception("Cannot open file"))
            val workbook = WorkbookFactory.create(inputStream)
            var productsImported = 0
            var salesImported = 0
            var purchasesImported = 0

            for (i in 0 until workbook.numberOfSheets) {
                val sheet = workbook.getSheetAt(i)
                when (sheet.sheetName.lowercase()) {
                    "products" -> {
                        for (r in 1..sheet.lastRowNum) {
                            val row = sheet.getRow(r) ?: continue
                            try {
                                productDao.upsert(ProductEntity(
                                    id = UUID.randomUUID().toString(),
                                    name = row.getCell(0)?.toString() ?: continue,
                                    sku = row.getCell(1)?.toString() ?: "",
                                    barcode = row.getCell(2)?.toString() ?: "",
                                    category = row.getCell(3)?.toString() ?: "",
                                    brand = row.getCell(4)?.toString() ?: "",
                                    unit = row.getCell(5)?.toString() ?: "",
                                    purchasePrice = row.getCell(6)?.numericCellValue ?: 0.0,
                                    sellingPrice = row.getCell(7)?.numericCellValue ?: 0.0,
                                    mrp = row.getCell(8)?.numericCellValue ?: 0.0,
                                    gstRate = row.getCell(9)?.numericCellValue ?: 0.0,
                                    currentStock = row.getCell(10)?.numericCellValue ?: 0.0,
                                    minimumStock = row.getCell(11)?.numericCellValue ?: 0.0,
                                    hsnCode = row.getCell(12)?.toString() ?: "",
                                    isActive = true,
                                    createdAt = System.currentTimeMillis(),
                                    updatedAt = System.currentTimeMillis()
                                ))
                                productsImported++
                            } catch (_: Exception) {}
                        }
                    }
                    "sales" -> {
                        for (r in 1..sheet.lastRowNum) {
                            val row = sheet.getRow(r) ?: continue
                            try {
                                saleDao.insertSale(SaleEntity(
                                    id = row.getCell(0)?.toString() ?: UUID.randomUUID().toString(),
                                    invoiceNumber = row.getCell(1)?.toString() ?: "",
                                    customerName = row.getCell(2)?.toString() ?: "",
                                    customerPhone = row.getCell(3)?.toString() ?: "",
                                    customerGstin = row.getCell(4)?.toString() ?: "",
                                    totalAmount = row.getCell(5)?.numericCellValue ?: 0.0,
                                    discountAmount = row.getCell(6)?.numericCellValue ?: 0.0,
                                    taxAmount = row.getCell(7)?.numericCellValue ?: 0.0,
                                    paidAmount = row.getCell(8)?.numericCellValue ?: 0.0,
                                    paymentMethod = row.getCell(9)?.toString() ?: "cash",
                                    paymentStatus = row.getCell(10)?.toString() ?: "pending",
                                    status = "active",
                                    saleDate = (row.getCell(11)?.numericCellValue?.toLong()) ?: System.currentTimeMillis(),
                                    createdAt = System.currentTimeMillis()
                                ))
                                salesImported++
                            } catch (_: Exception) {}
                        }
                    }
                    "purchases" -> {
                        for (r in 1..sheet.lastRowNum) {
                            val row = sheet.getRow(r) ?: continue
                            try {
                                purchaseDao.insertPurchase(PurchaseEntity(
                                    id = row.getCell(0)?.toString() ?: UUID.randomUUID().toString(),
                                    purchaseNumber = row.getCell(1)?.toString() ?: "",
                                    supplierName = row.getCell(2)?.toString() ?: "",
                                    totalAmount = row.getCell(3)?.numericCellValue ?: 0.0,
                                    discountAmount = row.getCell(4)?.numericCellValue ?: 0.0,
                                    taxAmount = row.getCell(5)?.numericCellValue ?: 0.0,
                                    paidAmount = row.getCell(6)?.numericCellValue ?: 0.0,
                                    paymentStatus = row.getCell(7)?.toString() ?: "pending",
                                    status = "ordered",
                                    purchaseDate = (row.getCell(8)?.numericCellValue?.toLong()) ?: System.currentTimeMillis(),
                                    createdAt = System.currentTimeMillis()
                                ))
                                purchasesImported++
                            } catch (_: Exception) {}
                        }
                    }
                }
            }

            workbook.close()
            inputStream.close()

            Result.success("Imported $productsImported products, $salesImported sales, $purchasesImported purchases")
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun exportProductsSheet(workbook: XSSFWorkbook, products: List<ProductEntity>) {
        val sheet = workbook.createSheet("Products")
        val header = sheet.createRow(0)
        arrayOf("Name", "SKU", "Barcode", "Category", "Brand", "Unit", "Purchase Price", "Selling Price", "MRP", "GST Rate", "Current Stock", "Min Stock", "HSN Code")
            .forEachIndexed { i, h -> header.createCell(i).setCellValue(h) }

        products.forEachIndexed { index, p ->
            val row = sheet.createRow(index + 1)
            row.createCell(0).setCellValue(p.name)
            row.createCell(1).setCellValue(p.sku)
            row.createCell(2).setCellValue(p.barcode)
            row.createCell(3).setCellValue(p.category)
            row.createCell(4).setCellValue(p.brand)
            row.createCell(5).setCellValue(p.unit)
            row.createCell(6).setCellValue(p.purchasePrice)
            row.createCell(7).setCellValue(p.sellingPrice)
            row.createCell(8).setCellValue(p.mrp)
            row.createCell(9).setCellValue(p.gstRate)
            row.createCell(10).setCellValue(p.currentStock)
            row.createCell(11).setCellValue(p.minimumStock)
            row.createCell(12).setCellValue(p.hsnCode)
        }
    }

    private fun exportSalesSheet(workbook: XSSFWorkbook, sales: List<SaleEntity>) {
        val sheet = workbook.createSheet("Sales")
        val header = sheet.createRow(0)
        arrayOf("ID", "Invoice", "Customer", "Phone", "GSTIN", "Total", "Discount", "Tax", "Paid", "Payment", "Status", "Date")
            .forEachIndexed { i, h -> header.createCell(i).setCellValue(h) }

        sales.forEachIndexed { index, s ->
            val row = sheet.createRow(index + 1)
            row.createCell(0).setCellValue(s.id)
            row.createCell(1).setCellValue(s.invoiceNumber)
            row.createCell(2).setCellValue(s.customerName)
            row.createCell(3).setCellValue(s.customerPhone)
            row.createCell(4).setCellValue(s.customerGstin)
            row.createCell(5).setCellValue(s.totalAmount)
            row.createCell(6).setCellValue(s.discountAmount)
            row.createCell(7).setCellValue(s.taxAmount)
            row.createCell(8).setCellValue(s.paidAmount)
            row.createCell(9).setCellValue(s.paymentMethod)
            row.createCell(10).setCellValue(s.paymentStatus)
            row.createCell(11).setCellValue(s.saleDate.toDouble())
        }
    }

    private fun exportPurchasesSheet(workbook: XSSFWorkbook, purchases: List<PurchaseEntity>) {
        val sheet = workbook.createSheet("Purchases")
        val header = sheet.createRow(0)
        arrayOf("ID", "Purchase No", "Supplier", "Total", "Discount", "Tax", "Paid", "Payment Status", "Status", "Date")
            .forEachIndexed { i, h -> header.createCell(i).setCellValue(h) }

        purchases.forEachIndexed { index, p ->
            val row = sheet.createRow(index + 1)
            row.createCell(0).setCellValue(p.id)
            row.createCell(1).setCellValue(p.purchaseNumber)
            row.createCell(2).setCellValue(p.supplierName)
            row.createCell(3).setCellValue(p.totalAmount)
            row.createCell(4).setCellValue(p.discountAmount)
            row.createCell(5).setCellValue(p.taxAmount)
            row.createCell(6).setCellValue(p.paidAmount)
            row.createCell(7).setCellValue(p.paymentStatus)
            row.createCell(8).setCellValue(p.status)
            row.createCell(9).setCellValue(p.purchaseDate.toDouble())
        }
    }
}
