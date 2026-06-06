"""Quadro de aulas recorrente — grade semanal."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, field_validator
from typing import Optional, List
from uuid import UUID
import re

from app.database import get_db
from app.core.auth import get_current_user
from app.models.academic import ClassSchedule, Subject

router = APIRouter(prefix="/schedule", tags=["Schedule"])

TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


class ScheduleCreate(BaseModel):
    subject_id: Optional[UUID] = None
    subject_name: Optional[str] = None  # fallback se não tiver subject cadastrada
    day_of_week: int  # 0=domingo, 6=sábado
    start_time: str   # HH:MM
    end_time: str     # HH:MM
    location: Optional[str] = None
    teacher_name: Optional[str] = None
    color: Optional[str] = None

    @field_validator("day_of_week")
    @classmethod
    def _day(cls, v):
        if not (0 <= v <= 6):
            raise ValueError("day_of_week deve estar entre 0 (domingo) e 6 (sábado)")
        return v

    @field_validator("start_time", "end_time")
    @classmethod
    def _hhmm(cls, v):
        if not TIME_RE.match(v):
            raise ValueError("formato esperado HH:MM (24h)")
        return v


class ScheduleUpdate(BaseModel):
    subject_id: Optional[UUID] = None
    subject_name: Optional[str] = None
    day_of_week: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    teacher_name: Optional[str] = None
    color: Optional[str] = None


def _slot_dict(s: ClassSchedule) -> dict:
    return {
        "id": str(s.id),
        "subject_id": str(s.subject_id) if s.subject_id else None,
        "subject_name": s.subject_name,  # preenchido por list_slots quando faltar
        "day_of_week": s.day_of_week,
        "start_time": s.start_time,
        "end_time": s.end_time,
        "location": s.location,
        "teacher_name": s.teacher_name,
        "color": s.color,
    }


@router.get("/")
def list_slots(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> List[dict]:
    """Retorna todos os slots ordenados por dia + horário."""
    slots = (
        db.query(ClassSchedule)
        .filter(ClassSchedule.user_id == current_user.id)
        .order_by(ClassSchedule.day_of_week, ClassSchedule.start_time)
        .all()
    )
    # Subject name lookup (1 query)
    subj_ids = {s.subject_id for s in slots if s.subject_id}
    subj_names = {}
    if subj_ids:
        rows = db.query(Subject.id, Subject.name).filter(Subject.id.in_(subj_ids)).all()
        subj_names = {sid: name for sid, name in rows}

    result = []
    for s in slots:
        d = _slot_dict(s)
        if s.subject_id and not d.get("subject_name"):
            d["subject_name"] = subj_names.get(s.subject_id)
        result.append(d)
    return result


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_slot(
    body: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not body.subject_id and not body.subject_name:
        raise HTTPException(400, "Informe subject_id ou subject_name")
    if body.start_time >= body.end_time:
        raise HTTPException(400, "start_time deve ser anterior a end_time")

    slot = ClassSchedule(
        user_id=current_user.id,
        subject_id=body.subject_id,
        subject_name=(body.subject_name.strip() if body.subject_name else None),
        day_of_week=body.day_of_week,
        start_time=body.start_time,
        end_time=body.end_time,
        location=body.location,
        teacher_name=body.teacher_name,
        color=body.color,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return _slot_dict(slot)


@router.put("/{slot_id}")
def update_slot(
    slot_id: UUID,
    body: ScheduleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    slot = db.query(ClassSchedule).filter(
        ClassSchedule.id == slot_id,
        ClassSchedule.user_id == current_user.id,
    ).first()
    if not slot:
        raise HTTPException(404, "Slot não encontrado")
    data = body.model_dump(exclude_unset=True)
    if "day_of_week" in data and data["day_of_week"] is not None and not (0 <= data["day_of_week"] <= 6):
        raise HTTPException(400, "day_of_week inválido")
    for k in ("start_time", "end_time"):
        if k in data and data[k] and not TIME_RE.match(data[k]):
            raise HTTPException(400, f"{k}: formato HH:MM")
    for k, v in data.items():
        setattr(slot, k, v)
    db.commit()
    db.refresh(slot)
    return _slot_dict(slot)


@router.delete("/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_slot(
    slot_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    slot = db.query(ClassSchedule).filter(
        ClassSchedule.id == slot_id,
        ClassSchedule.user_id == current_user.id,
    ).first()
    if not slot:
        raise HTTPException(404, "Slot não encontrado")
    db.delete(slot)
    db.commit()
