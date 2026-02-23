from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.study import StudySession, SessionTask
from app.models.schemas.study import StudySessionCreate
from app.routes.auth import get_current_user # Ajuste conforme seu arquivo de auth
import uuid

router = APIRouter(prefix="/sessions", tags=["Sessions"])

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: StudySessionCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 1. Cria a sessão principal
    new_session = StudySession(
        user_id=current_user.id,
        subject_id=session_data.subject_id,
        total_questions=session_data.total_questions,
        correct_answers=session_data.correct_answers,
        duration_seconds=session_data.duration_seconds # Recebe o tempo do cronômetro
    )
    
    db.add(new_session)
    db.flush() # Flush para obter o ID da sessão antes do commit final

    # 2. Salva as tarefas do checklist vinculadas a esta sessão
    for task in session_data.tasks:
        new_task = SessionTask(
            session_id=new_session.id,
            description=task.description,
            is_done=task.is_done
        )
        db.add(new_task)

    db.commit()
    db.refresh(new_session)
    return {"message": "Sessão salva com sucesso!", "session_id": new_session.id}

@router.get("/history")
async def get_session_history(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Retorna o histórico para alimentar sua tabela tabular no dash.html
    sessions = db.query(StudySession).filter(StudySession.user_id == current_user.id).all()
    return sessions

@router.post("/{session_id}/upload-pdf")
async def upload_pdf(
    session_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Aqui entrará a lógica para salvar no Supabase Storage
    # Por enquanto, apenas validamos a sessão
    session = db.query(StudySession).filter(StudySession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    # Lógica de upload...
    return {"filename": file.filename, "status": "Pronto para integração com Storage"}