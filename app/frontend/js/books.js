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

// ─────────────────────────────────────────────────────────────
// PDF Reader com PDF.js + popover suspenso ao selecionar texto
// ─────────────────────────────────────────────────────────────

const PDFJS_URL  = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';
const PDFJS_WORK = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
let _pdfjs = null;
let _pdfDoc = null;
let _currentBook = null;
let _readerHighlights = [];
let _readerAnnotations = [];
let _renderedPage = null;

async function loadPdfJs() {
    if (_pdfjs) return _pdfjs;
    _pdfjs = await import(PDFJS_URL);
    _pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORK;
    return _pdfjs;
}

async function openBookReader(bookId) {
    currentBookId = bookId;
    const book = await api(`/books/${bookId}`).catch(() => null);
    if (!book) { toast('Livro não encontrado.', 'error'); return; }
    _currentBook = book;
    setActive('menu-livros');
    setPage(book.name, 'Acervo');

    const [annotations, highlights] = await Promise.all([
        api(`/books/${bookId}/annotations`).catch(() => []),
        api(`/books/${bookId}/highlights`).catch(() => []),
    ]);
    _readerAnnotations = annotations;
    _readerHighlights = highlights;

    document.getElementById('mainContent').innerHTML = `
    <div class="h-full flex flex-col" style="background: #f4f4f5;">
        <div class="topbar" style="border-top: none;">
            <div class="flex items-center gap-3">
                <button onclick="showBooks()" class="btn btn-icon btn-sm"><i class="fa-solid fa-arrow-left text-[10px]"></i></button>
                <div>
                    <p class="text-[13px] font-medium" style="color:var(--text)">${book.name}</p>
                    <p class="text-[11px] mono" id="page-status" style="color:var(--text-4)">pg. ${book.current_page}/${book.total_pages} · ${book.progress_pct}%</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="readerPrevPage()" class="btn btn-icon btn-sm"><i class="fa-solid fa-chevron-left text-[10px]"></i></button>
                <input type="number" id="reader-page-input" value="${book.current_page || 1}" min="1" max="${book.total_pages}" class="input mono text-center" style="width:70px; padding:4px 8px;" onchange="readerGoToPage(parseInt(this.value))">
                <span class="text-[11px] mono" style="color:var(--text-4)">/ ${book.total_pages}</span>
                <button onclick="readerNextPage()" class="btn btn-icon btn-sm"><i class="fa-solid fa-chevron-right text-[10px]"></i></button>
                <span style="width:1px; height:20px; background:var(--border); margin: 0 6px;"></span>
                <button onclick="readerZoom(-0.2)" class="btn btn-icon btn-sm" title="Reduzir"><i class="fa-solid fa-minus text-[10px]"></i></button>
                <span id="reader-zoom" class="mono text-[11px]" style="color:var(--text-3); width:36px; text-align:center;">100%</span>
                <button onclick="readerZoom(0.2)" class="btn btn-icon btn-sm" title="Ampliar"><i class="fa-solid fa-plus text-[10px]"></i></button>
                <span style="width:1px; height:20px; background:var(--border); margin: 0 6px;"></span>
                <button onclick="toggleNotesPanel()" class="btn btn-sm" id="btn-notes-toggle"><i class="fa-solid fa-bookmark text-[10px]"></i> Notas (<span id="notes-count">${highlights.length + annotations.length}</span>)</button>
            </div>
        </div>

        ${!book.url ? `
        <div class="flex-1 flex items-center justify-center">${emptyState('fa-link', 'PDF não vinculado', 'Edite o livro e cole a URL pública de um PDF.')}</div>
        ` : `
        <div class="flex-1 min-h-0 flex" style="overflow: hidden;">
            <!-- Coluna do PDF -->
            <div class="flex-1 overflow-auto" id="pdf-scroll" style="background: #f4f4f5; position: relative;">
                <div id="pdf-container" style="display: flex; flex-direction: column; align-items: center; padding: 16px; gap: 16px;">
                    <div class="flex items-center justify-center" style="height: 200px;">
                        <i class="fa-solid fa-circle-notch fa-spin text-[24px]" style="color:var(--text-4)"></i>
                    </div>
                </div>
            </div>

            <!-- Popover de seleção (criado dinamicamente) -->
            <div id="selection-popover" style="position: absolute; display: none; z-index: 200; background: var(--text); color: white; padding: 6px; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,.25);">
                <div class="flex items-center gap-1.5">
                    <button onclick="hlFromSelection('yellow')" class="popover-color" title="Amarelo" style="background:#fde047"></button>
                    <button onclick="hlFromSelection('green')"  class="popover-color" title="Verde"   style="background:#86efac"></button>
                    <button onclick="hlFromSelection('blue')"   class="popover-color" title="Azul"    style="background:#93c5fd"></button>
                    <button onclick="hlFromSelection('pink')"   class="popover-color" title="Rosa"    style="background:#f9a8d4"></button>
                    <span style="width:1px;height:18px;background:rgba(255,255,255,.2);margin:0 2px;"></span>
                    <button onclick="annotateFromSelection()" class="text-[11px] px-2 py-1 hover:bg-white/10 rounded flex items-center gap-1.5" style="color:white"><i class="fa-solid fa-note-sticky text-[10px]"></i> Anotar</button>
                    <button onclick="copySelection()" class="text-[11px] px-2 py-1 hover:bg-white/10 rounded" style="color:white" title="Copiar"><i class="fa-solid fa-copy text-[10px]"></i></button>
                </div>
            </div>

            <!-- Painel de notas (toggle) -->
            <div id="notes-panel" class="hidden flex-shrink-0" style="width: 320px; background: var(--surface); border-left: 1px solid var(--border); overflow-y: auto;">
                <div class="card-header" style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                    <span class="card-title">Grifos e anotações</span>
                    <button onclick="toggleNotesPanel()" class="ml-auto btn btn-icon btn-sm"><i class="fa-solid fa-xmark text-[10px]"></i></button>
                </div>
                <div id="notes-list" class="p-3 space-y-2"></div>
            </div>
        </div>
        `}
    </div>

    <style>
        .popover-color { width: 22px; height: 22px; border-radius: 3px; border: 1px solid rgba(255,255,255,.2); cursor: pointer; transition: transform .12s; }
        .popover-color:hover { transform: scale(1.15); }
        .pdf-page-wrap { position: relative; background: white; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
        .pdf-textLayer { position: absolute; left: 0; top: 0; right: 0; bottom: 0; overflow: hidden; opacity: 0.2; line-height: 1.0; user-select: text; }
        .pdf-textLayer > span, .pdf-textLayer > br { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0% 0%; }
        .pdf-textLayer ::selection { background: rgba(0, 100, 255, 0.3); }
        .hl-overlay { position: absolute; pointer-events: none; mix-blend-mode: multiply; }
        .hl-yellow { background: rgba(253, 224, 71, 0.4); }
        .hl-green  { background: rgba(134, 239, 172, 0.4); }
        .hl-blue   { background: rgba(147, 197, 253, 0.4); }
        .hl-pink   { background: rgba(249, 168, 212, 0.4); }
        .note-pin { position: absolute; width: 20px; height: 20px; background: var(--warning); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,.2); }
    </style>`;

    if (book.url) {
        await renderReader(book);
    }
}

