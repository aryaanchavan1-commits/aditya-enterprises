import shutil
import os
from datetime import datetime
from app.core.config import settings

class BackupService:
    @staticmethod
    def get_base_path():
        return settings.BASE_PATH

    @staticmethod
    def create_backup():
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = os.path.join(settings.BASE_PATH, "Backups", f"backup_{timestamp}")
        os.makedirs(backup_dir, exist_ok=True)

        # Backup database
        db_path = os.path.join(settings.BASE_PATH, "Database", "arynoxtech_erp.db")
        if os.path.exists(db_path):
            shutil.copy2(db_path, os.path.join(backup_dir, "database.db"))

        # Backup config
        config_path = os.path.join(settings.BASE_PATH, "Config")
        if os.path.exists(config_path):
            config_backup = os.path.join(backup_dir, "Config")
            if os.path.exists(config_backup):
                shutil.rmtree(config_backup)
            shutil.copytree(config_path, config_backup)

        # Create backup info
        with open(os.path.join(backup_dir, "backup_info.txt"), "w") as f:
            f.write(f"Backup created: {timestamp}\n")
            f.write(f"Version: {settings.VERSION}\n")
            f.write(f"App: {settings.APP_NAME}\n")

        # Cleanup old backups (keep last 30)
        BackupService._cleanup_old_backups()

        return backup_dir

    @staticmethod
    def restore_backup(backup_path: str):
        if not os.path.exists(backup_path):
            raise FileNotFoundError(f"Backup not found: {backup_path}")

        # Restore database
        db_backup = os.path.join(backup_path, "database.db")
        if os.path.exists(db_backup):
            db_path = os.path.join(settings.BASE_PATH, "Database", "arynoxtech_erp.db")
            shutil.copy2(db_backup, db_path)

        # Restore config
        config_backup = os.path.join(backup_path, "Config")
        if os.path.exists(config_backup):
            config_path = os.path.join(settings.BASE_PATH, "Config")
            if os.path.exists(config_path):
                shutil.rmtree(config_path)
            shutil.copytree(config_backup, config_path)

        return True

    @staticmethod
    def auto_backup():
        return BackupService.create_backup()

    @staticmethod
    def _cleanup_old_backups():
        backup_dir = os.path.join(settings.BASE_PATH, "Backups")
        if not os.path.exists(backup_dir):
            return

        backups = sorted([d for d in os.listdir(backup_dir) if os.path.isdir(os.path.join(backup_dir, d))])
        while len(backups) > settings.MAX_BACKUPS:
            old_backup = os.path.join(backup_dir, backups.pop(0))
            shutil.rmtree(old_backup)
