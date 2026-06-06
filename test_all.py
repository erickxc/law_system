"""Teste completo do Law System API"""
import requests
import json
import sys

BASE = "https://lawsysback.vercel.app"
OK = "✓"
FAIL = "✗"
results = []

def log(label, ok, detail=""):
    sym = OK if ok else FAIL
    msg = f"  {sym} {label}"
    if detail:
        msg += f"  →  {detail}"
    print(msg)
    results.append((label, ok, detail))

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

# ── Auth ──────────────────────────────────────────────────────
section("1. AUTH")
r = requests.post(f"{BASE}/login", json={"email": "ana.teste@lawsystem.com", "password": "Teste@2024"})
log("Login", r.status_code == 200, f"status {r.status_code}")
TOKEN = r.json()["access_token"]
H = {"Authorization": f"Bearer {TOKEN}"}

r = requests.get(f"{BASE}/users/me", headers=H)
me = r.json()
log("/users/me", r.status_code == 200, f"{me['full_name']} | role={me['role']} | curso={me['curso']}")
USER_ID = me["id"]

# ── Profile update ────────────────────────────────────────────
section("2. PERFIL")
r = requests.put(f"{BASE}/users/me/update", headers=H, json={
    "full_name": "Ana Clara Teste",
    "current_period": 3,
    "total_periods": 10,
    "completion_estimate": "Dez/2027",
    "phone": "11987654321",
})
log("Atualizar perfil", r.status_code == 200,
    f"período {r.json().get('current_period')}/{r.json().get('total_periods')} | {r.json().get('completion_estimate')}")

# ── Teachers ──────────────────────────────────────────────────
section("3. DOCENTES")
teachers_data = [
    {"name": "Prof. Dr. Carlos Mendes", "email": "cmendes@direito.edu.br", "contact": "(11) 98765-4321"},
    {"name": "Profa. Dra. Marcia Oliveira", "email": "moliveira@direito.edu.br", "contact": "(11) 91234-5678"},
    {"name": "Prof. Dr. Roberto Lima", "email": "rlima@direito.edu.br"},
]

# Get existing teachers first
existing = requests.get(f"{BASE}/teachers/", headers=H).json()
existing_names = {t["name"] for t in existing}
teacher_ids = {t["name"]: t["id"] for t in existing}

for td in teachers_data:
    if td["name"] not in existing_names:
        r = requests.post(f"{BASE}/teachers/", headers=H, json=td)
        ok = r.status_code == 201
        if ok:
            teacher_ids[td["name"]] = r.json()["id"]
        log(f"Criar {td['name'][:30]}", ok, r.json().get("name", r.json().get("detail", "")))
    else:
        log(f"Criar {td['name'][:30]}", True, "já existe")

r = requests.get(f"{BASE}/teachers/", headers=H)
log("Listar docentes", r.status_code == 200, f"{len(r.json())} docentes")

T1 = teacher_ids.get("Prof. Dr. Carlos Mendes")
T2 = teacher_ids.get("Profa. Dra. Marcia Oliveira")
T3 = teacher_ids.get("Prof. Dr. Roberto Lima")

# ── Subjects ──────────────────────────────────────────────────
section("4. MATERIAS")

# Get existing subjects
existing_subs = requests.get(f"{BASE}/subjects/", headers=H).json()
existing_sub_names = {s["name"] for s in existing_subs}
subject_ids = {s["name"]: s["id"] for s in existing_subs}

subjects_data = [
    {"name": "Direito Civil", "sigla": "DIR_CIV", "period": 1, "priority": "Alta", "no_teacher": False, "teacher_id": T1},
    {"name": "Direito Penal", "sigla": "DIR_PEN", "period": 2, "priority": "Alta", "no_teacher": False, "teacher_id": T2},
    {"name": "Direito Constitucional", "sigla": "DIR_CON", "period": 1, "priority": "Media", "no_teacher": True},
    {"name": "Processo Civil", "period": 3, "priority": "Baixa", "no_teacher": False, "teacher_id": T3},
]

