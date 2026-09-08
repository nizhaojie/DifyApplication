from functools import lru_cache
from urllib.parse import unquote, urlparse

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "粤教企业智能助手"
    app_host: str = "0.0.0.0"
    app_port: int = 8001
    debug: bool = True

    database_url: str = "mysql+asyncmy://root:@127.0.0.1:3306/yuejiao?charset=utf8mb4"

    jwt_secret: str = "change-me-in-local-env"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720

    cors_origins: str = "http://127.0.0.1:4173,http://localhost:4173"

    dify_base_url: str = "http://localhost/v1"
    dify_enterprise_api_key: str = ""
    dify_tool_token: str = ""

    mysql_host: str = ""
    mysql_port: int = 0
    mysql_user: str = ""
    mysql_password: str = ""
    mysql_database: str = ""
    dify_api_base: str = ""
    dify_complaint_weekly_api_key: str = ""
    dify_daily_summary_api_key: str = ""
    dify_psych_weekly_api_key: str = ""
    dify_customer_ops_api_key: str = ""
    dify_timeout_seconds: float = 90

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @model_validator(mode="after")
    def fill_report_settings(self):
        parsed = urlparse(self.database_url.replace("mysql+asyncmy://", "mysql://", 1))
        if not self.mysql_host:
            self.mysql_host = parsed.hostname or "127.0.0.1"
        if not self.mysql_port:
            self.mysql_port = parsed.port or 3306
        if not self.mysql_user:
            self.mysql_user = unquote(parsed.username or "root")
        if not self.mysql_password:
            self.mysql_password = unquote(parsed.password or "")
        if not self.mysql_database:
            self.mysql_database = (parsed.path or "/yuejiao").lstrip("/")
        if not self.dify_api_base:
            self.dify_api_base = self.dify_base_url
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
