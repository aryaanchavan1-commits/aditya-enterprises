from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.product import Product, Sale, Purchase, Expense, StockMovement
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    today = datetime.now()
    today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today_sales = db.query(func.sum(Sale.total_amount)).filter(Sale.sale_date >= today_start).scalar() or 0.0
    today_orders = db.query(Sale).filter(Sale.sale_date >= today_start).count()
    month_sales = db.query(func.sum(Sale.total_amount)).filter(Sale.sale_date >= month_start).scalar() or 0.0
    total_products = db.query(Product).filter(Product.is_active == True).count()
    low_stock = db.query(Product).filter(Product.current_stock <= Product.minimum_stock, Product.is_active == True).count()
    recent_sales = db.query(Sale).order_by(Sale.created_at.desc()).limit(5).all()
    return {
        "today_sales": today_sales,
        "today_orders": today_orders,
        "monthly_sales": month_sales,
        "total_products": total_products,
        "low_stock_count": low_stock,
        "recent_sales": [{"id": s.id, "invoice": s.invoice_number, "amount": s.total_amount, "customer": s.customer_name} for s in recent_sales]
    }

@router.get("/charts")
def get_dashboard_charts(db: Session = Depends(get_db)):
    labels = []
    sales_data = []
    for i in range(6, -1, -1):
        date = datetime.now() - timedelta(days=i)
        date_start = date.replace(hour=0, minute=0, second=0)
        date_end = date.replace(hour=23, minute=59, second=59)
        day_sales = db.query(func.sum(Sale.total_amount)).filter(Sale.sale_date.between(date_start, date_end)).scalar() or 0.0
        labels.append(date.strftime("%a"))
        sales_data.append(day_sales)
    return {
        "sales_chart": {"labels": labels, "data": sales_data},
        "inventory_chart": {"labels": ["In Stock", "Low Stock", "Out of Stock"], "data": [85, 10, 5]}
    }
