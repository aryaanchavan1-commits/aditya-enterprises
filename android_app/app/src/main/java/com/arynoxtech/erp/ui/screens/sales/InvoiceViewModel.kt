package com.arynoxtech.erp.ui.screens.sales

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.arynoxtech.erp.data.repository.SaleRepository
import com.arynoxtech.erp.domain.model.Sale
import com.arynoxtech.erp.domain.model.SaleItem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class InvoiceViewModel @Inject constructor(
    private val saleRepo: SaleRepository
) : ViewModel() {

    data class InvoiceUiState(
        val sale: Sale? = null,
        val items: List<SaleItem> = emptyList(),
        val isLoading: Boolean = true,
        val error: String? = null
    )

    private val _uiState = MutableStateFlow(InvoiceUiState())
    val uiState: StateFlow<InvoiceUiState> = _uiState.asStateFlow()

    fun loadInvoice(saleId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                saleRepo.getSaleWithItems(saleId).collect { pair ->
                    if (pair != null) {
                        val (saleEntity, itemEntities) = pair
                        val sale = Sale(
                            id = saleEntity.id,
                            invoiceNumber = saleEntity.invoiceNumber,
                            customerId = saleEntity.customerId,
                            customerName = saleEntity.customerName,
                            customerPhone = saleEntity.customerPhone,
                            customerGstin = saleEntity.customerGstin,
                            saleDate = saleEntity.saleDate,
                            subtotal = saleEntity.subtotal,
                            discountAmount = saleEntity.discountAmount,
                            taxAmount = saleEntity.taxAmount,
                            cgstTotal = saleEntity.cgstTotal,
                            sgstTotal = saleEntity.sgstTotal,
                            igstTotal = saleEntity.igstTotal,
                            roundOff = saleEntity.roundOff,
                            totalAmount = saleEntity.totalAmount,
                            paidAmount = saleEntity.paidAmount,
                            balanceAmount = saleEntity.balanceAmount,
                            paymentMethod = saleEntity.paymentMethod,
                            paymentStatus = saleEntity.paymentStatus,
                            status = saleEntity.status,
                            notes = saleEntity.notes,
                            createdAt = saleEntity.createdAt
                        )
                        val items = itemEntities.map { entity ->
                            SaleItem(
                                id = entity.id,
                                saleId = entity.saleId,
                                productId = entity.productId,
                                productName = entity.productName,
                                productSku = entity.productSku,
                                quantity = entity.quantity,
                                unitPrice = entity.unitPrice,
                                discountPercent = entity.discountPercent,
                                discountAmount = entity.discountAmount,
                                taxableAmount = entity.taxableAmount,
                                gstRate = entity.gstRate,
                                cgstAmount = entity.cgstAmount,
                                sgstAmount = entity.sgstAmount,
                                igstAmount = entity.igstAmount,
                                totalAmount = entity.totalAmount
                            )
                        }
                        _uiState.value = InvoiceUiState(
                            sale = sale,
                            items = items,
                            isLoading = false,
                            error = null
                        )
                    } else {
                        _uiState.value = InvoiceUiState(
                            isLoading = false,
                            error = "Sale not found"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.value = InvoiceUiState(
                    isLoading = false,
                    error = e.message ?: "Failed to load invoice"
                )
            }
        }
    }
}
