"""Application configuration module."""

from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """Global application settings loaded from environment or .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application settings
    app_name: str = "Yuejiao Education Service Admin"
    app_env: str = "development"
    is_debug: bool = True
    api_v1_prefix: str = "/api/v1"

    # Server settings
    server_host: str = "0.0.0.0"
    server_port: int = 8000

    # CORS settings
    cors_allowed_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ]

    # Database settings
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = "123456"
    db_name: str = "yuejiao_service"
    db_charset: str = "utf8mb4"

    # Dify integration settings
    dify_api_base_url: str = "http://127.0.0.1:8080/v1"
    dify_api_key: str = ""

    @property
    def database_url(self) -> str:
        """Generate MySQL SQLAlchemy connection URL."""
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}@"
            f"{self.db_host}:{self.db_port}/{self.db_name}?charset={self.db_charset}"
        )


@lru_cache()
def get_app_settings() -> AppSettings:
    """Return cached application settings instance."""
    return AppSettings()


settings = get_app_settings()
