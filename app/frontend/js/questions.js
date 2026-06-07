/* ═══════════════════════════════════════════════════════════════════════
   questions.js — Banco de questões + Caderno de Erros real
   ═══════════════════════════════════════════════════════════════════════ */

let _practiceQueue = [];
let _practiceIdx = 0;

async function showQuestions() {
    setActive('menu-questoes');
    setPage('Questões', 'Estudo');
    document.getElementById('mainContent').innerHTML = `<div class="page-shell">${loadingBlock()}</div>`;
    try {
        const [list, stats, errors] = await Promise.all([
            api('/questions/'),
            api('/questions/stats'),
            api('/questions/error-book'),
        ]);
        renderQuestionsList(list, stats, errors);
    } catch (e) {
        document.getElementById('mainContent').innerHTML = `<div class="page-shell">${emptyState('fa-triangle-exclamation', 'Erro', e.message)}</div>`;
    }
}

function renderQuestionsList(list, stats, errors) {
    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5 flex-wrap gap-2">
            <div>
                <h1 class="page-title">Questões</h1>
                <p class="page-sub">${stats.total_questions} questões · ${stats.total_attempts} tentativas · ${stats.overall_accuracy_pct ?? '—'}% acerto</p>
            </div>
            <div class="flex gap-2 flex-wrap">
                <button onclick="startPractice(false)" class="btn"><i class="fa-solid fa-play text-[10px]"></i> Praticar (todas)</button>
                <button onclick="startPractice(true)" class="btn btn-danger" style="color:var(--danger)"><i class="fa-solid fa-bullseye text-[10px]"></i> Caderno de Erros (${errors.total})</button>
                <button onclick="openQuestionModal()" class="btn btn-primary"><i class="fa-solid fa-plus text-[10px]"></i> Adicionar</button>
            </div>
        </div>

        ${errors.total > 0 ? `
        <div class="card mb-5" style="border-color: var(--danger); background: var(--danger-bg);">
            <div class="card-body" style="padding: 14px 18px;">
                <p class="text-[12px] uppercase mono mb-2" style="color:var(--danger); letter-spacing:.08em;"><i class="fa-solid fa-triangle-exclamation"></i> Caderno de Erros</p>
                <p class="text-[13px] mb-3" style="color:var(--text)">${errors.total} questões com acerto abaixo de 70%</p>
                <div class="flex flex-wrap gap-1.5">
                    ${errors.by_subject.slice(0, 6).map(s => `<span class="badge" style="background:white;color:var(--danger);border-color:var(--danger)">${esc(s.subject_name)} · ${s.count}</span>`).join('')}
                </div>
            </div>
        </div>` : ''}

        ${list.length === 0 ? `<div class="card"><div class="card-body">${emptyState('fa-circle-question', 'Sem questões', 'Adicione questões pra começar.')}</div></div>` :
        `<div class="card"><div class="card-body" style="padding: 0; overflow-x: auto;">
            <table class="tbl">
                <thead><tr>
                    <th>Enunciado</th>
                    <th>Matéria</th>
                    <th>Banca</th>
                    <th>Ano</th>
                    <th class="num text-right">Tentativas</th>
                    <th class="num text-right">Acerto</th>
                    <th class="actions"></th>
                </tr></thead>
                <tbody>
                    ${list.map(q => {
                        const acc = q.accuracy_pct;
                        const accColor = acc == null ? 'var(--text-5)' : acc >= 70 ? 'var(--success)' : 'var(--danger)';
                        return `<tr>
                            <td style="color:var(--text); max-width: 400px;">
                                <p class="line-clamp-2">${esc(q.statement.slice(0, 200))}</p>
                                ${q.topic ? `<p class="text-[10.5px] mono mt-1" style="color:var(--text-4)">${esc(q.topic)}</p>` : ''}
                            </td>
                            <td>${q.subject_name ? `<span class="badge badge-em-curso">${esc(q.subject_name)}</span>` : '—'}</td>
                            <td class="text-[11.5px]" style="color:var(--text-3)">${esc(q.banca || '—')}</td>
                            <td class="num text-[11.5px]">${q.ano || '—'}</td>
                            <td class="num text-right">${q.total_attempts}</td>
                            <td class="num text-right" style="color:${accColor}; font-weight:600;">${acc != null ? acc + '%' : '—'}</td>
                            <td class="actions">
                                <button onclick="practiceOne('${q.id}')" class="btn btn-icon btn-sm" title="Praticar"><i class="fa-solid fa-play text-[10px]"></i></button>
                                <button onclick="openQuestionModal('${q.id}')" class="btn btn-icon btn-sm" title="Editar"><i class="fa-solid fa-pen text-[10px]"></i></button>
                                <button onclick="deleteQuestion('${q.id}')" class="btn btn-icon btn-sm" style="color:var(--danger)" title="Excluir"><i class="fa-solid fa-trash text-[10px]"></i></button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div></div>`}
    </div>`;
}

function openQuestionModal(id) {
    const subjectOpts = (subjects || []).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    openModal(`
    <div class="modal-head">
        <h3>${id ? 'Editar questão' : 'Nova questão'}</h3>
        <button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <form onsubmit="saveQuestion(event,'${id || ''}')" class="space-y-3">
        <div><label class="label">Enunciado *</label><textarea id="q-statement" rows="4" class="input" required></textarea></div>
        <div class="grid grid-cols-2 gap-3">
            <div><label class="label">Tipo</label>
                <select id="q-kind" class="input" onchange="renderOptionsField(this.value)">
                    <option value="multiple">Múltipla escolha</option>
                    <option value="true_false">Verdadeiro/Falso</option>
                    <option value="open">Aberta</option>
                </select>
            </div>
            <div><label class="label">Matéria</label>
                <select id="q-subject" class="input"><option value="">Nenhuma</option>${subjectOpts}</select>
            </div>
        </div>
        <div id="q-opts-wrap"></div>
        <div class="grid grid-cols-3 gap-3">
            <div><label class="label">Banca</label><input id="q-banca" class="input" placeholder="FGV, CESPE..."></div>
            <div><label class="label">Ano</label><input id="q-ano" type="number" class="input mono" placeholder="2024"></div>
            <div><label class="label">Tema</label><input id="q-topic" class="input" placeholder="Direitos Fundamentais"></div>
        </div>
        <div><label class="label">Explicação / Gabarito comentado</label><textarea id="q-expl" rows="3" class="input"></textarea></div>
        <div><label class="label">Tags</label><input id="q-tags" class="input" placeholder="constituicao, oab"></div>
        <div class="flex gap-2 justify-end pt-2">
            <button type="button" onclick="closeModal()" class="btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
    </form>`);
    renderOptionsField('multiple');

    if (id) {
        api(`/questions/${id}`).then(q => {
            document.getElementById('q-statement').value = q.statement;
            document.getElementById('q-kind').value = q.kind;
            document.getElementById('q-subject').value = q.subject_id || '';
            document.getElementById('q-banca').value = q.banca || '';
            document.getElementById('q-ano').value = q.ano || '';
            document.getElementById('q-topic').value = q.topic || '';
            document.getElementById('q-expl').value = q.explanation || '';
            document.getElementById('q-tags').value = q.tags || '';
            renderOptionsField(q.kind, q.options, q.correct);
        });
    }
}

function renderOptionsField(kind, currentOpts = null, currentCorrect = null) {
    const wrap = document.getElementById('q-opts-wrap');
    if (!wrap) return;
    if (kind === 'open') {
        wrap.innerHTML = `<p class="help">Questão aberta: usuário avalia se acertou após responder.</p>`;
        return;
    }
    if (kind === 'true_false') {
        wrap.innerHTML = `<div><label class="label">Gabarito</label>
            <select id="q-correct" class="input">
                <option value="true" ${currentCorrect === 'true' ? 'selected' : ''}>Verdadeiro</option>
                <option value="false" ${currentCorrect === 'false' ? 'selected' : ''}>Falso</option>
            </select></div>`;
        return;
    }
    // multiple choice: A-E
    const letters = ['A','B','C','D','E'];
    const opts = currentOpts || letters.map(k => ({key:k, text:''}));
    wrap.innerHTML = `
        <div><label class="label">Alternativas + gabarito</label>
            ${letters.map((L, i) => {
                const o = opts.find(x => x.key === L) || {key:L, text:''};
                const checked = currentCorrect === L ? 'checked' : '';
                return `<div class="flex gap-2 items-center mb-1.5">
                    <input type="radio" name="q-correct" value="${L}" ${checked} title="Marcar como gabarito">
                    <span class="mono text-[12px]" style="width: 16px; color:var(--text-3)">${L})</span>
                    <input class="input q-opt" data-key="${L}" value="${esc(o.text)}" placeholder="Texto da alternativa ${L}">
                </div>`;
            }).join('')}
        </div>`;
}

