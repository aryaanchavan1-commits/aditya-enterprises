package com.arynoxtech.erp.ui.screens.purchase

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.arynoxtech.erp.data.local.PurchaseEntity
import com.arynoxtech.erp.data.local.PurchaseItemEntity
import com.arynoxtech.erp.data.local.SupplierEntity
import com.arynoxtech.erp.data.repository.ProductRepository
import com.arynoxtech.erp.data.repository.PurchaseRepository
import com.arynoxtech.erp.data.repository.SupplierRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import javax.inject.Inject

data class PurchaseListItem(
    val id: String,
    val purchaseNumber: String,
    val supplierName: String,
    val orderDate: Long,
    val totalAmount: Double,
    val status: String
)

data class PurchaseFormItem(
    val id: String = UUID.randomUUID().toString(),
    val productId: String = "",
    val productName: String = "",
    val quantity: Int = 1,
    val unitPrice: Double = 0.0,
    val sellingPrice: Double = 0.0,
    val moveToInventory: Boolean = false
) {
    val subtotal: Double get() = quantity * unitPrice
}

data class PurchaseDetailItem(
    val productName: String,
    val quantity: Double,
    val unitPrice: Double,
    val totalAmount: Double
)

@HiltViewModel
class PurchaseViewModel @Inject constructor(
    private val purchaseRepo: PurchaseRepository,
    private val supplierRepo: SupplierRepository,
    private val productRepo: ProductRepository
) : ViewModel() {

    data class PurchaseListUiState(
        val purchases: List<PurchaseListItem> = emptyList(),
        val searchQuery: String = "",
        val statusFilter: String? = null,
        val isLoading: Boolean = true,
        val error: String? = null
    )

    data class PurchaseFormUiState(
        val purchaseId: String? = null,
        val supplierId: String? = null,
        val supplierName: String = "",
        val supplierPhone: String = "",
        val supplierGst: String = "",
        val orderDate: Long = System.currentTimeMillis(),
        val notes: String = "",
        val items: List<PurchaseFormItem> = emptyList(),
        val suppliers: List<SupplierEntity> = emptyList(),
        val moveToInventory: Boolean = false,
        val isSaving: Boolean = false,
        val error: String? = null,
        val success: Boolean = false
    )

    data class PurchaseDetailUiState(
        val id: String = "",
        val purchaseNumber: String = "",
        val supplierName: String = "",
        val supplierPhone: String = "",
        val supplierGst: String = "",
        val orderDate: Long = 0L,
        val subtotal: Double = 0.0,
        val totalAmount: Double = 0.0,
        val status: String = "",
        val notes: String = "",
        val items: List<PurchaseDetailItem> = emptyList(),
        val isLoading: Boolean = true,
        val error: String? = null
    )

    private val _listState = MutableStateFlow(PurchaseListUiState())
    val listState: StateFlow<PurchaseListUiState> = _listState.asStateFlow()

    private val _formState = MutableStateFlow(PurchaseFormUiState())
    val formState: StateFlow<PurchaseFormUiState> = _formState.asStateFlow()

    private val _detailState = MutableStateFlow(PurchaseDetailUiState())
    val detailState: StateFlow<PurchaseDetailUiState> = _detailState.asStateFlow()

    private val _totalAmount = MutableStateFlow(0.0)
    val totalAmount: StateFlow<Double> = _totalAmount.asStateFlow()

    private val _products = MutableStateFlow<List<com.arynoxtech.erp.data.local.ProductEntity>>(emptyList())
    val products: StateFlow<List<com.arynoxtech.erp.data.local.ProductEntity>> = _products.asStateFlow()

    private var allPurchases: List<PurchaseEntity> = emptyList()

    init {
        observePurchases()
    }

    private fun observePurchases() {
        viewModelScope.launch {
            purchaseRepo.getPurchases()
                .catch { e ->
                    _listState.update { it.copy(isLoading = false, error = e.message) }
                }
                .collect { entities ->
                    allPurchases = entities
                    applyFilters()
                }
        }
    }

    private fun applyFilters() {
        val state = _listState.value
        val filtered = allPurchases
            .filter { entity ->
                val matchesSearch = state.searchQuery.isBlank() ||
                        entity.purchaseNumber.contains(state.searchQuery, ignoreCase = true) ||
                        entity.supplierName.contains(state.searchQuery, ignoreCase = true)
                val matchesStatus = state.statusFilter == null ||
                        state.statusFilter == "All" ||
                        entity.status.equals(state.statusFilter, ignoreCase = true)
                matchesSearch && matchesStatus
            }
            .map { entity ->
                PurchaseListItem(
                    id = entity.id,
                    purchaseNumber = entity.purchaseNumber,
                    supplierName = entity.supplierName,
                    orderDate = entity.purchaseDate,
                    totalAmount = entity.totalAmount,
                    status = entity.status
                )
            }
        _listState.update { it.copy(purchases = filtered, isLoading = false, error = null) }
    }

    fun search(query: String) {
        _listState.update { it.copy(searchQuery = query) }
        applyFilters()
    }

    fun filterByStatus(status: String?) {
        _listState.update { it.copy(statusFilter = status) }
        applyFilters()
    }

    fun refresh() {
        viewModelScope.launch {
            _listState.update { it.copy(isLoading = true) }
            purchaseRepo.refreshFromRemote()
        }
    }

    fun deletePurchase(id: String) {
        viewModelScope.launch {
            purchaseRepo.deletePurchase(id)
        }
    }

    fun loadSuppliers() {
        viewModelScope.launch {
            supplierRepo.getSuppliers().collect { suppliers ->
                _formState.update { it.copy(suppliers = suppliers) }
            }
        }
    }

    fun updateSupplier(name: String, phone: String, gst: String) {
        _formState.update {
            it.copy(supplierName = name, supplierPhone = phone, supplierGst = gst)
        }
    }

    fun selectSupplier(supplier: SupplierEntity) {
        _formState.update {
            it.copy(
                supplierId = supplier.id,
                supplierName = supplier.name,
                supplierPhone = supplier.phone,
                supplierGst = supplier.gstin
            )
        }
    }

    fun updateOrderDate(date: Long) {
        _formState.update { it.copy(orderDate = date) }
    }

    fun updateNotes(notes: String) {
        _formState.update { it.copy(notes = notes) }
    }

    fun addItem(item: PurchaseFormItem) {
        _formState.update { state ->
            val exists = state.items.any { it.productId == item.productId }
            if (exists) state
            else state.copy(items = state.items + item)
        }
        recalculateTotal()
    }

    fun updateItemQuantity(itemId: String, quantity: Int) {
        _formState.update { state ->
            state.copy(
                items = state.items.map {
                    if (it.id == itemId) it.copy(quantity = maxOf(1, quantity))
                    else it
                }
            )
        }
        recalculateTotal()
    }

    fun updateItemSellingPrice(itemId: String, price: Double) {
        _formState.update { state ->
            state.copy(
                items = state.items.map {
                    if (it.id == itemId) it.copy(sellingPrice = maxOf(0.0, price))
                    else it
                }
            )
        }
    }

    fun updateItemMoveToInventory(itemId: String, move: Boolean) {
        _formState.update { state ->
            state.copy(
                items = state.items.map {
                    if (it.id == itemId) it.copy(moveToInventory = move)
                    else it
                }
            )
        }
    }

    fun setMoveToInventory(move: Boolean) {
        _formState.update { it.copy(moveToInventory = move) }
    }

    fun removeItem(itemId: String) {
        _formState.update { state ->
            state.copy(items = state.items.filter { it.id != itemId })
        }
        recalculateTotal()
    }

    private fun recalculateTotal() {
        val total = _formState.value.items.sumOf { it.subtotal }
        _totalAmount.value = total
    }

    fun savePurchase(onSuccess: () -> Unit) {
        val state = _formState.value
        if (state.items.isEmpty()) {
            _formState.update { it.copy(error = "Add at least one item") }
            return
        }
        if (state.supplierName.isBlank()) {
            _formState.update { it.copy(error = "Supplier name is required") }
            return
        }

        viewModelScope.launch {
            _formState.update { it.copy(isSaving = true, error = null) }

            val purchaseId = state.purchaseId ?: UUID.randomUUID().toString()
            val purchaseNumber = state.purchaseId?.let {
                allPurchases.find { p -> p.id == it }?.purchaseNumber
            } ?: generatePurchaseNumber()

            val entity = PurchaseEntity(
                id = purchaseId,
                purchaseNumber = purchaseNumber,
                supplierId = state.supplierId,
                supplierName = state.supplierName,
                purchaseDate = state.orderDate,
                subtotal = state.items.sumOf { it.subtotal },
                discountAmount = 0.0,
                taxAmount = 0.0,
                shippingCost = 0.0,
                otherCharges = 0.0,
                totalAmount = state.items.sumOf { it.subtotal },
                paidAmount = 0.0,
                balanceAmount = state.items.sumOf { it.subtotal },
                paymentStatus = "pending",
                status = "ordered",
                notes = state.notes,
                createdAt = System.currentTimeMillis()
            )

            val itemEntities = state.items.map { item ->
                PurchaseItemEntity(
                    id = UUID.randomUUID().toString(),
                    purchaseId = purchaseId,
                    productId = item.productId,
                    productName = item.productName,
                    quantity = item.quantity.toDouble(),
                    unitPrice = item.unitPrice,
                    discount = 0.0,
                    taxAmount = 0.0,
                    totalAmount = item.subtotal,
                    receivedQuantity = 0.0
                )
            }

            val result = purchaseRepo.createPurchase(entity, itemEntities)
            result.fold(
                onSuccess = {
                    if (state.moveToInventory) {
                        state.items.forEach { item ->
                            if (item.moveToInventory) {
                                val existing = productRepo.getProductByBarcode("AE${item.productName.takeLast(10).uppercase()}")
                                if (existing != null) {
                                    val updated = existing.copy(
                                        currentStock = existing.currentStock + item.quantity,
                                        sellingPrice = if (item.sellingPrice > 0) item.sellingPrice else existing.sellingPrice,
                                        purchasePrice = item.unitPrice,
                                        updatedAt = System.currentTimeMillis()
                                    )
                                    productRepo.updateProduct(updated)
                                } else {
                                    val newProduct = com.arynoxtech.erp.data.local.ProductEntity(
                                        id = UUID.randomUUID().toString(),
                                        name = item.productName,
                                        sku = "SKU-${UUID.randomUUID().toString().take(8).uppercase()}",
                                        barcode = "AE${item.productName.takeLast(10).uppercase()}",
                                        purchasePrice = item.unitPrice,
                                        sellingPrice = if (item.sellingPrice > 0) item.sellingPrice else item.unitPrice * 1.2,
                                        currentStock = item.quantity.toDouble(),
                                        openingStock = item.quantity.toDouble(),
                                        minimumStock = 1.0,
                                        maximumStock = 100.0,
                                        gstRate = 18.0,
                                        isActive = true,
                                        createdAt = System.currentTimeMillis(),
                                        updatedAt = System.currentTimeMillis()
                                    )
                                    productRepo.addProduct(newProduct)
                                }
                            }
                        }
                    }
                    _formState.update { it.copy(isSaving = false, success = true, error = null) }
                    onSuccess()
                },
                onFailure = { e ->
                    _formState.update { it.copy(isSaving = false, error = e.message ?: "Save failed") }
                }
            )
        }
    }

    fun loadForEdit(id: String) {
        viewModelScope.launch {
            purchaseRepo.getPurchaseWithItems(id).collect { pair ->
                if (pair != null) {
                    val (purchase, items) = pair
                    _formState.update {
                        it.copy(
                            purchaseId = purchase.id,
                            supplierId = purchase.supplierId,
                            supplierName = purchase.supplierName,
                            orderDate = purchase.purchaseDate,
                            notes = purchase.notes,
                            items = items.map { item ->
                                PurchaseFormItem(
                                    id = item.id,
                                    productId = item.productId,
                                    productName = item.productName,
                                    quantity = item.quantity.toInt(),
                                    unitPrice = item.unitPrice,
                                    sellingPrice = 0.0,
                                    moveToInventory = false
                                )
                            }
                        )
                    }
                    recalculateTotal()
                }
            }
        }
    }

    fun loadPurchase(id: String) {
        viewModelScope.launch {
            _detailState.update { it.copy(isLoading = true, error = null) }
            purchaseRepo.getPurchaseWithItems(id).collect { pair ->
                if (pair != null) {
                    val (purchase, items) = pair
                    _detailState.update {
                        it.copy(
                            id = purchase.id,
                            purchaseNumber = purchase.purchaseNumber,
                            supplierName = purchase.supplierName,
                            orderDate = purchase.purchaseDate,
                            subtotal = purchase.subtotal,
                            totalAmount = purchase.totalAmount,
                            status = purchase.status,
                            notes = purchase.notes,
                            items = items.map { item ->
                                PurchaseDetailItem(
                                    productName = item.productName,
                                    quantity = item.quantity,
                                    unitPrice = item.unitPrice,
                                    totalAmount = item.totalAmount
                                )
                            },
                            isLoading = false,
                            error = null
                        )
                    }
                } else {
                    _detailState.update {
                        it.copy(isLoading = false, error = "Purchase not found")
                    }
                }
            }
        }
    }

    fun loadDetailSupplierInfo() {
        val detail = _detailState.value
        viewModelScope.launch {
            supplierRepo.searchSuppliers(detail.supplierName).collect { suppliers ->
                val supplier = suppliers.firstOrNull()
                if (supplier != null) {
                    _detailState.update {
                        it.copy(supplierPhone = supplier.phone, supplierGst = supplier.gstin)
                    }
                }
            }
        }
    }

    fun updateStatus(id: String, status: String) {
        viewModelScope.launch {
            val purchase = purchaseRepo.getPurchaseWithItems(id)
            purchase.collect { pair ->
                if (pair != null) {
                    val (purchase, _) = pair
                    val updated = purchase.copy(status = status)
                    purchaseRepo.updatePurchase(updated)
                    _detailState.update { it.copy(status = status) }
                }
            }
        }
    }

    fun resetForm() {
        _formState.value = PurchaseFormUiState()
        _totalAmount.value = 0.0
    }

    fun clearError() {
        _formState.update { it.copy(error = null) }
    }

    fun searchProducts(query: String) {
        viewModelScope.launch {
            if (query.isBlank()) {
                _products.value = emptyList()
                return@launch
            }
            productRepo.searchProducts(query).collect { result ->
                _products.value = result
            }
        }
    }

    fun clearSuccess() {
        _formState.update { it.copy(success = false) }
    }

    private fun generatePurchaseNumber(): String {
        val datePart = SimpleDateFormat("yyMMdd", Locale.getDefault()).format(Date())
        val random = (1000..9999).random()
        return "PO-$datePart-$random"
    }
}
