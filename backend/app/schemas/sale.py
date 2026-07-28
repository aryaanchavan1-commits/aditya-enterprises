from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SaleItemCreate(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    unit: Optional[str] = "PCS"
    unit_price: float = Field(default=0.0, ge=0)
    discount_percent: Optional[float] = Field(default=0.0, ge=0)
    discount_amount: Optional[float] = Field(default=0.0, ge=0)
    taxable_amount: Optional[float] = None
    gst_rate: Optional[float] = None
    cgst_amount: Optional[float] = None
    sgst_amount: Optional[float] = None
    igst_amount: Optional[float] = None
    total_amount: Optional[float] = None

class SaleCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_gstin: Optional[str] = None
    due_date: Optional[datetime] = None
    subtotal: float = Field(default=0.0, ge=0)
    discount_amount: Optional[float] = Field(default=0.0, ge=0)
    tax_amount: Optional[float] = Field(default=0.0, ge=0)
    cgst_total: Optional[float] = Field(default=0.0, ge=0)
    sgst_total: Optional[float] = Field(default=0.0, ge=0)
    igst_total: Optional[float] = Field(default=0.0, ge=0)
    round_off: Optional[float] = Field(default=0.0)
    total_amount: float = Field(default=0.0, ge=0)
    paid_amount: Optional[float] = Field(default=0.0, ge=0)
    balance_amount: Optional[float] = Field(default=0.0, ge=0)
    payment_method: Optional[str] = "cash"
    payment_status: Optional[str] = "pending"
    sale_type: Optional[str] = "retail"
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: List[SaleItemCreate] = Field(default_factory=list)

class SaleResponse(BaseModel):
    id: str
    invoice_number: str
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    sale_date: datetime
    total_amount: float
    payment_status: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
