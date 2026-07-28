from fastapi import APIRouter
from app.services.backup_service import BackupService
from typing import List
import os

router = APIRouter()

@router.post("/")
def create_backup():
    backup_path = BackupService.create_backup()
    return {"message": "Backup created", "path": backup_path}

@router.get("/")
def list_backups():
    backup_dir = os.path.join(BackupService.get_base_path(), "Backups")
    if not os.path.exists(backup_dir):
        return []
    backups = []
    for folder in sorted(os.listdir(backup_dir), reverse=True):
        path = os.path.join(backup_dir, folder)
        if os.path.isdir(path):
            size = sum(os.path.getsize(os.path.join(dirpath, f)) for dirpath, _, filenames in os.walk(path) for f in filenames)
            backups.append({"name": folder, "path": path, "size": size})
    return backups

@router.post("/restore/{backup_name}")
def restore_backup(backup_name: str):
    backup_path = os.path.join(BackupService.get_base_path(), "Backups", backup_name)
    BackupService.restore_backup(backup_path)
    return {"message": "Backup restored successfully"}
