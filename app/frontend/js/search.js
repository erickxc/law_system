/* ═══════════════════════════════════════════════════════════════════════
   search.js — Busca global (Cmd+K / Ctrl+K)
   Pesquisa client-side em subjects, books, flashcards, calendar events
   ═══════════════════════════════════════════════════════════════════════ */

let _searchData = null;       // cache
let _searchSelected = 0;

function openSearch() {
    if (document.getElementById('search-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'search-overlay';
    overlay.className = 'search-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeSearch(); };
    overlay.innerHTML = `
        <div class="search-box">
            <div class="search-input-wrap">
                <i class="fa-solid fa-magnifying-glass text-[14px]" style="color:var(--text-4)"></i>
                <input type="text" id="search-input" class="search-input" placeholder="Buscar matérias, livros, cards, eventos…" autofocus>
                <span class="search-shortcut">ESC</span>
            </div>
            <div class="search-results" id="search-results">
                <div class="search-empty">Carregando dados…</div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    _searchSelected = 0;

    const input = document.getElementById('search-input');
    input.addEventListener('input', () => runSearch(input.value));
    input.addEventListener('keydown', handleSearchKey);

    // Carregar dados se ainda não cacheados
    loadSearchData().then(() => runSearch(''));
}

function closeSearch() {
    document.getElementById('search-overlay')?.remove();
}

async function loadSearchData() {
    if (_searchData) return _searchData;
    try {
        const [subj, books, flashcards, events] = await Promise.all([
            api('/subjects/').catch(() => []),
            api('/books/').catch(() => []),
            api('/flashcards/').catch(() => []),
            api('/calendar/events').catch(() => []),
        ]);
        _searchData = { subjects: subj, books, flashcards, events };
    } catch { _searchData = { subjects: [], books: [], flashcards: [], events: [] }; }
    return _searchData;
}

let _searchDebounce = null;

async function runSearch(query) {
    const q = query.trim();
    const data = _searchData || { subjects: [], books: [], flashcards: [], events: [] };
    const groups = [];

    if (!q) {
        // Mostra atalhos rápidos
        const shortcuts = [
            { icon: 'fa-gauge-high', title: 'Dashboard',    action: () => { closeSearch(); showDashboard(); } },
            { icon: 'fa-book-bookmark', title: 'Matérias',  action: () => { closeSearch(); showSubjects(); } },
            { icon: 'fa-book-open',  title: 'Livros',       action: () => { closeSearch(); showBooks(); } },
            { icon: 'fa-layer-group', title: 'Flashcards',  action: () => { closeSearch(); showFlashcards(); } },
            { icon: 'fa-stopwatch',  title: 'Nova sessão',  action: () => { closeSearch(); showSessions(); } },
            { icon: 'fa-calendar-days', title: 'Calendário', action: () => { closeSearch(); showCalendar(); } },
            { icon: 'fa-calendar-week', title: 'Horário',   action: () => { closeSearch(); showSchedule(); } },
            { icon: 'fa-clock-rotate-left', title: 'Histórico', action: () => { closeSearch(); showHistory(); } },
            { icon: 'fa-user',       title: 'Perfil',       action: () => { closeSearch(); showProfile(); } },
        ];
        groups.push({ label: 'Navegar', items: shortcuts.map(s => ({ ...s, meta: 'Página' })) });
    } else if (q.length >= 2) {
        // Busca FTS unificada no servidor (com debounce)
        clearTimeout(_searchDebounce);
        _searchDebounce = setTimeout(() => runServerSearch(q), 220);
        return;
    } else {
        const container = document.getElementById('search-results');
        if (container) container.innerHTML = `<div class="search-empty">Digite ao menos 2 caracteres…</div>`;
        return;
    }

    _searchSelected = 0;
    const container = document.getElementById('search-results');
    if (!container) return;

    if (groups.length === 0) {
        container.innerHTML = `<div class="search-empty"><i class="fa-solid fa-magnifying-glass mb-2 text-[20px]" style="color:var(--text-5)"></i><p>Nada encontrado para "<strong>${esc(q)}</strong>"</p></div>`;
        return;
    }

    let html = '';
    let flatIdx = 0;
    const flatItems = [];
    for (const g of groups) {
        html += `<div class="search-section-label">${g.label}</div>`;
        for (const item of g.items) {
            html += `<div class="search-result ${flatIdx === 0 ? 'is-selected' : ''}" data-idx="${flatIdx}" onclick="executeSearchItem(${flatIdx})">
                <div class="search-result-icon"><i class="fa-solid ${item.icon}"></i></div>
                <div class="search-result-content">
                    <div class="search-result-title">${esc(item.title)}</div>
                    <div class="search-result-meta">${esc(item.meta)}</div>
                </div>
            </div>`;
            flatItems.push(item);
            flatIdx++;
        }
    }
    container.innerHTML = html;
    window._searchFlatItems = flatItems;
}

function executeSearchItem(idx) {
    const items = window._searchFlatItems || [];
    if (items[idx]) items[idx].action();
}

function handleSearchKey(e) {
    const items = window._searchFlatItems || [];
    if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        _searchSelected = Math.min(items.length - 1, _searchSelected + 1);
        updateSearchSelected();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _searchSelected = Math.max(0, _searchSelected - 1);
        updateSearchSelected();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[_searchSelected]) items[_searchSelected].action();
    }
}

function updateSearchSelected() {
    document.querySelectorAll('.search-result').forEach((el, i) => {
        el.classList.toggle('is-selected', i === _searchSelected);
        if (i === _searchSelected) el.scrollIntoView({ block: 'nearest' });
    });
}

// Hook global Cmd+K / Ctrl+K
document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (document.getElementById('search-overlay')) closeSearch();
        else openSearch();
    }
});

// Invalidar cache quando alguma operação CRUD acontece (helper)
function invalidateSearchCache() { _searchData = null; }

// ─── Busca FTS server-side via /search ──────────────────────────────────
async function runServerSearch(q) {
    const container = document.getElementById('search-results');
    if (!container) return;
    container.innerHTML = `<div class="search-empty"><i class="fa-solid fa-circle-notch fa-spin mb-1"></i> Buscando…</div>`;
    try {
        const r = await api(`/search/?q=${encodeURIComponent(q)}&limit=8`);
        const groups = [];

        if (r.subjects?.length) groups.push({
            label: 'Matérias',
            items: r.subjects.map(s => ({
                icon: 'fa-book-bookmark', title: s.name,
                meta: `Matéria${s.sigla ? ' · ' + s.sigla : ''} · ${s.status}`,
                action: () => { closeSearch(); showSubjects(); }
            }))
        });
        if (r.books?.length) groups.push({
            label: 'Livros',
            items: r.books.map(b => ({
                icon: 'fa-book-open', title: b.name,
                meta: `Livro${b.author ? ' · ' + b.author : ''} · ${b.current_page}/${b.total_pages}`,
                action: () => { closeSearch(); openBookReader(b.id); }
            }))
        });
        if (r.notes?.length) groups.push({
            label: 'Notas',
            items: r.notes.map(n => ({
                icon: 'fa-pen-to-square', title: n.title,
                meta: `Nota · ${n.kind} · ${n.preview.slice(0, 80)}`,
                action: () => { closeSearch(); openNoteEditor(n.id); }
            }))
        });
        if (r.flashcards?.length) groups.push({
            label: 'Flashcards',
            items: r.flashcards.map(c => ({
                icon: 'fa-layer-group', title: c.front.length > 60 ? c.front.slice(0, 60) + '…' : c.front,
                meta: `Flashcard${c.tags ? ' · ' + c.tags : ''}`,
                action: () => { closeSearch(); showFlashcards(); }
            }))
        });
        if (r.highlights?.length) groups.push({
            label: 'Grifos',
            items: r.highlights.map(h => ({
                icon: 'fa-highlighter', title: h.selected_text.slice(0, 80),
                meta: `Grifo · ${h.book_name || ''} · pg. ${h.page_number}`,
                action: () => { closeSearch(); if (h.book_id) openBookReader(h.book_id); }
            }))
        });
        if (r.annotations?.length) groups.push({
            label: 'Anotações',
            items: r.annotations.map(a => ({
                icon: 'fa-note-sticky', title: a.note_text.slice(0, 80) || a.tag || '(etiqueta)',
                meta: `Anotação · ${a.book_name || ''} · pg. ${a.page_number}`,
                action: () => { closeSearch(); if (a.book_id) openBookReader(a.book_id); }
            }))
        });

        if (groups.length === 0) {
            container.innerHTML = `<div class="search-empty"><i class="fa-solid fa-magnifying-glass mb-2 text-[20px]" style="color:var(--text-5)"></i><p>Nada encontrado para "<strong>${esc(q)}</strong>"</p></div>`;
            return;
        }

        _searchSelected = 0;
        let html = '';
        let flatIdx = 0;
        const flatItems = [];
        for (const g of groups) {
            html += `<div class="search-section-label">${g.label}</div>`;
            for (const item of g.items) {
                html += `<div class="search-result ${flatIdx === 0 ? 'is-selected' : ''}" data-idx="${flatIdx}" onclick="executeSearchItem(${flatIdx})">
                    <div class="search-result-icon"><i class="fa-solid ${item.icon}"></i></div>
                    <div class="search-result-content">
                        <div class="search-result-title">${esc(item.title)}</div>
                        <div class="search-result-meta">${esc(item.meta)}</div>
                    </div>
                </div>`;
                flatItems.push(item);
                flatIdx++;
            }
        }
        container.innerHTML = html;
        window._searchFlatItems = flatItems;
    } catch (e) {
        container.innerHTML = `<div class="search-empty">Erro na busca: ${esc(e.message)}</div>`;
    }
}
