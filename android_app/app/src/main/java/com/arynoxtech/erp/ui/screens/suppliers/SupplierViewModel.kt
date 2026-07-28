package com.arynoxtech.erp.ui.screens.suppliers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.arynoxtech.erp.data.local.SupplierEntity
import com.arynoxtech.erp.data.repository.SupplierRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class SupplierFormState(
    val id: String = "",
    val name: String = "",
    val contactPerson: String = "",
    val phone: String = "",
    val alternatePhone: String = "",
    val email: String = "",
    val gstin: String = "",
    val pan: String = "",
    val address: String = "",
    val city: String = "",
    val state: String = "",
    val pincode: String = "",
    val creditLimit: String = "",
    val creditDays: String = "",
    val notes: String = "",
    val isSaving: Boolean = false,
    val error: String? = null,
    val success: Boolean = false
)

@HiltViewModel
class SupplierViewModel @Inject constructor(
    private val supplierRepo: SupplierRepository
) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    private val _formState = MutableStateFlow(SupplierFormState())
    val formState: StateFlow<SupplierFormState> = _formState.asStateFlow()

    @OptIn(ExperimentalCoroutinesApi::class)
    val suppliers: StateFlow<List<SupplierEntity>> = _searchQuery
        .flatMapLatest { query ->
            if (query.isBlank()) supplierRepo.getAll()
            else supplierRepo.search(query)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun search(query: String) { _searchQuery.value = query }

    fun loadSupplier(id: String) {
        viewModelScope.launch {
            val supplier = supplierRepo.getById(id)
            if (supplier != null) {
                _formState.value = SupplierFormState(
                    id = supplier.id, name = supplier.name, contactPerson = supplier.contactPerson,
                    phone = supplier.phone, alternatePhone = supplier.alternatePhone,
                    email = supplier.email, gstin = supplier.gstin, pan = supplier.pan,
                    address = supplier.address, city = supplier.city, state = supplier.state,
                    pincode = supplier.pincode,
                    creditLimit = if (supplier.creditLimit > 0) supplier.creditLimit.toString() else "",
                    creditDays = if (supplier.creditDays > 0) supplier.creditDays.toString() else "",
                    notes = supplier.notes
                )
            }
        }
    }

    fun updateField(field: String, value: String) {
        _formState.update { current ->
            when (field) {
                "name" -> current.copy(name = value)
                "contactPerson" -> current.copy(contactPerson = value)
                "phone" -> current.copy(phone = value)
                "alternatePhone" -> current.copy(alternatePhone = value)
                "email" -> current.copy(email = value)
                "gstin" -> current.copy(gstin = value.uppercase())
                "pan" -> current.copy(pan = value.uppercase())
                "address" -> current.copy(address = value)
                "city" -> current.copy(city = value)
                "state" -> current.copy(state = value)
                "pincode" -> current.copy(pincode = value)
                "creditLimit" -> current.copy(creditLimit = value)
                "creditDays" -> current.copy(creditDays = value)
                "notes" -> current.copy(notes = value)
                else -> current
            }
        }
    }

    fun save(onSuccess: () -> Unit) {
        val state = _formState.value
        if (state.name.isBlank()) {
            _formState.update { it.copy(error = "Supplier name is required") }
            return
        }
        viewModelScope.launch {
            _formState.update { it.copy(isSaving = true, error = null) }
            val supplier = SupplierEntity(
                id = state.id.ifBlank { UUID.randomUUID().toString() },
                name = state.name, contactPerson = state.contactPerson,
                phone = state.phone, alternatePhone = state.alternatePhone,
                email = state.email, gstin = state.gstin, pan = state.pan,
                address = state.address, city = state.city, state = state.state,
                pincode = state.pincode,
                creditLimit = state.creditLimit.toDoubleOrNull() ?: 0.0,
                creditDays = state.creditDays.toIntOrNull() ?: 0,
                notes = state.notes,
                code = "SUPP-${System.currentTimeMillis().toString().takeLast(6)}",
                createdAt = if (state.id.isBlank()) System.currentTimeMillis() else 0L
            )
            val result = supplierRepo.save(supplier)
            if (result.isSuccess) {
                _formState.update { it.copy(isSaving = false, success = true) }
                onSuccess()
            } else {
                _formState.update { it.copy(isSaving = false, error = result.exceptionOrNull()?.message ?: "Save failed") }
            }
        }
    }

    fun delete(supplier: SupplierEntity) {
        viewModelScope.launch { supplierRepo.delete(supplier) }
    }

    fun resetForm() { _formState.value = SupplierFormState() }
}
