from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime, timedelta, date
import uuid

from app.database import get_db
from app.models.academic import StudySession, SessionTask, Subject
from app.models.schemas.study import StudySessionCreate, StudySessionResponse
from app.core.auth import get_current_user

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_session(
    session_data: StudySessionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    subject = db.query(Subject).filter(
        Subject.id == session_data.subject_id,
        Subject.user_id == current_user.id
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Matéria não encontrada.")

    new_session = StudySession(
        user_id=current_user.id,
        subject_id=session_data.subject_id,
        total_questions=session_data.total_questions,
        correct_answers=session_data.correct_answers,
        duration_seconds=session_data.duration_seconds
    )

    db.add(new_session)
    db.flush()

    for task in session_data.tasks:
        db.add(SessionTask(
            session_id=new_session.id,
            description=task.description,
            is_done=task.is_done
        ))

    db.commit()
    return {"message": "Sessão salva com sucesso!", "session_id": str(new_session.id)}


@router.get("/history")
def get_session_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    sessions = (
        db.query(StudySession)
        .options(joinedload(StudySession.subject), joinedload(StudySession.tasks))
        .filter(StudySession.user_id == current_user.id)
        .order_by(StudySession.start_time.desc())
        .all()
    )

    result = []
    for s in sessions:
        result.append({
            "id": str(s.id),
            "subject_id": str(s.subject_id),
            "subject_name": s.subject.name if s.subject else "Geral",
            "start_time": s.start_time.isoformat() if s.start_time else None,
            "duration_seconds": s.duration_seconds,
            "total_questions": s.total_questions,
            "correct_answers": s.correct_answers,
            "tasks": [{"id": str(t.id), "description": t.description, "is_done": t.is_done} for t in s.tasks],
        })
    return result


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Estatísticas agregadas do usuário: total, streak, médias, por matéria, últimos 30 dias."""
    sessions = (
        db.query(StudySession)
        .options(joinedload(StudySession.subject))
        .filter(StudySession.user_id == current_user.id)
        .all()
    )

    if not sessions:
        return {
            "total_sessions": 0, "total_minutes": 0,
            "total_questions": 0, "total_correct": 0, "accuracy": 0.0,
            "current_streak": 0, "best_day": None,
            "by_subject": [], "last_30_days": [],
        }

    total_seconds = sum(s.duration_seconds or 0 for s in sessions)
    total_q = sum(s.total_questions or 0 for s in sessions)
    total_c = sum(s.correct_answers or 0 for s in sessions)

    # Atividade por dia
    by_day: dict[date, int] = {}
    for s in sessions:
        if not s.start_time:
            continue
        d = s.start_time.date()
        by_day[d] = by_day.get(d, 0) + (s.duration_seconds or 0)

    # Streak atual (dias consecutivos a partir de hoje ou ontem)
    today = datetime.utcnow().date()
    streak = 0
    check_day = today
    if check_day not in by_day:
        # se ainda não estudou hoje, começa de ontem
        check_day = today - timedelta(days=1)
    while check_day in by_day:
        streak += 1
        check_day -= timedelta(days=1)

    # Melhor dia
    best_day_entry = max(by_day.items(), key=lambda kv: kv[1]) if by_day else None
    best_day = (
        {"date": best_day_entry[0].isoformat(), "minutes": best_day_entry[1] // 60}
        if best_day_entry else None
    )

    # Por matéria
    by_subj: dict = {}
    for s in sessions:
        key = s.subject.name if s.subject else "Geral"
        b = by_subj.setdefault(key, {"name": key, "minutes": 0, "questions": 0, "correct": 0, "sessions": 0})
        b["minutes"] += (s.duration_seconds or 0) // 60
        b["questions"] += s.total_questions or 0
        b["correct"] += s.correct_answers or 0
        b["sessions"] += 1
    by_subject = []
    for b in by_subj.values():
        b["accuracy"] = round((b["correct"] / b["questions"] * 100) if b["questions"] else 0, 1)
        by_subject.append(b)
    by_subject.sort(key=lambda x: x["minutes"], reverse=True)

    # Últimos 30 dias (vetor com data + minutos)
    last_30 = []
    for i in range(29, -1, -1):
        d = today - timedelta(days=i)
        last_30.append({
            "date": d.isoformat(),
            "minutes": by_day.get(d, 0) // 60,
        })

    return {
        "total_sessions": len(sessions),
        "total_minutes": total_seconds // 60,
        "total_questions": total_q,
        "total_correct": total_c,
        "accuracy": round((total_c / total_q * 100) if total_q else 0, 1),
        "current_streak": streak,
        "best_day": best_day,
        "by_subject": by_subject,
        "last_30_days": last_30,
    }


@router.get("/report/pdf")
def export_history_pdf(
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Gera PDF do histórico de estudos do usuário."""
    from io import BytesIO
    from fastapi.responses import Response
    from fpdf import FPDF
    import re as _re

    q = (
        db.query(StudySession)
        .options(joinedload(StudySession.subject))
        .filter(StudySession.user_id == current_user.id)
    )
    if date_from:
        try:
            q = q.filter(StudySession.start_time >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            q = q.filter(StudySession.start_time <= datetime.fromisoformat(date_to) + timedelta(days=1))
        except ValueError:
            pass
    sessions = q.order_by(StudySession.start_time.desc()).all()

    def safe(s: str) -> str:
        repl = {"–": "-", "—": "-", "…": "...", "↳": ">", "→": "->", "•": "*",
                "“": '"', "”": '"', "‘": "'", "’": "'"}
        for k, v in repl.items():
            s = s.replace(k, v)
        return s.encode("latin-1", errors="replace").decode("latin-1")

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Header
    pdf.set_fill_color(29, 78, 216)
    pdf.rect(0, 0, pdf.w, 25, style="F")
    pdf.set_xy(14, 8)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 6, safe("Law System"), ln=True)
    pdf.set_x(14)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, safe("Histórico de Estudos"), ln=True)

    pdf.set_y(32)
    pdf.set_text_color(30, 30, 30)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 5, safe(current_user.full_name), ln=True)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(110, 110, 110)
    period_lbl = ""
    if date_from or date_to:
        period_lbl = f" — Periodo: {date_from or '...'} a {date_to or '...'}"
    pdf.cell(0, 4, safe(f"{current_user.email}{period_lbl}"), ln=True)
    pdf.ln(3)

    # Resumo
    total_sec = sum(s.duration_seconds or 0 for s in sessions)
    total_q = sum(s.total_questions or 0 for s in sessions)
    total_c = sum(s.correct_answers or 0 for s in sessions)
    acc = round((total_c / total_q * 100) if total_q else 0, 1)

    pdf.set_fill_color(243, 244, 246)
    pdf.set_text_color(30, 30, 30)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 6, safe("  RESUMO"), fill=True, ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, safe(f"  {len(sessions)} sessão(ões)  |  {total_sec // 60} minutos  |  {total_c}/{total_q} acertos ({acc}%)"), ln=True)
    pdf.ln(2)

    # Sessões
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 6, safe("  SESSÕES"), fill=True, ln=True)
    pdf.ln(1)

    if not sessions:
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(140, 140, 140)
        pdf.cell(0, 6, safe("  Nenhuma sessão no período."), ln=True)
    else:
        for s in sessions:
            subj_name = s.subject.name if s.subject else "Geral"
            dt = s.start_time.strftime("%d/%m/%Y %H:%M") if s.start_time else "—"
            mins = (s.duration_seconds or 0) // 60
            acc_str = ""
            if s.total_questions:
                acc_str = f" • {s.correct_answers}/{s.total_questions} ({round(s.correct_answers/s.total_questions*100)}%)"

            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(20, 30, 60)
            pdf.cell(0, 4.5, safe(f"  {subj_name}"), ln=True)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(90, 90, 90)
            pdf.cell(0, 4, safe(f"    {dt}  •  {mins} min{acc_str}"), ln=True)
            pdf.ln(1.5)

    # Footer com data
    pdf.set_y(-12)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 4, safe(f"Gerado em {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} — Law System"), align="C")

    buf = BytesIO()
    buf.write(bytes(pdf.output()))
    buf.seek(0)

    fname = f"Historico - {current_user.full_name}.pdf"
    fname = _re.sub(r'[\\/:*?"<>|]', "_", fname)
    return Response(
        content=buf.read(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
