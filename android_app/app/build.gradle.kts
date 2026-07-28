plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.arynoxtech.erp"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.arynoxtech.erp"
        minSdk = 30
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            storeFile = file("arynoxtech_keystore.jks")
            storePassword = "arynoxtech"
            keyAlias = "arynoxtech"
            keyPassword = "arynoxtech"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs = listOf("-opt-in=kotlin.RequiresOptIn")
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    // AndroidX Core
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)

    // Compose
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    debugImplementation(libs.compose.ui.tooling)

    // Navigation
    implementation(libs.navigation.compose)

    // Room
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // OkHttp
    implementation(libs.okhttp)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)
    implementation(libs.hilt.work)

    // Coroutines
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.coroutines.android)

    // Lifecycle
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)

    // DataStore
    implementation(libs.datastore.preferences)

    // CameraX
    implementation(libs.camera.camera2)
    implementation(libs.camera.lifecycle)
    implementation(libs.camera.view)

    // ML Kit Barcode
    implementation(libs.play.services.mlkit.barcode.scanning)

    // ZXing
    implementation(libs.zxing.core)
    implementation(libs.zxing.javase)

    // Apache POI
    implementation(libs.apache.poi.ooxml)

    // iText 7
    implementation(libs.itext7.core.kernel)
    implementation(libs.itext7.core.layout)
    implementation(libs.itext7.core.io)
    implementation(libs.itext7.core.forms)
    implementation(libs.itext7.core.pdfa)

    // Billing
    implementation(libs.billingclient)

    // Accompanist
    implementation(libs.accompanist.permissions)
    implementation(libs.accompanist.swiperefresh)
}
