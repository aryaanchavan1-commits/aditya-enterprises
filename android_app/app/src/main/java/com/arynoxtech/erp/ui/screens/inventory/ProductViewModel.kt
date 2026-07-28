package com.arynoxtech.erp.ui.screens.inventory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.arynoxtech.erp.data.local.BrandDao
import com.arynoxtech.erp.data.local.BrandEntity
import com.arynoxtech.erp.data.local.CategoryDao
import com.arynoxtech.erp.data.local.CategoryEntity
import com.arynoxtech.erp.data.local.ProductEntity
import com.arynoxtech.erp.data.local.StockMovementEntity
import com.arynoxtech.erp.data.repository.ProductRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class ProductFormState(
    val id: String = "",
    val name: String = "",
    val sku: String = "",
    val hsnCode: String = "",
    val description: String = "",
    val category: String = "",
    val brand: String = "",
    val unit: String = "PCS",
    val purchasePrice: String = "",
    val sellingPrice: String = "",
    val mrp: String = "",
    val gstRate: Double = 18.0,
    val discount: String = "0",
    val currentStock: String = "0",
    val openingStock: String = "0",
    val minimumStock: String = "10",
    val maximumStock: String = "100",
    val warehouse: String = "",
    val supplier: String = "",
    val location: String = "",
    val barcode: String = "",
    val batchNumber: String = "",
    val notes: String = "",
    val images: String = "",
    val hasWarranty: Boolean = false,
    val warrantyPeriod: String = "1 Year",
    val warrantyStartDate: Long? = null,
    val warrantyEndDate: Long? = null,
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val error: String? = null,
    val success: Boolean = false
)

data class ProductDetailState(
    val product: ProductEntity? = null,
    val stockMovements: List<StockMovementEntity> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null
)

data class ProductMetaState(
    val categories: List<String> = emptyList(),
    val brands: List<String> = emptyList()
)

