from pydantic_settings import BaseSettings
from functools import lru_cache
import os

class Settings(BaseSettings):
    APP_NAME: str = "ArynoxTech ERP Suite 2026"
    VERSION: str = "1.0.0"
    COMPANY: str = "Sainath Enterprises"
    BASE_PATH: str = r"D:\ArynoxTechERP"

    @property
    def DATABASE_URL(self) -> str:
        db_path = os.path.join(self.BASE_PATH, "Database", "arynoxtech_erp.db")
        return f"sqlite:///{db_path}"

    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"

    # Security
    SECRET_KEY: str = "arynoxtech-secret-key-2026-sainath-enterprises"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Backup
    AUTO_BACKUP_INTERVAL_HOURS: int = 24
    MAX_BACKUPS: int = 30

    # GST
    DEFAULT_GST_RATE: float = 18.0

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
