from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.core.auth import get_current_user
from app.core.events import emit_event
from app.models.academic import Book, BookAnnotation, BookHighlight, Subject

router = APIRouter(prefix="/books", tags=["Books"])


class BookCreate(BaseModel):
    name: str
    author: Optional[str] = None
    genre: Optional[str] = None
    total_pages: int = 1
    current_page: int = 0
    url: Optional[str] = None
    cover_color: Optional[str] = None
    subject_id: Optional[UUID] = None


class BookUpdate(BaseModel):
    name: Optional[str] = None
    author: Optional[str] = None
    genre: Optional[str] = None
    total_pages: Optional[int] = None
    current_page: Optional[int] = None
    url: Optional[str] = None
    cover_color: Optional[str] = None
    subject_id: Optional[UUID] = None


VALID_TAGS = {"check", "done", "review", "important", "question", "pin"}


class AnnotationCreate(BaseModel):
    page_number: int
    note_text: str
    color: str = "yellow"
    tag: Optional[str] = None
    x_pct: Optional[float] = None
    y_pct: Optional[float] = None


class AnnotationUpdate(BaseModel):
    note_text: Optional[str] = None
    color: Optional[str] = None
    tag: Optional[str] = None
    x_pct: Optional[float] = None
    y_pct: Optional[float] = None


class HighlightCreate(BaseModel):
    page_number: int
    selected_text: str
    color: str = "yellow"
    rects: Optional[List[dict]] = None  # [{x,y,w,h} em % do wrap]


def _book_dict(b: Book) -> dict:
    progress = round(b.current_page / b.total_pages * 100, 1) if b.total_pages > 0 else 0
    return {
        "id": str(b.id),
        "name": b.name,
        "author": b.author,
        "genre": b.genre,
        "total_pages": b.total_pages,
        "current_page": b.current_page,
        "progress_pct": progress,
        "url": b.url,
        "cover_color": b.cover_color,
        "subject_id": str(b.subject_id) if b.subject_id else None,
        "subject_name": b.subject.name if b.subject else None,
    }


def _annotation_dict(a: BookAnnotation) -> dict:
    return {
        "id": str(a.id),
        "page_number": a.page_number,
        "note_text": a.note_text,
        "color": a.color,
        "tag": a.tag,
        "x_pct": a.x_pct,
        "y_pct": a.y_pct,
        "created_at": a.created_at.isoformat(),
    }


def _highlight_dict(h: BookHighlight) -> dict:
    return {
        "id": str(h.id),
        "page_number": h.page_number,
        "selected_text": h.selected_text,
        "color": h.color,
        "rects": h.rects or [],
        "created_at": h.created_at.isoformat(),
    }


