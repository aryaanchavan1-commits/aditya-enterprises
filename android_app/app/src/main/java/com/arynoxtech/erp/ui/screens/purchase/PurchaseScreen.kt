package com.arynoxtech.erp.ui.screens.purchase

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.arynoxtech.erp.ui.components.AmountText
import com.arynoxtech.erp.ui.components.ConfirmDialog
import com.arynoxtech.erp.ui.components.EmptyView
import com.arynoxtech.erp.ui.components.ErrorView
import com.arynoxtech.erp.ui.components.FilterChipGroup
import com.arynoxtech.erp.ui.components.LoadingIndicator
import com.arynoxtech.erp.ui.components.SearchBar
import com.arynoxtech.erp.ui.components.StatusBadge
import com.arynoxtech.erp.ui.navigation.NavRoutes
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PurchaseScreen(
    navController: NavController,
    viewModel: PurchaseViewModel = hiltViewModel()
) {
    val listState by viewModel.listState.collectAsState()
    var showDeleteDialog by remember { mutableStateOf(false) }
    var deleteTargetId by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            LargeTopAppBar(
                title = { Text("Purchase Orders") },
                colors = TopAppBarDefaults.largeTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    viewModel.resetForm()
                    navController.navigate(NavRoutes.PurchaseAdd.createRoute())
                },
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "New Purchase Order",
                    tint = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            SearchBar(
                query = listState.searchQuery,
                onQueryChange = viewModel::search,
                placeholder = "Search by PO number or supplier...",
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )

            FilterChipGroup(
                options = listOf("All", "Ordered", "Received", "Cancelled"),
                selected = listState.statusFilter ?: "All",
                onSelect = { selected ->
                    viewModel.filterByStatus(if (selected == "All") null else selected)
                },
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            when {
                listState.isLoading -> LoadingIndicator()
                listState.error != null -> ErrorView(
                    message = listState.error!!,
                    onRetry = viewModel::refresh
                )
                listState.purchases.isEmpty() -> EmptyView(
                    message = "No purchase orders found\nTap + to create one",
                    icon = Icons.Default.ShoppingBag
                )
                else -> PullToRefreshBox(
                    isRefreshing = listState.isLoading,
                    onRefresh = viewModel::refresh,
                    modifier = Modifier.fillMaxSize()
                ) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(
                            horizontal = 16.dp, vertical = 8.dp
                        )
                    ) {
                        items(listState.purchases, key = { it.id }) { purchase ->
                            PurchaseCard(
                                purchase = purchase,
                                onClick = {
                                    navController.navigate(
                                        NavRoutes.PurchaseDetail.createRoute(purchase.id)
                                    )
                                },
                                onDelete = {
                                    deleteTargetId = purchase.id
                                    showDeleteDialog = true
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showDeleteDialog && deleteTargetId != null) {
        ConfirmDialog(
            title = "Delete Purchase Order",
            message = "Are you sure you want to delete this purchase order? This action cannot be undone.",
            confirmText = "Delete",
            onConfirm = {
                viewModel.deletePurchase(deleteTargetId!!)
                showDeleteDialog = false
                deleteTargetId = null
            },
            onDismiss = {
                showDeleteDialog = false
                deleteTargetId = null
            }
        )
    }
}

@Composable
private fun PurchaseCard(
    purchase: PurchaseListItem,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = purchase.purchaseNumber,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = purchase.supplierName,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = dateFormat.format(Date(purchase.orderDate)),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    AmountText(amount = purchase.totalAmount)
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(horizontalAlignment = Alignment.End) {
                StatusBadge(status = purchase.status)
                Spacer(modifier = Modifier.height(8.dp))
                IconButton(onClick = onDelete) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Delete",
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}
