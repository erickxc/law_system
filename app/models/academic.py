import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, ForeignKey, text, Integer, DateTime, Boolean, Float, Text, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Teacher(Base):
    __tablename__ = "teachers"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    subjects: Mapped[List["Subject"]] = relationship("Subject", back_populates="teacher")


class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sigla: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    priority: Mapped[str] = mapped_column(String(10), default="Média")
    period: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Pendente")
    no_teacher: Mapped[bool] = mapped_column(Boolean, default=False)

    group_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("core.groups.id", ondelete="CASCADE"), nullable=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core.users.id", ondelete="CASCADE"), nullable=False
    )
    teacher_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("academic.teachers.id", ondelete="SET NULL"), nullable=True
    )

    share_token: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True, index=True)

    teacher: Mapped[Optional["Teacher"]] = relationship("Teacher", back_populates="subjects")
    sessions: Mapped[List["StudySession"]] = relationship("StudySession", back_populates="subject")
    contents: Mapped[List["Content"]] = relationship("Content", back_populates="subject", cascade="all, delete-orphan")
    books: Mapped[List["Book"]] = relationship("Book", back_populates="subject")
    grades: Mapped[List["Grade"]] = relationship("Grade", back_populates="subject", cascade="all, delete-orphan")
    flashcards: Mapped[List["Flashcard"]] = relationship("Flashcard", back_populates="subject")


class Content(Base):
    __tablename__ = "contents"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic.subjects.id", ondelete="CASCADE"))
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    estimated_hours: Mapped[int] = mapped_column(Integer, default=0)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    subject: Mapped["Subject"] = relationship("Subject", back_populates="contents")


class Book(Base):
    __tablename__ = "books"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core.users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    author: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    genre: Mapped[Optional[str]] = mapped_column(String(100))
    total_pages: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    current_page: Mapped[int] = mapped_column(Integer, default=0)
    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cover_color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    subject_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("academic.subjects.id", ondelete="SET NULL"), nullable=True
    )
    subject: Mapped[Optional["Subject"]] = relationship("Subject", back_populates="books")
    annotations: Mapped[List["BookAnnotation"]] = relationship(
        "BookAnnotation", back_populates="book", cascade="all, delete-orphan"
    )
    highlights: Mapped[List["BookHighlight"]] = relationship(
        "BookHighlight", back_populates="book", cascade="all, delete-orphan"
    )


class BookAnnotation(Base):
    __tablename__ = "book_annotations"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academic.books.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core.users.id", ondelete="CASCADE"), nullable=False
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    note_text: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="yellow")
    # Sticky note: tag semântica (check, done, review, important, question, pin) + posição na página (% da largura/altura)
    tag: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    x_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    y_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    book: Mapped["Book"] = relationship("Book", back_populates="annotations")


class BookHighlight(Base):
    __tablename__ = "book_highlights"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academic.books.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core.users.id", ondelete="CASCADE"), nullable=False
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    selected_text: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="yellow")
    rects: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    book: Mapped["Book"] = relationship("Book", back_populates="highlights")


class Grade(Base):
    __tablename__ = "grades"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic.subjects.id", ondelete="CASCADE"))
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    subject: Mapped["Subject"] = relationship("Subject", back_populates="grades")


class StudySession(Base):
    __tablename__ = "study_sessions"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("core.users.id", ondelete="CASCADE"))
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic.subjects.id", ondelete="CASCADE"))

    start_time: Mapped[datetime] = mapped_column(DateTime, server_default=text("NOW()"))
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    correct_answers: Mapped[int] = mapped_column(Integer, default=0)

    subject: Mapped["Subject"] = relationship("Subject", back_populates="sessions")
    tasks: Mapped[List["SessionTask"]] = relationship("SessionTask", back_populates="session", cascade="all, delete-orphan")
    highlights: Mapped[List["PdfHighlight"]] = relationship("PdfHighlight", back_populates="session", cascade="all, delete-orphan")


class SessionTask(Base):
    __tablename__ = "session_tasks"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic.study_sessions.id", ondelete="CASCADE"))
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)

    session: Mapped["StudySession"] = relationship("StudySession", back_populates="tasks")


class PdfHighlight(Base):
    __tablename__ = "pdf_highlights"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic.study_sessions.id", ondelete="CASCADE"))
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    color: Mapped[str] = mapped_column(String(50), default="yellow")

    session: Mapped["StudySession"] = relationship("StudySession", back_populates="highlights")


class Flashcard(Base):
    __tablename__ = "flashcards"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core.users.id", ondelete="CASCADE"), nullable=False
    )
    subject_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("academic.subjects.id", ondelete="SET NULL"), nullable=True
    )
    front: Mapped[str] = mapped_column(Text, nullable=False)
    back: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    difficulty: Mapped[str] = mapped_column(String(10), default="medium", server_default=text("'medium'"))  # easy | medium | hard
    # Spaced repetition fields (SM-2)
    interval_days: Mapped[float] = mapped_column(Float, default=1.0)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    next_review_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    total_reviews: Mapped[int] = mapped_column(Integer, default=0)
    correct_reviews: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    subject: Mapped[Optional["Subject"]] = relationship("Subject", back_populates="flashcards")
    reviews: Mapped[List["FlashcardReview"]] = relationship(
        "FlashcardReview", back_populates="flashcard", cascade="all, delete-orphan"
    )


class FlashcardReview(Base):
    __tablename__ = "flashcard_reviews"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    flashcard_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academic.flashcards.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core.users.id", ondelete="CASCADE"), nullable=False
    )
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    confidence: Mapped[int] = mapped_column(Integer, default=3)  # 1..5
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    flashcard: Mapped["Flashcard"] = relationship("Flashcard", back_populates="reviews")


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core.users.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    payment_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pendente")  # pago | pendente | inadimplente
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core.users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # event_type: revisao | estudo | aula | prova | outro
    event_type: Mapped[str] = mapped_column(String(20), default="outro", server_default=text("'outro'"))
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("FALSE"))
    subject_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("academic.subjects.id", ondelete="SET NULL"), nullable=True
    )
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("FALSE"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    subject: Mapped[Optional["Subject"]] = relationship("Subject", foreign_keys=[subject_id])


class ClassSchedule(Base):
    __tablename__ = "class_schedules"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core.users.id", ondelete="CASCADE"), nullable=False
    )
    subject_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("academic.subjects.id", ondelete="SET NULL"), nullable=True
    )
    subject_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # fallback se sem subject_id
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=domingo, 6=sábado
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)  # "HH:MM"
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    teacher_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
