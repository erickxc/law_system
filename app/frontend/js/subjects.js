/* ═══════════════════════════════════════════════════════════════════════
   subjects.js — CRUD de matérias
   ═══════════════════════════════════════════════════════════════════════ */

async function showSubjects() {
    setActive('menu-materias');
    setPage('Matérias', 'Acervo');
    subjects = await api('/subjects/').catch(() => []);
    renderSubjects();
}

function renderSubjects() {
    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5">
            <div>
                <h1 class="page-title">Matérias</h1>
                <p class="page-sub">${subjects.length} cadastrada${subjects.length !== 1 ? 's' : ''}</p>
            </div>
            <button onclick="openSubjectModal()" class="btn btn-primary"><i class="fa-solid fa-plus text-[10px]"></i> Nova matéria</button>
        </div>

        ${subjects.length === 0 ? `<div class="card"><div class="card-body">${emptyState('fa-book-bookmark','Nenhuma matéria cadastrada','Adicione sua primeira matéria.')}</div></div>` :
        `<div class="card">
            <table class="tbl">
                <thead>
                    <tr>
                        <th style="width:32px">#</th>
                        <th>Matéria</th>
                        <th style="width:80px">Sigla</th>
                        <th style="width:80px">Período</th>
                        <th style="width:90px">Prioridade</th>
                        <th style="width:140px">Status</th>
                        <th>Professor</th>
                        <th style="width:90px" class="actions">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${subjects.map((s, i) => `
                    <tr>
                        <td class="id">${String(i+1).padStart(2,'0')}</td>
                        <td style="color:var(--text); font-weight: 500;">${s.name}</td>
                        <td class="mono text-[11.5px]" style="color:var(--text-3)">${s.sigla || '—'}</td>
                        <td class="num">${s.period}º</td>
                        <td><span class="badge badge-${s.priority.toLowerCase()}">${s.priority}</span></td>
                        <td>
                            <select onchange="updateSubjectStatus('${s.id}',this.value)" class="input" style="padding: 3px 22px 3px 8px; font-size: 11.5px;">
                                <option value="Pendente" ${s.status==='Pendente'?'selected':''}>Pendente</option>
                                <option value="Em Curso" ${s.status==='Em Curso'?'selected':''}>Em Curso</option>
                                <option value="Concluída" ${s.status==='Concluída'?'selected':''}>Concluída</option>
                            </select>
                        </td>
                        <td style="color:var(--text-3)">${s.no_teacher ? '<span style="color:var(--text-5)">— sem prof.</span>' : (s.teacher_name || '<span style="color:var(--text-5)">n/d</span>')}</td>
                        <td class="actions">
                            <button onclick="openShareModal('${s.id}')" class="btn btn-icon btn-sm" title="Compartilhar deck">
                                <i class="fa-solid fa-${s.share_token ? 'link' : 'share-nodes'} text-[10px]" ${s.share_token ? 'style="color:var(--accent)"' : ''}></i>
                            </button>
                            <button onclick="openSubjectModal('${s.id}')" class="btn btn-icon btn-sm" title="Editar"><i class="fa-solid fa-pen text-[10px]"></i></button>
                            <button onclick="deleteSubject('${s.id}','${escAttr(s.name)}')" class="btn btn-icon btn-sm" title="Excluir"><i class="fa-solid fa-trash text-[10px]"></i></button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`}
    </div>`;
}

async function updateSubjectStatus(id, status) {
    try {
        await api(`/subjects/${id}/status?s_status=${encodeURIComponent(status)}`, { method: 'PATCH' });
        subjects = await api('/subjects/');
        renderSubjects();
        toast(`Status atualizado para "${status}"`, 'success');
    } catch (e) { toast(e.message, 'error'); }
}

function openSubjectModal(id = null) {
    editingSubjectId = id;
    const s = id ? subjects.find(x => x.id === id) : null;
    const teacherOpts = teachers.map(t => `<option value="${t.id}" ${s && s.teacher_id === t.id ? 'selected' : ''}>${t.name}</option>`).join('');

    openModal(`
    <div class="modal-head">
        <h3>${id ? 'Editar matéria' : 'Nova matéria'}</h3>
        <button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <form onsubmit="saveSubject(event)" class="space-y-3">
        <div><label class="label">Nome *</label><input class="input" id="s-name" value="${s?.name||''}" required placeholder="Ex.: Direito Civil"></div>
        <div class="grid grid-cols-2 gap-3">
            <div><label class="label">Sigla</label><input class="input" id="s-sigla" value="${s?.sigla||''}" placeholder="DIR_CIV"></div>
            <div><label class="label">Período *</label><input type="number" class="input mono" id="s-period" value="${s?.period||1}" min="1" max="12" required></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div><label class="label">Prioridade</label>
                <select class="input" id="s-priority">
                    <option value="Alta" ${s?.priority==='Alta'?'selected':''}>Alta</option>
                    <option value="Média" ${!s||s?.priority==='Média'?'selected':''}>Média</option>
                    <option value="Baixa" ${s?.priority==='Baixa'?'selected':''}>Baixa</option>
                </select>
            </div>
            <div><label class="label">Professor</label>
                <select class="input" id="s-teacher">
                    <option value="">Selecione…</option>
                    ${teacherOpts}
                    <option value="NONE" ${s?.no_teacher?'selected':''}>Sem professor</option>
                </select>
            </div>
        </div>
        <div class="flex gap-2 justify-end pt-2">
            <button type="button" onclick="closeModal()" class="btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
    </form>`);
}

async function saveSubject(e) {
    e.preventDefault();
    const teacherVal = document.getElementById('s-teacher').value;
    const data = {
        name: document.getElementById('s-name').value.trim(),
        sigla: document.getElementById('s-sigla').value.trim() || null,
        period: parseInt(document.getElementById('s-period').value),
        priority: document.getElementById('s-priority').value,
        no_teacher: teacherVal === 'NONE',
        teacher_id: (teacherVal && teacherVal !== 'NONE') ? teacherVal : null,
    };
    try {
        if (editingSubjectId) {
            await api(`/subjects/${editingSubjectId}`, { method: 'PUT', body: JSON.stringify(data) });
            toast('Matéria atualizada', 'success');
        } else {
            await api('/subjects/', { method: 'POST', body: JSON.stringify(data) });
            toast('Matéria criada', 'success');
        }
        subjects = await api('/subjects/');
        closeModal();
        renderSubjects();
    } catch (e) { toast(e.message, 'error'); }
}

// ─── Compartilhamento de deck ────────────────────────────────────────────
async function openShareModal(subjectId) {
    const s = subjects.find(x => x.id === subjectId);
    if (!s) return;
    const baseUrl = location.origin;
    let token = s.share_token;
    const renderModal = (token) => {
        const url = token ? `${baseUrl}/d/${token}` : null;
        openModal(`
        <div class="modal-head">
            <h3>Compartilhar deck</h3>
            <button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p class="text-[12.5px] mb-3" style="color:var(--text-3)">Compartilhe todos os flashcards de <strong>${s.name}</strong> em um link público (somente leitura). Útil pra estudar em grupo ou enviar pra colegas.</p>
        ${token ? `
        <div style="background:var(--bg-2); padding: 12px; border-radius: 6px; border: 1px solid var(--border);">
            <p class="text-[10.5px] uppercase tracking-wider mb-2" style="color:var(--text-4)">Link público</p>
            <div class="flex items-center gap-2">
                <input type="text" id="share-url" class="input mono text-[12px]" readonly value="${url}">
                <button onclick="copyShareUrl()" class="btn btn-primary"><i class="fa-solid fa-copy text-[10px]"></i></button>
            </div>
            <p class="help mt-2"><i class="fa-solid fa-eye text-[10px]"></i> Qualquer pessoa com o link vê só pergunta/resposta. Não vê dados pessoais.</p>
        </div>
        <div class="flex gap-2 justify-between pt-3 mt-3" style="border-top:1px solid var(--border)">
            <button onclick="regenerateShare('${subjectId}')" class="btn"><i class="fa-solid fa-rotate text-[10px]"></i> Gerar novo link</button>
            <button onclick="revokeShare('${subjectId}')" class="btn btn-danger"><i class="fa-solid fa-link-slash text-[10px]"></i> Revogar acesso</button>
        </div>
        ` : `
        <div class="flex gap-2 justify-end pt-3">
            <button onclick="closeModal()" class="btn">Cancelar</button>
            <button onclick="enableShare('${subjectId}')" class="btn btn-primary"><i class="fa-solid fa-share-nodes text-[10px]"></i> Gerar link</button>
        </div>
        `}`);
    };
    renderModal(token);
}

async function enableShare(subjectId) {
    try {
        const r = await api(`/subjects/${subjectId}/share`, { method: 'POST' });
        // Atualiza cache local
        const s = subjects.find(x => x.id === subjectId);
        if (s) s.share_token = r.share_token;
        closeModal();
        openShareModal(subjectId);
        toast('Link gerado', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

async function regenerateShare(subjectId) {
    if (!confirm('Gerar novo link? O link atual deixará de funcionar.')) return;
    return enableShare(subjectId);
}

async function revokeShare(subjectId) {
    if (!confirm('Revogar acesso? O link atual deixará de funcionar imediatamente.')) return;
    try {
        await api(`/subjects/${subjectId}/share`, { method: 'DELETE' });
        const s = subjects.find(x => x.id === subjectId);
        if (s) s.share_token = null;
        closeModal();
        renderSubjects();
        toast('Acesso revogado', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

function copyShareUrl() {
    const inp = document.getElementById('share-url');
    inp.select();
    navigator.clipboard?.writeText(inp.value);
    toast('Link copiado', 'success');
}

async function deleteSubject(id, name) {
    if (!confirm(`Excluir "${name}"?`)) return;
    try {
        await api(`/subjects/${id}`, { method: 'DELETE' });
        subjects = subjects.filter(s => s.id !== id);
        renderSubjects();
        toast('Matéria excluída', 'success');
    } catch (e) { toast(e.message, 'error'); }
}
