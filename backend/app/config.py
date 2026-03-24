"""Application configuration via pydantic-settings."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    postgres_db: str
    postgres_user: str
    postgres_password: str
    database_url: str

    # Redis
    redis_url: str

    # Security
    secret_key: str
    jwt_private_key_path: str
    jwt_public_key_path: str

    # Email
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "noreply@voxpopuli.local"

    # LLM
    openrouter_api_key: str = ""
    llm_monthly_budget_usd: float = 20.0

    # Misc
    allowed_hosts: str = "localhost"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


settings = Settings()
