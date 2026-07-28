from fastapi import APIRouter
from app.api.v1.endpoints import products, categories, brands, warehouses
from app.api.v1.endpoints import suppliers, customers, sales, purchases
from app.api.v1.endpoints import accounting, barcodes, reports, groq_ai
from app.api.v1.endpoints import dashboard, settings, backup

api_router = APIRouter()

api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(brands.router, prefix="/brands", tags=["Brands"])
api_router.include_router(warehouses.router, prefix="/warehouses", tags=["Warehouses"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["Suppliers"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customers"])
api_router.include_router(sales.router, prefix="/sales", tags=["Sales"])
api_router.include_router(purchases.router, prefix="/purchases", tags=["Purchases"])
api_router.include_router(accounting.router, prefix="/accounting", tags=["Accounting"])
api_router.include_router(barcodes.router, prefix="/barcodes", tags=["Barcodes"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(groq_ai.router, prefix="/ai", tags=["AI"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
api_router.include_router(backup.router, prefix="/backup", tags=["Backup"])
