from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.routes.auth import get_current_user
from app.models.academic import Subject
from pydantic import BaseModel, field_validator

router = APIRouter(prefix="/subjects", tags=["Subjects"])

class SubjectCreate(BaseModel):
    name: str
    sigla: str
    priority: str
    period: int
    no_teacher: bool = False
    teacher_id: str = None # UUID como string

    @field_validator('teacher_id')
    def validate_teacher(cls, v, info):
        # Regra: Se no_teacher for Falso, o teacher_id não pode ser nulo
        if not info.data.get('no_teacher') and not v:
            raise ValueError('Para matérias com docente, o campo professor é obrigatório.')
        return v

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_subject(
    data: SubjectCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Dentro de create_subject no seu backend
    new_subject = Subject(
    name=data.name,
    sigla=data.sigla,
    priority=data.priority,
    period=data.period,
    no_teacher=data.no_teacher,
    teacher_id=data.teacher_id if not data.no_teacher else None,
    status="Pendente",
    user_id=current_user.id,
    group_id=current_user.group_id  # <--- ADICIONE ESTA LINHA AQUI
)
    
    try:
        db.add(new_subject)
        db.commit()
        db.refresh(new_subject)
        return new_subject
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Erro ao vincular professor. Verifique se o ID existe.")