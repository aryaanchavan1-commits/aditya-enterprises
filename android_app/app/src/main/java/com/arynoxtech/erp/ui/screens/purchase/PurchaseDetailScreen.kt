package com.arynoxtech.erp.ui.screens.purchase

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.arynoxtech.erp.ui.components.AmountText
import com.arynoxtech.erp.ui.components.ConfirmDialog
import com.arynoxtech.erp.ui.components.ErrorView
import com.arynoxtech.erp.ui.components.LoadingIndicator
import com.arynoxtech.erp.ui.components.StatusBadge
import com.arynoxtech.erp.ui.navigation.NavRoutes
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PurchaseDetailScreen(
    navController: NavController,
    purchaseId: String,
    viewModel: PurchaseViewModel = hiltViewModel()
) {
    val detailState by viewModel.detailState.collectAsState()
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault()) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showStatusDialog by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(purchaseId) {
        viewModel.loadPurchase(purchaseId)
    }

    LaunchedEffect(detailState.supplierName) {
        if (detailState.supplierName.isNotBlank()) {
            viewModel.loadDetailSupplierInfo()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Purchase Detail") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = {
                        viewModel.loadForEdit(purchaseId)
                        navController.navigate(NavRoutes.PurchaseAdd.createRoute(purchaseId))
                    }) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "Edit"
                        )
                    }
                    IconButton(onClick = { showDeleteDialog = true }) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Delete",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        when {
            detailState.isLoading -> LoadingIndicator(modifier = Modifier.padding(padding))
            detailState.error != null -> ErrorView(
                message = detailState.error!!,
                onRetry = { viewModel.loadPurchase(purchaseId) },
                modifier = Modifier.padding(padding)
            )
            else -> LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    HeaderSection(
                        purchaseNumber = detailState.purchaseNumber,
                        orderDate = detailState.orderDate,
                        status = detailState.status,
                        dateFormat = dateFormat
                    )
                }

                item {
                    SupplierInfoCard(
                        name = detailState.supplierName,
                        phone = detailState.supplierPhone,
                        gst = detailState.supplierGst
                    )
                }

                item {
                    Text(
                        text = "Items",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                item {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("#", style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold, modifier = Modifier.width(24.dp))
                                Text("Product", style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                                Text("Qty", style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold, modifier = Modifier.width(40.dp))
                                Text("Rate", style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold, modifier = Modifier.width(80.dp))
                                Text("Total", style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold, modifier = Modifier.width(80.dp))
                            }
                        }
                    }
                }

                itemsIndexed(detailState.items) { index, item ->
                    ItemRow(index = index + 1, item = item)
                }

                item {
                    SummaryCard(
                        subtotal = detailState.subtotal,
                        totalAmount = detailState.totalAmount
                    )
                }

                if (detailState.notes.isNotBlank()) {
                    item {
                        NotesCard(notes = detailState.notes)
                    }
                }

                item {
                    StatusActionSection(
                        currentStatus = detailState.status,
                        onMarkReceived = { showStatusDialog = "received" },
                        onCancel = { showStatusDialog = "cancelled" }
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                }
            }
        }
    }

    if (showDeleteDialog) {
        ConfirmDialog(
            title = "Delete Purchase Order",
            message = "Are you sure you want to delete this purchase order?",
            confirmText = "Delete",
            onConfirm = {
                viewModel.deletePurchase(purchaseId)
                showDeleteDialog = false
                navController.popBackStack()
            },
            onDismiss = { showDeleteDialog = false }
        )
    }

    showStatusDialog?.let { newStatus ->
        ConfirmDialog(
            title = if (newStatus == "received") "Mark as Received" else "Cancel Purchase Order",
            message = if (newStatus == "received") {
                "Confirm that this purchase order has been fully received?"
            } else {
                "Are you sure you want to cancel this purchase order?"
            },
            confirmText = if (newStatus == "received") "Mark Received" else "Cancel Order",
            onConfirm = {
                viewModel.updateStatus(purchaseId, newStatus)
                showStatusDialog = null
            },
            onDismiss = { showStatusDialog = null }
        )
    }
}

@Composable
private fun HeaderSection(
    purchaseNumber: String,
    orderDate: Long,
    status: String,
    dateFormat: SimpleDateFormat
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = purchaseNumber,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                StatusBadge(status = status)
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = dateFormat.format(Date(orderDate)),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
            )
        }
    }
}

@Composable
private fun SupplierInfoCard(
    name: String,
    phone: String,
    gst: String
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Supplier",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = name,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            if (phone.isNotBlank()) {
                Text(
                    text = "Phone: $phone",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (gst.isNotBlank()) {
                Text(
                    text = "GSTIN: $gst",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun ItemRow(index: Int, item: PurchaseDetailItem) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "$index",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.width(24.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = item.productName,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = "%.0f".format(item.quantity),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.width(40.dp)
            )
            AmountText(
                amount = item.unitPrice,
                modifier = Modifier.width(80.dp)
            )
            AmountText(
                amount = item.totalAmount,
                modifier = Modifier.width(80.dp)
            )
        }
    }
}

@Composable
private fun SummaryCard(
    subtotal: Double,
    totalAmount: Double
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Summary",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(8.dp))
            SummaryLine("Subtotal", subtotal)
            SummaryLine("Round Off", totalAmount - subtotal)
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            SummaryLine("Grand Total", totalAmount, isTotal = true)
        }
    }
}

@Composable
private fun SummaryLine(
    label: String,
    amount: Double,
    isTotal: Boolean = false
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = if (isTotal) MaterialTheme.typography.titleMedium
            else MaterialTheme.typography.bodyMedium,
            fontWeight = if (isTotal) FontWeight.Bold else FontWeight.Normal
        )
        Text(
            text = "\u20B9 ${String.format("%,.2f", amount)}",
            style = if (isTotal) MaterialTheme.typography.titleMedium
            else MaterialTheme.typography.bodyMedium,
            fontWeight = if (isTotal) FontWeight.Bold else FontWeight.Normal,
            color = if (isTotal) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun NotesCard(notes: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Notes",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = notes,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
private fun StatusActionSection(
    currentStatus: String,
    onMarkReceived: () -> Unit,
    onCancel: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "Status Management",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (currentStatus != "received" && currentStatus != "cancelled") {
                Button(
                    onClick = onMarkReceived,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    )
                ) {
                    Text("Mark as Received")
                }
            }
            if (currentStatus != "cancelled" && currentStatus != "received") {
                OutlinedButton(
                    onClick = onCancel,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Cancel Order")
                }
            }
        }
    }
}
