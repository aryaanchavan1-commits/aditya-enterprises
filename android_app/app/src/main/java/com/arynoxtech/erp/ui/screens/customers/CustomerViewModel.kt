package com.arynoxtech.erp.ui.screens.customers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.arynoxtech.erp.data.local.CustomerEntity
import com.arynoxtech.erp.data.repository.CustomerRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class CustomerFormState(
    val id: String = "",
    val name: String = "",
    val phone: String = "",
    val email: String = "",
    val gstin: String = "",
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
class CustomerViewModel @Inject constructor(
    private val customerRepo: CustomerRepository
) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    private val _formState = MutableStateFlow(CustomerFormState())
    val formState: StateFlow<CustomerFormState> = _formState.asStateFlow()

    @OptIn(ExperimentalCoroutinesApi::class)
    val customers: StateFlow<List<CustomerEntity>> = _searchQuery
        .flatMapLatest { query ->
            if (query.isBlank()) customerRepo.getAll()
            else customerRepo.search(query)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun search(query: String) { _searchQuery.value = query }

    fun loadCustomer(id: String) {
        viewModelScope.launch {
            val customer = customerRepo.getById(id)
            if (customer != null) {
                _formState.value = CustomerFormState(
                    id = customer.id,
                    name = customer.name,
                    phone = customer.phone,
                    email = customer.email,
                    gstin = customer.gstin,
                    address = customer.address,
                    city = customer.city,
                    state = customer.state,
                    pincode = customer.pincode,
                    creditLimit = if (customer.creditLimit > 0) customer.creditLimit.toString() else "",
                    creditDays = if (customer.creditDays > 0) customer.creditDays.toString() else "",
                    notes = customer.notes
                )
            }
        }
    }

    fun updateField(field: String, value: String) {
        _formState.update { current ->
            when (field) {
                "name" -> current.copy(name = value)
                "phone" -> current.copy(phone = value)
                "email" -> current.copy(email = value)
                "gstin" -> current.copy(gstin = value.uppercase())
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
            _formState.update { it.copy(error = "Customer name is required") }
            return
        }
        viewModelScope.launch {
            _formState.update { it.copy(isSaving = true, error = null) }
            val customer = CustomerEntity(
                id = state.id.ifBlank { UUID.randomUUID().toString() },
                name = state.name,
                phone = state.phone,
                email = state.email,
                gstin = state.gstin,
                address = state.address,
                city = state.city,
                state = state.state,
                pincode = state.pincode,
                creditLimit = state.creditLimit.toDoubleOrNull() ?: 0.0,
                creditDays = state.creditDays.toIntOrNull() ?: 0,
                notes = state.notes,
                code = "CUST-${System.currentTimeMillis().toString().takeLast(6)}",
                createdAt = if (state.id.isBlank()) System.currentTimeMillis() else 0L
            )
            val result = customerRepo.save(customer)
            if (result.isSuccess) {
                _formState.update { it.copy(isSaving = false, success = true) }
                onSuccess()
            } else {
                _formState.update { it.copy(isSaving = false, error = result.exceptionOrNull()?.message ?: "Save failed") }
            }
        }
    }

    fun delete(customer: CustomerEntity) {
        viewModelScope.launch { customerRepo.delete(customer) }
    }

    fun resetForm() { _formState.value = CustomerFormState() }
}
