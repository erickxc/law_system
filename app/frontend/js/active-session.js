/* ═══════════════════════════════════════════════════════════════════════
   active-session.js — Sessão de estudo global persistente
   - State em localStorage (sobrevive a navegação)
   - Floating widget vermelho sempre visível quando ativa
   - Tracking automático de atividades (livros lidos, cards revisados)
   ═══════════════════════════════════════════════════════════════════════ */

const ACTIVE_SESSION_KEY = 'lawsys.activeSession';
let _activeTimerInt = null;

/* Estrutura:
   {
     subject_id: string,
     subject_name: string,
     started_at: epoch ms (quando iniciou),
     accumulated_seconds: number (segundos acumulados antes da pausa atual),
     running: bool,
     tasks: [{description, is_done}],
     total_questions: number,
     correct_answers: number,
     tracked_books: [bookId, ...],  // pra não duplicar tasks
     reviewed_cards: number,
   }
*/

function getActiveSession() {
    try {
        const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function setActiveSession(s) {
    if (s === null) {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
    } else {
        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(s));
    }
    renderActiveWidget();
}

function startActiveSession(subjectId, subjectName) {
    if (getActiveSession()) {
        if (!confirm('Já existe uma sessão em andamento. Substituir?')) return false;
        cancelActiveSession();
    }
    const s = {
        subject_id: subjectId,
        subject_name: subjectName,
        started_at: Date.now(),
        accumulated_seconds: 0,
        running: true,
        tasks: [],
        total_questions: 0,
        correct_answers: 0,
        tracked_books: [],
        reviewed_cards: 0,
    };
    setActiveSession(s);
    startActiveTimer();
    return true;
}

function getElapsedSeconds(s) {
    if (!s) return 0;
    if (s.running) {
        return s.accumulated_seconds + Math.floor((Date.now() - s.started_at) / 1000);
    }
    return s.accumulated_seconds;
}

function pauseActiveSession() {
    const s = getActiveSession();
    if (!s || !s.running) return;
    s.accumulated_seconds = getElapsedSeconds(s);
    s.running = false;
    setActiveSession(s);
    stopActiveTimer();
}

function resumeActiveSession() {
    const s = getActiveSession();
    if (!s || s.running) return;
    s.started_at = Date.now();
    s.running = true;
    setActiveSession(s);
    startActiveTimer();
}

function addActiveTask(description, isDone = false) {
    const s = getActiveSession();
    if (!s) return;
    s.tasks.push({ description, is_done: isDone });
    setActiveSession(s);
}

function trackBookOpen(bookId, bookName) {
    const s = getActiveSession();
    if (!s) return;
    if (!s.tracked_books.includes(bookId)) {
        s.tracked_books.push(bookId);
        s.tasks.push({ description: `📖 Lendo: ${bookName}`, is_done: false });
        setActiveSession(s);
    }
}

function trackFlashcardReview(isCorrect) {
    const s = getActiveSession();
    if (!s) return;
    s.reviewed_cards++;
    s.total_questions++;
    if (isCorrect) s.correct_answers++;
    setActiveSession(s);
}

function cancelActiveSession() {
    stopActiveTimer();
    setActiveSession(null);
}

async function saveActiveSession() {
    const s = getActiveSession();
    if (!s) return;
    const seconds = getElapsedSeconds(s);
    if (seconds < 1) { toast('Sessão muito curta.', 'warning'); return; }

    // Se houve flashcards revisados na sessão, adicionar como task descritiva
    const tasksToSave = [...s.tasks];
    if (s.reviewed_cards > 0) {
        const acc = s.total_questions > 0
            ? Math.round(s.correct_answers / s.total_questions * 100)
            : 0;
        tasksToSave.push({
            description: `🎴 Revisou ${s.reviewed_cards} flashcard${s.reviewed_cards > 1 ? 's' : ''} (${acc}% acerto)`,
            is_done: true,
        });
    }

    const data = {
        subject_id: s.subject_id,
        duration_seconds: seconds,
        total_questions: s.total_questions,
        correct_answers: s.correct_answers,
        tasks: tasksToSave,
    };
    try {
        await api('/sessions/', { method: 'POST', body: JSON.stringify(data) });
        cancelActiveSession();
        toast('Sessão salva no histórico', 'success');
        // Se estiver na tela de sessões, recarrega
        if (typeof showSessions === 'function' && location.hash !== '#nosessions') {
            // Não força navegação, apenas re-render se já na tela
        }
    } catch (e) {
        toast('Erro ao salvar: ' + e.message, 'error');
    }
}

// ─── Timer global ────────────────────────────────────────────────────────
function startActiveTimer() {
    if (_activeTimerInt) clearInterval(_activeTimerInt);
    _activeTimerInt = setInterval(() => {
        updateWidgetTimer();
    }, 1000);
}

function stopActiveTimer() {
    if (_activeTimerInt) { clearInterval(_activeTimerInt); _activeTimerInt = null; }
}

// ─── Widget flutuante (canto inferior direito) ───────────────────────────
function renderActiveWidget() {
    const s = getActiveSession();
    let widget = document.getElementById('active-session-widget');

    if (!s) {
        if (widget) widget.remove();
        stopActiveTimer();
        return;
    }

    if (!widget) {
        widget = document.createElement('div');
        widget.id = 'active-session-widget';
        widget.innerHTML = `
            <div id="asw-collapsed" style="display:flex; align-items:center; gap:10px; padding: 10px 14px;">
                <span class="asw-pulse"></span>
                <div style="flex:1; min-width:0;">
                    <p id="asw-subject" style="font-size:11.5px; font-weight:600; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">—</p>
                    <p id="asw-timer" class="mono" style="font-size:14px; font-weight:600; color:white; line-height:1;">00:00:00</p>
                </div>
                <button onclick="toggleActiveWidget()" id="asw-toggle-btn" class="asw-btn" title="Expandir"><i class="fa-solid fa-chevron-up text-[10px]"></i></button>
            </div>
            <div id="asw-expanded" style="display:none; padding: 0 14px 12px;">
                <div style="border-top: 1px solid rgba(255,255,255,.15); margin: 0 0 10px;"></div>
                <div class="flex items-center gap-1 mb-2">
                    <button onclick="toggleActiveRunning()" id="asw-run-btn" class="asw-btn flex-1" style="background:rgba(255,255,255,.15);"></button>
                    <button onclick="goToActiveSubject()" class="asw-btn" title="Abrir sessão"><i class="fa-solid fa-up-right-from-square text-[10px]"></i></button>
                </div>
                <button onclick="saveActiveSession()" class="asw-btn w-full" style="background:#16a34a; color:white; font-weight:600; padding: 6px 0; font-size:11px;">
                    <i class="fa-solid fa-floppy-disk text-[10px]"></i> Salvar e encerrar
                </button>
                <button onclick="if(confirm('Descartar sessão atual?'))cancelActiveSession()" class="asw-btn w-full mt-1" style="background:transparent; color:rgba(255,255,255,.6); padding: 4px 0; font-size:10.5px;">
                    Descartar
                </button>
            </div>
        `;
        Object.assign(widget.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '500',
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(220,38,38,.35), 0 2px 6px rgba(0,0,0,.15)',
            width: '220px',
            color: 'white',
            border: '1px solid rgba(255,255,255,.1)',
            transition: 'transform .15s',
        });
        document.body.appendChild(widget);

        // CSS injetado uma vez
        if (!document.getElementById('asw-styles')) {
            const style = document.createElement('style');
            style.id = 'asw-styles';
            style.textContent = `
                .asw-pulse {
                    width: 10px; height: 10px; border-radius: 50%;
                    background: #fff; flex-shrink: 0;
                    box-shadow: 0 0 0 0 rgba(255,255,255,.7);
                    animation: aswPulse 1.8s infinite;
                }
                @keyframes aswPulse {
                    0% { box-shadow: 0 0 0 0 rgba(255,255,255,.7); }
                    70% { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
                    100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
                }
                .asw-btn {
                    display: inline-flex; align-items: center; justify-content: center;
                    gap: 6px; padding: 5px 10px; font-size: 11px;
                    background: rgba(255,255,255,.1); color: white;
                    border: none; border-radius: 5px; cursor: pointer;
                    transition: background .12s;
                }
                .asw-btn:hover { background: rgba(255,255,255,.2); }
            `;
            document.head.appendChild(style);
        }
    }

    updateWidgetTimer();
    updateWidgetSubject();
    updateWidgetRunButton();

    if (s.running && !_activeTimerInt) startActiveTimer();
}

