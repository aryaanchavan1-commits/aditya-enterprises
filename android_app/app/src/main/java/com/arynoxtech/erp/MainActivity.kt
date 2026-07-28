package com.arynoxtech.erp

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.rememberNavController
import com.arynoxtech.erp.service.AppLocaleHelper
import com.arynoxtech.erp.ui.components.AppScaffold
import com.arynoxtech.erp.ui.navigation.NavRoutes
import com.arynoxtech.erp.ui.components.TopAppBarConfig
import com.arynoxtech.erp.ui.navigation.AppNavHost
import com.arynoxtech.erp.ui.screens.lock.LockScreen
import com.arynoxtech.erp.ui.screens.settings.SettingsViewModel
import com.arynoxtech.erp.service.SyncService
import com.arynoxtech.erp.ui.theme.ArynoxTechERPTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var syncService: SyncService

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(AppLocaleHelper.applyLocale(newBase))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            if (Build.VERSION.SDK_INT < 35) {
                @Suppress("DEPRECATION")
                androidx.core.view.WindowCompat.setDecorFitsSystemWindows(window, false)
            }
        } catch (_: Exception) { }

        lifecycleScope.launch(Dispatchers.IO) {
            delay(1000)
            Log.d("SyncLoop", "Starting auto sync")
            while (isActive) {
                val result = syncService.syncAllWithPush()
                result.onSuccess { Log.d("SyncLoop", "OK: ${it.message}") }
                result.onFailure {
                    Log.e("SyncLoop", "FAIL: ${it.message}")
                    if (it.message?.contains("Database") == true || it.message?.contains("top up") == true) {
                        Log.w("SyncLoop", "DATABASE FULL WARNING: ${it.message}")
                    }
                }
                delay(5000)
            }
        }

        setContent {
            ArynoxTechERPTheme {
                val settingsVm: SettingsViewModel = hiltViewModel()
                val settingsState by settingsVm.uiState.collectAsState()
                val isLocked = settingsState.isPasswordEnabled && !settingsState.isUnlocked

                when {
                    settingsState.isInitialLoading -> {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) { CircularProgressIndicator() }
                    }
                    settingsState.fatalError != null -> {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = settingsState.fatalError!!,
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = MaterialTheme.colorScheme.error
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Button(onClick = { recreate() }) {
                                    Text("Restart App")
                                }
                            }
                        }
                    }
                    isLocked -> {
                        Surface(
                            modifier = Modifier.fillMaxSize(),
                            color = MaterialTheme.colorScheme.background
                        ) {
                            LockScreen(
                                onUnlock = { password ->
                                    settingsVm.unlock(password)
                                }
                            )
                        }
                    }
                    else -> {
                        val navController = rememberNavController()
                        AppScaffold(
                            navController = navController,
                            title = "Aditya Enterprises",
                            topAppBarConfig = TopAppBarConfig(
                                onSearchClick = {
                                    navController.navigate(NavRoutes.Inventory.route) {
                                        popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                onNotificationsClick = { },
                                onSettingsClick = {
                                    navController.navigate(NavRoutes.Settings.route) {
                                        launchSingleTop = true
                                    }
                                }
                            )
                        ) { paddingModifier ->
                            AppNavHost(
                                navController = navController,
                                modifier = paddingModifier
                            )
                        }
                    }
                }
            }
        }
    }
}
