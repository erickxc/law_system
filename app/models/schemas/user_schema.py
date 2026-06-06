from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from uuid import UUID


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    bairro: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    curso: Optional[str] = None
    cpf: Optional[str] = None
    current_period: Optional[int] = None
    total_periods: Optional[int] = None
    completion_estimate: Optional[str] = None
    photo_url: Optional[str] = None


class UserResponse(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    role: Optional[str] = None
    phone: Optional[str] = None
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    bairro: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    curso: Optional[str] = None
    cpf: Optional[str] = None
    current_period: Optional[int] = None
    total_periods: Optional[int] = None
    completion_estimate: Optional[str] = None
    is_approved: bool
    is_active: bool = True
    photo_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
