/* ═══════════════════════════════════════════════════════════════════════
   notes.js — Editor Acadêmico (Fase 3+4)
   Rich text + Canvas manuscrito (SPen/touch) + OCR Tesseract.js
   ═══════════════════════════════════════════════════════════════════════ */

let _currentNote = null;
let _editorAutoSaveTimer = null;
let _canvasState = null;   // { ctx, paths, isDrawing, color, size, mode }

async function showNotes() {
    setActive('menu-notas');
    setPage('Notas', 'Acervo');
    document.getElementById('mainContent').innerHTML = `<div class="page-shell">${loadingBlock()}</div>`;
    try {
        const notes = await api('/notes/');
        renderNotesList(notes);
    } catch (e) {
        document.getElementById('mainContent').innerHTML = `<div class="page-shell">${emptyState('fa-triangle-exclamation', 'Erro', e.message)}</div>`;
    }
}

function renderNotesList(notes) {
    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5 flex-wrap gap-2">
            <div>
                <h1 class="page-title">Notas</h1>
                <p class="page-sub">${notes.length} ${notes.length === 1 ? 'nota' : 'notas'} no seu caderno digital</p>
            </div>
            <div class="flex gap-2 flex-wrap">
                <button onclick="openNoteEditor(null,'text')" class="btn"><i class="fa-solid fa-pen text-[10px]"></i> Texto</button>
                <button onclick="openNoteEditor(null,'handwriting')" class="btn"><i class="fa-solid fa-signature text-[10px]"></i> Manuscrito</button>
                <button onclick="openNoteEditor(null,'hybrid')" class="btn btn-primary"><i class="fa-solid fa-plus text-[10px]"></i> Híbrido</button>
            </div>
        </div>

        ${notes.length === 0 ? `<div class="card"><div class="card-body">${emptyState('fa-book', 'Sem notas ainda', 'Crie um resumo, um manuscrito ou um documento híbrido.')}</div></div>` :
        `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            ${notes.map(n => {
                const icon = n.kind === 'handwriting' ? 'fa-signature' : n.kind === 'hybrid' ? 'fa-layer-group' : 'fa-file-lines';
                const kindLabel = { text: 'Texto', handwriting: 'Manuscrito', hybrid: 'Híbrido' }[n.kind] || 'Texto';
                const preview = n.content_plain ? n.content_plain.slice(0, 140) : (n.canvas_svg ? '(desenho manuscrito)' : 'Vazia');
                return `
                <div onclick="openNoteEditor('${n.id}')" class="card cursor-pointer hover:opacity-90" style="transition: transform .12s, box-shadow .12s" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,.06)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                    <div class="card-body" style="padding: 14px;">
                        <div class="flex items-center justify-between mb-2">
                            <span class="badge badge-default"><i class="fa-solid ${icon} text-[9px]"></i>${kindLabel}</span>
                            <span class="text-[10.5px] mono" style="color:var(--text-5)">${fmtShortDate(n.updated_at)}</span>
                        </div>
                        <p class="text-[13.5px] font-semibold mb-1.5" style="color:var(--text); line-height:1.3;">${esc(n.title)}</p>
                        <p class="text-[12px] line-clamp-3" style="color:var(--text-3); line-height:1.45;">${esc(preview)}</p>
                        ${n.subject_name ? `<p class="text-[10.5px] mono mt-2" style="color:var(--text-4)">${esc(n.subject_name)}</p>` : ''}
                    </div>
                </div>`;
            }).join('')}
        </div>`}
    </div>`;
}

// ─── Editor (modal full-screen) ──────────────────────────────────────────

async function openNoteEditor(noteId, defaultKind = 'text') {
    let note;
    if (noteId) {
        try { note = await api(`/notes/${noteId}`); }
        catch (e) { toast(e.message, 'error'); return; }
    } else {
        note = {
            id: null, title: 'Nova nota', kind: defaultKind,
            content_html: '', canvas_svg: '', subject_id: null, book_id: null, tags: null,
        };
    }
    _currentNote = note;
    const subjectOpts = (subjects || []).map(s => `<option value="${s.id}" ${note.subject_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');

    const showText = note.kind === 'text' || note.kind === 'hybrid';
    const showCanvas = note.kind === 'handwriting' || note.kind === 'hybrid';

    openModal(`
    <div class="note-editor">
        <div class="note-editor-head">
            <input type="text" id="ne-title" class="note-title-input" placeholder="Título da nota" value="${esc(note.title)}" maxlength="255">
            <div class="flex items-center gap-2 flex-wrap">
                <select id="ne-subject" class="input" style="width:auto; min-width: 140px; padding: 5px 28px 5px 8px;">
                    <option value="">Sem matéria</option>${subjectOpts}
                </select>
                <select id="ne-kind" class="input" style="width:auto; padding: 5px 28px 5px 8px;" onchange="switchNoteKind(this.value)">
                    <option value="text" ${note.kind==='text'?'selected':''}>Texto</option>
                    <option value="handwriting" ${note.kind==='handwriting'?'selected':''}>Manuscrito</option>
                    <option value="hybrid" ${note.kind==='hybrid'?'selected':''}>Híbrido</option>
                </select>
                <span class="text-[11px] mono" id="ne-status" style="color:var(--text-5)">${note.id ? 'Salvo' : 'Não salvo'}</span>
                <button onclick="closeNoteEditor()" class="btn btn-sm"><i class="fa-solid fa-xmark text-[10px]"></i> Fechar</button>
            </div>
        </div>

        <div class="note-editor-body">
            <div id="ne-text-pane" style="display:${showText ? 'flex' : 'none'}; flex-direction:column; flex: 1; min-height: 0;">
                <div class="note-toolbar">
                    <button onclick="execEditor('bold')" title="Negrito (Ctrl+B)"><i class="fa-solid fa-bold"></i></button>
                    <button onclick="execEditor('italic')" title="Itálico (Ctrl+I)"><i class="fa-solid fa-italic"></i></button>
                    <button onclick="execEditor('underline')" title="Sublinhado (Ctrl+U)"><i class="fa-solid fa-underline"></i></button>
                    <button onclick="execEditor('strikeThrough')" title="Tachado"><i class="fa-solid fa-strikethrough"></i></button>
                    <span class="note-toolbar-sep"></span>
                    <button onclick="execEditor('formatBlock','h2')" title="Título"><i class="fa-solid fa-heading"></i></button>
                    <button onclick="execEditor('formatBlock','h3')" title="Subtítulo" style="font-size:11px"><b>H3</b></button>
                    <button onclick="execEditor('formatBlock','p')" title="Parágrafo"><i class="fa-solid fa-paragraph"></i></button>
                    <span class="note-toolbar-sep"></span>
                    <button onclick="execEditor('insertUnorderedList')" title="Lista"><i class="fa-solid fa-list-ul"></i></button>
                    <button onclick="execEditor('insertOrderedList')" title="Lista numerada"><i class="fa-solid fa-list-ol"></i></button>
                    <button onclick="execEditor('formatBlock','blockquote')" title="Citação"><i class="fa-solid fa-quote-right"></i></button>
                    <span class="note-toolbar-sep"></span>
                    <input type="color" id="ne-color" oninput="execEditor('foreColor',this.value)" title="Cor" style="width:28px;height:28px;border:none;background:none;cursor:pointer">
                    <button onclick="askLink()" title="Link"><i class="fa-solid fa-link"></i></button>
                    <button onclick="insertInlineDrawing()" title="Inserir desenho aqui (canvas inline)" class="btn-inline"><i class="fa-solid fa-signature"></i></button>
                    <button onclick="insertTable()" title="Inserir tabela 3x3"><i class="fa-solid fa-table"></i></button>
                    <button onclick="convertNoteSelectionToFlashcard()" title="Trecho → Flashcard" class="btn-fc"><i class="fa-solid fa-layer-group"></i></button>
                </div>
                <div id="ne-editor" class="note-editor-content md-body" contenteditable="true" spellcheck="true" oninput="markDirty()" onpaste="onEditorPaste(event)"></div>
            </div>

            <div id="ne-canvas-pane" style="display:${showCanvas ? 'flex' : 'none'}; flex-direction:column; flex: 1; min-height: 0; border-${note.kind==='hybrid' ? 'left' : 'top'}: 1px solid var(--border);">
                <div class="note-toolbar">
                    <button onclick="setCanvasMode('pen')" id="cv-pen" class="cv-tool is-active" title="Caneta"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="setCanvasMode('highlighter')" id="cv-hl" class="cv-tool" title="Marca-texto"><i class="fa-solid fa-highlighter"></i></button>
                    <button onclick="setCanvasMode('eraser')" id="cv-er" class="cv-tool" title="Borracha"><i class="fa-solid fa-eraser"></i></button>
                    <span class="note-toolbar-sep"></span>
                    <input type="color" id="cv-color" value="#1f2937" oninput="setCanvasColor(this.value)" title="Cor" style="width:28px;height:28px;border:none;background:none;cursor:pointer">
                    <input type="range" id="cv-size" min="1" max="20" value="2" oninput="setCanvasSize(this.value)" title="Espessura" style="width:80px">
                    <span class="note-toolbar-sep"></span>
                    <button onclick="undoCanvas()" title="Desfazer (Ctrl+Z)"><i class="fa-solid fa-rotate-left"></i></button>
                    <button onclick="clearCanvas()" title="Limpar tudo"><i class="fa-solid fa-trash"></i></button>
                    <span class="note-toolbar-sep"></span>
                    <button onclick="runOCR()" title="Reconhecer texto manuscrito (OCR)" class="btn-ocr">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> OCR
                    </button>
                </div>
                <div class="note-canvas-wrap" id="ne-canvas-wrap">
                    <canvas id="ne-canvas"></canvas>
                </div>
            </div>
        </div>

        <div class="note-editor-foot">
            <input type="text" id="ne-tags" class="input" placeholder="Tags (vírgula-separadas)" value="${esc(note.tags || '')}" style="flex:1; max-width: 300px;">
            ${note.id ? `<button onclick="deleteCurrentNote()" class="btn btn-danger btn-sm"><i class="fa-solid fa-trash text-[10px]"></i> Excluir</button>` : ''}
            <div class="ml-auto flex gap-2">
                <button onclick="saveCurrentNote()" class="btn btn-primary"><i class="fa-solid fa-floppy-disk text-[10px]"></i> Salvar</button>
            </div>
        </div>
    </div>
    `);

    // Carregar conteúdo
    const editor = document.getElementById('ne-editor');
    if (editor) editor.innerHTML = note.content_html || '';

    // Inicializar canvas se necessário
    if (showCanvas) initCanvas(note.canvas_svg);

    // Auto-save
    if (_editorAutoSaveTimer) clearInterval(_editorAutoSaveTimer);
    _editorAutoSaveTimer = setInterval(() => { if (_currentNote?._dirty) saveCurrentNote(true); }, 15000);
}

