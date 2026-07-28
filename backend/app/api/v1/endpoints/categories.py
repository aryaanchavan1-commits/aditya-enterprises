from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.product import Category
import uuid

router = APIRouter()

@router.get("/")
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).filter(Category.is_active == True).all()

@router.post("/")
def create_category(name: str, description: str = None, db: Session = Depends(get_db)):
    cat = Category(id=str(uuid.uuid4()), name=name, description=description)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat
