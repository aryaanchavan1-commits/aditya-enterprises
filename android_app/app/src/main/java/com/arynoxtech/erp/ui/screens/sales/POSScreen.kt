package com.arynoxtech.erp.ui.screens.sales

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.RemoveShoppingCart
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.arynoxtech.erp.domain.model.Product
import com.arynoxtech.erp.ui.components.AmountText
import com.arynoxtech.erp.ui.components.EmptyView
import com.arynoxtech.erp.ui.theme.stockColor

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun POSScreen(
    onNavigateBack: () -> Unit = {},
    onNavigateToInvoice: (String) -> Unit = {},
    viewModel: POSViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val subtotal by viewModel.subtotal.collectAsStateWithLifecycle()
    val gstTotal by viewModel.gstTotal.collectAsStateWithLifecycle()
    val grandTotal by viewModel.grandTotal.collectAsStateWithLifecycle()
    var showCustomerSheet by remember { mutableStateOf(false) }
    var showCheckoutSheet by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Point of Sale", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showCustomerSheet = true }) {
                        Icon(Icons.Default.ShoppingCart, contentDescription = "Cart")
                    }
                    if (uiState.cart.isNotEmpty()) {
                        Box(
                            modifier = Modifier
                                .padding(end = 8.dp, top = 8.dp)
                                .size(20.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primary),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "${uiState.cart.size}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimary,
                                fontSize = 10.sp
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        androidx.compose.foundation.layout.BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            val isTablet = maxWidth > 840.dp

            if (isTablet) {
                Row(
                    modifier = Modifier.fillMaxSize()
                ) {
                    ProductGridSection(
                        products = uiState.products,
                        searchQuery = uiState.searchQuery,
                        onSearchQueryChange = viewModel::searchProducts,
                        onProductClick = viewModel::addToCart,
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                    )

                    CartSection(
                        cart = uiState.cart,
                        subtotal = subtotal,
                        gstTotal = gstTotal,
                        grandTotal = grandTotal,
                        customerName = uiState.customerName,
                        customerPhone = uiState.customerPhone,
                        customerGst = uiState.customerGst,
                        paymentMode = uiState.paymentMode,
                        isProcessing = uiState.isProcessing,
                        onUpdateQuantity = viewModel::updateQuantity,
                        onRemoveFromCart = viewModel::removeFromCart,
                        onSetCustomer = { name, phone, gst ->
                            viewModel.setCustomer(name, phone, gst)
                        },
                        onSetPaymentMode = viewModel::setPaymentMode,
                        onCheckout = {
                            viewModel.checkout { invoiceId ->
                                onNavigateToInvoice(invoiceId)
                            }
                        },
                        onClearCart = viewModel::clearCart,
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                    )
                }
            } else {
                var showCart by remember { mutableStateOf(false) }

                if (showCart) {
                    CartSection(
                        cart = uiState.cart,
                        subtotal = subtotal,
                        gstTotal = gstTotal,
                        grandTotal = grandTotal,
                        customerName = uiState.customerName,
                        customerPhone = uiState.customerPhone,
                        customerGst = uiState.customerGst,
                        paymentMode = uiState.paymentMode,
                        isProcessing = uiState.isProcessing,
                        onUpdateQuantity = viewModel::updateQuantity,
                        onRemoveFromCart = viewModel::removeFromCart,
                        onSetCustomer = { name, phone, gst ->
                            viewModel.setCustomer(name, phone, gst)
                        },
                        onSetPaymentMode = viewModel::setPaymentMode,
                        onCheckout = {
                            viewModel.checkout { invoiceId ->
                                onNavigateToInvoice(invoiceId)
                            }
                        },
                        onClearCart = viewModel::clearCart,
                        onNavigateBack = { showCart = false },
                        showBackButton = true,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    ProductGridSection(
                        products = uiState.products,
                        searchQuery = uiState.searchQuery,
                        onSearchQueryChange = viewModel::searchProducts,
                        onProductClick = viewModel::addToCart,
                        onCartFabClick = { showCart = true },
                        cartItemCount = uiState.cart.size,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        }
    }

    if (showCustomerSheet) {
        ModalBottomSheet(
            onDismissRequest = { showCustomerSheet = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ) {
            CustomerInfoForm(
                customerName = uiState.customerName,
                customerPhone = uiState.customerPhone,
                customerGst = uiState.customerGst,
                onCustomerChanged = viewModel::setCustomer,
                onDismiss = { showCustomerSheet = false }
            )
        }
    }

    uiState.error?.let { errorMsg ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = viewModel::clearError,
            title = { Text("Error") },
            text = { Text(errorMsg) },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = viewModel::clearError) {
                    Text("OK")
                }
            }
        )
    }
}

@Composable
private fun ProductGridSection(
    products: List<Product>,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    onProductClick: (Product) -> Unit,
    modifier: Modifier = Modifier,
    onCartFabClick: (() -> Unit)? = null,
    cartItemCount: Int = 0
) {
    Column(modifier = modifier) {
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchQueryChange,
            placeholder = { Text("Search products...") },
            leadingIcon = {
                Icon(Icons.Default.Search, contentDescription = null)
            },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp)
        )

        if (products.isEmpty()) {
            EmptyView(
                message = "No products found",
                modifier = Modifier.weight(1f)
            )
        } else {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 160.dp),
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(products, key = { it.id }) { product ->
                    ProductGridCard(
                        product = product,
                        onClick = { onProductClick(product) }
                    )
                }
            }
        }

        if (onCartFabClick != null && cartItemCount > 0) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp)
            ) {
                Button(
                    onClick = onCartFabClick,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.ShoppingCart, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("View Cart ($cartItemCount items)")
                }
            }
        }
    }
}

