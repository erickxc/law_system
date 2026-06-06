/* ═══════════════════════════════════════════════════════════════════════
   books.js — CRUD de livros + reader (grifos e anotações)
   ═══════════════════════════════════════════════════════════════════════ */

const COVER_COLORS = ['#18181b','#2563eb','#dc2626','#16a34a','#d97706','#7c3aed','#0891b2'];

async function showBooks() {
    setActive('menu-livros');
    setPage('Livros', 'Acervo');
    const books = await api('/books/').catch(() => []);
    renderBooks(books);
}

function renderBooks(books) {
    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5">
            <div>
                <h1 class="page-title">Livros</h1>
                <p class="page-sub">${books.length} no acervo</p>
            </div>
            <button onclick="openBookModal()" class="btn btn-primary"><i class="fa-solid fa-plus text-[10px]"></i> Adicionar</button>
        </div>

        ${books.length === 0 ? `<div class="card"><div class="card-body">${emptyState('fa-book-open','Acervo vazio','Adicione PDFs com URL pública.')}</div></div>` :
        `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            ${books.map(b => {
                const color = b.cover_color || '#18181b';
                const pct = b.progress_pct || 0;
                return `
                <div class="group">
                    <div class="cover" style="background: ${color}" onclick="openBookReader('${b.id}')">
                        <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()">
                            <button onclick="openBookModal('${b.id}')" class="text-[10px]" style="width:22px;height:22px;background:rgba(255,255,255,.95);color:var(--text);display:inline-flex;align-items:center;justify-content:center;border-radius:3px">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="deleteBook('${b.id}','${escAttr(b.name)}',event)" class="text-[10px]" style="width:22px;height:22px;background:rgba(255,255,255,.95);color:var(--danger);display:inline-flex;align-items:center;justify-content:center;border-radius:3px">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                        <p class="ttl">${b.name}</p>
                        <div class="meta"><span>${b.current_page}/${b.total_pages}</span><span>${pct}%</span></div>
                    </div>
                    <div class="mt-2">
                        ${b.author ? `<p class="text-[12px] truncate" style="color:var(--text-3)">${b.author}</p>` : '<p class="text-[12px]" style="color:var(--text-5)">—</p>'}
                        <div class="bar mt-1.5"><div style="width:${pct}%"></div></div>
                    </div>
                </div>`;
            }).join('')}
        </div>`}
    </div>`;
}

function openBookModal(id = null) {
    editingBookId = id;
    const subjectOpts = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const colorPicker = COVER_COLORS.map(c => `<button type="button" onclick="selectColor('${c}',this)" data-color="${c}" class="color-btn" style="width:24px;height:24px;background:${c};border:2px solid transparent;border-radius:3px;cursor:pointer;transition:border-color .12s"></button>`).join('');

    openModal(`
    <div class="modal-head"><h3>${id ? 'Editar livro' : 'Adicionar livro'}</h3><button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button></div>
    <form onsubmit="saveBook(event)" class="space-y-3">
        <div><label class="label">Título *</label><input class="input" id="b-name" required></div>
        <div class="grid grid-cols-2 gap-3">
            <div><label class="label">Autor</label><input class="input" id="b-author"></div>
            <div><label class="label">Gênero</label><input class="input" id="b-genre" placeholder="Ex.: Doutrina"></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div><label class="label">Total páginas</label><input type="number" class="input mono" id="b-pages" value="1" min="1"></div>
            <div><label class="label">Página atual</label><input type="number" class="input mono" id="b-curpage" value="0" min="0"></div>
        </div>
        <div><label class="label">URL do PDF</label><input type="url" class="input mono" id="b-url" placeholder="https://..."><p class="help">Link direto para um PDF público.</p></div>
        <div><label class="label">Matéria</label><select class="input" id="b-subject"><option value="">Nenhuma</option>${subjectOpts}</select></div>
        <div><label class="label">Cor da capa</label><div class="flex gap-1.5 flex-wrap mt-1" id="color-picker">${colorPicker}</div><input type="hidden" id="b-color" value="${COVER_COLORS[0]}"></div>
        <div class="flex gap-2 justify-end pt-2">
            <button type="button" onclick="closeModal()" class="btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
    </form>`);

    selectColor(COVER_COLORS[0], document.querySelector('.color-btn'));

    if (id) {
        api(`/books/${id}`).then(b => {
            document.getElementById('b-name').value = b.name;
            document.getElementById('b-author').value = b.author || '';
            document.getElementById('b-genre').value = b.genre || '';
            document.getElementById('b-pages').value = b.total_pages;
            document.getElementById('b-curpage').value = b.current_page;
            document.getElementById('b-url').value = b.url || '';
            document.getElementById('b-subject').value = b.subject_id || '';
            if (b.cover_color) {
                const btn = document.querySelector(`.color-btn[data-color="${b.cover_color}"]`);
                if (btn) selectColor(b.cover_color, btn);
            }
        });
    }
}

function selectColor(color, btn) {
    document.querySelectorAll('.color-btn').forEach(b => b.style.borderColor = 'transparent');
    btn.style.borderColor = 'var(--accent)';
    document.getElementById('b-color').value = color;
}

async function saveBook(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('b-name').value.trim(),
        author: document.getElementById('b-author').value.trim() || null,
        genre: document.getElementById('b-genre').value.trim() || null,
        total_pages: parseInt(document.getElementById('b-pages').value) || 1,
        current_page: parseInt(document.getElementById('b-curpage').value) || 0,
        url: document.getElementById('b-url').value.trim() || null,
        subject_id: document.getElementById('b-subject').value || null,
        cover_color: document.getElementById('b-color').value,
    };
    try {
        if (editingBookId) await api(`/books/${editingBookId}`, { method: 'PUT', body: JSON.stringify(data) });
        else await api('/books/', { method: 'POST', body: JSON.stringify(data) });
        closeModal();
        showBooks();
        toast(editingBookId ? 'Livro atualizado' : 'Livro adicionado', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteBook(id, name, ev) {
    ev.stopPropagation();
    if (!confirm(`Excluir "${name}"? Grifos e anotações serão removidos.`)) return;
    try {
        await api(`/books/${id}`, { method: 'DELETE' });
        showBooks();
        toast('Livro excluído', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

async function openBookReader(bookId) {
    currentBookId = bookId;
    const book = await api(`/books/${bookId}`).catch(() => null);
    if (!book) { toast('Livro não encontrado.', 'error'); return; }
    setActive('menu-livros');
    setPage(book.name, 'Acervo');

    const [annotations, highlights] = await Promise.all([
        api(`/books/${bookId}/annotations`).catch(() => []),
        api(`/books/${bookId}/highlights`).catch(() => []),
    ]);

    const hlColors = { yellow:'#fef08a', green:'#bbf7d0', blue:'#bfdbfe', pink:'#fbcfe8' };

    document.getElementById('mainContent').innerHTML = `
    <div class="h-full flex flex-col">
        <div class="topbar" style="border-top: none">
            <div class="flex items-center gap-3">
                <button onclick="showBooks()" class="btn btn-icon btn-sm"><i class="fa-solid fa-arrow-left text-[10px]"></i></button>
                <div>
                    <p class="text-[13px] font-medium" style="color:var(--text)">${book.name}</p>
                    <p class="text-[11px] mono" style="color:var(--text-4)">pg. ${book.current_page}/${book.total_pages} · ${book.progress_pct}%</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <div class="bar" style="width: 240px"><div style="width:${book.progress_pct}%"></div></div>
                <button onclick="openBookModal('${bookId}')" class="btn btn-icon btn-sm"><i class="fa-solid fa-gear text-[10px]"></i></button>
            </div>
        </div>

        <div class="flex gap-3 flex-1 min-h-0 p-3">
            <div class="card flex-1 flex flex-col overflow-hidden">
                ${book.url ? `
                <iframe src="${book.url}" class="flex-1" style="border:none;background:white"></iframe>` :
                `<div class="card-body flex-1 flex items-center justify-center">${emptyState('fa-link','PDF não vinculado','Edite o livro e cole a URL.')}</div>`}
            </div>

            <div class="w-80 flex-shrink-0 flex flex-col gap-3">
                <div class="card">
                    <div class="card-header"><span class="card-title">Página atual</span></div>
                    <div class="card-body flex items-center gap-2">
                        <input type="number" id="book-page-input" value="${book.current_page}" min="0" max="${book.total_pages}" class="input mono text-center" style="width:80px">
                        <span class="text-[12px] mono" style="color:var(--text-4)">/ ${book.total_pages}</span>
                        <button onclick="saveBookPage('${bookId}')" class="btn btn-primary btn-sm ml-auto">Salvar</button>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><span class="card-title">Adicionar grifo</span></div>
                    <div class="card-body space-y-2">
                        <textarea id="hl-text" rows="2" class="input" placeholder="Texto grifado…"></textarea>
                        <div class="flex items-center gap-2">
                            <input type="number" id="hl-page" value="${book.current_page}" min="1" max="${book.total_pages}" class="input mono" style="width:64px">
                            <select id="hl-color" class="input flex-1">
                                <option value="yellow">Amarelo</option>
                                <option value="green">Verde</option>
                                <option value="blue">Azul</option>
                                <option value="pink">Rosa</option>
                            </select>
                            <button onclick="addHighlight('${bookId}')" class="btn btn-primary btn-sm">Grifar</button>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><span class="card-title">Anotação</span></div>
                    <div class="card-body space-y-2">
                        <textarea id="ann-text" rows="3" class="input" placeholder="Sua anotação…"></textarea>
                        <div class="flex items-center gap-2">
                            <input type="number" id="ann-page" value="${book.current_page}" min="1" max="${book.total_pages}" class="input mono" style="width:64px">
                            <button onclick="addAnnotation('${bookId}')" class="btn btn-primary btn-sm ml-auto">Salvar</button>
                        </div>
                    </div>
                </div>

                <div class="card flex-1 overflow-y-auto no-scrollbar">
                    <div class="card-header"><span class="card-title">Salvos</span><span class="card-sub ml-auto">${annotations.length + highlights.length}</span></div>
                    <div class="card-body space-y-2">
                        ${[...highlights.map(h => ({...h,type:'highlight'})), ...annotations.map(a => ({...a,type:'annotation'}))]
                            .sort((a,b) => a.page_number - b.page_number).map(item => {
                            const isHL = item.type === 'highlight';
                            const c = isHL ? (hlColors[item.color] || '#fef08a') : '#e4e4e7';
                            return `<div id="item-${item.id}" class="p-2.5" style="background:var(--bg-2); border-left:2px solid ${c}; border-radius: 0 3px 3px 0;">
                                <div class="flex items-center justify-between mb-1">
                                    <span class="text-[10px] mono uppercase" style="color:var(--text-4); letter-spacing:.04em;">${isHL ? 'GRIFO' : 'NOTA'} · pg.${item.page_number}</span>
                                    <button onclick="deleteNote('${item.id}','${isHL ? 'highlight' : 'annotation'}')" style="color:var(--text-5)"><i class="fa-solid fa-xmark text-[10px]"></i></button>
                                </div>
                                <p class="text-[12px]" style="color:var(--text)">${isHL ? item.selected_text : item.note_text}</p>
                            </div>`;
                        }).join('') || `<p class="text-[12px]" style="color:var(--text-4)">Nenhum grifo ou anotação.</p>`}
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

async function saveBookPage(bookId) {
    const page = parseInt(document.getElementById('book-page-input').value);
    try { await api(`/books/${bookId}`, { method: 'PUT', body: JSON.stringify({ current_page: page }) }); toast('Progresso salvo', 'success'); }
    catch (e) { toast(e.message, 'error'); }
}

async function addHighlight(bookId) {
    const text = document.getElementById('hl-text').value.trim();
    const page = parseInt(document.getElementById('hl-page').value);
    const color = document.getElementById('hl-color').value;
    if (!text) { toast('Digite o trecho.', 'warning'); return; }
    try {
        await api(`/books/${bookId}/highlights`, { method: 'POST', body: JSON.stringify({ page_number: page, selected_text: text, color }) });
        toast('Grifo salvo', 'success');
        openBookReader(bookId);
    } catch (e) { toast(e.message, 'error'); }
}

async function addAnnotation(bookId) {
    const text = document.getElementById('ann-text').value.trim();
    const page = parseInt(document.getElementById('ann-page').value);
    if (!text) { toast('Digite a anotação.', 'warning'); return; }
    try {
        await api(`/books/${bookId}/annotations`, { method: 'POST', body: JSON.stringify({ page_number: page, note_text: text }) });
        toast('Anotação salva', 'success');
        openBookReader(bookId);
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteNote(id, type) {
    try {
        const path = type === 'highlight' ? `/books/highlights/${id}` : `/books/annotations/${id}`;
        await api(path, { method: 'DELETE' });
        document.getElementById(`item-${id}`)?.remove();
        toast('Removido', 'success');
    } catch (e) { toast(e.message, 'error'); }
}
