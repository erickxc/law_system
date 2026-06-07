"""Notas acadêmicas — editor rich text, manuscrito ou híbrido.
Sanitização HTML server-side via whitelist (sem dependência externa).
"""
import re
from datetime import datetime
from typing import Optional
from uuid import UUID
from html.parser import HTMLParser

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from app.database import get_db
from app.core.auth import get_current_user
from app.core.events import emit_event
from app.models.academic import Note, Subject, Book

router = APIRouter(prefix="/notes", tags=["Notes"])


VALID_KINDS = {"text", "handwriting", "hybrid"}

# Tags permitidas (whitelist) e atributos por tag
ALLOWED_TAGS = {
    "p", "br", "strong", "b", "em", "i", "u", "s",
    "h1", "h2", "h3", "h4", "ul", "ol", "li",
    "blockquote", "code", "pre",
    "a", "img", "span", "div",
    # SVG inline (editor híbrido — desenho dentro do texto)
    "svg", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "g", "text", "tspan",
    # Tabelas
    "table", "thead", "tbody", "tr", "th", "td",
    # figure pra envolver SVG
    "figure", "figcaption",
}
ALLOWED_ATTRS = {
    "a": {"href", "title", "target", "rel"},
    "img": {"src", "alt", "title", "width", "height"},
    "span": {"style", "class"},
    "div": {"style", "class", "data-block", "contenteditable"},
    "p": {"style"},
    "figure": {"class", "data-block"},
    "figcaption": {"class"},
    "svg": {"xmlns", "viewBox", "width", "height", "preserveAspectRatio", "class"},
    "path": {"d", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "fill", "fill-opacity", "transform"},
    "rect": {"x", "y", "width", "height", "fill", "stroke", "stroke-width", "rx", "ry"},
    "circle": {"cx", "cy", "r", "fill", "stroke", "stroke-width"},
    "ellipse": {"cx", "cy", "rx", "ry", "fill", "stroke", "stroke-width"},
    "line": {"x1", "y1", "x2", "y2", "stroke", "stroke-width", "stroke-linecap"},
    "polyline": {"points", "stroke", "stroke-width", "fill"},
    "polygon": {"points", "stroke", "stroke-width", "fill"},
    "g": {"transform", "stroke", "fill", "opacity"},
    "text": {"x", "y", "font-size", "font-family", "fill", "text-anchor"},
    "tspan": {"x", "y", "dx", "dy", "font-size"},
    "table": {"class"},
    "th": {"colspan", "rowspan"},
    "td": {"colspan", "rowspan"},
}
# Atributos style permitidos (cor + negrito + tamanho)
ALLOWED_STYLE_PROPS = {"color", "background-color", "font-weight", "font-size", "text-align", "text-decoration"}


