"""Pesquisa unificada full-text com Postgres tsvector.
GET /search?q= retorna agregado por tipo (subjects, books, notes, flashcards, highlights, annotations).
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.academic import (
    Subject, Book, Note, Flashcard, BookHighlight, BookAnnotation,
)

router = APIRouter(prefix="/search", tags=["Search"])


def _build_tsquery(q: str) -> str:
    """Constroi uma tsquery em português removendo caracteres especiais.
    Suporta múltiplas palavras (AND implícito) e prefixo (`:*`)."""
    import re
    # Remove caracteres de operador de tsquery pra evitar injeção/erro
    q = re.sub(r"[&|!():'<>*]", " ", q).strip()
    if not q:
        return ""
    parts = q.split()
    # Cada palavra com prefixo wildcard
    return " & ".join(f"{p}:*" for p in parts if p)


@router.get("/")
def unified_search(
    q: str = Query(..., min_length=2, max_length=200),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Busca em todas as fontes do usuário. Retorna agrupado por tipo."""
    tsquery = _build_tsquery(q)
    if not tsquery:
        return {"query": q, "subjects": [], "books": [], "notes": [], "flashcards": [], "highlights": [], "annotations": []}

    # SQL com ranking ts_rank para ordenar por relevância
    def search_table(table_sql: str, fields_sql: str, joins: str = "", has_created_at: bool = True):
        order = "rank DESC, created_at DESC NULLS LAST" if has_created_at else "rank DESC"
        sql = f"""
            SELECT {fields_sql},
                ts_rank(search_vector, to_tsquery('portuguese', :tsq)) AS rank
            FROM {table_sql}
            {joins}
            WHERE user_id = :uid
              AND search_vector @@ to_tsquery('portuguese', :tsq)
            ORDER BY {order}
            LIMIT :lim
        """
        return db.execute(text(sql), {"tsq": tsquery, "uid": str(current_user.id), "lim": limit}).all()

    # Subjects (sem created_at)
    sub_rows = search_table(
        "academic.subjects",
        "id, name, sigla, priority, status",
        has_created_at=False,
    )
    subjects = [{"id": str(r.id), "name": r.name, "sigla": r.sigla, "priority": r.priority, "status": r.status, "rank": float(r.rank)} for r in sub_rows]

    # Books (sem created_at)
    book_rows = search_table(
        "academic.books",
        "id, name, author, current_page, total_pages, subject_id",
        has_created_at=False,
    )
    books = [{"id": str(r.id), "name": r.name, "author": r.author, "current_page": r.current_page, "total_pages": r.total_pages, "subject_id": str(r.subject_id) if r.subject_id else None, "rank": float(r.rank)} for r in book_rows]

    # Notes
    note_rows = search_table(
        "academic.notes",
        "id, title, kind, subject_id, content_plain",
    )
    notes = [{"id": str(r.id), "title": r.title, "kind": r.kind, "subject_id": str(r.subject_id) if r.subject_id else None, "preview": (r.content_plain or "")[:160], "rank": float(r.rank)} for r in note_rows]

    # Flashcards
    fc_rows = search_table(
        "academic.flashcards",
        "id, front, back, subject_id, tags",
    )
    flashcards = [{"id": str(r.id), "front": r.front, "back": (r.back or "")[:160], "subject_id": str(r.subject_id) if r.subject_id else None, "tags": r.tags, "rank": float(r.rank)} for r in fc_rows]

    # Highlights — agora tem que juntar com book pra mostrar contexto
    hl_sql = """
        SELECT h.id, h.selected_text, h.page_number, h.color, h.book_id, b.name AS book_name,
            ts_rank(h.search_vector, to_tsquery('portuguese', :tsq)) AS rank
        FROM academic.book_highlights h
        LEFT JOIN academic.books b ON b.id = h.book_id
        WHERE h.user_id = :uid
          AND h.search_vector @@ to_tsquery('portuguese', :tsq)
        ORDER BY rank DESC, h.created_at DESC
        LIMIT :lim
    """
    hl_rows = db.execute(text(hl_sql), {"tsq": tsquery, "uid": str(current_user.id), "lim": limit}).all()
    highlights = [{
        "id": str(r.id), "selected_text": (r.selected_text or "")[:200],
        "page_number": r.page_number, "color": r.color,
        "book_id": str(r.book_id) if r.book_id else None, "book_name": r.book_name,
        "rank": float(r.rank),
    } for r in hl_rows]

    # Annotations
    ann_sql = """
        SELECT a.id, a.note_text, a.page_number, a.tag, a.book_id, b.name AS book_name,
            ts_rank(a.search_vector, to_tsquery('portuguese', :tsq)) AS rank
        FROM academic.book_annotations a
        LEFT JOIN academic.books b ON b.id = a.book_id
        WHERE a.user_id = :uid
          AND a.search_vector @@ to_tsquery('portuguese', :tsq)
        ORDER BY rank DESC, a.created_at DESC
        LIMIT :lim
    """
    ann_rows = db.execute(text(ann_sql), {"tsq": tsquery, "uid": str(current_user.id), "lim": limit}).all()
    annotations = [{
        "id": str(r.id), "note_text": (r.note_text or "")[:200],
        "page_number": r.page_number, "tag": r.tag,
        "book_id": str(r.book_id) if r.book_id else None, "book_name": r.book_name,
        "rank": float(r.rank),
    } for r in ann_rows]

    return {
        "query": q,
        "subjects": subjects,
        "books": books,
        "notes": notes,
        "flashcards": flashcards,
        "highlights": highlights,
        "annotations": annotations,
        "total": len(subjects) + len(books) + len(notes) + len(flashcards) + len(highlights) + len(annotations),
    }