async function renderReader(book) {
    try {
        const pdfjs = await loadPdfJs();
        _pdfDoc = await pdfjs.getDocument({ url: book.url, cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/cmaps/', cMapPacked: true }).promise;

        // Ajustar total_pages se diferir
        if (_pdfDoc.numPages !== book.total_pages) {
            await api(`/books/${book.id}`, { method: 'PUT', body: JSON.stringify({ total_pages: _pdfDoc.numPages }) });
            book.total_pages = _pdfDoc.numPages;
            const inp = document.getElementById('reader-page-input');
            if (inp) inp.max = book.total_pages;
        }

        // Renderizar a página inicial
        await readerGoToPage(book.current_page || 1);

        // Bind selection listener
        const container = document.getElementById('pdf-container');
        if (container) {
            container.addEventListener('mouseup', handleSelectionEnd);
        }
        document.addEventListener('mousedown', maybeClosePopover);
    } catch (e) {
        console.error(e);
        document.getElementById('pdf-container').innerHTML = `
            <div class="card" style="max-width: 480px;"><div class="card-body">
                ${emptyState('fa-triangle-exclamation', 'Não consegui carregar o PDF', 'Verifique se a URL é pública e acessível (CORS).')}
                <p class="text-[11px] mono mt-3 p-2" style="background:var(--bg-2); color:var(--text-4); border-radius:3px;">${e.message || e}</p>
                <p class="text-[12px] mt-3" style="color:var(--text-4)"><a href="${_currentBook.url}" target="_blank" style="color:var(--accent)">Abrir PDF em nova aba ↗</a></p>
            </div></div>`;
    }
}

let _readerScale = 1.2;

function readerZoom(delta) {
    _readerScale = Math.max(0.6, Math.min(2.5, _readerScale + delta));
    document.getElementById('reader-zoom').textContent = `${Math.round(_readerScale * 100 / 1.2)}%`;
    if (_renderedPage != null) readerGoToPage(_renderedPage);
}

async function readerGoToPage(pageNum) {
    if (!_pdfDoc) return;
    pageNum = Math.max(1, Math.min(_pdfDoc.numPages, pageNum));
    _renderedPage = pageNum;
    document.getElementById('reader-page-input').value = pageNum;

    const container = document.getElementById('pdf-container');
    container.innerHTML = '';

    const page = await _pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: _readerScale });

    // Wrapper relativo
    const wrap = document.createElement('div');
    wrap.className = 'pdf-page-wrap';
    wrap.style.width = `${viewport.width}px`;
    wrap.style.height = `${viewport.height}px`;
    wrap.dataset.page = pageNum;

    // Canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    wrap.appendChild(canvas);

    // Text layer (para seleção)
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'pdf-textLayer';
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;
    wrap.appendChild(textLayerDiv);

    container.appendChild(wrap);

    // Renderizar canvas
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    // Renderizar text layer
    const textContent = await page.getTextContent();
    const pdfjs = await loadPdfJs();
    if (pdfjs.renderTextLayer) {
        pdfjs.renderTextLayer({ textContent, container: textLayerDiv, viewport, textDivs: [] });
    } else if (pdfjs.TextLayer) {
        const tl = new pdfjs.TextLayer({ textContentSource: textContent, container: textLayerDiv, viewport });
        await tl.render();
    }

    // Render existing highlights/annotations for this page
    renderOverlaysForPage(pageNum, wrap);

    // Atualizar progresso no backend (debounced)
    queueSavePage(pageNum);
}

