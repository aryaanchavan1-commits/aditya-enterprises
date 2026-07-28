from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.product import Warehouse
import uuid

router = APIRouter()

@router.get("/")
def list_warehouses(db: Session = Depends(get_db)):
    return db.query(Warehouse).filter(Warehouse.is_active == True).all()

@router.post("/")
def create_warehouse(name: str, code: str, db: Session = Depends(get_db)):
    wh = Warehouse(id=str(uuid.uuid4()), name=name, code=code)
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh
