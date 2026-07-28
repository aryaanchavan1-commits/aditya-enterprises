from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import uuid
import shutil
import os
from PIL import Image
from app.core.database import get_db
from app.core.config import settings
from app.models.product import Product as ProductModel
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, ProductList

router = APIRouter()

@router.post("/", response_model=ProductResponse)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = ProductModel(**product.model_dump(), images=json.dumps(product.images or []))
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    db_product.images = json.loads(db_product.images or "[]")
    return db_product

@router.get("/", response_model=ProductList)
def list_products(
    skip: int = 0,
    limit: int = Query(default=50, le=500),
    category: Optional[str] = None,
    brand: Optional[str] = None,
    search: Optional[str] = None,
    low_stock: bool = False,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db)
):
    query = db.query(ProductModel)
    if category:
        query = query.filter(ProductModel.category_id == category)
    if brand:
        query = query.filter(ProductModel.brand_id == brand)
    if search:
        query = query.filter(
            ProductModel.name.ilike(f"%{search}%") |
            ProductModel.sku.ilike(f"%{search}%") |
            ProductModel.barcode.ilike(f"%{search}%")
        )
    if low_stock:
        query = query.filter(ProductModel.current_stock <= ProductModel.minimum_stock)
    total = query.count()
    if sort_order == "desc":
        query = query.order_by(getattr(ProductModel, sort_by).desc())
    else:
        query = query.order_by(getattr(ProductModel, sort_by))
    products = query.offset(skip).limit(limit).all()
    for p in products:
        p.images = json.loads(p.images or "[]")
    return {"items": products, "total": total, "skip": skip, "limit": limit}

@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.images = json.loads(product.images or "[]")
    return product

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: str, product: ProductUpdate, db: Session = Depends(get_db)):
    db_product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    update_data = product.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_product, field, value)
    db.commit()
    db.refresh(db_product)
    db_product.images = json.loads(db_product.images or "[]")
    return db_product

@router.delete("/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    db.commit()
    return {"message": "Product deleted successfully"}

@router.post("/{product_id}/images")
async def upload_product_image(product_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid image type")
    upload_dir = os.path.join(settings.BASE_PATH, "data", "images", "products", product_id)
    os.makedirs(upload_dir, exist_ok=True)
    ext = file.filename.split(".")[-1].lower()
    if ext == "jpg":
        ext = "jpeg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    with Image.open(filepath) as img:
        thumb = img.copy()
        thumb.thumbnail((300, 300), Image.LANCZOS)
        thumb_path = os.path.join(upload_dir, f"thumb_{filename}")
        thumb.save(thumb_path, optimize=True, quality=85)
        if os.path.getsize(filepath) > 1024 * 1024:
            img.save(filepath, optimize=True, quality=85)
    images = json.loads(product.images or "[]")
    images.append(filename)
    product.images = json.dumps(images)
    db.commit()
    return {"filename": filename, "thumbnail": f"thumb_{filename}", "path": filepath}

@router.delete("/{product_id}/images/{filename}")
def delete_product_image(product_id: str, filename: str, db: Session = Depends(get_db)):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    images = json.loads(product.images or "[]")
    if filename in images:
        images.remove(filename)
        product.images = json.dumps(images)
        db.commit()
        upload_dir = os.path.join(settings.BASE_PATH, "data", "images", "products", product_id)
        for f in [filename, f"thumb_{filename}"]:
            fp = os.path.join(upload_dir, f)
            if os.path.exists(fp):
                os.remove(fp)
    return {"message": "Image deleted"}

@router.get("/{product_id}/barcode")
def get_product_barcode(product_id: str, db: Session = Depends(get_db)):
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if not product.barcode:
        product.barcode = f"ARNX{product.sku}"
        db.commit()
    return {"barcode": product.barcode, "qr_code": product.qr_code}

@router.get("/low-stock/list")
def get_low_stock_products(db: Session = Depends(get_db)):
    products = db.query(ProductModel).filter(
        ProductModel.current_stock <= ProductModel.minimum_stock,
        ProductModel.is_active == True
    ).all()
    for p in products:
        p.images = json.loads(p.images or "[]")
    return products

@router.get("/dead-stock/list")
def get_dead_stock_products(days: int = Query(default=90, ge=30), db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    cutoff_date = datetime.now() - timedelta(days=days)
    products = db.query(ProductModel).filter(
        ProductModel.updated_at < cutoff_date,
        ProductModel.current_stock > 0,
        ProductModel.is_active == True
    ).all()
    for p in products:
        p.images = json.loads(p.images or "[]")
    return products