@HiltViewModel
class ProductViewModel @Inject constructor(
    private val productRepo: ProductRepository,
    private val categoryDao: CategoryDao,
    private val brandDao: BrandDao
) : ViewModel() {

    private val _formState = MutableStateFlow(ProductFormState())
    val formState: StateFlow<ProductFormState> = _formState.asStateFlow()

    private val _detailState = MutableStateFlow(ProductDetailState())
    val detailState: StateFlow<ProductDetailState> = _detailState.asStateFlow()

    private val _metaState = MutableStateFlow(ProductMetaState())
    val metaState: StateFlow<ProductMetaState> = _metaState.asStateFlow()

    init {
        loadMetaData()
    }

    private fun loadMetaData() {
        viewModelScope.launch {
            combine(
                categoryDao.getAll(),
                brandDao.getAll()
            ) { categories, brands ->
                ProductMetaState(
                    categories = categories.map { it.name }.filter { it.isNotBlank() }.sorted(),
                    brands = brands.map { it.name }.filter { it.isNotBlank() }.sorted()
                )
            }.collect { meta ->
                _metaState.value = meta
            }
        }
    }

    fun addCategory(name: String) {
        viewModelScope.launch {
            val id = UUID.randomUUID().toString()
            categoryDao.insert(CategoryEntity(id = id, name = name, description = ""))
            _formState.update { it.copy(category = name) }
        }
    }

    fun addBrand(name: String) {
        viewModelScope.launch {
            val id = UUID.randomUUID().toString()
            brandDao.insert(BrandEntity(id = id, name = name, description = ""))
            _formState.update { it.copy(brand = name) }
        }
    }

    fun updateField(field: String, value: Any) {
        _formState.update { current ->
            when (field) {
                "name" -> current.copy(name = value as String)
                "sku" -> current.copy(sku = value as String)
                "hsnCode" -> current.copy(hsnCode = value as String)
                "description" -> current.copy(description = value as String)
                "category" -> current.copy(category = value as String)
                "brand" -> current.copy(brand = value as String)
                "unit" -> current.copy(unit = value as String)
                "purchasePrice" -> current.copy(purchasePrice = value as String)
                "sellingPrice" -> current.copy(sellingPrice = value as String)
                "mrp" -> current.copy(mrp = value as String)
                "gstRate" -> current.copy(gstRate = value as Double)
                "discount" -> current.copy(discount = value as String)
                "currentStock" -> current.copy(currentStock = value as String)
                "openingStock" -> current.copy(openingStock = value as String)
                "minimumStock" -> current.copy(minimumStock = value as String)
                "maximumStock" -> current.copy(maximumStock = value as String)
                "warehouse" -> current.copy(warehouse = value as String)
                "supplier" -> current.copy(supplier = value as String)
                "location" -> current.copy(location = value as String)
                "barcode" -> current.copy(barcode = value as String)
                "batchNumber" -> current.copy(batchNumber = value as String)
                "notes" -> current.copy(notes = value as String)
                "hasWarranty" -> current.copy(hasWarranty = value as Boolean)
                "warrantyPeriod" -> {
                    val period = value as String
                    val endDate = current.warrantyStartDate?.let { start ->
                        calculateWarrantyEnd(start, period)
                    }
                    current.copy(warrantyPeriod = period, warrantyEndDate = endDate)
                }
                "warrantyStartDate" -> {
                    val start = value as Long
                    val end = calculateWarrantyEnd(start, current.warrantyPeriod)
                    current.copy(warrantyStartDate = start, warrantyEndDate = end)
                }
                else -> current
            }
        }
    }

    private fun calculateWarrantyEnd(startDate: Long, period: String): Long {
        val calendar = java.util.Calendar.getInstance().apply { timeInMillis = startDate }
        when (period) {
            "6 Months" -> calendar.add(java.util.Calendar.MONTH, 6)
            "1 Year" -> calendar.add(java.util.Calendar.YEAR, 1)
            "2 Years" -> calendar.add(java.util.Calendar.YEAR, 2)
            "3 Years" -> calendar.add(java.util.Calendar.YEAR, 3)
            "5 Years" -> calendar.add(java.util.Calendar.YEAR, 5)
            "Lifetime" -> calendar.add(java.util.Calendar.YEAR, 50)
        }
        return calendar.timeInMillis
    }

    fun validateForm(): Boolean {
        val state = _formState.value
        if (state.name.isBlank()) {
            _formState.update { it.copy(error = "Product name is required") }
            return false
        }
        if (state.sellingPrice.isBlank() || state.sellingPrice.toDoubleOrNull() == null) {
            _formState.update { it.copy(error = "Valid selling price is required") }
            return false
        }
        if (state.purchasePrice.isBlank()) {
            _formState.update { it.copy(error = "Purchase price is required") }
            return false
        }
        return true
    }

    fun saveProduct(onSuccess: () -> Unit) {
        if (!validateForm()) return

        viewModelScope.launch {
            _formState.update { it.copy(isSaving = true, error = null) }
            val state = _formState.value

            val warrantyInfo = if (state.hasWarranty && state.warrantyStartDate != null) {
                "Warranty: ${state.warrantyPeriod} | Start: ${state.warrantyStartDate} | End: ${state.warrantyEndDate}"
            } else ""

            val fullNotes = buildString {
                append(state.notes)
                if (warrantyInfo.isNotBlank()) {
                    if (isNotEmpty()) append("\n")
                    append(warrantyInfo)
                }
            }

            val productId = state.id.ifBlank { UUID.randomUUID().toString() }
            val sku = state.sku.ifBlank { generateSkuInternal() }
            val barcode = state.barcode.ifBlank {
                "AE${sku.takeLast(10).uppercase()}"
            }

            val product = ProductEntity(
                id = productId,
                name = state.name,
                sku = sku,
                hsnCode = state.hsnCode,
                barcode = barcode,
                description = state.description,
                category = state.category,
                subCategory = "",
                brand = state.brand,
                unit = state.unit,
                purchasePrice = state.purchasePrice.toDoubleOrNull() ?: 0.0,
                sellingPrice = state.sellingPrice.toDoubleOrNull() ?: 0.0,
                mrp = state.mrp.toDoubleOrNull() ?: 0.0,
                discount = state.discount.toDoubleOrNull() ?: 0.0,
                tax = state.gstRate,
                gstRate = state.gstRate,
                minimumStock = state.minimumStock.toDoubleOrNull() ?: 0.0,
                maximumStock = state.maximumStock.toDoubleOrNull() ?: 0.0,
                openingStock = state.openingStock.toDoubleOrNull() ?: 0.0,
                currentStock = state.currentStock.toDoubleOrNull() ?: 0.0,
                warehouse = state.warehouse,
                supplier = state.supplier,
                location = state.location,
                batchNumber = state.batchNumber,
                notes = fullNotes,
                images = state.images,
                isActive = true,
                createdAt = if (state.id.isBlank()) System.currentTimeMillis() else 0L,
                updatedAt = System.currentTimeMillis()
            )

            try {
                val result = if (state.id.isBlank()) {
                    productRepo.addProduct(product.copy(createdAt = System.currentTimeMillis()))
                } else {
                    productRepo.updateProduct(product)
                }
                if (result.isSuccess) {
                    _formState.update { it.copy(isSaving = false, success = true) }
                    onSuccess()
                } else {
                    _formState.update { it.copy(isSaving = false, error = result.exceptionOrNull()?.message ?: "Failed to save product") }
                }
            } catch (e: Exception) {
                _formState.update { it.copy(isSaving = false, error = e.message ?: "Failed to save product") }
            }
        }
    }

    fun loadProduct(id: String) {
        viewModelScope.launch {
            _detailState.update { it.copy(isLoading = true) }
            productRepo.getProduct(id).collect { product ->
                if (product != null) {
                    _formState.update {
                        ProductFormState(
                            id = product.id,
                            name = product.name,
                            sku = product.sku,
                            hsnCode = product.hsnCode,
                            description = product.description,
                            category = product.category,
                            brand = product.brand,
                            unit = product.unit.ifBlank { "PCS" },
                            purchasePrice = if (product.purchasePrice > 0) product.purchasePrice.toString() else "",
                            sellingPrice = if (product.sellingPrice > 0) product.sellingPrice.toString() else "",
                            mrp = if (product.mrp > 0) product.mrp.toString() else "",
                            gstRate = product.gstRate,
                            discount = product.discount.toString(),
                            currentStock = product.currentStock.toInt().toString(),
                            openingStock = product.openingStock.toInt().toString(),
                            minimumStock = product.minimumStock.toInt().toString(),
                            maximumStock = product.maximumStock.toInt().toString(),
                            warehouse = product.warehouse,
                            supplier = product.supplier,
                            location = product.location,
                            barcode = product.barcode,
                            batchNumber = product.batchNumber,
                            notes = product.notes,
                            images = product.images,
                            isLoading = false
                        )
                    }
                } else {
                    _detailState.update { it.copy(isLoading = false, error = "Product not found") }
                }
            }
        }
    }

    fun loadProductDetail(id: String) {
        viewModelScope.launch {
            _detailState.update { it.copy(isLoading = true) }
            productRepo.getProduct(id).collect { product ->
                if (product != null) {
                    _detailState.update { it.copy(product = product, isLoading = false) }
                } else {
                    _detailState.update { it.copy(isLoading = false, error = "Product not found") }
                }
            }
        }
    }

    fun loadStockMovements(id: String) {
        // Stock movements would come from StockMovementDao via a repository
        // For now we keep the list empty - extend when StockMovementRepo is available
    }

    fun deleteProduct(id: String) {
        viewModelScope.launch {
            productRepo.deleteProduct(id)
        }
    }

    fun generateBarcode() {
        val state = _formState.value
        val sku = state.sku.ifBlank { generateSkuInternal() }
        val barcode = "AE${sku.takeLast(10).uppercase()}"
        _formState.update { it.copy(barcode = barcode, sku = sku) }
    }

    fun generateSku() {
        val state = _formState.value
        val prefix = state.category.take(3).uppercase().ifBlank { "GEN" }
        val sku = "$prefix-${UUID.randomUUID().toString().take(8).uppercase()}"
        _formState.update { it.copy(sku = sku) }
    }

    private fun generateSkuInternal(): String {
        return "SKU-${UUID.randomUUID().toString().take(8).uppercase()}"
    }

    fun resetForm() {
        _formState.value = ProductFormState()
    }
}
