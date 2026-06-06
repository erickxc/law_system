/* ═══════════════════════════════════════════════════════════════════════
   sessions.js — Cronômetro + Pomodoro + Modo Foco
   ═══════════════════════════════════════════════════════════════════════ */

// State adicional
let _pomodoroEnabled = false;
let _pomodoroPhase = 'work';      // 'work' | 'break'
let _pomodoroSecondsLeft = 25 * 60;
let _pomodoroCycle = 0;            // contador de pomodoros completados
const POMODORO_WORK = 25 * 60;
const POMODORO_BREAK = 5 * 60;
const POMODORO_LONG_BREAK = 15 * 60;

async function showSessions() {
    setActive('menu-sessoes');
    setPage('Sessão de estudo', 'Estudo');

    // Se já existe sessão ativa, mostrar painel da sessão em andamento
    const active = getActiveSession();
    if (active) {
        renderActiveSessionPage(active);
        return;
    }

    const subjectOpts = subjects.length === 0
        ? '<option value="">Nenhuma matéria cadastrada</option>'
        : subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    sessionTasks = [];
    _pomodoroEnabled = false;
    _pomodoroPhase = 'work';
    _pomodoroSecondsLeft = POMODORO_WORK;
    _pomodoroCycle = 0;

    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5">
            <div>
                <h1 class="page-title">Nova sessão de estudo</h1>
                <p class="page-sub">Escolha uma matéria e inicie. Você pode navegar para livros e flashcards durante a sessão.</p>
            </div>
        </div>

        <div class="max-w-md mx-auto">
            <div class="card">
                <div class="card-body" style="padding: 28px;">
                    <i class="fa-solid fa-stopwatch text-[40px] mb-4 block text-center" style="color:var(--accent)"></i>
                    <h2 class="text-[18px] font-semibold text-center mb-1" style="color:var(--text)">Iniciar sessão</h2>
                    <p class="text-[12.5px] text-center mb-5" style="color:var(--text-4)">A sessão fica ativa mesmo se navegar para outras telas. Um cronômetro flutuante acompanha.</p>

                    <div class="space-y-3">
                        <div><label class="label">Matéria</label><select class="input" id="session-subject">${subjectOpts}</select></div>
                    </div>

                    <button onclick="startNewSession()" class="btn btn-primary btn-lg w-full mt-5">
                        <i class="fa-solid fa-play text-[11px]"></i> Iniciar agora
                    </button>
                </div>
            </div>
        </div>
    </div>`;
}

function startNewSession() {
    const subjectSel = document.getElementById('session-subject');
    const subjectId = subjectSel.value;
    if (!subjectId) { toast('Selecione uma matéria.', 'warning'); return; }
    const subjectName = subjectSel.options[subjectSel.selectedIndex].text;
    if (startActiveSession(subjectId, subjectName)) {
        showSessions(); // re-render para mostrar tela de sessão ativa
    }
}

function renderActiveSessionPage(active) {
    const subjectOpts = subjects.length === 0
        ? '<option value="">—</option>'
        : subjects.map(s => `<option value="${s.id}" ${s.id === active.subject_id ? 'selected' : ''}>${s.name}</option>`).join('');

    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5">
            <div>
                <h1 class="page-title">Sessão em andamento</h1>
                <p class="page-sub">${active.subject_name}</p>
            </div>
            <button onclick="toggleFocusMode()" class="btn btn-ghost" id="btn-focus">
                <i class="fa-solid fa-expand text-[11px]"></i> Modo foco
            </button>
        </div>

        <div class="max-w-3xl space-y-3">
            <div class="card" style="border-color: var(--danger); border-left-width: 3px;">
                <div class="card-header">
                    <span class="card-title"><i class="fa-solid fa-circle text-[8px]" style="color:var(--danger)"></i> Cronômetro ao vivo</span>
                    <span id="pomo-status" class="hidden ml-2"></span>
                    <label class="ml-auto flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="pomo-toggle" onchange="togglePomodoro(this.checked)">
                        <span class="text-[12px]" style="color:var(--text-3)">Pomodoro 25/5</span>
                    </label>
                </div>
                <div class="card-body">
                    <div class="text-center py-4">
                        <p class="timer-display" id="timer-display" style="color:var(--danger);">00:00:00</p>
                        <p class="text-[11px] mono mt-2" id="pomo-cycle" style="color:var(--text-4); height: 14px;"></p>
                    </div>
                    <div class="flex justify-center gap-2">
                        <button onclick="toggleActiveRunning(); refreshActiveTimerLocal();" id="btn-timer" class="btn btn-primary btn-lg" style="min-width:140px">
                            <i class="fa-solid fa-pause text-[11px]" id="timer-icon"></i><span id="timer-label">Pausar</span>
                        </button>
                        <button onclick="if(confirm('Descartar sessão atual?')){cancelActiveSession();showSessions();}" class="btn btn-lg btn-danger">
                            <i class="fa-solid fa-trash text-[11px]"></i> Descartar
                        </button>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><span class="card-title">Dados da sessão</span></div>
                <div class="card-body space-y-3">
                    <div><label class="label">Matéria</label><select class="input" id="session-subject" onchange="updateActiveSubject(this)">${subjectOpts}</select></div>
                    <div class="grid grid-cols-2 gap-3">
                        <div><label class="label">Questões feitas</label><input type="number" class="input mono" id="session-total" value="${active.total_questions || 0}" min="0" onchange="updateActiveQuestions()"></div>
                        <div><label class="label">Acertos</label><input type="number" class="input mono" id="session-correct" value="${active.correct_answers || 0}" min="0" onchange="updateActiveQuestions()"></div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <span class="card-title">Atividades & tarefas</span>
                    <span class="card-sub ml-auto" id="task-count">${active.tasks.length} ite${active.tasks.length===1?'m':'ns'}</span>
                </div>
                <div class="card-body">
                    <div id="task-list" class="mb-3"></div>
                    <div class="flex gap-2">
                        <input class="input flex-1" id="task-input" placeholder="Adicionar tarefa…" onkeydown="if(event.key==='Enter'){event.preventDefault();addTask()}">
                        <button onclick="addTask()" class="btn">Adicionar</button>
                    </div>
                </div>
            </div>

            <div class="card" style="background:var(--accent-bg); border-color:var(--accent);">
                <div class="card-body" style="padding: 14px 16px;">
                    <p class="text-[12px]" style="color:var(--text-2)"><i class="fa-solid fa-circle-info text-[10px]" style="color:var(--accent)"></i> Enquanto a sessão estiver ativa, leituras em livros e revisões de flashcards são registradas automaticamente como atividades.</p>
                </div>
            </div>

            <button onclick="saveActiveSession()" class="btn btn-primary btn-lg w-full" style="background:var(--success); border-color:var(--success);">
                <i class="fa-solid fa-floppy-disk text-[11px]"></i> Finalizar e salvar
            </button>
        </div>
    </div>
    <button onclick="toggleFocusMode()" class="focus-exit btn btn-ghost hidden" id="btn-focus-exit">
        <i class="fa-solid fa-compress text-[11px]"></i> Sair do foco (ESC)
    </button>`;

    refreshActiveTimerLocal();
    renderTaskList();
}