# ── Books CRUD ───────────────────────────────────────────

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_book(
    data: BookCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if data.subject_id:
        subj = db.query(Subject).filter(
            Subject.id == data.subject_id, Subject.user_id == current_user.id
        ).first()
        if not subj:
            raise HTTPException(status_code=404, detail="Matéria não encontrada.")

    book = Book(
        user_id=current_user.id,
        name=data.name,
        author=data.author,
        genre=data.genre,
        total_pages=data.total_pages,
        current_page=data.current_page,
        url=data.url,
        cover_color=data.cover_color,
        subject_id=data.subject_id,
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    db.expire(book)
    book = db.query(Book).options(joinedload(Book.subject)).filter(Book.id == book.id).first()
    return _book_dict(book)


@router.get("/")
def list_books(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    books = (
        db.query(Book)
        .options(joinedload(Book.subject))
        .filter(Book.user_id == current_user.id)
        .order_by(Book.name)
        .all()
    )
    return [_book_dict(b) for b in books]


@router.get("/{book_id}")
def get_book(
    book_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    book = (
        db.query(Book)
        .options(joinedload(Book.subject))
        .filter(Book.id == book_id, Book.user_id == current_user.id)
        .first()
    )
    if not book:
        raise HTTPException(status_code=404, detail="Livro não encontrado.")
    return _book_dict(book)


@router.put("/{book_id}")
def update_book(
    book_id: UUID,
    data: BookUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Livro não encontrado.")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(book, k, v)
    db.commit()
    db.expire(book)
    book = db.query(Book).options(joinedload(Book.subject)).filter(Book.id == book_id).first()
    return _book_dict(book)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(
    book_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Livro não encontrado.")
    db.delete(book)
    db.commit()


# ── Annotations ──────────────────────────────────────────

@router.get("/{book_id}/annotations")
def list_annotations(
    book_id: UUID,
    page: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Livro não encontrado.")

    q = db.query(BookAnnotation).filter(
        BookAnnotation.book_id == book_id, BookAnnotation.user_id == current_user.id
    )
    if page is not None:
        q = q.filter(BookAnnotation.page_number == page)
    return [_annotation_dict(a) for a in q.order_by(BookAnnotation.page_number, BookAnnotation.created_at).all()]


@router.post("/{book_id}/annotations", status_code=status.HTTP_201_CREATED)
def create_annotation(
    book_id: UUID,
    data: AnnotationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Livro não encontrado.")

    if data.tag and data.tag not in VALID_TAGS:
        raise HTTPException(400, f"tag inválida. Use uma de: {', '.join(VALID_TAGS)}")

    ann = BookAnnotation(
        book_id=book_id,
        user_id=current_user.id,
        page_number=data.page_number,
        note_text=data.note_text,
        color=data.color,
        tag=data.tag,
        x_pct=data.x_pct,
        y_pct=data.y_pct,
    )
    db.add(ann)
    db.flush()
    emit_event(
        db,
        user_id=current_user.id,
        event_type="etiqueta" if data.tag else "anotacao",
        entity_type="annotation",
        entity_id=ann.id,
        subject_id=book.subject_id,
        page_number=data.page_number,
        meta={"book_id": str(book_id), "tag": data.tag, "color": data.color},
    )
    db.commit()
    db.refresh(ann)
    return _annotation_dict(ann)


@router.put("/annotations/{annotation_id}")
def update_annotation(
    annotation_id: UUID,
    data: AnnotationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ann = db.query(BookAnnotation).filter(
        BookAnnotation.id == annotation_id, BookAnnotation.user_id == current_user.id
    ).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Anotação não encontrada.")
    if data.tag is not None and data.tag != "" and data.tag not in VALID_TAGS:
        raise HTTPException(400, f"tag inválida. Use uma de: {', '.join(VALID_TAGS)}")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(ann, k, v)
    db.commit()
    db.refresh(ann)
    return _annotation_dict(ann)


@router.delete("/annotations/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_annotation(
    annotation_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    ann = db.query(BookAnnotation).filter(
        BookAnnotation.id == annotation_id, BookAnnotation.user_id == current_user.id
    ).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Anotação não encontrada.")
    db.delete(ann)
    db.commit()


# ── Highlights ───────────────────────────────────────────

@router.get("/{book_id}/highlights")
def list_highlights(
    book_id: UUID,
    page: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Livro não encontrado.")

    q = db.query(BookHighlight).filter(
        BookHighlight.book_id == book_id, BookHighlight.user_id == current_user.id
    )
    if page is not None:
        q = q.filter(BookHighlight.page_number == page)
    return [_highlight_dict(h) for h in q.order_by(BookHighlight.page_number, BookHighlight.created_at).all()]


@router.post("/{book_id}/highlights", status_code=status.HTTP_201_CREATED)
def create_highlight(
    book_id: UUID,
    data: HighlightCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == current_user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Livro não encontrado.")

    h = BookHighlight(
        book_id=book_id,
        user_id=current_user.id,
        page_number=data.page_number,
        selected_text=data.selected_text,
        color=data.color,
        rects=data.rects or [],
    )
    db.add(h)
    db.flush()
    emit_event(
        db,
        user_id=current_user.id,
        event_type="grifo",
        entity_type="highlight",
        entity_id=h.id,
        subject_id=book.subject_id,
        page_number=data.page_number,
        meta={"book_id": str(book_id), "color": data.color, "text_preview": (data.selected_text or "")[:80]},
    )
    db.commit()
    db.refresh(h)
    return _highlight_dict(h)


@router.delete("/highlights/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_highlight(
    highlight_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    h = db.query(BookHighlight).filter(
        BookHighlight.id == highlight_id, BookHighlight.user_id == current_user.id
    ).first()
    if not h:
        raise HTTPException(status_code=404, detail="Grifado não encontrado.")
    db.delete(h)
    db.commit()
