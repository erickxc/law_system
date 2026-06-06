/* ═══════════════════════════════════════════════════════════════════════
   teachers.js — CRUD de docentes
   ═══════════════════════════════════════════════════════════════════════ */

async function showTeachers() {
    setActive('menu-docentes');
    setPage('Docentes', 'Acervo');
    teachers = await api('/teachers/').catch(() => []);
    renderTeachers();
}

function renderTeachers() {
    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5">
            <div>
                <h1 class="page-title">Docentes</h1>
                <p class="page-sub">${teachers.length} cadastrado${teachers.length !== 1 ? 's' : ''}</p>
            </div>
            <button onclick="openTeacherModal()" class="btn btn-primary"><i class="fa-solid fa-plus text-[10px]"></i> Novo docente</button>
        </div>

        ${teachers.length === 0 ? `<div class="card"><div class="card-body">${emptyState('fa-chalkboard-user','Nenhum docente','Cadastre os professores das suas disciplinas.')}</div></div>` :
        `<div class="card">
            <table class="tbl">
                <thead>
                    <tr><th style="width:32px">#</th><th>Nome</th><th>E-mail</th><th>Contato</th><th style="width:90px" class="actions">Ações</th></tr>
                </thead>
                <tbody>
                    ${teachers.map((t, i) => `
                    <tr>
                        <td class="id">${String(i+1).padStart(2,'0')}</td>
                        <td style="color:var(--text); font-weight: 500;">${t.name}</td>
                        <td class="mono text-[12px]" style="color:var(--text-3)">${t.email || '—'}</td>
                        <td style="color:var(--text-3)">${t.contact || '—'}</td>
                        <td class="actions">
                            <button onclick="openTeacherModal('${t.id}')" class="btn btn-icon btn-sm"><i class="fa-solid fa-pen text-[10px]"></i></button>
                            <button onclick="deleteTeacher('${t.id}','${escAttr(t.name)}')" class="btn btn-icon btn-sm"><i class="fa-solid fa-trash text-[10px]"></i></button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`}
    </div>`;
}

function openTeacherModal(id = null) {
    const t = id ? teachers.find(x => x.id === id) : null;
    openModal(`
    <div class="modal-head"><h3>${id ? 'Editar docente' : 'Novo docente'}</h3><button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button></div>
    <form onsubmit="saveTeacher(event,'${id||''}')" class="space-y-3">
        <div><label class="label">Nome *</label><input class="input" id="t-name" value="${t?.name||''}" required></div>
        <div><label class="label">E-mail</label><input type="email" class="input mono" id="t-email" value="${t?.email||''}"></div>
        <div><label class="label">Contato</label><input class="input" id="t-contact" value="${t?.contact||''}" placeholder="Telefone ou lattes"></div>
        <div class="flex gap-2 justify-end pt-2">
            <button type="button" onclick="closeModal()" class="btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
    </form>`);
}

async function saveTeacher(e, id) {
    e.preventDefault();
    const data = { name: document.getElementById('t-name').value.trim(), email: document.getElementById('t-email').value.trim() || null, contact: document.getElementById('t-contact').value.trim() || null };
    try {
        if (id) await api(`/teachers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        else await api('/teachers/', { method: 'POST', body: JSON.stringify(data) });
        teachers = await api('/teachers/');
        closeModal();
        renderTeachers();
        toast(id ? 'Docente atualizado' : 'Docente cadastrado', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteTeacher(id, name) {
    if (!confirm(`Excluir docente "${name}"?`)) return;
    try {
        await api(`/teachers/${id}`, { method: 'DELETE' });
        teachers = teachers.filter(t => t.id !== id);
        renderTeachers();
        toast('Docente excluído', 'success');
    } catch (e) { toast(e.message, 'error'); }
}