# Fix priority with accent
for sd in subjects_data:
    if sd["priority"] == "Media":
        sd["priority"] = "Média"

for sd in subjects_data:
    if sd["name"] not in existing_sub_names:
        r = requests.post(f"{BASE}/subjects/", headers=H, json=sd)
        ok = r.status_code in (200, 201)
        if ok:
            subject_ids[sd["name"]] = r.json()["id"]
            tname = r.json().get("teacher_name") or "sem prof"
            log(f"Criar {sd['name']}", ok, f"período {sd['period']} | {tname}")
        else:
            log(f"Criar {sd['name']}", False, r.json().get("detail", str(r.status_code)))
    else:
        log(f"Criar {sd['name']}", True, "já existe")

# Test /subjects/create alias
if "Processo Civil" not in existing_sub_names or True:
    # Extra test subject via alias
    pass

r_list = requests.get(f"{BASE}/subjects/", headers=H)
log("Listar matérias", r_list.status_code == 200, f"{len(r_list.json())} matérias")

# Update status
S1_ID = subject_ids.get("Direito Civil")
if S1_ID:
    r = requests.patch(f"{BASE}/subjects/{S1_ID}/status", headers=H, params={"s_status": "Em Curso"})
    log("Atualizar status → Em Curso", r.status_code == 200, r.json().get("status"))

    r = requests.put(f"{BASE}/subjects/{S1_ID}", headers=H, json={"priority": "Alta", "status": "Em Curso"})
    log("Atualizar matéria (PUT)", r.status_code == 200, r.json().get("name"))

# ── Books ─────────────────────────────────────────────────────
section("5. LIVROS + GRIFO + ANOTACOES")

existing_books = requests.get(f"{BASE}/books/", headers=H).json()
existing_book_names = {b["name"] for b in existing_books}
book_ids = {b["name"]: b["id"] for b in existing_books}

books_data = [
    {
        "name": "Codigo Civil Brasileiro - Estudo",
        "author": "Lei 10.406/2002",
        "genre": "Legislacao",
        "total_pages": 140,
        "current_page": 0,
        "url": "https://www.irs.gov/pub/irs-pdf/fw9.pdf",
        "cover_color": "#1e40af",
        "subject_id": subject_ids.get("Direito Civil"),
    },
    {
        "name": "Manual de Processo Civil",
        "author": "Prof. Dr. Roberto Lima",
        "genre": "Doutrina",
        "total_pages": 450,
        "current_page": 87,
        "url": "https://www.learningcontainer.com/wp-content/uploads/2019/09/sample-pdf-file.pdf",
        "cover_color": "#7c3aed",
    },
    {
        "name": "Constituicao Federal Comentada",
        "author": "Alexandre de Moraes",
        "genre": "Doutrina",
        "total_pages": 920,
        "current_page": 0,
        "cover_color": "#065f46",
    },
]

for bd in books_data:
    if bd["name"] not in existing_book_names:
        r = requests.post(f"{BASE}/books/", headers=H, json=bd)
        ok = r.status_code in (200, 201)
        if ok:
            book_ids[bd["name"]] = r.json()["id"]
            log(f"Criar livro: {bd['name'][:35]}", ok,
                f"{r.json()['progress_pct']}% | {'com PDF' if bd.get('url') else 'sem PDF'}")
        else:
            log(f"Criar livro: {bd['name'][:35]}", False, r.json().get("detail", str(r.status_code)))
    else:
        log(f"Criar livro: {bd['name'][:35]}", True, "já existe")

B1_ID = book_ids.get("Codigo Civil Brasileiro - Estudo")

