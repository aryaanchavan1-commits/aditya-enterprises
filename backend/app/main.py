from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.api.v1.router import api_router
import os
import subprocess
import sys


def _run_alembic_upgrade_head() -> None:
    """Apply Alembic migrations at startup.

    Runs in-process using the Alembic CLI entrypoint to avoid introducing
    additional runtime complexity.
    """
    try:
        # Alembic expects to be executed with working directory at backend/
        subprocess.check_call(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=os.path.join(os.path.dirname(__file__), "..", ".."),
        )
    except Exception as exc:
        raise RuntimeError(f"Failed to run Alembic migrations: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.BASE_PATH, exist_ok=True)
    for folder in [
        'Database', 'Images', 'Backups', 'Reports', 'Exports',
        'Logs', 'AI', 'Config', 'Barcodes', 'Invoices',
        'data', 'data/images', 'data/images/products'
    ]:
        os.makedirs(os.path.join(settings.BASE_PATH, folder), exist_ok=True)

    _run_alembic_upgrade_head()
    yield


app = FastAPI(
    title="ArynoxTech ERP API",
    description="Complete ERP System for Aditya Enterprises",
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "app": "ArynoxTech ERP", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
