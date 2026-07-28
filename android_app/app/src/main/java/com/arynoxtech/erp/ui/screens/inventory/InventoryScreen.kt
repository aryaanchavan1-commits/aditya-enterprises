@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.arynoxtech.erp.ui.screens.inventory

import androidx.compose.animation.animateColorAsState
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.arynoxtech.erp.data.local.ProductEntity
import com.arynoxtech.erp.ui.components.AmountText
import com.arynoxtech.erp.ui.components.EmptyView
import com.arynoxtech.erp.ui.components.ErrorView
import com.arynoxtech.erp.ui.components.LoadingIndicator
import com.arynoxtech.erp.ui.theme.stockColor
import com.arynoxtech.erp.ui.theme.statusColor

@Composable
fun InventoryScreen(
    onNavigateToAddProduct: () -> Unit = {},
    onNavigateToProductDetail: (String) -> Unit = {},
    onScanBarcode: () -> Unit = {},
    viewModel: InventoryViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var showDeleteDialog by remember { mutableStateOf(false) }
    var productToDelete by remember { mutableStateOf<ProductEntity?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Inventory",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                actions = {
                    IconButton(onClick = onScanBarcode) {
                        Icon(
                            imageVector = Icons.Default.QrCodeScanner,
                            contentDescription = "Scan Barcode"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNavigateToAddProduct,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Add Product",
                    tint = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isLoading,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                state.isLoading && state.products.isEmpty() -> LoadingIndicator()
                state.error != null && state.products.isEmpty() -> ErrorView(
                    message = state.error ?: "Unknown error",
                    onRetry = { viewModel.refresh() }
                )
                else -> InventoryContent(
                    state = state,
                    onSearch = { viewModel.search(it) },
                    onFilterByStock = { viewModel.filterByStock(it) },
                    onFilterByCategory = { viewModel.filterByCategory(it) },
                    onProductClick = onNavigateToProductDetail,
                    onDeleteProduct = { product ->
                        productToDelete = product
                        showDeleteDialog = true
                    },
                    onAddProduct = onNavigateToAddProduct
                )
            }
        }
    }

    if (showDeleteDialog && productToDelete != null) {
        AlertDialog(
            onDismissRequest = {
                showDeleteDialog = false
                productToDelete = null
            },
            title = { Text("Delete Product") },
            text = { Text("Are you sure you want to delete \"${productToDelete?.name}\"? This action cannot be undone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        productToDelete?.let { viewModel.deleteProduct(it.id) }
                        showDeleteDialog = false
                        productToDelete = null
                    }
                ) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    showDeleteDialog = false
                    productToDelete = null
                }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun InventoryContent(
    state: InventoryUiState,
    onSearch: (String) -> Unit,
    onFilterByStock: (StockFilter) -> Unit,
    onFilterByCategory: (String?) -> Unit,
    onProductClick: (String) -> Unit,
    onDeleteProduct: (ProductEntity) -> Unit,
    onAddProduct: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { SearchSection(query = state.searchQuery, onQueryChange = onSearch) }
        item { FilterSection(
            stockFilter = state.stockFilter,
            selectedCategory = state.selectedCategory,
            categories = state.categories,
            onStockFilterChange = onFilterByStock,
            onCategoryChange = onFilterByCategory
        ) }

        if (state.products.isEmpty()) {
            item {
                EmptyView(
                    message = if (state.searchQuery.isNotBlank() || state.selectedCategory != null || state.stockFilter != StockFilter.ALL)
                        "No products match your filters"
                    else "No products yet. Tap + to add your first product."
                )
            }
        } else {
            items(
                items = state.products,
                key = { it.id }
            ) { product ->
                ProductCard(
                    product = product,
                    onClick = { onProductClick(product.id) },
                    onDelete = { onDeleteProduct(product) }
                )
            }
        }

        item { Spacer(modifier = Modifier.height(72.dp)) }
    }
}

@Composable
private fun SearchSection(query: String, onQueryChange: (String) -> Unit) {
    com.arynoxtech.erp.ui.components.SearchBar(
        query = query,
        onQueryChange = onQueryChange,
        placeholder = "Search by name, SKU or barcode...",
        modifier = Modifier.fillMaxWidth()
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FilterSection(
    stockFilter: StockFilter,
    selectedCategory: String?,
    categories: List<String>,
    onStockFilterChange: (StockFilter) -> Unit,
    onCategoryChange: (String?) -> Unit
) {
    var categoryExpanded by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            FilterChip(
                selected = stockFilter == StockFilter.ALL,
                onClick = { onStockFilterChange(StockFilter.ALL) },
                label = { Text("All") }
            )
            FilterChip(
                selected = stockFilter == StockFilter.LOW_STOCK,
                onClick = { onStockFilterChange(StockFilter.LOW_STOCK) },
                label = { Text("Low Stock") }
            )
            FilterChip(
                selected = stockFilter == StockFilter.OUT_OF_STOCK,
                onClick = { onStockFilterChange(StockFilter.OUT_OF_STOCK) },
                label = { Text("Out of Stock") }
            )
        }

        if (categories.isNotEmpty()) {
            ExposedDropdownMenuBox(
                expanded = categoryExpanded,
                onExpandedChange = { categoryExpanded = it }
            ) {
                OutlinedTextField(
                    value = selectedCategory ?: "All Categories",
                    onValueChange = {},
                    readOnly = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                    modifier = Modifier
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable, enabled = true)
                        .fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                        focusedBorderColor = MaterialTheme.colorScheme.primary
                    )
                )
                ExposedDropdownMenu(
                    expanded = categoryExpanded,
                    onDismissRequest = { categoryExpanded = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("All Categories") },
                        onClick = {
                            onCategoryChange(null)
                            categoryExpanded = false
                        }
                    )
                    categories.forEach { category ->
                        DropdownMenuItem(
                            text = { Text(category) },
                            onClick = {
                                onCategoryChange(category)
                                categoryExpanded = false
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProductCard(
    product: ProductEntity,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    val stockLevelColor = stockColor(product.currentStock.toInt(), product.minimumStock.toInt())
    val statusText = when {
        product.currentStock <= 0 -> "Out of Stock"
        product.currentStock <= product.minimumStock -> "Low Stock"
        else -> "In Stock"
    }
    val statusBg = when {
        product.currentStock <= 0 -> Color(0xFFFEE2E2)
        product.currentStock <= product.minimumStock -> Color(0xFFFEF3C7)
        else -> Color(0xFFDCFCE7)
    }
    val statusTextColor = when {
        product.currentStock <= 0 -> Color(0xFFEF4444)
        product.currentStock <= product.minimumStock -> Color(0xFFEAB308)
        else -> Color(0xFF22C55E)
    }

    ElevatedCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.elevatedCardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.surfaceContainerHighest),
                contentAlignment = Alignment.Center
            ) {
                if (product.images.isNotBlank()) {
                    // TODO: AsyncImage(imageUrl, contentDescription)
                } else {
                    Icon(
                        imageVector = Icons.Default.Inventory,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = product.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "SKU: ${product.sku}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (product.category.isNotBlank()) {
                    Text(
                        text = product.category,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(stockLevelColor)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "${product.currentStock.toInt()} in stock",
                        style = MaterialTheme.typography.bodySmall,
                        color = stockLevelColor
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    AmountText(amount = product.sellingPrice)
                }
            }
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                SuggestionChip(
                    onClick = {},
                    label = {
                        Text(
                            text = statusText,
                            style = MaterialTheme.typography.labelSmall,
                            color = statusTextColor
                        )
                    },
                    border = null,
                    colors = SuggestionChipDefaults.suggestionChipColors(
                        containerColor = statusBg
                    )
                )
                IconButton(
                    onClick = onDelete,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Delete",
                        tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f),
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}
