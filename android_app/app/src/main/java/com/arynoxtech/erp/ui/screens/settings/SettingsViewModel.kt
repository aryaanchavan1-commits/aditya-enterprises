package com.arynoxtech.erp.ui.screens.settings

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.arynoxtech.erp.data.local.datastore.AppSettings
import com.arynoxtech.erp.data.local.datastore.SettingsDataStore
import com.arynoxtech.erp.data.local.ProductDao
import com.arynoxtech.erp.data.local.PurchaseDao
import com.arynoxtech.erp.data.local.SaleDao
import com.arynoxtech.erp.service.BluetoothDeviceInfo
import com.arynoxtech.erp.service.BluetoothPrinterService
import com.arynoxtech.erp.service.GroqAiService
import com.arynoxtech.erp.service.ImportExportService
import com.arynoxtech.erp.service.SyncService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsDataStore: SettingsDataStore,
    private val bluetoothService: BluetoothPrinterService,
    private val groqAiService: GroqAiService,
    private val syncService: SyncService,
    private val importExportService: ImportExportService,
    private val productDao: ProductDao,
    private val saleDao: SaleDao,
    private val purchaseDao: PurchaseDao
) : ViewModel() {

    data class SettingsUiState(
        val appPassword: String = "",
        val isPasswordEnabled: Boolean = false,
        val isUnlocked: Boolean = false,
        val isInitialLoading: Boolean = true,
        val companyName: String = "Aditya Enterprises",
        val companyAddress: String = "",
        val companyPhone: String = "",
        val companyEmail: String = "",
        val companyGstin: String = "",
        val companyPan: String = "",
        val bankName: String = "",
        val bankAccount: String = "",
        val ifscCode: String = "",
        val upiId: String = "",
        val availableDevices: List<BluetoothDeviceInfo> = emptyList(),
        val connectedDevice: BluetoothDeviceInfo? = null,
        val defaultGstRate: Double = 18.0,
        val isSyncConfigured: Boolean = true,
        val isSyncEnabled: Boolean = false,
        val lastSyncTime: String = "Never",
        val syncStatus: String = "",
        val groqApiKey: String = "",
        val isAiEnabled: Boolean = true,
        val themeMode: String = "system",
        val language: String = "en",
        val isLoading: Boolean = false,
        val isSaving: Boolean = false,
        val error: String? = null,
        val successMessage: String? = null,
        val fatalError: String? = null,
        val tursoUrl: String = "",
        val tursoAuthToken: String = ""
    )

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        try {
            loadSettings()
        } catch (e: Exception) {
            _uiState.update { it.copy(
                isInitialLoading = false,
                fatalError = "Startup error: ${e.message}"
            ) }
        }
    }

    fun unlock(password: String) {
        val saved = _uiState.value.appPassword
        if (saved.isNotBlank() && password == saved) {
            _uiState.update { it.copy(isUnlocked = true, error = null) }
        } else if (saved.isBlank()) {
            _uiState.update { it.copy(isUnlocked = true, error = null) }
        } else {
            _uiState.update { it.copy(error = "Incorrect password") }
        }
    }

    fun lock() {
        _uiState.update { it.copy(isUnlocked = false) }
    }

    fun loadSettings() {
        viewModelScope.launch {
            settingsDataStore.settings.collect { settings ->
                _uiState.update { it.copy(
                    appPassword = settings.appPassword,
                    isPasswordEnabled = settings.isPasswordEnabled,
                    isUnlocked = !settings.isPasswordEnabled,
                    isInitialLoading = false,
                    companyName = settings.companyName,
                    companyAddress = settings.companyAddress,
                    companyPhone = settings.companyPhone,
                    companyEmail = settings.companyEmail,
                    companyGstin = settings.companyGstin,
                    companyPan = settings.companyPan,
                    bankName = settings.bankName,
                    bankAccount = settings.bankAccount,
                    ifscCode = settings.ifscCode,
                    upiId = settings.upiId,
                    defaultGstRate = settings.defaultGstRate,
                    isSyncConfigured = syncService.isSyncConfigured(),
                    isSyncEnabled = settings.isSyncEnabled,
                    lastSyncTime = syncService.lastSyncTime()?.let {
                        SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault()).format(Date(it))
                    } ?: "Never",
                    groqApiKey = settings.groqApiKey,
                    isAiEnabled = settings.isAiEnabled,
                    themeMode = settings.themeMode,
                    language = settings.language,
                    tursoUrl = settings.tursoUrl,
                    tursoAuthToken = settings.tursoAuthToken
                ) }
                syncService.configureFromSettings()
                groqAiService.setApiKey(settings.groqApiKey)
            }
        }
    }

    fun saveCompanyDetails(name: String, address: String, phone: String, email: String, gstin: String, pan: String) {
        _uiState.update { it.copy(isSaving = true) }
        settingsDataStore.update { it.copy(
            companyName = name,
            companyAddress = address,
            companyPhone = phone,
            companyEmail = email,
            companyGstin = gstin.uppercase(),
            companyPan = pan.uppercase()
        ) }
        _uiState.update { it.copy(
            isSaving = false,
            successMessage = "Company details saved"
        ) }
    }

    fun saveBankDetails(name: String, account: String, ifsc: String, upi: String) {
        _uiState.update { it.copy(isSaving = true) }
        settingsDataStore.update { it.copy(
            bankName = name,
            bankAccount = account,
            ifscCode = ifsc.uppercase(),
            upiId = upi
        ) }
        _uiState.update { it.copy(
            isSaving = false,
            successMessage = "Bank details saved"
        ) }
    }

    fun setAppPassword(password: String, enable: Boolean) {
        settingsDataStore.update { it.copy(
            appPassword = if (enable) password else "",
            isPasswordEnabled = enable
        ) }
        _uiState.update { it.copy(
            successMessage = if (enable) "App password enabled" else "App password disabled"
        ) }
    }

    fun setDefaultGstRate(rate: Double) {
        settingsDataStore.update { it.copy(defaultGstRate = rate) }
        _uiState.update { it.copy(
            defaultGstRate = rate,
            successMessage = "Default GST rate set to $rate%"
        ) }
    }

    fun setGroqApiKey(key: String) {
        settingsDataStore.update { it.copy(groqApiKey = key) }
        groqAiService.setApiKey(key)
        _uiState.update { it.copy(successMessage = "API key saved") }
    }

    fun setAiEnabled(enabled: Boolean) {
        settingsDataStore.update { it.copy(isAiEnabled = enabled) }
        _uiState.update { it.copy(isAiEnabled = enabled) }
    }

    fun setThemeMode(mode: String) {
        settingsDataStore.update { it.copy(themeMode = mode) }
        _uiState.update { it.copy(themeMode = mode) }
    }

    fun discoverDevices() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            bluetoothService.discoverDevices().collect { devices ->
                _uiState.update { it.copy(
                    availableDevices = devices,
                    isLoading = false,
                    connectedDevice = bluetoothService.getConnectedDevices().firstOrNull()
                ) }
            }
        }
    }

    fun connectToDevice(device: BluetoothDeviceInfo) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val success = bluetoothService.connectToDevice(device)
            _uiState.update { it.copy(
                isLoading = false,
                connectedDevice = if (success) device else null,
                error = if (!success) "Failed to connect to ${device.name}" else null,
                successMessage = if (success) "Connected to ${device.name}" else null
            ) }
        }
    }

    fun disconnectDevice() {
        viewModelScope.launch {
            bluetoothService.disconnect()
            _uiState.update { it.copy(
                connectedDevice = null,
                successMessage = "Disconnected"
            ) }
        }
    }

    fun saveTursoCredentials(url: String, token: String) {
        _uiState.update { it.copy(isSaving = true) }
        settingsDataStore.update { it.copy(tursoUrl = url, tursoAuthToken = token) }
        viewModelScope.launch {
            syncService.configureFromSettings()
            syncService.syncAllWithPush()
        }
        _uiState.update {
            it.copy(
                isSaving = false,
                tursoUrl = url,
                tursoAuthToken = token,
                successMessage = "Database credentials saved, sync started"
            )
        }
    }

    fun testSyncConnection() {
        viewModelScope.launch {
            _uiState.update { it.copy(syncStatus = "Testing") }
            try {
                val result = syncService.syncProducts()
                if (result.isSuccess) {
                    _uiState.update { it.copy(
                        syncStatus = "Connected",
                        successMessage = "Connection successful"
                    ) }
                } else {
                    _uiState.update { it.copy(
                        syncStatus = "Disconnected",
                        error = result.exceptionOrNull()?.message ?: "Connection failed"
                    ) }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(
                    syncStatus = "Disconnected",
                    error = e.message
                ) }
            }
        }
    }

    fun toggleAutoSync(enabled: Boolean) {
        settingsDataStore.update { it.copy(isSyncEnabled = enabled) }
        _uiState.update { it.copy(isSyncEnabled = enabled) }
    }

    fun syncNow() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = syncService.syncAll()
            _uiState.update { it.copy(
                isLoading = false,
                lastSyncTime = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
                    .format(Date()),
                successMessage = if (result.isSuccess) "Sync complete: ${result.getOrNull()?.message}"
                else "Sync failed: ${result.exceptionOrNull()?.message}",
                error = if (result.isFailure) result.exceptionOrNull()?.message else null
            ) }
        }
    }

    fun updateInputField(
        companyName: String? = null,
        companyAddress: String? = null,
        companyPhone: String? = null,
        companyEmail: String? = null,
        companyGstin: String? = null,
        companyPan: String? = null,
        bankName: String? = null,
        bankAccount: String? = null,
        ifscCode: String? = null,
        upiId: String? = null,
        groqApiKey: String? = null
    ) {
        _uiState.update { state ->
            state.copy(
                companyName = companyName ?: state.companyName,
                companyAddress = companyAddress ?: state.companyAddress,
                companyPhone = companyPhone ?: state.companyPhone,
                companyEmail = companyEmail ?: state.companyEmail,
                companyGstin = companyGstin ?: state.companyGstin,
                companyPan = companyPan ?: state.companyPan,
                bankName = bankName ?: state.bankName,
                bankAccount = bankAccount ?: state.bankAccount,
                ifscCode = ifscCode ?: state.ifscCode,
                upiId = upiId ?: state.upiId,
                groqApiKey = groqApiKey ?: state.groqApiKey
            )
        }
    }

    fun setLanguage(lang: String) {
        settingsDataStore.update { it.copy(language = lang) }
        _uiState.update { it.copy(language = lang, successMessage = "Language updated") }
    }

    fun exportData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = importExportService.exportAllData()
            result.onSuccess { uri ->
                importExportService.shareFile(uri)
                _uiState.update { it.copy(isLoading = false, successMessage = "Data exported successfully") }
            }.onFailure { e ->
                _uiState.update { it.copy(isLoading = false, error = "Export failed: ${e.message}") }
            }
        }
    }

    fun importData(uri: Uri) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = importExportService.importFromUri(uri)
            result.onSuccess { msg ->
                _uiState.update { it.copy(isLoading = false, successMessage = msg) }
            }.onFailure { e ->
                _uiState.update { it.copy(isLoading = false, error = "Import failed: ${e.message}") }
            }
        }
    }

    fun clearAllData() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                productDao.clearAll()
                saleDao.clearAll()
                purchaseDao.clearAll()
                withContext(Dispatchers.Main) {
                    _uiState.update { it.copy(successMessage = "All local data cleared") }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    _uiState.update { it.copy(error = "Clear failed: ${e.message}") }
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun clearSuccess() {
        _uiState.update { it.copy(successMessage = null) }
    }
}
