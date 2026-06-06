from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.schemas.user_schema import UserUpdate, UserResponse

router = APIRouter(tags=["Users"])


class PhotoUpdate(BaseModel):
    photo_url: Optional[str] = None  # URL externa (ou null pra remover)


@router.put("/users/me/update", response_model=UserResponse)
def update_user_profile(
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    update_data = user_data.model_dump(exclude_unset=True)

    if "cpf" in update_data:
        cpf_limpo = "".join(filter(str.isdigit, update_data["cpf"]))
        if current_user.cpf and cpf_limpo != current_user.cpf:
            raise HTTPException(status_code=400, detail="O CPF não pode ser alterado.")
        update_data["cpf"] = cpf_limpo

    if "phone" in update_data:
        update_data["phone"] = "".join(filter(str.isdigit, update_data["phone"]))

    for key, value in update_data.items():
        if hasattr(current_user, key):
            setattr(current_user, key, value)

    try:
        db.commit()
        db.refresh(current_user)
        return current_user
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erro interno ao salvar os dados.")


@router.put("/users/me/photo", response_model=UserResponse)
def update_user_photo(
    body: PhotoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza apenas a foto de perfil (URL externa). Use null pra remover."""
    url = body.photo_url
    if url and not (url.startswith("http://") or url.startswith("https://") or url.startswith("data:image/")):
        raise HTTPException(status_code=400, detail="photo_url deve ser uma URL http(s) ou data:image/...")
    current_user.photo_url = url
    db.commit()
    db.refresh(current_user)
    return current_user
