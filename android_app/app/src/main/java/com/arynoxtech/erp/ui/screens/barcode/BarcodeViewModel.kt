package com.arynoxtech.erp.ui.screens.barcode

import android.graphics.Bitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.arynoxtech.erp.data.local.ProductEntity
import com.arynoxtech.erp.data.repository.ProductRepository
import com.arynoxtech.erp.service.BarcodeCrypto
import com.arynoxtech.erp.service.BluetoothDeviceInfo
import com.arynoxtech.erp.service.BluetoothPrinterService
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import com.google.zxing.common.BitMatrix
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class BarcodeViewModel @Inject constructor(
    private val productRepo: ProductRepository,
    private val bluetoothService: BluetoothPrinterService
) : ViewModel() {

    data class BarcodeUiState(
        val scannedBarcode: String = "",
        val scannedProduct: ProductEntity? = null,
        val isCameraActive: Boolean = true,
        val connectedDevices: List<BluetoothDeviceInfo> = emptyList(),
        val isConnectedToPrinter: Boolean = false,
        val generatedBarcodeBitmap: Bitmap? = null,
        val barcodeFormat: String = "CODE128",
        val barcodeData: String = "",
        val isPrivateBarcode: Boolean = false,
        val isLoading: Boolean = false,
        val error: String? = null,
        val printSuccess: Boolean = false,
        val selectedTab: Int = 0,
        val btScannerInput: String = "",
        val isBtScannerActive: Boolean = false
    )

    private val _uiState = MutableStateFlow(BarcodeUiState())
    val uiState: StateFlow<BarcodeUiState> = _uiState.asStateFlow()

    private var btScannerJob: Job? = null

    fun onBarcodeScanned(barcode: String) {
        _uiState.update { it.copy(scannedBarcode = barcode, isLoading = true) }
        viewModelScope.launch {
            val decrypted = withContext(Dispatchers.Default) {
                BarcodeCrypto.decrypt(barcode)
            } ?: barcode
            lookupProduct(decrypted)
        }
    }

    private fun lookupProduct(barcode: String) {
        viewModelScope.launch {
            try {
                val product = productRepo.getProductByBarcode(barcode)
                _uiState.update { it.copy(scannedProduct = product, isLoading = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(scannedProduct = null, isLoading = false, error = "Product not found") }
            }
        }
    }

    fun startBtScanner() {
        _uiState.update { it.copy(isBtScannerActive = true) }
        btScannerJob?.cancel()
        btScannerJob = viewModelScope.launch {
            bluetoothService.scanBarcode().collect { raw ->
                _uiState.update { it.copy(btScannerInput = raw) }
                val barcode = withContext(Dispatchers.Default) {
                    BarcodeCrypto.decrypt(raw)
                } ?: raw
                lookupProduct(barcode)
            }
        }
    }

    fun stopBtScanner() {
        btScannerJob?.cancel()
        _uiState.update { it.copy(isBtScannerActive = false, btScannerInput = "") }
    }

    fun generateBarcode(data: String, format: String) {
        if (data.isBlank()) {
            _uiState.update { it.copy(error = "Please enter data to encode") }
            return
        }
        viewModelScope.launch {
            try {
                val encodeData = if (_uiState.value.isPrivateBarcode) {
                    BarcodeCrypto.encrypt(data)
                } else data

                val barcodeFormat = when (format.uppercase()) {
                    "EAN13" -> BarcodeFormat.EAN_13
                    "EAN8" -> BarcodeFormat.EAN_8
                    "UPC" -> BarcodeFormat.UPC_A
                    "QR" -> BarcodeFormat.QR_CODE
                    "CODE128", "CODE_128" -> BarcodeFormat.CODE_128
                    "CODE39" -> BarcodeFormat.CODE_39
                    "DATA_MATRIX" -> BarcodeFormat.DATA_MATRIX
                    "PDF417" -> BarcodeFormat.PDF_417
                    "ITF" -> BarcodeFormat.ITF
                    else -> BarcodeFormat.CODE_128
                }

                val bitmap = withContext(Dispatchers.Default) {
                    val writer = MultiFormatWriter()
                    val bitMatrix: BitMatrix = if (barcodeFormat == BarcodeFormat.QR_CODE) {
                        writer.encode(encodeData, barcodeFormat, 512, 512)
                    } else {
                        writer.encode(encodeData, barcodeFormat, 800, 300)
                    }
                    val width = bitMatrix.width
                    val height = bitMatrix.height
                    Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565).apply {
                        for (x in 0 until width) {
                            for (y in 0 until height) {
                                setPixel(x, y, if (bitMatrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
                            }
                        }
                    }
                }

                _uiState.update { it.copy(generatedBarcodeBitmap = bitmap, error = null) }

                if (_uiState.value.isConnectedToPrinter) {
                    val success = bluetoothService.printBarcode(encodeData, format)
                    _uiState.update { it.copy(printSuccess = success) }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = "Failed to generate barcode: ${e.message}") }
            }
        }
    }

    fun setPrivateBarcode(enabled: Boolean) {
        _uiState.update { it.copy(isPrivateBarcode = enabled) }
        val data = _uiState.value.barcodeData
        if (data.isNotBlank()) {
            generateBarcode(data, _uiState.value.barcodeFormat)
        }
    }

    fun printBarcode(data: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val format = _uiState.value.barcodeFormat
                val success = bluetoothService.printBarcode(data, format)
                _uiState.update { it.copy(isLoading = false, printSuccess = success, error = if (!success) "Print failed. Check printer connection." else null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Print error: ${e.message}") }
            }
        }
    }

    fun downloadBarcode() { _uiState.update { it.copy(error = null) } }

    fun discoverDevices() {
        viewModelScope.launch {
            bluetoothService.discoverDevices().collect { devices ->
                _uiState.update { it.copy(connectedDevices = devices) }
            }
        }
    }

    fun connectToDevice(device: BluetoothDeviceInfo) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val success = bluetoothService.connectToDevice(device)
            _uiState.update { it.copy(isConnectedToPrinter = success, isLoading = false, error = if (!success) "Failed to connect to ${device.name}" else null) }
            if (success) discoverDevices()
        }
    }

    fun disconnectDevice() {
        viewModelScope.launch {
            bluetoothService.disconnect()
            _uiState.update { it.copy(isConnectedToPrinter = false) }
        }
    }

    fun setBarcodeFormat(format: String) {
        _uiState.update { it.copy(barcodeFormat = format) }
        val data = _uiState.value.barcodeData
        if (data.isNotBlank()) generateBarcode(data, format)
    }

    fun setBarcodeData(data: String) { _uiState.update { it.copy(barcodeData = data) } }
    fun selectTab(tab: Int) { _uiState.update { it.copy(selectedTab = tab) } }
    fun clearError() { _uiState.update { it.copy(error = null) } }
    fun clearPrintSuccess() { _uiState.update { it.copy(printSuccess = false) } }
}
