from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database — aceita URL completa (Supabase/Vercel) ou variáveis individuais
    DB_URL: Optional[str] = None  # Ex: postgresql://user:pass@host:5432/dbname
    DB_HOST: Optional[str] = "localhost"
    DB_PORT: int = 5432
    DB_NAME: Optional[str] = "law_study_system"
    DB_USER: Optional[str] = "study_app"
    DB_PASSWORD: Optional[str] = ""

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

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
        if self.DB_URL:
            # Supabase usa postgresql:// mas SQLAlchemy precisa de postgresql+psycopg2://
            url = self.DB_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            return url
        return (
            f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
