/* ═══════════════════════════════════════════════════════════════════════
   sessions.js — Cronômetro de sessões + criação
   ═══════════════════════════════════════════════════════════════════════ */

async function showSessions() {
    setActive('menu-sessoes');
    setPage('Sessão de estudo', 'Estudo');

    const subjectOpts = subjects.length === 0
        ? '<option value="">Nenhuma matéria cadastrada</option>'
        : subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    timerSeconds = 0;
    clearInterval(timerInterval);
    timerRunning = false;
    sessionTasks = [];

    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="mb-5">
            <h1 class="page-title">Nova sessão de estudo</h1>
            <p class="page-sub">Cronômetro, questões e tarefas</p>
        </div>

        <div class="max-w-3xl space-y-3">
            <div class="card">
                <div class="card-header"><span class="card-title">Cronômetro</span></div>
                <div class="card-body">
                    <div class="text-center py-4">
                        <p class="timer-display" id="timer-display">00:00:00</p>
                    </div>
                    <div class="flex justify-center gap-2">
                        <button onclick="toggleTimer()" id="btn-timer" class="btn btn-primary btn-lg" style="min-width:140px">
                            <i class="fa-solid fa-play text-[11px]" id="timer-icon"></i><span id="timer-label">Iniciar</span>
                        </button>
                        <button onclick="resetTimer()" class="btn btn-lg"><i class="fa-solid fa-rotate-left text-[11px]"></i> Zerar</button>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><span class="card-title">Dados da sessão</span></div>
                <div class="card-body space-y-3">
                    <div><label class="label">Matéria *</label><select class="input" id="session-subject">${subjectOpts}</select></div>
                    <div class="grid grid-cols-2 gap-3">
                        <div><label class="label">Questões feitas</label><input type="number" class="input mono" id="session-total" value="0" min="0"></div>
                        <div><label class="label">Acertos</label><input type="number" class="input mono" id="session-correct" value="0" min="0"></div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><span class="card-title">Tarefas</span></div>
                <div class="card-body">
                    <div id="task-list" class="mb-3"></div>
                    <div class="flex gap-2">
                        <input class="input flex-1" id="task-input" placeholder="Adicionar tarefa…" onkeydown="if(event.key==='Enter'){event.preventDefault();addTask()}">
                        <button onclick="addTask()" class="btn">Adicionar</button>
                    </div>
                </div>
            </div>

            <button onclick="saveSession()" class="btn btn-primary btn-lg w-full">
                <i class="fa-solid fa-floppy-disk text-[11px]"></i> Salvar sessão
            </button>
        </div>
    </div>`;
}

function toggleTimer() {
    timerRunning = !timerRunning;
    if (timerRunning) {
        timerInterval = setInterval(() => {
            timerSeconds++;
            const h = String(Math.floor(timerSeconds/3600)).padStart(2,'0');
            const m = String(Math.floor((timerSeconds%3600)/60)).padStart(2,'0');
            const s = String(timerSeconds%60).padStart(2,'0');
            document.getElementById('timer-display').textContent = `${h}:${m}:${s}`;
        }, 1000);
        document.getElementById('timer-icon').className = 'fa-solid fa-pause text-[11px]';
        document.getElementById('timer-label').textContent = 'Pausar';
    } else {
        clearInterval(timerInterval);
        document.getElementById('timer-icon').className = 'fa-solid fa-play text-[11px]';
        document.getElementById('timer-label').textContent = 'Retomar';
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    timerSeconds = 0;
    const td = document.getElementById('timer-display');
    if (td) td.textContent = '00:00:00';
    const ti = document.getElementById('timer-icon');
    if (ti) ti.className = 'fa-solid fa-play text-[11px]';
    const tl = document.getElementById('timer-label');
    if (tl) tl.textContent = 'Iniciar';
}

function addTask() {
    const inp = document.getElementById('task-input');
    const desc = inp.value.trim();
    if (!desc) return;
    sessionTasks.push({ description: desc, is_done: false });
    inp.value = '';
    renderTaskList();
}
function toggleTask(i) { sessionTasks[i].is_done = !sessionTasks[i].is_done; renderTaskList(); }
function removeTask(i) { sessionTasks.splice(i, 1); renderTaskList(); }

function renderTaskList() {
    document.getElementById('task-list').innerHTML = sessionTasks.map((t, i) => `
    <div class="flex items-center gap-2 py-2" style="border-bottom: 1px solid var(--border)">
        <button onclick="toggleTask(${i})" class="w-4 h-4 flex items-center justify-center transition-colors" style="border: 1.5px solid ${t.is_done ? 'var(--success)' : 'var(--border-2)'}; background: ${t.is_done ? 'var(--success)' : 'transparent'}; color: white; border-radius: 3px;">
            ${t.is_done ? '<i class="fa-solid fa-check text-[8px]"></i>' : ''}
        </button>
        <span class="flex-1 text-[13px]" style="color:${t.is_done ? 'var(--text-5)' : 'var(--text)'}; ${t.is_done ? 'text-decoration: line-through;' : ''}">${t.description}</span>
        <button onclick="removeTask(${i})" style="color:var(--text-5)"><i class="fa-solid fa-xmark text-[11px]"></i></button>
    </div>`).join('');
}

async function saveSession() {
    const subjectId = document.getElementById('session-subject').value;
    if (!subjectId) { toast('Selecione uma matéria.', 'warning'); return; }
    if (timerSeconds === 0) { toast('Inicie o timer.', 'warning'); return; }
    const data = {
        subject_id: subjectId,
        duration_seconds: timerSeconds,
        total_questions: parseInt(document.getElementById('session-total').value) || 0,
        correct_answers: parseInt(document.getElementById('session-correct').value) || 0,
        tasks: sessionTasks,
    };
    try {
        await api('/sessions/', { method: 'POST', body: JSON.stringify(data) });
        toast('Sessão salva', 'success');
        resetTimer();
        sessionTasks = [];
        renderTaskList();
        document.getElementById('session-total').value = '0';
        document.getElementById('session-correct').value = '0';
    } catch (e) { toast(e.message, 'error'); }
}
