from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.product import Supplier
import uuid

router = APIRouter()

@router.get("/")
def list_suppliers(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Supplier).filter(Supplier.is_active == True).offset(skip).limit(limit).all()

@router.post("/")
def create_supplier(name: str, phone: str = None, db: Session = Depends(get_db)):
    sup = Supplier(id=str(uuid.uuid4()), name=name, phone=phone)
    db.add(sup)
    db.commit()
    db.refresh(sup)
    return sup
