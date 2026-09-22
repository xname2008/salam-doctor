from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, sourced from environment variables / .env."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    project_name: str = "Shiraz Beauty API"
    environment: str = Field(default="development")
    debug: bool = Field(default=True)
    api_v1_prefix: str = "/api/v1"

    # Async driver: the request path never blocks the event loop.
    database_url: str = Field(
        default="postgresql+asyncpg://shirazbeauty:shirazbeauty@db:5432/shirazbeauty"
    )
    # Echo generated SQL to the log. Noisy; keep off unless debugging a query.
    sql_echo: bool = Field(default=False)

    # Create any missing tables from the ORM metadata on startup. Convenient on
    # a fresh developer database; set false in production, where
    # `alembic upgrade head` is the only thing allowed to change the schema.
    auto_create_tables: bool = Field(default=True)

    # Comma-separated list of allowed browser origins.
    cors_origins: str = Field(default="http://localhost:3010")

    # ---- Auth -----------------------------------------------------------
    # Generate with: openssl rand -hex 32
    jwt_secret_key: str = Field(default="change-me-in-production")
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    otp_ttl_seconds: int = 120
    otp_length: int = 5
    otp_max_attempts: int = 5
    # Must stay below otp_ttl_seconds or a code can never be resent.
    otp_resend_cooldown_seconds: int = 60

    # ---- SMS (Kavenegar verify/lookup) ----------------------------------
    # Empty or "mock" prints the code to stdout. A real key sends via Kavenegar.
    sms_provider: str = Field(default="kavenegar")
    sms_api_key: str = Field(default="mock")
    sms_otp_template: str = Field(default="")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    @property
    def sms_is_mock(self) -> bool:
        key = (self.sms_api_key or "").strip().lower()
        return key in {"", "mock", "none", "disabled"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]

    @property
    def database_url_sync(self) -> str:
        """Blocking DSN for Alembic.

        Migrations are inherently sequential, so they run on psycopg2 rather
        than dragging an event loop into `alembic upgrade`.
        """
        return self.database_url.replace("+asyncpg", "+psycopg2")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
