from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Product(Base):
    __tablename__ = "products"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    name = Column(String(255), nullable=False, index=True)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    hsn_code = Column(String(50))
    barcode = Column(String(100), index=True)
    qr_code = Column(String(255))
    description = Column(Text)
    category_id = Column(String(36), ForeignKey("categories.id"))
    sub_category = Column(String(100))
    brand_id = Column(String(36), ForeignKey("brands.id"))
    unit = Column(String(20), default="PCS")
    purchase_price = Column(Float, default=0.0)
    selling_price = Column(Float, default=0.0)
    mrp = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    discount_type = Column(String(20), default="percentage")  # percentage or fixed
    tax = Column(Float, default=0.0)
    gst_rate = Column(Float, default=18.0)
    cgst = Column(Float, default=9.0)
    sgst = Column(Float, default=9.0)
    igst = Column(Float, default=18.0)
    minimum_stock = Column(Integer, default=0)
    maximum_stock = Column(Integer, default=0)
    opening_stock = Column(Integer, default=0)
    current_stock = Column(Integer, default=0)
    warehouse_id = Column(String(36), ForeignKey("warehouses.id"))
    supplier_id = Column(String(36), ForeignKey("suppliers.id"))
    location = Column(String(100))
    expiry_date = Column(DateTime)
    manufacturing_date = Column(DateTime)
    batch_number = Column(String(100))
    serial_number = Column(String(100))
    weight = Column(Float)
    weight_unit = Column(String(20), default="kg")
    dimensions = Column(String(100))
    notes = Column(Text)
    images = Column(Text, default="[]")
    tags = Column(String(500))
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(36))