@Composable
private fun ProductGridCard(
    product: Product,
    onClick: () -> Unit
) {
    val stockColor = stockColor(product.currentStock.toInt(), product.minimumStock.toInt())

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(80.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.surfaceContainerHighest),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.ShoppingCart,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(32.dp)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = product.name,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(4.dp))

            AmountText(
                amount = product.sellingPrice,
                modifier = Modifier.padding(0.dp)
            )

            Spacer(modifier = Modifier.height(4.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(stockColor)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "${product.currentStock.toInt()} in stock",
                    style = MaterialTheme.typography.labelSmall,
                    color = stockColor
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CartSection(
    cart: List<POSViewModel.CartItem>,
    subtotal: Double,
    gstTotal: Double,
    grandTotal: Double,
    customerName: String,
    customerPhone: String,
    customerGst: String,
    paymentMode: String,
    isProcessing: Boolean,
    onUpdateQuantity: (String, Int) -> Unit,
    onRemoveFromCart: (String) -> Unit,
    onSetCustomer: (String, String, String) -> Unit,
    onSetPaymentMode: (String) -> Unit,
    onCheckout: () -> Unit,
    onClearCart: () -> Unit,
    modifier: Modifier = Modifier,
    showBackButton: Boolean = false,
    onNavigateBack: (() -> Unit)? = null
) {
    var showCustomerForm by remember { mutableStateOf(false) }
    var editName by remember { mutableStateOf(customerName) }
    var editPhone by remember { mutableStateOf(customerPhone) }
    var editGst by remember { mutableStateOf(customerGst) }

    Column(
        modifier = modifier
            .background(MaterialTheme.colorScheme.surface)
    ) {
        if (showBackButton) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onNavigateBack ?: {}) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                }
                Text(
                    text = "Cart (${cart.size})",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                IconButton(onClick = onClearCart) {
                    Icon(Icons.Default.Delete, contentDescription = "Clear")
                }
            }
        }

        if (cart.isEmpty()) {
            EmptyView(
                message = "Cart is empty. Add products to get started.",
                icon = Icons.Default.RemoveShoppingCart,
                modifier = Modifier.weight(1f)
            )
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                item {
                    FilledTonalButton(
                        onClick = { showCustomerForm = !showCustomerForm },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            if (customerName.isBlank()) "Add Customer Details"
                            else "$customerName ${if (customerPhone.isNotBlank()) "($customerPhone)" else ""}"
                        )
                        Spacer(modifier = Modifier.weight(1f))
                        Icon(
                            if (showCustomerForm) Icons.Default.ExpandLess
                            else Icons.Default.ExpandMore,
                            contentDescription = null
                        )
                    }
                }

                if (showCustomerForm) {
                    item {
                        Column(
                            modifier = Modifier.padding(vertical = 8.dp)
                        ) {
                            OutlinedTextField(
                                value = editName,
                                onValueChange = {
                                    editName = it
                                    onSetCustomer(it, editPhone, editGst)
                                },
                                label = { Text("Customer Name") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(8.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = editPhone,
                                onValueChange = {
                                    editPhone = it
                                    onSetCustomer(editName, it, editGst)
                                },
                                label = { Text("Phone") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(8.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = editGst,
                                onValueChange = {
                                    editGst = it
                                    onSetCustomer(editName, editPhone, it)
                                },
                                label = { Text("GSTIN") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(8.dp)
                            )
                        }
                    }
                }

                items(cart, key = { it.productId }) { item ->
                    CartItemCard(
                        item = item,
                        onQuantityChange = { qty -> onUpdateQuantity(item.productId, qty) },
                        onRemove = { onRemoveFromCart(item.productId) }
                    )
                }
            }
        }

        if (cart.isNotEmpty()) {
            HorizontalDivider()
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp)
            ) {
                CartSummaryRow("Subtotal", subtotal)
                CartSummaryRow("GST Total", gstTotal, color = MaterialTheme.colorScheme.onSurfaceVariant)
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                CartSummaryRow(
                    label = "Grand Total",
                    amount = grandTotal,
                    bold = true,
                    fontSize = 18
                )

                Spacer(modifier = Modifier.height(8.dp))

                PaymentModeSelector(
                    selectedMode = paymentMode,
                    onModeSelected = onSetPaymentMode
                )

                Spacer(modifier = Modifier.height(8.dp))

                Button(
                    onClick = onCheckout,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    enabled = !isProcessing && cart.isNotEmpty(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    if (isProcessing) {
                        CircularProgressIndicator(
                            color = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Icon(Icons.Default.Check, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            "Place Order - ₹ ${String.format("%,.2f", grandTotal)}",
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CartItemCard(
    item: POSViewModel.CartItem,
    onQuantityChange: (Int) -> Unit,
    onRemove: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.productName,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "₹ ${String.format("%,.2f", item.unitPrice)} / unit",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = { onQuantityChange(item.quantity - 1) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Default.Remove,
                        contentDescription = "Decrease",
                        modifier = Modifier.size(18.dp)
                    )
                }

                Text(
                    text = "${item.quantity}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.width(24.dp),
                    textAlign = TextAlign.Center
                )

                IconButton(
                    onClick = { onQuantityChange(item.quantity + 1) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Default.Add,
                        contentDescription = "Increase",
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            Text(
                text = "₹ ${String.format("%,.2f", item.subtotal)}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(end = 4.dp)
            )

            IconButton(
                onClick = onRemove,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Remove",
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
private fun CartSummaryRow(
    label: String,
    amount: Double,
    bold: Boolean = false,
    fontSize: Int = 14,
    color: Color = MaterialTheme.colorScheme.onSurface
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
            color = if (!bold) MaterialTheme.colorScheme.onSurfaceVariant else color
        )
        Text(
            text = "₹ ${String.format("%,.2f", amount)}",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Medium,
            fontSize = fontSize.sp,
            color = color
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PaymentModeSelector(
    selectedMode: String,
    onModeSelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val modes = listOf("Cash", "Credit", "UPI")

    Column {
        Text(
            text = "Payment Mode",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(4.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            modes.forEach { mode ->
                SuggestionChip(
                    onClick = { onModeSelected(mode) },
                    label = { Text(mode) },
                    border = if (mode == selectedMode) null else
                        androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                    colors = androidx.compose.material3.SuggestionChipDefaults.suggestionChipColors(
                        containerColor = if (mode == selectedMode)
                            MaterialTheme.colorScheme.primaryContainer
                        else MaterialTheme.colorScheme.surface
                    )
                )
            }
        }
    }
}

@Composable
private fun CustomerInfoForm(
    customerName: String,
    customerPhone: String,
    customerGst: String,
    onCustomerChanged: (String, String, String) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf(customerName) }
    var phone by remember { mutableStateOf(customerPhone) }
    var gst by remember { mutableStateOf(customerGst) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        Text(
            text = "Customer Details",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Customer Name") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        )
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = phone,
            onValueChange = { phone = it },
            label = { Text("Phone Number") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        )
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = gst,
            onValueChange = { gst = it },
            label = { Text("GSTIN") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        )
        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                onCustomerChanged(name, phone, gst)
                onDismiss()
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text("Save")
        }
    }
}
