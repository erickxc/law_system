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
        <div>
            <label class="label">Fonte do PDF</label>
            <div class="tab-bar" style="margin-bottom: 8px;">
                <button type="button" id="bsrc-url-btn" onclick="switchBookSrc('url')" class="tab-btn active"><i class="fa-solid fa-link text-[10px]"></i> URL externa</button>
                <button type="button" id="bsrc-file-btn" onclick="switchBookSrc('file')" class="tab-btn"><i class="fa-solid fa-cloud-arrow-up text-[10px]"></i> Arquivo local</button>
            </div>
            <div id="bsrc-url-tab">
                <input type="url" class="input mono" id="b-url" placeholder="https://...">
                <p class="help">Link direto para um PDF público (acessível por todos os dispositivos).</p>
            </div>
            <div id="bsrc-file-tab" class="hidden">
                <label for="b-file" class="block cursor-pointer" style="border: 2px dashed var(--border-2); border-radius: 6px; padding: 16px; text-align: center; transition: all .12s;" onmouseover="this.style.borderColor='var(--accent)';this.style.background='var(--accent-bg)'" onmouseout="this.style.borderColor='var(--border-2)';this.style.background=''">
                    <i class="fa-solid fa-file-pdf text-[24px] mb-1" style="color:var(--text-4)"></i>
                    <p class="text-[12px] font-medium" style="color:var(--text)" id="b-file-label">Clique para selecionar um PDF</p>
                    <p class="text-[10.5px] mt-1" style="color:var(--text-4)">até 50MB · salvo localmente neste navegador</p>
                </label>
                <input type="file" id="b-file" accept="application/pdf,.pdf" style="display:none" onchange="handleLocalPdf(this.files[0])">
                <p class="help"><i class="fa-solid fa-circle-info text-[10px]"></i> PDFs locais ficam apenas neste navegador (não sincronizam entre dispositivos).</p>
            </div>
        </div>
        <div><label class="label">Matéria</label><select class="input" id="b-subject"><option value="">Nenhuma</option>${subjectOpts}</select></div>
        <div><label class="label">Cor da capa</label><div class="flex gap-1.5 flex-wrap mt-1" id="color-picker">${colorPicker}</div><input type="hidden" id="b-color" value="${COVER_COLORS[0]}"></div>
        <div class="flex gap-2 justify-end pt-2">
            <button type="button" onclick="closeModal()" class="btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
    </form>`);

    selectColor(COVER_COLORS[0], document.querySelector('.color-btn'));
    _bookSrc = 'url';
    _pendingLocalPdf = null;

    if (id) {
        api(`/books/${id}`).then(b => {
            document.getElementById('b-name').value = b.name;
            document.getElementById('b-author').value = b.author || '';
            document.getElementById('b-genre').value = b.genre || '';
            document.getElementById('b-pages').value = b.total_pages;
            document.getElementById('b-curpage').value = b.current_page;
            document.getElementById('b-subject').value = b.subject_id || '';

            const isLocal = b.url && b.url.startsWith(LOCAL_PDF_PREFIX);
            if (isLocal) {
                switchBookSrc('file');
                const lbl = document.getElementById('b-file-label');
                if (lbl) lbl.textContent = '📄 PDF local salvo · selecione outro para substituir';
            } else {
                document.getElementById('b-url').value = b.url || '';
            }

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

// ─── Toggle entre URL externa e arquivo local no modal de book ────────────
let _bookSrc = 'url';
let _pendingLocalPdf = null;   // Blob aguardando salvar (após editingBookId existir)

function switchBookSrc(src) {
    _bookSrc = src;
    document.getElementById('bsrc-url-btn').classList.toggle('active', src === 'url');
    document.getElementById('bsrc-file-btn').classList.toggle('active', src === 'file');
    document.getElementById('bsrc-url-tab').classList.toggle('hidden', src !== 'url');
    document.getElementById('bsrc-file-tab').classList.toggle('hidden', src !== 'file');
}

async function handleLocalPdf(file) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
        toast('Arquivo muito grande (máx 50MB).', 'warning');
        return;
    }
    if (file.type && !file.type.includes('pdf')) {
        toast('Selecione um arquivo PDF.', 'warning');
        return;
    }
    _pendingLocalPdf = file;
    const lbl = document.getElementById('b-file-label');
    if (lbl) lbl.textContent = `✓ ${file.name} (${Math.round(file.size/1024)}KB)`;
    // Estimar pages: usar PDF.js
    try {
        const pdfjs = await loadPdfJs();
        const arrayBuf = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuf }).promise;
        document.getElementById('b-pages').value = pdf.numPages;
        toast(`PDF: ${pdf.numPages} páginas detectadas`, 'info', 2500);
    } catch {}
}

async function saveBook(e) {
    e.preventDefault();
    let urlValue = null;
    if (_bookSrc === 'url') {
        urlValue = document.getElementById('b-url').value.trim() || null;
    } else if (_bookSrc === 'file' && _pendingLocalPdf) {
        urlValue = LOCAL_PDF_PREFIX + 'pending'; // placeholder, será atualizado abaixo
    } else if (_bookSrc === 'file' && editingBookId) {
        // Editando, sem novo arquivo: manter url atual
        const cur = await api(`/books/${editingBookId}`);
        urlValue = cur.url;
    }

    const data = {
        name: document.getElementById('b-name').value.trim(),
        author: document.getElementById('b-author').value.trim() || null,
        genre: document.getElementById('b-genre').value.trim() || null,
        total_pages: parseInt(document.getElementById('b-pages').value) || 1,
        current_page: parseInt(document.getElementById('b-curpage').value) || 0,
        url: urlValue,
        subject_id: document.getElementById('b-subject').value || null,
        cover_color: document.getElementById('b-color').value,
    };
    try {
        let book;
        if (editingBookId) {
            book = await api(`/books/${editingBookId}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
            book = await api('/books/', { method: 'POST', body: JSON.stringify(data) });
        }

        // Se tem arquivo local pendente, salva no IndexedDB e atualiza url com o id real
        if (_pendingLocalPdf && book.id) {
            await savePdfLocal(book.id, _pendingLocalPdf);
            const finalUrl = LOCAL_PDF_PREFIX + book.id;
            if (data.url !== finalUrl) {
                await api(`/books/${book.id}`, { method: 'PUT', body: JSON.stringify({ url: finalUrl }) });
            }
            _pendingLocalPdf = null;
        }

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
        await deletePdfLocal(id);  // limpa IndexedDB se houver
        showBooks();
        toast('Livro excluído', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

// ─────────────────────────────────────────────────────────────
// PDF Reader com PDF.js + popover suspenso ao selecionar texto
// ─────────────────────────────────────────────────────────────

const PDFJS_URL  = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';
const PDFJS_WORK = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

// ─── Local PDF storage (IndexedDB) ───────────────────────────────────────
const LOCAL_PDF_PREFIX = 'local:';
const IDB_NAME = 'law_system_pdfs';
const IDB_STORE = 'pdfs';

function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function savePdfLocal(bookId, blob) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(blob, bookId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
async function getPdfLocal(bookId) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(bookId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}
async function deletePdfLocal(bookId) {
    try {
        const db = await openIDB();
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(bookId);
    } catch {}
}

// Tipos de sticky notes
const STICKY_TAGS = {
    check:     { label: 'Check',      icon: 'fa-circle-check' },
    done:      { label: 'Concluído',  icon: 'fa-flag-checkered' },
    review:    { label: 'Revisar',    icon: 'fa-rotate' },
    important: { label: 'Importante', icon: 'fa-star' },
    question:  { label: 'Dúvida',     icon: 'fa-circle-question' },
    pin:       { label: 'Marcar',     icon: 'fa-thumbtack' },
};
let _postitMode = null;       // null OU 'check'/'done'/etc
let _postitClickHandler = null;
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

    // Tracking: se houver sessão ativa, registra leitura
    if (typeof trackBookOpen === 'function') trackBookOpen(book.id, book.name);

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
                <button onclick="togglePostitMode()" class="btn btn-sm" id="btn-postit"><i class="fa-solid fa-note-sticky text-[10px]"></i> Etiquetas</button>
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
        .hl-overlay { position: absolute; mix-blend-mode: multiply; border-radius: 2px; transition: filter .12s; }
        .hl-overlay:hover { filter: brightness(0.92); }
        .hl-yellow { background: rgba(253, 224, 71, 0.55); }
        .hl-green  { background: rgba(134, 239, 172, 0.55); }
        .hl-blue   { background: rgba(147, 197, 253, 0.55); }
        .hl-pink   { background: rgba(249, 168, 212, 0.55); }
        .note-pin { position: absolute; width: 20px; height: 20px; background: var(--warning); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,.2); }
    </style>`;

    if (book.url) {
        await renderReader(book);
    }
}

async function renderReader(book) {
    try {
        const pdfjs = await loadPdfJs();
        const docOpts = { cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/cmaps/', cMapPacked: true };

        // PDF local (IndexedDB) vs URL externa
        if (book.url && book.url.startsWith(LOCAL_PDF_PREFIX)) {
            const blob = await getPdfLocal(book.id);
            if (!blob) {
                throw new Error('Arquivo local não encontrado neste navegador. Reabra o livro e reenvie o PDF (PDFs locais ficam apenas no navegador onde foram enviados).');
            }
            const arrayBuf = await blob.arrayBuffer();
            docOpts.data = arrayBuf;
        } else {
            docOpts.url = book.url;
        }

        _pdfDoc = await pdfjs.getDocument(docOpts).promise;

        // Ajustar total_pages se diferir
        if (_pdfDoc.numPages !== book.total_pages) {
            await api(`/books/${book.id}`, { method: 'PUT', body: JSON.stringify({ total_pages: _pdfDoc.numPages }) });
            book.total_pages = _pdfDoc.numPages;
            const inp = document.getElementById('reader-page-input');
            if (inp) inp.max = book.total_pages;
        }

        // Renderizar TODAS as páginas (lazy via IntersectionObserver)
        await renderAllPages(book.current_page || 1);

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

let _readerScale = 1.5;
let _pageWraps = [];          // [{wrap, pageNum, rendered}]
let _renderQueue = new Set(); // páginas em fila pra render
let _pageObserver = null;

function readerZoom(delta) {
    const old = _readerScale;
    _readerScale = Math.max(0.6, Math.min(3.0, _readerScale + delta));
    if (_readerScale === old) return;
    document.getElementById('reader-zoom').textContent = `${Math.round(_readerScale * 100 / 1.5)}%`;
    // Re-render TUDO (placeholders ganham nova dimensão)
    if (_pdfDoc) renderAllPages(_renderedPage || 1);
}

// Limpa observer e estado prévio
function disposePages() {
    if (_pageObserver) { try { _pageObserver.disconnect(); } catch {} _pageObserver = null; }
    _pageWraps = [];
    _renderQueue.clear();
}

// Cria os placeholders de TODAS as páginas com dimensão calculada e
// configura IntersectionObserver pra renderizar sob demanda.
async function renderAllPages(scrollToPage) {
    if (!_pdfDoc) return;
    const container = document.getElementById('pdf-container');
    if (!container) return;
    disposePages();
    container.innerHTML = '';

    // Pega a primeira página pra estimar dimensão base (todas similares na maioria dos PDFs)
    const firstPage = await _pdfDoc.getPage(1);
    const baseViewport = firstPage.getViewport({ scale: _readerScale });
    const baseW = Math.floor(baseViewport.width);
    const baseH = Math.floor(baseViewport.height);

    // Cria placeholders
    for (let p = 1; p <= _pdfDoc.numPages; p++) {
        const wrap = document.createElement('div');
        wrap.className = 'pdf-page-wrap';
        wrap.style.width  = `${baseW}px`;
        wrap.style.height = `${baseH}px`;
        wrap.dataset.page = p;
        wrap.dataset.rendered = '0';

        const placeholder = document.createElement('div');
        placeholder.className = 'pdf-placeholder';
        placeholder.innerHTML = `<span class="mono text-[11px]" style="color:var(--text-5)">pg. ${p}</span>`;
        wrap.appendChild(placeholder);

        // Drop zone: aceita etiquetas arrastadas da toolbar
        wrap.addEventListener('dragover', (e) => {
            if (_draggingTag) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; wrap.classList.add('drop-target'); }
        });
        wrap.addEventListener('dragleave', () => wrap.classList.remove('drop-target'));
        wrap.addEventListener('drop', (e) => {
            wrap.classList.remove('drop-target');
            const tag = e.dataTransfer.getData('text/x-sticky-tag') || _draggingTag;
            if (!tag || !STICKY_TAGS[tag]) return;
            e.preventDefault();
            const wrapRect = wrap.getBoundingClientRect();
            const xPct = ((e.clientX - wrapRect.left) / wrapRect.width)  * 100;
            const yPct = ((e.clientY - wrapRect.top)  / wrapRect.height) * 100;
            createStickyDirect(tag, parseInt(wrap.dataset.page), xPct, yPct);
        });

        container.appendChild(wrap);
        _pageWraps.push(wrap);
    }

    // Observer: renderiza quando entra na viewport (com root margin pra antecipar)
    _pageObserver = new IntersectionObserver((entries) => {
        entries.forEach(en => {
            if (en.isIntersecting) {
                const p = parseInt(en.target.dataset.page);
                if (en.target.dataset.rendered === '0') queuePageRender(p);
            }
        });
        // Detecta página atual (mais visível) e atualiza input + progresso
        updateCurrentPageFromScroll();
    }, {
        root: document.getElementById('pdf-scroll'),
        rootMargin: '400px 0px',  // pre-render 400px antes/depois
        threshold: 0,
    });
    _pageWraps.forEach(w => _pageObserver.observe(w));

    // Renderiza imediatamente as primeiras 2 (sem esperar IntersectionObserver)
    queuePageRender(1);
    if (_pdfDoc.numPages >= 2) queuePageRender(2);

    // Scroll pra página alvo
    if (scrollToPage > 1) {
        setTimeout(() => scrollToPdfPage(scrollToPage, false), 100);
    }
}

function scrollToPdfPage(pageNum, smooth = true) {
    const wrap = _pageWraps[pageNum - 1];
    if (!wrap) return;
    const scrollEl = document.getElementById('pdf-scroll');
    if (!scrollEl) return;
    scrollEl.scrollTo({
        top: wrap.offsetTop - 8,
        behavior: smooth ? 'smooth' : 'auto',
    });
}

// Detecta a página mais centrada no scroll e atualiza input + progresso
let _scrollUpdateTimer = null;
function updateCurrentPageFromScroll() {
    clearTimeout(_scrollUpdateTimer);
    _scrollUpdateTimer = setTimeout(() => {
        const scrollEl = document.getElementById('pdf-scroll');
        if (!scrollEl || !_pageWraps.length) return;
        const center = scrollEl.scrollTop + scrollEl.clientHeight / 2;
        let best = 1, bestDist = Infinity;
        _pageWraps.forEach(w => {
            const wTop = w.offsetTop, wBot = w.offsetTop + w.offsetHeight;
            const wCenter = (wTop + wBot) / 2;
            const dist = Math.abs(wCenter - center);
            if (dist < bestDist) { bestDist = dist; best = parseInt(w.dataset.page); }
        });
        if (best !== _renderedPage) {
            _renderedPage = best;
            const inp = document.getElementById('reader-page-input');
            if (inp) inp.value = best;
            queueSavePage(best);
        }
    }, 120);
}

// Render assíncrono de uma página específica
async function queuePageRender(pageNum) {
    if (_renderQueue.has(pageNum)) return;
    _renderQueue.add(pageNum);
    try {
        await renderPdfPage(pageNum);
    } catch (e) {
        console.warn(`Render page ${pageNum} failed:`, e);
    } finally {
        _renderQueue.delete(pageNum);
    }
}

async function renderPdfPage(pageNum) {
    const wrap = _pageWraps[pageNum - 1];
    if (!wrap || wrap.dataset.rendered === '1') return;
    wrap.dataset.rendered = '1';

    const page = await _pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: _readerScale });

    // Dimensões inteiras (evita sub-pixel rendering, principal causa de turvo)
    const cssW = Math.floor(viewport.width);
    const cssH = Math.floor(viewport.height);

    wrap.style.width  = `${cssW}px`;
    wrap.style.height = `${cssH}px`;
    wrap.innerHTML = '';

    // Resolução do canvas = DPR × boost. Em zoom alto compensa qualquer
    // perda de nitidez. Cap a 4x pra não estourar VRAM em zoom 300%.
    const dpr = window.devicePixelRatio || 1;
    const outputScale = Math.min(4, Math.max(2, dpr * 1.5));

    const canvas = document.createElement('canvas');
    canvas.width  = Math.floor(viewport.width  * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width  = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext('2d', { alpha: false });
    // Texto mais nítido em escala alta
    ctx.imageSmoothingQuality = 'high';
    wrap.appendChild(canvas);

    // Text layer
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'pdf-textLayer';
    textLayerDiv.style.width  = `${cssW}px`;
    textLayerDiv.style.height = `${cssH}px`;
    wrap.appendChild(textLayerDiv);

    // Render com transform de outputScale
    await page.render({
        canvasContext: ctx,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
    }).promise;

    // Text layer (PDF.js 4.x)
    try {
        const textContent = await page.getTextContent();
        const pdfjs = await loadPdfJs();
        if (pdfjs.TextLayer) {
            const tl = new pdfjs.TextLayer({ textContentSource: textContent, container: textLayerDiv, viewport });
            await tl.render();
        } else if (pdfjs.renderTextLayer) {
            await pdfjs.renderTextLayer({ textContentSource: textContent, container: textLayerDiv, viewport, textDivs: [] }).promise;
        }
    } catch (textErr) {
        console.warn('Text layer failed:', textErr);
    }

    // Overlays (stickies, highlights, etc)
    renderOverlaysForPage(pageNum, wrap);
}

// API pública usada pelos botões/input (compatibilidade) — só faz scroll agora
async function readerGoToPage(pageNum) {
    if (!_pdfDoc) return;
    pageNum = Math.max(1, Math.min(_pdfDoc.numPages, pageNum));
    _renderedPage = pageNum;
    const inp = document.getElementById('reader-page-input');
    if (inp) inp.value = pageNum;
    scrollToPdfPage(pageNum, true);
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
    // Sticky notes posicionadas (x_pct, y_pct) — etiquetas visuais com DRAG
    const stickies = _readerAnnotations.filter(a => a.page_number === pageNum && a.tag && a.x_pct != null && a.y_pct != null);
    stickies.forEach(s => {
        const tag = STICKY_TAGS[s.tag] || STICKY_TAGS.pin;
        const el = document.createElement('div');
        el.className = `sticky-note sticky-tag-${s.tag}`;
        el.style.left = `${s.x_pct}%`;
        el.style.top  = `${s.y_pct}%`;
        el.style.cursor = 'grab';
        el.innerHTML = `<i class="fa-solid ${tag.icon}"></i><span>${s.note_text || tag.label}</span>`;
        el.title = `Arrastar para mover · clique para editar`;
        makeStickyDraggable(el, s, wrap);
        wrap.appendChild(el);
    });

    // Highlights: rects coloridos sobre o texto + pin na margem
    const hls = _readerHighlights.filter(h => h.page_number === pageNum);
    hls.forEach((h, i) => {
        // Overlay colorido sobre o texto (se houver rects)
        if (Array.isArray(h.rects) && h.rects.length > 0) {
            h.rects.forEach(r => {
                const ov = document.createElement('div');
                ov.className = `hl-overlay hl-${h.color || 'yellow'}`;
                ov.style.left   = `${r.x}%`;
                ov.style.top    = `${r.y}%`;
                ov.style.width  = `${r.w}%`;
                ov.style.height = `${r.h}%`;
                ov.title = `Grifo: ${h.selected_text.slice(0, 80)}`;
                ov.style.cursor = 'pointer';
                ov.style.pointerEvents = 'auto';
                ov.onclick = (e) => { e.stopPropagation(); showNoteDetail(h, 'highlight'); };
                wrap.appendChild(ov);
            });
        }
        // Pin na margem (atalho de navegação/exclusão)
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

    // Anotações antigas (sem tag/coords) → pins normais
    const oldAnns = _readerAnnotations.filter(a => a.page_number === pageNum && !(a.tag && a.x_pct != null));
    oldAnns.forEach((a, i) => {
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

    // Click handler na pagina pra colocar sticky no modo post-it
    wrap.addEventListener('click', pageClickPostit);
}

// Click no PDF não cria mais sticky (criação é por drag-and-drop da toolbar)
function pageClickPostit(e) { /* no-op: drag-and-drop é o caminho de criação */ }

// Torna a etiqueta arrastável. Threshold de 5px distingue click (edita) de drag (move).
function makeStickyDraggable(el, sticky, wrap) {
    let startX = 0, startY = 0, moved = false, dragging = false;
    let offsetXpx = 0, offsetYpx = 0;

    const onDown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const elRect = el.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        offsetXpx = e.clientX - elRect.left;
        offsetYpx = e.clientY - elRect.top;
        moved = false;
        dragging = true;
        el.style.cursor = 'grabbing';
        el.style.zIndex = 50;
        el.style.opacity = '0.85';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const onMove = (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        moved = true;
        const wrapRect = wrap.getBoundingClientRect();
        let xPx = e.clientX - wrapRect.left - offsetXpx;
        let yPx = e.clientY - wrapRect.top  - offsetYpx;
        // Clamp dentro do wrap
        xPx = Math.max(0, Math.min(wrapRect.width  - 10, xPx));
        yPx = Math.max(0, Math.min(wrapRect.height - 10, yPx));
        const xPct = (xPx / wrapRect.width)  * 100;
        const yPct = (yPx / wrapRect.height) * 100;
        el.style.left = `${xPct}%`;
        el.style.top  = `${yPct}%`;
        el._newX = xPct;
        el._newY = yPct;
    };

    const onUp = async (e) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (!dragging) return;
        dragging = false;
        el.style.cursor = 'grab';
        el.style.opacity = '';
        el.style.zIndex = '';

        if (moved && el._newX != null && el._newY != null) {
            // Drag: salva nova posição
            try {
                const updated = await api(`/books/annotations/${sticky.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ x_pct: el._newX, y_pct: el._newY }),
                });
                const i = _readerAnnotations.findIndex(a => a.id === sticky.id);
                if (i !== -1) _readerAnnotations[i] = updated;
                sticky.x_pct = updated.x_pct;
                sticky.y_pct = updated.y_pct;
                toast('Etiqueta movida', 'success', 1200);
            } catch (err) { toast('Erro ao mover: ' + err.message, 'error'); }
        } else {
            // Click sem mover: edita
            if (!_postitMode) openStickyEditModal(sticky);
        }
    };

    el.addEventListener('mousedown', onDown);
}

