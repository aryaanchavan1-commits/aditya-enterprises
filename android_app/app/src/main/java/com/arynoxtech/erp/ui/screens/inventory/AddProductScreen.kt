package com.arynoxtech.erp.ui.screens.inventory

import android.app.DatePickerDialog
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MenuAnchorType
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddProductScreen(
    productId: String? = null,
    onNavigateBack: () -> Unit = {},
    onSaveSuccess: () -> Unit = {},
    viewModel: ProductViewModel = hiltViewModel()
) {
    val formState by viewModel.formState.collectAsStateWithLifecycle()
    val metaState by viewModel.metaState.collectAsStateWithLifecycle()
    val scrollState = rememberScrollState()

    LaunchedEffect(productId) {
        if (productId != null) {
            viewModel.loadProduct(productId)
        }
    }

    LaunchedEffect(formState.success) {
        if (formState.success) {
            onSaveSuccess()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (productId != null) "Edit Product" else "Add Product",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { padding ->
        if (formState.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(scrollState)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                formState.error?.let { error ->
                    ElevatedCard(
                        colors = CardDefaults.elevatedCardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Warning,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onErrorContainer
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = error,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }

                BasicInfoSection(
                    formState = formState,
                    categories = metaState.categories,
                    brands = metaState.brands,
                    onFieldChange = { field, value -> viewModel.updateField(field, value) },
                    onGenerateSku = { viewModel.generateSku() },
                    onAddCategory = { name -> viewModel.addCategory(name) },
                    onAddBrand = { name -> viewModel.addBrand(name) }
                )

                PricingSection(
                    formState = formState,
                    onFieldChange = { field, value -> viewModel.updateField(field, value) }
                )

                StockSection(
                    formState = formState,
                    onFieldChange = { field, value -> viewModel.updateField(field, value) }
                )

                BarcodeSection(
                    barcode = formState.barcode,
                    onBarcodeChange = { viewModel.updateField("barcode", it) },
                    onGenerateBarcode = { viewModel.generateBarcode() }
                )

                WarrantySection(
                    hasWarranty = formState.hasWarranty,
                    warrantyPeriod = formState.warrantyPeriod,
                    warrantyStartDate = formState.warrantyStartDate,
                    warrantyEndDate = formState.warrantyEndDate,
                    onToggleWarranty = { viewModel.updateField("hasWarranty", it) },
                    onWarrantyPeriodChange = { viewModel.updateField("warrantyPeriod", it) },
                    onWarrantyStartDateChange = { viewModel.updateField("warrantyStartDate", it) }
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onNavigateBack,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Cancel")
                    }
                    Button(
                        onClick = { viewModel.saveProduct(onSuccess = onSaveSuccess) },
                        modifier = Modifier.weight(1f),
                        enabled = !formState.isSaving,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        if (formState.isSaving) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(Icons.Default.Check, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Save Product")
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun BasicInfoSection(
    formState: ProductFormState,
    categories: List<String>,
    brands: List<String>,
    onFieldChange: (String, Any) -> Unit,
    onGenerateSku: () -> Unit,
    onAddCategory: (String) -> Unit,
    onAddBrand: (String) -> Unit
) {
    var showAddCategory by remember { mutableStateOf(false) }
    var showAddBrand by remember { mutableStateOf(false) }
    var newCategoryName by remember { mutableStateOf("") }
    var newBrandName by remember { mutableStateOf("") }

    SectionCard(title = "Basic Information", icon = Icons.Default.Description) {
        FormField(
            label = "Product Name *",
            value = formState.name,
            onValueChange = { onFieldChange("name", it) },
            required = true
        )

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = formState.sku,
                onValueChange = { onFieldChange("sku", it) },
                label = { Text("SKU") },
                modifier = Modifier.weight(1f),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = defaultFieldColors()
            )
            OutlinedButton(
                onClick = onGenerateSku,
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
            ) {
                Text("Generate", style = MaterialTheme.typography.labelSmall)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            DropdownField(
                label = "Category",
                value = formState.category,
                options = categories,
                placeholder = "Select category",
                onOptionSelected = { onFieldChange("category", it) },
                modifier = Modifier.weight(1f)
            )
            IconButton(
                onClick = { showAddCategory = true; newCategoryName = "" },
                modifier = Modifier.size(40.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Category", tint = MaterialTheme.colorScheme.primary)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            DropdownField(
                label = "Brand",
                value = formState.brand,
                options = brands,
                placeholder = "Select brand",
                onOptionSelected = { onFieldChange("brand", it) },
                modifier = Modifier.weight(1f)
            )
            IconButton(
                onClick = { showAddBrand = true; newBrandName = "" },
                modifier = Modifier.size(40.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Brand", tint = MaterialTheme.colorScheme.primary)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        DropdownField(
            label = "Unit",
            value = formState.unit,
            options = listOf("PCS", "KG", "METER", "BOX", "LITER"),
            placeholder = "Select unit",
            onOptionSelected = { onFieldChange("unit", it) }
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = formState.description,
            onValueChange = { onFieldChange("description", it) },
            label = { Text("Description") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
            maxLines = 5,
            shape = RoundedCornerShape(12.dp),
            colors = defaultFieldColors()
        )

        Spacer(modifier = Modifier.height(12.dp))

        FormField(
            label = "HSN Code",
            value = formState.hsnCode,
            onValueChange = { onFieldChange("hsnCode", it) }
        )
    }

    if (showAddCategory) {
        AlertDialog(
            onDismissRequest = { showAddCategory = false },
            title = { Text("Add Category") },
            text = {
                OutlinedTextField(
                    value = newCategoryName,
                    onValueChange = { newCategoryName = it },
                    label = { Text("Category name") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (newCategoryName.isNotBlank()) {
                            onAddCategory(newCategoryName.trim())
                            showAddCategory = false
                        }
                    }
                ) { Text("Add") }
            },
            dismissButton = {
                TextButton(onClick = { showAddCategory = false }) { Text("Cancel") }
            }
        )
    }

    if (showAddBrand) {
        AlertDialog(
            onDismissRequest = { showAddBrand = false },
            title = { Text("Add Brand") },
            text = {
                OutlinedTextField(
                    value = newBrandName,
                    onValueChange = { newBrandName = it },
                    label = { Text("Brand name") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (newBrandName.isNotBlank()) {
                            onAddBrand(newBrandName.trim())
                            showAddBrand = false
                        }
                    }
                ) { Text("Add") }
            },
            dismissButton = {
                TextButton(onClick = { showAddBrand = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun PricingSection(
    formState: ProductFormState,
    onFieldChange: (String, Any) -> Unit
) {
    SectionCard(title = "Pricing & Tax", icon = Icons.Default.Inventory) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FormField(
                label = "Purchase Price (\u20B9)",
                value = formState.purchasePrice,
                onValueChange = { onFieldChange("purchasePrice", it) },
                keyboardType = KeyboardType.Decimal,
                modifier = Modifier.weight(1f)
            )
            FormField(
                label = "Selling Price (\u20B9) *",
                value = formState.sellingPrice,
                onValueChange = { onFieldChange("sellingPrice", it) },
                keyboardType = KeyboardType.Decimal,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FormField(
                label = "MRP (\u20B9)",
                value = formState.mrp,
                onValueChange = { onFieldChange("mrp", it) },
                keyboardType = KeyboardType.Decimal,
                modifier = Modifier.weight(1f)
            )
            FormField(
                label = "Discount (%)",
                value = formState.discount,
                onValueChange = { onFieldChange("discount", it) },
                keyboardType = KeyboardType.Decimal,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        DropdownField(
            label = "GST Rate (%)",
            value = "%.0f".format(formState.gstRate).let { "$it%" },
            options = listOf("0%", "5%", "12%", "18%", "28%"),
            placeholder = "Select GST",
            onOptionSelected = {
                val rate = it.replace("%", "").toDoubleOrNull() ?: 0.0
                onFieldChange("gstRate", rate)
            }
        )
    }
}

@Composable
private fun StockSection(
    formState: ProductFormState,
    onFieldChange: (String, Any) -> Unit
) {
    SectionCard(title = "Stock Details", icon = Icons.Default.Inventory) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FormField(
                label = "Opening Stock",
                value = formState.openingStock,
                onValueChange = { onFieldChange("openingStock", it) },
                keyboardType = KeyboardType.Number,
                modifier = Modifier.weight(1f)
            )
            FormField(
                label = "Current Stock",
                value = formState.currentStock,
                onValueChange = { onFieldChange("currentStock", it) },
                keyboardType = KeyboardType.Number,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FormField(
                label = "Min Stock Level",
                value = formState.minimumStock,
                onValueChange = { onFieldChange("minimumStock", it) },
                keyboardType = KeyboardType.Number,
                modifier = Modifier.weight(1f)
            )
            FormField(
                label = "Max Stock Level",
                value = formState.maximumStock,
                onValueChange = { onFieldChange("maximumStock", it) },
                keyboardType = KeyboardType.Number,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        FormField(
            label = "Warehouse",
            value = formState.warehouse,
            onValueChange = { onFieldChange("warehouse", it) }
        )

        Spacer(modifier = Modifier.height(12.dp))

        FormField(
            label = "Supplier",
            value = formState.supplier,
            onValueChange = { onFieldChange("supplier", it) }
        )

        Spacer(modifier = Modifier.height(12.dp))

        FormField(
            label = "Location / Shelf",
            value = formState.location,
            onValueChange = { onFieldChange("location", it) }
        )
    }
}

@Composable
private fun BarcodeSection(
    barcode: String,
    onBarcodeChange: (String) -> Unit,
    onGenerateBarcode: () -> Unit
) {
    SectionCard(title = "Barcode", icon = Icons.Default.QrCode) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = barcode,
                onValueChange = onBarcodeChange,
                label = { Text("Barcode") },
                modifier = Modifier.weight(1f),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = defaultFieldColors(),
                trailingIcon = {
                    if (barcode.isNotBlank()) {
                        IconButton(onClick = { onBarcodeChange("") }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear")
                        }
                    }
                }
            )
            IconButton(
                onClick = onGenerateBarcode,
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer)
            ) {
                Icon(
                    Icons.Default.QrCodeScanner,
                    contentDescription = "Generate Barcode",
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun WarrantySection(
    hasWarranty: Boolean,
    warrantyPeriod: String,
    warrantyStartDate: Long?,
    warrantyEndDate: Long?,
    onToggleWarranty: (Boolean) -> Unit,
    onWarrantyPeriodChange: (String) -> Unit,
    onWarrantyStartDateChange: (Long) -> Unit
) {
    SectionCard(title = "Warranty", icon = Icons.Default.Description) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Has Warranty?",
                style = MaterialTheme.typography.bodyLarge
            )
            Switch(
                checked = hasWarranty,
                onCheckedChange = onToggleWarranty
            )
        }

        if (hasWarranty) {
            Spacer(modifier = Modifier.height(12.dp))

            DropdownField(
                label = "Warranty Period",
                value = warrantyPeriod,
                options = listOf("6 Months", "1 Year", "2 Years", "3 Years", "5 Years", "Lifetime"),
                placeholder = "Select period",
                onOptionSelected = onWarrantyPeriodChange
            )

            Spacer(modifier = Modifier.height(12.dp))

            DateField(
                label = "Warranty Start Date",
                date = warrantyStartDate,
                onDateSelected = onWarrantyStartDateChange
            )

            if (warrantyEndDate != null) {
                Spacer(modifier = Modifier.height(8.dp))
                val dateFormat = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
                Text(
                    text = "Warranty End: ${dateFormat.format(Date(warrantyEndDate))}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun FormField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    keyboardType: KeyboardType = KeyboardType.Text,
    required: Boolean = false,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = {
            Text(
                if (required) "$label *" else label
            )
        },
        modifier = modifier.fillMaxWidth(),
        singleLine = keyboardType != KeyboardType.Text || label.contains("Description"),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(12.dp),
        colors = defaultFieldColors()
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownField(
    label: String,
    value: String,
    options: List<String>,
    placeholder: String,
    onOptionSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = value.ifBlank { "" },
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            placeholder = { Text(placeholder) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor(MenuAnchorType.PrimaryNotEditable, enabled = true)
                .fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = defaultFieldColors()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onOptionSelected(option)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun DateField(
    label: String,
    date: Long?,
    onDateSelected: (Long) -> Unit
) {
    val context = LocalContext.current
    val calendar = remember { Calendar.getInstance() }
    val dateFormat = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())

    OutlinedTextField(
        value = if (date != null) dateFormat.format(Date(date)) else "",
        onValueChange = {},
        readOnly = true,
        label = { Text(label) },
        trailingIcon = {
            IconButton(onClick = {
                DatePickerDialog(
                    context,
                    { _, year, month, dayOfMonth ->
                        calendar.set(year, month, dayOfMonth)
                        onDateSelected(calendar.timeInMillis)
                    },
                    calendar.get(Calendar.YEAR),
                    calendar.get(Calendar.MONTH),
                    calendar.get(Calendar.DAY_OF_MONTH)
                ).show()
            }) {
                Icon(Icons.Default.CalendarMonth, contentDescription = "Pick date")
            }
        },
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = defaultFieldColors()
    )
}

@Composable
private fun SectionCard(
    title: String,
    icon: ImageVector,
    content: @Composable () -> Unit
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(18.dp)
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            content()
        }
    }
}

@Composable
private fun defaultFieldColors() = OutlinedTextFieldDefaults.colors(
    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
    focusedBorderColor = MaterialTheme.colorScheme.primary,
    unfocusedLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
    focusedLabelColor = MaterialTheme.colorScheme.primary
)
