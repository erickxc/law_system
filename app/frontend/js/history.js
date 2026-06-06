/* ═══════════════════════════════════════════════════════════════════════
   history.js — Histórico de sessões + export PDF
   ═══════════════════════════════════════════════════════════════════════ */

async function showHistory() {
    setActive('menu-historico');
    setPage('Histórico', 'Estudo');
    const history = await api('/sessions/history').catch(() => []);

    const totalSec = history.reduce((a, s) => a + s.duration_seconds, 0);
    const totalQ = history.reduce((a, s) => a + s.total_questions, 0);
    const totalC = history.reduce((a, s) => a + s.correct_answers, 0);
    const acc = totalQ > 0 ? Math.round(totalC/totalQ*100) : 0;

    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5">
            <div>
                <h1 class="page-title">Histórico</h1>
                <p class="page-sub">${history.length} sessão${history.length !== 1 ? 'ões' : ''} registrada${history.length !== 1 ? 's' : ''}</p>
            </div>
            ${history.length > 0 ? `<button onclick="exportHistoryPdf()" class="btn"><i class="fa-solid fa-file-pdf text-[10px]"></i> Exportar PDF</button>` : ''}
        </div>

        <div class="grid grid-cols-3 gap-3 mb-5">
            ${kpi('Tempo total', fmtDuration(totalSec), 'fa-clock')}
            ${kpi('Sessões', history.length, 'fa-list')}
            ${kpi('Acerto', totalQ > 0 ? acc : '—', 'fa-bullseye', totalQ > 0 ? '%' : '')}
        </div>

        ${history.length === 0 ? `<div class="card"><div class="card-body">${emptyState('fa-clock-rotate-left','Nenhuma sessão','Registre sua primeira sessão.')}</div></div>` :
        `<div class="card">
            <table class="tbl">
                <thead><tr><th style="width:32px">#</th><th>Matéria</th><th style="width:130px">Data</th><th style="width:100px" class="text-right">Duração</th><th style="width:100px" class="text-right">Questões</th><th style="width:80px" class="text-right">Acerto</th></tr></thead>
                <tbody>
                    ${history.map((s, i) => {
                        const a = s.total_questions > 0 ? Math.round(s.correct_answers/s.total_questions*100) : null;
                        const aColor = a == null ? 'var(--text-5)' : a>=70 ? 'var(--success)' : a>=50 ? 'var(--warning)' : 'var(--danger)';
                        return `<tr>
                            <td class="id">${String(i+1).padStart(2,'0')}</td>
                            <td style="color:var(--text); font-weight: 500;">${s.subject_name}</td>
                            <td class="num text-[12px]">${fmtDateTime(s.start_time)}</td>
                            <td class="num text-right">${fmtDuration(s.duration_seconds)}</td>
                            <td class="num text-right" style="color:var(--text-3)">${s.total_questions > 0 ? `${s.correct_answers}/${s.total_questions}` : '—'}</td>
                            <td class="num text-right" style="color:${aColor}">${a != null ? a+'%' : '—'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`}
    </div>`;
}

async function exportHistoryPdf() {
    try {
        const res = await fetch(`${API_BASE}/sessions/report/pdf`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) { toast('Erro ao gerar PDF.', 'error'); return; }
        const blob = await res.blob();
        const disp = res.headers.get('content-disposition') || '';
        const match = disp.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
        const fname = match ? decodeURIComponent(match[1]) : `Historico - ${me.full_name}.pdf`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fname; a.click();
        URL.revokeObjectURL(url);
    } catch (e) { toast('Erro ao exportar: ' + e.message, 'error'); }
}
