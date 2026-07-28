package com.arynoxtech.erp.ui.screens.accounting

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.CurrencyRupee
import androidx.compose.material.icons.filled.MonetizationOn
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.arynoxtech.erp.ui.components.EmptyView
import com.arynoxtech.erp.ui.components.ErrorView
import com.arynoxtech.erp.ui.components.LoadingIndicator
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountingScreen(
    viewModel: AccountingViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val cashBook by viewModel.cashBook.collectAsStateWithLifecycle()
    val expenses by viewModel.expenses.collectAsStateWithLifecycle()
    val incomes by viewModel.incomes.collectAsStateWithLifecycle()
    var selectedTab by remember { mutableIntStateOf(0) }
    var showAddDialog by remember { mutableStateOf(false) }
    var dialogType by remember { mutableStateOf("cash") }

    val tabs = listOf("Overview", "Cash Book", "Expenses", "Income")

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Accounting", fontWeight = FontWeight.SemiBold)
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            if (selectedTab > 0) {
                FloatingActionButton(
                    onClick = {
                        dialogType = when (selectedTab) {
                            1 -> "cash"
                            2 -> "expense"
                            3 -> "income"
                            else -> "cash"
                        }
                        showAddDialog = true
                    },
                    containerColor = MaterialTheme.colorScheme.primary
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add", tint = MaterialTheme.colorScheme.onPrimary)
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            TabRow(selectedTabIndex = selectedTab) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = { Text(title) }
                    )
                }
            }

            when {
                uiState.isLoading -> LoadingIndicator()
                uiState.error != null -> ErrorView(
                    message = uiState.error!!,
                    onRetry = { viewModel.refresh() }
                )
                else -> {
                    AnimatedContent(
                        targetState = selectedTab,
                        transitionSpec = { fadeIn() togetherWith fadeOut() },
                        label = "tab_content"
                    ) { tab ->
                        when (tab) {
                            0 -> OverviewTab(uiState)
                            1 -> CashBookTab(cashBook, viewModel)
                            2 -> ExpensesTab(expenses, viewModel)
                            3 -> IncomesTab(incomes, viewModel)
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AddEntryDialog(
            type = dialogType,
            onDismiss = { showAddDialog = false },
            onConfirm = { description, amount, category, paymentMethod ->
                when (dialogType) {
                    "cash" -> viewModel.addCashEntry("receipt", description, amount.toDoubleOrNull() ?: 0.0)
                    "expense" -> viewModel.addExpense(category, description, amount.toDoubleOrNull() ?: 0.0, paymentMethod)
                    "income" -> viewModel.addIncome(category, description, amount.toDoubleOrNull() ?: 0.0, paymentMethod)
                }
                showAddDialog = false
            }
        )
    }
}

@Composable
private fun OverviewTab(uiState: AccountingViewModel.AccountingUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "Financial Summary",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                KpiCard(
                    modifier = Modifier.weight(1f),
                    label = "Total Sales",
                    value = uiState.totalSales,
                    icon = Icons.AutoMirrored.Filled.TrendingUp,
                    color = Color(0xFF22C55E)
                )
                KpiCard(
                    modifier = Modifier.weight(1f),
                    label = "Total Purchases",
                    value = uiState.totalPurchases,
                    icon = Icons.AutoMirrored.Filled.TrendingDown,
                    color = Color(0xFFEF4444)
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                KpiCard(
                    modifier = Modifier.weight(1f),
                    label = "Net Profit",
                    value = uiState.netProfit,
                    icon = Icons.Default.MonetizationOn,
                    color = if (uiState.netProfit >= 0) Color(0xFF3B82F6) else Color(0xFFEF4444)
                )
                KpiCard(
                    modifier = Modifier.weight(1f),
                    label = "Receivable",
                    value = uiState.receivableAmount,
                    icon = Icons.Default.ArrowDownward,
                    color = Color(0xFFF59E0B)
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                KpiCard(
                    modifier = Modifier.weight(1f),
                    label = "Payable",
                    value = uiState.payableAmount,
                    icon = Icons.Default.ArrowUpward,
                    color = Color(0xFFF97316)
                )
                KpiCard(
                    modifier = Modifier.weight(1f),
                    label = "Cash Balance",
                    value = uiState.cashBalance,
                    icon = Icons.Default.AccountBalanceWallet,
                    color = Color(0xFF14B8A6)
                )
            }
        }

        item {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Recent Transactions",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
        }

        items(uiState.recentTransactions.take(10)) { transaction ->
            TransactionRow(transaction)
        }

        if (uiState.recentTransactions.isEmpty()) {
            item {
                EmptyView(message = "No recent transactions")
            }
        }
    }
}

@Composable
private fun KpiCard(
    modifier: Modifier = Modifier,
    label: String,
    value: Double,
    icon: ImageVector,
    color: Color
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(color.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "\u20B9 ${String.format("%,.2f", value)}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun TransactionRow(transaction: AccountingViewModel.TransactionItem) {
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(
                        if (transaction.isCredit) Color(0xFF22C55E).copy(alpha = 0.12f)
                        else Color(0xFFEF4444).copy(alpha = 0.12f)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (transaction.isCredit) Icons.Default.ArrowUpward else Icons.Default.ArrowDownward,
                    contentDescription = null,
                    tint = if (transaction.isCredit) Color(0xFF22C55E) else Color(0xFFEF4444),
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = transaction.description,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${transaction.type} - ${dateFormat.format(Date(transaction.date))}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Text(
                text = "${if (transaction.isCredit) "+" else "-"} \u20B9 ${String.format("%,.2f", transaction.amount)}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = if (transaction.isCredit) Color(0xFF22C55E) else Color(0xFFEF4444)
            )
        }
    }
}

@Composable
private fun CashBookTab(
    entries: List<AccountingViewModel.CashBookEntry>,
    viewModel: AccountingViewModel
) {
    if (entries.isEmpty()) {
        EmptyView(message = "No cash book entries", modifier = Modifier.fillMaxSize())
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(entries) { entry ->
                CashBookRow(entry)
            }
        }
    }
}

