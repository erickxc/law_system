"""Banco de Questões + tentativas + Caderno de Erros real.

Endpoints:
  CRUD /questions/
  POST /questions/{id}/attempt   — registra tentativa
  GET  /questions/error-book     — caderno de erros (questões com taxa < 70%)
  GET  /questions/stats          — estatísticas agregadas
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel, field_validator

from app.database import get_db
from app.core.auth import get_current_user
from app.core.events import emit_event
from app.models.academic import Question, QuestionAttempt, Subject

router = APIRouter(prefix="/questions", tags=["Questions"])


VALID_KINDS = {"multiple", "true_false", "open"}


class QuestionCreate(BaseModel):
    statement: str
    options: Optional[list] = None
    correct: Optional[str] = None
    explanation: Optional[str] = None
    kind: str = "multiple"
    topic: Optional[str] = None
    banca: Optional[str] = None
    ano: Optional[int] = None
    source: Optional[str] = None
    subject_id: Optional[UUID] = None
    tags: Optional[str] = None

    @field_validator("kind")
    @classmethod
    def _k(cls, v):
        if v not in VALID_KINDS:
            raise ValueError(f"kind inválido. Use: {', '.join(VALID_KINDS)}")
        return v


class QuestionUpdate(BaseModel):
    statement: Optional[str] = None
    options: Optional[list] = None
    correct: Optional[str] = None
    explanation: Optional[str] = None
    kind: Optional[str] = None
    topic: Optional[str] = None
    banca: Optional[str] = None
    ano: Optional[int] = None
    source: Optional[str] = None
    subject_id: Optional[UUID] = None
    tags: Optional[str] = None


class AttemptInput(BaseModel):
    answer: Optional[str] = None
    time_seconds: Optional[int] = None


def _q_dict(q: Question, attempts: Optional[list] = None) -> dict:
    if attempts is None:
        attempts = q.attempts or []
    total = len(attempts)
    correct = sum(1 for a in attempts if a.is_correct)
    return {
        "id": str(q.id),
        "statement": q.statement,
        "options": q.options,
        "correct": q.correct,
        "explanation": q.explanation,
        "kind": q.kind,
        "topic": q.topic,
        "banca": q.banca,
        "ano": q.ano,
        "source": q.source,
        "subject_id": str(q.subject_id) if q.subject_id else None,
        "subject_name": q.subject.name if q.subject else None,
        "tags": q.tags,
        "total_attempts": total,
        "correct_attempts": correct,
        "accuracy_pct": round(correct / total * 100, 1) if total else None,
        "created_at": q.created_at.isoformat(),
    }


# ─── CRUD ──────────────────────────────────────────────────────────────

@router.get("/")
def list_questions(
    subject_id: Optional[UUID] = None,
    topic: Optional[str] = None,
    banca: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = (
        db.query(Question)
        .options(joinedload(Question.subject), joinedload(Question.attempts))
        .filter(Question.user_id == current_user.id)
    )
    if subject_id:
        q = q.filter(Question.subject_id == subject_id)
    if topic:
        q = q.filter(Question.topic.ilike(f"%{topic}%"))
    if banca:
        q = q.filter(Question.banca.ilike(f"%{banca}%"))
    return [_q_dict(x) for x in q.order_by(Question.created_at.desc()).all()]


@router.get("/stats")
def question_stats(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    total = db.query(func.count(Question.id)).filter(Question.user_id == current_user.id).scalar() or 0
    attempts = db.query(QuestionAttempt).filter(QuestionAttempt.user_id == current_user.id).all()
    att_total = len(attempts)
    att_correct = sum(1 for a in attempts if a.is_correct)
    by_banca = {}
    for q in db.query(Question).filter(Question.user_id == current_user.id).all():
        if not q.banca:
            continue
        by_banca[q.banca] = by_banca.get(q.banca, 0) + 1
    return {
        "total_questions": total,
        "total_attempts": att_total,
        "overall_accuracy_pct": round(att_correct / att_total * 100, 1) if att_total else None,
        "by_banca": [{"banca": k, "count": v} for k, v in sorted(by_banca.items(), key=lambda x: -x[1])],
    }


@router.get("/error-book")
def error_book(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Questões com acerto < 70% (mín 2 tentativas) agrupadas por matéria + tema."""
    questions = (
        db.query(Question)
        .options(joinedload(Question.subject), joinedload(Question.attempts))
        .filter(Question.user_id == current_user.id)
        .all()
    )
    weak = []
    for q in questions:
        atts = q.attempts or []
        if len(atts) < 2:
            continue
        correct = sum(1 for a in atts if a.is_correct)
        acc = correct / len(atts)
        if acc < 0.7:
            d = _q_dict(q, atts)
            weak.append(d)

    # Agrega por matéria + tema
    by_subject = {}
    by_topic = {}
    for w in weak:
        sk = w.get("subject_name") or "Sem matéria"
        by_subject[sk] = by_subject.get(sk, 0) + 1
        tk = w.get("topic") or "Sem tema"
        by_topic[tk] = by_topic.get(tk, 0) + 1

    weak.sort(key=lambda x: (x["accuracy_pct"] or 0))
    return {
        "total": len(weak),
        "by_subject": [{"subject_name": k, "count": v} for k, v in sorted(by_subject.items(), key=lambda x: -x[1])],
        "by_topic": [{"topic": k, "count": v} for k, v in sorted(by_topic.items(), key=lambda x: -x[1])[:10]],
        "questions": weak[:50],
    }


