package com.arynoxtech.erp.ui.screens.sales

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.arynoxtech.erp.data.repository.SaleRepository
import com.arynoxtech.erp.domain.model.Sale
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SalesViewModel @Inject constructor(
    private val saleRepo: SaleRepository
) : ViewModel() {

    data class SalesUiState(
        val sales: List<Sale> = emptyList(),
        val searchQuery: String = "",
        val selectedPaymentStatus: String? = null,
        val isLoading: Boolean = true,
        val error: String? = null
    )

    private val _searchQuery = MutableStateFlow("")
    private val _selectedPaymentStatus = MutableStateFlow<String?>(null)
    private val _isRefreshing = MutableStateFlow(false)

    @OptIn(ExperimentalCoroutinesApi::class)
    val uiState: StateFlow<SalesUiState> = combine(
        _searchQuery,
        _selectedPaymentStatus,
        saleRepo.getSales().map { entities ->
            entities.map { entity ->
                Sale(
                    id = entity.id,
                    invoiceNumber = entity.invoiceNumber,
                    customerId = entity.customerId,
                    customerName = entity.customerName,
                    customerPhone = entity.customerPhone,
                    customerGstin = entity.customerGstin,
                    saleDate = entity.saleDate,
                    subtotal = entity.subtotal,
                    discountAmount = entity.discountAmount,
                    taxAmount = entity.taxAmount,
                    cgstTotal = entity.cgstTotal,
                    sgstTotal = entity.sgstTotal,
                    igstTotal = entity.igstTotal,
                    roundOff = entity.roundOff,
                    totalAmount = entity.totalAmount,
                    paidAmount = entity.paidAmount,
                    balanceAmount = entity.balanceAmount,
                    paymentMethod = entity.paymentMethod,
                    paymentStatus = entity.paymentStatus,
                    status = entity.status,
                    notes = entity.notes,
                    createdAt = entity.createdAt
                )
            }
        },
        _isRefreshing
    ) { query, paymentStatus, sales, refreshing ->
        val filtered = sales.filter { sale ->
            val matchesSearch = query.isBlank() ||
                    sale.invoiceNumber.contains(query, ignoreCase = true) ||
                    sale.customerName.contains(query, ignoreCase = true)
            val matchesStatus = paymentStatus == null ||
                    sale.paymentStatus.equals(paymentStatus, ignoreCase = true)
            matchesSearch && matchesStatus
        }
        SalesUiState(
            sales = filtered,
            searchQuery = query,
            selectedPaymentStatus = paymentStatus,
            isLoading = refreshing,
            error = null
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), SalesUiState())

    fun search(query: String) {
        _searchQuery.value = query
    }

    fun filterByPaymentStatus(status: String?) {
        _selectedPaymentStatus.value = status
    }

    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            saleRepo.refreshFromRemote()
            _isRefreshing.value = false
        }
    }
}