@Composable
private fun CashBookRow(entry: AccountingViewModel.CashBookEntry) {
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy HH:mm", Locale.getDefault()) }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(
                        if (entry.amount >= 0) Color(0xFF22C55E) else Color(0xFFEF4444)
                    )
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = entry.description.ifEmpty { entry.type },
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = dateFormat.format(Date(entry.date)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${if (entry.amount >= 0) "+" else ""}\u20B9 ${String.format("%,.2f", entry.amount)}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = if (entry.amount >= 0) Color(0xFF22C55E) else Color(0xFFEF4444)
                )
                Text(
                    text = "Bal: \u20B9 ${String.format("%,.2f", entry.balance)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun ExpensesTab(
    entries: List<AccountingViewModel.ExpenseEntry>,
    viewModel: AccountingViewModel
) {
    if (entries.isEmpty()) {
        EmptyView(message = "No expenses recorded", modifier = Modifier.fillMaxSize())
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(entries) { entry ->
                EntryRow(
                    label = entry.description,
                    subtitle = entry.category,
                    amount = entry.amount,
                    isExpense = true
                )
            }
        }
    }
}

@Composable
private fun IncomesTab(
    entries: List<AccountingViewModel.IncomeEntry>,
    viewModel: AccountingViewModel
) {
    if (entries.isEmpty()) {
        EmptyView(message = "No incomes recorded", modifier = Modifier.fillMaxSize())
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(entries) { entry ->
                EntryRow(
                    label = entry.description,
                    subtitle = entry.category,
                    amount = entry.amount,
                    isExpense = false
                )
            }
        }
    }
}

@Composable
private fun EntryRow(
    label: String,
    subtitle: String,
    amount: Double,
    isExpense: Boolean
) {
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(
                        if (isExpense) Color(0xFFEF4444).copy(alpha = 0.12f)
                        else Color(0xFF22C55E).copy(alpha = 0.12f)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isExpense) Icons.Default.ShoppingCart else Icons.Default.Receipt,
                    contentDescription = null,
                    tint = if (isExpense) Color(0xFFEF4444) else Color(0xFF22C55E),
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = label.ifEmpty { "No description" },
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (subtitle.isNotEmpty()) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Text(
                text = "\u20B9 ${String.format("%,.2f", amount)}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = if (isExpense) Color(0xFFEF4444) else Color(0xFF22C55E)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddEntryDialog(
    type: String,
    onDismiss: () -> Unit,
    onConfirm: (description: String, amount: String, category: String, paymentMethod: String) -> Unit
) {
    var description by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var paymentMethod by remember { mutableStateOf("Cash") }
    var categoryExpanded by remember { mutableStateOf(false) }
    var paymentExpanded by remember { mutableStateOf(false) }

    val categories = when (type) {
        "expense" -> listOf("Rent", "Utilities", "Salary", "Transport", "Office Supplies", "Maintenance", "Marketing", "Other")
        "income" -> listOf("Sales", "Investment", "Interest", "Rental", "Commission", "Other")
        else -> emptyList()
    }
    val paymentMethods = listOf("Cash", "Bank Transfer", "Cheque", "UPI", "Credit Card", "Debit Card")

    val title = when (type) {
        "cash" -> "Add Cash Entry"
        "expense" -> "Add Expense"
        "income" -> "Add Income"
        else -> "Add Entry"
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, fontWeight = FontWeight.SemiBold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it },
                    label = { Text("Amount") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                if (type == "expense" || type == "income") {
                    ExposedDropdownMenuBox(
                        expanded = categoryExpanded,
                        onExpandedChange = { categoryExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = category,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Category") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                            modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable, enabled = true).fillMaxWidth()
                        )
                        ExposedDropdownMenu(
                            expanded = categoryExpanded,
                            onDismissRequest = { categoryExpanded = false }
                        ) {
                            categories.forEach { cat ->
                                DropdownMenuItem(
                                    text = { Text(cat) },
                                    onClick = {
                                        category = cat
                                        categoryExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
                if (type == "expense" || type == "income") {
                    ExposedDropdownMenuBox(
                        expanded = paymentExpanded,
                        onExpandedChange = { paymentExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = paymentMethod,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Payment Method") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = paymentExpanded) },
                            modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable, enabled = true).fillMaxWidth()
                        )
                        ExposedDropdownMenu(
                            expanded = paymentExpanded,
                            onDismissRequest = { paymentExpanded = false }
                        ) {
                            paymentMethods.forEach { method ->
                                DropdownMenuItem(
                                    text = { Text(method) },
                                    onClick = {
                                        paymentMethod = method
                                        paymentExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(description, amount, category, paymentMethod) },
                enabled = description.isNotBlank() && amount.isNotBlank()
            ) {
                Text("Add")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