// ─── Modo post-it (toolbar inferior) ─────────────────────────────────────
function togglePostitMode() {
    if (_postitMode) {
        exitPostitMode();
    } else {
        enterPostitMode('check');
    }
}

function enterPostitMode(initialTag) {
    _postitMode = initialTag;
    document.body.classList.add('postit-mode');
    const btn = document.getElementById('btn-postit');
    if (btn) {
        btn.classList.add('btn-primary');
        btn.innerHTML = '<i class="fa-solid fa-circle-stop text-[10px]"></i> Sair etiquetas';
    }
    // Cria toolbar com botões DRAGGABLE
    if (!document.getElementById('postit-toolbar')) {
        const tb = document.createElement('div');
        tb.id = 'postit-toolbar';
        tb.className = 'postit-toolbar';
        tb.innerHTML = Object.entries(STICKY_TAGS).map(([k, v]) => `
            <button class="pt-btn sticky-tag-${k}" data-tag="${k}" draggable="true" title="${v.label} — arraste para o PDF">
                <i class="fa-solid ${v.icon}"></i>
            </button>
        `).join('') + `
            <div class="pt-divider"></div>
            <button class="pt-exit" onclick="exitPostitMode()">
                <i class="fa-solid fa-xmark"></i> Sair
            </button>
        `;
        document.body.appendChild(tb);

        // Listeners dragstart em cada botão da toolbar
        tb.querySelectorAll('.pt-btn').forEach(b => {
            b.addEventListener('dragstart', (e) => {
                const tag = b.dataset.tag;
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/x-sticky-tag', tag);
                e.dataTransfer.setData('text/plain', tag);
                _draggingTag = tag;
                document.body.classList.add('dragging-sticky');
            });
            b.addEventListener('dragend', () => {
                _draggingTag = null;
                document.body.classList.remove('dragging-sticky');
            });
            // Click ainda seleciona (uso visual: indica "esta é a etiqueta")
            b.addEventListener('click', () => selectPostitTag(b.dataset.tag));
        });
    }
    selectPostitTag(initialTag);
    toast('Arraste qualquer etiqueta da barra inferior para o PDF', 'info', 5000);
}

