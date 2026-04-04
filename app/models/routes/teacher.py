from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from app.database import get_db
from app.core.auth import get_current_user
from app.models.academic import Teacher

router = APIRouter(prefix="/teachers", tags=["Teachers"])


class TeacherCreate(BaseModel):
    name: str
    contact: Optional[str] = None
    email: Optional[str] = None


class TeacherResponse(BaseModel):
    id: UUID
    name: str
    contact: Optional[str]
    email: Optional[str]

    class Config:
        from_attributes = True


@router.post("/", response_model=TeacherResponse, status_code=status.HTTP_201_CREATED)
def create_teacher(
    data: TeacherCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    new_teacher = Teacher(
        name=data.name,
        contact=data.contact,
        email=data.email
    )
    try:
        db.add(new_teacher)
        db.commit()
        db.refresh(new_teacher)
        return new_teacher
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Erro ao criar professor.")


@router.get("/", response_model=List[TeacherResponse])
def list_teachers(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(Teacher).all()