function updateWidgetTimer() {
    const s = getActiveSession();
    if (!s) return;
    const sec = getElapsedSeconds(s);
    const h = String(Math.floor(sec/3600)).padStart(2,'0');
    const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
    const ss = String(sec%60).padStart(2,'0');
    const el = document.getElementById('asw-timer');
    if (el) el.textContent = `${h}:${m}:${ss}`;
}
function updateWidgetSubject() {
    const s = getActiveSession();
    if (!s) return;
    const el = document.getElementById('asw-subject');
    if (el) el.textContent = s.subject_name;
}
function updateWidgetRunButton() {
    const s = getActiveSession();
    const btn = document.getElementById('asw-run-btn');
    if (!s || !btn) return;
    btn.innerHTML = s.running
        ? '<i class="fa-solid fa-pause text-[10px]"></i> Pausar'
        : '<i class="fa-solid fa-play text-[10px]"></i> Retomar';
}

function toggleActiveWidget() {
    const expanded = document.getElementById('asw-expanded');
    const btn = document.getElementById('asw-toggle-btn');
    if (!expanded) return;
    const isOpen = expanded.style.display !== 'none';
    expanded.style.display = isOpen ? 'none' : 'block';
    if (btn) btn.innerHTML = `<i class="fa-solid fa-chevron-${isOpen ? 'up' : 'down'} text-[10px]"></i>`;
}

function toggleActiveRunning() {
    const s = getActiveSession();
    if (!s) return;
    if (s.running) pauseActiveSession();
    else resumeActiveSession();
    updateWidgetRunButton();
}

function goToActiveSubject() {
    if (typeof showSessions === 'function') showSessions();
}

// Inicializa widget no load (caso haja sessão pendente)
document.addEventListener('DOMContentLoaded', () => {
    const s = getActiveSession();
    if (s) renderActiveWidget();
});
// Fallback se script carrega depois do DOMContentLoaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => { if (getActiveSession()) renderActiveWidget(); }, 100);
}
