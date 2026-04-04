from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID

from app.database import get_db
from app.core.auth import get_current_user
from app.models.academic import Subject
from pydantic import BaseModel, field_validator

router = APIRouter(prefix="/subjects", tags=["Subjects"])


# =========================
# SCHEMAS
# =========================

class SubjectCreate(BaseModel):
    name: str
    sigla: Optional[str] = None
    priority: str
    period: int
    no_teacher: bool = False
    teacher_id: Optional[UUID] = None

    @field_validator("teacher_id")
    @classmethod
    def validate_teacher(cls, v, info):
        if not info.data.get("no_teacher") and not v:
            raise ValueError("Para matérias com docente, o campo professor é obrigatório.")
        return v


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    sigla: Optional[str] = None
    priority: Optional[str] = None
    period: Optional[int] = None
    no_teacher: Optional[bool] = None
    teacher_id: Optional[UUID] = None


class SubjectResponse(BaseModel):
    id: UUID
    name: str
    sigla: Optional[str]
    priority: str
    period: int
    status: str
    no_teacher: bool
    teacher_id: Optional[UUID]

    class Config:
        from_attributes = True


# =========================
# ENDPOINTS
# =========================

@router.post("/", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    data: SubjectCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
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
        group_id=current_user.group_id
    )

    try:
        db.add(new_subject)
        db.commit()
        db.refresh(new_subject)
        return new_subject
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Erro ao criar matéria.")


@router.get("/", response_model=List[SubjectResponse])
def list_subjects(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(Subject).filter(Subject.user_id == current_user.id).all()


@router.get("/{subject_id}", response_model=SubjectResponse)
def get_subject(
    subject_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.user_id == current_user.id
    ).first()

    if not subject:
        raise HTTPException(status_code=404, detail="Matéria não encontrada.")

    return subject


@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: UUID,
    data: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.user_id == current_user.id
    ).first()

    if not subject:
        raise HTTPException(status_code=404, detail="Matéria não encontrada.")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(subject, key, value)

    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.user_id == current_user.id
    ).first()

    if not subject:
        raise HTTPException(status_code=404, detail="Matéria não encontrada.")

    db.delete(subject)
    db.commit()