let _draggingTag = null;

function exitPostitMode() {
    _postitMode = null;
    document.body.classList.remove('postit-mode');
    document.getElementById('postit-toolbar')?.remove();
    const btn = document.getElementById('btn-postit');
    if (btn) {
        btn.classList.remove('btn-primary');
        btn.innerHTML = '<i class="fa-solid fa-note-sticky text-[10px]"></i> Etiquetas';
    }
}

function selectPostitTag(tag) {
    _postitMode = tag;
    document.querySelectorAll('#postit-toolbar .pt-btn').forEach(b => {
        b.classList.toggle('is-selected', b.dataset.tag === tag);
    });
}

// Cria etiqueta direto (sem modal) no local arrastado. Usuário pode clicar pra editar texto.
async function createStickyDirect(tag, pageNum, x_pct, y_pct) {
    try {
        const result = await api(`/books/${currentBookId}/annotations`, {
            method: 'POST',
            body: JSON.stringify({
                page_number: pageNum,
                note_text: '',
                color: 'yellow',
                tag,
                x_pct,
                y_pct,
            }),
        });
        _readerAnnotations.push(result);
        const wrap = _pageWraps[pageNum - 1];
        if (wrap) {
            wrap.querySelectorAll('.sticky-note,.hl-overlay,.note-pin').forEach(el => el.remove());
            renderOverlaysForPage(pageNum, wrap);
        }
        updateNotesCount();
        renderNotesList();
        toast(`Etiqueta "${STICKY_TAGS[tag].label}" fixada`, 'success', 1500);
    } catch (e) { toast('Erro ao criar etiqueta: ' + e.message, 'error'); }
}

