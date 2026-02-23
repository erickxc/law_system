from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from uuid import UUID

class UserUpdate(BaseModel):
    phone: Optional[str] = None
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    bairro: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "Brasil"
    curso: Optional[str] = None
    cpf: Optional[str] = None
    current_period: Optional[int] = None
    total_periods: Optional[int] = None

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
    is_approved: bool
    
    model_config = ConfigDict(from_attributes=True)