class Category(Base):
    __tablename__ = "categories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    parent_id = Column(String(36), ForeignKey("categories.id"), nullable=True)
    icon = Column(String(100))
    color = Column(String(20), default="#1E3A8A")
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Brand(Base):
    __tablename__ = "brands"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    logo = Column(String(255))
    website = Column(String(255))
    contact_email = Column(String(100))
    contact_phone = Column(String(20))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True)
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    pincode = Column(String(10))
    country = Column(String(100), default="India")
    manager_name = Column(String(100))
    manager_phone = Column(String(20))
    capacity = Column(Integer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True)
    contact_person = Column(String(100))
    email = Column(String(100))
    phone = Column(String(20))
    alternate_phone = Column(String(20))
    gstin = Column(String(20))
    pan = Column(String(20))
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    pincode = Column(String(10))
    country = Column(String(100), default="India")
    bank_name = Column(String(100))
    bank_account = Column(String(50))
    ifsc_code = Column(String(20))
    upi_id = Column(String(100))
    credit_limit = Column(Float, default=0.0)
    credit_days = Column(Integer, default=30)
    rating = Column(Float, default=5.0)
    is_active = Column(Boolean, default=True)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True)
    type = Column(String(20), default="retail")  # retail, wholesale, distributor
    email = Column(String(100))
    phone = Column(String(20))
    alternate_phone = Column(String(20))
    gstin = Column(String(20))
    pan = Column(String(20))
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    pincode = Column(String(10))
    country = Column(String(100), default="India")
    credit_limit = Column(Float, default=0.0)
    credit_days = Column(Integer, default=0)
    loyalty_points = Column(Integer, default=0)
    total_purchases = Column(Float, default=0.0)
    last_purchase_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Sale(Base):
    __tablename__ = "sales"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id"))
    customer_name = Column(String(255))
    customer_phone = Column(String(20))
    customer_gstin = Column(String(20))
    sale_date = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(DateTime)
    subtotal = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    cgst_total = Column(Float, default=0.0)
    sgst_total = Column(Float, default=0.0)
    igst_total = Column(Float, default=0.0)
    round_off = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    paid_amount = Column(Float, default=0.0)
    balance_amount = Column(Float, default=0.0)
    payment_method = Column(String(50), default="cash")  # cash, card, upi, credit
    payment_status = Column(String(20), default="pending")  # pending, partial, paid
    sale_type = Column(String(20), default="retail")  # retail, wholesale, pos
    status = Column(String(20), default="active")  # active, returned, cancelled
    notes = Column(Text)
    terms = Column(Text)
    created_by = Column(String(36))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sale_id = Column(String(36), ForeignKey("sales.id"), nullable=False)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False)
    product_name = Column(String(255))
    product_sku = Column(String(100))
    quantity = Column(Integer, default=1)
    unit = Column(String(20))
    unit_price = Column(Float, default=0.0)
    discount_percent = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    taxable_amount = Column(Float, default=0.0)
    gst_rate = Column(Float, default=0.0)
    cgst_amount = Column(Float, default=0.0)
    sgst_amount = Column(Float, default=0.0)
    igst_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    purchase_number = Column(String(50), unique=True, nullable=False)
    supplier_id = Column(String(36), ForeignKey("suppliers.id"))
    supplier_name = Column(String(255))
    purchase_date = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(DateTime)
    subtotal = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    shipping_cost = Column(Float, default=0.0)
    other_charges = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    paid_amount = Column(Float, default=0.0)
    balance_amount = Column(Float, default=0.0)
    payment_status = Column(String(20), default="pending")
    status = Column(String(20), default="ordered")  # ordered, received, returned, cancelled
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    purchase_id = Column(String(36), ForeignKey("purchases.id"), nullable=False)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False)
    product_name = Column(String(255))
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    received_quantity = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False)
    product_name = Column(String(255))
    movement_type = Column(String(50), nullable=False)  # sale, purchase, return, adjustment, transfer
    quantity = Column(Integer, default=0)
    before_stock = Column(Integer, default=0)
    after_stock = Column(Integer, default=0)
    reference_id = Column(String(36))  # sale_id or purchase_id
    reference_type = Column(String(50))  # sale, purchase
    warehouse_id = Column(String(36), ForeignKey("warehouses.id"))
    notes = Column(Text)
    created_by = Column(String(36))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CashBook(Base):
    __tablename__ = "cash_book"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    date = Column(DateTime(timezone=True), server_default=func.now())
    voucher_number = Column(String(50), unique=True)
    transaction_type = Column(String(20), nullable=False)  # receipt, payment
    category = Column(String(100))
    description = Column(Text)
    amount = Column(Float, default=0.0)
    balance = Column(Float, default=0.0)
    reference_id = Column(String(36))
    reference_type = Column(String(50))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class BankBook(Base):
    __tablename__ = "bank_book"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    bank_name = Column(String(100), nullable=False)
    account_number = Column(String(50), nullable=False)
    ifsc_code = Column(String(20))
    date = Column(DateTime(timezone=True), server_default=func.now())
    transaction_type = Column(String(20), nullable=False)  # deposit, withdrawal
    description = Column(Text)
    amount = Column(Float, default=0.0)
    balance = Column(Float, default=0.0)
    reference_id = Column(String(36))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    date = Column(DateTime(timezone=True), server_default=func.now())
    category = Column(String(100), nullable=False)
    sub_category = Column(String(100))
    description = Column(Text)
    amount = Column(Float, default=0.0)
    payment_method = Column(String(50), default="cash")
    vendor = Column(String(255))
    receipt_number = Column(String(50))
    is_recurring = Column(Boolean, default=False)
    recurring_frequency = Column(String(20))  # daily, weekly, monthly, yearly
    gst_amount = Column(Float, default=0.0)
    tax_deductible = Column(Boolean, default=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Income(Base):
    __tablename__ = "income"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    date = Column(DateTime(timezone=True), server_default=func.now())
    category = Column(String(100), nullable=False)
    sub_category = Column(String(100))
    description = Column(Text)
    amount = Column(Float, default=0.0)
    payment_method = Column(String(50), default="cash")
    customer = Column(String(255))
    invoice_number = Column(String(50))
    is_recurring = Column(Boolean, default=False)
    gst_amount = Column(Float, default=0.0)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    date = Column(DateTime(timezone=True), server_default=func.now())
    entry_number = Column(String(50), unique=True, nullable=False)
    debit_account = Column(String(100), nullable=False)
    credit_account = Column(String(100), nullable=False)
    amount = Column(Float, default=0.0)
    description = Column(Text)
    reference = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(100), unique=True)
    full_name = Column(String(255))
    phone = Column(String(20))
    password_hash = Column(String(255))
    role = Column(String(20), default="admin")  # admin, manager, cashier, viewer
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
