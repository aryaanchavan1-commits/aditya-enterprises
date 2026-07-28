package com.arynoxtech.erp.ui.screens.barcode

import android.Manifest
import android.content.Intent
import android.graphics.Bitmap
import android.provider.Settings
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.BluetoothSearching
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.BluetoothConnected
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Usb
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
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.arynoxtech.erp.service.BluetoothDeviceInfo
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BarcodeScreen(
    viewModel: BarcodeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val tabs = listOf("Scanner", "Generate", "Bulk")
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        viewModel.discoverDevices()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.QrCodeScanner,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Barcode")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            ConnectionStatusBar(
                connectedDevices = uiState.connectedDevices,
                isConnected = uiState.isConnectedToPrinter,
                onScanDevices = viewModel::discoverDevices,
                onConnect = viewModel::connectToDevice,
                onDisconnect = viewModel::disconnectDevice
            )

            if (uiState.error != null) {
                Text(
                    text = uiState.error ?: "",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }

            if (uiState.printSuccess) {
                Text(
                    text = "Barcode printed successfully",
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }

            TabRow(selectedTabIndex = uiState.selectedTab) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = uiState.selectedTab == index,
                        onClick = { viewModel.selectTab(index) },
                        text = { Text(title) }
                    )
                }
            }

            when (uiState.selectedTab) {
                0 -> ScannerTab(
                    scannedBarcode = uiState.scannedBarcode,
                    scannedProduct = uiState.scannedProduct,
                    isLoading = uiState.isLoading,
                    isBtScannerActive = uiState.isBtScannerActive,
                    btScannerInput = uiState.btScannerInput,
                    onBarcodeScanned = viewModel::onBarcodeScanned,
                    onStartBtScanner = viewModel::startBtScanner,
                    onStopBtScanner = viewModel::stopBtScanner,
                    onManualBarcode = { viewModel.onBarcodeScanned(it) }
                )
                1 -> GenerateTab(
                    barcodeData = uiState.barcodeData,
                    barcodeFormat = uiState.barcodeFormat,
                    generatedBitmap = uiState.generatedBarcodeBitmap,
                    isLoading = uiState.isLoading,
                    isPrivateBarcode = uiState.isPrivateBarcode,
                    onDataChange = viewModel::setBarcodeData,
                    onFormatChange = viewModel::setBarcodeFormat,
                    onGenerate = { viewModel.generateBarcode(uiState.barcodeData, uiState.barcodeFormat) },
                    onPrint = { viewModel.printBarcode(uiState.barcodeData) },
                    onDownload = viewModel::downloadBarcode,
                    onPrivateToggle = viewModel::setPrivateBarcode,
                    isConnected = uiState.isConnectedToPrinter
                )
                2 -> BulkTab()
            }
        }
    }
}

