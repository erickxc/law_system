from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import settings  # ✅ Importa settings do novo config

# ✅ Usa a propriedade DATABASE_URL do settings
DATABASE_URL = settings.DATABASE_URL

# Engine e Session
engine = create_engine(DATABASE_URL, echo=settings.ENVIRONMENT == "development")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    """
    Classe base para todos os modelos SQLAlchemy.
    Todos os models (User, Subject, etc) herdam desta classe.
    """
    pass

def get_db():
    """
    Dependency do FastAPI para obter conexão com banco.
    Garante que a sessão seja fechada após cada requisição.
    
    Uso:
        @app.get("/users")
        def get_users(db: Session = Depends(get_db)):
            return db.query(User).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()