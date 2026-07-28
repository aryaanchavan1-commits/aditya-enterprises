from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.product import Sale, SaleItem, Product, StockMovement
from app.schemas.sale import SaleCreate, SaleResponse
import uuid
from datetime import datetime

router = APIRouter()

@router.get("/")
def list_sales(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Sale).order_by(Sale.created_at.desc()).offset(skip).limit(limit).all()

@router.post("/", response_model=SaleResponse)
def create_sale(sale: SaleCreate, db: Session = Depends(get_db)):
    today = datetime.now()
    count = db.query(Sale).filter(Sale.sale_date >= today.replace(hour=0, minute=0, second=0)).count()
    invoice_number = f"INV-{today.strftime('%Y%m%d')}-{count + 1:04d}"
    db_sale = Sale(id=str(uuid.uuid4()), invoice_number=invoice_number, **sale.model_dump(exclude={'items'}))
    db.add(db_sale)
    for item in sale.items:
        sale_item = SaleItem(id=str(uuid.uuid4()), sale_id=db_sale.id, **item.model_dump())
        db.add(sale_item)
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            old_stock = product.current_stock
            product.current_stock -= item.quantity
            movement = StockMovement(
                id=str(uuid.uuid4()),
                product_id=item.product_id,
                product_name=product.name,
                movement_type="sale",
                quantity=-item.quantity,
                before_stock=old_stock,
                after_stock=product.current_stock,
                reference_id=db_sale.id,
                reference_type="sale"
            )
            db.add(movement)
    db.commit()
    db.refresh(db_sale)
    return db_sale

@router.get("/{sale_id}")
def get_sale(sale_id: str, db: Session = Depends(get_db)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    items = db.query(SaleItem).filter(SaleItem.sale_id == sale_id).all()
    return {"sale": sale, "items": items}
