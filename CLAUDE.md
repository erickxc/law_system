# CLAUDE.md — Law Study System

## Visão Geral

Sistema de gerenciamento de estudos jurídicos. Backend FastAPI + PostgreSQL, frontend HTML/JS puro servido como arquivos estáticos. Deploy via Vercel (serverless).

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.11+, FastAPI 0.129, SQLAlchemy 2.0 |
| Banco | PostgreSQL 14+ (local) / Supabase (produção) |
| Auth | OAuth2PasswordBearer + JWT (PyJWT) + bcrypt |
| Frontend | HTML5, Tailwind CSS (CDN), Vanilla JS ES6+, Chart.js |
| Deploy | Vercel (`api/index.py` como handler) |

---

## Estrutura do Projeto

```
law_system/
├── main.py                    # App FastAPI, CORS, startup, rotas
├── config.py                  # Settings com Pydantic (variáveis de env)
├── requirements.txt
├── vercel.json                # Deploy config — source: api/index.py
├── api/
│   └── index.py              # Handler Vercel (importa main.app)
└── app/
    ├── database.py            # Engine, SessionLocal, get_db()
    ├── core/
    │   ├── auth.py            # OAuth2, JWT, get_current_user
    │   └── security.py        # Hash/verify password (bcrypt)
    ├── frontend/
    │   ├── index.html         # Login / Registro
    │   └── dash.html          # Dashboard principal
    └── models/
        ├── user.py            # core.users, core.groups
        ├── academic.py        # academic.* (subjects, sessions, etc.)
        ├── groups.py          # Modelo de grupos
        ├── schemas/
        │   ├── user_schema.py
        │   └── study.py
        └── routes/
            ├── sessions.py
            ├── subject.py
            ├── teacher.py
            └── update_user.py
```

---

## Banco de Dados

### Schemas PostgreSQL
- `core` — usuários e grupos
- `academic` — matérias, docentes, sessões, conteúdos, livros, flashcards, pagamentos

### Tabelas Principais

**core.users** — UUID PK, email (unique+index), password_hash, role (`student`/`admin`), is_active, is_approved (aprovação manual), `photo_url`, `failed_login_attempts`, `locked_until`, group_id (FK → core.groups, SET NULL)

**academic.subjects** — subject_id, name, sigla, priority, period, status (`Pendente` default), teacher_id (FK), user_id (FK)

**academic.study_sessions** — session_id, user_id, subject_id, start_time, duration_seconds, total_questions, correct_answers

**academic.contents / books / grades / session_tasks / pdf_highlights** — todos vinculados a subjects ou sessions

### Migrations
Sem Alembic. Tabelas criadas no startup via `Base.metadata.create_all()`.
Mudanças de schema = alterar o model + dropar/recriar tabelas em dev, ou executar `ALTER TABLE` manual em produção.

**Migrations SQL manuais** ficam em [`migrations/*.sql`](migrations/). Aplicar UMA VEZ no Neon (SQL Editor) quando criar/atualizar tabelas em produção:

```
migrations/001_user_lockout_and_photo.sql   # photo_url, failed_login_attempts, locked_until + FKs CASCADE
```

---

## Variáveis de Ambiente

Ver `.env.example`. Arquivo `.env` **nunca commitar**.

```
# Database — use DB_URL para Supabase/Vercel, ou variáveis individuais para local
DB_URL=postgresql://user:pass@host:5432/dbname    # produção
DB_HOST=localhost                                  # dev local
DB_PORT=5432
DB_NAME=law_study_system
DB_USER=study_app
DB_PASSWORD=

# Security
SECRET_KEY=                     # 32+ chars, aleatório — VALIDADO no startup, falha se <32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480  # 8 horas
BCRYPT_ROUNDS=12                 # default 12. Validado >=10 em produção
MAX_LOGIN_ATTEMPTS=5             # tentativas antes do lockout
LOCKOUT_MINUTES=15               # duração do lockout

# Email (Gmail com senha de app)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
ADMIN_EMAIL=

# App
ENVIRONMENT=development          # ou production
```

`config.py` converte `postgres://` → `postgresql://` automaticamente (compatibilidade Supabase).

---

## Como Rodar Localmente

```bash
# Setup
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # preencher .env

# Banco (PostgreSQL local)
psql -U postgres -c "CREATE DATABASE law_study_system;"
psql -U postgres -c "CREATE USER study_app WITH PASSWORD 'senha';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE law_study_system TO study_app;"

# Rodar API (cria schemas/tabelas automaticamente no primeiro start)
uvicorn main:app --reload
# → http://127.0.0.1:8000
# → http://127.0.0.1:8000/docs  (Swagger)

# Servir frontend (opcional, separado)
cd app/frontend
python -m http.server 5500
# → http://127.0.0.1:5500/index.html
```

