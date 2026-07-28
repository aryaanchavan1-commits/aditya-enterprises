package com.arynoxtech.erp.ui.screens.customers

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import com.arynoxtech.erp.data.local.CustomerEntity
import com.arynoxtech.erp.ui.components.EmptyView
import com.arynoxtech.erp.ui.components.SearchBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerListScreen(
    onAddCustomer: () -> Unit = {},
    onEditCustomer: (String) -> Unit = {},
    viewModel: CustomerViewModel = hiltViewModel()
) {
    val customers by viewModel.customers.collectAsStateWithLifecycle()
    val searchQuery = viewModel.formState.value.name
    var showDeleteDialog by remember { mutableStateOf(false) }
    var customerToDelete by remember { mutableStateOf<CustomerEntity?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Customers", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onAddCustomer, containerColor = MaterialTheme.colorScheme.primary) {
                Icon(Icons.Default.Add, contentDescription = "Add Customer", tint = MaterialTheme.colorScheme.onPrimary)
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
            Spacer(modifier = Modifier.height(8.dp))
            SearchBar(
                query = searchQuery,
                onQueryChange = { viewModel.search(it) },
                placeholder = "Search customers...",
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(12.dp))

            if (customers.isEmpty()) {
                EmptyView(message = if (searchQuery.isNotBlank()) "No customers found" else "No customers yet. Tap + to add.")
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(customers, key = { it.id }) { customer ->
                        CustomerCard(
                            customer = customer,
                            onClick = { onEditCustomer(customer.id) },
                            onDelete = {
                                customerToDelete = customer
                                showDeleteDialog = true
                            }
                        )
                    }
                    item { Spacer(modifier = Modifier.height(80.dp)) }
                }
            }
        }
    }

    if (showDeleteDialog && customerToDelete != null) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false; customerToDelete = null },
            title = { Text("Delete Customer") },
            text = { Text("Delete \"${customerToDelete?.name}\"?") },
            confirmButton = {
                TextButton(onClick = {
                    customerToDelete?.let { viewModel.delete(it) }
                    showDeleteDialog = false; customerToDelete = null
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false; customerToDelete = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun CustomerCard(customer: CustomerEntity, onClick: () -> Unit, onDelete: () -> Unit) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(48.dp).clip(CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Person, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(28.dp))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(customer.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (customer.phone.isNotBlank()) Text(customer.phone, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (customer.city.isNotBlank()) Text(customer.city, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f), modifier = Modifier.size(18.dp))
            }
        }
    }
}
