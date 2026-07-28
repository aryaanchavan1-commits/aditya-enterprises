package com.arynoxtech.erp.service

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.arynoxtech.erp.data.turso.TursoClient
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

data class SyncResult(
    val pulled: Int = 0,
    val pushed: Int = 0,
    val errors: Int = 0,
    val message: String = ""
)

@Singleton
class SyncService @Inject constructor(
    private val syncManager: SyncManager,
    private val tursoClient: TursoClient,
    @ApplicationContext private val context: Context
) {
    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences("sync_prefs", Context.MODE_PRIVATE)
    }

    companion object {
        private const val KEY_LAST_SYNC = "last_sync_time"
    }

    suspend fun configureFromSettings() = syncManager.configureFromSettings()

    fun isSyncConfigured(): Boolean = tursoClient.isConfigured()

    fun lastSyncTime(): Long? {
        val time = prefs.getLong(KEY_LAST_SYNC, -1L)
        return if (time == -1L) null else time
    }

    private fun updateLastSyncTime() {
        prefs.edit().putLong(KEY_LAST_SYNC, System.currentTimeMillis()).apply()
    }

    suspend fun syncProducts(): Result<SyncResult> = withContext(Dispatchers.IO) {
        try {
            val result = syncManager.pullAll()
            if (result.isSuccess) {
                updateLastSyncTime()
                Result.success(SyncResult(message = "Connection OK"))
            } else {
                Result.failure(result.exceptionOrNull() ?: Exception("Sync failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun syncAll(): Result<SyncResult> = withContext(Dispatchers.IO) {
        try {
            val pullResult = syncManager.pullAll()
            if (pullResult.isSuccess) {
                updateLastSyncTime()
                Result.success(SyncResult(message = "Sync completed successfully"))
            } else {
                Result.failure(pullResult.exceptionOrNull() ?: Exception("Sync failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun syncAllWithPush(): Result<SyncResult> = withContext(Dispatchers.IO) {
        try {
            Log.d("SyncService", "Starting syncAllWithPush")
            val pushResult = syncManager.pushAll()
            Log.d("SyncService", "pushAll result: ${pushResult.isSuccess}")
            if (pushResult.isFailure) {
                Log.e("SyncService", "pushAll failed: ${pushResult.exceptionOrNull()?.message}")
            }
            val pullResult = syncManager.pullAll()
            Log.d("SyncService", "pullAll result: ${pullResult.isSuccess}")
            if (pullResult.isSuccess) {
                updateLastSyncTime()
                Log.d("SyncService", "Sync completed successfully")
                Result.success(SyncResult(message = "Push+Sync completed"))
            } else {
                val err = pullResult.exceptionOrNull()
                Log.e("SyncService", "pullAll failed: ${err?.message}")
                Result.failure(err ?: Exception("Sync failed"))
            }
        } catch (e: Exception) {
            Log.e("SyncService", "syncAllWithPush exception: ${e.message}")
            Result.failure(e)
        }
    }
}
