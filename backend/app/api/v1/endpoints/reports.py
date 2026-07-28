from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.product import Product, Sale, Purchase, Expense
from app.reports.report_generator import ReportGenerator
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/inventory")
def inventory_report(db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.is_active == True).all()
    total_value = sum(p.current_stock * p.purchase_price for p in products)
    total_items = len(products)
    low_stock = len([p for p in products if p.current_stock <= p.minimum_stock])
    return {
        "generated_at": datetime.now(),
        "total_products": total_items,
        "total_inventory_value": total_value,
        "low_stock_items": low_stock,
        "products": [{"name": p.name, "sku": p.sku, "stock": p.current_stock, "value": p.current_stock * p.purchase_price} for p in products]
    }

@router.get("/sales")
def sales_report(start_date: datetime = None, end_date: datetime = None, db: Session = Depends(get_db)):
    if not start_date:
        start_date = datetime.now() - timedelta(days=30)
    if not end_date:
        end_date = datetime.now()
    sales = db.query(Sale).filter(Sale.sale_date.between(start_date, end_date)).all()
    return {
        "period": {"start": start_date, "end": end_date},
        "total_sales": len(sales),
        "total_revenue": sum(s.total_amount for s in sales),
        "total_tax": sum(s.tax_amount for s in sales),
        "avg_order_value": sum(s.total_amount for s in sales) / len(sales) if sales else 0,
        "sales": sales
    }

@router.get("/export/{report_type}")
def export_report(report_type: str, format: str = "pdf", db: Session = Depends(get_db)):
    if report_type == "inventory":
        data = inventory_report(db=db)
        headers = ["Product", "SKU", "Stock", "Value"]
        rows = [[p["name"], p["sku"], str(p["stock"]), f"Rs.{p['value']:.2f}"] for p in data["products"]]
        if format == "pdf":
            buffer = ReportGenerator.generate_pdf("Inventory Report", headers, rows)
            return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=inventory_report.pdf"})
        elif format == "excel":
            excel_data = {"Inventory": data["products"]}
            buffer = ReportGenerator.generate_excel("Inventory Report", excel_data)
            return Response(content=buffer.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=inventory_report.xlsx"})
    return {"error": "Report type not supported"}