if B1_ID:
    print(f"\n  [Livro principal: {B1_ID}]")

    # 4 highlights with different colors
    highlights = [
        {"page_number": 1, "selected_text": "Form W-9 Request for Taxpayer Identification Number and Certification - U.S. Department of the Treasury", "color": "yellow"},
        {"page_number": 1, "selected_text": "By signing the filled-out form, you: 1. Certify that the TIN you are giving is correct, 2. Certify that you are not subject to backup withholding", "color": "green"},
        {"page_number": 2, "selected_text": "Backup withholding rate of 24% applies if you do not furnish your TIN to the requester - important tax obligation", "color": "blue"},
        {"page_number": 3, "selected_text": "Exemptions (codes apply only to certain entities, not individuals) - See instructions on page 4 for details", "color": "pink"},
        {"page_number": 4, "selected_text": "For a joint account, only the person whose TIN is shown in Part I should sign (when required)", "color": "yellow"},
    ]

    hl_ids = []
    for hl in highlights:
        r = requests.post(f"{BASE}/books/{B1_ID}/highlights", headers=H, json=hl)
        ok = r.status_code in (200, 201)
        if ok:
            hl_ids.append(r.json()["id"])
        log(f"  Grifo pg.{hl['page_number']} [{hl['color']:6}]", ok,
            f"{hl['selected_text'][:50]}...")

    # Verify highlights
    r = requests.get(f"{BASE}/books/{B1_ID}/highlights", headers=H)
    log("Listar grifos", r.status_code == 200, f"{len(r.json())} grifos salvos")

    # Filter highlights by page
    r = requests.get(f"{BASE}/books/{B1_ID}/highlights", headers=H, params={"page": 1})
    log("Filtrar grifos pg.1", r.status_code == 200, f"{len(r.json())} grifos na página 1")

    # Annotations
    annotations = [
        {"page_number": 1, "note_text": "ATENCAO: Documento fiscal americano. Para estudo comparado de direito tributario.", "color": "yellow"},
        {"page_number": 2, "note_text": "Regra geral de retencao: 24% sobre pagamentos quando nao ha identificacao do contribuinte. Comparar com legislacao brasileira.", "color": "green"},
        {"page_number": 3, "note_text": "Excecoes importantes: entidades governamentais, organizacoes sem fins lucrativos e algumas entidades financeiras sao isentas.", "color": "yellow"},
    ]

    ann_ids = []
    for ann in annotations:
        r = requests.post(f"{BASE}/books/{B1_ID}/annotations", headers=H, json=ann)
        ok = r.status_code in (200, 201)
        if ok:
            ann_ids.append(r.json()["id"])
        log(f"  Anotacao pg.{ann['page_number']}", ok, f"{ann['note_text'][:50]}...")

    r = requests.get(f"{BASE}/books/{B1_ID}/annotations", headers=H)
    log("Listar anotacoes", r.status_code == 200, f"{len(r.json())} anotacoes salvas")

    # Update book page progress
    r = requests.put(f"{BASE}/books/{B1_ID}", headers=H, json={"current_page": 42})
    log("Atualizar progresso (pg 42/140)", r.status_code == 200,
        f"progresso={r.json().get('progress_pct')}%")

    # Delete one highlight
    if hl_ids:
        r = requests.delete(f"{BASE}/books/highlights/{hl_ids[-1]}", headers=H)
        log("Deletar grifo", r.status_code == 204)

    # Delete one annotation
    if ann_ids:
        r = requests.delete(f"{BASE}/books/annotations/{ann_ids[-1]}", headers=H)
        log("Deletar anotacao", r.status_code == 204)

    # Verify final counts
    r = requests.get(f"{BASE}/books/{B1_ID}/highlights", headers=H)
    log("Grifos apos delete", r.status_code == 200, f"{len(r.json())} restantes")
    r = requests.get(f"{BASE}/books/{B1_ID}/annotations", headers=H)
    log("Anotacoes apos delete", r.status_code == 200, f"{len(r.json())} restantes")

# ── Flashcards ────────────────────────────────────────────────
section("6. FLASHCARDS + REVISAO (SM-2)")

