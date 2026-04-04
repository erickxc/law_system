from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.schemas.user_schema import UserUpdate, UserResponse

router = APIRouter(tags=["Users"])


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
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erro interno ao salvar os dados.")


@router.delete("/admin/users/{user_id}", status_code=204)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores podem excluir usuários.")

    user_to_delete = db.query(User).filter(User.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if user_to_delete.id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode excluir sua própria conta.")

    try:
        db.delete(user_to_delete)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erro interno ao remover o usuário.")