function switchNoteKind(kind) {
    if (!_currentNote) return;
    _currentNote.kind = kind;
    const showText = kind === 'text' || kind === 'hybrid';
    const showCanvas = kind === 'handwriting' || kind === 'hybrid';
    document.getElementById('ne-text-pane').style.display = showText ? 'flex' : 'none';
    document.getElementById('ne-canvas-pane').style.display = showCanvas ? 'flex' : 'none';
    if (showCanvas && !_canvasState) initCanvas(_currentNote.canvas_svg);
    markDirty();
}

function closeNoteEditor() {
    if (_currentNote?._dirty && !confirm('Há alterações não salvas. Fechar mesmo assim?')) return;
    if (_editorAutoSaveTimer) { clearInterval(_editorAutoSaveTimer); _editorAutoSaveTimer = null; }
    _canvasState = null;
    closeModal();
    showNotes();
}

function markDirty() {
    if (!_currentNote) return;
    _currentNote._dirty = true;
    const s = document.getElementById('ne-status');
    if (s) { s.textContent = 'Editando…'; s.style.color = 'var(--warning)'; }
}

function execEditor(cmd, val) {
    document.execCommand(cmd, false, val);
    document.getElementById('ne-editor')?.focus();
    markDirty();
}

function askLink() {
    const url = prompt('Cole o link (https://...):');
    if (url && /^https?:\/\//.test(url)) execEditor('createLink', url);
}

function onEditorPaste(e) {
    // Cola apenas texto plano (evita HTML lixo de outros sites)
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
}

async function saveCurrentNote(silent = false) {
    if (!_currentNote) return;
    const title = document.getElementById('ne-title').value.trim();
    if (!title) { toast('Título é obrigatório.', 'warning'); return; }

    const content_html = document.getElementById('ne-editor')?.innerHTML || '';
    const subject_id = document.getElementById('ne-subject').value || null;
    const tags = document.getElementById('ne-tags').value.trim() || null;
    const kind = document.getElementById('ne-kind').value;
    const canvas_svg = (kind !== 'text' && _canvasState) ? canvasToSvg() : null;

    const payload = { title, kind, content_html, canvas_svg, subject_id, tags };

    try {
        let saved;
        if (_currentNote.id) {
            saved = await api(`/notes/${_currentNote.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
            saved = await api('/notes/', { method: 'POST', body: JSON.stringify(payload) });
        }
        _currentNote = { ...saved, _dirty: false };
        const s = document.getElementById('ne-status');
        if (s) { s.textContent = `Salvo ${new Date().toLocaleTimeString('pt-BR').slice(0,5)}`; s.style.color = 'var(--success)'; }
        if (!silent) toast('Nota salva', 'success', 1500);
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteCurrentNote() {
    if (!_currentNote?.id) return;
    if (!confirm(`Excluir "${_currentNote.title}"? Esta ação não pode ser desfeita.`)) return;
    try {
        await api(`/notes/${_currentNote.id}`, { method: 'DELETE' });
        _currentNote = null;
        closeModal();
        showNotes();
        toast('Nota excluída', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

// ─── Trecho → Flashcard ──────────────────────────────────────────────────
async function convertNoteSelectionToFlashcard() {
    if (!_currentNote?.id) { toast('Salve a nota antes de criar flashcards.', 'warning'); await saveCurrentNote(true); if (!_currentNote?.id) return; }
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 3) { toast('Selecione um trecho da nota primeiro.', 'warning'); return; }
    const front = prompt(`Frente do flashcard (deixe vazio pra usar "Sobre ${_currentNote.title}"):`);
    try {
        await api(`/notes/${_currentNote.id}/to-flashcard`, {
            method: 'POST',
            body: JSON.stringify({
                selected_text: text,
                front: (front || '').trim() || null,
                difficulty: 'medium',
            }),
        });
        toast('Flashcard criado a partir do trecho', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

// ─── Canvas SPen/touch ───────────────────────────────────────────────────
function initCanvas(svgOrEmpty) {
    const wrap = document.getElementById('ne-canvas-wrap');
    const canvas = document.getElementById('ne-canvas');
    if (!wrap || !canvas) return;

    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(300, Math.floor(rect.width));
    const h = Math.max(300, Math.floor(rect.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    _canvasState = {
        canvas, ctx, dpr,
        width: w, height: h,
        paths: [],       // [{mode, color, size, points: [{x,y,p?}]}]
        currentPath: null,
        color: '#1f2937', size: 2, mode: 'pen',
    };

    // Restaura SVG (renderiza paths salvos)
    if (svgOrEmpty) restoreCanvasFromSvg(svgOrEmpty);

    // Pointer events (SPen, touch, mouse — tudo unificado)
    canvas.addEventListener('pointerdown', canvasPointerDown);
    canvas.addEventListener('pointermove', canvasPointerMove);
    canvas.addEventListener('pointerup', canvasPointerUp);
    canvas.addEventListener('pointercancel', canvasPointerUp);
    canvas.style.touchAction = 'none';  // evita gestos do navegador interferindo
}

function canvasPointerDown(e) {
    if (!_canvasState) return;
    e.preventDefault();
    const { ctx, color, size, mode } = _canvasState;
    const pt = canvasPoint(e);
    const path = { mode, color, size, points: [pt] };
    _canvasState.currentPath = path;
    _canvasState.paths.push(path);

    if (mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = size * 4;
    } else if (mode === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color + '40';  // 25% alpha
        ctx.lineWidth = size * 4;
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
    }
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    markDirty();
}

function canvasPointerMove(e) {
    if (!_canvasState?.currentPath) return;
    e.preventDefault();
    const { ctx } = _canvasState;
    const pt = canvasPoint(e);
    _canvasState.currentPath.points.push(pt);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
}

function canvasPointerUp(e) {
    if (!_canvasState) return;
    _canvasState.currentPath = null;
    _canvasState.ctx.globalCompositeOperation = 'source-over';
}

function canvasPoint(e) {
    const rect = _canvasState.canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        p: e.pressure || 0.5,
    };
}

function setCanvasMode(mode) {
    if (!_canvasState) return;
    _canvasState.mode = mode;
    ['pen','hl','er'].forEach(k => document.getElementById(`cv-${k}`)?.classList.remove('is-active'));
    document.getElementById(`cv-${mode === 'highlighter' ? 'hl' : mode === 'eraser' ? 'er' : 'pen'}`)?.classList.add('is-active');
}
function setCanvasColor(c) { if (_canvasState) _canvasState.color = c; }
function setCanvasSize(s) { if (_canvasState) _canvasState.size = parseInt(s); }

function undoCanvas() {
    if (!_canvasState || _canvasState.paths.length === 0) return;
    _canvasState.paths.pop();
    redrawCanvas();
    markDirty();
}

function clearCanvas() {
    if (!_canvasState) return;
    if (!confirm('Limpar todo o desenho?')) return;
    _canvasState.paths = [];
    redrawCanvas();
    markDirty();
}

function redrawCanvas() {
    if (!_canvasState) return;
    const { ctx, width, height, paths } = _canvasState;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    paths.forEach(p => {
        if (p.mode === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.lineWidth = p.size * 4;
        } else if (p.mode === 'highlighter') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = p.color + '40';
            ctx.lineWidth = p.size * 4;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
        }
        if (p.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(p.points[0].x, p.points[0].y);
        for (let i = 1; i < p.points.length; i++) ctx.lineTo(p.points[i].x, p.points[i].y);
        ctx.stroke();
    });
    ctx.globalCompositeOperation = 'source-over';
}

// Serializa paths como SVG (escalável + leve)
function canvasToSvg() {
    if (!_canvasState) return null;
    const { width, height, paths } = _canvasState;
    const polys = paths.map(p => {
        const opacity = p.mode === 'highlighter' ? 0.25 : 1.0;
        const strokeWidth = p.size * (p.mode === 'eraser' || p.mode === 'highlighter' ? 4 : 1);
        if (p.mode === 'eraser') return '';
        if (p.points.length < 2) return '';
        const d = `M ${p.points[0].x} ${p.points[0].y} ` + p.points.slice(1).map(pt => `L ${pt.x} ${pt.y}`).join(' ');
        return `<path d="${d}" stroke="${p.color}" stroke-width="${strokeWidth}" stroke-opacity="${opacity}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).filter(Boolean).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/>${polys}</svg>`;
}

function restoreCanvasFromSvg(svg) {
    // Reconstrução simples: extrai paths e converte de volta pra paths objects
    if (!svg || !_canvasState) return;
    const pathRe = /<path\s+d="([^"]+)"\s+stroke="([^"]+)"\s+stroke-width="([^"]+)"(?:\s+stroke-opacity="([^"]+)")?[^>]*\/>/g;
    let m;
    while ((m = pathRe.exec(svg)) !== null) {
        const [, d, color, strokeWidth, opacity] = m;
        const opacityNum = parseFloat(opacity || '1');
        const mode = opacityNum < 0.5 ? 'highlighter' : 'pen';
        const size = mode === 'highlighter' ? parseFloat(strokeWidth) / 4 : parseFloat(strokeWidth);
        const pts = [];
        const cmdRe = /([ML])\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g;
        let c;
        while ((c = cmdRe.exec(d)) !== null) pts.push({ x: parseFloat(c[2]), y: parseFloat(c[3]) });
        if (pts.length > 0) _canvasState.paths.push({ mode, color, size, points: pts });
    }
    redrawCanvas();
}

// ─── OCR via Tesseract.js (CDN, sem custo) ───────────────────────────────
let _tesseractLib = null;

async function loadTesseract() {
    if (_tesseractLib) return _tesseractLib;
    return new Promise((resolve, reject) => {
        if (window.Tesseract) { _tesseractLib = window.Tesseract; resolve(_tesseractLib); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js';
        s.onload = () => { _tesseractLib = window.Tesseract; resolve(_tesseractLib); };
        s.onerror = () => reject(new Error('Falha ao carregar Tesseract.js'));
        document.head.appendChild(s);
    });
}

async function runOCR() {
    if (!_canvasState || _canvasState.paths.length === 0) {
        toast('Desenhe algo no canvas primeiro.', 'warning');
        return;
    }
    toast('Carregando reconhecedor de texto…', 'info', 2500);
    try {
        const Tesseract = await loadTesseract();
        const dataUrl = _canvasState.canvas.toDataURL('image/png');
        toast('Reconhecendo texto (pode levar 10-30s)…', 'info', 30000);
        const { data } = await Tesseract.recognize(dataUrl, 'por', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const pct = Math.round(m.progress * 100);
                    const s = document.getElementById('ne-status');
                    if (s) { s.textContent = `OCR ${pct}%`; s.style.color = 'var(--accent)'; }
                }
            },
        });
        const text = (data.text || '').trim();
        if (!text) {
            toast('Não consegui reconhecer texto. Tente escrever mais legível ou maior.', 'warning', 4000);
            return;
        }
        // Insere no editor de texto (cria pane se necessário)
        if (_currentNote.kind === 'handwriting') {
            switchNoteKind('hybrid');
            document.getElementById('ne-kind').value = 'hybrid';
        }
        const editor = document.getElementById('ne-editor');
        if (editor) {
            const p = document.createElement('p');
            p.textContent = text;
            editor.appendChild(p);
            markDirty();
            toast(`Texto reconhecido (${text.length} chars) e inserido na nota`, 'success', 4000);
        }
        const s = document.getElementById('ne-status');
        if (s) { s.textContent = 'OCR concluído'; s.style.color = 'var(--success)'; }
    } catch (e) {
        toast('Erro no OCR: ' + e.message, 'error');
        console.error(e);
    }
}

// ─── Editor Híbrido: blocos inline (desenho + tabela) ───────────────────
function insertInlineDrawing() {
    const editor = document.getElementById('ne-editor');
    if (!editor) return;
    editor.focus();
    const id = 'inline-' + Math.random().toString(36).slice(2, 9);
    const blockHtml = `<figure data-block="drawing" class="inline-block" contenteditable="false">
        <div class="inline-block-toolbar">
            <span class="text-[10px] mono" style="color:var(--text-4)">Desenho</span>
            <button onclick="editInlineDrawing('${id}')" class="btn btn-icon btn-sm" title="Editar"><i class="fa-solid fa-pen text-[9px]"></i></button>
            <button onclick="removeInlineBlock('${id}')" class="btn btn-icon btn-sm" title="Remover" style="color:var(--danger)"><i class="fa-solid fa-trash text-[9px]"></i></button>
        </div>
        <div id="${id}" class="inline-svg-container" style="background:white;border-radius:4px;padding:8px;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="100%" height="200"><rect width="100%" height="100%" fill="white"/></svg>
        </div>
    </figure><p><br></p>`;
    document.execCommand('insertHTML', false, blockHtml);
    markDirty();
    // Abre o editor imediatamente
    setTimeout(() => editInlineDrawing(id), 50);
}

function removeInlineBlock(id) {
    const el = document.getElementById(id)?.closest('figure[data-block]');
    if (el && confirm('Remover este bloco?')) {
        el.remove();
        markDirty();
    }
}

let _inlineDrawingCtx = null;  // { containerId, paths, canvas, ctx, color, size, mode }

function editInlineDrawing(containerId) {
    // Abre um sub-modal com canvas pra editar o SVG inline
    const container = document.getElementById(containerId);
    if (!container) return;
    const existingSvg = container.querySelector('svg');
    const viewBox = existingSvg?.getAttribute('viewBox') || '0 0 600 200';
    const [, , vbW, vbH] = viewBox.split(' ').map(Number);

    // Cria overlay modal sobre o modal principal
    const overlay = document.createElement('div');
    overlay.id = 'inline-draw-overlay';
    overlay.className = 'modal-backdrop';
    overlay.style.zIndex = '1100';
    overlay.innerHTML = `
    <div class="modal-box" style="max-width: min(900px, 96vw); padding: 18px;">
        <div class="modal-head">
            <h3>Editar desenho</h3>
            <button onclick="closeInlineDrawingEditor(false)" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="note-toolbar" style="margin-bottom: 8px;">
            <button onclick="setInlineDrawMode('pen')" id="idr-pen" class="cv-tool is-active" title="Caneta"><i class="fa-solid fa-pen"></i></button>
            <button onclick="setInlineDrawMode('highlighter')" id="idr-hl" class="cv-tool" title="Marca-texto"><i class="fa-solid fa-highlighter"></i></button>
            <button onclick="setInlineDrawMode('eraser')" id="idr-er" class="cv-tool" title="Borracha"><i class="fa-solid fa-eraser"></i></button>
            <span class="note-toolbar-sep"></span>
            <input type="color" value="#1f2937" oninput="_inlineDrawingCtx && (_inlineDrawingCtx.color=this.value)" style="width:28px;height:28px;border:none;background:none">
            <input type="range" min="1" max="20" value="2" oninput="_inlineDrawingCtx && (_inlineDrawingCtx.size=parseInt(this.value))" style="width:80px">
            <span class="note-toolbar-sep"></span>
            <button onclick="undoInlineDrawing()" title="Desfazer"><i class="fa-solid fa-rotate-left"></i></button>
            <button onclick="clearInlineDrawing()" title="Limpar"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div style="background:#f9fafb; padding:8px; border-radius:4px;">
            <canvas id="inline-draw-canvas" style="background:white; display:block; max-width:100%;"></canvas>
        </div>
        <div class="flex gap-2 justify-end pt-3 mt-3" style="border-top:1px solid var(--border)">
            <button onclick="closeInlineDrawingEditor(false)" class="btn">Cancelar</button>
            <button onclick="closeInlineDrawingEditor(true)" class="btn btn-primary"><i class="fa-solid fa-check text-[10px]"></i> Aplicar</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);

    // Inicializa canvas com dimensões do SVG
    const canvas = document.getElementById('inline-draw-canvas');
    const w = Math.min(800, vbW * 1.3);
    const h = w * (vbH / vbW);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    _inlineDrawingCtx = {
        containerId, canvas, ctx, width: w, height: h, dpr,
        paths: [], currentPath: null,
        color: '#1f2937', size: 2, mode: 'pen',
        origViewBox: [vbW, vbH],
    };

    // Restaura SVG existente
    if (existingSvg) {
        const svgStr = existingSvg.outerHTML;
        restoreInlinePaths(svgStr, w, h, vbW, vbH);
    }

    canvas.addEventListener('pointerdown', inlinePointerDown);
    canvas.addEventListener('pointermove', inlinePointerMove);
    canvas.addEventListener('pointerup', inlinePointerUp);
    canvas.addEventListener('pointercancel', inlinePointerUp);
    canvas.style.touchAction = 'none';
}

function setInlineDrawMode(m) {
    if (!_inlineDrawingCtx) return;
    _inlineDrawingCtx.mode = m;
    ['pen','hl','er'].forEach(k => document.getElementById(`idr-${k}`)?.classList.remove('is-active'));
    document.getElementById(`idr-${m === 'highlighter' ? 'hl' : m === 'eraser' ? 'er' : 'pen'}`)?.classList.add('is-active');
}

function inlinePointerDown(e) {
    if (!_inlineDrawingCtx) return;
    e.preventDefault();
    const c = _inlineDrawingCtx;
    const pt = inlinePoint(e);
    const path = { mode: c.mode, color: c.color, size: c.size, points: [pt] };
    c.currentPath = path;
    c.paths.push(path);
    if (c.mode === 'eraser') {
        c.ctx.globalCompositeOperation = 'destination-out';
        c.ctx.strokeStyle = 'rgba(0,0,0,1)';
        c.ctx.lineWidth = c.size * 4;
    } else if (c.mode === 'highlighter') {
        c.ctx.globalCompositeOperation = 'source-over';
        c.ctx.strokeStyle = c.color + '40';
        c.ctx.lineWidth = c.size * 4;
    } else {
        c.ctx.globalCompositeOperation = 'source-over';
        c.ctx.strokeStyle = c.color;
        c.ctx.lineWidth = c.size;
    }
    c.ctx.beginPath();
    c.ctx.moveTo(pt.x, pt.y);
}

function inlinePointerMove(e) {
    if (!_inlineDrawingCtx?.currentPath) return;
    e.preventDefault();
    const pt = inlinePoint(e);
    _inlineDrawingCtx.currentPath.points.push(pt);
    _inlineDrawingCtx.ctx.lineTo(pt.x, pt.y);
    _inlineDrawingCtx.ctx.stroke();
}

function inlinePointerUp() {
    if (!_inlineDrawingCtx) return;
    _inlineDrawingCtx.currentPath = null;
    _inlineDrawingCtx.ctx.globalCompositeOperation = 'source-over';
}

function inlinePoint(e) {
    const r = _inlineDrawingCtx.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function undoInlineDrawing() {
    if (!_inlineDrawingCtx?.paths.length) return;
    _inlineDrawingCtx.paths.pop();
    redrawInlineCanvas();
}
function clearInlineDrawing() {
    if (!_inlineDrawingCtx || !confirm('Limpar tudo?')) return;
    _inlineDrawingCtx.paths = [];
    redrawInlineCanvas();
}
function redrawInlineCanvas() {
    const c = _inlineDrawingCtx;
    if (!c) return;
    c.ctx.globalCompositeOperation = 'source-over';
    c.ctx.fillStyle = 'white';
    c.ctx.fillRect(0, 0, c.width, c.height);
    c.paths.forEach(p => {
        if (p.mode === 'eraser') {
            c.ctx.globalCompositeOperation = 'destination-out';
            c.ctx.strokeStyle = 'rgba(0,0,0,1)';
            c.ctx.lineWidth = p.size * 4;
        } else if (p.mode === 'highlighter') {
            c.ctx.globalCompositeOperation = 'source-over';
            c.ctx.strokeStyle = p.color + '40';
            c.ctx.lineWidth = p.size * 4;
        } else {
            c.ctx.globalCompositeOperation = 'source-over';
            c.ctx.strokeStyle = p.color;
            c.ctx.lineWidth = p.size;
        }
        if (p.points.length < 2) return;
        c.ctx.beginPath();
        c.ctx.moveTo(p.points[0].x, p.points[0].y);
        for (let i = 1; i < p.points.length; i++) c.ctx.lineTo(p.points[i].x, p.points[i].y);
        c.ctx.stroke();
    });
    c.ctx.globalCompositeOperation = 'source-over';
}

function restoreInlinePaths(svgStr, w, h, origW, origH) {
    const sx = w / origW, sy = h / origH;
    const pathRe = /<path\s+d="([^"]+)"\s+stroke="([^"]+)"\s+stroke-width="([^"]+)"(?:\s+stroke-opacity="([^"]+)")?[^>]*\/>/g;
    let m;
    while ((m = pathRe.exec(svgStr)) !== null) {
        const [, d, color, strokeWidth, opacity] = m;
        const opacityNum = parseFloat(opacity || '1');
        const mode = opacityNum < 0.5 ? 'highlighter' : 'pen';
        const baseSize = mode === 'highlighter' ? parseFloat(strokeWidth) / 4 : parseFloat(strokeWidth);
        const pts = [];
        const cmdRe = /([ML])\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g;
        let c;
        while ((c = cmdRe.exec(d)) !== null) pts.push({ x: parseFloat(c[2]) * sx, y: parseFloat(c[3]) * sy });
        if (pts.length > 0) _inlineDrawingCtx.paths.push({ mode, color, size: baseSize, points: pts });
    }
    redrawInlineCanvas();
}

function closeInlineDrawingEditor(apply) {
    const overlay = document.getElementById('inline-draw-overlay');
    if (!_inlineDrawingCtx) { overlay?.remove(); return; }
    if (apply) {
        const c = _inlineDrawingCtx;
        // Converte paths em SVG (em coords originais do viewBox pra ser nítido em qualquer tamanho)
        const vbW = c.origViewBox[0], vbH = c.origViewBox[1];
        const sx = vbW / c.width, sy = vbH / c.height;
        const polys = c.paths.filter(p => p.mode !== 'eraser' && p.points.length >= 2).map(p => {
            const opacity = p.mode === 'highlighter' ? 0.25 : 1.0;
            const strokeWidth = p.size * (p.mode === 'highlighter' ? 4 : 1);
            const d = `M ${(p.points[0].x * sx).toFixed(1)} ${(p.points[0].y * sy).toFixed(1)} ` +
                p.points.slice(1).map(pt => `L ${(pt.x * sx).toFixed(1)} ${(pt.y * sy).toFixed(1)}`).join(' ');
            return `<path d="${d}" stroke="${p.color}" stroke-width="${strokeWidth.toFixed(1)}" stroke-opacity="${opacity}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
        }).join('');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="100%" height="200"><rect width="100%" height="100%" fill="white"/>${polys}</svg>`;
        const container = document.getElementById(c.containerId);
        if (container) container.innerHTML = svg;
        markDirty();
    }
    _inlineDrawingCtx = null;
    overlay?.remove();
}

function insertTable() {
    const html = `<table class="hybrid-tbl"><thead><tr><th>Coluna 1</th><th>Coluna 2</th><th>Coluna 3</th></tr></thead><tbody><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><p><br></p>`;
    document.execCommand('insertHTML', false, html);
    markDirty();
}

// Ctrl+S para salvar dentro do editor
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && _currentNote) {
        e.preventDefault();
        saveCurrentNote();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && _canvasState && document.getElementById('ne-canvas-pane').style.display !== 'none') {
        e.preventDefault();
        undoCanvas();
    }
});
