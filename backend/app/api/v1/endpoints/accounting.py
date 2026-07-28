from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.product import CashBook, BankBook, Expense, Income, JournalEntry, Sale
import uuid
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/cash-book")
def get_cash_book(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(CashBook).order_by(CashBook.date.desc()).offset(skip).limit(limit).all()

@router.post("/cash-book")
def add_cash_entry(entry_type: str, amount: float, description: str, db: Session = Depends(get_db)):
    last_entry = db.query(CashBook).order_by(CashBook.date.desc()).first()
    balance = (last_entry.balance if last_entry else 0.0)
    if entry_type == "receipt":
        balance += amount
    else:
        balance -= amount
    entry = CashBook(
        id=str(uuid.uuid4()),
        transaction_type=entry_type,
        amount=amount,
        description=description,
        balance=balance,
        voucher_number=f"CB-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.get("/profit-loss")
def get_profit_loss(start_date: datetime = None, end_date: datetime = None, db: Session = Depends(get_db)):
    if not start_date:
        start_date = datetime.now() - timedelta(days=30)
    if not end_date:
        end_date = datetime.now()
    total_sales = db.query(func.sum(Sale.total_amount)).filter(Sale.sale_date.between(start_date, end_date), Sale.status == "active").scalar() or 0.0
    total_expenses = db.query(func.sum(Expense.amount)).filter(Expense.date.between(start_date, end_date)).scalar() or 0.0
    total_income = db.query(func.sum(Income.amount)).filter(Income.date.between(start_date, end_date)).scalar() or 0.0
    gross_profit = total_sales + total_income - total_expenses
    return {
        "period": {"start": start_date, "end": end_date},
        "total_sales": total_sales,
        "total_income": total_income,
        "total_expenses": total_expenses,
        "gross_profit": gross_profit,
        "net_profit": gross_profit
    }

@router.get("/balance-sheet")
def get_balance_sheet(db: Session = Depends(get_db)):
    cash_balance = db.query(CashBook).order_by(CashBook.date.desc()).first()
    cash = cash_balance.balance if cash_balance else 0.0
    bank_balance = db.query(BankBook).order_by(BankBook.date.desc()).first()
    bank = bank_balance.balance if bank_balance else 0.0
    receivables = db.query(func.sum(Sale.balance_amount)).filter(Sale.payment_status != "paid").scalar() or 0.0
    payables = 0.0
    return {
        "assets": {"cash": cash, "bank": bank, "receivables": receivables, "total_current_assets": cash + bank + receivables},
        "liabilities": {"payables": payables, "total_liabilities": payables},
        "equity": cash + bank + receivables - payables
    }

@router.get("/gst-reports")
def get_gst_reports(month: int = None, year: int = None, db: Session = Depends(get_db)):
    if not month:
        month = datetime.now().month
    if not year:
        year = datetime.now().year
    start_date = datetime(year, month, 1)
    end_date = datetime(year, month + 1, 1) if month < 12 else datetime(year + 1, 1, 1)
    sales = db.query(Sale).filter(Sale.sale_date.between(start_date, end_date)).all()
    total_taxable = sum(s.subtotal for s in sales)
    total_cgst = sum(s.cgst_total for s in sales)
    total_sgst = sum(s.sgst_total for s in sales)
    total_igst = sum(s.igst_total for s in sales)
    return {
        "period": f"{month:02d}-{year}",
        "total_taxable_value": total_taxable,
        "total_cgst": total_cgst,
        "total_sgst": total_sgst,
        "total_igst": total_igst,
        "total_gst": total_cgst + total_sgst + total_igst,
        "invoice_count": len(sales)
    }
