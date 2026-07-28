from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.product import Brand
import uuid

router = APIRouter()

@router.get("/")
def list_brands(db: Session = Depends(get_db)):
    return db.query(Brand).filter(Brand.is_active == True).all()

@router.post("/")
def create_brand(name: str, db: Session = Depends(get_db)):
    brand = Brand(id=str(uuid.uuid4()), name=name)
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand
