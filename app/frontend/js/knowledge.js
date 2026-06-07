/* ═══════════════════════════════════════════════════════════════════════
   knowledge.js — Grafo de Conhecimento (vis.js)
   ═══════════════════════════════════════════════════════════════════════ */

let _visNetwork = null;

async function showKnowledgeGraph() {
    setActive('menu-grafo');
    setPage('Mapa de Conhecimento', 'Análise');
    document.getElementById('mainContent').innerHTML = `<div class="page-shell">${loadingBlock()}</div>`;

    const subjectOpts = (subjects || []).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');

    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell" style="display:flex; flex-direction:column; height: calc(100vh - var(--topbar-h) - 40px);">
        <div class="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <div>
                <h1 class="page-title">Mapa de Conhecimento</h1>
                <p class="page-sub">Conexões entre matérias, livros, notas e flashcards</p>
            </div>
            <div class="flex gap-2 items-center flex-wrap">
                <select id="kg-subject" class="input" style="width:auto; padding: 5px 28px 5px 8px;" onchange="loadKnowledgeGraph()">
                    <option value="">Todas as matérias</option>
                    ${subjectOpts}
                </select>
                <label class="flex items-center gap-1.5 text-[12px]"><input type="checkbox" id="kg-hl" onchange="loadKnowledgeGraph()"> Grifos</label>
                <label class="flex items-center gap-1.5 text-[12px]"><input type="checkbox" id="kg-ann" onchange="loadKnowledgeGraph()"> Etiquetas</label>
                <button onclick="kgFit()" class="btn btn-sm"><i class="fa-solid fa-expand text-[10px]"></i> Centralizar</button>
            </div>
        </div>

        <div class="card" style="flex:1; min-height: 500px; display: flex; flex-direction: column;">
            <div id="kg-stats" class="card-header"><span class="card-sub">Carregando…</span></div>
            <div id="kg-container" style="flex:1; min-height: 400px; background: var(--surface);"></div>
        </div>

        <div class="flex gap-3 mt-3 text-[11.5px] flex-wrap" style="color:var(--text-4)">
            <span><i class="fa-solid fa-circle" style="color:#2563eb"></i> Matéria</span>
            <span><i class="fa-solid fa-circle" style="color:#16a34a"></i> Livro</span>
            <span><i class="fa-solid fa-circle" style="color:#7c3aed"></i> Flashcard</span>
            <span><i class="fa-solid fa-circle" style="color:#f59e0b"></i> Nota</span>
            <span><i class="fa-solid fa-circle" style="color:#ec4899"></i> Coleção</span>
            <span><i class="fa-solid fa-circle" style="color:#facc15"></i> Grifo</span>
            <span><i class="fa-solid fa-circle" style="color:#dc2626"></i> Etiqueta</span>
        </div>
    </div>`;

    await loadKnowledgeGraph();
}

async function loadKnowledgeGraph() {
    const subjectId = document.getElementById('kg-subject')?.value || '';
    const hl = document.getElementById('kg-hl')?.checked ? '1' : '0';
    const ann = document.getElementById('kg-ann')?.checked ? '1' : '0';
    let url = '/knowledge/graph?include_highlights=' + (hl === '1' ? 'true' : 'false') + '&include_annotations=' + (ann === '1' ? 'true' : 'false');
    if (subjectId) url += '&subject_id=' + subjectId;

    try {
        const data = await api(url);
        renderGraph(data);
    } catch (e) {
        document.getElementById('kg-container').innerHTML = emptyState('fa-triangle-exclamation', 'Erro ao carregar', e.message);
    }
}

async function loadVisJs() {
    if (window.vis) return window.vis;
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/vis-network@9.1.9/standalone/umd/vis-network.min.js';
        s.onload = () => resolve(window.vis);
        s.onerror = () => reject(new Error('Falha ao carregar vis.js'));
        document.head.appendChild(s);
    });
}

async function renderGraph(data) {
    await loadVisJs();
    const container = document.getElementById('kg-container');
    if (!container) return;

    if (data.nodes.length === 0) {
        container.innerHTML = emptyState('fa-circle-nodes', 'Grafo vazio', 'Crie matérias, livros, notas e flashcards pra ver as relações.');
        return;
    }

    const stats = document.getElementById('kg-stats');
    if (stats) stats.innerHTML = `<span class="card-sub">${data.stats.subjects} matérias · ${data.stats.books} livros · ${data.stats.flashcards} cards · ${data.stats.notes} notas · ${data.stats.collections} coleções</span>`;

    const groupColors = {
        subject:    { bg: '#2563eb', border: '#1d4ed8', text: 'white' },
        book:       { bg: '#16a34a', border: '#15803d', text: 'white' },
        flashcard:  { bg: '#7c3aed', border: '#6d28d9', text: 'white' },
        note:       { bg: '#f59e0b', border: '#d97706', text: 'white' },
        collection: { bg: '#ec4899', border: '#db2777', text: 'white' },
        highlight:  { bg: '#facc15', border: '#ca8a04', text: '#422006' },
        annotation: { bg: '#dc2626', border: '#b91c1c', text: 'white' },
    };

    const visNodes = data.nodes.map(n => ({
        id: n.id,
        label: n.label,
        title: n.title,
        group: n.group,
        color: {
            background: groupColors[n.group]?.bg || '#71717a',
            border: groupColors[n.group]?.border || '#52525b',
            highlight: { background: groupColors[n.group]?.bg, border: '#000' },
        },
        font: { color: groupColors[n.group]?.text || '#fff', size: n.group === 'subject' ? 14 : 11 },
        shape: n.group === 'subject' ? 'box' : n.group === 'collection' ? 'diamond' : 'dot',
        size: n.group === 'subject' ? 22 : n.group === 'collection' ? 16 : 12,
    }));
    const visEdges = data.edges.map((e, i) => ({
        id: 'e' + i,
        from: e.from, to: e.to,
        label: e.label || undefined,
        arrows: 'to',
        color: { color: '#a1a1aa', opacity: 0.5 },
        font: { size: 9, color: '#71717a', strokeWidth: 0 },
        smooth: { type: 'continuous' },
    }));

    const ds = new vis.DataSet(visNodes);
    const es = new vis.DataSet(visEdges);

    const options = {
        layout: { improvedLayout: true },
        physics: {
            barnesHut: { gravitationalConstant: -8000, centralGravity: 0.2, springLength: 110, springConstant: 0.05 },
            stabilization: { iterations: 200 },
        },
        nodes: { borderWidth: 2 },
        edges: { width: 1, hoverWidth: 2 },
        interaction: { hover: true, navigationButtons: true, keyboard: true },
    };

    if (_visNetwork) { _visNetwork.destroy(); _visNetwork = null; }
    _visNetwork = new vis.Network(container, { nodes: ds, edges: es }, options);

    _visNetwork.on('doubleClick', (params) => {
        if (!params.nodes.length) return;
        const nodeId = params.nodes[0];
        // Navega pra entidade
        if (nodeId.startsWith('sub_')) {
            showSubjects();
        } else if (nodeId.startsWith('book_')) {
            const id = nodeId.slice(5);
            openBookReader(id);
        } else if (nodeId.startsWith('card_')) {
            showFlashcards();
        } else if (nodeId.startsWith('note_')) {
            const id = nodeId.slice(5);
            openNoteEditor(id);
        }
    });
}

function kgFit() {
    if (_visNetwork) _visNetwork.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
}
