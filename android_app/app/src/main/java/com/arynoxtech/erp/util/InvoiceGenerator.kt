package com.arynoxtech.erp.util

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import com.arynoxtech.erp.domain.model.Sale
import com.arynoxtech.erp.domain.model.SaleItem
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class InvoiceGenerator(private val context: Context) {

    private val pageWidth = 595
    private val pageHeight = 842
    private val margin = 40f
    private val contentWidth = pageWidth - 2 * margin

    fun generateInvoicePdf(sale: Sale, items: List<SaleItem>): File {
        val document = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, 1).create()
        val page = document.startPage(pageInfo)
        val canvas = page.canvas

        drawInvoice(canvas, sale, items)

        document.finishPage(page)

        val dir = File(context.cacheDir, "invoices")
        dir.mkdirs()
        val file = File(dir, "Invoice_${sale.invoiceNumber}.pdf")
        FileOutputStream(file).use { out ->
            document.writeTo(out)
        }
        document.close()

        return file
    }

    fun generateInvoiceBytes(sale: Sale, items: List<SaleItem>): ByteArray {
        val document = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, 1).create()
        val page = document.startPage(pageInfo)
        val canvas = page.canvas

        drawInvoice(canvas, sale, items)

        document.finishPage(page)

        val outputStream = java.io.ByteArrayOutputStream()
        document.writeTo(outputStream)
        document.close()

        return outputStream.toByteArray()
    }

    fun printInvoice(sale: Sale, items: List<SaleItem>) {
        val file = generateInvoicePdf(sale, items)
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    fun shareInvoice(sale: Sale, items: List<SaleItem>) {
        val file = generateInvoicePdf(sale, items)
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "Invoice ${sale.invoiceNumber}")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(Intent.createChooser(intent, "Share Invoice"))
    }

    fun downloadInvoice(sale: Sale, items: List<SaleItem>) {
        val file = generateInvoicePdf(sale, items)
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        @Suppress("DEPRECATION")
        context.sendBroadcast(
            Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE).apply {
                data = Uri.fromFile(file)
            }
        )
    }

    private fun drawInvoice(canvas: Canvas, sale: Sale, items: List<SaleItem>) {
        var y = margin

        val titlePaint = Paint().apply {
            color = Color.parseColor("#1E3A8A")
            textSize = 28f
            typeface = Typeface.DEFAULT_BOLD
            textAlign = Paint.Align.CENTER
        }

        val subTitlePaint = Paint().apply {
            color = Color.DKGRAY
            textSize = 12f
            textAlign = Paint.Align.CENTER
        }

        val headerPaint = Paint().apply {
            color = Color.BLACK
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
        }

        val bodyPaint = Paint().apply {
            color = Color.BLACK
            textSize = 11f
        }

        val bodyBoldPaint = Paint().apply {
            color = Color.BLACK
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
        }

        val smallPaint = Paint().apply {
            color = Color.DKGRAY
            textSize = 10f
        }

        val rightAlignPaint = Paint().apply {
            color = Color.BLACK
            textSize = 11f
            textAlign = Paint.Align.RIGHT
        }

        val rightBoldPaint = Paint().apply {
            color = Color.BLACK
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            textAlign = Paint.Align.RIGHT
        }

        val linePaint = Paint().apply {
            color = Color.LTGRAY
            strokeWidth = 1f
        }

        // Company Header
        canvas.drawText("Aditya Enterprises", pageWidth / 2f, y, titlePaint)
        y += 22f
        canvas.drawText("Your Business Tagline Here", pageWidth / 2f, y, subTitlePaint)
        y += 16f
        canvas.drawText("Phone: +91-9876543210 | Email: info@adityaenterprises.com", pageWidth / 2f, y, subTitlePaint)
        y += 14f
        canvas.drawText("GSTIN: 27AABCU9603R1ZR", pageWidth / 2f, y, subTitlePaint)
        y += 10f

        // Horizontal line
        canvas.drawLine(margin, y, pageWidth - margin, y, linePaint)
        y += 10f

        // Invoice Title
        titlePaint.textSize = 20f
        canvas.drawText("TAX INVOICE", pageWidth / 2f, y + 10f, titlePaint)
        y += 30f

        canvas.drawLine(margin, y, pageWidth - margin, y, linePaint)
        y += 10f

        // Invoice Details
        val dateFormat = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
        drawTextPair(canvas, "Invoice No:", sale.invoiceNumber, margin, y, headerPaint, bodyPaint)
        y += 16f
        drawTextPair(canvas, "Date:", dateFormat.format(Date(sale.saleDate)), margin, y, headerPaint, bodyPaint)
        y += 16f
        drawTextPair(canvas, "Status:", sale.status.replaceFirstChar { it.uppercase() }, margin, y, headerPaint, bodyPaint)
        y += 10f

        canvas.drawLine(margin, y, pageWidth - margin, y, linePaint)
        y += 10f

        // Customer Section
        canvas.drawText("Bill To:", margin, y, headerPaint)
        y += 16f
        canvas.drawText(sale.customerName.ifEmpty { "Walk-in Customer" }, margin, y, bodyPaint)
        y += 14f
        if (sale.customerPhone.isNotBlank()) {
            canvas.drawText("Phone: ${sale.customerPhone}", margin, y, smallPaint)
            y += 12f
        }
        if (sale.customerGstin.isNotBlank()) {
            canvas.drawText("GSTIN: ${sale.customerGstin}", margin, y, smallPaint)
            y += 12f
        }
        y += 4f

        canvas.drawLine(margin, y, pageWidth - margin, y, linePaint)
        y += 10f

        // Items Table Header
        val colWidths = floatArrayOf(24f, 140f, 52f, 36f, 52f, 40f, 68f, 68f)
        val headers = listOf("#", "Product", "HSN", "Qty", "Rate", "GST%", "Taxable", "Total")

        canvas.drawRect(margin, y - 4f, pageWidth - margin, y + 16f, Paint().apply {
            color = Color.parseColor("#F1F5F9")
            style = Paint.Style.FILL
        })

        var xPos = margin
        headers.forEachIndexed { i, header ->
            val paint = if (i == 0) headerPaint else smallPaint.apply { typeface = Typeface.DEFAULT_BOLD }
            canvas.drawText(header, xPos, y + 10f, paint)
            xPos += colWidths[i]
        }
        y += 20f

        canvas.drawLine(margin, y, pageWidth - margin, y, linePaint)
        y += 4f

        // Items
        items.forEachIndexed { index, item ->
            if (y > pageHeight - 60f) return

            val rowData = listOf(
                "${index + 1}",
                item.productName,
                item.productSku.take(6),
                "${item.quantity.toInt()}",
                String.format("%.0f", item.unitPrice),
                String.format("%.0f", item.gstRate),
                String.format("%.2f", item.taxableAmount),
                String.format("%.2f", item.totalAmount)
            )

            xPos = margin
            rowData.forEachIndexed { i, data ->
                val paint = if (i == rowData.size - 1) bodyBoldPaint else bodyPaint
                canvas.drawText(data, xPos, y + 10f, paint)
                xPos += colWidths[i]
            }

            y += 18f
            canvas.drawLine(margin, y, pageWidth - margin, y, Paint().apply {
                color = Color.parseColor("#E2E8F0")
                strokeWidth = 0.5f
            })
            y += 2f
        }

        y += 8f

        // Summary Section (right-aligned)
        val summaryX = pageWidth - margin
        val summaryItems = mutableListOf<Pair<String, Double>>()
        summaryItems.add("Subtotal" to sale.subtotal)
        if (sale.discountAmount > 0) summaryItems.add("Discount" to -sale.discountAmount)
        if (sale.cgstTotal > 0) summaryItems.add("CGST (9%)" to sale.cgstTotal)
        if (sale.sgstTotal > 0) summaryItems.add("SGST (9%)" to sale.sgstTotal)
        if (sale.igstTotal > 0) summaryItems.add("IGST" to sale.igstTotal)
        if (sale.roundOff != 0.0) summaryItems.add("Round Off" to sale.roundOff)

        summaryItems.forEach { (label, amount) ->
            canvas.drawText(label, summaryX, y, rightAlignPaint)
            canvas.drawText(String.format("Rs. %,.2f", amount), summaryX, y, rightAlignPaint)
            y += 16f
        }

        canvas.drawLine(summaryX - 160f, y, summaryX, y, linePaint)
        y += 6f

        // Grand Total
        val grandPaint = Paint().apply {
            color = Color.BLACK
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
            textAlign = Paint.Align.RIGHT
        }
        canvas.drawText("Grand Total", summaryX, y, grandPaint)
        canvas.drawText(
            String.format("Rs. %,.2f", sale.totalAmount),
            summaryX,
            y,
            grandPaint
        )
        y += 20f

        // Amount in Words
        canvas.drawText("Amount in Words:", margin, y, headerPaint)
        y += 14f
        canvas.drawText(NumberToWords.convert(sale.totalAmount), margin, y, bodyPaint)
        y += 20f

        // Payment Info
        canvas.drawLine(margin, y, pageWidth - margin, y, linePaint)
        y += 10f
        canvas.drawText("Payment Status: ${sale.paymentStatus.replaceFirstChar { it.uppercase() }}", margin, y, bodyBoldPaint)
        canvas.drawText("Payment Mode: ${sale.paymentMethod.replaceFirstChar { it.uppercase() }}", margin, y + 14f, bodyPaint)
        y += 30f

        // Terms
        canvas.drawLine(margin, y, pageWidth - margin, y, linePaint)
        y += 10f
        canvas.drawText("Terms & Conditions", margin, y, headerPaint)
        y += 14f
        canvas.drawText("1. Goods once sold will not be taken back.", margin, y, smallPaint)
        y += 12f
        canvas.drawText("2. All disputes subject to local jurisdiction.", margin, y, smallPaint)
        y += 24f

        // Signatures
        canvas.drawText("Customer Signature", margin, y + 30f, smallPaint)
        canvas.drawLine(margin, y + 24f, margin + 140f, y + 24f, linePaint)

        canvas.drawText("Authorized Signature", pageWidth - margin - 140f, y + 30f, smallPaint.apply {
            textAlign = Paint.Align.RIGHT
        })
        canvas.drawLine(pageWidth - margin - 140f, y + 24f, pageWidth - margin, y + 24f, linePaint)
        y += 40f

        // Footer
        titlePaint.textSize = 14f
        titlePaint.color = Color.parseColor("#1E3A8A")
        canvas.drawText("Thank you for your business!", pageWidth / 2f, y + 10f, titlePaint)
    }

    private fun drawTextPair(
        canvas: Canvas,
        label: String,
        value: String,
        x: Float,
        y: Float,
        labelPaint: Paint,
        valuePaint: Paint
    ) {
        canvas.drawText(label, x, y, labelPaint)
        val labelWidth = labelPaint.measureText(label)
        canvas.drawText(value, x + labelWidth + 20f, y, valuePaint)
    }
}
