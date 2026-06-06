/* ═══════════════════════════════════════════════════════════════════════
   flashcards.js — CRUD + sessão configurável + revisão SM-2
   ═══════════════════════════════════════════════════════════════════════ */

const DIFFICULTY = {
    easy:   { label: 'Fácil',   color: '#16a34a' },
    medium: { label: 'Médio',   color: '#d97706' },
    hard:   { label: 'Difícil', color: '#dc2626' },
};

async function showFlashcards() {
    setActive('menu-flashcards');
    setPage('Flashcards', 'Estudo');
    const [cards, stats] = await Promise.all([
        api('/flashcards/').catch(() => []),
        api('/flashcards/stats').catch(() => null),
    ]);
    renderFlashcards(cards, stats);
}

function renderFlashcards(cards, stats) {
    const due = cards.filter(c => c.is_due);

    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5">
            <div>
                <h1 class="page-title">Flashcards</h1>
                <p class="page-sub">Revisão espaçada (SM-2) · ${cards.length} cards no acervo</p>
            </div>
            <div class="flex gap-2">
                <button onclick="openReviewConfigModal()" class="btn btn-accent">
                    <i class="fa-solid fa-play text-[10px]"></i> Iniciar revisão
                </button>
                <button onclick="openFlashcardModal()" class="btn btn-primary">
                    <i class="fa-solid fa-plus text-[10px]"></i> Novo card
                </button>
            </div>
        </div>

        ${stats ? `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            ${kpi('Total', stats.total_cards, 'fa-layer-group')}
            ${kpi('Para revisar', stats.due_today, 'fa-clock')}
            ${kpi('Revisões', stats.total_reviews, 'fa-repeat')}
            ${kpi('Acerto', stats.overall_accuracy_pct != null ? stats.overall_accuracy_pct : '—', 'fa-bullseye', stats.overall_accuracy_pct != null ? '%' : '')}
        </div>` : ''}

        <div class="tab-bar">
            <button id="tab-all" onclick="filterCards('all')" class="tab-btn active">Todos · ${cards.length}</button>
            <button id="tab-due" onclick="filterCards('due')" class="tab-btn">Para revisar · ${due.length}</button>
        </div>

        <div id="fc-list">${renderCardList(cards)}</div>
    </div>`;

    window._fcAll = cards;
    window._fcDue = due;
}

function filterCards(type) {
    document.getElementById('tab-all').classList.toggle('active', type === 'all');
    document.getElementById('tab-due').classList.toggle('active', type === 'due');
    document.getElementById('fc-list').innerHTML = renderCardList(type === 'all' ? window._fcAll : window._fcDue);
}

function renderCardList(cards) {
    if (cards.length === 0) {
        return `<div class="card"><div class="card-body">${emptyState('fa-layer-group', 'Nenhum flashcard', 'Crie cards para revisar com repetição espaçada.')}</div></div>`;
    }
    return `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        ${cards.map((c) => fcCard(c)).join('')}
    </div>`;
}

function fcCard(c) {
    const diff = DIFFICULTY[c.difficulty || 'medium'];
    const acc = c.accuracy_pct != null ? `${c.accuracy_pct}%` : '—';
    return `
    <div class="card" style="${c.is_due ? 'border-left: 3px solid var(--warning);' : ''}">
        <div class="card-body" style="padding: 14px;">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
                <span class="badge" style="background:${diff.color}1a;color:${diff.color};border-color:${diff.color}40">${diff.label}</span>
                ${c.subject_name ? `<span class="badge badge-em-curso">${c.subject_name}</span>` : ''}
                ${c.is_due ? `<span class="badge badge-due"><i class="fa-solid fa-clock text-[8px]"></i>Revisar</span>` : ''}
            </div>
            <p class="text-[13.5px] font-medium mb-2" style="color:var(--text); line-height: 1.4;">${c.front}</p>
            <p class="text-[12px] mb-3 line-clamp-2" style="color:var(--text-4); line-height: 1.4;">${c.back}</p>

            ${c.tags ? `<div class="mb-3 text-[10.5px] mono" style="color:var(--text-4)">${c.tags.split(',').map(t => '#'+t.trim()).join(' ')}</div>` : ''}

            <div class="flex items-center justify-between pt-2" style="border-top:1px solid var(--border);">
                <div class="text-[11px] mono flex items-center gap-3" style="color:var(--text-4)">
                    <span><i class="fa-solid fa-repeat text-[9px]"></i> ${c.total_reviews}</span>
                    <span><i class="fa-solid fa-bullseye text-[9px]"></i> ${acc}</span>
                </div>
                <div class="flex gap-1">
                    <button onclick="openFlashcardModal('${c.id}')" class="btn btn-icon btn-sm" title="Editar"><i class="fa-solid fa-pen text-[10px]"></i></button>
                    <button onclick="deleteFlashcard('${c.id}')" class="btn btn-icon btn-sm" title="Excluir"><i class="fa-solid fa-trash text-[10px]"></i></button>
                </div>
            </div>
        </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Modal "Iniciar revisão" — filtros configuráveis
// ─────────────────────────────────────────────────────────────
function openReviewConfigModal() {
    // Matérias com pelo menos 1 card
    const subjectsWithCards = {};
    for (const c of (window._fcAll || [])) {
        if (c.subject_id) subjectsWithCards[c.subject_id] = c.subject_name;
    }
    const hasUnassigned = (window._fcAll || []).some(c => !c.subject_id);

    const subjectChips = Object.entries(subjectsWithCards).map(([id, name]) => `
        <label class="chip">
            <input type="checkbox" name="sess-subject" value="${id}" checked>
            <span>${name}</span>
        </label>`).join('') +
        (hasUnassigned ? `<label class="chip">
            <input type="checkbox" name="sess-subject" value="__none__" checked>
            <span>Sem matéria</span>
        </label>` : '');

    openModal(`
    <style>
        .chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid var(--border-2); border-radius: 99px; cursor: pointer; font-size: 12px; user-select: none; background: var(--surface); transition: all .12s; }
        .chip:has(input:checked) { background: var(--accent); color: white; border-color: var(--accent); }
        .chip input { display: none; }
        .diff-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--border-2); border-radius: 6px; cursor: pointer; font-size: 12px; user-select: none; background: var(--surface); transition: all .12s; }
        .diff-pill:has(input:checked) { color: white; }
        .diff-pill input { display: none; }
    </style>
    <div class="modal-head">
        <h3><i class="fa-solid fa-play text-[12px]" style="color:var(--accent)"></i> Configurar revisão</h3>
        <button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <div class="space-y-4">
        <div>
            <label class="label">Matérias <span style="color:var(--text-4);text-transform:none;letter-spacing:0;font-weight:400">(deselecione as que quer excluir)</span></label>
            <div class="flex gap-1.5 flex-wrap" id="sess-subjects">
                ${subjectChips || `<p class="text-[12px]" style="color:var(--text-4)">Você não tem matérias cadastradas com cards ainda.</p>`}
            </div>
        </div>

        <div>
            <label class="label">Dificuldade</label>
            <div class="flex gap-2 flex-wrap">
                ${Object.entries(DIFFICULTY).map(([k, d]) => `
                    <label class="diff-pill" style="background:${d.color}; color:white; border-color:${d.color}; opacity:.4;" onmouseover="this.style.opacity=this.querySelector('input').checked?1:.6" onmouseout="this.style.opacity=this.querySelector('input').checked?1:.4">
                        <input type="checkbox" name="sess-diff" value="${k}" checked onchange="this.parentElement.style.opacity = this.checked ? 1 : .4">
                        <span>${d.label}</span>
                    </label>
                `).join('')}
            </div>
            <p class="help">Marque pelo menos uma. Vazio = todas.</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="label">Quantidade máxima</label>
                <select class="input" id="sess-max">
                    <option value="5">5 cards</option>
                    <option value="10" selected>10 cards</option>
                    <option value="20">20 cards</option>
                    <option value="30">30 cards</option>
                    <option value="50">50 cards</option>
                </select>
            </div>
            <div>
                <label class="label">Tempo máximo</label>
                <select class="input" id="sess-time">
                    <option value="0" selected>Sem limite</option>
                    <option value="5">5 minutos</option>
                    <option value="10">10 minutos</option>
                    <option value="15">15 minutos</option>
                    <option value="30">30 minutos</option>
                </select>
            </div>
        </div>

        <div class="flex items-center gap-2">
            <input type="checkbox" id="sess-only-due">
            <label for="sess-only-due" class="text-[12.5px]" style="color:var(--text-2)">Apenas cards pendentes hoje</label>
        </div>
        <div class="flex items-center gap-2">
            <input type="checkbox" id="sess-shuffle" checked>
            <label for="sess-shuffle" class="text-[12.5px]" style="color:var(--text-2)">Embaralhar a ordem</label>
        </div>
    </div>

    <div class="flex gap-2 justify-end pt-4 mt-2" style="border-top: 1px solid var(--border);">
        <button onclick="closeModal()" class="btn">Cancelar</button>
        <button onclick="launchReview()" class="btn btn-accent"><i class="fa-solid fa-play text-[10px]"></i> Começar</button>
    </div>
    `);

    document.querySelectorAll('input[name="sess-diff"]').forEach(el => {
        el.parentElement.style.opacity = el.checked ? '1' : '0.4';
    });
}

async function launchReview() {
    const subj_checked = Array.from(document.querySelectorAll('input[name="sess-subject"]:checked')).map(el => el.value);
    const subject_ids = subj_checked.filter(v => v !== '__none__');
    // OBS: backend não suporta "sem matéria"; se só __none__ marcado, filtramos no client
    const includeUnassigned = subj_checked.includes('__none__');
    const onlyUnassigned = includeUnassigned && subject_ids.length === 0;

    const diffs = Array.from(document.querySelectorAll('input[name="sess-diff"]:checked')).map(el => el.value);
    const max = parseInt(document.getElementById('sess-max').value);
    const timeLimit = parseInt(document.getElementById('sess-time').value);  // minutos
    const onlyDue = document.getElementById('sess-only-due').checked;
    const shuffle = document.getElementById('sess-shuffle').checked;

    try {
        const payload = {
            // se filtrou matérias, manda só essas; senão, deixa vazio (= todas)
            subject_ids: (onlyUnassigned ? [] : subject_ids),
            difficulties: diffs,
            max_cards: max,
            only_due: onlyDue,
            shuffle,
        };
        const result = await api('/flashcards/session', { method: 'POST', body: JSON.stringify(payload) });
        let cards = result.cards;

        // Filtro client-side: se usuário quer só "sem matéria", remove os com subject_id
        if (onlyUnassigned) {
            cards = cards.filter(c => !c.subject_id);
        } else if (!includeUnassigned) {
            // se desmarcou "sem matéria" mas selecionou outras, remove os sem matéria
            cards = cards.filter(c => c.subject_id);
        }

        if (cards.length === 0) {
            toast('Nenhum card encontrado com esses filtros.', 'warning');
            return;
        }

        reviewQueue = cards;
        reviewIndex = 0;
        window._reviewTimeLimit = timeLimit;
        window._reviewStartedAt = Date.now();
        closeModal();
        showReviewCard();
    } catch (e) { toast(e.message, 'error'); }
}

// ─────────────────────────────────────────────────────────────
// CRUD modal
// ─────────────────────────────────────────────────────────────
function openFlashcardModal(id = null) {
    editingFlashcardId = id;
    const subjectOpts = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    openModal(`
    <div class="modal-head"><h3>${id ? 'Editar flashcard' : 'Novo flashcard'}</h3><button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button></div>
    <form onsubmit="saveFlashcard(event)" class="space-y-3">
        <div><label class="label">Pergunta *</label><textarea id="fc-front" rows="3" class="input" required placeholder="O que é…? Defina…"></textarea></div>
        <div><label class="label">Resposta *</label><textarea id="fc-back" rows="3" class="input" required placeholder="A resposta…"></textarea></div>
        <div class="grid grid-cols-3 gap-3">
            <div><label class="label">Matéria</label><select class="input" id="fc-subject"><option value="">Nenhuma</option>${subjectOpts}</select></div>
            <div><label class="label">Dificuldade</label>
                <select class="input" id="fc-difficulty">
                    <option value="easy">Fácil</option>
                    <option value="medium" selected>Médio</option>
                    <option value="hard">Difícil</option>
                </select>
            </div>
            <div><label class="label">Tags</label><input class="input" id="fc-tags" placeholder="tag1, tag2"></div>
        </div>
        <div class="flex gap-2 justify-end pt-2">
            <button type="button" onclick="closeModal()" class="btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
    </form>`);

    if (id) {
        api(`/flashcards/${id}`).then(c => {
            document.getElementById('fc-front').value = c.front;
            document.getElementById('fc-back').value = c.back;
            document.getElementById('fc-subject').value = c.subject_id || '';
            document.getElementById('fc-tags').value = c.tags || '';
            document.getElementById('fc-difficulty').value = c.difficulty || 'medium';
        });
    }
}

async function saveFlashcard(e) {
    e.preventDefault();
    const data = {
        front: document.getElementById('fc-front').value.trim(),
        back: document.getElementById('fc-back').value.trim(),
        subject_id: document.getElementById('fc-subject').value || null,
        tags: document.getElementById('fc-tags').value.trim() || null,
        difficulty: document.getElementById('fc-difficulty').value,
    };
    try {
        if (editingFlashcardId) await api(`/flashcards/${editingFlashcardId}`, { method: 'PUT', body: JSON.stringify(data) });
        else await api('/flashcards/', { method: 'POST', body: JSON.stringify(data) });
        closeModal();
        showFlashcards();
        toast(editingFlashcardId ? 'Atualizado' : 'Criado', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteFlashcard(id) {
    if (!confirm('Excluir este card e todo o histórico de revisões?')) return;
    try { await api(`/flashcards/${id}`, { method: 'DELETE' }); toast('Excluído', 'success'); showFlashcards(); }
    catch (e) { toast(e.message, 'error'); }
}

// ─────────────────────────────────────────────────────────────
// Review mode (chama via dashboard fallback antigo)
// ─────────────────────────────────────────────────────────────
async function startReview() {
    // Atalho: sem config, pega devidos com defaults
    const due = await api('/flashcards/due').catch(() => []);
    reviewQueue = due;
    reviewIndex = 0;
    window._reviewTimeLimit = 0;
    window._reviewStartedAt = Date.now();
    if (reviewQueue.length === 0) { toast('Nenhum card para revisar.', 'info'); return; }
    showReviewCard();
}

function showReviewCard() {
    // Checar timeout
    if (window._reviewTimeLimit > 0) {
        const elapsed = (Date.now() - window._reviewStartedAt) / 60000;
        if (elapsed >= window._reviewTimeLimit) {
            return showReviewComplete(true);
        }
    }
    if (reviewIndex >= reviewQueue.length) {
        return showReviewComplete(false);
    }

    const card = reviewQueue[reviewIndex];
    const progress = Math.round((reviewIndex / reviewQueue.length) * 100);
    const diff = DIFFICULTY[card.difficulty || 'medium'];

    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-center gap-3 mb-5">
            <button onclick="showFlashcards()" class="btn btn-icon btn-sm"><i class="fa-solid fa-arrow-left text-[10px]"></i></button>
            <div class="flex-1">
                <div class="flex justify-between mb-1.5">
                    <span class="text-[12px]" style="color:var(--text-3)">Card ${reviewIndex+1} de ${reviewQueue.length}</span>
                    <span class="mono text-[11px]" style="color:var(--text-4)" id="review-timer">${window._reviewTimeLimit > 0 ? 'Tempo: ' + window._reviewTimeLimit + 'min' : progress + '%'}</span>
                </div>
                <div class="bar"><div style="width:${progress}%"></div></div>
            </div>
        </div>

        <div class="max-w-2xl mx-auto">
            <div class="flex items-center justify-center gap-2 mb-3">
                ${card.subject_name ? `<span class="badge badge-em-curso">${card.subject_name}</span>` : ''}
                <span class="badge" style="background:${diff.color}1a;color:${diff.color};border-color:${diff.color}40">${diff.label}</span>
            </div>

            <div class="card-scene mb-5" style="height:280px">
                <div class="card-flip" id="review-card" style="height:100%">
                    <div class="card-face front" style="box-shadow: 0 4px 16px rgba(0,0,0,.04);">
                        <p class="text-[10.5px] uppercase tracking-wider mb-4" style="color:var(--text-4); letter-spacing:.12em;">Pergunta</p>
                        <p class="text-[19px] font-medium text-center leading-snug" style="color:var(--text); max-width: 540px;">${card.front}</p>
                    </div>
                    <div class="card-face back" style="box-shadow: 0 4px 16px rgba(0,0,0,.18);">
                        <p class="text-[10.5px] uppercase tracking-wider mb-4" style="color: rgba(255,255,255,.6); letter-spacing:.12em;">Resposta</p>
                        <p class="text-[18px] font-medium text-center leading-snug" style="max-width: 540px;">${card.back}</p>
                    </div>
                </div>
            </div>

            <div class="text-center mb-5">
                <button onclick="flipCard()" class="btn btn-lg" id="btn-flip"><i class="fa-solid fa-rotate text-[11px]"></i> Mostrar resposta</button>
            </div>

            <div id="confidence-section" class="hidden">
                <p class="text-center text-[11px] uppercase tracking-wider mb-3" style="color:var(--text-3); letter-spacing:.1em;">Como foi?</p>
                <div class="grid grid-cols-5 gap-2 max-w-xl mx-auto">
                    ${[
                        {v:1, label:'Errei',    color:'#dc2626'},
                        {v:2, label:'Difícil',  color:'#ea580c'},
                        {v:3, label:'Regular',  color:'#d97706'},
                        {v:4, label:'Boa',      color:'#65a30d'},
                        {v:5, label:'Perfeito', color:'#16a34a'},
                    ].map(opt => `
                    <button onclick="submitReview('${card.id}',${opt.v})" class="text-[12px] font-semibold text-white py-3 px-2 rounded transition-all hover:opacity-90 hover:-translate-y-0.5" style="background:${opt.color}">
                        <span class="block">${opt.label}</span>
                        <span class="text-[10px] mono opacity-70 block mt-0.5">${opt.v}</span>
                    </button>`).join('')}
                </div>
                <p class="text-center text-[11px] mt-3" style="color:var(--text-4)">Tecla 1-5 também funciona</p>
            </div>
        </div>
    </div>`;

    // Bind keyboard shortcuts
    document.onkeydown = (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            const conf = document.getElementById('confidence-section');
            if (conf && conf.classList.contains('hidden')) {
                e.preventDefault();
                flipCard();
            }
        } else if (['1','2','3','4','5'].includes(e.key)) {
            const conf = document.getElementById('confidence-section');
            if (conf && !conf.classList.contains('hidden')) {
                e.preventDefault();
                submitReview(card.id, parseInt(e.key));
            }
        } else if (e.key === 'Escape') {
            document.onkeydown = null;
            showFlashcards();
        }
    };

    // Timer tick if time-limited
    if (window._reviewTimeLimit > 0) {
        clearInterval(window._reviewTimerInt);
        window._reviewTimerInt = setInterval(() => {
            const elapsed = (Date.now() - window._reviewStartedAt) / 1000;
            const remaining = Math.max(0, window._reviewTimeLimit * 60 - elapsed);
            const mm = String(Math.floor(remaining/60)).padStart(2,'0');
            const ss = String(Math.floor(remaining%60)).padStart(2,'0');
            const t = document.getElementById('review-timer');
            if (t) t.textContent = `⏱ ${mm}:${ss}`;
            if (remaining <= 0) {
                clearInterval(window._reviewTimerInt);
                showReviewComplete(true);
            }
        }, 1000);
    }
}

function flipCard() {
    document.getElementById('review-card').classList.add('flipped');
    document.getElementById('confidence-section').classList.remove('hidden');
    document.getElementById('btn-flip').style.display = 'none';
}

async function submitReview(id, confidence) {
    try {
        await api(`/flashcards/${id}/review`, { method: 'POST', body: JSON.stringify({ confidence }) });
        reviewIndex++;
        showReviewCard();
    } catch (e) { toast(e.message, 'error'); }
}

function showReviewComplete(byTimeout) {
    clearInterval(window._reviewTimerInt);
    document.onkeydown = null;
    const reviewed = reviewIndex;
    const total = reviewQueue.length;
    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="card" style="max-width: 480px; margin: 60px auto;">
            <div class="card-body text-center" style="padding: 40px 24px;">
                <i class="fa-solid fa-${byTimeout ? 'clock' : 'circle-check'} text-[32px] mb-3" style="color:var(--${byTimeout ? 'warning' : 'success'})"></i>
                <h2 class="text-[20px] font-semibold mb-2" style="color:var(--text)">${byTimeout ? 'Tempo esgotado' : 'Revisão concluída!'}</h2>
                <p class="text-[13px] mb-1" style="color:var(--text-3)">${reviewed} de ${total} cards revisados</p>
                ${byTimeout && reviewed < total ? `<p class="text-[12px]" style="color:var(--text-4)">Restaram ${total - reviewed} para a próxima sessão.</p>` : ''}
                <div class="flex gap-2 justify-center mt-6">
                    <button onclick="showFlashcards()" class="btn">Voltar</button>
                    <button onclick="openReviewConfigModal()" class="btn btn-accent">Nova sessão</button>
                </div>
            </div>
        </div>
    </div>`;
    loadFlashcardBadge();
}
