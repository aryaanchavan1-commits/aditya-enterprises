package com.arynoxtech.erp.ui.screens.inventory

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.arynoxtech.erp.data.local.ProductEntity
import com.arynoxtech.erp.data.local.StockMovementEntity
import com.arynoxtech.erp.ui.components.AmountText
import com.arynoxtech.erp.ui.components.ErrorView
import com.arynoxtech.erp.ui.components.LoadingIndicator
import com.arynoxtech.erp.ui.theme.stockColor
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductDetailScreen(
    productId: String,
    onNavigateBack: () -> Unit = {},
    onEditProduct: (String) -> Unit = {},
    onPrintBarcode: (String) -> Unit = {},
    viewModel: ProductViewModel = hiltViewModel()
) {
    val detailState by viewModel.detailState.collectAsStateWithLifecycle()

    LaunchedEffect(productId) {
        viewModel.loadProductDetail(productId)
        viewModel.loadStockMovements(productId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Product Detail",
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
                actions = {
                    IconButton(onClick = { onPrintBarcode(productId) }) {
                        Icon(
                            imageVector = Icons.Default.Print,
                            contentDescription = "Print Barcode"
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
                onClick = { onEditProduct(productId) },
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Default.Edit,
                    contentDescription = "Edit Product",
                    tint = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
    ) { padding ->
        when {
            detailState.isLoading -> LoadingIndicator(modifier = Modifier.padding(padding))
            detailState.error != null -> ErrorView(
                message = detailState.error ?: "Product not found",
                onRetry = { viewModel.loadProductDetail(productId) },
                modifier = Modifier.padding(padding)
            )
            detailState.product != null -> ProductDetailContent(
                product = detailState.product!!,
                stockMovements = detailState.stockMovements,
                modifier = Modifier.padding(padding)
            )
        }
    }
}

@Composable
private fun ProductDetailContent(
    product: ProductEntity,
    stockMovements: List<StockMovementEntity>,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { ProductHeader(product = product) }

        if (product.currentStock <= product.minimumStock && product.currentStock > 0) {
            item { LowStockWarning(product = product) }
        }
        if (product.currentStock <= 0) {
            item { OutOfStockWarning() }
        }

        item { InfoCardsGrid(product = product) }
        item { StockBarSection(product = product) }
        item { PricingCard(product = product) }

        if (product.description.isNotBlank()) {
            item { DescriptionSection(description = product.description) }
        }

        item { WarrantyInfoCard(product = product) }
        item {
            androidx.compose.material3.HorizontalDivider(
                color = MaterialTheme.colorScheme.outlineVariant
            )
        }

        item {
            Text(
                text = "Stock Movement History",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
        }

        if (stockMovements.isEmpty()) {
            item {
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No stock movements recorded yet",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        } else {
            items(stockMovements) { movement ->
                StockMovementCard(movement = movement)
            }
        }

        item { Spacer(modifier = Modifier.height(72.dp)) }
    }
}

@Composable
private fun ProductHeader(product: ProductEntity) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 4.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = Brush.horizontalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primary,
                            MaterialTheme.colorScheme.secondary
                        )
                    ),
                    shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)
                )
                .padding(20.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Inventory,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(36.dp)
                    )
                }
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text(
                        text = product.name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "SKU: ${product.sku}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                    if (product.category.isNotBlank()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            SuggestionChip(
                                onClick = {},
                                label = {
                                    Text(
                                        text = product.category,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Color.White
                                    )
                                },
                                border = null,
                                colors = SuggestionChipDefaults.suggestionChipColors(
                                    containerColor = Color.White.copy(alpha = 0.2f)
                                )
                            )
                            if (product.brand.isNotBlank()) {
                                SuggestionChip(
                                    onClick = {},
                                    label = {
                                        Text(
                                            text = product.brand,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = Color.White
                                        )
                                    },
                                    border = null,
                                    colors = SuggestionChipDefaults.suggestionChipColors(
                                        containerColor = Color.White.copy(alpha = 0.2f)
                                    )
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LowStockWarning(product: ProductEntity) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(
            containerColor = Color(0xFFFEF3C7)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Warning,
                contentDescription = null,
                tint = Color(0xFFEAB308),
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(
                    text = "Low Stock Warning",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF92400E)
                )
                Text(
                    text = "Current stock (${product.currentStock.toInt()}) is at or below minimum stock level (${product.minimumStock.toInt()}).",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF92400E)
                )
            }
        }
    }
}

