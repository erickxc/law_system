"""Endpoints agregadores para o dashboard."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Any
from datetime import datetime, timedelta, date, time

from app.database import get_db
from app.core.auth import get_current_user
from app.models.academic import CalendarEvent, ClassSchedule

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# Mapa: weekday() do Python (0=segunda) → day_of_week do schedule (0=domingo)
def _py_weekday_to_dow(py_weekday: int) -> int:
    # Python: Mon=0..Sun=6  →  Nosso: Sun=0..Sat=6
    return (py_weekday + 1) % 7


@router.get("/upcoming")
def upcoming(
    days: int = Query(7, ge=1, le=30),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Lista unificada dos próximos compromissos:
    - Eventos de CalendarEvent não-completed entre agora e agora+days
    - Ocorrências de ClassSchedule (aulas) expandidas para cada data no intervalo
    Ordenada por data/hora ascendente.
    """
    now = datetime.utcnow()
    end_dt = now + timedelta(days=days)

    # 1. Eventos do calendário
    events = (
        db.query(CalendarEvent)
        .options(joinedload(CalendarEvent.subject))
        .filter(
            CalendarEvent.user_id == current_user.id,
            CalendarEvent.start_at >= now,
            CalendarEvent.start_at <= end_dt,
            CalendarEvent.completed == False,
        )
        .order_by(CalendarEvent.start_at)
        .all()
    )

    items: List[Dict[str, Any]] = []
    EVENT_COLORS = {
        "revisao": "#7c3aed",
        "estudo":  "#2563eb",
        "aula":    "#16a34a",
        "prova":   "#dc2626",
        "outro":   "#71717a",
    }
    for e in events:
        items.append({
            "id": f"event:{e.id}",
            "kind": "event",
            "event_type": e.event_type,
            "title": e.title,
            "description": e.description,
            "subject_name": e.subject.name if e.subject else None,
            "start_at": e.start_at.isoformat(),
            "end_at": e.end_at.isoformat() if e.end_at else None,
            "all_day": e.all_day,
            "color": e.color or EVENT_COLORS.get(e.event_type, EVENT_COLORS["outro"]),
            "location": None,
            "teacher_name": None,
        })

    # 2. Aulas (schedule) expandidas como ocorrências
    slots = (
        db.query(ClassSchedule)
        .filter(ClassSchedule.user_id == current_user.id)
        .all()
    )
    if slots:
        # Para cada dia entre now.date() e end_dt.date(), achar slots do day_of_week
        today = now.date()
        end_d = end_dt.date()
        n_days = (end_d - today).days + 1
        # Indexar por day_of_week
        slots_by_dow: Dict[int, list] = {}
        for s in slots:
            slots_by_dow.setdefault(s.day_of_week, []).append(s)

        for i in range(n_days):
            d = today + timedelta(days=i)
            dow = _py_weekday_to_dow(d.weekday())
            for s in slots_by_dow.get(dow, []):
                # Compor datetime com start_time HH:MM
                try:
                    h, m = map(int, s.start_time.split(":"))
                    start_at = datetime.combine(d, time(h, m))
                except (ValueError, AttributeError):
                    continue
                # Pular se já passou
                if start_at < now:
                    continue
                end_at = None
                try:
                    eh, em = map(int, s.end_time.split(":"))
                    end_at = datetime.combine(d, time(eh, em))
                except (ValueError, AttributeError):
                    pass
                items.append({
                    "id": f"slot:{s.id}:{d.isoformat()}",
                    "kind": "class",
                    "event_type": "aula",
                    "title": s.subject_name or "Aula",
                    "description": None,
                    "subject_name": s.subject_name,
                    "start_at": start_at.isoformat(),
                    "end_at": end_at.isoformat() if end_at else None,
                    "all_day": False,
                    "color": s.color or EVENT_COLORS["aula"],
                    "location": s.location,
                    "teacher_name": s.teacher_name,
                })

    # 3. Ordena e limita
    items.sort(key=lambda x: x["start_at"])
    return items[:limit]
