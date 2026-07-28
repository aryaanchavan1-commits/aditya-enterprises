package com.arynoxtech.erp.ui.screens.suppliers

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.arynoxtech.erp.data.local.SupplierEntity
import com.arynoxtech.erp.ui.components.EmptyView
import com.arynoxtech.erp.ui.components.SearchBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupplierListScreen(
    onAddSupplier: () -> Unit = {},
    onEditSupplier: (String) -> Unit = {},
    viewModel: SupplierViewModel = hiltViewModel()
) {
    val suppliers by viewModel.suppliers.collectAsStateWithLifecycle()
    var showDeleteDialog by remember { mutableStateOf(false) }
    var supplierToDelete by remember { mutableStateOf<SupplierEntity?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Suppliers", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onAddSupplier, containerColor = MaterialTheme.colorScheme.primary) {
                Icon(Icons.Default.Add, contentDescription = "Add Supplier", tint = MaterialTheme.colorScheme.onPrimary)
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
            Spacer(modifier = Modifier.height(8.dp))
            SearchBar(query = "", onQueryChange = { viewModel.search(it) }, placeholder = "Search suppliers...", modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(12.dp))
            if (suppliers.isEmpty()) {
                EmptyView(message = "No suppliers yet. Tap + to add.")
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(suppliers, key = { it.id }) { supplier ->
                        ElevatedCard(
                            modifier = Modifier.fillMaxWidth().clickable { onEditSupplier(supplier.id) },
                            shape = RoundedCornerShape(12.dp), elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
                        ) {
                            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(modifier = Modifier.size(48.dp).clip(CircleShape), contentAlignment = Alignment.Center) {
                                    Icon(Icons.Default.Person, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(28.dp))
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(supplier.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    if (supplier.phone.isNotBlank()) Text(supplier.phone, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    if (supplier.city.isNotBlank()) Text(supplier.city, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                IconButton(onClick = {
                                    supplierToDelete = supplier; showDeleteDialog = true
                                }, modifier = Modifier.size(32.dp)) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f), modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                    item { Spacer(modifier = Modifier.height(80.dp)) }
                }
            }
        }
    }
    if (showDeleteDialog && supplierToDelete != null) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false; supplierToDelete = null },
            title = { Text("Delete Supplier") },
            text = { Text("Delete \"${supplierToDelete?.name}\"?") },
            confirmButton = { TextButton(onClick = { supplierToDelete?.let { viewModel.delete(it) }; showDeleteDialog = false; supplierToDelete = null }) { Text("Delete", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { showDeleteDialog = false; supplierToDelete = null }) { Text("Cancel") } }
        )
    }
}
