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

function runSearch(query) {
    const q = query.trim().toLowerCase();
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
    } else {
        // Matérias
        const sm = data.subjects.filter(s => s.name.toLowerCase().includes(q)).slice(0, 5)
            .map(s => ({
                icon: 'fa-book-bookmark',
                title: s.name,
                meta: `Matéria · ${s.period}º período · ${s.status}`,
                action: () => { closeSearch(); showSubjects(); }
            }));
        if (sm.length) groups.push({ label: 'Matérias', items: sm });

        // Livros
        const bm = data.books.filter(b => b.name.toLowerCase().includes(q) || (b.author||'').toLowerCase().includes(q)).slice(0, 5)
            .map(b => ({
                icon: 'fa-book-open',
                title: b.name,
                meta: `Livro · ${b.author || 'sem autor'}`,
                action: () => { closeSearch(); openBookReader(b.id); }
            }));
        if (bm.length) groups.push({ label: 'Livros', items: bm });

        // Flashcards
        const fm = data.flashcards.filter(c =>
            c.front.toLowerCase().includes(q) ||
            c.back.toLowerCase().includes(q) ||
            (c.tags||'').toLowerCase().includes(q)
        ).slice(0, 7).map(c => ({
            icon: 'fa-layer-group',
            title: c.front.length > 60 ? c.front.slice(0, 60) + '…' : c.front,
            meta: `Flashcard${c.subject_name ? ' · ' + c.subject_name : ''}`,
            action: () => { closeSearch(); showFlashcards(); }
        }));
        if (fm.length) groups.push({ label: 'Flashcards', items: fm });

        // Eventos
        const em = data.events.filter(e => e.title.toLowerCase().includes(q)).slice(0, 5)
            .map(e => ({
                icon: 'fa-calendar-day',
                title: e.title,
                meta: `${e.event_type} · ${fmtShortDate(e.start_at)} ${e.start_at.slice(11,16)}`,
                action: () => { closeSearch(); showCalendar(); }
            }));
        if (em.length) groups.push({ label: 'Calendário', items: em });
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
