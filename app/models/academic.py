import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, ForeignKey, text, Integer, DateTime, Boolean, Float, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Teacher(Base):
    __tablename__ = "teachers"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    subjects: Mapped[List["Subject"]] = relationship("Subject", back_populates="teacher")


class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = {"schema": "academic"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
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

    teacher: Mapped[Optional["Teacher"]] = relationship("Teacher", back_populates="subjects")
    sessions: Mapped[List["StudySession"]] = relationship("StudySession", back_populates="subject")
    contents: Mapped[List["Content"]] = relationship("Content", back_populates="subject", cascade="all, delete-orphan")
    books: Mapped[List["Book"]] = relationship("Book", back_populates="subject")
    grades: Mapped[List["Grade"]] = relationship("Grade", back_populates="subject", cascade="all, delete-orphan")


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
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    genre: Mapped[Optional[str]] = mapped_column(String(100))
    total_pages: Mapped[int] = mapped_column(Integer, nullable=False)
    current_page: Mapped[int] = mapped_column(Integer, default=0)
    pdf_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    subject_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("academic.subjects.id", ondelete="SET NULL"))
    subject: Mapped[Optional["Subject"]] = relationship("Subject", back_populates="books")


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