class _Sanitizer(HTMLParser):
    """Parser que reescreve só tags/atributos permitidos. Drops scripts e on*=."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []

    def _safe_style(self, val: str) -> str:
        clean = []
        for decl in val.split(";"):
            decl = decl.strip()
            if not decl or ":" not in decl:
                continue
            prop, v = [x.strip() for x in decl.split(":", 1)]
            if prop.lower() in ALLOWED_STYLE_PROPS:
                # Remove parênteses/url() pra evitar injeção
                v_safe = re.sub(r"(url|expression|@import)\s*\(.*?\)", "", v, flags=re.I)
                clean.append(f"{prop}:{v_safe}")
        return ";".join(clean)

    def _safe_href(self, val: str) -> str:
        v = val.strip().lower()
        if v.startswith(("http://", "https://", "mailto:", "#", "/")):
            return val
        return ""

    def _safe_src(self, val: str) -> str:
        v = val.strip().lower()
        if v.startswith(("http://", "https://", "data:image/")):
            return val
        return ""

    def _write_tag(self, tag, attrs, closing=False):
        if tag not in ALLOWED_TAGS:
            return
        if closing:
            self.out.append(f"</{tag}>")
            return
        allowed = ALLOWED_ATTRS.get(tag, set())
        safe_attrs = []
        for k, v in attrs or []:
            kl = k.lower()
            if kl.startswith("on"):
                continue
            if kl not in allowed:
                continue
            if v is None:
                continue
            if kl == "style":
                v = self._safe_style(v)
                if not v:
                    continue
            elif kl == "href":
                v = self._safe_href(v)
                if not v:
                    continue
            elif kl == "src":
                v = self._safe_src(v)
                if not v:
                    continue
            v_esc = v.replace('"', '&quot;')
            safe_attrs.append(f'{kl}="{v_esc}"')
        attrs_str = (" " + " ".join(safe_attrs)) if safe_attrs else ""
        # Self-closing pra img/br
        if tag in {"img", "br"}:
            self.out.append(f"<{tag}{attrs_str}>")
        else:
            self.out.append(f"<{tag}{attrs_str}>")

    def handle_starttag(self, tag, attrs):
        self._write_tag(tag, attrs)

    def handle_endtag(self, tag):
        self._write_tag(tag, None, closing=True)

    def handle_startendtag(self, tag, attrs):
        self._write_tag(tag, attrs)

    def handle_data(self, data):
        # Escapa texto: o html.parser já decodifica entities, então re-escapa
        self.out.append(data.replace("<", "&lt;").replace(">", "&gt;"))


def sanitize_html(html: Optional[str]) -> Optional[str]:
    if not html:
        return html
    if len(html) > 500_000:  # 500KB hard cap
        html = html[:500_000]
    s = _Sanitizer()
    s.feed(html)
    return "".join(s.out)


_TAG_RE = re.compile(r"<[^>]+>")

def html_to_plain(html: Optional[str]) -> Optional[str]:
    if not html:
        return html
    txt = _TAG_RE.sub(" ", html)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt[:50_000]


# ─── Schemas ───────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    title: str
    kind: str = "text"
    content_html: Optional[str] = None
    canvas_svg: Optional[str] = None
    canvas_png: Optional[str] = None
    subject_id: Optional[UUID] = None
    book_id: Optional[UUID] = None
    tags: Optional[str] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    kind: Optional[str] = None
    content_html: Optional[str] = None
    canvas_svg: Optional[str] = None
    canvas_png: Optional[str] = None
    subject_id: Optional[UUID] = None
    book_id: Optional[UUID] = None
    tags: Optional[str] = None


def _note_dict(n: Note) -> dict:
    return {
        "id": str(n.id),
        "title": n.title,
        "kind": n.kind,
        "content_html": n.content_html,
        "content_plain": n.content_plain,
        "canvas_svg": n.canvas_svg,
        "canvas_png": n.canvas_png,
        "subject_id": str(n.subject_id) if n.subject_id else None,
        "subject_name": n.subject.name if n.subject else None,
        "book_id": str(n.book_id) if n.book_id else None,
        "tags": n.tags,
        "created_at": n.created_at.isoformat(),
        "updated_at": n.updated_at.isoformat(),
    }


# ─── CRUD ─────────────────────────────────────────────────────────────

@router.get("/")
def list_notes(
    subject_id: Optional[UUID] = None,
    kind: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = (
        db.query(Note)
        .options(joinedload(Note.subject))
        .filter(Note.user_id == current_user.id)
    )
    if subject_id:
        q = q.filter(Note.subject_id == subject_id)
    if kind:
        if kind not in VALID_KINDS:
            raise HTTPException(400, f"kind inválido. Use: {', '.join(VALID_KINDS)}")
        q = q.filter(Note.kind == kind)
    return [_note_dict(n) for n in q.order_by(Note.updated_at.desc()).all()]


@router.get("/{note_id}")
def get_note(note_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    n = (
        db.query(Note)
        .options(joinedload(Note.subject))
        .filter(Note.id == note_id, Note.user_id == current_user.id)
        .first()
    )
    if not n:
        raise HTTPException(404, "Nota não encontrada.")
    return _note_dict(n)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_note(
    data: NoteCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if data.kind not in VALID_KINDS:
        raise HTTPException(400, f"kind inválido. Use: {', '.join(VALID_KINDS)}")
    if not data.title.strip():
        raise HTTPException(400, "Título é obrigatório.")

    if data.subject_id:
        s = db.query(Subject).filter(Subject.id == data.subject_id, Subject.user_id == current_user.id).first()
        if not s:
            raise HTTPException(404, "Matéria não encontrada.")
    if data.book_id:
        b = db.query(Book).filter(Book.id == data.book_id, Book.user_id == current_user.id).first()
        if not b:
            raise HTTPException(404, "Livro não encontrado.")

    safe_html = sanitize_html(data.content_html)
    plain = html_to_plain(safe_html)

    n = Note(
        user_id=current_user.id,
        subject_id=data.subject_id,
        book_id=data.book_id,
        title=data.title.strip()[:255],
        kind=data.kind,
        content_html=safe_html,
        content_plain=plain,
        canvas_svg=data.canvas_svg,
        canvas_png=data.canvas_png,
        tags=data.tags,
    )
    db.add(n)
    db.flush()
    emit_event(
        db,
        user_id=current_user.id,
        event_type="nota_criada",
        entity_type="note",
        entity_id=n.id,
        subject_id=data.subject_id,
        meta={"title": n.title, "kind": n.kind},
    )
    db.commit()
    db.refresh(n)
    return _note_dict(n)


@router.put("/{note_id}")
def update_note(
    note_id: UUID,
    data: NoteUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    n = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not n:
        raise HTTPException(404, "Nota não encontrada.")

    update = data.model_dump(exclude_unset=True)
    if "kind" in update and update["kind"] not in VALID_KINDS:
        raise HTTPException(400, f"kind inválido. Use: {', '.join(VALID_KINDS)}")
    if "title" in update:
        if not update["title"].strip():
            raise HTTPException(400, "Título não pode ficar vazio.")
        update["title"] = update["title"].strip()[:255]
    if "content_html" in update:
        safe = sanitize_html(update["content_html"])
        update["content_html"] = safe
        update["content_plain"] = html_to_plain(safe)

    for k, v in update.items():
        setattr(n, k, v)
    n.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(n)
    return _note_dict(n)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    n = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not n:
        raise HTTPException(404, "Nota não encontrada.")
    db.delete(n)
    db.commit()


# ─── Converter trecho de nota em flashcard ─────────────────────────────

class NoteToCardInput(BaseModel):
    selected_text: str
    front: Optional[str] = None  # se não vier, gera "Sobre <título>"
    subject_id: Optional[UUID] = None
    tags: Optional[str] = None
    difficulty: str = "medium"


@router.post("/{note_id}/to-flashcard", status_code=status.HTTP_201_CREATED)
def note_to_flashcard(
    note_id: UUID,
    data: NoteToCardInput,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Converte um trecho de uma nota num flashcard avulso."""
    from app.models.academic import Flashcard
    n = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not n:
        raise HTTPException(404, "Nota não encontrada.")
    if not data.selected_text.strip():
        raise HTTPException(400, "Selecione um trecho da nota.")

    front = (data.front or "").strip() or f"Sobre **{n.title}** — qual é o trecho?"
    subj = data.subject_id or n.subject_id
    tags = data.tags or f"nota:{n.title}"

    card = Flashcard(
        user_id=current_user.id,
        subject_id=subj,
        front=front,
        back=data.selected_text.strip()[:2000],
        tags=tags,
        difficulty=data.difficulty if data.difficulty in {"easy", "medium", "hard"} else "medium",
        next_review_at=datetime.utcnow(),
    )
    db.add(card)
    db.flush()
    emit_event(
        db,
        user_id=current_user.id,
        event_type="flashcard_criado",
        entity_type="flashcard",
        entity_id=card.id,
        subject_id=subj,
        meta={"origem": "nota", "note_id": str(note_id)},
    )
    db.commit()
    db.refresh(card)
    return {"id": str(card.id), "front": card.front, "back": card.back}
