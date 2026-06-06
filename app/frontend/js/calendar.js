/* ═══════════════════════════════════════════════════════════════════════
   calendar.js — Calendário mensal de eventos (revisões, estudos, provas)
   ═══════════════════════════════════════════════════════════════════════ */

let _calCursor = null;          // mês atualmente visível (1º dia, Date)
let _calEvents = [];            // eventos do mês carregado
const EVENT_TYPES = {
    revisao: { label: 'Revisão', color: '#7c3aed', icon: 'fa-repeat' },
    estudo:  { label: 'Estudo',  color: '#2563eb', icon: 'fa-book-open' },
    aula:    { label: 'Aula',    color: '#16a34a', icon: 'fa-chalkboard-user' },
    prova:   { label: 'Prova',   color: '#dc2626', icon: 'fa-clipboard-check' },
    outro:   { label: 'Outro',   color: '#71717a', icon: 'fa-calendar-day' },
};

async function showCalendar() {
    setActive('menu-calendario');
    setPage('Calendário', 'Agenda');
    if (!_calCursor) {
        const now = new Date();
        _calCursor = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    await loadCalendarMonth();
    renderCalendar();
}

async function loadCalendarMonth() {
    const y = _calCursor.getFullYear(), m = _calCursor.getMonth();
    const start = `${y}-${String(m+1).padStart(2,'0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    _calEvents = await api(`/calendar/events?start_date=${start}&end_date=${end}`).catch(() => []);
}

function renderCalendar() {
    const y = _calCursor.getFullYear(), m = _calCursor.getMonth();
    const monthName = _calCursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const today = new Date(); today.setHours(0,0,0,0);
    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    // Indexar eventos por dia (YYYY-MM-DD)
    const byDay = {};
    for (const ev of _calEvents) {
        const k = ev.start_at.slice(0, 10);
        (byDay[k] = byDay[k] || []).push(ev);
    }

    const firstDayOfWeek = new Date(y, m, 1).getDay();  // 0=dom
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrevMonth = new Date(y, m, 0).getDate();

    // Construir células (6 semanas × 7 dias = 42)
    const cells = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
        const d = daysInPrevMonth - firstDayOfWeek + 1 + i;
        cells.push({ day: d, currentMonth: false, key: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const k = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        cells.push({ day: d, currentMonth: true, key: k, isToday: k === todayKey, events: byDay[k] || [] });
    }
    while (cells.length < 42) {
        cells.push({ day: cells.length - daysInMonth - firstDayOfWeek + 1, currentMonth: false, key: null });
    }

    const totalEvents = _calEvents.length;
    const completedEvents = _calEvents.filter(e => e.completed).length;

    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5">
            <div>
                <h1 class="page-title">Calendário</h1>
                <p class="page-sub">${totalEvents} evento${totalEvents !== 1 ? 's' : ''} este mês · ${completedEvents} concluído${completedEvents !== 1 ? 's' : ''}</p>
            </div>
            <button onclick="openEventModal()" class="btn btn-primary"><i class="fa-solid fa-plus text-[10px]"></i> Novo evento</button>
        </div>

        <div class="card mb-4">
            <div class="card-header" style="padding: 10px 16px;">
                <button onclick="navMonth(-1)" class="btn btn-icon btn-sm"><i class="fa-solid fa-chevron-left text-[10px]"></i></button>
                <span class="card-title" style="text-transform: capitalize; min-width: 140px; text-align: center;">${monthName}</span>
                <button onclick="navMonth(1)" class="btn btn-icon btn-sm"><i class="fa-solid fa-chevron-right text-[10px]"></i></button>
                <button onclick="navToday()" class="btn btn-sm ml-auto">Hoje</button>
                <div class="flex gap-3 ml-4 text-[11px]" style="color:var(--text-4)">
                    ${Object.entries(EVENT_TYPES).map(([k, t]) => `
                        <span class="flex items-center gap-1.5"><span style="width:8px;height:8px;background:${t.color};border-radius:2px;display:inline-block;"></span>${t.label}</span>
                    `).join('')}
                </div>
            </div>

            <div class="grid grid-cols-7" style="border-bottom: 1px solid var(--border)">
                ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => `
                    <div class="text-[10.5px] font-medium uppercase tracking-wider py-2 text-center" style="color:var(--text-4); background:var(--bg-2);">${d}</div>
                `).join('')}
            </div>

            <div class="grid grid-cols-7" style="border-collapse: collapse;">
                ${cells.map((c, i) => renderDayCell(c, i)).join('')}
            </div>
        </div>
    </div>`;
}

function renderDayCell(c, idx) {
    const isWeekend = (idx % 7 === 0) || (idx % 7 === 6);
    const bg = !c.currentMonth ? 'var(--bg-2)' : (c.isToday ? '#fffbeb' : (isWeekend ? '#fafafa' : 'var(--surface)'));
    const dayColor = !c.currentMonth ? 'var(--text-5)' : (c.isToday ? 'var(--warning)' : 'var(--text-2)');
    const dayWeight = c.isToday ? '700' : '500';

    return `<div onclick="${c.currentMonth ? `dayClicked('${c.key}')` : ''}"
        style="min-height:96px; padding:6px; border-right:1px solid var(--border); border-bottom:1px solid var(--border); background:${bg}; cursor:${c.currentMonth ? 'pointer' : 'default'}; position:relative;">
        <div class="flex items-center justify-between mb-1">
            <span class="text-[12px] mono" style="color:${dayColor}; font-weight:${dayWeight};">${c.day}</span>
            ${c.isToday ? '<span class="text-[9px] uppercase tracking-wider font-bold" style="color:var(--warning)">hoje</span>' : ''}
        </div>
        ${(c.events || []).slice(0, 3).map(ev => {
            const t = EVENT_TYPES[ev.event_type] || EVENT_TYPES.outro;
            const color = ev.color || t.color;
            return `<div onclick="event.stopPropagation();openEventModal('${ev.id}')" class="text-[10.5px] truncate px-1 py-0.5 mb-0.5 cursor-pointer hover:opacity-80" style="background:${color}1a; color:${color}; border-left: 2px solid ${color}; border-radius: 2px; ${ev.completed ? 'opacity:.55;text-decoration:line-through;' : ''}">
                ${ev.all_day ? '' : `<span class="mono" style="font-size:9px">${ev.start_at.slice(11,16)}</span> `}${esc(ev.title)}
            </div>`;
        }).join('')}
        ${(c.events || []).length > 3 ? `<div class="text-[10px]" style="color:var(--text-4)">+${c.events.length - 3} mais</div>` : ''}
    </div>`;
}

function navMonth(delta) {
    _calCursor = new Date(_calCursor.getFullYear(), _calCursor.getMonth() + delta, 1);
    loadCalendarMonth().then(renderCalendar);
}

function navToday() {
    const now = new Date();
    _calCursor = new Date(now.getFullYear(), now.getMonth(), 1);
    loadCalendarMonth().then(renderCalendar);
}

function dayClicked(dayKey) {
    openEventModal(null, dayKey);
}

function openEventModal(eventId = null, defaultDate = null) {
    const ev = eventId ? _calEvents.find(e => e.id === eventId) : null;
    const subjectOpts = subjects.map(s => `<option value="${s.id}" ${ev?.subject_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('');

    const typeOpts = Object.entries(EVENT_TYPES).map(([k, t]) =>
        `<option value="${k}" ${(ev?.event_type || 'estudo') === k ? 'selected' : ''}>${t.label}</option>`
    ).join('');

    const startAt = ev?.start_at || (defaultDate ? `${defaultDate}T19:00` : '');
    const endAt = ev?.end_at || '';

    openModal(`
    <div class="modal-head">
        <h3>${eventId ? 'Editar evento' : 'Novo evento'}</h3>
        <button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <form onsubmit="saveEvent(event, '${eventId || ''}')" class="space-y-3">
        <div><label class="label">Título *</label><input class="input" id="ev-title" required value="${ev?.title || ''}" placeholder="Ex.: Revisar art. 5º CF"></div>
        <div class="grid grid-cols-2 gap-3">
            <div><label class="label">Tipo</label><select class="input" id="ev-type">${typeOpts}</select></div>
            <div><label class="label">Matéria (opcional)</label><select class="input" id="ev-subject"><option value="">Nenhuma</option>${subjectOpts}</select></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div><label class="label">Início *</label><input type="datetime-local" class="input mono" id="ev-start" required value="${startAt.slice(0,16)}"></div>
            <div><label class="label">Fim (opcional)</label><input type="datetime-local" class="input mono" id="ev-end" value="${endAt ? endAt.slice(0,16) : ''}"></div>
        </div>
        <div><label class="label">Descrição</label><textarea rows="2" class="input" id="ev-desc" placeholder="Notas adicionais…">${ev?.description || ''}</textarea></div>
        <div class="flex items-center gap-2"><input type="checkbox" id="ev-allday" ${ev?.all_day ? 'checked' : ''}><label for="ev-allday" class="text-[12.5px]" style="color:var(--text-2)">Dia inteiro</label></div>
        ${eventId ? `
        <div class="flex items-center justify-between pt-2" style="border-top:1px solid var(--border); margin-top: 12px;">
            <label class="flex items-center gap-2 text-[12.5px] cursor-pointer" style="color:var(--text-2)"><input type="checkbox" id="ev-completed" ${ev.completed ? 'checked' : ''}>Concluído</label>
            <button type="button" onclick="deleteEvent('${eventId}')" class="btn btn-danger btn-sm"><i class="fa-solid fa-trash text-[10px]"></i> Excluir</button>
        </div>` : ''}
        <div class="flex gap-2 justify-end pt-2">
            <button type="button" onclick="closeModal()" class="btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">${eventId ? 'Salvar' : 'Criar'}</button>
        </div>
    </form>`);
}

async function saveEvent(e, id) {
    e.preventDefault();
    const startVal = document.getElementById('ev-start').value;
    const endVal = document.getElementById('ev-end').value;
    if (!startVal) { toast('Defina o horário de início.', 'warning'); return; }

    const data = {
        title: document.getElementById('ev-title').value.trim(),
        description: document.getElementById('ev-desc').value.trim() || null,
        event_type: document.getElementById('ev-type').value,
        start_at: startVal,  // formato "YYYY-MM-DDTHH:MM"
        end_at: endVal || null,
        all_day: document.getElementById('ev-allday').checked,
        subject_id: document.getElementById('ev-subject').value || null,
    };
    if (id) data.completed = document.getElementById('ev-completed').checked;

    try {
        if (id) {
            await api(`/calendar/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            toast('Evento atualizado', 'success');
        } else {
            await api('/calendar/events', { method: 'POST', body: JSON.stringify(data) });
            toast('Evento criado', 'success');
        }
        closeModal();
        await loadCalendarMonth();
        renderCalendar();
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteEvent(id) {
    if (!confirm('Excluir este evento?')) return;
    try {
        await api(`/calendar/events/${id}`, { method: 'DELETE' });
        closeModal();
        await loadCalendarMonth();
        renderCalendar();
        toast('Evento excluído', 'success');
    } catch (e) { toast(e.message, 'error'); }
}