async function saveQuestion(e, id) {
    e.preventDefault();
    const kind = document.getElementById('q-kind').value;
    let options = null, correct = null;
    if (kind === 'multiple') {
        options = Array.from(document.querySelectorAll('.q-opt')).map(i => ({ key: i.dataset.key, text: i.value.trim() })).filter(o => o.text);
        correct = document.querySelector('input[name="q-correct"]:checked')?.value || null;
    } else if (kind === 'true_false') {
        correct = document.getElementById('q-correct').value;
    }

    const data = {
        statement: document.getElementById('q-statement').value.trim(),
        kind,
        options,
        correct,
        subject_id: document.getElementById('q-subject').value || null,
        banca: document.getElementById('q-banca').value.trim() || null,
        ano: parseInt(document.getElementById('q-ano').value) || null,
        topic: document.getElementById('q-topic').value.trim() || null,
        explanation: document.getElementById('q-expl').value.trim() || null,
        tags: document.getElementById('q-tags').value.trim() || null,
    };
    try {
        if (id) await api(`/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        else await api('/questions/', { method: 'POST', body: JSON.stringify(data) });
        closeModal();
        toast('Questão salva', 'success');
        showQuestions();
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteQuestion(id) {
    if (!confirm('Excluir esta questão e todas as tentativas?')) return;
    try {
        await api(`/questions/${id}`, { method: 'DELETE' });
        toast('Questão excluída', 'success');
        showQuestions();
    } catch (e) { toast(e.message, 'error'); }
}

// ─── Praticar ──────────────────────────────────────────────────────────
async function startPractice(errorBookOnly) {
    try {
        const data = errorBookOnly ? await api('/questions/error-book') : { questions: await api('/questions/') };
        const list = data.questions || data;
        if (!list.length) { toast(errorBookOnly ? 'Nenhuma questão no caderno de erros.' : 'Sem questões pra praticar.', 'warning'); return; }
        _practiceQueue = [...list].sort(() => Math.random() - 0.5);
        _practiceIdx = 0;
        renderPractice();
    } catch (e) { toast(e.message, 'error'); }
}

async function practiceOne(id) {
    try {
        const q = await api(`/questions/${id}`);
        _practiceQueue = [q];
        _practiceIdx = 0;
        renderPractice();
    } catch (e) { toast(e.message, 'error'); }
}

function renderPractice() {
    if (_practiceIdx >= _practiceQueue.length) {
        document.getElementById('mainContent').innerHTML = `<div class="page-shell">
            <div class="card"><div class="card-body" style="text-align:center; padding: 40px;">
                <i class="fa-solid fa-circle-check text-[40px] mb-3" style="color:var(--success)"></i>
                <h2 class="text-[18px] font-semibold mb-2">Sessão concluída!</h2>
                <p class="text-[13px] mb-4" style="color:var(--text-3)">Você respondeu ${_practiceQueue.length} questões.</p>
                <button onclick="showQuestions()" class="btn btn-primary">Voltar</button>
            </div></div>
        </div>`;
        return;
    }
    const q = _practiceQueue[_practiceIdx];
    const total = _practiceQueue.length;

    let optionsHtml = '';
    if (q.kind === 'multiple' && q.options?.length) {
        optionsHtml = q.options.map(o => `
            <button onclick="answerPractice('${o.key}')" class="practice-opt" data-key="${o.key}">
                <span class="practice-opt-key">${o.key}</span>
                <span class="practice-opt-text">${esc(o.text)}</span>
            </button>`).join('');
    } else if (q.kind === 'true_false') {
        optionsHtml = `
            <button onclick="answerPractice('true')" class="practice-opt" data-key="true">
                <span class="practice-opt-key"><i class="fa-solid fa-check"></i></span>
                <span class="practice-opt-text">Verdadeiro</span>
            </button>
            <button onclick="answerPractice('false')" class="practice-opt" data-key="false">
                <span class="practice-opt-key"><i class="fa-solid fa-xmark"></i></span>
                <span class="practice-opt-text">Falso</span>
            </button>`;
    } else {
        optionsHtml = `
            <div class="card" style="background: var(--bg-2)"><div class="card-body">
                <p class="text-[12.5px] mb-2" style="color:var(--text-3)">Questão aberta. Após pensar, marque:</p>
                <div class="flex gap-2">
                    <button onclick="answerPractice('true')" class="btn btn-success"><i class="fa-solid fa-check text-[10px]"></i> Acertei</button>
                    <button onclick="answerPractice('false')" class="btn btn-danger"><i class="fa-solid fa-xmark text-[10px]"></i> Errei</button>
                </div>
            </div></div>`;
    }

    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell" style="max-width: 800px; margin: 0 auto;">
        <div class="flex items-center justify-between mb-4">
            <button onclick="showQuestions()" class="btn btn-sm"><i class="fa-solid fa-arrow-left text-[10px]"></i> Sair</button>
            <span class="text-[12px] mono" style="color:var(--text-4)">Questão ${_practiceIdx + 1} de ${total}</span>
        </div>

        <div class="bar mb-5"><div style="width:${(_practiceIdx/total)*100}%"></div></div>

        <div class="card mb-4">
            <div class="card-body" style="padding: 20px;">
                <div class="flex items-center gap-2 mb-3 flex-wrap">
                    ${q.subject_name ? `<span class="badge badge-em-curso">${esc(q.subject_name)}</span>` : ''}
                    ${q.banca ? `<span class="badge badge-default"><i class="fa-solid fa-building text-[9px]"></i>${esc(q.banca)}</span>` : ''}
                    ${q.ano ? `<span class="badge badge-default">${q.ano}</span>` : ''}
                    ${q.topic ? `<span class="badge badge-default">${esc(q.topic)}</span>` : ''}
                </div>
                <p class="text-[15px] mb-5" style="color:var(--text); line-height: 1.55; white-space: pre-wrap;">${esc(q.statement)}</p>
                <div class="space-y-2" id="practice-opts">
                    ${optionsHtml}
                </div>
            </div>
        </div>

        <div id="practice-result" class="hidden"></div>
    </div>`;
}

async function answerPractice(answer) {
    const q = _practiceQueue[_practiceIdx];
    // Bloqueia clicks duplos
    document.querySelectorAll('.practice-opt').forEach(b => b.style.pointerEvents = 'none');
    try {
        const r = await api(`/questions/${q.id}/attempt`, {
            method: 'POST',
            body: JSON.stringify({ answer }),
        });
        // Marca visualmente
        document.querySelectorAll('.practice-opt').forEach(b => {
            const key = b.dataset.key;
            if (key === answer) b.classList.add(r.is_correct ? 'practice-opt-correct' : 'practice-opt-wrong');
            else if (key === r.correct_answer) b.classList.add('practice-opt-correct');
        });
        // Resultado
        const rDiv = document.getElementById('practice-result');
        rDiv.classList.remove('hidden');
        rDiv.innerHTML = `
            <div class="card" style="background:${r.is_correct ? 'var(--success-bg)' : 'var(--danger-bg)'}; border-color: ${r.is_correct ? 'var(--success)' : 'var(--danger)'}">
                <div class="card-body" style="padding: 16px;">
                    <div class="flex items-center gap-2 mb-2">
                        <i class="fa-solid ${r.is_correct ? 'fa-circle-check' : 'fa-circle-xmark'} text-[18px]" style="color:${r.is_correct ? 'var(--success)' : 'var(--danger)'}"></i>
                        <span class="text-[14px] font-semibold" style="color:${r.is_correct ? 'var(--success)' : 'var(--danger)'}">${r.is_correct ? 'Correto!' : 'Errou'}</span>
                    </div>
                    ${r.explanation ? `<p class="text-[13px] mt-2" style="color:var(--text); line-height: 1.5; white-space: pre-wrap;">${esc(r.explanation)}</p>` : ''}
                    <div class="flex justify-end mt-3">
                        <button onclick="nextPractice()" class="btn btn-primary">${_practiceIdx + 1 >= _practiceQueue.length ? 'Concluir' : 'Próxima'} <i class="fa-solid fa-arrow-right text-[10px]"></i></button>
                    </div>
                </div>
            </div>`;
    } catch (e) {
        toast(e.message, 'error');
        document.querySelectorAll('.practice-opt').forEach(b => b.style.pointerEvents = '');
    }
}

function nextPractice() {
    _practiceIdx++;
    renderPractice();
}
