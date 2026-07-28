# ArynoxTech ERP ProGuard Rules
# Keep Moshi adapters
-keepclassmembers class com.arynoxtech.erp.data.remote.dto.** {
    @com.squareup.moshi.Json <fields>;
}
-keep class com.arynoxtech.erp.data.remote.dto.** { *; }

# Keep Room entities
-keepclassmembers class com.arynoxtech.erp.data.local.** {
    @androidx.room.Entity <fields>;
}

# Keep Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }

# Keep coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# Keep Moshi
-dontwarn okhttp3.**
-dontwarn com.squareup.moshi.**

# Keep iText
-keep class com.itextpdf.** { *; }
-dontwarn com.itextpdf.**

# Keep Apache POI
-keep class org.apache.poi.** { *; }
-dontwarn org.apache.poi.**

# Keep ZXing
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**

# Keep ML Kit
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# Keep CameraX
-keep class androidx.camera.** { *; }

# Hilt/Dagger
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ViewComponentManager$FragmentContextWrapper { *; }

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-keep @androidx.room.Dao class *

# OkHttp
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Gson/Moshi
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }
-keepattributes EnclosingMethod

# Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }

# Compose
-dontwarn androidx.compose.**

# Keep our app models
-keep class com.arynoxtech.erp.data.** { *; }
-keep class com.arynoxtech.erp.service.** { *; }
