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


class GoalUpdate(BaseModel):
    daily_goal_minutes: int  # 5..600


class GoalsUpdate(BaseModel):
    goals: dict  # {"daily": {minutes, cards, questions, pages}, "weekly": {...}, "monthly": {...}}


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


MAX_PHOTO_DATA_URI_BYTES = 2 * 1024 * 1024  # 2 MB — cap pra evitar inchar o DB


@router.put("/users/me/photo", response_model=UserResponse)
def update_user_photo(
    body: PhotoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza apenas a foto de perfil. Aceita https:// ou data:image/... (até 2MB).
    Envie null pra remover."""
    url = body.photo_url
    if url:
        if url.startswith("data:image/"):
            if len(url) > MAX_PHOTO_DATA_URI_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="Imagem muito grande. Use uma foto de até 2 MB.",
                )
        elif not url.startswith("https://"):
            raise HTTPException(
                status_code=400,
                detail="Use o endereço completo da foto (começa com https://) ou envie um arquivo.",
            )
    current_user.photo_url = url
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/users/me/goal")
def update_daily_goal(
    body: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza a meta diária de minutos (5..600)."""
    if body.daily_goal_minutes < 5 or body.daily_goal_minutes > 600:
        raise HTTPException(status_code=400, detail="meta deve estar entre 5 e 600 minutos")
    current_user.daily_goal_minutes = body.daily_goal_minutes
    db.commit()
    return {"daily_goal_minutes": current_user.daily_goal_minutes}


VALID_PERIODS = {"daily", "weekly", "monthly"}
VALID_METRICS = {"minutes", "cards", "questions", "pages"}


@router.put("/users/me/goals")
def update_goals(
    body: GoalsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza metas multi-período.
    Estrutura esperada:
    {
      "daily":   {"minutes": 30, "cards": 10, "questions": 20, "pages": 15},
      "weekly":  {"minutes": 180, ...},
      "monthly": {"minutes": 700, ...}
    }
    Valores zero = sem meta. Ignora chaves desconhecidas."""
    sanitized = {}
    for period, metrics in (body.goals or {}).items():
        if period not in VALID_PERIODS:
            continue
        if not isinstance(metrics, dict):
            continue
        clean = {}
        for k, v in metrics.items():
            if k not in VALID_METRICS:
                continue
            try:
                iv = int(v)
                if iv < 0 or iv > 100000:
                    continue
                clean[k] = iv
            except (TypeError, ValueError):
                continue
        if clean:
            sanitized[period] = clean
    current_user.goals = sanitized
    # Manter retro-compat: daily.minutes → daily_goal_minutes
    if sanitized.get("daily", {}).get("minutes"):
        current_user.daily_goal_minutes = sanitized["daily"]["minutes"]
    db.commit()
    return {"goals": sanitized, "daily_goal_minutes": current_user.daily_goal_minutes}