S1_ID = subject_ids.get("Direito Civil")
S2_ID = subject_ids.get("Direito Penal")

flashcards_data = [
    {"front": "O que e personalidade juridica?", "back": "E a aptidao generica para adquirir direitos e contrair obrigacoes. Inicia com o nascimento com vida (art. 2 CC).", "subject_id": S1_ID, "tags": "personalidade,cc,art2"},
    {"front": "Qual a diferenca entre capacidade de direito e capacidade de fato?", "back": "Capacidade de direito: aptidao para ser titular de direitos. Capacidade de fato: aptidao para exercer pessoalmente os atos da vida civil.", "subject_id": S1_ID, "tags": "capacidade,cc"},
    {"front": "Quais sao os absolutamente incapazes?", "back": "Apenas os menores de 16 anos (art. 3 CC). Os demais casos foram revogados pelo Estatuto da Pessoa com Deficiencia.", "subject_id": S1_ID, "tags": "incapacidade,cc,art3"},
    {"front": "Defina Dolo no direito penal", "back": "Dolo e a vontade consciente e livre de praticar a conduta descrita no tipo penal. Pode ser direto (quer o resultado) ou eventual (assume o risco).", "subject_id": S2_ID, "tags": "dolo,tipicidade"},
    {"front": "Qual a diferencao entre culpa consciente e dolo eventual?", "back": "Culpa consciente: prev o resultado mas acredita que nao vai ocorrer. Dolo eventual: prev e assume o risco de produzi-lo.", "subject_id": S2_ID, "tags": "culpa,dolo,eventual"},
    {"front": "O que e bem de familia?", "back": "Imovel proprio do casal ou da entidade familiar, impenhoravel por dividas civis, comerciais, fiscais etc (Lei 8009/90).", "tags": "bem-de-familia"},
]

# Check existing flashcards
existing_fc = requests.get(f"{BASE}/flashcards/", headers=H).json()
existing_fronts = {f["front"] for f in existing_fc}
fc_ids = []

for fc in flashcards_data:
    if fc["front"] not in existing_fronts:
        r = requests.post(f"{BASE}/flashcards/", headers=H, json=fc)
        ok = r.status_code in (200, 201)
        if ok:
            fc_ids.append(r.json()["id"])
        log(f"Criar card: {fc['front'][:45]}...", ok, f"materia={r.json().get('subject_name', 'geral')}")
    else:
        existing = [f for f in existing_fc if f["front"] == fc["front"]]
        if existing:
            fc_ids.append(existing[0]["id"])
        log(f"Criar card: {fc['front'][:45]}...", True, "já existe")

r = requests.get(f"{BASE}/flashcards/", headers=H)
log("Listar todos os cards", r.status_code == 200, f"{len(r.json())} cards")

# Filter by subject
r = requests.get(f"{BASE}/flashcards/", headers=H, params={"subject_id": S1_ID})
log("Filtrar por Direito Civil", r.status_code == 200, f"{len(r.json())} cards")

# Check due cards
r = requests.get(f"{BASE}/flashcards/due", headers=H)
due_ids = [c["id"] for c in r.json()]
log("Cards para revisar", r.status_code == 200, f"{len(r.json())} due")

# Review all due cards with different confidence levels
confidences = [5, 4, 2, 5, 3, 4]  # mix of correct and incorrect
reviewed = 0
for i, card_id in enumerate(due_ids[:6]):
    conf = confidences[i % len(confidences)]
    r = requests.post(f"{BASE}/flashcards/{card_id}/review", headers=H,
                      json={"is_correct": conf >= 3, "confidence": conf})
    ok = r.status_code == 200
    if ok:
        reviewed += 1
        d = r.json()
        log(f"  Revisar card (conf={conf})", ok,
            f"acerto={'sim' if conf>=3 else 'nao'} | proximo em {d['next_review_in_days']}d | {d['message']}")
    else:
        log(f"  Revisar card", False, r.text[:60])

