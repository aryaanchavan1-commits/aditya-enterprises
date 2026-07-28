package com.arynoxtech.erp.ui.screens.dashboard

import android.app.DatePickerDialog
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.arynoxtech.erp.ui.components.AmountText
import com.arynoxtech.erp.ui.components.EmptyView
import com.arynoxtech.erp.ui.components.ErrorView
import com.arynoxtech.erp.ui.components.SectionHeader
import com.arynoxtech.erp.ui.components.StatusBadge
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToInventory: () -> Unit = {},
    onNavigateToAddProduct: () -> Unit = {},
    onNavigateToSales: () -> Unit = {},
    onNavigateToPurchase: () -> Unit = {},
    onNavigateToReports: () -> Unit = {},
    onNavigateToAi: () -> Unit = {},
    onNavigateToBarcode: () -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    PullToRefreshBox(
        isRefreshing = state.isLoading,
        onRefresh = { viewModel.refresh() },
        modifier = Modifier.fillMaxSize()
    ) {
        when {
            state.isLoading && state.totalProducts == 0 -> DashboardSkeleton()
            state.error != null && state.totalProducts == 0 -> ErrorView(
                message = state.error ?: "Unknown error",
                onRetry = { viewModel.refresh() }
            )
            else -> DashboardContent(
                state = state,
                onNavigateToInventory = onNavigateToInventory,
                onNavigateToAddProduct = onNavigateToAddProduct,
                onNavigateToSales = onNavigateToSales,
                onNavigateToPurchase = onNavigateToPurchase,
                onNavigateToReports = onNavigateToReports,
                onNavigateToAi = onNavigateToAi,
                onNavigateToBarcode = onNavigateToBarcode,
                viewModel = viewModel
            )
        }
    }
}

@Composable
private fun DashboardContent(
    state: DashboardUiState,
    onNavigateToInventory: () -> Unit,
    onNavigateToAddProduct: () -> Unit,
    onNavigateToSales: () -> Unit,
    onNavigateToPurchase: () -> Unit,
    onNavigateToReports: () -> Unit,
    onNavigateToAi: () -> Unit,
    onNavigateToBarcode: () -> Unit,
    viewModel: DashboardViewModel
) {
    val context = LocalContext.current

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                GreetingSection(greeting = state.greeting, date = state.date)
                ElevatedCard(
                    modifier = Modifier.clickable {
                        val cal = Calendar.getInstance().apply { timeInMillis = state.selectedDate }
                        DatePickerDialog(
                            context,
                            { _, year, month, day ->
                                val picked = Calendar.getInstance().apply { set(year, month, day, 0, 0, 0); set(Calendar.MILLISECOND, 0) }
                                viewModel.selectDate(picked.timeInMillis)
                            },
                            cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)
                        ).show()
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(state.selectedDateFormatted, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    }
                }
            }
        }
        item { DailySummaryCard(state = state) }
        item { StatsCardsRow(state = state, onNavigateToInventory = onNavigateToInventory) }
        item { ChartsSection(state = state) }
        item { QuickActionsGrid(
            onNavigateToSales = onNavigateToSales,
            onNavigateToAddProduct = onNavigateToAddProduct,
            onNavigateToPurchase = onNavigateToPurchase,
            onNavigateToReports = onNavigateToReports,
            onNavigateToAi = onNavigateToAi,
            onNavigateToBarcode = onNavigateToBarcode
        ) }
        item {
            SectionHeader(
                title = "Recent Sales",
                action = "View All",
                onActionClick = onNavigateToSales
            )
        }
        if (state.recentSales.isEmpty()) {
            item {
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No recent sales",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        } else {
            items(state.recentSales.take(5)) { sale ->
                RecentSaleCard(sale = sale)
            }
        }
        item { Spacer(modifier = Modifier.height(16.dp)) }
    }
}