@Composable
private fun ConnectionStatusBar(
    connectedDevices: List<BluetoothDeviceInfo>,
    isConnected: Boolean,
    onScanDevices: () -> Unit,
    onConnect: (BluetoothDeviceInfo) -> Unit,
    onDisconnect: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(
                                if (isConnected) Color(0xFF22C55E)
                                else Color(0xFFEF4444)
                            )
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isConnected) "Connected" else "Disconnected",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                }
                FilledTonalButton(
                    onClick = onScanDevices,
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.BluetoothSearching,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Scan", style = MaterialTheme.typography.labelMedium)
                }
            }

            if (connectedDevices.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(8.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(connectedDevices) { device ->
                        DeviceChip(
                            device = device,
                            isConnected = isConnected,
                            onConnect = { onConnect(device) },
                            onDisconnect = onDisconnect
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DeviceChip(
    device: BluetoothDeviceInfo,
    isConnected: Boolean,
    onConnect: () -> Unit,
    onDisconnect: () -> Unit
) {
    AssistChip(
        onClick = if (isConnected) onDisconnect else onConnect,
        label = {
            Text(
                text = device.name,
                style = MaterialTheme.typography.labelSmall,
                maxLines = 1
            )
        },
        leadingIcon = {
            Icon(
                imageVector = if (device.type == "USB") Icons.Default.Usb
                else Icons.Default.Bluetooth,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
        },
        trailingIcon = {
            if (isConnected) {
                Icon(
                    imageVector = Icons.Default.BluetoothConnected,
                    contentDescription = "Connected",
                    modifier = Modifier.size(14.dp),
                    tint = Color(0xFF22C55E)
                )
            }
        },
        colors = AssistChipDefaults.assistChipColors(
            containerColor = if (isConnected) Color(0xFF22C55E).copy(alpha = 0.1f)
            else MaterialTheme.colorScheme.surface
        )
    )
}

@OptIn(ExperimentalPermissionsApi::class)
@Composable
private fun ScannerTab(
    scannedBarcode: String,
    scannedProduct: com.arynoxtech.erp.data.local.ProductEntity?,
    isLoading: Boolean,
    isBtScannerActive: Boolean,
    btScannerInput: String,
    onBarcodeScanned: (String) -> Unit,
    onStartBtScanner: () -> Unit,
    onStopBtScanner: () -> Unit,
    onManualBarcode: (String) -> Unit
) {
    var manualInput by remember { mutableStateOf("") }
    val context = LocalContext.current
    val cameraPermission = rememberPermissionState(Manifest.permission.CAMERA)
    var permissionRequested by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (!cameraPermission.status.isGranted && !permissionRequested) {
            permissionRequested = true
            cameraPermission.launchPermissionRequest()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .height(280.dp),
            shape = RoundedCornerShape(16.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                if (cameraPermission.status.isGranted) {
                    CameraPreview(
                        onBarcodeScanned = onBarcodeScanned,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .clickable { cameraPermission.launchPermissionRequest() },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.CameraAlt,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Camera permission required",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(onClick = { cameraPermission.launchPermissionRequest() }) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Grant Permission")
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        TextButton(onClick = {
                            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                                data = android.net.Uri.fromParts("package", context.packageName, null)
                            }
                            context.startActivity(intent)
                        }) {
                            Icon(Icons.Default.Settings, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Open Settings")
                        }
                    }
                }
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .border(
                            width = 2.dp,
                            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f),
                            shape = RoundedCornerShape(16.dp)
                        )
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = manualInput,
            onValueChange = { manualInput = it },
            label = { Text("Manual barcode input") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            trailingIcon = {
                if (manualInput.isNotBlank()) {
                    IconButton(onClick = {
                        onManualBarcode(manualInput)
                        manualInput = ""
                    }) {
                        Icon(
                            imageVector = Icons.Default.QrCodeScanner,
                            contentDescription = "Lookup"
                        )
                    }
                }
            }
        )

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = { if (isBtScannerActive) onStopBtScanner() else onStartBtScanner() },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isBtScannerActive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary
                )
            ) {
                Icon(
                    imageVector = Icons.Default.Bluetooth,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(if (isBtScannerActive) "Stop BT Scanner" else "BT Scanner")
            }
        }

        if (btScannerInput.isNotBlank()) {
            Spacer(modifier = Modifier.height(8.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.3f)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("Bluetooth Scanner Input", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(btScannerInput, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (scannedBarcode.isNotBlank()) {
            Spacer(modifier = Modifier.height(12.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "Scanned Barcode",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = scannedBarcode,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        if (isLoading) {
            Spacer(modifier = Modifier.height(12.dp))
            Box(
                modifier = Modifier.fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        }

        if (scannedProduct != null) {
            Spacer(modifier = Modifier.height(12.dp))
            ProductResultCard(product = scannedProduct)
        }
    }
}

@Composable
private fun ProductResultCard(product: com.arynoxtech.erp.data.local.ProductEntity) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Inventory,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(32.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = product.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "SKU: ${product.sku}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "\u20B9 ${String.format("%,.2f", product.sellingPrice)}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "Price",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${product.currentStock.toInt()}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = if (product.currentStock <= product.minimumStock)
                            MaterialTheme.colorScheme.error
                        else MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "Stock",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${product.gstRate.toInt()}%",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "GST",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@OptIn(androidx.camera.core.ExperimentalGetImage::class)
@Composable
private fun CameraPreview(
    onBarcodeScanned: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = androidx.lifecycle.compose.LocalLifecycleOwner.current

    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    var previewView by remember { mutableStateOf<PreviewView?>(null) }

    DisposableEffect(lifecycleOwner) {
        onDispose {
            cameraProvider?.unbindAll()
            cameraProvider = null
        }
    }

    AndroidView(
        factory = { ctx ->
            val pv = PreviewView(ctx)
            previewView = pv
            val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)

            cameraProviderFuture.addListener({
                val provider = cameraProviderFuture.get()
                cameraProvider = provider

                val preview = Preview.Builder().build().also {
                    it.surfaceProvider = pv.surfaceProvider
                }

                val scannerOptions = BarcodeScannerOptions.Builder()
                    .setBarcodeFormats(Barcode.FORMAT_ALL_FORMATS)
                    .build()

                val scanner = BarcodeScanning.getClient(scannerOptions)

                val imageAnalysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()

                imageAnalysis.setAnalyzer(Executors.newSingleThreadExecutor()) { imageProxy ->
                    val mediaImage = imageProxy.image
                    if (mediaImage != null) {
                        val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                        scanner.process(inputImage)
                            .addOnSuccessListener { barcodes ->
                                for (barcode in barcodes) {
                                    barcode.rawValue?.let { onBarcodeScanned(it) }
                                }
                            }
                            .addOnCompleteListener { imageProxy.close() }
                    } else {
                        imageProxy.close()
                    }
                }

                try {
                    provider.unbindAll()
                    provider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, imageAnalysis)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }, ContextCompat.getMainExecutor(ctx))

            pv
        },
        modifier = modifier.clip(RoundedCornerShape(16.dp))
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GenerateTab(
    barcodeData: String,
    barcodeFormat: String,
    generatedBitmap: Bitmap?,
    isLoading: Boolean,
    isPrivateBarcode: Boolean,
    onDataChange: (String) -> Unit,
    onFormatChange: (String) -> Unit,
    onGenerate: () -> Unit,
    onPrint: () -> Unit,
    onDownload: () -> Unit,
    onPrivateToggle: (Boolean) -> Unit,
    isConnected: Boolean
) {
    val formats = listOf("CODE128", "EAN13", "EAN8", "UPC", "QR", "CODE39", "DATA_MATRIX", "PDF417", "ITF")
    var expanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        OutlinedTextField(
            value = barcodeData,
            onValueChange = onDataChange,
            label = { Text("Data to encode") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            shape = RoundedCornerShape(12.dp)
        )

        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded }
        ) {
            OutlinedTextField(
                value = barcodeFormat,
                onValueChange = {},
                readOnly = true,
                label = { Text("Format") },
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
                formats.forEach { format ->
                    DropdownMenuItem(
                        text = { Text(format) },
                        onClick = {
                            onFormatChange(format)
                            expanded = false
                        }
                    )
                }
            }
        }

        HorizontalDivider()

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Private Barcode", style = MaterialTheme.typography.bodyLarge)
                Text(
                    text = "Only scannable by this app",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            androidx.compose.material3.Switch(
                checked = isPrivateBarcode,
                onCheckedChange = onPrivateToggle
            )
        }

        if (isPrivateBarcode) {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.3f)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.tertiary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "This barcode is encrypted. Only Aditya Enterprises app can scan and decode it. Standard barcode scanners will see random characters.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Button(
            onClick = onGenerate,
            enabled = barcodeData.isNotBlank() && !isLoading,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            } else {
                Text("Generate Barcode")
            }
        }

        if (generatedBitmap != null) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                shape = RoundedCornerShape(12.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Image(
                        bitmap = generatedBitmap.asImageBitmap(),
                        contentDescription = "Generated barcode",
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(if (barcodeFormat == "QR") 200.dp else 120.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = barcodeData,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = onPrint,
                            enabled = isConnected,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Print,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Print")
                        }
                        OutlinedButton(
                            onClick = onDownload,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Download,
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
    }
}

@Composable
private fun BulkTab() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.Refresh,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Bulk Barcode Generation",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Import a CSV of products and generate barcodes in bulk.\nPrint as PDF labels.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(24.dp))
        OutlinedButton(
            onClick = { /* TODO: File picker */ },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Import CSV")
        }
        Spacer(modifier = Modifier.height(8.dp))
        Button(
            onClick = { /* TODO: Bulk print */ },
            modifier = Modifier.fillMaxWidth(),
            enabled = false
        ) {
            Text("Export as PDF Labels")
        }
    }
}