function openStickyCreateModal(tag, pageNum, x_pct, y_pct) {
    const t = STICKY_TAGS[tag];
    openModal(`
    <div class="modal-head">
        <h3>Nova etiqueta · pg. ${pageNum}</h3>
        <button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="mb-4">
        <p class="text-[11px] uppercase tracking-wider mb-2" style="color:var(--text-4); letter-spacing:.08em;">Tipo</p>
        <div class="flex flex-wrap gap-2">
            ${Object.entries(STICKY_TAGS).map(([k, v]) => `
                <button data-tag="${k}" onclick="document.querySelectorAll('[data-tag]').forEach(b=>b.classList.remove('is-selected'));this.classList.add('is-selected');document.getElementById('sticky-tag').value='${k}'"
                    class="sticky-tag-${k} ${k === tag ? 'is-selected' : ''}"
                    style="padding:6px 10px;border-radius:4px;cursor:pointer;font-size:11.5px;font-weight:600;border:2px solid transparent;">
                    <i class="fa-solid ${v.icon} text-[10px]"></i> ${v.label}
                </button>
            `).join('')}
        </div>
        <style>[data-tag].is-selected { border-color: var(--text) !important; box-shadow: 0 0 0 2px white inset, 0 0 0 4px var(--text); }</style>
    </div>
    <input type="hidden" id="sticky-tag" value="${tag}">
    <div>
        <label class="label">Texto curto (opcional)</label>
        <input type="text" id="sticky-text" class="input" placeholder="Ex: revisar art. 5º" maxlength="80" autofocus>
        <p class="help">Se deixar em branco, mostra apenas o ícone e nome do tipo.</p>
    </div>
    <div class="flex gap-2 justify-end pt-3 mt-4" style="border-top:1px solid var(--border)">
        <button onclick="closeModal()" class="btn">Cancelar</button>
        <button onclick="saveStickyCreate(${pageNum}, ${x_pct}, ${y_pct})" class="btn btn-primary">Fixar etiqueta</button>
    </div>`);
    setTimeout(() => document.getElementById('sticky-text')?.focus(), 50);
}

