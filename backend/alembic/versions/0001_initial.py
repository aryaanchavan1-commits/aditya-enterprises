from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import func

# revision identifiers, used by Alembic.
revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # products + related tables live in app/models/product.py
    # Initial migration includes all tables currently defined in that module.

    op.create_table(
        'products',
        sa.Column('id', sa.String(length=36), primary_key=True, index=True),
        sa.Column('name', sa.String(length=255), nullable=False, index=True),
        sa.Column('sku', sa.String(length=100), nullable=False, unique=True, index=True),
        sa.Column('hsn_code', sa.String(length=50)),
        sa.Column('barcode', sa.String(length=100), index=True),
        sa.Column('qr_code', sa.String(length=255)),
        sa.Column('description', sa.Text()),
        sa.Column('category_id', sa.String(length=36), sa.ForeignKey('categories.id')),
        sa.Column('sub_category', sa.String(length=100)),
        sa.Column('brand_id', sa.String(length=36), sa.ForeignKey('brands.id')),
        sa.Column('unit', sa.String(length=20), server_default=sa.text("'PCS'")),
        sa.Column('purchase_price', sa.Float(), server_default=sa.text("0.0")),
        sa.Column('selling_price', sa.Float(), server_default=sa.text("0.0")),
        sa.Column('mrp', sa.Float(), server_default=sa.text("0.0")),
        sa.Column('discount', sa.Float(), server_default=sa.text("0.0")),
        sa.Column('discount_type', sa.String(length=20), server_default=sa.text("'percentage'")),
        sa.Column('tax', sa.Float(), server_default=sa.text("0.0")),
        sa.Column('gst_rate', sa.Float(), server_default=sa.text("18.0")),
        sa.Column('cgst', sa.Float(), server_default=sa.text("9.0")),
        sa.Column('sgst', sa.Float(), server_default=sa.text("9.0")),
        sa.Column('igst', sa.Float(), server_default=sa.text("18.0")),
        sa.Column('minimum_stock', sa.Integer(), server_default=sa.text("0")),
        sa.Column('maximum_stock', sa.Integer(), server_default=sa.text("0")),
        sa.Column('opening_stock', sa.Integer(), server_default=sa.text("0")),
        sa.Column('current_stock', sa.Integer(), server_default=sa.text("0")),
        sa.Column('warehouse_id', sa.String(length=36), sa.ForeignKey('warehouses.id')),
        sa.Column('supplier_id', sa.String(length=36), sa.ForeignKey('suppliers.id')),
        sa.Column('location', sa.String(length=100)),
        sa.Column('expiry_date', sa.DateTime()),
        sa.Column('manufacturing_date', sa.DateTime()),
        sa.Column('batch_number', sa.String(length=100)),
        sa.Column('serial_number', sa.String(length=100)),
        sa.Column('weight', sa.Float()),
        sa.Column('weight_unit', sa.String(length=20), server_default=sa.text("'kg'")),
        sa.Column('dimensions', sa.String(length=100)),
        sa.Column('notes', sa.Text()),
        sa.Column('images', sa.Text(), server_default=sa.text("'[]'")),
        sa.Column('tags', sa.String(length=500)),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text("1")),
        sa.Column('is_featured', sa.Boolean(), server_default=sa.text("0")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
        sa.Column('created_by', sa.String(length=36)),
    )

    op.create_table(
        'categories',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False, unique=True),
        sa.Column('description', sa.Text()),
        sa.Column('parent_id', sa.String(length=36), sa.ForeignKey('categories.id'), nullable=True),
        sa.Column('icon', sa.String(length=100)),
        sa.Column('color', sa.String(length=20), server_default=sa.text("'#1E3A8A'")),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text("0")),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text("1")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now()),
    )

    op.create_table(
        'brands',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False, unique=True),
        sa.Column('description', sa.Text()),
        sa.Column('logo', sa.String(length=255)),
        sa.Column('website', sa.String(length=255)),
        sa.Column('contact_email', sa.String(length=100)),
        sa.Column('contact_phone', sa.String(length=20)),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text("1")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now()),
    )

    op.create_table(
        'warehouses',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=20), unique=True),
        sa.Column('address', sa.Text()),
        sa.Column('city', sa.String(length=100)),
        sa.Column('state', sa.String(length=100)),
        sa.Column('pincode', sa.String(length=10)),
        sa.Column('country', sa.String(length=100), server_default=sa.text("'India'")),
        sa.Column('manager_name', sa.String(length=100)),
        sa.Column('manager_phone', sa.String(length=20)),
        sa.Column('capacity', sa.Integer()),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text("1")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now()),
    )

    op.create_table(
        'suppliers',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=50), unique=True),
        sa.Column('contact_person', sa.String(length=100)),
        sa.Column('email', sa.String(length=100)),
        sa.Column('phone', sa.String(length=20)),
        sa.Column('alternate_phone', sa.String(length=20)),
        sa.Column('gstin', sa.String(length=20)),
        sa.Column('pan', sa.String(length=20)),
        sa.Column('address', sa.Text()),
        sa.Column('city', sa.String(length=100)),
        sa.Column('state', sa.String(length=100)),
        sa.Column('pincode', sa.String(length=10)),
        sa.Column('country', sa.String(length=100), server_default=sa.text("'India'")),
        sa.Column('bank_name', sa.String(length=100)),
        sa.Column('bank_account', sa.String(length=50)),
        sa.Column('ifsc_code', sa.String(length=20)),
        sa.Column('upi_id', sa.String(length=100)),
        sa.Column('credit_limit', sa.Float(), server_default=sa.text("0.0")),
        sa.Column('credit_days', sa.Integer(), server_default=sa.text("30")),
        sa.Column('rating', sa.Float(), server_default=sa.text("5.0")),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text("1")),
        sa.Column('notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now()),
    )

    op.create_table(
        'customers',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=50), unique=True),
        sa.Column('type', sa.String(length=20), server_default=sa.text("'retail'")),
        sa.Column('email', sa.String(length=100)),
        sa.Column('phone', sa.String(length=20)),
        sa.Column('alternate_phone', sa.String(length=20)),
        sa.Column('gstin', sa.String(length=20)),
        sa.Column('pan', sa.String(length=20)),
        sa.Column('address', sa.Text()),
        sa.Column('city', sa.String(length=100)),
        sa.Column('state', sa.String(length=100)),
        sa.Column('pincode', sa.String(length=10)),
        sa.Column('country', sa.String(length=100), server_default=sa.text("'India'")),
        sa.Column('credit_limit', sa.Float(), server_default=sa.text("0.0")),
        sa.Column('credit_days', sa.Integer(), server_default=sa.text("0")),
        sa.Column('loyalty_points', sa.Integer(), server_default=sa.text("0")),
        sa.Column('total_purchases', sa.Float(), server_default=sa.text("0.0")),
        sa.Column('last_purchase_date', sa.DateTime()),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text("1")),
        sa.Column('notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now()),
    )

    # Other transactional/accounting tables would be added in follow-up migrations.
    # For now, this migration covers the currently used product-related FK tables
    # to unblock the application and future stock movement migrations.


def downgrade() -> None:
    op.drop_table('products')
    op.drop_table('customers')
    op.drop_table('suppliers')
    op.drop_table('warehouses')
    op.drop_table('brands')
    op.drop_table('categories')