function refreshActiveTimerLocal() {
    // Atualiza display local em sync com state global
    const s = getActiveSession();
    if (!s) return;
    const sec = getElapsedSeconds(s);
    const h = String(Math.floor(sec/3600)).padStart(2,'0');
    const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
    const ss = String(sec%60).padStart(2,'0');
    const td = document.getElementById('timer-display');
    if (td) td.textContent = `${h}:${m}:${ss}`;
    const icon = document.getElementById('timer-icon');
    const label = document.getElementById('timer-label');
    if (icon) icon.className = `fa-solid fa-${s.running ? 'pause' : 'play'} text-[11px]`;
    if (label) label.textContent = s.running ? 'Pausar' : 'Retomar';

    // Re-agendar atualização local
    if (s.running) {
        clearTimeout(window._localTimerRefresh);
        window._localTimerRefresh = setTimeout(refreshActiveTimerLocal, 1000);
    }
}

function updateActiveSubject(sel) {
    const s = getActiveSession();
    if (!s) return;
    s.subject_id = sel.value;
    s.subject_name = sel.options[sel.selectedIndex].text;
    setActiveSession(s);
}

function updateActiveQuestions() {
    const s = getActiveSession();
    if (!s) return;
    s.total_questions = parseInt(document.getElementById('session-total').value) || 0;
    s.correct_answers = parseInt(document.getElementById('session-correct').value) || 0;
    setActiveSession(s);
}

