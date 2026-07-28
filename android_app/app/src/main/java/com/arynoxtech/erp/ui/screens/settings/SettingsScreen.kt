package com.arynoxtech.erp.ui.screens.settings

import android.app.Activity
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.BluetoothConnected
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Percent
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Usb
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.arynoxtech.erp.service.BluetoothDeviceInfo

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Settings")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        snackbarHost = {
            if (uiState.successMessage != null) {
                Snackbar(
                    modifier = Modifier.padding(16.dp),
                    action = {
                        TextButton(onClick = viewModel::clearSuccess) {
                            Text("Dismiss")
                        }
                    }
                ) {
                    Text(uiState.successMessage ?: "")
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(scrollState)
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.height(8.dp))

            if (uiState.error != null) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = uiState.error ?: "",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(onClick = viewModel::clearError) {
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = "Dismiss",
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }

            LanguageSection(
                currentLanguage = uiState.language,
                onLanguageChange = { lang ->
                    viewModel.setLanguage(lang)
                    (context as? Activity)?.recreate()
                }
            )

            Spacer(modifier = Modifier.height(8.dp))

            AppSettingsSection(
                appPassword = uiState.appPassword,
                isPasswordEnabled = uiState.isPasswordEnabled,
                themeMode = uiState.themeMode,
                onSetPassword = { password, enabled -> viewModel.setAppPassword(password, enabled) },
                onThemeChange = viewModel::setThemeMode
            )

            Spacer(modifier = Modifier.height(8.dp))

            CompanyDetailsSection(
                name = uiState.companyName,
                address = uiState.companyAddress,
                phone = uiState.companyPhone,
                email = uiState.companyEmail,
                gstin = uiState.companyGstin,
                pan = uiState.companyPan,
                isSaving = uiState.isSaving,
                onSave = { n, a, p, e, g, pan ->
                    viewModel.saveCompanyDetails(n, a, p, e, g, pan)
                },
                onUpdate = { n, a, p, e, g, pan ->
                    viewModel.updateInputField(
                        companyName = n,
                        companyAddress = a,
                        companyPhone = p,
                        companyEmail = e,
                        companyGstin = g,
                        companyPan = pan
                    )
                }
            )

            Spacer(modifier = Modifier.height(8.dp))

            BankDetailsSection(
                name = uiState.bankName,
                account = uiState.bankAccount,
                ifsc = uiState.ifscCode,
                upi = uiState.upiId,
                isSaving = uiState.isSaving,
                onSave = { n, a, i, u -> viewModel.saveBankDetails(n, a, i, u) },
                onUpdate = { n, a, i, u ->
                    viewModel.updateInputField(
                        bankName = n,
                        bankAccount = a,
                        ifscCode = i,
                        upiId = u
                    )
                }
            )

            Spacer(modifier = Modifier.height(8.dp))

            BluetoothSection(
                availableDevices = uiState.availableDevices,
                connectedDevice = uiState.connectedDevice,
                isLoading = uiState.isLoading,
                onDiscover = viewModel::discoverDevices,
                onConnect = viewModel::connectToDevice,
                onDisconnect = viewModel::disconnectDevice
            )

            Spacer(modifier = Modifier.height(8.dp))

            GstSection(
                defaultRate = uiState.defaultGstRate,
                isSaving = uiState.isSaving,
                onRateChange = viewModel::setDefaultGstRate
            )

            Spacer(modifier = Modifier.height(8.dp))

            SyncSection(
                isSyncConfigured = uiState.isSyncConfigured,
                isSyncEnabled = uiState.isSyncEnabled,
                lastSyncTime = uiState.lastSyncTime,
                syncStatus = uiState.syncStatus,
                isLoading = uiState.isLoading,
                isSaving = uiState.isSaving,
                tursoUrl = uiState.tursoUrl,
                tursoAuthToken = uiState.tursoAuthToken,
                onTest = viewModel::testSyncConnection,
                onToggleSync = viewModel::toggleAutoSync,
                onSyncNow = viewModel::syncNow,
                onSaveTurso = viewModel::saveTursoCredentials
            )

            Spacer(modifier = Modifier.height(8.dp))

            AiConfigSection(
                apiKey = uiState.groqApiKey,
                isAiEnabled = uiState.isAiEnabled,
                isSaving = uiState.isSaving,
                onKeyChange = { viewModel.updateInputField(groqApiKey = it) },
                onSaveKey = viewModel::setGroqApiKey,
                onToggleAi = viewModel::setAiEnabled
            )

            Spacer(modifier = Modifier.height(8.dp))

            DataManagementSection(
                onExport = viewModel::exportData,
                onImport = { uri -> viewModel.importData(uri) },
                onClearData = viewModel::clearAllData
            )

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun ExpandableCard(
    title: String,
    icon: ImageVector,
    initiallyExpanded: Boolean = false,
    content: @Composable () -> Unit
) {
    var expanded by remember { mutableStateOf(initiallyExpanded) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primaryContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = icon,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Icon(
                    imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (expanded) "Collapse" else "Expand"
                )
            }
            AnimatedVisibility(
                visible = expanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                Column(modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
                    HorizontalDivider(modifier = Modifier.padding(bottom = 12.dp))
                    content()
                }
            }
        }
    }
}