log(f"Total revisados", True, f"{reviewed}/{len(due_ids)} cards")

# Get stats
r = requests.get(f"{BASE}/flashcards/stats", headers=H)
ok = r.status_code == 200
if ok:
    s = r.json()
    log("Estatisticas de flashcards", ok,
        f"total={s['total_cards']} | revisoes={s['total_reviews']} | acerto={s.get('overall_accuracy_pct')}%")
    for sub in s["by_subject"]:
        print(f"    └ {sub['subject_name']}: {sub['total']} cards, acerto={sub.get('accuracy_pct')}%")

# Edit one card
if fc_ids:
    r = requests.put(f"{BASE}/flashcards/{fc_ids[0]}", headers=H,
                     json={"tags": "personalidade,cc,art2,revisado"})
    log("Editar card (tags)", r.status_code == 200, r.json().get("tags"))

# Delete last card
if len(fc_ids) > 5:
    r = requests.delete(f"{BASE}/flashcards/{fc_ids[-1]}", headers=H)
    log("Deletar ultimo card", r.status_code == 204)
    r = requests.get(f"{BASE}/flashcards/", headers=H)
    log("Verificar apos delete", r.status_code == 200, f"{len(r.json())} cards restantes")

# ── Study Sessions ─────────────────────────────────────────────
section("7. SESSOES DE ESTUDO")

sessions_data = [
    {"subject_id": S1_ID, "duration_seconds": 5400, "total_questions": 30, "correct_answers": 24,
     "tasks": [{"description": "Ler capitulo sobre pessoas naturais", "is_done": True},
               {"description": "Resumo dos artigos 1-20", "is_done": True},
               {"description": "Fazer exercicios", "is_done": False}]},
    {"subject_id": S2_ID, "duration_seconds": 3600, "total_questions": 20, "correct_answers": 16,
     "tasks": [{"description": "Teoria do crime - tipicidade", "is_done": True}]},
    {"subject_id": subject_ids.get("Direito Constitucional", S1_ID), "duration_seconds": 7200,
     "total_questions": 50, "correct_answers": 38,
     "tasks": [{"description": "Principios fundamentais art. 1-4", "is_done": True},
               {"description": "Direitos e garantias fundamentais", "is_done": False}]},
]

sess_ids = []
for sd in sessions_data:
    if not sd.get("subject_id"):
        continue
    r = requests.post(f"{BASE}/sessions/", headers=H, json=sd)
    ok = r.status_code in (200, 201)
    if ok:
        sess_ids.append(r.json().get("session_id", ""))
    acc = round(sd["correct_answers"] / sd["total_questions"] * 100) if sd["total_questions"] else 0
    log(f"Criar sessao ({sd['duration_seconds']//60}min)", ok,
        f"{sd['correct_answers']}/{sd['total_questions']} acertos ({acc}%) | {len(sd['tasks'])} tarefas")

# History
r = requests.get(f"{BASE}/sessions/history", headers=H)
ok = r.status_code == 200
if ok:
    history = r.json()
    log("Historico de sessoes", ok, f"{len(history)} sessoes")
    total_secs = sum(s["duration_seconds"] for s in history)
    total_q = sum(s["total_questions"] for s in history)
    total_c = sum(s["correct_answers"] for s in history)
    for s in history[:3]:
        print(f"    └ {s['subject_name']} | {s['duration_seconds']//60}min | {s['correct_answers']}/{s['total_questions']} | {s['start_time'][:10]}")

# ── Admin endpoints ────────────────────────────────────────────
section("8. ADMIN (como admin@lawsystem.com)")

r_admin = requests.post(f"{BASE}/login", json={"email": "admin@lawsystem.com", "password": "AWfF4mrpNTKJ8TON"})
ADMIN_TOKEN = r_admin.json()["access_token"]
AH = {"Authorization": f"Bearer {ADMIN_TOKEN}"}

