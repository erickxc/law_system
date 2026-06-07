"""Grafo de Conhecimento — visualização de relações entre entidades.

Nós: Subject, Book, Flashcard, Note, Highlight, Annotation
Arestas:
  Book → Subject (book.subject_id)
  Flashcard → Subject (flashcard.subject_id)
  Note → Subject (note.subject_id)
  Note → Book (note.book_id)
  Highlight → Book
  Annotation → Book
  Flashcard ↔ "coleção:X" (parseado da tag)
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.academic import (
    Subject, Book, Flashcard, Note, BookHighlight, BookAnnotation,
)

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])


@router.get("/graph")
def get_knowledge_graph(
    subject_id: Optional[UUID] = None,
    include_highlights: bool = Query(False, description="Incluir grifos (pode ficar pesado)"),
    include_annotations: bool = Query(False, description="Incluir anotações"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna nós e arestas pra visualização (vis.js / cytoscape).
    Filtros opcionais por matéria reduzem o escopo."""

    nodes = []
    edges = []
    seen = set()

    def add_node(node_id: str, label: str, group: str, **extra):
        if node_id in seen:
            return
        seen.add(node_id)
        nodes.append({"id": node_id, "label": label, "group": group, **extra})

    def add_edge(src: str, dst: str, label: str = ""):
        edges.append({"from": src, "to": dst, "label": label})

    # ── Subjects ──
    sq = db.query(Subject).filter(Subject.user_id == current_user.id)
    if subject_id:
        sq = sq.filter(Subject.id == subject_id)
    subjects = sq.all()
    for s in subjects:
        add_node(f"sub_{s.id}", s.name, "subject", title=f"Matéria · {s.priority}", priority=s.priority)

    subj_ids = [s.id for s in subjects]
    if not subj_ids and not subject_id:
        # sem subject filter, ainda assim mostra órfãos? Pulamos por simplicidade
        return {"nodes": nodes, "edges": edges}

    # ── Books ──
    book_q = db.query(Book).filter(Book.user_id == current_user.id)
    if subject_id:
        book_q = book_q.filter(Book.subject_id == subject_id)
    books = book_q.all()
    for b in books:
        add_node(f"book_{b.id}", b.name[:50], "book", title=f"Livro · {b.author or 'sem autor'}")
        if b.subject_id:
            add_edge(f"book_{b.id}", f"sub_{b.subject_id}", "pertence")
    book_ids = [b.id for b in books]

    # ── Flashcards ──
    fc_q = db.query(Flashcard).filter(Flashcard.user_id == current_user.id)
    if subject_id:
        fc_q = fc_q.filter(Flashcard.subject_id == subject_id)
    cards = fc_q.all()

    # Coleções (parseadas das tags)
    collections = {}
    for c in cards:
        label_text = c.front[:40] + ("..." if len(c.front) > 40 else "")
        add_node(f"card_{c.id}", label_text, "flashcard", title=f"Flashcard · acerto: {round((c.correct_reviews or 0)/(c.total_reviews or 1)*100)}%")
        if c.subject_id:
            add_edge(f"card_{c.id}", f"sub_{c.subject_id}", "revisa")
        # Coleção via tag
        if c.tags:
            for t in c.tags.split(","):
                t = t.strip()
                if t.startswith("coleção:") or t.startswith("colecao:"):
                    col = t.split(":", 1)[1].strip()
                    if col not in collections:
                        collections[col] = f"col_{len(collections)}"
                        add_node(collections[col], col, "collection", title="Coleção de flashcards")
                    add_edge(f"card_{c.id}", collections[col], "")

    # ── Notes ──
    note_q = db.query(Note).filter(Note.user_id == current_user.id)
    if subject_id:
        note_q = note_q.filter(Note.subject_id == subject_id)
    notes = note_q.all()
    for n in notes:
        kind_label = {"text": "Texto", "handwriting": "Manuscrito", "hybrid": "Híbrido"}.get(n.kind, n.kind)
        add_node(f"note_{n.id}", n.title[:40], "note", title=f"Nota · {kind_label}")
        if n.subject_id:
            add_edge(f"note_{n.id}", f"sub_{n.subject_id}", "sobre")
        if n.book_id:
            add_edge(f"note_{n.id}", f"book_{n.book_id}", "do livro")

    # ── Highlights / Annotations (opcionais, podem inchar) ──
    if include_highlights and book_ids:
        hls = db.query(BookHighlight).filter(
            BookHighlight.user_id == current_user.id,
            BookHighlight.book_id.in_(book_ids),
        ).limit(200).all()
        for h in hls:
            preview = (h.selected_text or "")[:30] + "..."
            add_node(f"hl_{h.id}", preview, "highlight", title=f"Grifo · pg. {h.page_number}")
            add_edge(f"hl_{h.id}", f"book_{h.book_id}", "grifo em")

    if include_annotations and book_ids:
        ann_q = db.query(BookAnnotation).filter(
            BookAnnotation.user_id == current_user.id,
            BookAnnotation.book_id.in_(book_ids),
        ).limit(200).all()
        for a in ann_q:
            label_text = (a.note_text or a.tag or "etiqueta")[:30]
            add_node(f"ann_{a.id}", label_text, "annotation", title=f"Anotação · pg. {a.page_number}")
            add_edge(f"ann_{a.id}", f"book_{a.book_id}", "anotação em")

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "subjects": len(subjects),
            "books": len(books),
            "flashcards": len(cards),
            "notes": len(notes),
            "collections": len(collections),
        },
    }