let _saveTimer = null;
function queueSavePage(page) {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
        try {
            await api(`/books/${currentBookId}`, { method: 'PUT', body: JSON.stringify({ current_page: page }) });
            _currentBook.current_page = page;
            const status = document.getElementById('page-status');
            if (status) {
                const pct = Math.round(page / _currentBook.total_pages * 100);
                status.textContent = `pg. ${page}/${_currentBook.total_pages} · ${pct}%`;
            }
        } catch {}
    }, 1500);
}

function readerPrevPage() { readerGoToPage((_renderedPage || 1) - 1); }
function readerNextPage() { readerGoToPage((_renderedPage || 1) + 1); }

function renderOverlaysForPage(pageNum, wrap) {
    // Overlay de highlights — sobrepostos no canvas
    const hls = _readerHighlights.filter(h => h.page_number === pageNum);
    // Por simplicidade, mostrar como pins na borda esquerda (não posicionamos por coordenadas de seleção pq não as guardamos)
    hls.forEach((h, i) => {
        const pin = document.createElement('div');
        pin.className = 'note-pin';
        pin.style.left = '-28px';
        pin.style.top  = `${10 + i * 28}px`;
        pin.style.background = ({yellow:'#facc15',green:'#22c55e',blue:'#3b82f6',pink:'#ec4899'}[h.color] || '#facc15');
        pin.innerHTML = '<i class="fa-solid fa-highlighter text-[9px]"></i>';
        pin.title = `Grifo: ${h.selected_text.slice(0, 80)}`;
        pin.onclick = () => showNoteDetail(h, 'highlight');
        wrap.appendChild(pin);
    });

    const anns = _readerAnnotations.filter(a => a.page_number === pageNum);
    anns.forEach((a, i) => {
        const pin = document.createElement('div');
        pin.className = 'note-pin';
        pin.style.left = '-28px';
        pin.style.top  = `${10 + (hls.length + i) * 28}px`;
        pin.style.background = 'var(--warning)';
        pin.innerHTML = '<i class="fa-solid fa-note-sticky text-[9px]"></i>';
        pin.title = `Anotação: ${a.note_text.slice(0, 80)}`;
        pin.onclick = () => showNoteDetail(a, 'annotation');
        wrap.appendChild(pin);
    });
}

