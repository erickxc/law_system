from app.database import Base 
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import text, String, Text, ForeignKey, Boolean, Integer
import uuid
from datetime import datetime
from typing import Optional, List

# 1. Tabela de Grupos de Usuário
class Group(Base):
    __tablename__ = "groups"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()") # Garante geração no DB
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False) 
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("NOW()"))
    
    # Adicionado lazy="selectin" para evitar erros de sessão ao acessar usuários
    users: Mapped[List["User"]] = relationship("User", back_populates="group", lazy="selectin")

# 2. Tabela de Usuários
class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "core"} 

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()") # CORREÇÃO: Adicionado para consistência com Group
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    
    cpf: Mapped[Optional[str]] = mapped_column(String(14), unique=True, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True) 
    
    cep: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    logradouro: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bairro: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) 
    state: Mapped[Optional[str]] = mapped_column(String(2), nullable=True) 
    country: Mapped[Optional[str]] = mapped_column(String(50), server_default=text("'Brasil'"), nullable=True) # Ajuste no default

    curso: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_period: Mapped[Optional[int]] = mapped_column(Integer, nullable=True) 
    total_periods: Mapped[Optional[int]] = mapped_column(Integer, nullable=True) 
    completion_estimate: Mapped[Optional[str]] = mapped_column(String(20), nullable=True) 
    
    role: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, server_default=text("'student'"))
    
    group_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), # Recomendado repetir o tipo explicitamente
        ForeignKey("core.groups.id", ondelete="SET NULL"), 
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(server_default=text("NOW()"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("TRUE"))
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("FALSE"))

    group: Mapped[Optional["Group"]] = relationship("Group", back_populates="users")