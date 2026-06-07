"""Camada de Inteligência Acadêmica — Fase 1.

Endpoints:
  GET /metrics/ipa          → Índice de Performance Acadêmica (0-100, geral + por matéria)
  GET /metrics/gaps         → Radar de Lacunas (pontos fracos priorizados)
  GET /metrics/heatmap      → Distribuição de esforço por matéria e por dia
  GET /metrics/error-book   → Caderno de Erros (cards com baixa accuracy)
  GET /timeline/me          → Linha do Tempo dos eventos (paginado)

Componentes do IPA (peso):
  Consistência (25%): dias com sessão nos últimos 30 / 30
  Revisão      (20%): % de cards due no período que foram revisados
  Retenção     (25%): accuracy global dos flashcards
  Exercícios   (20%): accuracy de sessions com questions
  Cobertura    (10%): % de matérias com livro + flashcard + sessão
"""
from datetime import datetime, timedelta, date
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, distinct, case, and_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.academic import (
    Subject, StudySession, Flashcard, FlashcardReview,
    Book, LearningEvent,
)

router = APIRouter(prefix="/metrics", tags=["Metrics"])


# ─── Helpers ─────────────────────────────────────────────────────────────

def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _safe_div(num: float, den: float, default: float = 0.0) -> float:
    return num / den if den else default


# ─── IPA ────────────────────────────────────────────────────────────────

