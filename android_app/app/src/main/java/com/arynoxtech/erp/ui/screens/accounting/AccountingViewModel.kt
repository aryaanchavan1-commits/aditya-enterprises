package com.arynoxtech.erp.ui.screens.accounting

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.arynoxtech.erp.data.local.CashBookEntity
import com.arynoxtech.erp.data.local.ExpenseEntity
import com.arynoxtech.erp.data.local.IncomeEntity
import com.arynoxtech.erp.data.repository.AccountingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class AccountingViewModel @Inject constructor(
    private val accountingRepo: AccountingRepository
) : ViewModel() {

    data class AccountingUiState(
        val totalSales: Double = 0.0,
        val totalPurchases: Double = 0.0,
        val netProfit: Double = 0.0,
        val receivableAmount: Double = 0.0,
        val payableAmount: Double = 0.0,
        val cashBalance: Double = 0.0,
        val expenseTotal: Double = 0.0,
        val incomeTotal: Double = 0.0,
        val recentTransactions: List<TransactionItem> = emptyList(),
        val isLoading: Boolean = true,
        val error: String? = null
    )

    data class TransactionItem(
        val id: String,
        val date: Long,
        val type: String,
        val description: String,
        val amount: Double,
        val isCredit: Boolean
    )

    data class CashBookEntry(
        val id: String,
        val date: Long,
        val type: String,
        val description: String,
        val amount: Double,
        val balance: Double
    )

    data class ExpenseEntry(
        val id: String,
        val date: Long,
        val category: String,
        val description: String,
        val amount: Double
    )

    data class IncomeEntry(
        val id: String,
        val date: Long,
        val category: String,
        val description: String,
        val amount: Double
    )

    private val _uiState = MutableStateFlow(AccountingUiState())
    val uiState: StateFlow<AccountingUiState> = _uiState.asStateFlow()

    private val _cashBook = MutableStateFlow<List<CashBookEntry>>(emptyList())
    val cashBook: StateFlow<List<CashBookEntry>> = _cashBook.asStateFlow()

    private val _expenses = MutableStateFlow<List<ExpenseEntry>>(emptyList())
    val expenses: StateFlow<List<ExpenseEntry>> = _expenses.asStateFlow()

    private val _incomes = MutableStateFlow<List<IncomeEntry>>(emptyList())
    val incomes: StateFlow<List<IncomeEntry>> = _incomes.asStateFlow()

    private val _startDate = MutableStateFlow<Long?>(null)
    private val _endDate = MutableStateFlow<Long?>(null)

    init {
        refresh()
        observeCashBook()
        observeExpenses()
        observeIncomes()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                accountingRepo.refreshFromRemote()
                loadOverview()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    private fun loadOverview() {
        viewModelScope.launch {
            try {
                val now = System.currentTimeMillis()
                val monthStart = getMonthStart(now)
                val yearStart = getYearStart(now)

                accountingRepo.getCashBalance().collect { cashBalance ->
                    _uiState.value = _uiState.value.copy(cashBalance = cashBalance)
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun loadCashBook(startDate: Long?, endDate: Long?) {
        _startDate.value = startDate
        _endDate.value = endDate
    }

    fun loadExpenses(startDate: Long?, endDate: Long?) {
        _startDate.value = startDate
        _endDate.value = endDate
        observeExpenses()
    }

    fun loadIncomes(startDate: Long?, endDate: Long?) {
        _startDate.value = startDate
        _endDate.value = endDate
        observeIncomes()
    }

    fun addCashEntry(type: String, description: String, amount: Double) {
        viewModelScope.launch(Dispatchers.IO) {
            val currentBalance = _cashBook.value.lastOrNull()?.balance ?: 0.0
            val newBalance = if (type == "receipt" || type == "income")
                currentBalance + amount else currentBalance - amount
            val entry = CashBookEntity(
                date = System.currentTimeMillis(),
                transactionType = type,
                description = description,
                amount = amount,
                balance = newBalance
            )
            accountingRepo.addCashEntry(entry)
        }
    }

    fun addExpense(category: String, description: String, amount: Double, paymentMethod: String) {
        viewModelScope.launch(Dispatchers.IO) {
            val expense = ExpenseEntity(
                date = System.currentTimeMillis(),
                category = category,
                description = description,
                amount = amount,
                paymentMethod = paymentMethod
            )
            accountingRepo.addExpense(expense)
        }
    }

    fun addIncome(category: String, description: String, amount: Double, paymentMethod: String) {
        viewModelScope.launch(Dispatchers.IO) {
            val income = IncomeEntity(
                date = System.currentTimeMillis(),
                category = category,
                description = description,
                amount = amount,
                paymentMethod = paymentMethod
            )
            accountingRepo.addIncome(income)
        }
    }

    private fun observeCashBook() {
        viewModelScope.launch {
            accountingRepo.getCashBook().catch { e ->
                _uiState.value = _uiState.value.copy(error = e.message)
            }.collect { entities ->
                _cashBook.value = entities.map { it.toCashBookEntry() }
                updateRecentTransactions()
            }
        }
    }

    private fun observeExpenses() {
        viewModelScope.launch {
            val start = _startDate.value ?: 0L
            val end = _endDate.value ?: Long.MAX_VALUE
            accountingRepo.getExpenses(start, end).catch { e ->
                _uiState.value = _uiState.value.copy(error = e.message)
            }.collect { entities ->
                _expenses.value = entities.map { it.toExpenseEntry() }
                _uiState.value = _uiState.value.copy(
                    expenseTotal = entities.sumOf { it.amount },
                    isLoading = false
                )
            }
        }
    }

    private fun observeIncomes() {
        viewModelScope.launch {
            val start = _startDate.value ?: 0L
            val end = _endDate.value ?: Long.MAX_VALUE
            accountingRepo.getIncomes(start, end).catch { e ->
                _uiState.value = _uiState.value.copy(error = e.message)
            }.collect { entities ->
                _incomes.value = entities.map { it.toIncomeEntry() }
                _uiState.value = _uiState.value.copy(
                    incomeTotal = entities.sumOf { it.amount },
                    isLoading = false
                )
            }
        }
    }

    private fun updateRecentTransactions() {
        val all = mutableListOf<TransactionItem>()
        all.addAll(_cashBook.value.map {
            TransactionItem(
                id = it.id,
                date = it.date,
                type = it.type,
                description = it.description,
                amount = it.amount,
                isCredit = it.amount > 0
            )
        })
        all.addAll(_expenses.value.map {
            TransactionItem(
                id = it.id,
                date = it.date,
                type = "Expense",
                description = it.description,
                amount = it.amount,
                isCredit = false
            )
        })
        all.addAll(_incomes.value.map {
            TransactionItem(
                id = it.id,
                date = it.date,
                type = "Income",
                description = it.description,
                amount = it.amount,
                isCredit = true
            )
        })
        _uiState.value = _uiState.value.copy(
            recentTransactions = all.sortedByDescending { it.date }.take(20)
        )
    }

    private fun CashBookEntity.toCashBookEntry() = CashBookEntry(
        id = id,
        date = date,
        type = transactionType,
        description = description,
        amount = amount,
        balance = balance
    )

    private fun ExpenseEntity.toExpenseEntry() = ExpenseEntry(
        id = id,
        date = date,
        category = category,
        description = description,
        amount = amount
    )

    private fun IncomeEntity.toIncomeEntry() = IncomeEntry(
        id = id,
        date = date,
        category = category,
        description = description,
        amount = amount
    )

    companion object {
        private fun getMonthStart(now: Long): Long {
            val cal = java.util.Calendar.getInstance()
            cal.timeInMillis = now
            cal.set(java.util.Calendar.DAY_OF_MONTH, 1)
            cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
            cal.set(java.util.Calendar.MINUTE, 0)
            cal.set(java.util.Calendar.SECOND, 0)
            cal.set(java.util.Calendar.MILLISECOND, 0)
            return cal.timeInMillis
        }

        private fun getYearStart(now: Long): Long {
            val cal = java.util.Calendar.getInstance()
            cal.timeInMillis = now
            cal.set(java.util.Calendar.DAY_OF_YEAR, 1)
            cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
            cal.set(java.util.Calendar.MINUTE, 0)
            cal.set(java.util.Calendar.SECOND, 0)
            cal.set(java.util.Calendar.MILLISECOND, 0)
            return cal.timeInMillis
        }
    }
}