async function saveStickyCreate(pageNum, x_pct, y_pct) {
    const tag = document.getElementById('sticky-tag').value;
    const text = document.getElementById('sticky-text').value.trim();
    try {
        const result = await api(`/books/${currentBookId}/annotations`, {
            method: 'POST',
            body: JSON.stringify({
                page_number: pageNum,
                note_text: text || '',
                color: 'yellow',
                tag,
                x_pct,
                y_pct,
            }),
        });
        _readerAnnotations.push(result);
        closeModal();
        toast('Etiqueta fixada', 'success');
        updateNotesCount();
        readerGoToPage(pageNum);
        renderNotesList();
    } catch (e) { toast(e.message, 'error'); }
}

function openStickyEditModal(s) {
    const tag = STICKY_TAGS[s.tag];
    openModal(`
    <div class="modal-head">
        <h3>${tag.label} · pg. ${s.page_number}</h3>
        <button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="mb-4">
        <p class="text-[11px] uppercase tracking-wider mb-2" style="color:var(--text-4); letter-spacing:.08em;">Tipo</p>
        <div class="flex flex-wrap gap-2">
            ${Object.entries(STICKY_TAGS).map(([k, v]) => `
                <button data-tag="${k}" onclick="document.querySelectorAll('[data-tag]').forEach(b=>b.classList.remove('is-selected'));this.classList.add('is-selected');document.getElementById('sticky-edit-tag').value='${k}'"
                    class="sticky-tag-${k} ${s.tag === k ? 'is-selected' : ''}"
                    style="padding:6px 10px;border-radius:4px;cursor:pointer;font-size:11.5px;font-weight:600;border:2px solid transparent;">
                    <i class="fa-solid ${v.icon} text-[10px]"></i> ${v.label}
                </button>
            `).join('')}
        </div>
        <style>[data-tag].is-selected { border-color: var(--text) !important; box-shadow: 0 0 0 2px white inset, 0 0 0 4px var(--text); }</style>
    </div>
    <input type="hidden" id="sticky-edit-tag" value="${s.tag}">
    <div>
        <label class="label">Texto</label>
        <input type="text" id="sticky-edit-text" class="input" value="${s.note_text || ''}" maxlength="80" autofocus>
    </div>
    <div class="flex gap-2 justify-between pt-3 mt-4" style="border-top:1px solid var(--border)">
        <button onclick="deleteSticky('${s.id}')" class="btn btn-danger"><i class="fa-solid fa-trash text-[10px]"></i> Remover</button>
        <div class="flex gap-2">
            <button onclick="closeModal()" class="btn">Cancelar</button>
            <button onclick="saveStickyEdit('${s.id}')" class="btn btn-primary">Salvar</button>
        </div>
    </div>`);
}

