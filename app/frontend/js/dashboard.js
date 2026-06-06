/* ═══════════════════════════════════════════════════════════════════════
   dashboard.js — tela inicial com KPIs e gráficos
   Depende: common.js, Chart.js (CDN)
   ═══════════════════════════════════════════════════════════════════════ */

async function showDashboard() {
    setActive('menu-dash');
    setPage('Dashboard', 'Geral');
    document.getElementById('mainContent').innerHTML = `<div class="page-shell">${loadingBlock()}</div>`;

    try {
        const [stats, history, fcStats, upcoming] = await Promise.all([
            api('/sessions/stats').catch(() => null),
            api('/sessions/history').catch(() => []),
            api('/flashcards/stats').catch(() => null),
            api('/dashboard/upcoming?days=7&limit=8').catch(() => []),
        ]);
        const tot = stats || { total_minutes:0, accuracy:0, current_streak:0, total_questions:0, last_30_days:[], by_subject:[], best_day:null };
        const hoursStr = tot.total_minutes >= 60
            ? `${Math.floor(tot.total_minutes/60)}<span class="unit">h</span> ${tot.total_minutes%60}<span class="unit">m</span>`
            : `${tot.total_minutes}<span class="unit">m</span>`;

        // Meta diária: minutos estudados HOJE / meta do usuário
        const goal = (me && me.daily_goal_minutes) || 30;
        const todayKey = new Date().toISOString().slice(0,10);
        const todayMin = (tot.last_30_days || []).find(d => d.date === todayKey)?.minutes || 0;
        const goalPct = Math.min(100, Math.round(todayMin / goal * 100));

        document.getElementById('mainContent').innerHTML = `
        <div class="page-shell">
            <div class="flex items-baseline justify-between mb-5">
                <div>
                    <h1 class="page-title">Dashboard</h1>
                    <p class="page-sub">Visão geral do seu desempenho</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="showSessions()" class="btn"><i class="fa-solid fa-plus text-[10px]"></i> Sessão</button>
                    <button onclick="showFlashcards()" class="btn"><i class="fa-solid fa-layer-group text-[10px]"></i> Cards</button>
                </div>
            </div>

            <!-- Meta diária + streak destacados -->
            <div class="card mb-4" style="border: 1px solid var(--border);">
                <div class="card-body" style="padding: 18px 22px;">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-3">
                            <h3 class="text-[13px] font-semibold" style="color:var(--text)">Meta de hoje</h3>
                            ${tot.current_streak > 0 ? `<span class="streak-badge"><i class="fa-solid fa-fire text-[10px]"></i> ${tot.current_streak} dia${tot.current_streak > 1 ? 's' : ''} seguidos</span>` : ''}
                        </div>
                        <button onclick="openGoalModal()" class="btn btn-icon btn-sm" title="Ajustar meta"><i class="fa-solid fa-gear text-[10px]"></i></button>
                    </div>
                    <div class="flex items-baseline gap-2 mb-2">
                        <span class="text-[28px] font-bold mono" style="color: ${todayMin >= goal ? 'var(--success)' : 'var(--text)'}; letter-spacing:-.02em;">${todayMin}</span>
                        <span class="text-[14px] mono" style="color:var(--text-4)">/ ${goal} min</span>
                        ${todayMin >= goal ? `<span class="ml-auto badge badge-concluida"><i class="fa-solid fa-check text-[8px]"></i>Meta atingida!</span>` : `<span class="ml-auto text-[12px] mono" style="color:var(--text-4)">${goal - todayMin}m restantes</span>`}
                    </div>
                    <div class="bar"><div style="width: ${goalPct}%; background: ${todayMin >= goal ? 'var(--success)' : 'var(--accent)'};"></div></div>
                </div>
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                ${kpi('Tempo estudado', tot.total_minutes > 0 ? hoursStr : '—', 'fa-clock')}
                ${kpi('Sequência atual', tot.current_streak > 0 ? `${tot.current_streak}` : '—', 'fa-fire', tot.current_streak > 0 ? (tot.current_streak === 1 ? 'dia' : 'dias') : '')}
                ${kpi('Taxa de acerto', tot.total_questions > 0 ? tot.accuracy : '—', 'fa-bullseye', tot.total_questions > 0 ? '%' : '')}
                ${kpi('Cards a revisar', fcStats ? fcStats.due_today : '—', 'fa-layer-group', fcStats && fcStats.due_today > 0 ? 'hoje' : '')}
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
                <div class="card lg:col-span-2">
                    <div class="card-header">
                        <span class="card-title">Atividade</span>
                        <span class="card-sub">Últimos 30 dias</span>
                        ${tot.best_day ? `<span class="card-sub ml-auto">Pico: <span class="mono">${fmtShortDate(tot.best_day.date)}</span> · ${tot.best_day.minutes}m</span>` : ''}
                    </div>
                    <div class="card-body" style="height: 220px"><canvas id="activityChart"></canvas></div>
                </div>
                <div class="card">
                    <div class="card-header"><span class="card-title">Por matéria</span></div>
                    <div class="card-body" style="height: 220px">
                        ${tot.by_subject.length ? `<canvas id="subjectsChart"></canvas>` : emptyState('fa-book-bookmark','Sem dados','Estude para ver a distribuição.')}
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
                <!-- Próximos compromissos: coluna 1-2 -->
                <div class="card lg:col-span-2">
                    <div class="card-header">
                        <span class="card-title"><i class="fa-solid fa-calendar-check text-[11px]" style="color:var(--accent)"></i> Próximos compromissos</span>
                        <span class="card-sub">próximos 7 dias</span>
                        <a href="#" onclick="showCalendar();return false" class="card-sub ml-auto" style="color:var(--accent)">Ver calendário →</a>
                    </div>
                    ${(!upcoming || upcoming.length === 0) ? `<div class="card-body">${emptyState('fa-calendar-day','Nada agendado','Adicione eventos no calendário ou aulas no horário.')}</div>` :
                    `<div>
                        ${upcoming.map(it => renderUpcomingItem(it)).join('')}
                    </div>`}
                </div>

                <!-- Card pendência de revisão -->
                <div class="space-y-3">
                    ${fcStats && fcStats.due_today > 0 ? `
                    <div class="card" style="border-color: var(--warning); border-left-width: 3px;">
                        <div class="card-body">
                            <p class="text-[11px] font-medium mb-1" style="color: var(--warning)">REVISÃO PENDENTE</p>
                            <p class="text-[28px] font-semibold mono" style="color:var(--text); letter-spacing:-.02em;">${fcStats.due_today} <span class="text-[12px] font-normal" style="color:var(--text-4)">cards</span></p>
                            <p class="text-[12px] mt-1 mb-3" style="color:var(--text-4)">Revise diariamente para fixar.</p>
                            <button onclick="startReview()" class="btn btn-accent btn-sm w-full">Revisar agora →</button>
                        </div>
                    </div>` : ''}
                    <div class="card">
                        <div class="card-header"><span class="card-title">Matérias por status</span></div>
                        <div class="card-body">
                            ${subjects.length === 0 ? `<p class="text-[12px]" style="color:var(--text-4)">Nenhuma matéria.</p>` :
                            `<div class="space-y-2">${Object.entries(subjects.reduce((acc, s) => { acc[s.status]=(acc[s.status]||0)+1; return acc; }, {})).map(([st, n]) => `
                                <div class="flex items-center justify-between">
                                    <span class="badge badge-${st.toLowerCase().replace(' ','-')}"><span class="dot" style="background:currentColor"></span>${st}</span>
                                    <span class="mono text-[13px]" style="color:var(--text)">${String(n).padStart(2,'0')}</span>
                                </div>`).join('')}</div>`}
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <span class="card-title">Sessões recentes</span>
                    ${history.length ? `<a href="#" onclick="showHistory();return false" class="card-sub ml-auto" style="color:var(--accent)">Ver tudo →</a>` : ''}
                </div>
                ${history.length === 0 ? `<div class="card-body">${emptyState('fa-stopwatch','Nenhuma sessão','Inicie uma sessão para registrar progresso.')}</div>` :
                `<table class="tbl">
                    <thead><tr><th>Matéria</th><th style="width:120px">Data</th><th style="width:80px" class="text-right">Duração</th><th style="width:100px" class="text-right">Acerto</th></tr></thead>
                    <tbody>${history.slice(0,6).map(s => {
                        const a = s.total_questions > 0 ? Math.round(s.correct_answers/s.total_questions*100) : null;
                        return `<tr>
                            <td style="color:var(--text)">${esc(s.subject_name)}</td>
                            <td class="num text-[11.5px]">${fmtShortDate(s.start_time)}</td>
                            <td class="num text-right">${fmtDuration(s.duration_seconds)}</td>
                            <td class="num text-right" style="color:${a==null?'var(--text-5)':a>=70?'var(--success)':a>=50?'var(--warning)':'var(--danger)'}">${a!=null ? a+'%' : '—'}</td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>`}
            </div>
        </div>`;

        if (stats) renderDashboardCharts(stats);
    } catch (e) { toast('Erro ao carregar dashboard: ' + e.message, 'error'); }
}

function openGoalModal() {
    const cur = (me && me.daily_goal_minutes) || 30;
    openModal(`
    <div class="modal-head">
        <h3>Meta diária de estudo</h3>
        <button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <p class="text-[12.5px] mb-4" style="color:var(--text-3)">Quantos minutos você quer estudar por dia? Sugerimos entre 30 e 90 min para criar consistência.</p>
    <div>
        <label class="label">Meta (minutos por dia)</label>
        <input type="number" id="goal-input" class="input mono text-[18px]" value="${cur}" min="5" max="600" style="text-align:center;">
        <div class="flex gap-2 mt-3 flex-wrap">
            ${[15, 30, 45, 60, 90, 120].map(v => `<button onclick="document.getElementById('goal-input').value=${v}" class="btn btn-sm">${v}m</button>`).join('')}
        </div>
    </div>
    <div class="flex gap-2 justify-end pt-4 mt-3" style="border-top:1px solid var(--border)">
        <button onclick="closeModal()" class="btn">Cancelar</button>
        <button onclick="saveGoal()" class="btn btn-primary">Salvar</button>
    </div>`);
}

async function saveGoal() {
    const v = parseInt(document.getElementById('goal-input').value);
    if (!v || v < 5 || v > 600) { toast('Meta deve ser entre 5 e 600 minutos.', 'warning'); return; }
    try {
        await api('/users/me/goal', { method: 'PUT', body: JSON.stringify({ daily_goal_minutes: v }) });
        me.daily_goal_minutes = v;
        closeModal();
        showDashboard();
        toast(`Meta diária ajustada para ${v} min`, 'success');
    } catch (e) { toast(e.message, 'error'); }
}

function renderUpcomingItem(it) {
    const dt = new Date(it.start_at);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const itemDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const daysDiff = Math.floor((itemDate - today) / 86400000);

    let dayLabel;
    if (daysDiff === 0) dayLabel = 'HOJE';
    else if (daysDiff === 1) dayLabel = 'AMANHÃ';
    else if (daysDiff < 7) dayLabel = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'][dt.getDay()];
    else dayLabel = fmtShortDate(it.start_at);

    const dayNum = dt.getDate();
    const monthName = dt.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase();
    const time = it.all_day ? '' : it.start_at.slice(11, 16);
    const isToday = daysDiff === 0;

    const typeIcons = {
        revisao: 'fa-repeat', estudo: 'fa-book-open', aula: 'fa-chalkboard-user',
        prova: 'fa-clipboard-check', outro: 'fa-calendar-day',
    };
    const icon = typeIcons[it.event_type] || 'fa-calendar-day';

    const meta = [];
    if (it.subject_name) meta.push(it.subject_name);
    if (it.location) meta.push(`<i class="fa-solid fa-location-dot text-[9px]"></i> ${it.location}`);
    if (it.teacher_name) meta.push(it.teacher_name);

    return `<div class="flex items-center gap-4 px-4 py-3" style="border-bottom: 1px solid var(--border);">
        <!-- Coluna data -->
        <div class="text-center" style="min-width: 48px;">
            <p class="text-[9.5px] font-bold tracking-wider" style="color: ${isToday ? 'var(--warning)' : 'var(--text-4)'};">${dayLabel}</p>
            <p class="serif text-[18px] font-semibold mono" style="color: ${isToday ? 'var(--warning)' : 'var(--text)'}; line-height:1; letter-spacing:-.02em;">${String(dayNum).padStart(2,'0')}</p>
            ${daysDiff > 1 && daysDiff < 7 ? '' : `<p class="text-[9px] mono" style="color:var(--text-4)">${monthName}</p>`}
        </div>

        <!-- Faixa colorida -->
        <div style="width: 3px; height: 38px; background: ${it.color}; border-radius: 99px; flex-shrink: 0;"></div>

        <!-- Conteúdo -->
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
                <i class="fa-solid ${icon} text-[10px]" style="color:${it.color}"></i>
                <p class="text-[13.5px] font-medium truncate" style="color:var(--text);">${it.title}</p>
            </div>
            ${meta.length ? `<p class="text-[11px] truncate" style="color:var(--text-4)">${meta.join(' · ')}</p>` : ''}
        </div>

        <!-- Hora -->
        <div class="text-right" style="min-width: 50px;">
            ${time ? `<p class="text-[12.5px] mono font-medium" style="color:var(--text-2)">${time}</p>` : '<p class="text-[10.5px]" style="color:var(--text-4)">dia inteiro</p>'}
            <p class="text-[9.5px] tracking-wider uppercase font-medium mt-0.5" style="color:${it.color}">${it.kind === 'class' ? 'Aula' : it.event_type}</p>
        </div>
    </div>`;
}

function renderDashboardCharts(stats) {
    if (_activityChart) { _activityChart.destroy(); _activityChart = null; }
    if (_subjectsChart) { _subjectsChart.destroy(); _subjectsChart = null; }

    const INK = '#18181b', INK_FAINT = '#a1a1aa', LINE = '#e4e4e7', ACCENT = '#2563eb';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = INK_FAINT;

    const actCanvas = document.getElementById('activityChart');
    if (actCanvas) {
        const labels = stats.last_30_days.map(d => {
            const dt = new Date(d.date + 'T00:00:00');
            return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
        });
        _activityChart = new Chart(actCanvas, {
            type: 'bar',
            data: { labels, datasets: [{ data: stats.last_30_days.map(d => d.minutes), backgroundColor: ACCENT, borderRadius: 2, maxBarThickness: 10 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: INK, padding: 8, cornerRadius: 4, displayColors: false, callbacks: { label: c => `${c.parsed.y} min` } } },
                scales: {
                    y: { beginAtZero: true, ticks: { font: { family: "'JetBrains Mono', monospace", size: 10 } }, grid: { color: LINE, drawTicks: false }, border: { display: false } },
                    x: { ticks: { font: { family: "'JetBrains Mono', monospace", size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false }, border: { color: LINE } }
                }
            }
        });
    }

    const subjCanvas = document.getElementById('subjectsChart');
    if (subjCanvas && stats.by_subject.length > 0) {
        const palette = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
        _subjectsChart = new Chart(subjCanvas, {
            type: 'doughnut',
            data: { labels: stats.by_subject.map(b => b.name), datasets: [{ data: stats.by_subject.map(b => b.minutes), backgroundColor: stats.by_subject.map((_, i) => palette[i % palette.length]), borderWidth: 2, borderColor: '#fff' }] },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '62%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 11 }, color: INK, boxWidth: 8, boxHeight: 8, padding: 8, usePointStyle: true, pointStyle: 'rect' } },
                    tooltip: { backgroundColor: INK, padding: 8, cornerRadius: 4, displayColors: false, callbacks: { label: c => ` ${c.label}: ${c.parsed} min` } }
                }
            }
        });
    }
}
