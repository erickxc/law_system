from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, field_validator
import secrets

from app.database import get_db
from app.core.auth import get_current_user
from app.models.academic import Subject, Flashcard

router = APIRouter(prefix="/subjects", tags=["Subjects"])
public_router = APIRouter(prefix="/public", tags=["Public"])

VALID_PRIORITIES = {"Alta", "Média", "Baixa"}
VALID_STATUSES = {"Pendente", "Em Curso", "Concluída"}


# ── Schemas ──────────────────────────────────────────────────────────────

class SubjectCreate(BaseModel):
    name: str
    sigla: Optional[str] = None
    priority: str = "Média"
    period: int
    no_teacher: bool = False
    teacher_id: Optional[UUID] = None

    @field_validator("priority")
    @classmethod
    def _priority(cls, v):
        if v not in VALID_PRIORITIES:
            raise ValueError(f"priority deve ser: {', '.join(VALID_PRIORITIES)}")
        return v

    @field_validator("teacher_id")
    @classmethod
    def _teacher(cls, v, info):
        if not info.data.get("no_teacher") and not v:
            raise ValueError("Para matérias com docente, o campo professor é obrigatório.")
        return v


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    sigla: Optional[str] = None
    priority: Optional[str] = None
    period: Optional[int] = None
    status: Optional[str] = None
    no_teacher: Optional[bool] = None
    teacher_id: Optional[UUID] = None

    @field_validator("priority")
    @classmethod
    def _priority(cls, v):
        if v is not None and v not in VALID_PRIORITIES:
            raise ValueError(f"priority deve ser: {', '.join(VALID_PRIORITIES)}")
        return v

    @field_validator("status")
    @classmethod
    def _status(cls, v):
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status deve ser: {', '.join(VALID_STATUSES)}")
        return v


class SubjectResponse(BaseModel):
    id: UUID
    name: str
    sigla: Optional[str]
    priority: str
    period: int
    status: str
    no_teacher: bool
    teacher_id: Optional[UUID]
    teacher_name: Optional[str] = None
    share_token: Optional[str] = None

    class Config:
        from_attributes = True


# ── Helpers ──────────────────────────────────────────────────────────────

def _enrich(s: Subject) -> dict:
    """Returns dict ready for SubjectResponse with teacher_name."""
    return {
        "id": s.id,
        "name": s.name,
        "sigla": s.sigla,
        "priority": s.priority,
        "period": s.period,
        "status": s.status,
        "no_teacher": s.no_teacher,
        "teacher_id": s.teacher_id,
        "teacher_name": s.teacher.name if s.teacher else None,
        "share_token": s.share_token,
    }


# ── Endpoints ────────────────────────────────────────────────────────────

@router.post("/", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    data: SubjectCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    new_subject = Subject(
        name=data.name,
        sigla=data.sigla,
        priority=data.priority,
        period=data.period,
        no_teacher=data.no_teacher,
        teacher_id=data.teacher_id if not data.no_teacher else None,
        status="Pendente",
        user_id=current_user.id,
        group_id=current_user.group_id,
    )
    try:
        db.add(new_subject)
        db.commit()
        db.refresh(new_subject)
        new_subject = db.query(Subject).options(joinedload(Subject.teacher)).filter(
            Subject.id == new_subject.id
        ).first()
        return _enrich(new_subject)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Erro ao criar matéria.")


@router.post("/create", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject_alias(
    data: SubjectCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Alias de POST /subjects/ — mantido por compatibilidade com frontend antigo."""
    return create_subject(data, db, current_user)


@router.get("/", response_model=List[SubjectResponse])
def list_subjects(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    subjects = (
        db.query(Subject)
        .options(joinedload(Subject.teacher))
        .filter(Subject.user_id == current_user.id)
        .order_by(Subject.period, Subject.name)
        .all()
    )
    return [_enrich(s) for s in subjects]


@router.get("/{subject_id}", response_model=SubjectResponse)
def get_subject(
    subject_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    subject = (
        db.query(Subject)
        .options(joinedload(Subject.teacher))
        .filter(Subject.id == subject_id, Subject.user_id == current_user.id)
        .first()
    )
    if not subject:
        raise HTTPException(status_code=404, detail="Matéria não encontrada.")
    return _enrich(subject)


@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: UUID,
    data: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.user_id == current_user.id,
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Matéria não encontrada.")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(subject, key, value)

    db.commit()
    db.refresh(subject)
    subject = db.query(Subject).options(joinedload(Subject.teacher)).filter(Subject.id == subject.id).first()
    return _enrich(subject)


@router.patch("/{subject_id}/status", response_model=SubjectResponse)
def update_subject_status(
    subject_id: UUID,
    s_status: str = Query(..., description="Novo status"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if s_status not in VALID_STATUSES:
        raise HTTPException(400, f"status deve ser: {', '.join(VALID_STATUSES)}")
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.user_id == current_user.id,
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Matéria não encontrada.")
    subject.status = s_status
    db.commit()
    db.refresh(subject)
    subject = db.query(Subject).options(joinedload(Subject.teacher)).filter(Subject.id == subject.id).first()
    return _enrich(subject)


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.user_id == current_user.id,
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Matéria não encontrada.")
    db.delete(subject)
    db.commit()


# ── Compartilhamento de matéria (read-only público) ───────────────────────

@router.post("/{subject_id}/share")
def enable_share(
    subject_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Gera (ou regenera) um token público para compartilhar a matéria + flashcards.
    O link compartilhado: GET /public/decks/{token} (sem auth)."""
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.user_id == current_user.id,
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Matéria não encontrada.")
    subject.share_token = secrets.token_urlsafe(16)  # 22 chars
    db.commit()
    return {"share_token": subject.share_token}


@router.delete("/{subject_id}/share", status_code=status.HTTP_204_NO_CONTENT)
def revoke_share(
    subject_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.user_id == current_user.id,
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Matéria não encontrada.")
    subject.share_token = None
    db.commit()


@public_router.get("/decks/{token}")
def get_public_deck(
    token: str,
    db: Session = Depends(get_db),
):
    """Retorna a matéria + flashcards em modo público (sem expor user_id)."""
    subject = db.query(Subject).filter(Subject.share_token == token).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Deck não encontrado ou link revogado")

    cards = (
        db.query(Flashcard)
        .filter(Flashcard.subject_id == subject.id)
        .order_by(Flashcard.created_at)
        .all()
    )
    return {
        "subject": {
            "name": subject.name,
            "sigla": subject.sigla,
            "period": subject.period,
        },
        "cards": [
            {
                "front": c.front,
                "back": c.back,
                "tags": c.tags,
                "difficulty": c.difficulty or "medium",
            }
            for c in cards
        ],
        "count": len(cards),
    }
