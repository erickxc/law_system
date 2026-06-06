from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.database import get_db
from app.core.auth import get_current_user
from app.models.academic import Flashcard, FlashcardReview, Subject

router = APIRouter(prefix="/flashcards", tags=["Flashcards"])


class FlashcardCreate(BaseModel):
    front: str
    back: str
    subject_id: Optional[UUID] = None
    tags: Optional[str] = None


class FlashcardUpdate(BaseModel):
    front: Optional[str] = None
    back: Optional[str] = None
    subject_id: Optional[UUID] = None
    tags: Optional[str] = None


class ReviewInput(BaseModel):
    is_correct: bool
    confidence: int = 3  # 1 (blackout) to 5 (perfect)


def _sm2(card: Flashcard, confidence: int) -> tuple[float, float, datetime]:
    """Simplified SM-2 spaced repetition algorithm."""
    ef = card.ease_factor
    ef = max(1.3, ef + 0.1 - (5 - confidence) * (0.08 + (5 - confidence) * 0.02))

    if confidence < 3:
        interval = 1.0
    elif card.total_reviews == 0:
        interval = 1.0
    elif card.total_reviews == 1:
        interval = 6.0
    else:
        interval = card.interval_days * ef

    next_review = datetime.utcnow() + timedelta(days=interval)
    return interval, ef, next_review


def _card_dict(c: Flashcard) -> dict:
    accuracy = round(c.correct_reviews / c.total_reviews * 100, 1) if c.total_reviews > 0 else None
    return {
        "id": str(c.id),
        "front": c.front,
        "back": c.back,
        "subject_id": str(c.subject_id) if c.subject_id else None,
        "subject_name": c.subject.name if c.subject else None,
        "tags": c.tags,
        "interval_days": c.interval_days,
        "next_review_at": c.next_review_at.isoformat(),
        "total_reviews": c.total_reviews,
        "correct_reviews": c.correct_reviews,
        "accuracy_pct": accuracy,
        "is_due": c.next_review_at <= datetime.utcnow(),
        "created_at": c.created_at.isoformat(),
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_flashcard(
    data: FlashcardCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if data.subject_id:
        subj = db.query(Subject).filter(
            Subject.id == data.subject_id, Subject.user_id == current_user.id
        ).first()
        if not subj:
            raise HTTPException(status_code=404, detail="Matéria não encontrada.")

    card = Flashcard(
        user_id=current_user.id,
        subject_id=data.subject_id,
        front=data.front,
        back=data.back,
        tags=data.tags,
        next_review_at=datetime.utcnow(),
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    if card.subject_id:
        db.expire(card)
        from sqlalchemy.orm import joinedload
        card = db.query(Flashcard).options(joinedload(Flashcard.subject)).filter(Flashcard.id == card.id).first()
    return _card_dict(card)


@router.get("/due")
def get_due_flashcards(
    subject_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    from sqlalchemy.orm import joinedload
    q = (
        db.query(Flashcard)
        .options(joinedload(Flashcard.subject))
        .filter(
            Flashcard.user_id == current_user.id,
            Flashcard.next_review_at <= datetime.utcnow()
        )
    )
    if subject_id:
        q = q.filter(Flashcard.subject_id == subject_id)
    cards = q.order_by(Flashcard.next_review_at).all()
    return [_card_dict(c) for c in cards]


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    cards = db.query(Flashcard).filter(Flashcard.user_id == current_user.id).all()
    total = len(cards)
    due = sum(1 for c in cards if c.next_review_at <= datetime.utcnow())
    total_reviews = sum(c.total_reviews for c in cards)
    total_correct = sum(c.correct_reviews for c in cards)
    overall_accuracy = round(total_correct / total_reviews * 100, 1) if total_reviews > 0 else None

    by_subject: dict = {}
    for c in cards:
        key = str(c.subject_id) if c.subject_id else "sem_materia"
        label = c.subject.name if c.subject else "Sem matéria"
        if key not in by_subject:
            by_subject[key] = {"subject_name": label, "total": 0, "reviews": 0, "correct": 0}
        by_subject[key]["total"] += 1
        by_subject[key]["reviews"] += c.total_reviews
        by_subject[key]["correct"] += c.correct_reviews

    for v in by_subject.values():
        v["accuracy_pct"] = round(v["correct"] / v["reviews"] * 100, 1) if v["reviews"] > 0 else None

    return {
        "total_cards": total,
        "due_today": due,
        "total_reviews": total_reviews,
        "overall_accuracy_pct": overall_accuracy,
        "by_subject": list(by_subject.values()),
    }


@router.get("/")
def list_flashcards(
    subject_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    from sqlalchemy.orm import joinedload
    q = (
        db.query(Flashcard)
        .options(joinedload(Flashcard.subject))
        .filter(Flashcard.user_id == current_user.id)
    )
    if subject_id:
        q = q.filter(Flashcard.subject_id == subject_id)
    return [_card_dict(c) for c in q.order_by(Flashcard.created_at.desc()).all()]


@router.get("/{card_id}")
def get_flashcard(
    card_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    from sqlalchemy.orm import joinedload
    card = (
        db.query(Flashcard)
        .options(joinedload(Flashcard.subject))
        .filter(Flashcard.id == card_id, Flashcard.user_id == current_user.id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard não encontrado.")
    return _card_dict(card)


@router.put("/{card_id}")
def update_flashcard(
    card_id: UUID,
    data: FlashcardUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    from sqlalchemy.orm import joinedload
    card = db.query(Flashcard).filter(Flashcard.id == card_id, Flashcard.user_id == current_user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard não encontrado.")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(card, k, v)
    db.commit()
    db.expire(card)
    card = db.query(Flashcard).options(joinedload(Flashcard.subject)).filter(Flashcard.id == card_id).first()
    return _card_dict(card)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flashcard(
    card_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    card = db.query(Flashcard).filter(Flashcard.id == card_id, Flashcard.user_id == current_user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard não encontrado.")
    db.delete(card)
    db.commit()


@router.post("/{card_id}/review")
def review_flashcard(
    card_id: UUID,
    data: ReviewInput,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    from sqlalchemy.orm import joinedload
    card = (
        db.query(Flashcard)
        .options(joinedload(Flashcard.subject))
        .filter(Flashcard.id == card_id, Flashcard.user_id == current_user.id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard não encontrado.")

    confidence = max(1, min(5, data.confidence))
    new_interval, new_ef, next_review = _sm2(card, confidence)

    review = FlashcardReview(
        flashcard_id=card.id,
        user_id=current_user.id,
        is_correct=data.is_correct,
        confidence=confidence,
    )
    db.add(review)

    card.total_reviews += 1
    if data.is_correct:
        card.correct_reviews += 1
    card.interval_days = new_interval
    card.ease_factor = new_ef
    card.next_review_at = next_review

    db.commit()
    db.expire(card)
    card = db.query(Flashcard).options(joinedload(Flashcard.subject)).filter(Flashcard.id == card_id).first()

    return {
        "card": _card_dict(card),
        "next_review_in_days": round(new_interval, 1),
        "message": "Ótimo!" if data.is_correct else "Vamos revisar em breve.",
    }
