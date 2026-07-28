package com.arynoxtech.erp.util

import android.content.ContentValues
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.arynoxtech.erp.data.repository.BalanceSheetData
import com.arynoxtech.erp.data.repository.ProfitLossData
import com.arynoxtech.erp.ui.screens.reports.GstReportData
import com.arynoxtech.erp.ui.screens.reports.ReportData
import org.apache.poi.ss.usermodel.BorderStyle
import org.apache.poi.ss.usermodel.CellStyle
import org.apache.poi.ss.usermodel.FillPatternType
import org.apache.poi.ss.usermodel.HorizontalAlignment
import org.apache.poi.ss.usermodel.IndexedColors
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ReportExporter(private val context: Context) {

    companion object {
        private const val COMPANY_NAME = "Aditya Enterprises"
        private const val COMPANY_TAGLINE = "Your Trusted Partner"
        private const val PAGE_WIDTH = 595
        private const val PAGE_HEIGHT = 842
        private const val MARGIN = 50f
        private const val HEADER_SIZE = 28f
        private const val SUBHEADER_SIZE = 16f
        private const val BODY_SIZE = 12f
        private const val SMALL_SIZE = 10f
    }

    fun exportSalesReportPdf(data: ReportData, period: String): File =
        createReportPdf("Sales_Report", period, data, "SALES REPORT")

    fun exportPurchaseReportPdf(data: ReportData, period: String): File =
        createReportPdf("Purchase_Report", period, data, "PURCHASE REPORT")

    fun exportBalanceSheetPdf(data: BalanceSheetData, asOn: String): File {
        val document = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, 1).create()
        val page = document.startPage(pageInfo)
        val canvas = page.canvas

        drawHeader(canvas, "BALANCE SHEET", asOn)

        var y = 160f

        y = drawSectionHeader(canvas, "ASSETS", y)
        y = drawBalanceRow(canvas, "Cash Balance", data.cashBalance, y)
        y = drawBalanceRow(canvas, "Bank Balance", data.bankBalance, y)
        y = drawBalanceRow(canvas, "Receivables", data.receivables, y)
        y = drawBalanceRow(canvas, "Total Assets", data.totalAssets, y, bold = true)

        y += 20f
        y = drawSectionHeader(canvas, "LIABILITIES", y)
        y = drawBalanceRow(canvas, "Payables", data.payables, y)
        y = drawBalanceRow(canvas, "Equity", data.equity, y)
        y = drawBalanceRow(canvas, "Total Liabilities", data.totalLiabilities, y, bold = true)

        y += 30f
        val diff = data.totalAssets - data.totalLiabilities
        drawBalanceRow(canvas, if (Math.abs(diff) < 0.01) "✓ BALANCED" else "DIFFERENCE", diff, y, bold = true)

        document.finishPage(page)
        return saveDocument(document, "Balance_Sheet_${asOn.replace(" ", "_")}.pdf")
    }

    fun exportProfitLossPdf(data: ProfitLossData, period: String): File {
        val document = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, 1).create()
        val page = document.startPage(pageInfo)
        val canvas = page.canvas

        drawHeader(canvas, "PROFIT & LOSS STATEMENT", period)

        var y = 160f

        y = drawSectionHeader(canvas, "INCOME", y)
        y = drawBalanceRow(canvas, "Total Revenue", data.totalRevenue, y)
        y += 20f

        y = drawSectionHeader(canvas, "EXPENSES", y)
        y = drawBalanceRow(canvas, "Total Expenses", data.totalExpenses, y)
        y += 20f

        y = drawSectionHeader(canvas, "SUMMARY", y)
        y = drawBalanceRow(canvas, "Gross Profit", data.grossProfit, y)
        y = drawBalanceRow(canvas, "Net Profit", data.netProfit, y, bold = true)

        document.finishPage(page)
        return saveDocument(document, "Profit_Loss_${period.replace(" ", "_")}.pdf")
    }

    fun exportGstReportPdf(data: GstReportData, period: String): File {
        val document = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, 1).create()
        val page = document.startPage(pageInfo)
        val canvas = page.canvas

        drawHeader(canvas, "GST REPORT", period)

        var y = 160f

        y = drawBalanceRow(canvas, "Taxable Value", data.taxableValue, y)
        y = drawBalanceRow(canvas, "CGST", data.cgst, y)
        y = drawBalanceRow(canvas, "SGST", data.sgst, y)
        y = drawBalanceRow(canvas, "IGST", data.igst, y)
        y = drawBalanceRow(canvas, "Total Tax Liability", data.totalTax, y, bold = true)

        document.finishPage(page)
        return saveDocument(document, "GST_Report_${period.replace(" ", "_")}.pdf")
    }

    fun exportSalesReportExcel(data: ReportData, period: String): File =
        createReportExcel(data, period, "Sales Report")

    fun exportPurchaseReportExcel(data: ReportData, period: String): File =
        createReportExcel(data, period, "Purchase Report")

    fun exportBalanceSheetExcel(data: BalanceSheetData, asOn: String): File {
        val workbook = XSSFWorkbook()
        val sheet = workbook.createSheet("Balance Sheet")

        val headerStyle = workbook.createCellStyle().apply {
            alignment = HorizontalAlignment.CENTER
            fillForegroundColor = IndexedColors.DARK_BLUE.index
            fillPattern = FillPatternType.SOLID_FOREGROUND
            val font = workbook.createFont().apply {
                bold = true
                color = IndexedColors.WHITE.index
                fontHeightInPoints = 14
            }
            setFont(font)
        }

        val boldStyle = workbook.createCellStyle().apply {
            val font = workbook.createFont().apply { bold = true; fontHeightInPoints = 12 }
            setFont(font)
            borderTop = BorderStyle.THIN
            borderBottom = BorderStyle.THIN
        }

        val normalStyle = workbook.createCellStyle().apply {
            val font = workbook.createFont().apply { fontHeightInPoints = 11 }
            setFont(font)
            borderTop = BorderStyle.THIN
            borderBottom = BorderStyle.THIN
        }

        val amountStyle = workbook.createCellStyle().apply {
            val font = workbook.createFont().apply { fontHeightInPoints = 11 }
            setFont(font)
            borderTop = BorderStyle.THIN
            borderBottom = BorderStyle.THIN
            alignment = HorizontalAlignment.RIGHT
        }

        var rowNum = 0
        val titleRow = sheet.createRow(rowNum++)
        titleRow.createCell(0).apply {
            setCellValue("Aditya Enterprises - Balance Sheet ($asOn)")
            cellStyle = headerStyle
        }
        sheet.addMergedRegion(org.apache.poi.ss.util.CellRangeAddress(rowNum - 1, rowNum - 1, 0, 2))

        rowNum++
        sheet.createRow(rowNum++).createCell(0).setCellValue("ASSETS")
        sheet.getRow(rowNum - 1).getCell(0).cellStyle = boldStyle

        rowNum = writeBalanceSheetRow(sheet, rowNum, "Cash Balance", data.cashBalance, normalStyle, amountStyle)
        rowNum = writeBalanceSheetRow(sheet, rowNum, "Bank Balance", data.bankBalance, normalStyle, amountStyle)
        rowNum = writeBalanceSheetRow(sheet, rowNum, "Receivables", data.receivables, normalStyle, amountStyle)

        rowNum++
        writeBalanceSheetRow(sheet, rowNum, "Total Assets", data.totalAssets, boldStyle, amountStyle)

        rowNum += 2
        sheet.createRow(rowNum++).createCell(0).setCellValue("LIABILITIES")
        sheet.getRow(rowNum - 1).getCell(0).cellStyle = boldStyle

        rowNum = writeBalanceSheetRow(sheet, rowNum, "Payables", data.payables, normalStyle, amountStyle)
        rowNum = writeBalanceSheetRow(sheet, rowNum, "Equity", data.equity, normalStyle, amountStyle)

        rowNum++
        writeBalanceSheetRow(sheet, rowNum, "Total Liabilities", data.totalLiabilities, boldStyle, amountStyle)

        sheet.setColumnWidth(0, 6000)
        sheet.setColumnWidth(1, 3000)
        sheet.setColumnWidth(2, 3000)

        return saveWorkbook(workbook, "Balance_Sheet_${asOn.replace(" ", "_")}.xlsx")
    }

    fun exportProfitLossExcel(data: ProfitLossData, period: String): File {
        val workbook = XSSFWorkbook()
        val sheet = workbook.createSheet("Profit & Loss")

        val headerStyle = workbook.createCellStyle().apply {
            alignment = HorizontalAlignment.CENTER
            fillForegroundColor = IndexedColors.DARK_BLUE.index
            fillPattern = FillPatternType.SOLID_FOREGROUND
            val font = workbook.createFont().apply {
                bold = true
                color = IndexedColors.WHITE.index
                fontHeightInPoints = 14
            }
            setFont(font)
        }

        val boldStyle = workbook.createCellStyle().apply {
            val font = workbook.createFont().apply { bold = true; fontHeightInPoints = 12 }
            setFont(font)
            borderTop = BorderStyle.THIN
            borderBottom = BorderStyle.THIN
        }

        val normalStyle = workbook.createCellStyle().apply {
            val font = workbook.createFont().apply { fontHeightInPoints = 11 }
            setFont(font)
            borderTop = BorderStyle.THIN
            borderBottom = BorderStyle.THIN
        }

        val amountStyle = workbook.createCellStyle().apply {
            val font = workbook.createFont().apply { fontHeightInPoints = 11 }
            setFont(font)
            borderTop = BorderStyle.THIN
            borderBottom = BorderStyle.THIN
            alignment = HorizontalAlignment.RIGHT
        }

        var rowNum = 0
        val titleRow = sheet.createRow(rowNum++)
        titleRow.createCell(0).apply {
            setCellValue("Aditya Enterprises - Profit & Loss ($period)")
            cellStyle = headerStyle
        }
        sheet.addMergedRegion(org.apache.poi.ss.util.CellRangeAddress(rowNum - 1, rowNum - 1, 0, 2))

        rowNum++
        sheet.createRow(rowNum++).createCell(0).setCellValue("INCOME")
        rowNum = writeBalanceSheetRow(sheet, rowNum, "Total Revenue", data.totalRevenue, normalStyle, amountStyle)

        rowNum += 2
        sheet.createRow(rowNum++).createCell(0).setCellValue("EXPENSES")
        rowNum = writeBalanceSheetRow(sheet, rowNum, "Total Expenses", data.totalExpenses, normalStyle, amountStyle)

        rowNum += 2
        sheet.createRow(rowNum++).createCell(0).setCellValue("SUMMARY")
        rowNum = writeBalanceSheetRow(sheet, rowNum, "Gross Profit", data.grossProfit, normalStyle, amountStyle)
        rowNum = writeBalanceSheetRow(sheet, rowNum, "Net Profit", data.netProfit, boldStyle, amountStyle)

        sheet.setColumnWidth(0, 6000)
        sheet.setColumnWidth(1, 3000)
        sheet.setColumnWidth(2, 3000)

        return saveWorkbook(workbook, "Profit_Loss_${period.replace(" ", "_")}.xlsx")
    }

    fun exportGstReportExcel(data: GstReportData, period: String): File {
        val workbook = XSSFWorkbook()
        val sheet = workbook.createSheet("GST Report")

        val headerStyle = workbook.createCellStyle().apply {
            alignment = HorizontalAlignment.CENTER
            fillForegroundColor = IndexedColors.DARK_BLUE.index
            fillPattern = FillPatternType.SOLID_FOREGROUND
            val font = workbook.createFont().apply {
                bold = true
                color = IndexedColors.WHITE.index
                fontHeightInPoints = 14
            }
            setFont(font)
        }

        val boldStyle = workbook.createCellStyle().apply {
            val font = workbook.createFont().apply { bold = true; fontHeightInPoints = 12 }
            setFont(font)
            borderTop = BorderStyle.THIN
            borderBottom = BorderStyle.THIN
        }

        val normalStyle = workbook.createCellStyle().apply {
            val font = workbook.createFont().apply { fontHeightInPoints = 11 }
            setFont(font)
            borderTop = BorderStyle.THIN
            borderBottom = BorderStyle.THIN
        }

        val amountStyle = workbook.createCellStyle().apply {
            val font = workbook.createFont().apply { fontHeightInPoints = 11 }
            setFont(font)
            borderTop = BorderStyle.THIN
            borderBottom = BorderStyle.THIN
            alignment = HorizontalAlignment.RIGHT
        }

        var rowNum = 0
        val titleRow = sheet.createRow(rowNum++)
        titleRow.createCell(0).apply {
            setCellValue("Aditya Enterprises - GST Report ($period)")
            cellStyle = headerStyle
        }
        sheet.addMergedRegion(org.apache.poi.ss.util.CellRangeAddress(rowNum - 1, rowNum - 1, 0, 2))

        rowNum++
        rowNum = writeBalanceSheetRow(sheet, rowNum, "Taxable Value", data.taxableValue, normalStyle, amountStyle)
        rowNum = writeBalanceSheetRow(sheet, rowNum, "CGST", data.cgst, normalStyle, amountStyle)
        rowNum = writeBalanceSheetRow(sheet, rowNum, "SGST", data.sgst, normalStyle, amountStyle)
        rowNum = writeBalanceSheetRow(sheet, rowNum, "IGST", data.igst, normalStyle, amountStyle)
        rowNum++
        rowNum = writeBalanceSheetRow(sheet, rowNum, "Total Tax Liability", data.totalTax, boldStyle, amountStyle)

        sheet.setColumnWidth(0, 6000)
        sheet.setColumnWidth(1, 3000)
        sheet.setColumnWidth(2, 3000)

        return saveWorkbook(workbook, "GST_Report_${period.replace(" ", "_")}.xlsx")
    }

    private fun createReportPdf(prefix: String, period: String, data: ReportData, title: String): File {
        val document = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, 1).create()
        val page = document.startPage(pageInfo)
        val canvas = page.canvas

        drawHeader(canvas, title, period)

        var y = 160f

        data.summary.forEach { (key, value) ->
            y = drawBalanceRow(canvas, key, value.toDoubleOrNull() ?: 0.0, y)
        }

        y += 20f

        if (data.headers.isNotEmpty()) {
            y = drawTableHeader(canvas, data.headers, y)
            for (row in data.rows) {
                y = drawTableRow(canvas, row, y)
                if (y > PAGE_HEIGHT - MARGIN) break
            }
        }

        document.finishPage(page)
        return saveDocument(document, "${prefix}_${period.replace(" ", "_")}.pdf")
    }

    private fun createReportExcel(data: ReportData, period: String, sheetName: String): File {
        val workbook = XSSFWorkbook()
        val sheet = workbook.createSheet(sheetName)

        val headerStyle = workbook.createCellStyle().apply {
            alignment = HorizontalAlignment.CENTER
            fillForegroundColor = IndexedColors.DARK_BLUE.index
            fillPattern = FillPatternType.SOLID_FOREGROUND
            val font = workbook.createFont().apply {
                bold = true
                color = IndexedColors.WHITE.index
                fontHeightInPoints = 14
            }
            setFont(font)
        }

        val colHeaderStyle = workbook.createCellStyle().apply {
            fillForegroundColor = IndexedColors.LIGHT_CORNFLOWER_BLUE.index
            fillPattern = FillPatternType.SOLID_FOREGROUND
            val font = workbook.createFont().apply { bold = true; fontHeightInPoints = 11 }
            setFont(font)
            borderTop = BorderStyle.THIN
            borderBottom = BorderStyle.THIN
        }

        val dataStyle = workbook.createCellStyle().apply {
            val font = workbook.createFont().apply { fontHeightInPoints = 10 }
            setFont(font)
            borderTop = BorderStyle.THIN
            borderBottom = BorderStyle.THIN
        }

        var rowNum = 0
        val titleRow = sheet.createRow(rowNum++)
        titleRow.createCell(0).apply {
            setCellValue("Aditya Enterprises - $sheetName ($period)")
            cellStyle = headerStyle
        }
        val colCount = data.headers.size.coerceAtLeast(1)
        sheet.addMergedRegion(org.apache.poi.ss.util.CellRangeAddress(rowNum - 1, rowNum - 1, 0, colCount - 1))

        rowNum++
        if (data.headers.isNotEmpty()) {
            val headerRow = sheet.createRow(rowNum++)
            data.headers.forEachIndexed { index, header ->
                headerRow.createCell(index).apply {
                    setCellValue(header)
                    cellStyle = colHeaderStyle
                }
            }
        }

        for (row in data.rows) {
            val dataRow = sheet.createRow(rowNum++)
            row.forEachIndexed { index, value ->
                dataRow.createCell(index).apply {
                    setCellValue(value)
                    cellStyle = dataStyle
                }
            }
        }

        for (i in 0 until colCount) {
            sheet.setColumnWidth(i, Math.max(4000, data.headers.getOrElse(i) { "" }.length * 300))
        }

        return saveWorkbook(workbook, "${sheetName}_${period.replace(" ", "_")}.xlsx")
    }

    private fun drawHeader(canvas: Canvas, title: String, subtitle: String) {
        val titlePaint = Paint().apply {
            color = android.graphics.Color.parseColor("#1E3A8A")
            textSize = HEADER_SIZE
            isFakeBoldText = true
            textAlign = Paint.Align.CENTER
        }
        val subPaint = Paint().apply {
            color = android.graphics.Color.parseColor("#64748B")
            textSize = SUBHEADER_SIZE
            textAlign = Paint.Align.CENTER
        }
        val datePaint = Paint().apply {
            color = android.graphics.Color.parseColor("#94A3B8")
            textSize = SMALL_SIZE
            textAlign = Paint.Align.RIGHT
        }
        val linePaint = Paint().apply {
            color = android.graphics.Color.parseColor("#1E3A8A")
            strokeWidth = 2f
        }

        val centerX = PAGE_WIDTH / 2f
        canvas.drawText(COMPANY_NAME, centerX, 40f, titlePaint)
        canvas.drawText(COMPANY_TAGLINE, centerX, 70f, subPaint)

        val dateFormat = SimpleDateFormat("dd MMM yyyy HH:mm", Locale.getDefault())
        canvas.drawText(dateFormat.format(Date()), PAGE_WIDTH - MARGIN, 40f, datePaint)

        canvas.drawLine(MARGIN, 85f, PAGE_WIDTH - MARGIN, 85f, linePaint)

        val titlePaint2 = Paint().apply {
            color = android.graphics.Color.parseColor("#1E293B")
            textSize = 22f
            isFakeBoldText = true
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText(title, centerX, 115f, titlePaint2)

        val periodPaint = Paint().apply {
            color = android.graphics.Color.parseColor("#64748B")
            textSize = 14f
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText("Period: $subtitle", centerX, 140f, periodPaint)

        canvas.drawLine(MARGIN, 150f, PAGE_WIDTH - MARGIN, 150f, linePaint)
    }

    private fun drawSectionHeader(canvas: Canvas, text: String, y: Float): Float {
        val paint = Paint().apply {
            color = android.graphics.Color.parseColor("#1E3A8A")
            textSize = SUBHEADER_SIZE
            isFakeBoldText = true
        }
        val linePaint = Paint().apply {
            color = android.graphics.Color.parseColor("#1E3A8A")
            strokeWidth = 1f
        }
        canvas.drawText(text.uppercase(), MARGIN, y, paint)
        canvas.drawLine(MARGIN, y + 5f, MARGIN + 200f, y + 5f, linePaint)
        return y + 30f
    }

    private fun drawBalanceRow(canvas: Canvas, label: String, amount: Double, y: Float, bold: Boolean = false): Float {
        val labelPaint = Paint().apply {
            color = android.graphics.Color.parseColor("#1E293B")
            textSize = if (bold) 13f else BODY_SIZE
            isFakeBoldText = bold
        }
        val amountPaint = Paint().apply {
            color = android.graphics.Color.parseColor("#1E293B")
            textSize = if (bold) 13f else BODY_SIZE
            isFakeBoldText = bold
            textAlign = Paint.Align.RIGHT
        }

        canvas.drawText(label, MARGIN, y, labelPaint)
        canvas.drawText(String.format("\u20B9 %,.2f", amount), PAGE_WIDTH - MARGIN, y, amountPaint)

        if (bold) {
            val linePaint = Paint().apply {
                color = android.graphics.Color.parseColor("#1E293B")
                strokeWidth = 1f
            }
            canvas.drawLine(MARGIN, y + 4f, PAGE_WIDTH - MARGIN, y + 4f, linePaint)
        }

        return y + 24f
    }

    private fun drawTableHeader(canvas: Canvas, headers: List<String>, y: Float): Float {
        val colWidth = (PAGE_WIDTH - 2 * MARGIN) / headers.size
        val paint = Paint().apply {
            color = android.graphics.Color.WHITE
            textSize = BODY_SIZE
            isFakeBoldText = true
            textAlign = Paint.Align.CENTER
        }
        val bgPaint = Paint().apply {
            color = android.graphics.Color.parseColor("#1E3A8A")
        }

        canvas.drawRect(MARGIN, y - 18f, PAGE_WIDTH - MARGIN, y + 4f, bgPaint)

        headers.forEachIndexed { index, header ->
            canvas.drawText(header, MARGIN + colWidth * index + colWidth / 2f, y, paint)
        }

        return y + 24f
    }

    private fun drawTableRow(canvas: Canvas, row: List<String>, y: Float): Float {
        if (row.isEmpty()) return y

        val colWidth = (PAGE_WIDTH - 2 * MARGIN) / row.size
        val paint = Paint().apply {
            color = android.graphics.Color.parseColor("#1E293B")
            textSize = SMALL_SIZE
            textAlign = Paint.Align.CENTER
        }
        val linePaint = Paint().apply {
            color = android.graphics.Color.parseColor("#E2E8F0")
            strokeWidth = 0.5f
        }

        row.forEachIndexed { index, value ->
            canvas.drawText(value, MARGIN + colWidth * index + colWidth / 2f, y, paint)
        }
        canvas.drawLine(MARGIN, y + 4f, PAGE_WIDTH - MARGIN, y + 4f, linePaint)

        return y + 20f
    }

    private fun writeBalanceSheetRow(
        sheet: org.apache.poi.ss.usermodel.Sheet,
        rowNum: Int,
        label: String,
        amount: Double,
        labelStyle: CellStyle,
        amountStyle: CellStyle
    ): Int {
        val row = sheet.createRow(rowNum)
        row.createCell(0).apply {
            setCellValue(label)
            cellStyle = labelStyle
        }
        row.createCell(1).apply {
            setCellValue(amount)
            cellStyle = amountStyle
        }
        return rowNum + 1
    }

    private fun saveDocument(document: PdfDocument, fileName: String): File {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val contentValues = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val uri = context.contentResolver.insert(
                    MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues
                )
                uri?.let {
                    context.contentResolver.openOutputStream(it)?.use { outputStream ->
                        document.writeTo(outputStream)
                    }
                }
            }

            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!downloadsDir.exists()) downloadsDir.mkdirs()
            val file = File(downloadsDir, fileName)
            FileOutputStream(file).use { outputStream ->
                document.writeTo(outputStream)
            }
            document.close()
            return file
        } catch (e: Exception) {
            document.close()
            val fallbackDir = File(context.cacheDir, "exports")
            if (!fallbackDir.exists()) fallbackDir.mkdirs()
            val file = File(fallbackDir, fileName)
            FileOutputStream(file).use { outputStream ->
                document.writeTo(outputStream)
            }
            return file
        }
    }

    private fun saveWorkbook(workbook: XSSFWorkbook, fileName: String): File {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val contentValues = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val uri = context.contentResolver.insert(
                    MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues
                )
                uri?.let {
                    context.contentResolver.openOutputStream(it)?.use { outputStream ->
                        workbook.write(outputStream)
                    }
                }
            }

            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!downloadsDir.exists()) downloadsDir.mkdirs()
            val file = File(downloadsDir, fileName)
            FileOutputStream(file).use { outputStream ->
                workbook.write(outputStream)
            }
            workbook.close()
            return file
        } catch (e: Exception) {
            workbook.close()
            val fallbackDir = File(context.cacheDir, "exports")
            if (!fallbackDir.exists()) fallbackDir.mkdirs()
            val file = File(fallbackDir, fileName)
            FileOutputStream(file).use { outputStream ->
                workbook.write(outputStream)
            }
            return file
        }
    }
}
