from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database — prioridade: POSTGRES_URL (Vercel/Neon) > DB_URL > variáveis individuais
    POSTGRES_URL: Optional[str] = None       # injetado automaticamente pela Vercel/Neon
    DB_URL: Optional[str] = None             # alternativa manual
    DB_HOST: Optional[str] = "localhost"
    DB_PORT: int = 5432
    DB_NAME: Optional[str] = "law_study_system"
    DB_USER: Optional[str] = "study_app"
    DB_PASSWORD: Optional[str] = ""

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    BCRYPT_ROUNDS: int = 12

    # Rate limit / lockout
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 15

    # Email
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASS: Optional[str] = None
    ADMIN_EMAIL: Optional[str] = None

    # Environment
    ENVIRONMENT: str = "production"

    @property
    def DATABASE_URL(self) -> str:
        raw = self.POSTGRES_URL or self.DB_URL
        if raw:
            if raw.startswith("postgres://"):
                raw = raw.replace("postgres://", "postgresql://", 1)
            return raw
        return (
            f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()


def _validate_settings() -> None:
    """Falha rápido se a configuração crítica estiver inválida em produção."""
    if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 32:
        raise RuntimeError(
            "SECRET_KEY ausente ou curta (mínimo 32 caracteres). "
            "Defina uma string aleatória em SECRET_KEY no .env / env vars do Vercel."
        )
    if settings.BCRYPT_ROUNDS < 10 and settings.ENVIRONMENT == "production":
        raise RuntimeError(
            f"BCRYPT_ROUNDS={settings.BCRYPT_ROUNDS} é fraco para produção. "
            "Use >= 12 em produção."
        )


_validate_settings()