@Composable
private fun OutOfStockWarning() {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(
            containerColor = Color(0xFFFEE2E2)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Warning,
                contentDescription = null,
                tint = Color(0xFFEF4444),
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(
                    text = "Out of Stock",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF991B1B)
                )
                Text(
                    text = "This product is currently out of stock. Please restock as soon as possible.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF991B1B)
                )
            }
        }
    }
}

@Composable
private fun InfoCardsGrid(product: ProductEntity) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                InfoChip(
                    label = "Purchase Price",
                    value = "\u20B9 ${"%,.2f".format(product.purchasePrice)}",
                    modifier = Modifier.weight(1f)
                )
                InfoChip(
                    label = "Selling Price",
                    value = "\u20B9 ${"%,.2f".format(product.sellingPrice)}",
                    modifier = Modifier.weight(1f)
                )
                InfoChip(
                    label = "Margin",
                    value = if (product.purchasePrice > 0) {
                        val margin = ((product.sellingPrice - product.purchasePrice) / product.purchasePrice * 100)
                        "${"%.1f".format(margin)}%"
                    } else "N/A",
                    valueColor = if (product.sellingPrice > product.purchasePrice)
                        Color(0xFF22C55E) else Color(0xFFEF4444),
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                InfoChip(
                    label = "Current Stock",
                    value = "${product.currentStock.toInt()}",
                    modifier = Modifier.weight(1f)
                )
                InfoChip(
                    label = "Min Stock",
                    value = "${product.minimumStock.toInt()}",
                    modifier = Modifier.weight(1f)
                )
                InfoChip(
                    label = "GST",
                    value = "${product.gstRate.toInt()}%",
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun InfoChip(
    label: String,
    value: String,
    valueColor: Color = MaterialTheme.colorScheme.onSurface,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = valueColor
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun StockBarSection(product: ProductEntity) {
    val stockLevel = product.currentStock.toFloat()
    val minStock = product.minimumStock.toFloat()
    val maxStock = product.maximumStock.toFloat().coerceAtLeast(minStock * 2)
    val progress = (stockLevel / maxStock).coerceIn(0f, 1f)
    val barColor = stockColor(product.currentStock.toInt(), product.minimumStock.toInt())

    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Stock Level",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(12.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(progress)
                        .height(12.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(barColor)
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Min: ${product.minimumStock.toInt()}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "Current: ${product.currentStock.toInt()}",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Medium,
                    color = barColor
                )
                Text(
                    text = "Max: ${product.maximumStock.toInt()}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun PricingCard(product: ProductEntity) {
    val profitPerUnit = product.sellingPrice - product.purchasePrice
    val marginPercent = if (product.purchasePrice > 0)
        (profitPerUnit / product.purchasePrice * 100) else 0.0
    val isProfitable = profitPerUnit >= 0

    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Price Breakdown",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "Purchase Price",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    AmountText(amount = product.purchasePrice)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "Selling Price",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    AmountText(amount = product.sellingPrice)
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Profit per unit:",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "\u20B9 ${"%,.2f".format(profitPerUnit)} (${"%.1f".format(marginPercent)}%)",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isProfitable) Color(0xFF22C55E) else Color(0xFFEF4444)
                )
            }
        }
    }
}

@Composable
private fun DescriptionSection(description: String) {
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
                Icon(
                    Icons.Default.Description,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Description",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun WarrantyInfoCard(product: ProductEntity) {
    val notes = product.notes
    val hasWarranty = notes.contains("Warranty:", ignoreCase = true)

    if (!hasWarranty) return

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
                Icon(
                    Icons.Default.Star,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Warranty Information",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = notes,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun StockMovementCard(movement: StockMovementEntity) {
    val movementColor = when (movement.movementType.lowercase()) {
        "purchase", "in", "received" -> Color(0xFF22C55E)
        "sale", "out", "sold" -> Color(0xFFEF4444)
        "adjustment" -> Color(0xFF3B82F6)
        "return" -> Color(0xFF8B5CF6)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    val dateFormat = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault())

    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 1.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(movementColor.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (movement.movementType.lowercase() in listOf("purchase", "in", "received"))
                        Icons.Default.ShoppingCart else Icons.Default.Inventory,
                    contentDescription = null,
                    tint = movementColor,
                    modifier = Modifier.size(18.dp)
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = movement.movementType.replaceFirstChar { it.uppercase() },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = if (movement.notes.isNotBlank()) movement.notes
                    else "${movement.productName} - Qty: ${movement.quantity.toInt()}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${movement.quantity.toInt()}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = movementColor
                )
                Text(
                    text = dateFormat.format(Date(movement.createdAt)),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
