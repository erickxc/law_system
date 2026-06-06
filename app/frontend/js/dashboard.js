/* ═══════════════════════════════════════════════════════════════════════
   dashboard.js — tela inicial com KPIs e gráficos
   Depende: common.js, Chart.js (CDN)
   ═══════════════════════════════════════════════════════════════════════ */

async function showDashboard() {
    setActive('menu-dash');
    setPage('Dashboard', 'Geral');
    document.getElementById('mainContent').innerHTML = `<div class="page-shell">${loadingBlock()}</div>`;

    try {
        const [stats, history, fcStats] = await Promise.all([
            api('/sessions/stats').catch(() => null),
            api('/sessions/history').catch(() => []),
            api('/flashcards/stats').catch(() => null),
        ]);
        const tot = stats || { total_minutes:0, accuracy:0, current_streak:0, total_questions:0, last_30_days:[], by_subject:[], best_day:null };
        const hoursStr = tot.total_minutes >= 60
            ? `${Math.floor(tot.total_minutes/60)}<span class="unit">h</span> ${tot.total_minutes%60}<span class="unit">m</span>`
            : `${tot.total_minutes}<span class="unit">m</span>`;

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

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div class="card lg:col-span-2">
                    <div class="card-header">
                        <span class="card-title">Sessões recentes</span>
                        ${history.length ? `<a href="#" onclick="showHistory();return false" class="card-sub ml-auto" style="color:var(--accent)">Ver tudo →</a>` : ''}
                    </div>
                    ${history.length === 0 ? emptyState('fa-stopwatch','Nenhuma sessão','Inicie uma sessão para registrar progresso.') :
                    `<table class="tbl">
                        <thead><tr><th>Matéria</th><th style="width:90px">Data</th><th style="width:70px" class="text-right">Duração</th><th style="width:90px" class="text-right">Acerto</th></tr></thead>
                        <tbody>${history.slice(0,6).map(s => {
                            const a = s.total_questions > 0 ? Math.round(s.correct_answers/s.total_questions*100) : null;
                            return `<tr>
                                <td style="color:var(--text)">${s.subject_name}</td>
                                <td class="num text-[11.5px]">${fmtShortDate(s.start_time)}</td>
                                <td class="num text-right">${fmtDuration(s.duration_seconds)}</td>
                                <td class="num text-right" style="color:${a==null?'var(--text-5)':a>=70?'var(--success)':a>=50?'var(--warning)':'var(--danger)'}">${a!=null ? a+'%' : '—'}</td>
                            </tr>`;
                        }).join('')}</tbody>
                    </table>`}
                </div>

                <div class="space-y-3">
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
                    ${fcStats && fcStats.due_today > 0 ? `
                    <div class="card" style="border-color: var(--warning); border-left-width: 3px;">
                        <div class="card-body">
                            <p class="text-[11px] font-medium mb-1" style="color: var(--warning)">REVISÃO PENDENTE</p>
                            <p class="text-[28px] font-semibold mono" style="color:var(--text); letter-spacing:-.02em;">${fcStats.due_today} <span class="text-[12px] font-normal" style="color:var(--text-4)">cards</span></p>
                            <p class="text-[12px] mt-1 mb-3" style="color:var(--text-4)">Revise diariamente para fixar.</p>
                            <button onclick="startReview()" class="btn btn-accent btn-sm w-full">Revisar agora →</button>
                        </div>
                    </div>` : ''}
                </div>
            </div>
        </div>`;

        if (stats) renderDashboardCharts(stats);
    } catch (e) { toast('Erro ao carregar dashboard: ' + e.message, 'error'); }
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
