package com.arynoxtech.erp.ui.screens.purchase

import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.rememberDatePickerState
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.arynoxtech.erp.data.local.SupplierEntity
import com.arynoxtech.erp.ui.components.EmptyView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddPurchaseScreen(
    navController: NavController,
    purchaseId: String? = null,
    viewModel: PurchaseViewModel = hiltViewModel()
) {
    val formState by viewModel.formState.collectAsState()
    val totalAmount by viewModel.totalAmount.collectAsState()
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }
    var showDatePicker by remember { mutableStateOf(false) }
    var showProductSearch by remember { mutableStateOf(false) }

    LaunchedEffect(purchaseId) {
        if (purchaseId != null) {
            viewModel.loadForEdit(purchaseId)
        } else {
            viewModel.resetForm()
        }
        viewModel.loadSuppliers()
    }

    LaunchedEffect(formState.success) {
        if (formState.success) {
            viewModel.clearSuccess()
            navController.popBackStack()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(if (purchaseId != null) "Edit Purchase Order" else "New Purchase Order")
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                SupplierSection(
                    suppliers = formState.suppliers,
                    supplierId = formState.supplierId,
                    supplierName = formState.supplierName,
                    supplierPhone = formState.supplierPhone,
                    supplierGst = formState.supplierGst,
                    onSupplierSelected = viewModel::selectSupplier,
                    onNameChange = { name, phone, gst ->
                        viewModel.updateSupplier(name, phone, gst)
                    }
                )
            }

            item {
                OutlinedButton(
                    onClick = { showDatePicker = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Order Date: ${dateFormat.format(Date(formState.orderDate))}")
                }
            }

            item {
                SectionHeader("Items")
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Move all to inventory", style = MaterialTheme.typography.bodyLarge)
                    Switch(
                        checked = formState.moveToInventory,
                        onCheckedChange = viewModel::setMoveToInventory
                    )
                }
            }

            item {
                Button(
                    onClick = { showProductSearch = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Add Item")
                }
            }

            if (formState.items.isEmpty()) {
                item {
                    EmptyView(
                        message = "No items added\nClick + Add Item to add products",
                        icon = Icons.Default.Add
                    )
                }
            } else {
                items(formState.items, key = { it.id }) { item ->
                    PurchaseFormItemRow(
                        item = item,
                        onQuantityChange = { qty ->
                            viewModel.updateItemQuantity(item.id, qty)
                        },
                        onSellingPriceChange = { price ->
                            viewModel.updateItemSellingPrice(item.id, price)
                        },
                        onMoveToInventoryChange = { move ->
                            viewModel.updateItemMoveToInventory(item.id, move)
                        },
                        onRemove = { viewModel.removeItem(item.id) }
                    )
                }
            }

            item {
                Card(
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
                        SummaryRow("Items Count", "${formState.items.size}")
                        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                        SummaryRow("Subtotal", "\u20B9 ${String.format("%,.2f", totalAmount)}")
                        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                        SummaryRow("Grand Total", "\u20B9 ${String.format("%,.2f", totalAmount)}",
                            isTotal = true)
                    }
                }
            }

            item {
                SectionHeader("Notes")
                OutlinedTextField(
                    value = formState.notes,
                    onValueChange = viewModel::updateNotes,
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    placeholder = { Text("Add notes...") }
                )
            }

            formState.error?.let { error ->
                item {
                    Text(
                        text = error,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = { navController.popBackStack() },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Cancel")
                    }
                    Button(
                        onClick = { viewModel.savePurchase { } },
                        modifier = Modifier.weight(1f),
                        enabled = !formState.isSaving
                    ) {
                        Text(if (formState.isSaving) "Saving..." else "Save Purchase Order")
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }

    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = formState.orderDate
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { viewModel.updateOrderDate(it) }
                    showDatePicker = false
                }) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) {
                    Text("Cancel")
                }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

            if (showProductSearch) {
        ProductSearchDialog(
            viewModel = viewModel,
            onDismiss = { showProductSearch = false },
            onProductSelected = { product ->
                val existing = formState.items.find { it.productId == product.id }
                if (existing == null) {
                    viewModel.addItem(
                        PurchaseFormItem(
                            productId = product.id,
                            productName = product.name,
                            quantity = 1,
                            unitPrice = product.purchasePrice,
                            sellingPrice = product.sellingPrice,
                            moveToInventory = formState.moveToInventory
                        )
                    )
                }
                showProductSearch = false
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SupplierSection(
    suppliers: List<SupplierEntity>,
    supplierId: String?,
    supplierName: String,
    supplierPhone: String,
    supplierGst: String,
    onSupplierSelected: (SupplierEntity) -> Unit,
    onNameChange: (String, String, String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    var useManualEntry by remember { mutableStateOf(supplierId == null) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "Supplier",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )

        if (!useManualEntry && suppliers.isNotEmpty()) {
            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = !expanded }
            ) {
                OutlinedTextField(
                    value = suppliers.find { it.id == supplierId }?.name ?: "",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Select Supplier") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable, enabled = true)
                )
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    suppliers.forEach { supplier ->
                        DropdownMenuItem(
                            text = {
                                Column {
                                    Text(supplier.name, style = MaterialTheme.typography.bodyMedium)
                                    Text(
                                        supplier.phone,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            },
                            onClick = {
                                onSupplierSelected(supplier)
                                expanded = false
                            }
                        )
                    }
                }
            }
            TextButton(onClick = {
                useManualEntry = true
                onNameChange("", "", "")
            }) {
                Text("Or enter manually")
            }
        } else {
            OutlinedTextField(
                value = supplierName,
                onValueChange = { onNameChange(it, supplierPhone, supplierGst) },
                label = { Text("Supplier Name *") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = supplierPhone,
                onValueChange = { onNameChange(supplierName, it, supplierGst) },
                label = { Text("Phone") },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
            )
            OutlinedTextField(
                value = supplierGst,
                onValueChange = { onNameChange(supplierName, supplierPhone, it) },
                label = { Text("GSTIN") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            if (suppliers.isNotEmpty()) {
                TextButton(onClick = {
                    useManualEntry = false
                }) {
                    Text("Select from existing")
                }
            }
        }
    }
}

@Composable
private fun PurchaseFormItemRow(
    item: PurchaseFormItem,
    onQuantityChange: (Int) -> Unit,
    onSellingPriceChange: (Double) -> Unit,
    onMoveToInventoryChange: (Boolean) -> Unit,
    onRemove: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = item.productName,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f)
                )
                Row {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Switch(
                            checked = item.moveToInventory,
                            onCheckedChange = onMoveToInventoryChange,
                            modifier = Modifier.padding(end = 4.dp)
                        )
                        Text("Stock", style = MaterialTheme.typography.labelSmall)
                    }
                    IconButton(onClick = onRemove) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Remove",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = item.quantity.toString(),
                    onValueChange = { onQuantityChange(it.toIntOrNull() ?: 1) },
                    label = { Text("Qty") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.width(70.dp),
                    singleLine = true
                )
                OutlinedTextField(
                    value = String.format("%.2f", item.unitPrice),
                    onValueChange = {},
                    label = { Text("Cost") },
                    readOnly = true,
                    modifier = Modifier.width(90.dp),
                    singleLine = true
                )
                var sellPriceText by remember { mutableStateOf(if (item.sellingPrice > 0) String.format("%.2f", item.sellingPrice) else "") }
                OutlinedTextField(
                    value = sellPriceText,
                    onValueChange = { v ->
                        sellPriceText = v
                        v.toDoubleOrNull()?.let { onSellingPriceChange(it) }
                    },
                    label = { Text("Sell Price") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.width(90.dp),
                    singleLine = true
                )
                Column {
                    Text(
                        text = "Total",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = String.format("\u20B9 %,.0f", item.subtotal),
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

@Composable
private fun SummaryRow(
    label: String,
    value: String,
    isTotal: Boolean = false
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = if (isTotal) MaterialTheme.typography.titleMedium
            else MaterialTheme.typography.bodyMedium,
            fontWeight = if (isTotal) FontWeight.Bold else FontWeight.Normal
        )
        Text(
            text = value,
            style = if (isTotal) MaterialTheme.typography.titleMedium
            else MaterialTheme.typography.bodyMedium,
            fontWeight = if (isTotal) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProductSearchDialog(
    viewModel: PurchaseViewModel,
    onDismiss: () -> Unit,
    onProductSelected: (com.arynoxtech.erp.data.local.ProductEntity) -> Unit
) {
    var query by remember { mutableStateOf("") }
    val products by viewModel.products.collectAsState()

    LaunchedEffect(query) {
        viewModel.searchProducts(query)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Select Product") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text("Search products...") },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = null)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                if (query.isBlank()) {
                    Text(
                        text = "Type to search products",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else if (products.isEmpty()) {
                    Text(
                        text = "No products found",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    products.forEach { product ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onProductSelected(product) }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = product.name,
                                    style = MaterialTheme.typography.bodyLarge,
                                    fontWeight = FontWeight.Medium
                                )
                                Text(
                                    text = "SKU: ${product.sku} | \u20B9 ${String.format("%,.2f", product.purchasePrice)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