function showNoteDetail(item, type) {
    const isHL = type === 'highlight';
    openModal(`
    <div class="modal-head">
        <h3>${isHL ? 'Grifo' : 'Anotação'} · pg. ${item.page_number}</h3>
        <button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="p-3 mb-3" style="background:var(--bg-2); border-radius: 4px;">
        <p class="text-[13px]" style="color:var(--text); white-space: pre-wrap;">${isHL ? item.selected_text : item.note_text}</p>
    </div>
    <p class="text-[11px] mono" style="color:var(--text-4)">${item.color || ''} ${item.created_at ? '· ' + new Date(item.created_at).toLocaleDateString('pt-BR') : ''}</p>
    <div class="flex gap-2 justify-end pt-3 mt-3" style="border-top:1px solid var(--border)">
        <button onclick="deleteNote('${item.id}', '${type}'); closeModal();" class="btn btn-danger"><i class="fa-solid fa-trash text-[10px]"></i> Excluir</button>
        <button onclick="closeModal()" class="btn">Fechar</button>
    </div>`);
}

// ─────────────────────────────────────────────────────────────
// Selection popover
// ─────────────────────────────────────────────────────────────
let _lastSelection = null;

function handleSelectionEnd(e) {
    setTimeout(() => {
        const sel = window.getSelection();
        const text = sel.toString().trim();
        if (!text || text.length < 2) {
            hidePopover();
            return;
        }
        // Verificar se a seleção está dentro de um text layer
        const range = sel.getRangeAt(0);
        const pageWrap = range.startContainer.parentElement?.closest('.pdf-page-wrap');
        if (!pageWrap) {
            hidePopover();
            return;
        }
        _lastSelection = {
            text,
            page: parseInt(pageWrap.dataset.page),
        };
        showPopover(range);
    }, 10);
}

function showPopover(range) {
    const rect = range.getBoundingClientRect();
    const pop = document.getElementById('selection-popover');
    if (!pop) return;
    pop.style.display = 'block';
    pop.style.left = `${rect.left + (rect.width / 2) - 100}px`;
    pop.style.top  = `${rect.top - 48}px`;
}

function hidePopover() {
    const pop = document.getElementById('selection-popover');
    if (pop) pop.style.display = 'none';
}

function maybeClosePopover(e) {
    const pop = document.getElementById('selection-popover');
    if (!pop) return;
    if (pop.contains(e.target)) return;
    // Fecha se clicou fora E não está em meio a seleção
    setTimeout(() => {
        const sel = window.getSelection();
        if (!sel.toString().trim()) hidePopover();
    }, 50);
}

async function hlFromSelection(color) {
    if (!_lastSelection) return;
    try {
        const result = await api(`/books/${currentBookId}/highlights`, {
            method: 'POST',
            body: JSON.stringify({
                page_number: _lastSelection.page,
                selected_text: _lastSelection.text,
                color,
            }),
        });
        _readerHighlights.push(result);
        toast('Grifo salvo', 'success');
        updateNotesCount();
        // Re-render página pra mostrar o pin
        if (_renderedPage === _lastSelection.page) readerGoToPage(_renderedPage);
        renderNotesList();
        hidePopover();
        window.getSelection().removeAllRanges();
    } catch (e) { toast(e.message, 'error'); }
}

