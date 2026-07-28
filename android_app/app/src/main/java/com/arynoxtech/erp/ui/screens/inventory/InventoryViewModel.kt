package com.arynoxtech.erp.ui.screens.inventory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.arynoxtech.erp.data.local.CategoryDao
import com.arynoxtech.erp.data.local.ProductEntity
import com.arynoxtech.erp.data.repository.ProductRepository
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
import javax.inject.Inject

enum class StockFilter { ALL, LOW_STOCK, OUT_OF_STOCK }

data class InventoryUiState(
    val products: List<ProductEntity> = emptyList(),
    val searchQuery: String = "",
    val selectedCategory: String? = null,
    val stockFilter: StockFilter = StockFilter.ALL,
    val categories: List<String> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null
)

@HiltViewModel
class InventoryViewModel @Inject constructor(
    private val productRepo: ProductRepository,
    private val categoryDao: CategoryDao
) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    private val _selectedCategory = MutableStateFlow<String?>(null)
    private val _stockFilter = MutableStateFlow(StockFilter.ALL)
    private val _categories = MutableStateFlow<List<String>>(emptyList())

    private val refreshTrigger = MutableStateFlow(0L)

    @OptIn(ExperimentalCoroutinesApi::class)
    val uiState: StateFlow<InventoryUiState> = combine(
        refreshTrigger.flatMapLatest {
            when {
                _searchQuery.value.isNotBlank() -> productRepo.searchProducts(_searchQuery.value)
                else -> productRepo.getProducts()
            }
        },
        _searchQuery,
        _selectedCategory,
        _stockFilter,
        _categories
    ) { products, query, category, stockFilter, categories ->
        var filtered = products

        if (category != null) {
            filtered = filtered.filter { it.category == category }
        }

        filtered = when (stockFilter) {
            StockFilter.LOW_STOCK -> filtered.filter {
                it.currentStock <= it.minimumStock && it.currentStock > 0
            }
            StockFilter.OUT_OF_STOCK -> filtered.filter { it.currentStock <= 0 }
            StockFilter.ALL -> filtered
        }

        InventoryUiState(
            products = filtered,
            searchQuery = query,
            selectedCategory = category,
            stockFilter = stockFilter,
            categories = categories,
            isLoading = false,
            error = null
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), InventoryUiState())

    init {
        loadCategories()
    }

    private fun loadCategories() {
        viewModelScope.launch {
            categoryDao.getAll().collect { cats ->
                _categories.value = cats.map { it.name }.filter { it.isNotBlank() }.sorted()
            }
        }
    }

    fun search(query: String) {
        _searchQuery.value = query
    }

    fun filterByCategory(category: String?) {
        _selectedCategory.value = category
    }

    fun filterByStock(filter: StockFilter) {
        _stockFilter.value = filter
    }

    fun deleteProduct(id: String) {
        viewModelScope.launch {
            productRepo.deleteProduct(id)
        }
    }

    fun refresh() {
        refreshTrigger.update { System.currentTimeMillis() }
    }
}
