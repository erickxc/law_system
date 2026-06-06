/* ═══════════════════════════════════════════════════════════════════════
   schedule.js — Quadro de aulas semanal recorrente
   ═══════════════════════════════════════════════════════════════════════ */

const DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const SCHEDULE_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777'];

let _slots = [];

async function showSchedule() {
    setActive('menu-horario');
    setPage('Horário de aulas', 'Agenda');
    _slots = await api('/schedule/').catch(() => []);
    renderSchedule();
}

function renderSchedule() {
    // Determinar faixa de horários a renderizar (mínimo 7-22h, expande se houver slot fora)
    let minH = 7, maxH = 22;
    for (const s of _slots) {
        const sh = parseInt(s.start_time.split(':')[0]);
        const eh = parseInt(s.end_time.split(':')[0]) + (s.end_time.endsWith(':00') ? 0 : 1);
        if (sh < minH) minH = sh;
        if (eh > maxH) maxH = eh;
    }
    const hours = [];
    for (let h = minH; h <= maxH; h++) hours.push(h);

    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5">
            <div>
                <h1 class="page-title">Horário de aulas</h1>
                <p class="page-sub">${_slots.length} aula${_slots.length !== 1 ? 's' : ''} cadastrada${_slots.length !== 1 ? 's' : ''}</p>
            </div>
            <button onclick="openSlotModal()" class="btn btn-primary"><i class="fa-solid fa-plus text-[10px]"></i> Nova aula</button>
        </div>

        ${_slots.length === 0 ? `<div class="card"><div class="card-body">${emptyState('fa-calendar-week','Quadro vazio','Adicione suas aulas para visualizar a grade semanal.')}</div></div>` :
        `<div class="card" style="overflow-x: auto;">
            <div style="display: grid; grid-template-columns: 60px repeat(7, minmax(120px, 1fr)); min-width: 920px;">
                <!-- Header -->
                <div></div>
                ${DAYS_PT.map((d, i) => `
                    <div class="text-[11px] font-medium uppercase tracking-wider py-2 text-center" style="color:var(--text-3); background:var(--bg-2); border-bottom:1px solid var(--border);">
                        ${DAYS_SHORT[i]}
                    </div>
                `).join('')}

                <!-- Linhas de hora -->
                ${hours.map(h => `
                    <div class="mono text-[10px] text-right pr-2 py-1" style="color:var(--text-4); border-right:1px solid var(--border); border-bottom:1px solid var(--border-soft, #f0f0f0); position:relative; top:-6px;">
                        ${String(h).padStart(2,'0')}:00
                    </div>
                    ${[0,1,2,3,4,5,6].map(d => `<div style="border-right:1px solid var(--border); border-bottom:1px solid #f0f0f0; min-height:42px; position:relative;"></div>`).join('')}
                `).join('')}
            </div>

            <!-- Overlay de slots posicionado absolutamente -->
            <div style="position:relative; margin-top: -${(hours.length * 42) + 32}px; pointer-events:none;">
                <div style="display: grid; grid-template-columns: 60px repeat(7, minmax(120px, 1fr)); min-width: 920px;">
                    <div></div>
                    ${[0,1,2,3,4,5,6].map(day => `
                        <div style="position:relative; height:${hours.length * 42 + 32}px; padding-top:32px;">
                            ${_slots.filter(s => s.day_of_week === day).map(s => slotBlock(s, minH)).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`}
    </div>`;
}

function slotBlock(s, minH) {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    const startMin = (sh - minH) * 60 + sm;
    const endMin = (eh - minH) * 60 + em;
    const top = (startMin / 60) * 42;
    const height = ((endMin - startMin) / 60) * 42 - 2;
    const color = s.color || SCHEDULE_COLORS[(s.subject_name?.length || 0) % SCHEDULE_COLORS.length];

    return `<div onclick="openSlotModal('${s.id}')"
        style="position:absolute; top:${top}px; left:2px; right:2px; height:${height}px; background:${color}1a; border-left:3px solid ${color}; padding:4px 6px; border-radius:3px; cursor:pointer; pointer-events:auto; overflow:hidden;"
        class="hover:opacity-90 transition-opacity">
        <p class="text-[11.5px] font-semibold truncate" style="color:${color}">${s.subject_name || 'Aula'}</p>
        <p class="text-[10px] mono truncate" style="color:var(--text-3)">${s.start_time}–${s.end_time}</p>
        ${s.location ? `<p class="text-[10px] truncate" style="color:var(--text-4)">${s.location}</p>` : ''}
        ${s.teacher_name && height >= 60 ? `<p class="text-[10px] truncate" style="color:var(--text-4)">${s.teacher_name}</p>` : ''}
    </div>`;
}

function openSlotModal(id = null) {
    const s = id ? _slots.find(x => x.id === id) : null;
    const subjectOpts = subjects.map(sub => `<option value="${sub.id}" ${s?.subject_id === sub.id ? 'selected' : ''}>${sub.name}</option>`).join('');
    const dayOpts = DAYS_PT.map((d, i) => `<option value="${i}" ${s?.day_of_week === i ? 'selected' : ''}>${d}</option>`).join('');

    openModal(`
    <div class="modal-head">
        <h3>${id ? 'Editar aula' : 'Nova aula'}</h3>
        <button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <form onsubmit="saveSlot(event, '${id || ''}')" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="label">Matéria *</label>
                <select class="input" id="sl-subject">
                    <option value="">Outra (escrever abaixo)</option>
                    ${subjectOpts}
                </select>
            </div>
            <div>
                <label class="label">Ou nome livre</label>
                <input class="input" id="sl-subject-name" value="${s?.subject_id ? '' : (s?.subject_name || '')}" placeholder="Ex.: Direito Civil">
            </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
            <div>
                <label class="label">Dia *</label>
                <select class="input" id="sl-day">${dayOpts}</select>
            </div>
            <div>
                <label class="label">Início *</label>
                <input type="time" class="input mono" id="sl-start" required value="${s?.start_time || '19:00'}">
            </div>
            <div>
                <label class="label">Fim *</label>
                <input type="time" class="input mono" id="sl-end" required value="${s?.end_time || '21:00'}">
            </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div><label class="label">Local</label><input class="input" id="sl-location" value="${s?.location || ''}" placeholder="Sala 12"></div>
            <div><label class="label">Professor</label><input class="input" id="sl-teacher" value="${s?.teacher_name || ''}" placeholder="Prof. Silva"></div>
        </div>
        <div>
            <label class="label">Cor</label>
            <div class="flex gap-2">
                ${SCHEDULE_COLORS.map(c => `<button type="button" data-color="${c}" onclick="selectSlotColor('${c}', this)" class="slot-color-btn" style="width:24px; height:24px; background:${c}; border-radius:3px; border:2px solid ${s?.color === c ? 'var(--text)' : 'transparent'}; cursor:pointer;"></button>`).join('')}
            </div>
            <input type="hidden" id="sl-color" value="${s?.color || SCHEDULE_COLORS[0]}">
        </div>
        ${id ? `<div class="flex justify-start"><button type="button" onclick="deleteSlot('${id}')" class="btn btn-danger btn-sm"><i class="fa-solid fa-trash text-[10px]"></i> Excluir aula</button></div>` : ''}
        <div class="flex gap-2 justify-end pt-2">
            <button type="button" onclick="closeModal()" class="btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">${id ? 'Salvar' : 'Criar'}</button>
        </div>
    </form>`);
}

function selectSlotColor(color, btn) {
    document.querySelectorAll('.slot-color-btn').forEach(b => b.style.borderColor = 'transparent');
    btn.style.borderColor = 'var(--text)';
    document.getElementById('sl-color').value = color;
}

async function saveSlot(e, id) {
    e.preventDefault();
    const subjectId = document.getElementById('sl-subject').value || null;
    const subjectName = document.getElementById('sl-subject-name').value.trim();

    if (!subjectId && !subjectName) {
        toast('Selecione uma matéria ou digite o nome.', 'warning');
        return;
    }

    const data = {
        subject_id: subjectId,
        subject_name: subjectId ? null : subjectName,
        day_of_week: parseInt(document.getElementById('sl-day').value),
        start_time: document.getElementById('sl-start').value,
        end_time: document.getElementById('sl-end').value,
        location: document.getElementById('sl-location').value.trim() || null,
        teacher_name: document.getElementById('sl-teacher').value.trim() || null,
        color: document.getElementById('sl-color').value,
    };
    try {
        if (id) {
            await api(`/schedule/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            toast('Aula atualizada', 'success');
        } else {
            await api('/schedule/', { method: 'POST', body: JSON.stringify(data) });
            toast('Aula criada', 'success');
        }
        closeModal();
        showSchedule();
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteSlot(id) {
    if (!confirm('Excluir esta aula do quadro?')) return;
    try {
        await api(`/schedule/${id}`, { method: 'DELETE' });
        closeModal();
        showSchedule();
        toast('Aula excluída', 'success');
    } catch (e) { toast(e.message, 'error'); }
}