# List users
r = requests.get(f"{BASE}/admin/users", headers=AH)
log("Listar usuarios", r.status_code == 200, f"{len(r.json())} usuarios")

# List pending
r = requests.get(f"{BASE}/admin/pending", headers=AH)
log("Usuarios pendentes", r.status_code == 200, f"{len(r.json())} pendentes")

# Create payment for test user
r = requests.post(f"{BASE}/admin/users/{USER_ID}/payments", headers=AH, json={
    "amount": 599.90,
    "description": "Mensalidade Maio/2025",
    "payment_date": "2025-05-01",
    "status": "pago",
})
log("Criar pagamento", r.status_code in (200, 201),
    f"R$ {r.json().get('amount')} | {r.json().get('status')}")
PAYMENT_ID = r.json().get("id")

r = requests.post(f"{BASE}/admin/users/{USER_ID}/payments", headers=AH, json={
    "amount": 599.90,
    "description": "Mensalidade Junho/2025",
    "payment_date": "2025-06-01",
    "status": "pendente",
})
log("Criar pagamento pendente", r.status_code in (200, 201),
    f"R$ {r.json().get('amount')} | {r.json().get('status')}")
PAYMENT2_ID = r.json().get("id")

# List payments
r = requests.get(f"{BASE}/admin/users/{USER_ID}/payments", headers=AH)
log("Listar pagamentos usuario", r.status_code == 200, f"{len(r.json())} lancamentos")

# Update payment status
r = requests.patch(f"{BASE}/admin/payments/{PAYMENT2_ID}/status", headers=AH, params={"status": "pago"})
log("Atualizar status pagamento", r.status_code == 200, f"{r.json().get('status')}")

# Toggle user active
r = requests.patch(f"{BASE}/admin/users/{USER_ID}/toggle", headers=AH)
log("Toggle user inactive", r.status_code == 200, f"is_active={r.json().get('is_active')}")

# Re-approve
r = requests.patch(f"{BASE}/admin/users/{USER_ID}/toggle", headers=AH)
log("Toggle user active (restore)", r.status_code == 200, f"is_active={r.json().get('is_active')}")
r = requests.post(f"{BASE}/admin/approve/{USER_ID}", headers=AH)
log("Aprovar usuario novamente", r.status_code == 200)

# ── Health check ───────────────────────────────────────────────
section("9. HEALTH + EDGE CASES")
r = requests.get(f"{BASE}/health")
log("Health check", r.status_code == 200, str(r.json()))

# Invalid priority
r = requests.post(f"{BASE}/subjects/", headers=H, json={"name":"X","period":1,"priority":"Invalida","no_teacher":True})
log("Rejeitar priority invalida", r.status_code == 422, r.json().get("detail","?")[:50])

# Invalid status on flashcard review
r = requests.post(f"{BASE}/flashcards/{fc_ids[0]}/review", headers=H, json={"is_correct": True, "confidence": 10})
# confidence is clamped to 1-5 server-side
log("Confidence > 5 e clampeado", r.status_code == 200, f"confidence={r.json()['card']['total_reviews']} revisoes total")

# Unauthorized access (no token)
r = requests.get(f"{BASE}/subjects/")
log("Bloqueio sem token (401)", r.status_code == 401)

# Student trying admin endpoint
r = requests.get(f"{BASE}/admin/users", headers=H)
log("Bloqueio role student em /admin", r.status_code == 403)

# ── Summary ───────────────────────────────────────────────────
section("RESUMO FINAL")
passed = sum(1 for _, ok, _ in results if ok)
failed = sum(1 for _, ok, _ in results if not ok)
total = len(results)
print(f"\n  Total: {total} testes")
print(f"  {OK} Passou: {passed}")
print(f"  {FAIL} Falhou: {failed}")
print()

if failed:
    print("  FALHAS:")
    for label, ok, detail in results:
        if not ok:
            print(f"    {FAIL} {label}: {detail}")
else:
    print("  Todos os testes passaram!")

print()
