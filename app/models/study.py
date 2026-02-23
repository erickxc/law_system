from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, JSON, UUID
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
from datetime import datetime

class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id")) # Vinculado ao academic.py
    
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)
    
    total_questions = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    pdf_url = Column(String, nullable=True) # Link para o storage do Supabase

    # Relacionamentos
    tasks = relationship("SessionTask", back_populates="session")
    highlights = relationship("PdfHighlight", back_populates="session")

class SessionTask(Base):
    __tablename__ = "session_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("study_sessions.id"))
    description = Column(String, nullable=False)
    is_done = Column(Boolean, default=False)

    session = relationship("StudySession", back_populates="tasks")

class PdfHighlight(Base):
    __tablename__ = "pdf_highlights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("study_sessions.id"))
    
    page_number = Column(Integer, nullable=False)
    # Aqui salvamos o JSON com as coordenadas (x, y, largura, altura) do grifo
    content_json = Column(JSON, nullable=False) 
    color = Column(String, default="yellow")

    session = relationship("StudySession", back_populates="highlights")