@Composable
private fun DailySummaryCard(state: DashboardUiState) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Daily Summary", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(modifier = Modifier.height(12.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                DailyStatItem(label = "Sales", value = "${state.dailySalesCount}", amount = state.dailySalesRevenue, color = Color(0xFF3B82F6))
                DailyStatItem(label = "Purchases", value = "${state.dailyPurchasesCount}", amount = state.dailyPurchaseTotal, color = Color(0xFF8B5CF6))
                DailyStatItem(label = "Expenses", value = "", amount = state.dailyExpenseTotal, color = Color(0xFFEF4444))
                DailyStatItem(label = "Income", value = "", amount = state.dailyIncomeTotal, color = Color(0xFF22C55E))
            }
        }
    }
}

@Composable
private fun DailyStatItem(label: String, value: String, amount: Double, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(color.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
            Text(value.ifBlank { "0" }, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = color)
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text("\u20B9 ${String.format("%,.0f", amount)}", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurface)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun GreetingSection(greeting: String, date: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Image(
            painter = painterResource(id = com.arynoxtech.erp.R.drawable.logo),
            contentDescription = null,
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(
                text = greeting,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = date,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun StatsCardsRow(
    state: DashboardUiState,
    onNavigateToInventory: () -> Unit
) {
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            StatCard(
                label = "Total Products",
                value = "${state.totalProducts}",
                icon = Icons.Default.Inventory,
                color = Color(0xFF22C55E),
                onClick = onNavigateToInventory
            )
        }
        item {
            StatCard(
                label = "Low Stock",
                value = "${state.lowStockCount}",
                icon = Icons.Default.Warning,
                color = Color(0xFFEAB308),
                onClick = onNavigateToInventory
            )
        }
        item {
            StatCard(
                label = "Today's Sales",
                value = "${state.todaySalesCount}",
                icon = Icons.Default.ShoppingCart,
                color = Color(0xFF3B82F6),
                onClick = {}
            )
        }
        item {
            StatCard(
                label = "Monthly Revenue",
                value = "\u20B9 ${"%,.0f".format(state.monthlyRevenue)}",
                icon = Icons.AutoMirrored.Filled.TrendingUp,
                color = MaterialTheme.colorScheme.primary,
                onClick = {}
            )
        }
    }
}

@Composable
private fun StatCard(
    label: String,
    value: String,
    icon: ImageVector,
    color: Color,
    onClick: () -> Unit
) {
    ElevatedCard(
        modifier = Modifier
            .width(160.dp)
            .clickable(onClick = onClick),
        colors = CardDefaults.elevatedCardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(color.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = color,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ChartsSection(state: DashboardUiState) {
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
                text = "Sales Trend (Last 7 Days)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(12.dp))
            if (state.salesChartValues.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No sales data available",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                SalesLineChart(
                    labels = state.salesChartLabels,
                    values = state.salesChartValues,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp)
                )
            }

            Spacer(modifier = Modifier.height(20.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Inventory Distribution",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                InventoryPieChart(
                    inStock = state.inStockCount,
                    lowStock = state.lowStockCount,
                    outOfStock = state.outOfStockCount,
                    modifier = Modifier.size(120.dp)
                )
                Spacer(modifier = Modifier.width(24.dp))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    LegendItem(color = Color(0xFF22C55E), label = "In Stock", count = state.inStockCount)
                    LegendItem(color = Color(0xFFEAB308), label = "Low Stock", count = state.lowStockCount)
                    LegendItem(color = Color(0xFFEF4444), label = "Out of Stock", count = state.outOfStockCount)
                }
            }
        }
    }
}

@Composable
private fun SalesLineChart(
    labels: List<String>,
    values: List<Double>,
    modifier: Modifier = Modifier
) {
    val lineColor = MaterialTheme.colorScheme.primary
    val gridColor = MaterialTheme.colorScheme.outlineVariant
    val dotColor = MaterialTheme.colorScheme.primary

    Canvas(modifier = modifier) {
        val maxValue = (values.maxOrNull() ?: 1.0).coerceAtLeast(1.0)
        val minValue = (values.minOrNull() ?: 0.0)
        val range = (maxValue - minValue).coerceAtLeast(1.0)
        val padding = 40f
        val chartWidth = size.width - padding * 2
        val chartHeight = size.height - padding * 2

        val stepX = if (values.size > 1) chartWidth / (values.size - 1) else chartWidth

        drawLine(
            color = gridColor,
            start = Offset(padding, size.height - padding),
            end = Offset(size.width - padding, size.height - padding),
            strokeWidth = 1f
        )

        if (values.size < 2) return@Canvas

        val points = values.mapIndexed { index, value ->
            val x = padding + index * stepX
            val y = size.height - padding - ((value - minValue) / range * chartHeight).toFloat()
            Offset(x, y)
        }

        for (i in 0 until points.size - 1) {
            drawLine(
                color = lineColor,
                start = points[i],
                end = points[i + 1],
                strokeWidth = 3f,
                cap = StrokeCap.Round
            )
        }

        points.forEach { point ->
            drawCircle(
                color = dotColor,
                radius = 4f,
                center = point
            )
            drawCircle(
                color = Color.White,
                radius = 2f,
                center = point
            )
        }
    }
}

@Composable
private fun InventoryPieChart(
    inStock: Int,
    lowStock: Int,
    outOfStock: Int,
    modifier: Modifier = Modifier
) {
    val total = (inStock + lowStock + outOfStock).coerceAtLeast(1)
    val inStockAngle = (inStock.toFloat() / total) * 360f
    val lowStockAngle = (lowStock.toFloat() / total) * 360f
    val outOfStockAngle = (outOfStock.toFloat() / total) * 360f

    val inStockColor = Color(0xFF22C55E)
    val lowStockColor = Color(0xFFEAB308)
    val outOfStockColor = Color(0xFFEF4444)

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val strokeWidth = 28f
            val diameter = size.minDimension - strokeWidth
            val topLeft = Offset(
                (size.width - diameter) / 2f,
                (size.height - diameter) / 2f
            )

            var startAngle = -90f

            if (inStock > 0) {
                drawArc(
                    color = inStockColor,
                    startAngle = startAngle,
                    sweepAngle = inStockAngle,
                    useCenter = false,
                    topLeft = topLeft,
                    size = Size(diameter, diameter),
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Butt)
                )
                startAngle += inStockAngle
            }

            if (lowStock > 0) {
                drawArc(
                    color = lowStockColor,
                    startAngle = startAngle,
                    sweepAngle = lowStockAngle,
                    useCenter = false,
                    topLeft = topLeft,
                    size = Size(diameter, diameter),
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Butt)
                )
                startAngle += lowStockAngle
            }

            if (outOfStock > 0) {
                drawArc(
                    color = outOfStockColor,
                    startAngle = startAngle,
                    sweepAngle = outOfStockAngle,
                    useCenter = false,
                    topLeft = topLeft,
                    size = Size(diameter, diameter),
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Butt)
                )
            }
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "$total",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "Total",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun LegendItem(color: Color, label: String, count: Int) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(color)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = "$label ($count)",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun QuickActionsGrid(
    onNavigateToSales: () -> Unit,
    onNavigateToAddProduct: () -> Unit,
    onNavigateToPurchase: () -> Unit,
    onNavigateToReports: () -> Unit,
    onNavigateToAi: () -> Unit,
    onNavigateToBarcode: () -> Unit
) {
    Column {
        SectionHeader(title = "Quick Actions")
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                QuickActionItem(
                    label = "New Sale",
                    icon = Icons.Default.ShoppingCart,
                    color = Color(0xFF3B82F6),
                    onClick = onNavigateToSales,
                    modifier = Modifier.weight(1f)
                )
                QuickActionItem(
                    label = "Add Product",
                    icon = Icons.Default.Add,
                    color = Color(0xFF22C55E),
                    onClick = onNavigateToAddProduct,
                    modifier = Modifier.weight(1f)
                )
                QuickActionItem(
                    label = "Purchase Order",
                    icon = Icons.Default.ShoppingBag,
                    color = Color(0xFF4F46E5),
                    onClick = onNavigateToPurchase,
                    modifier = Modifier.weight(1f)
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                QuickActionItem(
                    label = "Reports",
                    icon = Icons.Default.Assessment,
                    color = Color(0xFFEAB308),
                    onClick = onNavigateToReports,
                    modifier = Modifier.weight(1f)
                )
                QuickActionItem(
                    label = "AI Assistant",
                    icon = Icons.Default.SmartToy,
                    color = Color(0xFF06B6D4),
                    onClick = onNavigateToAi,
                    modifier = Modifier.weight(1f)
                )
                QuickActionItem(
                    label = "Barcode",
                    icon = Icons.Default.QrCode,
                    color = MaterialTheme.colorScheme.primary,
                    onClick = onNavigateToBarcode,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun QuickActionItem(
    label: String,
    icon: ImageVector,
    color: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    ElevatedCard(
        modifier = modifier.clickable(onClick = onClick),
        colors = CardDefaults.elevatedCardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 1.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(color.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = color,
                    modifier = Modifier.size(18.dp)
                )
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun RecentSaleCard(sale: RecentSaleItem) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 1.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = sale.invoiceNumber,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = sale.customerName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(2.dp))
                val dateFormat = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault())
                Text(
                    text = dateFormat.format(Date(sale.createdAt)),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                AmountText(amount = sale.total)
                Spacer(modifier = Modifier.height(4.dp))
                StatusBadge(status = sale.paymentStatus)
            }
        }
    }
}

@Composable
private fun HorizontalDivider() {
    androidx.compose.material3.HorizontalDivider(
        color = MaterialTheme.colorScheme.outlineVariant,
        thickness = 1.dp
    )
}

@Composable
private fun DashboardSkeleton() {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val alpha by transition.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "shimmerAlpha"
    )

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Column {
                SkeletonBox(width = 200, height = 28, alpha = alpha)
                Spacer(modifier = Modifier.height(4.dp))
                SkeletonBox(width = 160, height = 16, alpha = alpha)
            }
        }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(4) {
                    SkeletonCard(alpha = alpha)
                }
            }
        }
        item {
            ElevatedCard(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    SkeletonBox(width = 180, height = 20, alpha = alpha)
                    Spacer(modifier = Modifier.height(16.dp))
                    SkeletonBox(width = java.lang.Integer.MAX_VALUE, height = 180, alpha = alpha)
                }
            }
        }
        item {
            SkeletonBox(width = 120, height = 20, alpha = alpha)
            Spacer(modifier = Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                repeat(3) {
                    SkeletonBox(width = java.lang.Integer.MAX_VALUE, height = 56, alpha = alpha, modifier = Modifier.weight(1f))
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                repeat(3) {
                    SkeletonBox(width = java.lang.Integer.MAX_VALUE, height = 56, alpha = alpha, modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun SkeletonCard(alpha: Float) {
    ElevatedCard(
        modifier = Modifier.width(160.dp),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            SkeletonBox(width = 40, height = 40, alpha = alpha, shape = CircleShape)
            Spacer(modifier = Modifier.height(12.dp))
            SkeletonBox(width = 80, height = 24, alpha = alpha)
            Spacer(modifier = Modifier.height(4.dp))
            SkeletonBox(width = 100, height = 14, alpha = alpha)
        }
    }
}

@Composable
private fun SkeletonBox(
    width: Int,
    height: Int,
    alpha: Float,
    shape: androidx.compose.ui.graphics.Shape = RoundedCornerShape(8.dp),
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .then(if (width == java.lang.Integer.MAX_VALUE) Modifier.fillMaxWidth() else Modifier.width(width.dp))
            .height(height.dp)
            .clip(shape)
            .background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = alpha))
    )
}
