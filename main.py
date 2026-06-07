import sys
import io
import bcrypt
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field

from app.database import engine, Base, get_db
from app.models.user import User
from app.models import academic
from app.models.routes import (
    sessions, subject, teacher, update_user, admin,
    flashcards, books, calendar, schedule, dashboard,
    metrics, notes,
)
from app.core.auth import get_current_user
from config import settings


if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


app = FastAPI(
    title="Law System API",
    version="2.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://lawsysfrontend.vercel.app",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


@app.middleware("http")
async def security_headers(request, call_next):
    """OWASP secure headers — defense-in-depth."""
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    return response

app.include_router(sessions.router)
app.include_router(subject.router)
app.include_router(subject.public_router)
app.include_router(teacher.router)
app.include_router(update_user.router)
app.include_router(admin.router)
app.include_router(flashcards.router)
app.include_router(books.router)
app.include_router(calendar.router)
app.include_router(schedule.router)
app.include_router(dashboard.router)
app.include_router(metrics.router)
app.include_router(metrics.timeline_router)
app.include_router(notes.router)


class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=3)
    email: EmailStr
    password: str = Field(..., min_length=8)
    cpf: Optional[str] = None
    curso: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


@app.on_event("startup")
def startup():
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS core"))
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS academic"))
            conn.commit()
        Base.metadata.create_all(bind=engine)
        logger.info("Law System API v2 iniciada com sucesso!")
    except Exception:
        # Não vaza credenciais que podem aparecer em mensagens de erro de DB
        logger.exception("Erro no startup")


@app.get("/users/me", tags=["Users"])
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "curso": current_user.curso,
        "current_period": current_user.current_period,
        "total_periods": current_user.total_periods,
        "completion_estimate": current_user.completion_estimate,
        "cpf": current_user.cpf,
        "phone": current_user.phone,
        "photo_url": current_user.photo_url,
        "daily_goal_minutes": current_user.daily_goal_minutes or 30,
        "goals": current_user.goals or {},
        "is_approved": current_user.is_approved,
        "is_active": current_user.is_active,
    }


@app.post("/register", status_code=201, tags=["Auth"])
def register(u: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == u.email).first():
        raise HTTPException(status_code=400, detail="Já existe uma conta com este e-mail. Tente entrar.")

    hashed = bcrypt.hashpw(u.password.encode("utf-8"), bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)).decode("utf-8")
    new_user = User(
        full_name=u.full_name,
        email=u.email,
        password_hash=hashed,
        cpf=u.cpf,
        curso=u.curso,
        is_approved=False
    )
    db.add(new_user)
    db.commit()
    return {"message": "Registrado com sucesso! Aguarde aprovação."}


@app.post("/login", tags=["Auth"])
def login(l: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == l.email).first()
    now = datetime.utcnow()

    # Lockout check (antes da verificação de senha)
    if user and user.locked_until and user.locked_until > now:
        remaining = int((user.locked_until - now).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Por segurança, sua conta foi pausada após várias tentativas. Tente novamente em {remaining} min.",
        )

    if not user or not bcrypt.checkpw(l.password.encode("utf-8"), user.password_hash.encode("utf-8")):
        # Incrementa contador no usuário existente
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=settings.LOCKOUT_MINUTES)
                user.failed_login_attempts = 0
                db.commit()
                raise HTTPException(
                    status_code=429,
                    detail=f"Conta bloqueada por {settings.LOCKOUT_MINUTES} minutos após {settings.MAX_LOGIN_ATTEMPTS} tentativas. Aguarde e tente de novo.",
                )
            db.commit()
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos. Verifique e tente novamente.")

    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Sua conta está em análise. Você receberá um aviso por e-mail quando for liberada.")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Acesso suspenso. Fale com o administrador do sistema.")

    # Sucesso: reset contador
    if user.failed_login_attempts or user.locked_until:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "version": "2.0.0"}


@app.post("/_system/migrate", tags=["System"], include_in_schema=False)
def system_migrate(secret: str, name: str, db: Session = Depends(get_db)):
    if secret != settings.SECRET_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")
    from pathlib import Path
    allowed = {"008_notes"}
    if name not in allowed:
        raise HTTPException(status_code=404, detail="Unknown migration")
    sql_path = Path(__file__).resolve().parent / "migrations" / f"{name}.sql"
    if not sql_path.exists():
        raise HTTPException(status_code=404, detail=f"{sql_path.name} not found")
    sql = sql_path.read_text(encoding="utf-8")
    try:
        db.execute(text(sql))
        db.commit()
        return {"ok": True, "migration": name}
    except Exception:
        db.rollback()
        import logging
        logging.getLogger(__name__).exception("Migration %s falhou", name)
        raise HTTPException(status_code=500, detail="Falha ao aplicar migration.")