@router.get("/ipa")
def get_ipa(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Índice de Performance Acadêmica (0-100). Geral + por matéria."""
    now = datetime.utcnow()
    period_start = now - timedelta(days=30)

    # ── Consistência: dias únicos com sessão nos últimos 30 ──
    days_studied = (
        db.query(func.count(distinct(func.date(StudySession.start_time))))
        .filter(
            StudySession.user_id == current_user.id,
            StudySession.start_time >= period_start,
        )
        .scalar() or 0
    )
    consistency = _clamp((days_studied / 30.0) * 100)

    # ── Retenção: accuracy global dos flashcards ──
    fc_totals = db.query(
        func.coalesce(func.sum(Flashcard.total_reviews), 0),
        func.coalesce(func.sum(Flashcard.correct_reviews), 0),
    ).filter(Flashcard.user_id == current_user.id).first()
    total_rev, correct_rev = fc_totals or (0, 0)
    retention = _safe_div(correct_rev * 100.0, total_rev or 1)

    # ── Revisão: % das reviews dos últimos 7 dias que foram corretas ──
    week_ago = now - timedelta(days=7)
    week_reviews = db.query(
        func.count(FlashcardReview.id),
        func.sum(case((FlashcardReview.is_correct == True, 1), else_=0)),
    ).filter(
        FlashcardReview.user_id == current_user.id,
        FlashcardReview.reviewed_at >= week_ago,
    ).first()
    week_total, week_correct = week_reviews or (0, 0)
    # Combina volume + acerto: quanto mais reviews E mais acertos, melhor
    review_score = _clamp(
        (min(week_total, 50) / 50.0) * 60      # 60 pts por volume (até 50 reviews/semana)
        + _safe_div((week_correct or 0) * 40.0, week_total or 1)  # 40 pts pela accuracy
    )

    # ── Exercícios: accuracy de sessões com questões ──
    sess_q = db.query(
        func.coalesce(func.sum(StudySession.total_questions), 0),
        func.coalesce(func.sum(StudySession.correct_answers), 0),
    ).filter(
        StudySession.user_id == current_user.id,
        StudySession.start_time >= period_start,
    ).first()
    q_total, q_correct = sess_q or (0, 0)
    exercises = _safe_div(q_correct * 100.0, q_total or 1)
    if q_total == 0:
        exercises = 0  # sem dados = 0 pra não inflar

    # ── Cobertura: % de matérias "em curso" com pelo menos um material vivo ──
    subjects = db.query(Subject).filter(Subject.user_id == current_user.id).all()
    if subjects:
        covered = 0
        for s in subjects:
            has_book = db.query(Book.id).filter(Book.subject_id == s.id).first() is not None
            has_card = db.query(Flashcard.id).filter(Flashcard.subject_id == s.id).first() is not None
            has_sess = db.query(StudySession.id).filter(
                StudySession.subject_id == s.id,
                StudySession.start_time >= period_start,
            ).first() is not None
            if sum([has_book, has_card, has_sess]) >= 2:
                covered += 1
        coverage = _safe_div(covered * 100.0, len(subjects))
    else:
        coverage = 0

    # ── Score composto ──
    geral = (
        consistency * 0.25
        + review_score * 0.20
        + retention * 0.25
        + exercises * 0.20
        + coverage * 0.10
    )

    # ── IPA por matéria (versão simplificada) ──
    by_subject = []
    for s in subjects:
        s_cards = db.query(Flashcard).filter(
            Flashcard.user_id == current_user.id,
            Flashcard.subject_id == s.id,
        ).all()
        s_total_rev = sum(c.total_reviews for c in s_cards)
        s_correct = sum(c.correct_reviews for c in s_cards)
        s_retention = _safe_div(s_correct * 100.0, s_total_rev or 1)

        s_sessions = db.query(StudySession).filter(
            StudySession.user_id == current_user.id,
            StudySession.subject_id == s.id,
            StudySession.start_time >= period_start,
        ).all()
        s_days = len({sess.start_time.date() for sess in s_sessions})
        s_consistency = _clamp((s_days / 30.0) * 100)
        s_minutes = sum((sess.duration_seconds or 0) for sess in s_sessions) // 60

        s_q_total = sum(sess.total_questions or 0 for sess in s_sessions)
        s_q_correct = sum(sess.correct_answers or 0 for sess in s_sessions)
        s_exercises = _safe_div(s_q_correct * 100.0, s_q_total or 1) if s_q_total else 0

        # Pesos: retenção 40%, consistência 30%, exercícios 30%
        s_score = s_retention * 0.4 + s_consistency * 0.3 + s_exercises * 0.3

        by_subject.append({
            "subject_id": str(s.id),
            "subject_name": s.name,
            "score": round(s_score, 1),
            "retention_pct": round(s_retention, 1),
            "consistency_pct": round(s_consistency, 1),
            "exercises_pct": round(s_exercises, 1),
            "minutes_30d": s_minutes,
            "days_studied_30d": s_days,
            "total_reviews": s_total_rev,
            "cards_count": len(s_cards),
        })

    by_subject.sort(key=lambda x: x["score"], reverse=True)

    return {
        "geral": round(geral, 1),
        "components": {
            "consistency": round(consistency, 1),
            "review": round(review_score, 1),
            "retention": round(retention, 1),
            "exercises": round(exercises, 1),
            "coverage": round(coverage, 1),
        },
        "weights": {"consistency": 0.25, "review": 0.20, "retention": 0.25, "exercises": 0.20, "coverage": 0.10},
        "by_subject": by_subject,
        "period_days": 30,
    }


# ─── Radar de Lacunas ───────────────────────────────────────────────────

@router.get("/gaps")
def get_gaps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Identifica pontos fracos: matérias sem flashcard, sem revisão, baixa retenção."""
    now = datetime.utcnow()
    period_14 = now - timedelta(days=14)

    subjects = db.query(Subject).filter(Subject.user_id == current_user.id).all()
    gaps = []

    for s in subjects:
        card_count = db.query(func.count(Flashcard.id)).filter(
            Flashcard.user_id == current_user.id, Flashcard.subject_id == s.id
        ).scalar() or 0
        book_count = db.query(func.count(Book.id)).filter(
            Book.user_id == current_user.id, Book.subject_id == s.id
        ).scalar() or 0
        last_session = db.query(func.max(StudySession.start_time)).filter(
            StudySession.user_id == current_user.id, StudySession.subject_id == s.id,
        ).scalar()

        # Cards com retenção baixa (< 50% accuracy, mín 3 reviews)
        weak_cards = db.query(func.count(Flashcard.id)).filter(
            Flashcard.user_id == current_user.id,
            Flashcard.subject_id == s.id,
            Flashcard.total_reviews >= 3,
            (Flashcard.correct_reviews * 1.0 / Flashcard.total_reviews) < 0.5,
        ).scalar() or 0

        # Calcula score de atenção (quanto maior, mais urgente)
        reasons = []
        score = 0

        if card_count == 0:
            reasons.append("Sem flashcards criados")
            score += 30
        if book_count == 0:
            reasons.append("Sem livro/PDF vinculado")
            score += 15
        if last_session is None:
            reasons.append("Nunca foi estudada")
            score += 40
        elif last_session < period_14:
            days_ago = (now - last_session).days
            reasons.append(f"Não estudada há {days_ago} dias")
            score += min(40, days_ago * 2)
        if weak_cards > 0:
            reasons.append(f"{weak_cards} flashcard{'s' if weak_cards > 1 else ''} com baixa retenção (<50%)")
            score += weak_cards * 5

        if score > 0:
            gaps.append({
                "subject_id": str(s.id),
                "subject_name": s.name,
                "priority": s.priority,
                "attention_score": score,
                "reasons": reasons,
                "card_count": card_count,
                "book_count": book_count,
                "weak_card_count": weak_cards,
                "last_session": last_session.isoformat() if last_session else None,
            })

    gaps.sort(key=lambda g: g["attention_score"], reverse=True)
    return {"gaps": gaps[:20], "total_subjects": len(subjects), "subjects_with_gaps": len(gaps)}


# ─── Heatmap ─────────────────────────────────────────────────────────────

@router.get("/heatmap")
def get_heatmap(
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Distribuição de esforço por matéria (barras) e por dia (estilo GitHub)."""
    now = datetime.utcnow()
    period_start = now - timedelta(days=days)

    # ── Por matéria ──
    rows = (
        db.query(
            StudySession.subject_id,
            Subject.name,
            func.coalesce(func.sum(StudySession.duration_seconds), 0),
            func.count(StudySession.id),
        )
        .outerjoin(Subject, Subject.id == StudySession.subject_id)
        .filter(
            StudySession.user_id == current_user.id,
            StudySession.start_time >= period_start,
        )
        .group_by(StudySession.subject_id, Subject.name)
        .all()
    )
    by_subject = [
        {
            "subject_id": str(sid) if sid else None,
            "subject_name": name or "Sem matéria",
            "minutes": int((secs or 0) / 60),
            "sessions": count,
        }
        for sid, name, secs, count in rows
    ]
    by_subject.sort(key=lambda x: x["minutes"], reverse=True)

    # ── Por dia (até `days` dias) ──
    day_rows = (
        db.query(
            func.date(StudySession.start_time).label("d"),
            func.coalesce(func.sum(StudySession.duration_seconds), 0),
            func.count(StudySession.id),
        )
        .filter(
            StudySession.user_id == current_user.id,
            StudySession.start_time >= period_start,
        )
        .group_by("d")
        .order_by("d")
        .all()
    )
    by_day_map = {
        (d.isoformat() if hasattr(d, "isoformat") else str(d)): {
            "minutes": int((secs or 0) / 60),
            "sessions": count,
        }
        for d, secs, count in day_rows
    }

    # Preenche dias vazios (pra calendário denso)
    by_day = []
    for i in range(days, -1, -1):
        day = (now - timedelta(days=i)).date()
        key = day.isoformat()
        cell = by_day_map.get(key, {"minutes": 0, "sessions": 0})
        by_day.append({"date": key, **cell})

    return {
        "by_subject": by_subject,
        "by_day": by_day,
        "period_days": days,
    }


# ─── Caderno de Erros ────────────────────────────────────────────────────

@router.get("/error-book")
def get_error_book(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Flashcards com baixa retenção (proxy de questões erradas).
    Quando entidade Question for criada, expandimos pra incluir tb."""
    cards = (
        db.query(Flashcard)
        .options(joinedload(Flashcard.subject))
        .filter(
            Flashcard.user_id == current_user.id,
            Flashcard.total_reviews >= 2,
        )
        .all()
    )

    weak = []
    for c in cards:
        accuracy = (c.correct_reviews / c.total_reviews) if c.total_reviews else None
        if accuracy is not None and accuracy < 0.7:  # < 70% de acerto
            weak.append({
                "id": str(c.id),
                "front": c.front,
                "back": c.back,
                "subject_id": str(c.subject_id) if c.subject_id else None,
                "subject_name": c.subject.name if c.subject else "Sem matéria",
                "tags": c.tags,
                "total_reviews": c.total_reviews,
                "correct_reviews": c.correct_reviews,
                "accuracy_pct": round(accuracy * 100, 1),
                "difficulty": c.difficulty,
                "next_review_at": c.next_review_at.isoformat() if c.next_review_at else None,
            })

    # Agrega por matéria
    by_subject_map: dict = {}
    for w in weak:
        key = w["subject_name"]
        if key not in by_subject_map:
            by_subject_map[key] = {"subject_name": key, "subject_id": w["subject_id"], "count": 0, "avg_accuracy": 0, "total_acc": 0}
        by_subject_map[key]["count"] += 1
        by_subject_map[key]["total_acc"] += w["accuracy_pct"]

    by_subject = []
    for k, v in by_subject_map.items():
        v["avg_accuracy"] = round(v["total_acc"] / v["count"], 1) if v["count"] else 0
        del v["total_acc"]
        by_subject.append(v)
    by_subject.sort(key=lambda x: x["count"], reverse=True)

    weak.sort(key=lambda x: x["accuracy_pct"])
    return {
        "total_weak_cards": len(weak),
        "by_subject": by_subject,
        "cards": weak[:50],
    }


# ─── Timeline ────────────────────────────────────────────────────────────

timeline_router = APIRouter(prefix="/timeline", tags=["Timeline"])


@timeline_router.get("/me")
def get_timeline(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = None,
    subject_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Eventos do usuário ordenados por data desc. Filtros opcionais."""
    q = db.query(LearningEvent).filter(LearningEvent.user_id == current_user.id)
    if event_type:
        q = q.filter(LearningEvent.event_type == event_type)
    if subject_id:
        q = q.filter(LearningEvent.subject_id == subject_id)
    total = q.count()
    events = q.order_by(LearningEvent.occurred_at.desc()).offset(offset).limit(limit).all()

    # Enriquece com nome da matéria
    subj_ids = {e.subject_id for e in events if e.subject_id}
    subj_map = {}
    if subj_ids:
        for s in db.query(Subject).filter(Subject.id.in_(subj_ids)).all():
            subj_map[s.id] = s.name

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "events": [
            {
                "id": str(e.id),
                "event_type": e.event_type,
                "entity_type": e.entity_type,
                "entity_id": str(e.entity_id) if e.entity_id else None,
                "subject_id": str(e.subject_id) if e.subject_id else None,
                "subject_name": subj_map.get(e.subject_id) if e.subject_id else None,
                "page_number": e.page_number,
                "score": e.score,
                "meta": e.meta or {},
                "occurred_at": e.occurred_at.isoformat(),
            }
            for e in events
        ],
    }
