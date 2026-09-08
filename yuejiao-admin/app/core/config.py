from functools import lru_cache

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

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
