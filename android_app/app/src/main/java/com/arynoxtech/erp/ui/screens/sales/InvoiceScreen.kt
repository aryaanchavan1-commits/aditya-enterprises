package com.arynoxtech.erp.ui.screens.sales

import android.content.Context
import android.content.Intent
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.arynoxtech.erp.domain.model.Sale
import com.arynoxtech.erp.domain.model.SaleItem
import com.arynoxtech.erp.ui.components.ErrorView
import com.arynoxtech.erp.ui.components.LoadingIndicator
import com.arynoxtech.erp.util.InvoiceGenerator
import com.arynoxtech.erp.util.NumberToWords
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoiceScreen(
    saleId: String,
    onNavigateBack: () -> Unit = {},
    viewModel: InvoiceViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(saleId) {
        viewModel.loadInvoice(saleId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Invoice", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    val sale = uiState.sale
                    if (sale != null) {
                        IconButton(onClick = {
                            InvoiceGenerator(context).printInvoice(sale, uiState.items)
                        }) {
                            Icon(Icons.Default.Print, contentDescription = "Print")
                        }
                        IconButton(onClick = {
                            InvoiceGenerator(context).shareInvoice(sale, uiState.items)
                        }) {
                            Icon(Icons.Default.Share, contentDescription = "Share")
                        }
                        IconButton(onClick = {
                            InvoiceGenerator(context).downloadInvoice(sale, uiState.items)
                        }) {
                            Icon(Icons.Default.Download, contentDescription = "Download")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        when {
            uiState.isLoading -> {
                LoadingIndicator(modifier = Modifier.padding(padding))
            }
            uiState.error != null -> {
                ErrorView(
                    message = uiState.error ?: "Failed to load invoice",
                    modifier = Modifier.padding(padding)
                )
            }
            uiState.sale != null -> {
                InvoiceTemplate(
                    sale = uiState.sale!!,
                    items = uiState.items,
                    modifier = Modifier
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                )
            }
        }
    }
}

@Composable
private fun InvoiceTemplate(
    sale: Sale,
    items: List<SaleItem>,
    modifier: Modifier = Modifier
) {
    val dateFormat = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
    val timeFormat = SimpleDateFormat("hh:mm a", Locale.getDefault())

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {

        // Header
        CardHeader(sale = sale)

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(16.dp))

        // Invoice Details
        InvoiceDetailRow(label = "Invoice No.", value = sale.invoiceNumber)
        InvoiceDetailRow(label = "Date", value = dateFormat.format(Date(sale.saleDate)))
        InvoiceDetailRow(label = "Time", value = timeFormat.format(Date(sale.saleDate)))
        InvoiceDetailRow(
            label = "Status",
            value = sale.status.replaceFirstChar { it.uppercase() }
        )

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(16.dp))

        // Customer Details
        Text(
            text = "Bill To",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = sale.customerName.ifEmpty { "Walk-in Customer" },
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium
        )
        if (sale.customerPhone.isNotBlank()) {
            Text(
                text = "Phone: ${sale.customerPhone}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        if (sale.customerGstin.isNotBlank()) {
            Text(
                text = "GSTIN: ${sale.customerGstin}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(16.dp))

        // Items Table Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceContainerHighest)
                .padding(horizontal = 8.dp, vertical = 8.dp)
        ) {
            Text("#", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, modifier = Modifier.width(24.dp))
            Text("Product", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Text("HSN", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, modifier = Modifier.width(60.dp))
            Text("Qty", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, modifier = Modifier.width(36.dp), textAlign = TextAlign.End)
            Text("Rate", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, modifier = Modifier.width(64.dp), textAlign = TextAlign.End)
            Text("GST%", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, modifier = Modifier.width(44.dp), textAlign = TextAlign.End)
            Text("Taxable", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, modifier = Modifier.width(72.dp), textAlign = TextAlign.End)
            Text("Total", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, modifier = Modifier.width(72.dp), textAlign = TextAlign.End)
        }

        HorizontalDivider()

        // Items Table Rows
        items.forEachIndexed { index, item ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("${index + 1}", style = MaterialTheme.typography.bodySmall, modifier = Modifier.width(24.dp))
                Text(
                    text = item.productName,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.weight(1f),
                    maxLines = 1
                )
                Text(
                    text = item.productSku.take(6),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.width(60.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "${item.quantity.toInt()}",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.width(36.dp),
                    textAlign = TextAlign.End
                )
                Text(
                    text = String.format("%.0f", item.unitPrice),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.width(64.dp),
                    textAlign = TextAlign.End
                )
                Text(
                    text = String.format("%.0f", item.gstRate),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.width(44.dp),
                    textAlign = TextAlign.End
                )
                Text(
                    text = String.format("%.2f", item.taxableAmount),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.width(72.dp),
                    textAlign = TextAlign.End
                )
                Text(
                    text = String.format("%.2f", item.totalAmount),
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.width(72.dp),
                    textAlign = TextAlign.End
                )
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Summary Section
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 120.dp)
        ) {
            SummaryLine("Subtotal", sale.subtotal)
            if (sale.discountAmount > 0) {
                SummaryLine("Discount", -sale.discountAmount, Color(0xFF16A34A))
            }
            if (sale.cgstTotal > 0) {
                SummaryLine("CGST (9%)", sale.cgstTotal)
            }
            if (sale.sgstTotal > 0) {
                SummaryLine("SGST (9%)", sale.sgstTotal)
            }
            if (sale.igstTotal > 0) {
                SummaryLine("IGST", sale.igstTotal)
            }
            if (sale.roundOff != 0.0) {
                SummaryLine("Round Off", sale.roundOff)
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            SummaryLine(
                label = "Grand Total",
                amount = sale.totalAmount,
                bold = true,
                largeFont = true
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Amount in words
        Text(
            text = "Amount in Words:",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = NumberToWords.convert(sale.totalAmount),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Payment status
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Payment Status:",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = sale.paymentStatus.replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = when (sale.paymentStatus.lowercase()) {
                    "paid" -> Color(0xFF16A34A)
                    "pending" -> Color(0xFFDC2626)
                    "partial" -> Color(0xFFD97706)
                    else -> MaterialTheme.colorScheme.onSurface
                }
            )
        }
        Text(
            text = "Payment Mode: ${sale.paymentMethod.replaceFirstChar { it.uppercase() }}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(16.dp))

        // Footer
        Text(
            text = "Terms & Conditions",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = "1. Goods once sold will not be taken back.\n2. All disputes subject to local jurisdiction.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Spacer(modifier = Modifier.height(32.dp))
                HorizontalDivider(modifier = Modifier.width(160.dp))
                Text(
                    text = "Customer Signature",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Spacer(modifier = Modifier.height(32.dp))
                HorizontalDivider(modifier = Modifier.width(160.dp))
                Text(
                    text = "Authorized Signature",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        Text(
            text = "Thank you for your business!",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun CardHeader(sale: Sale) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .background(
                    MaterialTheme.colorScheme.primary,
                    RoundedCornerShape(12.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "AE",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimary
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Aditya Enterprises",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Your Business Tagline Here",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Phone: +91-9876543210 | Email: info@adityaenterprises.com",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = "GSTIN: 27AABCU9603R1ZR",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun InvoiceDetailRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun SummaryLine(
    label: String,
    amount: Double,
    color: Color = MaterialTheme.colorScheme.onSurface,
    bold: Boolean = false,
    largeFont: Boolean = false
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = if (largeFont) MaterialTheme.typography.bodyLarge else MaterialTheme.typography.bodyMedium,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
            color = if (!bold) MaterialTheme.colorScheme.onSurfaceVariant else color
        )
        Text(
            text = "₹ ${String.format("%,.2f", amount)}",
            style = if (largeFont) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Medium,
            color = color
        )
    }
}
