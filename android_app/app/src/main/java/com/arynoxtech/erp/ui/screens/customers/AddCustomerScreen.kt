package com.arynoxtech.erp.ui.screens.customers

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddCustomerScreen(
    customerId: String? = null,
    onNavigateBack: () -> Unit = {},
    viewModel: CustomerViewModel = hiltViewModel()
) {
    val formState by viewModel.formState.collectAsStateWithLifecycle()

    LaunchedEffect(customerId) {
        if (customerId != null) viewModel.loadCustomer(customerId)
    }
    LaunchedEffect(formState.success) {
        if (formState.success) onNavigateBack()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (customerId != null) "Edit Customer" else "Add Customer", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold) },
                navigationIcon = { IconButton(onClick = onNavigateBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            formState.error?.let { err ->
                ElevatedCard(colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.onErrorContainer)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(err, color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }

            OutlinedTextField(value = formState.name, onValueChange = { viewModel.updateField("name", it) }, label = { Text("Name *") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
            OutlinedTextField(value = formState.phone, onValueChange = { viewModel.updateField("phone", it) }, label = { Text("Phone") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
            OutlinedTextField(value = formState.email, onValueChange = { viewModel.updateField("email", it) }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
            OutlinedTextField(value = formState.gstin, onValueChange = { viewModel.updateField("gstin", it) }, label = { Text("GSTIN") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
            OutlinedTextField(value = formState.address, onValueChange = { viewModel.updateField("address", it) }, label = { Text("Address") }, modifier = Modifier.fillMaxWidth(), minLines = 2, maxLines = 3, shape = RoundedCornerShape(12.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = formState.city, onValueChange = { viewModel.updateField("city", it) }, label = { Text("City") }, modifier = Modifier.weight(1f), singleLine = true, shape = RoundedCornerShape(12.dp))
                OutlinedTextField(value = formState.state, onValueChange = { viewModel.updateField("state", it) }, label = { Text("State") }, modifier = Modifier.weight(1f), singleLine = true, shape = RoundedCornerShape(12.dp))
            }
            OutlinedTextField(value = formState.pincode, onValueChange = { viewModel.updateField("pincode", it) }, label = { Text("Pincode") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = formState.creditLimit, onValueChange = { viewModel.updateField("creditLimit", it) }, label = { Text("Credit Limit") }, modifier = Modifier.weight(1f), singleLine = true, shape = RoundedCornerShape(12.dp), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                OutlinedTextField(value = formState.creditDays, onValueChange = { viewModel.updateField("creditDays", it) }, label = { Text("Credit Days") }, modifier = Modifier.weight(1f), singleLine = true, shape = RoundedCornerShape(12.dp), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
            }
            OutlinedTextField(value = formState.notes, onValueChange = { viewModel.updateField("notes", it) }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth(), minLines = 2, maxLines = 4, shape = RoundedCornerShape(12.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = onNavigateBack, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) { Text("Cancel") }
                Button(onClick = { viewModel.save(onNavigateBack) }, modifier = Modifier.weight(1f), enabled = !formState.isSaving, shape = RoundedCornerShape(12.dp)) {
                    if (formState.isSaving) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                    else { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(modifier = Modifier.width(4.dp)); Text("Save") }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