@Composable
private fun LanguageSection(
    currentLanguage: String,
    onLanguageChange: (String) -> Unit
) {
    ExpandableCard(title = "Language", icon = Icons.Default.Settings) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            listOf("en" to "English", "hi" to "हिंदी", "mr" to "मराठी").forEach { (code, name) ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onLanguageChange(code) }
                        .padding(vertical = 12.dp, horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = name,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = if (currentLanguage == code) FontWeight.SemiBold else FontWeight.Normal
                    )
                    if (currentLanguage == code) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Selected",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AppSettingsSection(
    appPassword: String,
    isPasswordEnabled: Boolean,
    themeMode: String,
    onSetPassword: (String, Boolean) -> Unit,
    onThemeChange: (String) -> Unit
) {
    var showPasswordDialog by remember { mutableStateOf(false) }
    var passwordInput by remember { mutableStateOf("") }
    var passwordEnabled by remember { mutableStateOf(isPasswordEnabled) }

    ExpandableCard(title = "App Settings", icon = Icons.Default.Lock) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("App Password", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        text = if (isPasswordEnabled) "Enabled" else "Disabled",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = isPasswordEnabled,
                    onCheckedChange = { enabled ->
                        if (enabled) {
                            showPasswordDialog = true
                            passwordEnabled = true
                        } else {
                            onSetPassword("", false)
                        }
                    }
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Theme", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        text = themeMode.replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf("light", "dark", "system").forEach { mode ->
                        TextButton(
                            onClick = { onThemeChange(mode) },
                            colors = ButtonDefaults.textButtonColors(
                                containerColor = if (themeMode == mode)
                                    MaterialTheme.colorScheme.primaryContainer
                                else MaterialTheme.colorScheme.surface,
                                contentColor = if (themeMode == mode)
                                    MaterialTheme.colorScheme.onPrimaryContainer
                                else MaterialTheme.colorScheme.onSurface
                            ),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = mode.replaceFirstChar { it.uppercase() },
                                style = MaterialTheme.typography.labelMedium
                            )
                        }
                    }
                }
            }

            Text(
                text = "App version: 1.0.0",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }

    if (showPasswordDialog) {
        AlertDialog(
            onDismissRequest = { showPasswordDialog = false },
            title = { Text("Set App Password") },
            text = {
                OutlinedTextField(
                    value = passwordInput,
                    onValueChange = { passwordInput = it },
                    label = { Text("Password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation()
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    onSetPassword(passwordInput, true)
                    showPasswordDialog = false
                }) { Text("Set") }
            },
            dismissButton = {
                TextButton(onClick = { showPasswordDialog = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun CompanyDetailsSection(
    name: String,
    address: String,
    phone: String,
    email: String,
    gstin: String,
    pan: String,
    isSaving: Boolean,
    onSave: (String, String, String, String, String, String) -> Unit,
    onUpdate: (String?, String?, String?, String?, String?, String?) -> Unit
) {
    ExpandableCard(title = "Company Details", icon = Icons.Default.Business) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = name,
                onValueChange = { onUpdate(it, null, null, null, null, null) },
                label = { Text("Company Name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )
            OutlinedTextField(
                value = address,
                onValueChange = { onUpdate(null, it, null, null, null, null) },
                label = { Text("Address") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
                maxLines = 3,
                shape = RoundedCornerShape(12.dp)
            )
            OutlinedTextField(
                value = phone,
                onValueChange = { onUpdate(null, null, it, null, null, null) },
                label = { Text("Phone") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )
            OutlinedTextField(
                value = email,
                onValueChange = { onUpdate(null, null, null, it, null, null) },
                label = { Text("Email") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )
            OutlinedTextField(
                value = gstin,
                onValueChange = { onUpdate(null, null, null, null, it, null) },
                label = { Text("GSTIN") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )
            OutlinedTextField(
                value = pan,
                onValueChange = { onUpdate(null, null, null, null, null, it) },
                label = { Text("PAN") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )
            Button(
                onClick = { onSave(name, address, phone, email, gstin, pan) },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isSaving
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Save,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Save")
                }
            }
        }
    }
}

@Composable
private fun BankDetailsSection(
    name: String,
    account: String,
    ifsc: String,
    upi: String,
    isSaving: Boolean,
    onSave: (String, String, String, String) -> Unit,
    onUpdate: (String?, String?, String?, String?) -> Unit
) {
    ExpandableCard(title = "Bank Details", icon = Icons.Default.AccountBalance) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = name,
                onValueChange = { onUpdate(it, null, null, null) },
                label = { Text("Bank Name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )
            OutlinedTextField(
                value = account,
                onValueChange = { onUpdate(null, it, null, null) },
                label = { Text("Account Number") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )
            OutlinedTextField(
                value = ifsc,
                onValueChange = { onUpdate(null, null, it, null) },
                label = { Text("IFSC Code") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )
            OutlinedTextField(
                value = upi,
                onValueChange = { onUpdate(null, null, null, it) },
                label = { Text("UPI ID") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )
            Button(
                onClick = { onSave(name, account, ifsc, upi) },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isSaving
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Save,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Save")
                }
            }
        }
    }
}

@Composable
private fun BluetoothSection(
    availableDevices: List<BluetoothDeviceInfo>,
    connectedDevice: BluetoothDeviceInfo?,
    isLoading: Boolean,
    onDiscover: () -> Unit,
    onConnect: (BluetoothDeviceInfo) -> Unit,
    onDisconnect: () -> Unit
) {
    ExpandableCard(title = "Bluetooth Devices", icon = Icons.Default.Bluetooth) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (connectedDevice != null) {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = Color(0xFF22C55E).copy(alpha = 0.1f)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.BluetoothConnected,
                                contentDescription = null,
                                tint = Color(0xFF22C55E),
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = connectedDevice.name,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium
                                )
                                Text(
                                    text = connectedDevice.address,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        TextButton(onClick = onDisconnect) {
                            Text("Disconnect", color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            }

            FilledTonalButton(
                onClick = onDiscover,
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Bluetooth,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                }
                Spacer(modifier = Modifier.width(4.dp))
                Text("Scan for devices")
            }

            if (availableDevices.isNotEmpty()) {
                availableDevices.forEach { device ->
                    val isConnected = device.address == connectedDevice?.address
                    AssistChip(
                        onClick = { if (isConnected) onDisconnect() else onConnect(device) },
                        label = {
                            Column {
                                Text(
                                    text = device.name,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Text(
                                    text = device.address,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        },
                        leadingIcon = {
                            Icon(
                                imageVector = if (device.type == "USB") Icons.Default.Usb
                                else Icons.Default.Bluetooth,
                                contentDescription = device.type,
                                modifier = Modifier.size(18.dp)
                            )
                        },
                        trailingIcon = {
                            if (isConnected) {
                                Icon(
                                    imageVector = Icons.Default.BluetoothConnected,
                                    contentDescription = "Connected",
                                    tint = Color(0xFF22C55E),
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = if (isConnected)
                                Color(0xFF22C55E).copy(alpha = 0.1f)
                            else MaterialTheme.colorScheme.surface
                        )
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GstSection(
    defaultRate: Double,
    isSaving: Boolean,
    onRateChange: (Double) -> Unit
) {
    val rates = listOf(0.0, 5.0, 12.0, 18.0, 28.0)
    var expanded by remember { mutableStateOf(false) }

    ExpandableCard(title = "GST Configuration", icon = Icons.Default.Percent) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = !expanded }
            ) {
                OutlinedTextField(
                    value = "${defaultRate.toInt()}%",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Default GST Rate") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable, enabled = true),
                    shape = RoundedCornerShape(12.dp)
                )
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    rates.forEach { rate ->
                        DropdownMenuItem(
                            text = { Text("${rate.toInt()}%") },
                            onClick = {
                                onRateChange(rate)
                                expanded = false
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SyncSection(
    isSyncConfigured: Boolean,
    isSyncEnabled: Boolean,
    lastSyncTime: String,
    syncStatus: String,
    isLoading: Boolean,
    isSaving: Boolean,
    tursoUrl: String,
    tursoAuthToken: String,
    onTest: () -> Unit,
    onToggleSync: (Boolean) -> Unit,
    onSyncNow: () -> Unit,
    onSaveTurso: (String, String) -> Unit
) {
    var url by remember(tursoUrl) { mutableStateOf(tursoUrl) }
    var token by remember(tursoAuthToken) { mutableStateOf(tursoAuthToken) }
    var showToken by remember { mutableStateOf(false) }

    ExpandableCard(title = "Database Credentials", icon = Icons.Default.CloudSync) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = url,
                onValueChange = { url = it },
                label = { Text("Turso Database URL") },
                placeholder = { Text("https://your-db.turso.io") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = token,
                onValueChange = { token = it },
                label = { Text("Auth Token") },
                placeholder = { Text("Paste your Turso auth token") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = if (showToken) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = { showToken = !showToken }) {
                        Icon(
                            imageVector = if (showToken) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = if (showToken) "Hide token" else "Show token"
                        )
                    }
                }
            )

            Button(
                onClick = { onSaveTurso(url, token) },
                modifier = Modifier.fillMaxWidth(),
                enabled = url.isNotBlank() && token.isNotBlank() && !isSaving
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text("Save Credentials")
                }
            }

            if (syncStatus.isNotEmpty()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(
                                when (syncStatus) {
                                    "Connected" -> Color(0xFF22C55E)
                                    "Testing" -> Color(0xFFEAB308)
                                    else -> Color(0xFFEF4444)
                                }
                            )
                    )
                    Text(
                        text = syncStatus,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onTest,
                    modifier = Modifier.weight(1f),
                    enabled = !isLoading
                ) {
                    Text("Test Connection")
                }
            }

            HorizontalDivider()
            Spacer(modifier = Modifier.height(4.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Auto-sync", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        text = "Last sync: $lastSyncTime",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = isSyncEnabled,
                    onCheckedChange = onToggleSync
                )
            }

            Button(
                onClick = onSyncNow,
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Sync,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                }
                Spacer(modifier = Modifier.width(4.dp))
                Text("Sync Now")
            }
        }
    }
}

@Composable
private fun AiConfigSection(
    apiKey: String,
    isAiEnabled: Boolean,
    isSaving: Boolean,
    onKeyChange: (String) -> Unit,
    onSaveKey: (String) -> Unit,
    onToggleAi: (Boolean) -> Unit
) {
    var showKey by remember { mutableStateOf(false) }

    ExpandableCard(title = "AI Configuration", icon = Icons.Default.SmartToy) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("AI Assistant", style = MaterialTheme.typography.bodyLarge)
                Switch(
                    checked = isAiEnabled,
                    onCheckedChange = onToggleAi
                )
            }

            OutlinedTextField(
                value = apiKey,
                onValueChange = onKeyChange,
                label = { Text("Groq API Key") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                visualTransformation = if (showKey) VisualTransformation.None
                else PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = { showKey = !showKey }) {
                        Icon(
                            imageVector = if (showKey) Icons.Default.VisibilityOff
                            else Icons.Default.Visibility,
                            contentDescription = if (showKey) "Hide key" else "Show key"
                        )
                    }
                }
            )

            Button(
                onClick = { onSaveKey(apiKey) },
                modifier = Modifier.fillMaxWidth(),
                enabled = apiKey.isNotBlank() && !isSaving
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Key,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                }
                Spacer(modifier = Modifier.width(4.dp))
                Text("Save API Key")
            }

            if (apiKey.isNotBlank()) {
                Text(
                    text = "AI models available: Llama 3.3 70B, Mixtral 8x7B, Gemma 2 9B, Llama 3.1 8B",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun DataManagementSection(
    onExport: () -> Unit,
    onImport: (Uri) -> Unit,
    onClearData: () -> Unit
) {
    var showClearDialog by remember { mutableStateOf(false) }

    val importLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { onImport(it) }
    }

    ExpandableCard(title = "Data Management", icon = Icons.Default.Storage) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = onExport,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    imageVector = Icons.Default.FileUpload,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("Export All Data")
            }

            OutlinedButton(
                onClick = { importLauncher.launch("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    imageVector = Icons.Default.FileDownload,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("Import Data")
            }

            OutlinedButton(
                onClick = { showClearDialog = true },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error
                )
            ) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("Clear Local Data")
            }
        }
    }

    if (showClearDialog) {
        AlertDialog(
            onDismissRequest = { showClearDialog = false },
            title = { Text("Clear Local Data") },
            text = { Text("This will delete all local data including products, sales, purchases, and settings. This action cannot be undone. Continue?") },
            confirmButton = {
                TextButton(onClick = {
                    showClearDialog = false
                    onClearData()
                }) { Text("Clear", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showClearDialog = false }) { Text("Cancel") }
            }
        )
    }
}
