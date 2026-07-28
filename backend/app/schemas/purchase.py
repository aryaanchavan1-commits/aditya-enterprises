from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class PurchaseItemCreate(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(default=0.0, ge=0)
    discount: Optional[float] = Field(default=0.0, ge=0)
    tax_amount: Optional[float] = Field(default=0.0, ge=0)
    total_amount: Optional[float] = None
    received_quantity: Optional[int] = Field(default=0, ge=0)

class PurchaseCreate(BaseModel):
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    due_date: Optional[datetime] = None
    subtotal: float = Field(default=0.0, ge=0)
    discount_amount: Optional[float] = Field(default=0.0, ge=0)
    tax_amount: Optional[float] = Field(default=0.0, ge=0)
    shipping_cost: Optional[float] = Field(default=0.0, ge=0)
    other_charges: Optional[float] = Field(default=0.0, ge=0)
    total_amount: float = Field(default=0.0, ge=0)
    paid_amount: Optional[float] = Field(default=0.0, ge=0)
    balance_amount: Optional[float] = Field(default=0.0, ge=0)
    payment_status: Optional[str] = "pending"
    status: Optional[str] = "ordered"
    notes: Optional[str] = None
    items: List[PurchaseItemCreate] = Field(default_factory=list)
