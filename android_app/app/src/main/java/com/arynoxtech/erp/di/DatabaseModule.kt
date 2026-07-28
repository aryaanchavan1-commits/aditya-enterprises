package com.arynoxtech.erp.di

import android.content.Context
import androidx.room.Room
import com.arynoxtech.erp.data.local.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "erp_database"
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides fun provideProductDao(db: AppDatabase): ProductDao = db.productDao()
    @Provides fun provideSaleDao(db: AppDatabase): SaleDao = db.saleDao()
    @Provides fun providePurchaseDao(db: AppDatabase): PurchaseDao = db.purchaseDao()
    @Provides fun provideStockMovementDao(db: AppDatabase): StockMovementDao = db.stockMovementDao()
    @Provides fun provideCustomerDao(db: AppDatabase): CustomerDao = db.customerDao()
    @Provides fun provideSupplierDao(db: AppDatabase): SupplierDao = db.supplierDao()
    @Provides fun provideAccountingDao(db: AppDatabase): AccountingDao = db.accountingDao()
    @Provides fun provideCategoryDao(db: AppDatabase): CategoryDao = db.categoryDao()
    @Provides fun provideBrandDao(db: AppDatabase): BrandDao = db.brandDao()
}
