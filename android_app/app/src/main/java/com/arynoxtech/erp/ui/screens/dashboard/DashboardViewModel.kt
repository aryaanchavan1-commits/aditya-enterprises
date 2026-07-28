package com.arynoxtech.erp.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.arynoxtech.erp.data.repository.DashboardRepository
import com.arynoxtech.erp.data.repository.ProductRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import javax.inject.Inject

data class DashboardUiState(
    val greeting: String = "",
    val date: String = "",
    val selectedDate: Long = System.currentTimeMillis(),
    val selectedDateFormatted: String = "",
    val totalProducts: Int = 0,
    val lowStockCount: Int = 0,
    val todaySalesCount: Int = 0,
    val monthlyRevenue: Double = 0.0,
    val recentSales: List<RecentSaleItem> = emptyList(),
    val salesChartLabels: List<String> = emptyList(),
    val salesChartValues: List<Double> = emptyList(),
    val inStockCount: Int = 0,
    val outOfStockCount: Int = 0,
    val dailySalesRevenue: Double = 0.0,
    val dailySalesCount: Int = 0,
    val dailyPurchasesCount: Int = 0,
    val dailyPurchaseTotal: Double = 0.0,
    val dailyExpenseTotal: Double = 0.0,
    val dailyIncomeTotal: Double = 0.0,
    val isLoading: Boolean = false,
    val error: String? = null
)

data class RecentSaleItem(
    val id: String,
    val invoiceNumber: String,
    val customerName: String,
    val total: Double,
    val paymentStatus: String,
    val createdAt: Long
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val dashboardRepo: DashboardRepository,
    private val productRepo: ProductRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        setGreeting()
        loadData()
    }

    private fun setGreeting() {
        val calendar = Calendar.getInstance()
        val hour = calendar.get(Calendar.HOUR_OF_DAY)
        val greeting = when (hour) {
            in 0..11 -> "Good Morning"
            in 12..16 -> "Good Afternoon"
            else -> "Good Evening"
        }
        val dateFormat = SimpleDateFormat("EEEE, dd MMMM yyyy", Locale.getDefault())
        val dayFormat = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
        _uiState.update {
            it.copy(
                greeting = greeting,
                date = dateFormat.format(calendar.time),
                selectedDate = calendar.timeInMillis,
                selectedDateFormatted = dayFormat.format(calendar.time)
            )
        }
    }

    fun selectDate(dateMillis: Long) {
        val dayFormat = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
        _uiState.update { it.copy(selectedDate = dateMillis, selectedDateFormatted = dayFormat.format(Date(dateMillis))) }
        loadDailySummary(dateMillis)
    }

    private fun loadDailySummary(dateMillis: Long) {
        viewModelScope.launch {
            try {
                val summary = dashboardRepo.getDailySummary(dateMillis)
                _uiState.update {
                    it.copy(
                        dailySalesRevenue = summary.salesRevenue,
                        dailySalesCount = summary.salesCount,
                        dailyPurchasesCount = summary.purchaseCount,
                        dailyPurchaseTotal = summary.purchaseTotal,
                        dailyExpenseTotal = summary.expenseTotal,
                        dailyIncomeTotal = summary.incomeTotal
                    )
                }
            } catch (e: Exception) {
                // ignore daily summary errors
            }
        }
    }

    private fun loadData() {
        viewModelScope.launch {
            try {
                val stats = dashboardRepo.getDashboardStats()
                val chartData = dashboardRepo.getChartData()
                val products = productRepo.getProducts().first()

                val outOfStock = products.count { p -> p.currentStock <= 0 }
                val countedLowStock = products.count { p -> p.minimumStock > 0 && p.currentStock <= p.minimumStock }
                val inStock = products.size - outOfStock - countedLowStock

                _uiState.update {
                    it.copy(
                        totalProducts = stats.totalProducts,
                        lowStockCount = countedLowStock,
                        todaySalesCount = stats.todaySalesCount,
                        monthlyRevenue = stats.monthlyRevenue,
                        salesChartLabels = chartData.labels,
                        salesChartValues = chartData.values,
                        inStockCount = inStock,
                        outOfStockCount = outOfStock,
                        isLoading = false,
                        error = null
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Failed to load dashboard: ${e.message}") }
            }
        }
        loadDailySummary(_uiState.value.selectedDate)
    }

    fun refresh() {
        _uiState.update { it.copy(isLoading = true) }
        loadData()
    }

    fun refreshFromRemote() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                dashboardRepo.refreshFromRemote()
                productRepo.refreshFromRemote()
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
            loadData()
        }
    }
}
