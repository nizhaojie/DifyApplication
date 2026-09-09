"""Application configuration module."""

from functools import lru_cache
from pathlib import Path
from typing import List
from urllib.parse import unquote, urlparse
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_dify_yml_dir() -> str:
    """Repo-root ``dify/`` dir, resolved from this file's location (not cwd)."""
    return str(Path(__file__).resolve().parents[3] / "dify")


class Settings(BaseSettings):
    """Global application settings loaded from environment or .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # General Application settings
    app_name: str = "Yuejiao Education Service Admin"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8002
    server_host: str = "0.0.0.0"
    server_port: int = 8002
    debug: bool = True
    is_debug: bool = True
    api_v1_prefix: str = "/api/v1"

    # Database settings (MySQL 8.0)
    database_url: str = "mysql+asyncmy://root:123456@127.0.0.1:3306/yuejiao_db?charset=utf8mb4"
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = "123456"
    db_name: str = "yuejiao_db"
    db_charset: str = "utf8mb4"

    # JWT Authentication settings
    jwt_secret: str = "change-me-in-local-env"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720

    # CORS settings
    cors_origins: str = "http://127.0.0.1:5174,http://localhost:5174"
    cors_allowed_origins: List[str] = [
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ]

    # CS Module Dify Integration
    dify_api_base_url: str = "http://127.0.0.1:8080/v1"
    dify_api_key: str = ""

    # Dify YML directory (unified root for all dify/*.yml DSL and tool files)
    dify_yml_dir: str = Field(default_factory=_default_dify_yml_dir)

    # Enterprise Assistant Dify Integration
    dify_base_url: str = "http://localhost/v1"
    dify_enterprise_api_key: str = ""
    dify_tool_token: str = ""

    # Student Assistant Dify Integration
    dify_student_psych_base_url: str = ""
    dify_student_psych_api_key: str = ""
    dify_student_life_base_url: str = ""
    dify_student_life_api_key: str = ""
    dify_student_program_base_url: str = ""
    dify_student_program_api_key: str = ""
    # Original student module environment variable names.
    dify_psych_base_url: str = ""
    dify_psych_api_key: str = ""
    dify_life_base_url: str = ""
    dify_life_api_key: str = ""
    dify_program_base_url: str = ""
    dify_program_api_key: str = ""

    # Report Module Dify Integration
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

    # Profile（客户研判）模块 Dify 配置（pf-extract / pf-narrate 两个工作流，独立 Key）
    pf_dify_api_base: str = "http://localhost/v1"
    dify_extract_api_key: str = ""
    dify_narrate_api_key: str = ""
    # Dify 不可达兜底：off | heuristic
    pf_llm_fallback: str = "heuristic"

    @field_validator("dify_yml_dir", mode="after")
    @classmethod
    def resolve_dify_yml_dir(cls, value: str) -> str:
        return str(Path(value).resolve())

    @field_validator("debug", "is_debug", mode="before")
    @classmethod
    def parse_debug_flag(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "production", "prod", "false", "0", "no", "off"}:
                return False
            if normalized in {"development", "dev", "true", "1", "yes", "on"}:
                return True
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [item.strip() for item in self.cors_origins.split(",") if item.strip()]
        for allowed in self.cors_allowed_origins:
            if allowed not in origins and allowed != "*":
                origins.append(allowed)
        return origins

    @property
    def sync_database_url(self) -> str:
        """Generate MySQL synchronous SQLAlchemy connection URL with pymysql."""
        return self.database_url.replace("mysql+asyncmy://", "mysql+pymysql://", 1)

    @model_validator(mode="after")
    def fill_report_settings(self):
        parsed = urlparse(self.database_url.replace("mysql+asyncmy://", "mysql://", 1))
        if not self.mysql_host:
            self.mysql_host = self.db_host or parsed.hostname or "127.0.0.1"
        if not self.mysql_port:
            self.mysql_port = self.db_port or parsed.port or 3306
        if not self.mysql_user:
            self.mysql_user = self.db_user or unquote(parsed.username or "root")
        if not self.mysql_password:
            self.mysql_password = self.db_password or unquote(parsed.password or "")
        if not self.mysql_database:
            self.mysql_database = self.db_name or (parsed.path or "/yuejiao_db").lstrip("/")
        if not self.dify_api_base:
            self.dify_api_base = self.dify_base_url or self.dify_api_base_url
        return self


AppSettings = Settings


@lru_cache
def get_settings() -> Settings:
    return Settings()


get_app_settings = get_settings
settings = get_settings()
