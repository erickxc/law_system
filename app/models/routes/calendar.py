"""Calendário pessoal: eventos de revisão, estudo, aula, prova, outros."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date, timedelta

from app.database import get_db
from app.core.auth import get_current_user
from app.models.academic import CalendarEvent, Subject

router = APIRouter(prefix="/calendar", tags=["Calendar"])


VALID_EVENT_TYPES = {"revisao", "estudo", "aula", "prova", "outro"}


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: str = "outro"
    start_at: str  # ISO datetime
    end_at: Optional[str] = None
    all_day: bool = False
    subject_id: Optional[UUID] = None
    color: Optional[str] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    all_day: Optional[bool] = None
    subject_id: Optional[UUID] = None
    color: Optional[str] = None
    completed: Optional[bool] = None


def _event_dict(e: CalendarEvent) -> dict:
    return {
        "id": str(e.id),
        "title": e.title,
        "description": e.description,
        "event_type": e.event_type,
        "start_at": e.start_at.isoformat() if e.start_at else None,
        "end_at": e.end_at.isoformat() if e.end_at else None,
        "all_day": e.all_day,
        "subject_id": str(e.subject_id) if e.subject_id else None,
        "subject_name": e.subject.name if e.subject else None,
        "color": e.color,
        "completed": e.completed,
    }


def _parse_dt(s: str) -> datetime:
    """Aceita 'YYYY-MM-DD', 'YYYY-MM-DDTHH:MM' e ISO completo."""
    if not s:
        raise ValueError("data vazia")
    # YYYY-MM-DD → adiciona meia-noite
    if len(s) == 10 and s[4] == "-":
        return datetime.fromisoformat(s + "T00:00:00")
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


@router.get("/events")
def list_events(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> List[dict]:
    q = db.query(CalendarEvent).options(joinedload(CalendarEvent.subject)).filter(
        CalendarEvent.user_id == current_user.id
    )
    if start_date:
        try:
            q = q.filter(CalendarEvent.start_at >= _parse_dt(start_date))
        except ValueError:
            pass
    if end_date:
        try:
            q = q.filter(CalendarEvent.start_at < _parse_dt(end_date) + timedelta(days=1))
        except ValueError:
            pass
    events = q.order_by(CalendarEvent.start_at).all()
    return [_event_dict(e) for e in events]


@router.post("/events", status_code=status.HTTP_201_CREATED)
def create_event(
    body: EventCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if body.event_type not in VALID_EVENT_TYPES:
        raise HTTPException(400, f"event_type deve ser um de: {', '.join(VALID_EVENT_TYPES)}")
    try:
        start_at = _parse_dt(body.start_at)
    except ValueError:
        raise HTTPException(400, "start_at inválido (use YYYY-MM-DD ou ISO datetime)")
    end_at = None
    if body.end_at:
        try:
            end_at = _parse_dt(body.end_at)
        except ValueError:
            raise HTTPException(400, "end_at inválido")

    ev = CalendarEvent(
        user_id=current_user.id,
        title=body.title.strip(),
        description=body.description,
        event_type=body.event_type,
        start_at=start_at,
        end_at=end_at,
        all_day=body.all_day,
        subject_id=body.subject_id,
        color=body.color,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    # Reload with subject
    ev = db.query(CalendarEvent).options(joinedload(CalendarEvent.subject)).filter(
        CalendarEvent.id == ev.id
    ).first()
    return _event_dict(ev)


@router.put("/events/{event_id}")
def update_event(
    event_id: UUID,
    body: EventUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ev = db.query(CalendarEvent).filter(
        CalendarEvent.id == event_id,
        CalendarEvent.user_id == current_user.id,
    ).first()
    if not ev:
        raise HTTPException(404, "Evento não encontrado")

    data = body.model_dump(exclude_unset=True)
    if "event_type" in data and data["event_type"] not in VALID_EVENT_TYPES:
        raise HTTPException(400, f"event_type inválido")
    if "start_at" in data and data["start_at"]:
        try:
            data["start_at"] = _parse_dt(data["start_at"])
        except ValueError:
            raise HTTPException(400, "start_at inválido")
    if "end_at" in data:
        if data["end_at"]:
            try:
                data["end_at"] = _parse_dt(data["end_at"])
            except ValueError:
                raise HTTPException(400, "end_at inválido")
    if "title" in data:
        data["title"] = data["title"].strip()

    for k, v in data.items():
        setattr(ev, k, v)
    db.commit()
    db.refresh(ev)
    ev = db.query(CalendarEvent).options(joinedload(CalendarEvent.subject)).filter(
        CalendarEvent.id == ev.id
    ).first()
    return _event_dict(ev)


@router.patch("/events/{event_id}/complete")
def toggle_complete(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ev = db.query(CalendarEvent).filter(
        CalendarEvent.id == event_id,
        CalendarEvent.user_id == current_user.id,
    ).first()
    if not ev:
        raise HTTPException(404, "Evento não encontrado")
    ev.completed = not ev.completed
    db.commit()
    return {"id": str(ev.id), "completed": ev.completed}


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ev = db.query(CalendarEvent).filter(
        CalendarEvent.id == event_id,
        CalendarEvent.user_id == current_user.id,
    ).first()
    if not ev:
        raise HTTPException(404, "Evento não encontrado")
    db.delete(ev)
    db.commit()
