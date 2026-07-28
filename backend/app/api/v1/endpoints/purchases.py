from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.product import Purchase, PurchaseItem, Product, StockMovement
from app.schemas.purchase import PurchaseCreate
import uuid

router = APIRouter()

@router.get("/")
def list_purchases(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Purchase).order_by(Purchase.created_at.desc()).offset(skip).limit(limit).all()

@router.post("/")
def create_purchase(purchase: PurchaseCreate, db: Session = Depends(get_db)):
    db_purchase = Purchase(id=str(uuid.uuid4()), **purchase.model_dump(exclude={'items'}))
    db.add(db_purchase)
    for item in purchase.items:
        purchase_item = PurchaseItem(id=str(uuid.uuid4()), purchase_id=db_purchase.id, **item.model_dump())
        db.add(purchase_item)
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            old_stock = product.current_stock
            product.current_stock += item.quantity
            movement = StockMovement(
                id=str(uuid.uuid4()),
                product_id=item.product_id,
                product_name=product.name,
                movement_type="purchase",
                quantity=item.quantity,
                before_stock=old_stock,
                after_stock=product.current_stock,
                reference_id=db_purchase.id,
                reference_type="purchase"
            )
            db.add(movement)
    db.commit()
    db.refresh(db_purchase)
    return db_purchase