---

## Endpoints Principais

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/register` | ❌ | Criar conta |
| POST | `/login` | ❌ | JWT token. **Lockout após N tentativas falhas** |
| GET | `/health` | ❌ | Health check |
| GET | `/users/me` | ✅ | Dados do usuário logado (inclui `photo_url`) |
| PUT | `/users/me/update` | ✅ | Atualizar perfil |
| PUT | `/users/me/photo` | ✅ | Atualizar foto de perfil (URL externa) |
| POST | `/subjects/` | ✅ | Criar matéria |
| GET | `/subjects/` | ✅ | Listar matérias do usuário |
| PUT | `/subjects/{id}` | ✅ | Atualizar matéria |
| PATCH | `/subjects/{id}/status` | ✅ | Atualizar só o status |
| DELETE | `/subjects/{id}` | ✅ | Deletar matéria (204) |
| POST | `/sessions/` | ✅ | Criar sessão de estudo |
| GET | `/sessions/history` | ✅ | Histórico completo |
| GET | `/sessions/stats` | ✅ | Stats agregadas (streak, médias, by_subject, 30d) |
| GET | `/sessions/report/pdf` | ✅ | Exporta PDF do histórico |
| POST | `/teachers/` | ✅ | Criar docente |
| GET | `/teachers/` | ✅ | Listar docentes |
| GET | `/books/`, `/books/{id}` | ✅ | CRUD livros + grifos + anotações |
| GET | `/flashcards/`, `/flashcards/due`, `/flashcards/stats` | ✅ | Flashcards + revisão SM-2 |
| GET | `/admin/pending`, `/admin/users` | ✅ admin | Aprovações e lista |
| POST | `/admin/approve/{user_id}` | ✅ admin | Aprovar usuário |
| PATCH | `/admin/users/{user_id}/toggle` | ✅ admin | Ativar/desativar |
| DELETE | `/admin/users/{user_id}` | ✅ admin | Deletar (com cleanup) |
| GET | `/admin/payments/overview` | ✅ admin | Pagamentos globais + summary |
| GET | `/admin/users/{id}/payments` | ✅ admin | Pagamentos do usuário |
| POST | `/admin/users/{id}/payments` | ✅ admin | Criar lançamento |
| PATCH | `/admin/payments/{id}/status` | ✅ admin | Atualizar status (body JSON: `{status:"pago"}`) |
| DELETE | `/admin/payments/{id}` | ✅ admin | Deletar lançamento |

---

## Padrões de Código

### Backend

- **Dependency injection:** sempre usar `db: Session = Depends(get_db)` e `current_user = Depends(get_current_user)`
- **Auth check:** `get_current_user` retorna o user ou levanta `HTTPException(401)`
- **Admin check:** verificar `current_user.role == "admin"` explicitamente na rota
- **Schemas:** Pydantic BaseModel em `app/models/schemas/` — separar `Create`, `Update`, `Response`
- **Erros:** `raise HTTPException(status_code=..., detail="mensagem clara")`
- **UUIDs:** todos os PKs são UUID gerado automaticamente (`default=uuid.uuid4`)
- **Soft delete:** não implementado — DELETE é físico

### Frontend

- **Token:** armazenado em `localStorage` como `access_token`
- **Requests auth:** header `Authorization: Bearer <token>`
- **Fetch pattern:** async/await com try/catch, toasts para feedback ao usuário
- **Tailwind:** via CDN — não há build step
- **Dark theme:** palette azul + fundo escuro (#1a1a2e, #16213e, #0f3460)

### Nomenclatura

- Python: `snake_case` para variáveis/funções, `PascalCase` para classes/models
- Rotas FastAPI: kebab-case nos paths, snake_case nos parâmetros
- Tabelas: `schema.nome_tabela` (ex: `core.users`, `academic.subjects`)

---

## Deploy (Vercel)

- Entry point: `api/index.py` (wrapper que expõe `app` do `main.py`)
- `vercel.json` roteia tudo para `api/index.py`
- Banco: Supabase via `DB_URL` nas env vars do Vercel
- Frontend: arquivos estáticos em `app/frontend/` servidos via FastAPI `StaticFiles`

---

## Segurança — Pontos de Atenção

- **CORS:** allowlist explícita em [main.py:35](main.py#L35). Adicionar novos domínios de frontend lá. Não use `["*"]` com `allow_credentials=True`.
- **`.env`:** nunca commitar credenciais reais
- **Bcrypt:** controlado por `BCRYPT_ROUNDS` (default 12). Startup falha se `<10` em produção
- **SECRET_KEY:** startup falha se vazia ou `<32 chars`. Gere com `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- **Brute-force protection:** após `MAX_LOGIN_ATTEMPTS` (default 5) falhas, conta bloqueia por `LOCKOUT_MINUTES` (default 15). Reset automático em login bem-sucedido. Estado em `core.users.failed_login_attempts` + `locked_until`.
- **Aprovação manual:** novos usuários têm `is_approved=False` por padrão — fluxo de aprovação pelo admin
- **DELETE de usuário:** [admin.py](app/models/routes/admin.py) faz cleanup explícito em ordem (subjects → sessions → books → flashcards → user) — independente de o CASCADE estar configurado no DB. Aplicar [`migrations/001_*`](migrations/001_user_lockout_and_photo.sql) pra garantir CASCADE no banco também.

