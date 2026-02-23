from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.routes.auth import get_current_user
from app.models.academic import Teacher # Assumindo que o model está em academic.py
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/teachers", tags=["Teachers"])

class TeacherCreate(BaseModel):
    name: str
    contact: str = None
    email: str = None

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_teacher(
    data: TeacherCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    new_teacher = Teacher(
        name=data.name,
        contact=data.contact,
        email=data.email
    )
    db.add(new_teacher)
    db.commit()
    db.refresh(new_teacher)
    return new_teacher

@router.get("/", response_model=List[TeacherCreate])
async def list_teachers(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(Teacher).all()