from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from pathlib import Path

from app.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.academic import (
    Payment, Subject, StudySession, Book, BookAnnotation, BookHighlight,
    Flashcard, FlashcardReview, Grade, SessionTask, PdfHighlight, Content,
)
from sqlalchemy import func, and_

router = APIRouter(prefix="/admin", tags=["Admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return current_user


class PaymentCreate(BaseModel):
    amount: float
    description: str
    payment_date: str
    status: str = "pendente"


class PaymentStatusUpdate(BaseModel):
    status: str


# ── Acessos ──────────────────────────────────────────────

@router.get("/pending")
def list_pending(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    users = db.query(User).filter(User.is_approved == False, User.is_active == True).all()
    return [_user_dict(u) for u in users]


@router.post("/approve/{user_id}")
def approve_user(user_id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    user.is_approved = True
    db.commit()
    return {"message": "Usuário aprovado"}


@router.get("/users")
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    users = db.query(User).filter(User.id != admin.id).order_by(User.created_at.desc()).all()
    return [_user_dict(u) for u in users]


@router.patch("/users/{user_id}/toggle")
def toggle_access(user_id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    user.is_active = not user.is_active
    if not user.is_active:
        user.is_approved = False
    db.commit()
    return {"is_active": user.is_active}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Não é possível excluir a própria conta")

    # Cleanup explícito — independente de CASCADE no banco
    # Ordem: dependentes de subjects/books/sessions → subjects/books/sessions → user
    subject_ids = [s.id for s in db.query(Subject).filter(Subject.user_id == user_id).all()]
    session_ids = [s.id for s in db.query(StudySession).filter(StudySession.user_id == user_id).all()]
    book_ids = [b.id for b in db.query(Book).filter(Book.user_id == user_id).all()]
    card_ids = [c.id for c in db.query(Flashcard).filter(Flashcard.user_id == user_id).all()]

    if session_ids:
        db.query(SessionTask).filter(SessionTask.session_id.in_(session_ids)).delete(synchronize_session=False)
        db.query(PdfHighlight).filter(PdfHighlight.session_id.in_(session_ids)).delete(synchronize_session=False)
    if subject_ids:
        db.query(Content).filter(Content.subject_id.in_(subject_ids)).delete(synchronize_session=False)
        db.query(Grade).filter(Grade.subject_id.in_(subject_ids)).delete(synchronize_session=False)
    if book_ids:
        db.query(BookAnnotation).filter(BookAnnotation.book_id.in_(book_ids)).delete(synchronize_session=False)
        db.query(BookHighlight).filter(BookHighlight.book_id.in_(book_ids)).delete(synchronize_session=False)
    if card_ids:
        db.query(FlashcardReview).filter(FlashcardReview.flashcard_id.in_(card_ids)).delete(synchronize_session=False)

    db.query(StudySession).filter(StudySession.user_id == user_id).delete(synchronize_session=False)
    db.query(Book).filter(Book.user_id == user_id).delete(synchronize_session=False)
    db.query(Flashcard).filter(Flashcard.user_id == user_id).delete(synchronize_session=False)
    db.query(Subject).filter(Subject.user_id == user_id).delete(synchronize_session=False)
    db.query(Payment).filter(Payment.user_id == user_id).delete(synchronize_session=False)

    db.delete(user)
    db.commit()


# ── Cobranças ─────────────────────────────────────────────

@router.get("/users/{user_id}/payments")
def list_payments(user_id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    payments = db.query(Payment).filter(Payment.user_id == user_id).order_by(Payment.payment_date.desc()).all()
    return [_payment_dict(p) for p in payments]


@router.get("/payments/overview")
def payments_overview(
    status: str | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Lista todos os pagamentos do sistema com nome do usuário.
    Filtros: status=pago|pendente|inadimplente."""
    q = (
        db.query(Payment, User.full_name, User.email)
        .join(User, User.id == Payment.user_id)
    )
    if status:
        if status not in ("pago", "pendente", "inadimplente"):
            raise HTTPException(status_code=400, detail="Status inválido")
        q = q.filter(Payment.status == status)
    rows = q.order_by(Payment.payment_date.desc()).all()

    totals = (
        db.query(Payment.status, func.count(Payment.id), func.coalesce(func.sum(Payment.amount), 0))
        .group_by(Payment.status)
        .all()
    )
    summary = {s: {"count": c, "amount": float(a)} for s, c, a in totals}

    return {
        "summary": summary,
        "payments": [
            {**_payment_dict(p), "user_name": name, "user_email": email}
            for p, name, email in rows
        ],
    }


@router.post("/users/{user_id}/payments", status_code=201)
def create_payment(
    user_id: UUID,
    data: PaymentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    payment = Payment(
        user_id=user_id,
        amount=data.amount,
        description=data.description,
        payment_date=datetime.fromisoformat(data.payment_date),
        status=data.status
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return _payment_dict(payment)


@router.patch("/payments/{payment_id}/status")
def update_payment_status(
    payment_id: UUID,
    body: PaymentStatusUpdate | None = None,
    status: str | None = None,  # mantido por compat: aceita ?status=pago
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    new_status = (body.status if body else None) or status
    if not new_status:
        raise HTTPException(status_code=400, detail="status é obrigatório (body ou query)")
    if new_status not in ("pago", "pendente", "inadimplente"):
        raise HTTPException(status_code=400, detail="Status inválido")

    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    payment.status = new_status
    db.commit()
    return _payment_dict(payment)


@router.delete("/payments/{payment_id}", status_code=204)
def delete_payment(payment_id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    db.delete(payment)
    db.commit()


# ── Helpers ───────────────────────────────────────────────

def _user_dict(u: User) -> dict:
    return {
        "id": str(u.id),
        "full_name": u.full_name,
        "email": u.email,
        "curso": u.curso,
        "role": u.role,
        "is_approved": u.is_approved,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def _payment_dict(p: Payment) -> dict:
    return {
        "id": str(p.id),
        "user_id": str(p.user_id),
        "amount": p.amount,
        "description": p.description,
        "payment_date": p.payment_date.isoformat(),
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


# ── Migrations (admin-only, idempotente) ──────────────────────────────────

@router.post("/migrations/{name}")
def run_migration(
    name: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Executa um arquivo SQL de migrations/. Idempotente — pode rodar várias vezes."""
    # Whitelist — apenas migrations conhecidas
    allowed = {
        "001_user_lockout_and_photo",
        "002_calendar_schedule_difficulty",
        "003_goal_and_share",
        "004_sticky_notes",
        "005_multi_goals",
    }
    if name not in allowed:
        raise HTTPException(status_code=404, detail=f"Migration '{name}' não existe")

    sql_path = Path(__file__).resolve().parents[3] / "migrations" / f"{name}.sql"
    if not sql_path.exists():
        raise HTTPException(status_code=404, detail=f"Arquivo {sql_path.name} não encontrado")

    sql = sql_path.read_text(encoding="utf-8")
    try:
        # DDL no PostgreSQL é transacional. Pode rodar dentro do scope normal.
        db.execute(text(sql))
        db.commit()
        return {"ok": True, "migration": name, "size_bytes": len(sql)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao executar migration: {e}")
