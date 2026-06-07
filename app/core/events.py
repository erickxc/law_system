"""Helper pra emitir LearningEvents de forma segura.
Usado pelas rotas existentes (sessions, books, flashcards) sem acoplar lógica.
"""
from typing import Optional, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.academic import LearningEvent


def emit_event(
    db: Session,
    *,
    user_id: UUID,
    event_type: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    subject_id: Optional[UUID] = None,
    page_number: Optional[int] = None,
    score: Optional[int] = None,
    meta: Optional[dict] = None,
    commit: bool = False,
) -> None:
    """Adiciona um LearningEvent. NÃO commita por padrão (deixa o caller controlar)."""
    try:
        ev = LearningEvent(
            user_id=user_id,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            subject_id=subject_id,
            page_number=page_number,
            score=score,
            meta=meta,
            occurred_at=datetime.utcnow(),
        )
        db.add(ev)
        if commit:
            db.commit()
    except Exception:
        # Eventos não devem quebrar o fluxo principal. Loga e segue.
        import logging
        logging.getLogger(__name__).exception("Falha ao emitir LearningEvent %s", event_type)
        if commit:
            db.rollback()
