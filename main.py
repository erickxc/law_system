import sys
import io
import bcrypt
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional

from jose import jwt
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field

from app.database import engine, Base, get_db
from app.models.user import User
from app.models import academic  # garante que todos os modelos sejam registrados
from app.models.routes import sessions, subject, teacher, update_user
from config import settings


# =========================
# LOGGING
# =========================

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# =========================
# APP
# =========================

app = FastAPI(
    title="Law System API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# ROUTERS
# =========================

app.include_router(sessions.router)
app.include_router(subject.router)
app.include_router(teacher.router)
app.include_router(update_user.router)


# =========================
# SCHEMAS (auth only)
# =========================

class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=3)
    email: EmailStr
    password: str = Field(..., min_length=8)
    cpf: Optional[str] = None
    curso: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# =========================
# TOKEN
# =========================

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# =========================
# STARTUP
# =========================

@app.on_event("startup")
def startup():
    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS core"))
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS academic"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    logger.info("Law System API iniciada com sucesso!")


# =========================
# AUTH ENDPOINTS
# =========================

@app.post("/register", status_code=201, tags=["Auth"])
def register(u: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == u.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    hashed = bcrypt.hashpw(
        u.password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

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

    if not user or not bcrypt.checkpw(
        l.password.encode("utf-8"),
        user.password_hash.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")

    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Conta aguardando aprovação do administrador")

    token = create_access_token({"sub": str(user.id)})

    return {
        "access_token": token,
        "token_type": "bearer"
    }


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok"}