async function saveStickyEdit(id) {
    const tag = document.getElementById('sticky-edit-tag').value;
    const text = document.getElementById('sticky-edit-text').value.trim();
    try {
        const updated = await api(`/books/annotations/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ tag, note_text: text }),
        });
        const i = _readerAnnotations.findIndex(a => a.id === id);
        if (i !== -1) _readerAnnotations[i] = updated;
        closeModal();
        toast('Etiqueta atualizada', 'success');
        readerGoToPage(_renderedPage);
        renderNotesList();
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteSticky(id) {
    if (!confirm('Remover esta etiqueta?')) return;
    try {
        await api(`/books/annotations/${id}`, { method: 'DELETE' });
        _readerAnnotations = _readerAnnotations.filter(a => a.id !== id);
        closeModal();
        toast('Etiqueta removida', 'success');
        updateNotesCount();
        readerGoToPage(_renderedPage);
        renderNotesList();
    } catch (e) { toast(e.message, 'error'); }
}

function showNoteDetail(item, type) {
    const isHL = type === 'highlight';
    const body = isHL ? item.selected_text : item.note_text;
    const rendered = isHL
        ? `<p class="text-[13px]" style="color:var(--text); white-space: pre-wrap;">${body}</p>`
        : `<div class="md-body">${renderMarkdown(body)}</div>`;
    openModal(`
    <div class="modal-head">
        <h3>${isHL ? 'Grifo' : 'Anotação'} · pg. ${item.page_number}</h3>
        <button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="p-3 mb-3" style="background:var(--bg-2); border-radius: 4px; max-height: 60vh; overflow-y: auto;">
        ${rendered}
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
        const range = sel.getRangeAt(0);
        const pageWrap = range.startContainer.parentElement?.closest('.pdf-page-wrap');
        if (!pageWrap) {
            hidePopover();
            return;
        }
        // Captura rects da seleção normalizados em % do wrap
        const wrapRect = pageWrap.getBoundingClientRect();
        const clientRects = Array.from(range.getClientRects());
        const rects = clientRects
            .filter(r => r.width > 1 && r.height > 1)
            .map(r => ({
                x: ((r.left - wrapRect.left) / wrapRect.width) * 100,
                y: ((r.top  - wrapRect.top)  / wrapRect.height) * 100,
                w: (r.width  / wrapRect.width)  * 100,
                h: (r.height / wrapRect.height) * 100,
            }));
        _lastSelection = {
            text,
            page: parseInt(pageWrap.dataset.page),
            rects,
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
                rects: _lastSelection.rects || [],
            }),
        });
        _readerHighlights.push(result);
        toast('Grifo salvo', 'success');
        updateNotesCount();
        // Re-aplica overlays na página em vez de re-renderizar
        const wrap = _pageWraps[_lastSelection.page - 1];
        if (wrap) {
            wrap.querySelectorAll('.hl-overlay,.note-pin,.sticky-note').forEach(el => el.remove());
            renderOverlaysForPage(_lastSelection.page, wrap);
        }
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
        <textarea id="popover-ann-text" rows="5" class="input" autofocus placeholder="Notas, comentários, conexões…&#10;&#10;Suporta markdown: **negrito**, *itálico*, # título, - lista, > citação"></textarea>
        <p class="help"><i class="fa-solid fa-circle-info text-[10px]"></i> Markdown suportado: <code style="font-family:monospace;background:var(--bg-2);padding:0 4px;border-radius:2px">**negrito**</code> <code style="font-family:monospace;background:var(--bg-2);padding:0 4px;border-radius:2px">*itálico*</code> <code style="font-family:monospace;background:var(--bg-2);padding:0 4px;border-radius:2px"># título</code> <code style="font-family:monospace;background:var(--bg-2);padding:0 4px;border-radius:2px">- lista</code></p>
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
    // Separar: stickies (com tag) vs anotações comuns vs highlights
    const stickies = _readerAnnotations.filter(a => a.tag);
    const annsPlain = _readerAnnotations.filter(a => !a.tag);
    const all = [
        ...stickies.map(s => ({ ...s, type: 'sticky' })),
        ..._readerHighlights.map(h => ({ ...h, type: 'highlight' })),
        ...annsPlain.map(a => ({ ...a, type: 'annotation' })),
    ].sort((a, b) => a.page_number - b.page_number);

    if (all.length === 0) {
        el.innerHTML = emptyState('fa-bookmark', 'Sem grifos ou notas', 'Selecione texto ou ative o modo etiquetas.');
        return;
    }
    const hlBgs = { yellow:'#fef9c3', green:'#dcfce7', blue:'#dbeafe', pink:'#fce7f3' };
    const stickyAccent = {check:'#16a34a',done:'#2563eb',review:'#d97706',important:'#fbbf24',question:'#7c3aed',pin:'#dc2626'};

    el.innerHTML = all.map(it => {
        if (it.type === 'sticky') {
            const t = STICKY_TAGS[it.tag] || STICKY_TAGS.pin;
            return `<div class="p-2.5 cursor-pointer hover:opacity-90" onclick="readerGoToPage(${it.page_number});setTimeout(()=>openStickyEditModal(${JSON.stringify(it).replace(/"/g,'&quot;')}),100)" style="background:var(--bg-2); border-radius: 3px; border-left: 3px solid ${stickyAccent[it.tag] || '#dc2626'};">
                <div class="flex items-center justify-between mb-1">
                    <span class="sticky-note sticky-tag-${it.tag}" style="position:static;box-shadow:none;padding:2px 7px;font-size:10px;cursor:default;">
                        <i class="fa-solid ${t.icon}"></i>${t.label}
                    </span>
                    <button onclick="event.stopPropagation();deleteSticky('${it.id}')" style="color:var(--text-5)"><i class="fa-solid fa-xmark text-[10px]"></i></button>
                </div>
                <p class="text-[10.5px] mono mt-1" style="color:var(--text-4)">pg. ${it.page_number}</p>
                ${it.note_text ? `<p class="text-[12px] mt-1" style="color:var(--text)">${it.note_text}</p>` : ''}
            </div>`;
        }
        const isHL = it.type === 'highlight';
        const bg = isHL ? (hlBgs[it.color] || hlBgs.yellow) : 'var(--bg-2)';
        const preview = isHL
            ? `<p class="text-[12px] line-clamp-3" style="color:var(--text); white-space: pre-wrap;">${it.selected_text}</p>`
            : `<div class="md-body" style="font-size:11.5px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${renderMarkdown(it.note_text)}</div>`;
        return `<div class="p-2.5 cursor-pointer hover:opacity-90" onclick="readerGoToPage(${it.page_number})" style="background:${bg}; border-radius: 3px; border-left: 2px solid ${isHL ? '#ca8a04' : 'var(--warning)'};">
            <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] mono uppercase font-medium" style="color:var(--text-4); letter-spacing:.04em;">
                    <i class="fa-solid fa-${isHL ? 'highlighter' : 'note-sticky'} text-[9px]"></i> pg. ${it.page_number}
                </span>
                <button onclick="event.stopPropagation();deleteNote('${it.id}','${it.type}')" style="color:var(--text-5)"><i class="fa-solid fa-xmark text-[10px]"></i></button>
            </div>
            ${preview}
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
