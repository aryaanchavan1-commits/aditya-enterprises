package com.arynoxtech.erp.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF1E3A8A),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFDBEAFE),
    onPrimaryContainer = Color(0xFF1E3A8A),
    secondary = Color(0xFF3B82F6),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFBFDBFE),
    onSecondaryContainer = Color(0xFF1E40AF),
    tertiary = Color(0xFF06B6D4),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFCFFAFE),
    onTertiaryContainer = Color(0xFF155E75),
    error = Color(0xFFEF4444),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFEE2E2),
    onErrorContainer = Color(0xFF991B1B),
    background = Color(0xFFF8FAFC),
    onBackground = Color(0xFF1E293B),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1E293B),
    surfaceVariant = Color(0xFFF1F5F9),
    onSurfaceVariant = Color(0xFF64748B),
    outline = Color(0xFFE2E8F0),
    outlineVariant = Color(0xFFCBD5E1),
    surfaceContainerHighest = Color(0xFFF1F5F9),
    surfaceContainer = Color(0xFFF8FAFC),
    surfaceContainerLow = Color(0xFFF8FAFC),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    inverseSurface = Color(0xFF1E293B),
    inverseOnSurface = Color(0xFFF1F5F9),
    inversePrimary = Color(0xFF60A5FA),
    scrim = Color(0xFF000000)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF60A5FA),
    onPrimary = Color(0xFF1E3A8A),
    primaryContainer = Color(0xFF1E3A8A),
    onPrimaryContainer = Color(0xFFDBEAFE),
    secondary = Color(0xFF93C5FD),
    onSecondary = Color(0xFF1E3A8A),
    secondaryContainer = Color(0xFF1E40AF),
    onSecondaryContainer = Color(0xFFBFDBFE),
    tertiary = Color(0xFF67E8F9),
    onTertiary = Color(0xFF155E75),
    tertiaryContainer = Color(0xFF155E75),
    onTertiaryContainer = Color(0xFFCFFAFE),
    error = Color(0xFFFCA5A5),
    onError = Color(0xFF991B1B),
    errorContainer = Color(0xFF991B1B),
    onErrorContainer = Color(0xFFFEE2E2),
    background = Color(0xFF0F172A),
    onBackground = Color(0xFFF1F5F9),
    surface = Color(0xFF1E293B),
    onSurface = Color(0xFFF1F5F9),
    surfaceVariant = Color(0xFF334155),
    onSurfaceVariant = Color(0xFF94A3B8),
    outline = Color(0xFF475569),
    outlineVariant = Color(0xFF334155),
    surfaceContainerHighest = Color(0xFF334155),
    surfaceContainer = Color(0xFF1E293B),
    surfaceContainerLow = Color(0xFF1E293B),
    surfaceContainerLowest = Color(0xFF0F172A),
    inverseSurface = Color(0xFFF1F5F9),
    inverseOnSurface = Color(0xFF1E293B),
    inversePrimary = Color(0xFF1E3A8A),
    scrim = Color(0xFF000000)
)

@Composable
fun ArynoxTechERPTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColors else LightColors

    MaterialTheme(
        colorScheme = colorScheme,
        typography = AppTypography,
        shapes = AppShapes,
        content = content
    )
}

fun stockColor(stock: Int, minStock: Int): Color {
    return when {
        stock <= 0 -> Color(0xFFEF4444)
        stock <= minStock -> Color(0xFFEAB308)
        else -> Color(0xFF22C55E)
    }
}

fun statusColor(status: String): Color {
    return when (status.lowercase()) {
        "pending", "draft" -> Color(0xFFEAB308)
        "confirmed", "approved" -> Color(0xFF3B82F6)
        "shipped", "delivered", "received", "completed" -> Color(0xFF22C55E)
        "cancelled", "returned", "rejected" -> Color(0xFFEF4444)
        "refunded" -> Color(0xFF8B5CF6)
        "partial" -> Color(0xFFF97316)
        else -> Color(0xFF94A3B8)
    }
}

fun profitColor(percentage: Double): Color {
    return if (percentage >= 0) Color(0xFF22C55E) else Color(0xFFEF4444)
}