---

## Scripts Auxiliares

```bash
python diagnostico.py    # Diagnóstico geral do sistema
python teste_banco.py    # Testar conexão com PostgreSQL
python teste_email.py    # Testar envio de email SMTP
python backup.py         # Backup via pg_dump
python test_all.py       # Teste end-to-end de todos os endpoints (71 testes)
```

---

## Features-Chave (resumo rápido por área)

### Estatísticas e Dashboard
- `GET /sessions/stats` retorna: `total_minutes`, `accuracy`, `current_streak` (dias consecutivos), `best_day`, `by_subject[]` (com `minutes`, `accuracy`), `last_30_days[]` (timeseries pronta pra gráfico).
- Frontend `dash.html` consome `/sessions/stats` no Dashboard:
  - 4 stat cards (tempo, streak, acerto, flashcards)
  - Gráfico de barras (Chart.js) — atividade 30 dias
  - Gráfico doughnut — tempo por matéria
- Cache de instâncias Chart.js em `_activityChart` e `_subjectsChart` — destruídas antes de recriar (evita memory leak).

### Foto de perfil
- Campo `core.users.photo_url` (TEXT, nullable). Aceita HTTPS, HTTP ou `data:image/...` (base64).
- `PUT /users/me/photo` body: `{"photo_url": "https://..." }` ou `null` pra remover.
- Frontend: ícone de câmera no avatar abre modal com input de URL. Fallback automático pra iniciais se `onerror` na imagem.

### Export PDF do histórico
- `GET /sessions/report/pdf?date_from=...&date_to=...` retorna PDF (`fpdf2`).
- Filename via `Content-Disposition`: `Historico - <full_name>.pdf`.
- Botão "Exportar PDF" na tela de Histórico.
- Função `safe()` substitui chars fora do Latin-1 (`–`, `↳`, `→`, etc.) — não usar essa abordagem se o projeto for evoluir o PDF; preferir fonte Unicode (DejaVu Sans) como na APRXM.

### Admin: pagamentos
- `GET /admin/payments/overview?status=pago|pendente|inadimplente` retorna `{summary: {pago:{count,amount}, ...}, payments: [...]}` — útil pra dashboard de cobranças sem ter que iterar usuário por usuário.
- `PATCH /admin/payments/{id}/status` aceita **body JSON** `{"status":"pago"}` (preferido) e mantém compat com `?status=pago` (query).

### Padrão para novos endpoints PDF
1. Adicionar `fpdf2==2.8.3` ao requirements (já incluído).
2. `import` dentro da função (lazy) pra não pesar cold start: `from fpdf import FPDF`.
3. Sempre `multi_cell()` com `new_x="LMARGIN", new_y="NEXT"` pra evitar bug de cursor preso na margem direita.
4. Retornar `Response(content=buf.read(), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{fname}"'})`.
5. No frontend: extrair filename do header (não hardcodear).

---

## Roadmap / Backlog

### Não implementado (esteira)
- **Email automático** (SMTP configurado mas nenhuma rota usa). Casos previstos: boas-vindas ao admin no register, notificação ao user no approve, lembrete de pagamento pendente. Pulei a pedido do usuário.
- **Forgot/reset password** — depende de email.
- **Alembic** — schema ainda gerenciado por `create_all()` + SQL manual.
- **Upload de arquivos** (foto, anexos de sessão) — Vercel não tem disco persistente. Solução atual: URL externa (Cloudinary/Imgur/Supabase Storage).
- **Notificações in-app persistentes** — só temos toasts efêmeros.
- **PWA / service worker** — sem offline.
- **Unit tests** — só `test_all.py` (e2e).

### Limitações conhecidas
- Lockout é por usuário (não por IP). Atacante com lista de emails pode bloquear contas, mas não consegue força bruta. Considere CAPTCHA se isso virar problema.
- `current_streak` usa `datetime.utcnow()` — assume timezone UTC. Usuários em fuso muito diferente podem ter o streak quebrado às vezes.
- PDF de histórico usa Helvetica + `safe()` — acentos OK via Latin-1 mas símbolos Unicode (`✓`, emojis) viram `?`. Migrar pra DejaVu Sans se precisar.