@router.get("/{question_id}")
def get_question(question_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = (
        db.query(Question)
        .options(joinedload(Question.subject), joinedload(Question.attempts))
        .filter(Question.id == question_id, Question.user_id == current_user.id)
        .first()
    )
    if not q:
        raise HTTPException(404, "Questão não encontrada.")
    return _q_dict(q)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_question(data: QuestionCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if not data.statement.strip():
        raise HTTPException(400, "Enunciado é obrigatório.")
    if data.subject_id:
        s = db.query(Subject).filter(Subject.id == data.subject_id, Subject.user_id == current_user.id).first()
        if not s:
            raise HTTPException(404, "Matéria não encontrada.")

    q = Question(
        user_id=current_user.id,
        subject_id=data.subject_id,
        statement=data.statement.strip(),
        options=data.options,
        correct=data.correct,
        explanation=data.explanation,
        kind=data.kind,
        topic=data.topic,
        banca=data.banca,
        ano=data.ano,
        source=data.source,
        tags=data.tags,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return _q_dict(q, [])


@router.put("/{question_id}")
def update_question(question_id: UUID, data: QuestionUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = db.query(Question).filter(Question.id == question_id, Question.user_id == current_user.id).first()
    if not q:
        raise HTTPException(404, "Questão não encontrada.")
    update = data.model_dump(exclude_unset=True)
    if "kind" in update and update["kind"] not in VALID_KINDS:
        raise HTTPException(400, f"kind inválido. Use: {', '.join(VALID_KINDS)}")
    for k, v in update.items():
        setattr(q, k, v)
    q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    return _q_dict(q)


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(question_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = db.query(Question).filter(Question.id == question_id, Question.user_id == current_user.id).first()
    if not q:
        raise HTTPException(404, "Questão não encontrada.")
    db.delete(q)
    db.commit()


@router.post("/{question_id}/attempt", status_code=status.HTTP_201_CREATED)
def attempt_question(
    question_id: UUID,
    data: AttemptInput,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Registra resposta do usuário e devolve se acertou + explicação."""
    q = db.query(Question).filter(Question.id == question_id, Question.user_id == current_user.id).first()
    if not q:
        raise HTTPException(404, "Questão não encontrada.")

    answer = (data.answer or "").strip()
    if q.kind == "open":
        # Questão aberta: usuário marca se acertou (front decide). Aceita answer como "true"/"false"
        is_correct = answer.lower() in {"true", "1", "sim", "correto", "yes"}
    else:
        is_correct = bool(q.correct) and answer.lower() == (q.correct or "").lower()

    att = QuestionAttempt(
        question_id=q.id,
        user_id=current_user.id,
        answer=answer or None,
        is_correct=is_correct,
        time_seconds=data.time_seconds,
    )
    db.add(att)
    emit_event(
        db,
        user_id=current_user.id,
        event_type="questao_acerto" if is_correct else "questao_erro",
        entity_type="question",
        entity_id=q.id,
        subject_id=q.subject_id,
        meta={"answer": answer, "topic": q.topic, "banca": q.banca},
    )
    db.commit()
    db.refresh(att)

    return {
        "is_correct": is_correct,
        "correct_answer": q.correct,
        "explanation": q.explanation,
        "attempt_id": str(att.id),
    }
