from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.product import Customer
import uuid

router = APIRouter()

@router.get("/")
def list_customers(skip: int = 0, limit: int = 50, search: str = None, db: Session = Depends(get_db)):
    query = db.query(Customer).filter(Customer.is_active == True)
    if search:
        query = query.filter(Customer.name.ilike(f"%{search}%") | Customer.phone.ilike(f"%{search}%"))
    return query.offset(skip).limit(limit).all()

@router.post("/")
def create_customer(name: str, phone: str = None, db: Session = Depends(get_db)):
    cust = Customer(id=str(uuid.uuid4()), name=name, phone=phone)
    db.add(cust)
    db.commit()
    db.refresh(cust)
    return cust
