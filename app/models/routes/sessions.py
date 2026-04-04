from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.database import get_db
from app.models.academic import StudySession, SessionTask
from app.models.schemas.study import StudySessionCreate, StudySessionResponse
from app.core.auth import get_current_user

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_session(
    session_data: StudySessionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    new_session = StudySession(
        user_id=current_user.id,
        subject_id=session_data.subject_id,
        total_questions=session_data.total_questions,
        correct_answers=session_data.correct_answers,
        duration_seconds=session_data.duration_seconds
    )

    db.add(new_session)
    db.flush()

    for task in session_data.tasks:
        db.add(SessionTask(
            session_id=new_session.id,
            description=task.description,
            is_done=task.is_done
        ))

    db.commit()
    db.refresh(new_session)
    return {"message": "Sessão salva com sucesso!", "session_id": str(new_session.id)}


@router.get("/history", response_model=List[StudySessionResponse])
def get_session_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(StudySession).filter(
        StudySession.user_id == current_user.id
    ).all()


@router.post("/{session_id}/upload-pdf")
def upload_pdf(
    session_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    session = db.query(StudySession).filter(
        StudySession.id == session_id,
        StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    return {"filename": file.filename, "status": "Pronto para integração com Storage"}
