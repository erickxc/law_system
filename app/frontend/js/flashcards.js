/* ═══════════════════════════════════════════════════════════════════════
   flashcards.js — CRUD de cards + review mode (SM-2)
   ═══════════════════════════════════════════════════════════════════════ */

async function showFlashcards() {
    setActive('menu-flashcards');
    setPage('Flashcards', 'Estudo');
    const [cards, stats] = await Promise.all([api('/flashcards/').catch(() => []), api('/flashcards/stats').catch(() => null)]);
    renderFlashcards(cards, stats);
}

function renderFlashcards(cards, stats) {
    const due = cards.filter(c => c.is_due);
    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5">
            <div>
                <h1 class="page-title">Flashcards</h1>
                <p class="page-sub">Revisão espaçada (SM-2)</p>
            </div>
            <div class="flex gap-2">
                ${due.length > 0 ? `<button onclick="startReview()" class="btn btn-accent"><i class="fa-solid fa-play text-[10px]"></i> Revisar ${due.length}</button>` : ''}
                <button onclick="openFlashcardModal()" class="btn btn-primary"><i class="fa-solid fa-plus text-[10px]"></i> Novo</button>
            </div>
        </div>

        ${stats ? `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            ${kpi('Total', stats.total_cards, 'fa-layer-group')}
            ${kpi('A revisar hoje', stats.due_today, 'fa-clock')}
            ${kpi('Revisões', stats.total_reviews, 'fa-repeat')}
            ${kpi('Acerto geral', stats.overall_accuracy_pct != null ? stats.overall_accuracy_pct : '—', 'fa-bullseye', stats.overall_accuracy_pct != null ? '%' : '')}
        </div>` : ''}

        <div class="tab-bar">
            <button id="tab-all" onclick="filterCards('all')" class="tab-btn active">Todos · ${cards.length}</button>
            <button id="tab-due" onclick="filterCards('due')" class="tab-btn">A revisar · ${due.length}</button>
        </div>

        <div id="fc-list">${renderCardList(cards)}</div>
    </div>`;

    window._fcAll = cards;
    window._fcDue = due;
}

function filterCards(type) {
    document.getElementById('tab-all').classList.toggle('active', type==='all');
    document.getElementById('tab-due').classList.toggle('active', type==='due');
    document.getElementById('fc-list').innerHTML = renderCardList(type==='all' ? window._fcAll : window._fcDue);
}

function renderCardList(cards) {
    if (cards.length === 0) return `<div class="card"><div class="card-body">${emptyState('fa-layer-group','Nenhum flashcard','Crie cards para revisar com repetição espaçada.')}</div></div>`;
    return `<div class="card">
        <table class="tbl">
            <thead><tr><th style="width:32px">#</th><th>Pergunta</th><th>Matéria</th><th>Tags</th><th style="width:80px" class="text-right">Acerto</th><th style="width:60px" class="text-right">Rev.</th><th style="width:90px" class="actions">Ações</th></tr></thead>
            <tbody>
                ${cards.map((c, i) => `
                <tr class="${c.is_due ? 'is-due' : ''}">
                    <td class="id">${String(i+1).padStart(2,'0')}</td>
                    <td><div style="max-width:480px"><p style="color:var(--text); font-weight: 500;">${c.front}</p><p class="text-[11.5px] mt-0.5 truncate" style="color:var(--text-4)">${c.back}</p></div></td>
                    <td><span class="text-[11.5px]" style="color:var(--text-3)">${c.subject_name || '—'}</span></td>
                    <td><span class="mono text-[10.5px]" style="color:var(--text-4)">${c.tags ? c.tags.split(',').map(t => '#'+t.trim()).join(' ') : '—'}</span></td>
                    <td class="num text-right">${c.accuracy_pct != null ? c.accuracy_pct + '%' : '—'}</td>
                    <td class="num text-right" style="color:var(--text-3)">${c.total_reviews}</td>
                    <td class="actions">
                        <button onclick="openFlashcardModal('${c.id}')" class="btn btn-icon btn-sm"><i class="fa-solid fa-pen text-[10px]"></i></button>
                        <button onclick="deleteFlashcard('${c.id}')" class="btn btn-icon btn-sm"><i class="fa-solid fa-trash text-[10px]"></i></button>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>`;
}

function openFlashcardModal(id = null) {
    editingFlashcardId = id;
    const subjectOpts = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    openModal(`
    <div class="modal-head"><h3>${id ? 'Editar flashcard' : 'Novo flashcard'}</h3><button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button></div>
    <form onsubmit="saveFlashcard(event)" class="space-y-3">
        <div><label class="label">Pergunta *</label><textarea id="fc-front" rows="3" class="input" required placeholder="O que é…? Defina…"></textarea></div>
        <div><label class="label">Resposta *</label><textarea id="fc-back" rows="3" class="input" required placeholder="A resposta…"></textarea></div>
        <div class="grid grid-cols-2 gap-3">
            <div><label class="label">Matéria</label><select class="input" id="fc-subject"><option value="">Nenhuma</option>${subjectOpts}</select></div>
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

// ─── Review mode ─────────────────────────────────────────────────────────
async function startReview() {
    const due = await api('/flashcards/due').catch(() => []);
    reviewQueue = due;
    reviewIndex = 0;
    if (reviewQueue.length === 0) { toast('Nenhum card para revisar.', 'info'); return; }
    showReviewCard();
}

function showReviewCard() {
    if (reviewIndex >= reviewQueue.length) {
        document.getElementById('mainContent').innerHTML = `
        <div class="page-shell">
            <div class="card" style="max-width: 480px; margin: 60px auto;">
                <div class="card-body text-center" style="padding: 40px 20px;">
                    <i class="fa-solid fa-circle-check text-[28px] mb-3" style="color:var(--success)"></i>
                    <h2 class="text-[18px] font-semibold mb-1" style="color:var(--text)">Revisão concluída</h2>
                    <p class="text-[12.5px] mb-5" style="color:var(--text-4)">${reviewQueue.length} card${reviewQueue.length>1?'s':''} revisado${reviewQueue.length>1?'s':''}.</p>
                    <button onclick="showFlashcards()" class="btn btn-primary">Voltar →</button>
                </div>
            </div>
        </div>`;
        loadFlashcardBadge();
        return;
    }

    const card = reviewQueue[reviewIndex];
    const progress = Math.round((reviewIndex / reviewQueue.length) * 100);

    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-center gap-3 mb-5">
            <button onclick="showFlashcards()" class="btn btn-icon btn-sm"><i class="fa-solid fa-arrow-left text-[10px]"></i></button>
            <div class="flex-1">
                <div class="flex justify-between mb-1.5"><span class="text-[12px]" style="color:var(--text-3)">Card ${reviewIndex+1} / ${reviewQueue.length}</span><span class="mono text-[11px]" style="color:var(--text-4)">${progress}%</span></div>
                <div class="bar"><div style="width:${progress}%"></div></div>
            </div>
        </div>

        <div class="max-w-2xl mx-auto">
            ${card.subject_name ? `<p class="text-center text-[11px] uppercase tracking-wider mb-3" style="color:var(--text-4); letter-spacing:.08em;">${card.subject_name}</p>` : ''}

            <div class="card-scene mb-5" style="height:260px">
                <div class="card-flip" id="review-card" style="height:100%">
                    <div class="card-face front">
                        <p class="text-[11px] uppercase tracking-wider mb-4" style="color:var(--text-4); letter-spacing:.1em;">Pergunta</p>
                        <p class="text-[18px] font-medium text-center leading-snug" style="color:var(--text); max-width: 520px;">${card.front}</p>
                    </div>
                    <div class="card-face back">
                        <p class="text-[11px] uppercase tracking-wider mb-4" style="color: rgba(255,255,255,.6); letter-spacing:.1em;">Resposta</p>
                        <p class="text-[17px] font-medium text-center leading-snug" style="max-width: 520px;">${card.back}</p>
                    </div>
                </div>
            </div>

            <div class="text-center mb-5">
                <button onclick="flipCard()" class="btn"><i class="fa-solid fa-rotate text-[10px]"></i> Virar (mostrar resposta)</button>
            </div>

            <div id="confidence-section" class="hidden">
                <p class="text-center text-[11px] uppercase tracking-wider mb-3" style="color:var(--text-3); letter-spacing:.1em;">Como foi?</p>
                <div class="grid grid-cols-5 gap-2 max-w-xl mx-auto">
                    ${[
                        {v:1, label:'Nada',     color:'#dc2626'},
                        {v:2, label:'Pouco',    color:'#ea580c'},
                        {v:3, label:'Regular',  color:'#d97706'},
                        {v:4, label:'Bem',      color:'#65a30d'},
                        {v:5, label:'Perfeito', color:'#16a34a'},
                    ].map(opt => `
                    <button onclick="submitReview('${card.id}',${opt.v})" class="text-[11.5px] font-medium text-white py-2.5 px-2 rounded transition-opacity hover:opacity-90" style="background:${opt.color}">
                        ${opt.label}<br><span class="text-[10px] mono opacity-70">${opt.v}</span>
                    </button>`).join('')}
                </div>
            </div>
        </div>
    </div>`;
}

function flipCard() {
    document.getElementById('review-card').classList.add('flipped');
    document.getElementById('confidence-section').classList.remove('hidden');
}

async function submitReview(id, confidence) {
    try {
        await api(`/flashcards/${id}/review`, { method: 'POST', body: JSON.stringify({ confidence }) });
        reviewIndex++;
        showReviewCard();
    } catch (e) { toast(e.message, 'error'); }
}
