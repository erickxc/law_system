import sys
import io
import os
import bcrypt
import uuid
import logging
from typing import Optional, List
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, EmailStr, Field, validator
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base, get_db
from app.models.user import User, Group
from app.models.academic import Subject, StudySession, Teacher, Content, Book, Grade
from config import settings

# --- CONFIGURAÇÃO DE LOGGING ---
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- INICIALIZAÇÃO DO APP ---
app = FastAPI(title="Law System API")

# --- IMPORTAÇÃO DAS ROTAS EXTERNAS ---
try:
    from app.models.routes import update_user
    app.include_router(update_user.router, prefix="/users", tags=["users"])
    logger.info("✅ Rota /users/me/update carregada com sucesso!")
except Exception as e:
    logger.error(f"❌ FALHA AO CARREGAR ROTA DE UPDATE: {e}")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SCHEMAS ---

class SessaoCreate(BaseModel):
    subject_id: uuid.UUID
    duration_seconds: int = Field(..., ge=0)
    total_questions: int = Field(default=0, ge=0)
    correct_answers: int = Field(default=0, ge=0)

    @validator('correct_answers')
    def validate_answers(cls, v, values):
        if 'total_questions' in values and v > values['total_questions']:
            raise ValueError('Acertos não pode ser maior que total de questões')
        return v

class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=3)
    email: EmailStr
    password: str = Field(..., min_length=8)
    cpf: Optional[str] = None 
    curso: Optional[str] = None 

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# NOVOS SCHEMAS (CADASTROS)
class TeacherCreate(BaseModel):
    name: str
    contact: Optional[str] = None
    email: Optional[str] = None

class SubjectCreate(BaseModel):
    name: str
    sigla: str
    priority: str # Alta, Média, Baixa
    period: int
    no_teacher: bool = False
    teacher_id: Optional[uuid.UUID] = None

    @validator('teacher_id', always=True)
    def validate_teacher_requirement(cls, v, values):
        # REGRA: Para matérias do semestre, professor é obrigatório exceto se "no_teacher" for True
        if not values.get('no_teacher') and v is None:
            raise ValueError('O professor é obrigatório para matérias do semestre atual, a menos que marque "Matéria sem Docente".')
        return v

class ContentCreate(BaseModel):
    subject_id: uuid.UUID
    description: str
    estimated_hours: int # Apenas números

class BookCreate(BaseModel):
    name: str
    genre: str
    total_pages: int # Apenas números
    subject_id: Optional[uuid.UUID] = None

# --- SEGURANÇA & AUXILIARES ---

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401)
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401)
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

# --- EVENTOS ---

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    logger.info("=" * 70)
    logger.info("🚀 Law System API iniciada com sucesso!")
    logger.info("📋 Tabelas sincronizadas: Teachers, Subjects, Contents, Books, Grades")
    logger.info("=" * 70)

@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# --- ROTAS DE USUÁRIO ---

