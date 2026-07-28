from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    sku: str = Field(..., min_length=1, max_length=100)
    hsn_code: Optional[str] = None
    barcode: Optional[str] = None
    qr_code: Optional[str] = None
    description: Optional[str] = None
    category: str = Field(..., min_length=1)
    sub_category: Optional[str] = None
    brand: Optional[str] = None
    unit: str = "PCS"
    purchase_price: float = Field(default=0.0, ge=0)
    selling_price: float = Field(default=0.0, ge=0)
    mrp: Optional[float] = Field(default=0.0, ge=0)
    discount: Optional[float] = Field(default=0.0, ge=0)
    discount_type: Optional[str] = "percentage"
    tax: Optional[float] = None
    gst_rate: Optional[float] = Field(default=18.0, ge=0, le=100)
    cgst: Optional[float] = None
    sgst: Optional[float] = None
    igst: Optional[float] = None
    minimum_stock: int = Field(default=0, ge=0)
    maximum_stock: int = Field(default=0, ge=0)
    opening_stock: int = Field(default=0, ge=0)
    current_stock: int = Field(default=0, ge=0)
    warehouse: Optional[str] = None
    supplier: Optional[str] = None
    location: Optional[str] = None
    expiry_date: Optional[datetime] = None
    manufacturing_date: Optional[datetime] = None
    batch_number: Optional[str] = None
    serial_number: Optional[str] = None
    weight: Optional[float] = None
    weight_unit: Optional[str] = "kg"
    dimensions: Optional[str] = None
    notes: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    tags: Optional[str] = None
    is_active: bool = True
    is_featured: bool = False

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    hsn_code: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None
    brand: Optional[str] = None
    unit: Optional[str] = None
    purchase_price: Optional[float] = None
    selling_price: Optional[float] = None
    mrp: Optional[float] = None
    discount: Optional[float] = None
    discount_type: Optional[str] = None
    tax: Optional[float] = None
    gst_rate: Optional[float] = None
    minimum_stock: Optional[int] = None
    maximum_stock: Optional[int] = None
    current_stock: Optional[int] = None
    warehouse: Optional[str] = None
    supplier: Optional[str] = None
    location: Optional[str] = None
    expiry_date: Optional[datetime] = None
    manufacturing_date: Optional[datetime] = None
    batch_number: Optional[str] = None
    serial_number: Optional[str] = None
    weight: Optional[float] = None
    dimensions: Optional[str] = None
    notes: Optional[str] = None
    images: Optional[List[str]] = None
    tags: Optional[str] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None

class ProductResponse(ProductBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None

    class Config:
        from_attributes = True

class ProductList(BaseModel):
    items: List[ProductResponse]
    total: int
    skip: int
    limit: int
