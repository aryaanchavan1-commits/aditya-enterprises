from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()

@router.get("/")
def get_settings():
    return {
        "app_name": settings.APP_NAME,
        "version": settings.VERSION,
        "company": settings.COMPANY,
        "base_path": settings.BASE_PATH,
        "gst_rate": settings.DEFAULT_GST_RATE
    }

@router.get("/company")
def get_company_settings():
    return {
        "name": "Sainath Enterprises",
        "address": "",
        "phone": "",
        "email": "",
        "gstin": "",
        "pan": "",
        "bank_name": "",
        "account_number": "",
        "ifsc": ""
    }