function togglePomodoro(enabled) {
    _pomodoroEnabled = enabled;
    const status = document.getElementById('pomo-status');
    const cycle = document.getElementById('pomo-cycle');
    if (enabled) {
        _pomodoroSecondsLeft = POMODORO_WORK;
        _pomodoroPhase = 'work';
        _pomodoroCycle = 0;
        status.className = 'pomo-pill work';
        status.innerHTML = '<i class="fa-solid fa-fire text-[10px]"></i> Foco';
        status.classList.remove('hidden');
        updatePomodoroDisplay();
        cycle.textContent = 'Ciclo 1';
    } else {
        status.classList.add('hidden');
        cycle.textContent = '';
        // Volta cronômetro contínuo zerado se nao estiver rodando
        if (!timerRunning) {
            timerSeconds = 0;
            document.getElementById('timer-display').textContent = '00:00:00';
        }
    }
}

function updatePomodoroDisplay() {
    const m = Math.floor(_pomodoroSecondsLeft / 60);
    const s = _pomodoroSecondsLeft % 60;
    document.getElementById('timer-display').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function toggleTimer() {
    timerRunning = !timerRunning;
    if (timerRunning) {
        timerInterval = setInterval(timerTick, 1000);
        document.getElementById('timer-icon').className = 'fa-solid fa-pause text-[11px]';
        document.getElementById('timer-label').textContent = 'Pausar';
    } else {
        clearInterval(timerInterval);
        document.getElementById('timer-icon').className = 'fa-solid fa-play text-[11px]';
        document.getElementById('timer-label').textContent = 'Retomar';
    }
}

function timerTick() {
    if (_pomodoroEnabled) {
        _pomodoroSecondsLeft--;
        if (_pomodoroSecondsLeft <= 0) {
            // Tocar bell
            pomodoroBell();
            if (_pomodoroPhase === 'work') {
                _pomodoroCycle++;
                // Troca para pausa (longa a cada 4 ciclos)
                const isLong = _pomodoroCycle % 4 === 0;
                _pomodoroPhase = 'break';
                _pomodoroSecondsLeft = isLong ? POMODORO_LONG_BREAK : POMODORO_BREAK;
                const status = document.getElementById('pomo-status');
                status.className = 'pomo-pill break';
                status.innerHTML = `<i class="fa-solid fa-mug-hot text-[10px]"></i> Pausa${isLong ? ' longa' : ''}`;
                if (Notification.permission === 'granted') {
                    showNotification('Hora da pausa', isLong ? `Você completou 4 pomodoros! Pausa de 15 min.` : `Pausa de 5 min. Volte logo!`);
                }
                document.getElementById('pomo-cycle').textContent = `Ciclo ${_pomodoroCycle} · pausa`;
            } else {
                _pomodoroPhase = 'work';
                _pomodoroSecondsLeft = POMODORO_WORK;
                const status = document.getElementById('pomo-status');
                status.className = 'pomo-pill work';
                status.innerHTML = '<i class="fa-solid fa-fire text-[10px]"></i> Foco';
                if (Notification.permission === 'granted') {
                    showNotification('Volta ao foco', `Ciclo ${_pomodoroCycle + 1} começou — 25 min de estudo.`);
                }
                document.getElementById('pomo-cycle').textContent = `Ciclo ${_pomodoroCycle + 1}`;
            }
        }
        updatePomodoroDisplay();
    } else {
        timerSeconds++;
        const h = String(Math.floor(timerSeconds/3600)).padStart(2,'0');
        const m = String(Math.floor((timerSeconds%3600)/60)).padStart(2,'0');
        const s = String(timerSeconds%60).padStart(2,'0');
        document.getElementById('timer-display').textContent = `${h}:${m}:${s}`;
    }
}

function pomodoroBell() {
    try {
        if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = _audioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        [880, 660, 880].forEach((f, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = f;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, now + i * 0.18);
            g.gain.linearRampToValueAtTime(0.15, now + i * 0.18 + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.5);
            osc.connect(g).connect(ctx.destination);
            osc.start(now + i * 0.18);
            osc.stop(now + i * 0.18 + 0.55);
        });
    } catch {}
}

function resetTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    timerSeconds = 0;
    if (_pomodoroEnabled) {
        _pomodoroSecondsLeft = POMODORO_WORK;
        _pomodoroPhase = 'work';
        _pomodoroCycle = 0;
        updatePomodoroDisplay();
        const s = document.getElementById('pomo-status');
        s.className = 'pomo-pill work';
        s.innerHTML = '<i class="fa-solid fa-fire text-[10px]"></i> Foco';
        document.getElementById('pomo-cycle').textContent = 'Ciclo 1';
    } else {
        const td = document.getElementById('timer-display');
        if (td) td.textContent = '00:00:00';
    }
    const ti = document.getElementById('timer-icon');
    if (ti) ti.className = 'fa-solid fa-play text-[11px]';
    const tl = document.getElementById('timer-label');
    if (tl) tl.textContent = 'Iniciar';
}

function addTask() {
    const inp = document.getElementById('task-input');
    const desc = inp.value.trim();
    if (!desc) return;
    const s = getActiveSession();
    if (s) {
        addActiveTask(desc, false);
        inp.value = '';
        renderTaskList();
    }
}

function toggleTask(i) {
    const s = getActiveSession();
    if (!s || !s.tasks[i]) return;
    s.tasks[i].is_done = !s.tasks[i].is_done;
    setActiveSession(s);
    renderTaskList();
}

function removeTask(i) {
    const s = getActiveSession();
    if (!s || !s.tasks[i]) return;
    s.tasks.splice(i, 1);
    setActiveSession(s);
    renderTaskList();
}

function renderTaskList() {
    const el = document.getElementById('task-list');
    if (!el) return;
    const s = getActiveSession();
    const tasks = s ? s.tasks : [];
    const count = document.getElementById('task-count');
    if (count) count.textContent = `${tasks.length} ite${tasks.length===1?'m':'ns'}`;
    if (!tasks.length) {
        el.innerHTML = `<p class="text-[12px] py-2" style="color:var(--text-4)">Nenhuma tarefa ainda. Atividades em livros e flashcards aparecem aqui automaticamente.</p>`;
        return;
    }
    el.innerHTML = tasks.map((t, i) => `
    <div class="flex items-center gap-2 py-2" style="border-bottom: 1px solid var(--border)">
        <button onclick="toggleTask(${i})" class="w-4 h-4 flex items-center justify-center transition-colors" style="border: 1.5px solid ${t.is_done ? 'var(--success)' : 'var(--border-2)'}; background: ${t.is_done ? 'var(--success)' : 'transparent'}; color: white; border-radius: 3px;">
            ${t.is_done ? '<i class="fa-solid fa-check text-[8px]"></i>' : ''}
        </button>
        <span class="flex-1 text-[13px]" style="color:${t.is_done ? 'var(--text-5)' : 'var(--text)'}; ${t.is_done ? 'text-decoration: line-through;' : ''}">${t.description}</span>
        <button onclick="removeTask(${i})" style="color:var(--text-5)"><i class="fa-solid fa-xmark text-[11px]"></i></button>
    </div>`).join('');
}

// Legado — toggleTimer / resetTimer ainda chamados pelo Pomodoro
function toggleTimer() { toggleActiveRunning(); }
function resetTimer() { /* legado: descartar não pause; sessão global controla */ }

// ─── Modo Foco ───────────────────────────────────────────────────────────
function toggleFocusMode() {
    const isOn = document.body.classList.toggle('focus-mode');
    document.getElementById('btn-focus-exit')?.classList.toggle('hidden', !isOn);
    if (isOn) {
        document.addEventListener('keydown', focusModeEscHandler);
    } else {
        document.removeEventListener('keydown', focusModeEscHandler);
    }
}
function focusModeEscHandler(e) {
    if (e.key === 'Escape') {
        document.body.classList.remove('focus-mode');
        document.getElementById('btn-focus-exit')?.classList.add('hidden');
        document.removeEventListener('keydown', focusModeEscHandler);
    }
}
