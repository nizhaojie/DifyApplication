import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


@dataclass(frozen=True)
class Settings:
    mysql_host: str = os.getenv("MYSQL_HOST", "127.0.0.1")
    mysql_port: int = int(os.getenv("MYSQL_PORT", "3306"))
    mysql_user: str = os.getenv("MYSQL_USER", "root")
    mysql_password: str = os.getenv("MYSQL_PASSWORD", "123456")
    mysql_database: str = os.getenv("MYSQL_DATABASE", "yuejiao_db")
    dify_api_base: str = os.getenv("DIFY_API_BASE", "http://127.0.0.1/v1")
    dify_complaint_weekly_api_key: str = os.getenv("DIFY_COMPLAINT_WEEKLY_API_KEY", "")
    dify_daily_summary_api_key: str = os.getenv("DIFY_DAILY_SUMMARY_API_KEY", "")
    dify_timeout_seconds: float = float(os.getenv("DIFY_TIMEOUT_SECONDS", "90"))


settings = Settings()
