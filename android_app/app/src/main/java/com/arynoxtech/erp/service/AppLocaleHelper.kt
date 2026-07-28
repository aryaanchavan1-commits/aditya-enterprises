package com.arynoxtech.erp.service

import android.content.Context
import android.content.res.Configuration
import java.util.Locale

object AppLocaleHelper {
    private const val PREFS_NAME = "erp_settings"
    private const val KEY_LANGUAGE = "language"

    fun getSavedLanguage(context: Context): String {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_LANGUAGE, "en") ?: "en"
    }

    fun applyLocale(context: Context): Context {
        val lang = getSavedLanguage(context)
        val locale = Locale.forLanguageTag(lang)
        Locale.setDefault(locale)
        val config = Configuration(context.resources.configuration)
        config.setLocale(locale)
        return context.createConfigurationContext(config)
    }
}
