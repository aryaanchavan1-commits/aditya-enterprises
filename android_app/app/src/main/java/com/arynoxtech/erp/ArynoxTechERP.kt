package com.arynoxtech.erp

import android.app.Application
import android.util.Log
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class ArynoxTechERP : Application() {

    override fun onCreate() {
        super.onCreate()

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e("ERP_CRASH", "Unhandled exception on thread: ${thread.name}", throwable)
        }
    }
}
