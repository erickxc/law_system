from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import NullPool
from config import settings

DATABASE_URL = settings.DATABASE_URL

# Engine: em serverless (Vercel) usar NullPool — abre conexão por request,
# evita "SSL connection has been closed unexpectedly" do Neon após idle.
# pool_pre_ping testa SELECT 1 antes de cada uso pra cobrir o caso edge.
# connect_timeout limita o tempo de espera por conexão (cold start).
_is_serverless = settings.ENVIRONMENT == "production"

engine_kwargs = {
    "echo": settings.ENVIRONMENT == "development",
    "pool_pre_ping": True,                            # sempre valida conexão antes de usar
    "connect_args": {
        "connect_timeout": 10,
        "sslmode": "require",
        # keepalives mantém TCP vivo se a função for reusada
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 3,
    },
}
if _is_serverless:
    # Cada invocação cria conexão própria (sem pool — Vercel já gerencia containers)
    engine_kwargs["poolclass"] = NullPool
else:
    # Dev local: pool pequeno com reciclagem
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(DATABASE_URL, **engine_kwargs)
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