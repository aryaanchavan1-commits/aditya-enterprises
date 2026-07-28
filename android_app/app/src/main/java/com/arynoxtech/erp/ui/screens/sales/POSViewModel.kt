package com.arynoxtech.erp.ui.screens.sales

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.arynoxtech.erp.data.local.SaleEntity
import com.arynoxtech.erp.data.local.SaleItemEntity
import com.arynoxtech.erp.data.repository.ProductRepository
import com.arynoxtech.erp.data.repository.SaleRepository
import com.arynoxtech.erp.domain.model.Product
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class POSViewModel @Inject constructor(
    private val productRepo: ProductRepository,
    private val saleRepo: SaleRepository
) : ViewModel() {

    data class CartItem(
        val productId: String,
        val productName: String,
        val quantity: Int = 1,
        val unitPrice: Double,
        val gstRate: Double,
        val subtotal: Double
    )

    data class POSUiState(
        val products: List<Product> = emptyList(),
        val cart: List<CartItem> = emptyList(),
        val customerName: String = "",
        val customerPhone: String = "",
        val customerGst: String = "",
        val paymentMode: String = "Cash",
        val searchQuery: String = "",
        val isLoading: Boolean = false,
        val isProcessing: Boolean = false,
        val error: String? = null,
        val successInvoiceId: String? = null
    )

    private val _searchQuery = MutableStateFlow("")
    private val _customerName = MutableStateFlow("")
    private val _customerPhone = MutableStateFlow("")
    private val _customerGst = MutableStateFlow("")
    private val _paymentMode = MutableStateFlow("Cash")
    private val _isProcessing = MutableStateFlow(false)
    private val _error = MutableStateFlow<String?>(null)
    private val _successInvoiceId = MutableStateFlow<String?>(null)

    private val _cart = MutableStateFlow<List<CartItem>>(emptyList())
    val cart: StateFlow<List<CartItem>> = _cart.asStateFlow()

    @OptIn(ExperimentalCoroutinesApi::class)
    private val _products: StateFlow<List<Product>> = _searchQuery.flatMapLatest { query ->
        if (query.isBlank()) productRepo.getProducts()
        else productRepo.searchProducts(query)
    }.map { entities ->
        entities.map { entity ->
            Product(
                id = entity.id,
                name = entity.name,
                sku = entity.sku,
                hsnCode = entity.hsnCode,
                barcode = entity.barcode,
                description = entity.description,
                category = entity.category,
                subCategory = entity.subCategory,
                brand = entity.brand,
                unit = entity.unit,
                purchasePrice = entity.purchasePrice,
                sellingPrice = entity.sellingPrice,
                mrp = entity.mrp,
                discount = entity.discount,
                tax = entity.tax,
                gstRate = entity.gstRate,
                minimumStock = entity.minimumStock,
                maximumStock = entity.maximumStock,
                openingStock = entity.openingStock,
                currentStock = entity.currentStock,
                warehouse = entity.warehouse,
                supplier = entity.supplier,
                location = entity.location,
                expiryDate = entity.expiryDate,
                manufacturingDate = entity.manufacturingDate,
                batchNumber = entity.batchNumber,
                notes = entity.notes,
                images = entity.images,
                isActive = entity.isActive,
                createdAt = entity.createdAt,
                updatedAt = entity.updatedAt
            )
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val uiState: StateFlow<POSUiState> = combine(
        _products, _cart, _customerName, _customerPhone, _customerGst
    ) { products, cart, name, phone, gst ->
        POSUiState(
            products = products,
            cart = cart,
            customerName = name,
            customerPhone = phone,
            customerGst = gst,
            paymentMode = _paymentMode.value,
            searchQuery = _searchQuery.value,
            isLoading = false,
            isProcessing = _isProcessing.value,
            error = _error.value,
            successInvoiceId = _successInvoiceId.value
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), POSUiState())

    private val _subtotal = MutableStateFlow(0.0)
    val subtotal: StateFlow<Double> = _subtotal.asStateFlow()

    private val _gstTotal = MutableStateFlow(0.0)
    val gstTotal: StateFlow<Double> = _gstTotal.asStateFlow()

    private val _grandTotal = MutableStateFlow(0.0)
    val grandTotal: StateFlow<Double> = _grandTotal.asStateFlow()

    fun searchProducts(query: String) {
        _searchQuery.value = query
    }

    fun addToCart(product: Product) {
        val currentCart = _cart.value.toMutableList()
        val existingIndex = currentCart.indexOfFirst { it.productId == product.id }
        if (existingIndex >= 0) {
            val existing = currentCart[existingIndex]
            currentCart[existingIndex] = existing.copy(
                quantity = existing.quantity + 1,
                subtotal = (existing.quantity + 1) * existing.unitPrice
            )
        } else {
            currentCart.add(
                CartItem(
                    productId = product.id,
                    productName = product.name,
                    quantity = 1,
                    unitPrice = product.sellingPrice,
                    gstRate = product.gstRate,
                    subtotal = product.sellingPrice
                )
            )
        }
        _cart.value = currentCart
        recalculateTotals()
    }

    fun updateQuantity(productId: String, quantity: Int) {
        if (quantity <= 0) {
            removeFromCart(productId)
            return
        }
        val currentCart = _cart.value.toMutableList()
        val index = currentCart.indexOfFirst { it.productId == productId }
        if (index >= 0) {
            val item = currentCart[index]
            currentCart[index] = item.copy(
                quantity = quantity,
                subtotal = quantity * item.unitPrice
            )
            _cart.value = currentCart
            recalculateTotals()
        }
    }

    fun removeFromCart(productId: String) {
        _cart.value = _cart.value.filter { it.productId != productId }
        recalculateTotals()
    }

    fun setCustomer(name: String, phone: String, gst: String) {
        _customerName.value = name
        _customerPhone.value = phone
        _customerGst.value = gst
    }

    fun setPaymentMode(mode: String) {
        _paymentMode.value = mode
    }

    fun checkout(onSuccess: (String) -> Unit) {
        if (_cart.value.isEmpty()) {
            _error.value = "Cart is empty"
            return
        }
        viewModelScope.launch {
            _isProcessing.value = true
            _error.value = null
            try {
                val saleId = UUID.randomUUID().toString()
                val invoiceNumber = generateInvoiceNumber()
                val now = System.currentTimeMillis()

                val items = _cart.value.map { cartItem ->
                    val taxableAmount = cartItem.subtotal / (1 + cartItem.gstRate / 100)
                    val gstAmount = cartItem.subtotal - taxableAmount
                    val cgstAmount = gstAmount / 2
                    val sgstAmount = gstAmount / 2

                    SaleItemEntity(
                        id = UUID.randomUUID().toString(),
                        saleId = saleId,
                        productId = cartItem.productId,
                        productName = cartItem.productName,
                        quantity = cartItem.quantity.toDouble(),
                        unitPrice = cartItem.unitPrice,
                        discountPercent = 0.0,
                        discountAmount = 0.0,
                        taxableAmount = taxableAmount,
                        gstRate = cartItem.gstRate,
                        cgstAmount = cgstAmount,
                        sgstAmount = sgstAmount,
                        igstAmount = 0.0,
                        totalAmount = cartItem.subtotal
                    )
                }

                val sub = _subtotal.value
                val gst = _gstTotal.value
                val total = _grandTotal.value
                val roundOff = kotlin.math.round(total) - total

                val sale = SaleEntity(
                    id = saleId,
                    invoiceNumber = invoiceNumber,
                    customerName = _customerName.value,
                    customerPhone = _customerPhone.value,
                    customerGstin = _customerGst.value,
                    saleDate = now,
                    subtotal = sub,
                    discountAmount = 0.0,
                    taxAmount = gst,
                    cgstTotal = gst / 2,
                    sgstTotal = gst / 2,
                    igstTotal = 0.0,
                    roundOff = roundOff,
                    totalAmount = kotlin.math.round(total),
                    paidAmount = if (_paymentMode.value == "Credit") 0.0 else kotlin.math.round(total),
                    balanceAmount = if (_paymentMode.value == "Credit") kotlin.math.round(total) else 0.0,
                    paymentMethod = _paymentMode.value.lowercase(),
                    paymentStatus = if (_paymentMode.value == "Credit") "pending" else "paid",
                    status = "active",
                    notes = "",
                    createdAt = now
                )

                val result = saleRepo.createSale(sale, items)
                result.onSuccess { invNum ->
                    _successInvoiceId.value = saleId
                    onSuccess(saleId)
                    clearCart()
                }.onFailure { e ->
                    _error.value = e.message ?: "Failed to create sale"
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "An unexpected error occurred"
            } finally {
                _isProcessing.value = false
            }
        }
    }

    fun clearCart() {
        _cart.value = emptyList()
        _customerName.value = ""
        _customerPhone.value = ""
        _customerGst.value = ""
        _paymentMode.value = "Cash"
        _searchQuery.value = ""
        _error.value = null
        _successInvoiceId.value = null
        recalculateTotals()
    }

    fun clearError() {
        _error.value = null
    }

    private fun recalculateTotals() {
        val sub = _cart.value.sumOf { it.subtotal }
        val gst = _cart.value.sumOf { item ->
            item.subtotal - (item.subtotal / (1 + item.gstRate / 100))
        }
        val total = sub + gst
        _subtotal.value = sub
        _gstTotal.value = gst
        _grandTotal.value = total
    }

    private var lastInvoiceNumber = 0L

    private fun generateInvoiceNumber(): String {
        val datePart = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.getDefault())
            .format(java.util.Date())
        lastInvoiceNumber++
        return "INV-$datePart-${String.format("%04d", lastInvoiceNumber)}"
    }
}