function annotateFromSelection() {
    if (!_lastSelection) return;
    const sel = _lastSelection;
    hidePopover();
    openModal(`
    <div class="modal-head">
        <h3>Nova anotação · pg. ${sel.page}</h3>
        <button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="p-2.5 mb-3" style="background:var(--bg-2); border-left: 2px solid var(--warning); border-radius: 0 3px 3px 0;">
        <p class="text-[11px] uppercase mono mb-1" style="color:var(--text-4); letter-spacing:.04em;">Trecho selecionado</p>
        <p class="text-[12.5px] italic" style="color:var(--text-2);">"${sel.text}"</p>
    </div>
    <div>
        <label class="label">Sua anotação</label>
        <textarea id="popover-ann-text" rows="4" class="input" autofocus placeholder="Notas, comentários, conexões…"></textarea>
    </div>
    <div class="flex gap-2 justify-end pt-3 mt-3">
        <button onclick="closeModal()" class="btn">Cancelar</button>
        <button onclick="savePopoverAnnotation()" class="btn btn-primary">Salvar anotação</button>
    </div>`);
    setTimeout(() => document.getElementById('popover-ann-text')?.focus(), 50);
}

async function savePopoverAnnotation() {
    if (!_lastSelection) return;
    const noteText = document.getElementById('popover-ann-text').value.trim();
    if (!noteText) { toast('Digite a anotação.', 'warning'); return; }
    try {
        const result = await api(`/books/${currentBookId}/annotations`, {
            method: 'POST',
            body: JSON.stringify({
                page_number: _lastSelection.page,
                note_text: `"${_lastSelection.text}"\n\n${noteText}`,
            }),
        });
        _readerAnnotations.push(result);
        closeModal();
        toast('Anotação salva', 'success');
        updateNotesCount();
        if (_renderedPage === _lastSelection.page) readerGoToPage(_renderedPage);
        renderNotesList();
        window.getSelection().removeAllRanges();
    } catch (e) { toast(e.message, 'error'); }
}

function copySelection() {
    if (!_lastSelection) return;
    navigator.clipboard?.writeText(_lastSelection.text);
    toast('Copiado para a área de transferência', 'success');
    hidePopover();
}

function updateNotesCount() {
    const el = document.getElementById('notes-count');
    if (el) el.textContent = _readerHighlights.length + _readerAnnotations.length;
}

function toggleNotesPanel() {
    const panel = document.getElementById('notes-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) renderNotesList();
}

function renderNotesList() {
    const el = document.getElementById('notes-list');
    if (!el) return;
    const all = [
        ..._readerHighlights.map(h => ({ ...h, type: 'highlight' })),
        ..._readerAnnotations.map(a => ({ ...a, type: 'annotation' })),
    ].sort((a, b) => a.page_number - b.page_number);
    if (all.length === 0) {
        el.innerHTML = emptyState('fa-bookmark', 'Sem grifos ou notas', 'Selecione texto no PDF para começar.');
        return;
    }
    const hlBgs = { yellow:'#fef9c3', green:'#dcfce7', blue:'#dbeafe', pink:'#fce7f3' };
    el.innerHTML = all.map(it => {
        const isHL = it.type === 'highlight';
        const bg = isHL ? (hlBgs[it.color] || hlBgs.yellow) : 'var(--bg-2)';
        return `<div class="p-2.5 cursor-pointer hover:opacity-90" onclick="readerGoToPage(${it.page_number})" style="background:${bg}; border-radius: 3px; border-left: 2px solid ${isHL ? (hlBgs[it.color]?.replace('f','c')||'#ca8a04') : 'var(--warning)'};">
            <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] mono uppercase font-medium" style="color:var(--text-4); letter-spacing:.04em;">
                    <i class="fa-solid fa-${isHL ? 'highlighter' : 'note-sticky'} text-[9px]"></i> pg. ${it.page_number}
                </span>
                <button onclick="event.stopPropagation();deleteNote('${it.id}','${it.type}')" style="color:var(--text-5)"><i class="fa-solid fa-xmark text-[10px]"></i></button>
            </div>
            <p class="text-[12px] line-clamp-3" style="color:var(--text); white-space: pre-wrap;">${isHL ? it.selected_text : it.note_text}</p>
        </div>`;
    }).join('');
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
        if (type === 'highlight') _readerHighlights = _readerHighlights.filter(h => h.id !== id);
        else _readerAnnotations = _readerAnnotations.filter(a => a.id !== id);
        toast('Removido', 'success');
        updateNotesCount();
        if (_renderedPage != null) readerGoToPage(_renderedPage);
        renderNotesList();
    } catch (e) { toast(e.message, 'error'); }
}
