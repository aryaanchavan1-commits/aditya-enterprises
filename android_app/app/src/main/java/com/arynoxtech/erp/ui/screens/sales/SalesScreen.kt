package com.arynoxtech.erp.ui.screens.sales

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
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.arynoxtech.erp.domain.model.Sale
import com.arynoxtech.erp.ui.components.AmountText
import com.arynoxtech.erp.ui.components.EmptyView
import com.arynoxtech.erp.ui.components.ErrorView
import com.arynoxtech.erp.ui.components.FilterChipGroup
import com.arynoxtech.erp.ui.components.LoadingIndicator
import com.arynoxtech.erp.ui.components.SearchBar
import com.arynoxtech.erp.ui.components.StatusBadge
import com.arynoxtech.erp.ui.theme.statusColor
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesScreen(
    onNavigateToPos: () -> Unit = {},
    onNavigateToInvoice: (String) -> Unit = {},
    onNewSale: () -> Unit = {},
    viewModel: SalesViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val paymentStatusFilters = listOf("All", "Paid", "Pending", "Partial")

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Sales",
                        fontWeight = FontWeight.SemiBold
                    )
                },
                actions = {
                    androidx.compose.material3.IconButton(onClick = onNewSale) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "New Sale"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNavigateToPos,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Default.PointOfSale,
                    contentDescription = "POS",
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
                query = uiState.searchQuery,
                onQueryChange = viewModel::search,
                placeholder = "Search by invoice or customer...",
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )

            FilterChipGroup(
                options = paymentStatusFilters,
                selected = uiState.selectedPaymentStatus ?: "All",
                onSelect = { selected ->
                    viewModel.filterByPaymentStatus(
                        if (selected == "All") null else selected
                    )
                },
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            when {
                uiState.isLoading -> {
                    LoadingIndicator()
                }
                uiState.error != null -> {
                    ErrorView(
                        message = uiState.error ?: "An error occurred",
                        onRetry = viewModel::refresh
                    )
                }
                uiState.sales.isEmpty() -> {
                    EmptyView(
                        message = "No sales found",
                        icon = Icons.Default.Receipt
                    )
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(
                            horizontal = 16.dp,
                            vertical = 8.dp
                        )
                    ) {
                        items(uiState.sales, key = { it.id }) { sale ->
                            SaleCard(
                                sale = sale,
                                onClick = { onNavigateToInvoice(sale.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SaleCard(
    sale: Sale,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = sale.invoiceNumber,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary
                )
                StatusBadge(status = sale.paymentStatus)
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = sale.customerName.ifEmpty { "Walk-in Customer" },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val dateFormat = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
                    Text(
                        text = dateFormat.format(Date(sale.saleDate)),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    StatusBadge(status = sale.status)
                }

                AmountText(
                    amount = sale.totalAmount,
                    modifier = Modifier.padding(0.dp)
                )
            }
        }
    }
}