@app.post("/register")
def register(u: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == u.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    
    student_group = db.query(Group).filter(Group.name == "student").first()
    hashed = bcrypt.hashpw(u.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    novo_usuario = User(
        full_name=u.full_name,
        email=u.email,
        password_hash=hashed,
        cpf=u.cpf,
        curso=u.curso,
        is_approved=False,
        group_id=student_group.id if student_group else None
    )
    db.add(novo_usuario)
    db.commit()
    return {"message": "Registrado com sucesso! Aguarde aprovação."}

@app.post("/login")
def login(l: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == l.email).first()
    if not user or not bcrypt.checkpw(l.password.encode('utf-8'), user.password_hash.encode('utf-8')):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
    
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Sua conta ainda não foi aprovada pelo admin.")
    
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/users/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Retorna os dados do usuário logado garantindo compatibilidade com o Front"""
    try:
        # Lógica de admin
        is_admin = (
            getattr(current_user, 'role', '') == "admin" or 
            getattr(current_user, 'is_admin', False) == True
        )
        
        # O segredo aqui é o str() no ID e o getattr para campos opcionais
        return {
            "id": str(current_user.id),
            "full_name": current_user.full_name or "",
            "email": current_user.email,
            "role": current_user.role or "student",
            "cpf": current_user.cpf or "",
            "phone": current_user.phone or "",
            "cep": current_user.cep or "",
            "logradouro": current_user.logradouro or "",
            "bairro": current_user.bairro or "",
            "city": current_user.city or "",
            "state": current_user.state or "",
            "country": current_user.country or "Brasil",
            "curso": current_user.curso or "",
            "current_period": current_user.current_period or 1,
            "total_periods": current_user.total_periods or 10,
            "completion_estimate": current_user.completion_estimate or "",
            "is_admin": is_admin
        }
    except Exception as e:
        logger.error(f"❌ Erro ao processar perfil: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao carregar perfil")

# --- NOVAS ROTAS DE CADASTRO (ACADÊMICO) ---

@app.post("/teachers/", status_code=201)
def create_teacher(t: TeacherCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    novo_docente = Teacher(name=t.name, contact=t.contact, email=t.email)
    db.add(novo_docente)
    db.commit()
    db.refresh(novo_docente)
    return novo_docente

@app.get("/teachers/")
def list_teachers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Teacher).all()

@app.post("/subjects/", status_code=201)
def create_subject(s: SubjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    nova_materia = Subject(
        name=s.name, 
        sigla=s.sigla, 
        priority=s.priority, 
        period=s.period,
        no_teacher=s.no_teacher, 
        teacher_id=s.teacher_id if not s.no_teacher else None,
        status="Pendente",
        user_id=current_user.id,
        # CORREÇÃO AQUI: Garante que a matéria herde o grupo do usuário
        group_id=current_user.group_id 
    )
    db.add(nova_materia)
    db.commit()
    db.refresh(nova_materia)
    return nova_materia

# Verifique se o prefixo coincide. Se você usa router, pode ser /subjects/{subject_id}
# 1. PRIMEIRO: A rota que lista todas (ou do grupo)
@app.get("/subjects/my-group") # Ou a URL exata que o seu JS chama
def list_subjects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Subject).filter(Subject.user_id == current_user.id).all()

# 2. DEPOIS: A rota que pega uma específica por ID
@app.get("/subjects/{subject_id}")
def get_subject(subject_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    subject = db.query(Subject).filter(
        Subject.id == subject_id, 
        Subject.user_id == current_user.id
    ).first()
    
    if not subject:
        raise HTTPException(status_code=404, detail="Matéria não encontrada")
    return subject
    
@app.post("/contents/", status_code=201)
def create_content(c: ContentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    novo_conteudo = Content(
        subject_id=c.subject_id, 
        description=c.description, 
        estimated_hours=c.estimated_hours
    )
    db.add(novo_conteudo)
    db.commit()
    return {"status": "Conteúdo cadastrado com sucesso!"}

@app.post("/books/", status_code=201)
def create_book(b: BookCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    novo_livro = Book(
        name=b.name, genre=b.genre, 
        total_pages=b.total_pages, 
        subject_id=b.subject_id
    )
    db.add(novo_livro)
    db.commit()
    db.refresh(novo_livro)
    return novo_livro

@app.post("/books/{book_id}/upload-pdf")
async def upload_pdf(book_id: uuid.UUID, file: UploadFile = File(...), db: Session = Depends(get_db)):
    livro = db.query(Book).filter(Book.id == book_id).first()
    if not livro:
        raise HTTPException(status_code=404, detail="Livro não encontrado")
    
    # Caminho para salvar o arquivo (Pasta storage/pdfs deve existir)
    file_path = f"storage/pdfs/{book_id}_{file.filename}"
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    livro.pdf_path = file_path
    db.commit()
    return {"message": "PDF anexado com sucesso!", "path": file_path}

# --- ROTAS DE SESSÃO E HISTÓRICO ---

@app.post("/sessions/")
def save_session(data: SessaoCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        db.execute(text("""
            INSERT INTO academic.study_sessions 
            (id, user_id, subject_id, duration_seconds, total_questions, correct_answers, start_time)
            VALUES (:id, :u, :s, :d, :t, :a, :now)
        """), {
            "id": uuid.uuid4(), "u": current_user.id, "s": data.subject_id,
            "d": data.duration_seconds, "t": data.total_questions, "a": data.correct_answers,
            "now": datetime.utcnow()
        })
        db.commit()
        return {"status": "Sessão salva com sucesso!"}
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao salvar sessão: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao salvar sessão")

@app.get("/sessions/history")
def get_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT s.id, s.start_time as created_at, s.duration_seconds, s.total_questions, s.correct_answers, m.name as subject_name
        FROM academic.study_sessions s
        JOIN academic.subjects m ON s.subject_id = m.id
        WHERE s.user_id = :u ORDER BY s.start_time DESC LIMIT 15
    """), {"u": current_user.id}).fetchall()
    return [dict(r._mapping) for r in result]

# --- ROTAS DE ADMINISTRAÇÃO ---

@app.get("/admin/pending")
def get_pending_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin" and not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail="Acesso negado.")
    pending_users = db.query(User).filter(User.is_approved == False).all()
    return [{"id": str(u.id), "full_name": u.full_name, "email": u.email} for u in pending_users]

@app.post("/admin/approve/{user_id}")
def approve_user(user_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin" and not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail="Acesso negado.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    user.is_approved = True
    db.commit()
    return {"message": "Usuário aprovado!"}

# --- LISTAGEM DE MATÉRIAS (MY GROUP) ---
@app.get("/subjects/my-group")
def list_subjects_group(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    subjects = db.query(Subject).filter(Subject.user_id == current_user.id).all()
    return [{"id": str(s.id), "name": s.name} for s in subjects]