/* ═══════════════════════════════════════════════════════════════════════
   intelligence.js — Camada de Inteligência Acadêmica (Fase 1)
   IPA · Radar de Lacunas · Heatmap · Caderno de Erros · Timeline
   ═══════════════════════════════════════════════════════════════════════ */

async function showIntelligence() {
    setActive('menu-inteligencia');
    setPage('Inteligência', 'Análise');
    document.getElementById('mainContent').innerHTML = `<div class="page-shell">${loadingBlock()}</div>`;

    try {
        const [ipa, gaps, heatmap, errors] = await Promise.all([
            api('/metrics/ipa').catch(() => null),
            api('/metrics/gaps').catch(() => ({ gaps: [], total_subjects: 0 })),
            api('/metrics/heatmap?days=30').catch(() => ({ by_subject: [], by_day: [] })),
            api('/metrics/error-book').catch(() => ({ cards: [], by_subject: [] })),
        ]);
        renderIntelligence(ipa, gaps, heatmap, errors);
    } catch (e) {
        document.getElementById('mainContent').innerHTML = `<div class="page-shell">${emptyState('fa-triangle-exclamation', 'Não consegui carregar', e.message)}</div>`;
    }
}

function renderIntelligence(ipa, gaps, heatmap, errors) {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5 flex-wrap gap-2">
            <div>
                <h1 class="page-title">Inteligência Acadêmica</h1>
                <p class="page-sub">Visão analítica dos últimos 30 dias</p>
            </div>
            <button onclick="showTimeline()" class="btn btn-sm">
                <i class="fa-solid fa-timeline text-[10px]"></i> Linha do tempo
            </button>
        </div>

        ${renderIPACard(ipa)}

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            ${renderGapsCard(gaps)}
            ${renderErrorBookCard(errors)}
        </div>

        ${renderHeatmapCard(heatmap)}

        ${renderIPABySubject(ipa)}
    </div>`;
}

// ─── IPA Card ─────────────────────────────────────────────────────────
function renderIPACard(ipa) {
    if (!ipa) return `<div class="card mb-5"><div class="card-body">${emptyState('fa-chart-pie', 'IPA indisponível', 'Estude e revise pra acumular dados.')}</div></div>`;
    const score = ipa.geral;
    const color = score >= 75 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';
    const grade = score >= 90 ? 'Excelente' : score >= 75 ? 'Bom' : score >= 50 ? 'Em construção' : 'Atenção';

    const bars = Object.entries(ipa.components).map(([k, v]) => {
        const labels = {
            consistency: 'Consistência',
            review: 'Revisão',
            retention: 'Retenção',
            exercises: 'Exercícios',
            coverage: 'Cobertura',
        };
        const w = ipa.weights[k];
        return `
        <div>
            <div class="flex items-baseline justify-between mb-1">
                <span class="text-[11.5px]" style="color:var(--text-3)">${labels[k]} <span style="color:var(--text-5)">${Math.round(w * 100)}%</span></span>
                <span class="mono text-[11.5px]" style="color:var(--text)">${v.toFixed(0)}</span>
            </div>
            <div class="bar"><div style="width:${v}%; background:${color}"></div></div>
        </div>`;
    }).join('');

    return `
    <div class="card mb-5">
        <div class="card-body">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div class="flex flex-col items-center justify-center text-center" style="padding: 12px;">
                    <div class="ipa-ring" style="--score:${score}; --color:${color};">
                        <div class="ipa-ring-inner">
                            <p class="mono" style="font-size: clamp(28px, 4vw, 36px); font-weight: 700; color: ${color}; line-height: 1;">${score.toFixed(0)}</p>
                            <p class="text-[10px] uppercase mono mt-1" style="color:var(--text-4); letter-spacing: .12em;">IPA Geral</p>
                        </div>
                    </div>
                    <p class="text-[12px] font-medium mt-3" style="color:${color}">${grade}</p>
                </div>
                <div class="md:col-span-2 space-y-3">
                    ${bars}
                </div>
            </div>
        </div>
    </div>
    <style>
        .ipa-ring {
            width: 130px; height: 130px;
            border-radius: 50%;
            background: conic-gradient(var(--color) calc(var(--score) * 1%), var(--bg-2) 0);
            display: flex; align-items: center; justify-content: center;
        }
        .ipa-ring-inner {
            width: 102px; height: 102px;
            background: var(--surface);
            border-radius: 50%;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
    </style>`;
}

// ─── IPA por Matéria ───────────────────────────────────────────────────
function renderIPABySubject(ipa) {
    if (!ipa || !ipa.by_subject?.length) return '';
    return `
    <div class="card mb-5">
        <div class="card-header">
            <span class="card-title">IPA por Matéria</span>
            <span class="card-sub ml-auto">${ipa.by_subject.length} ${ipa.by_subject.length === 1 ? 'matéria' : 'matérias'}</span>
        </div>
        <div class="card-body" style="padding: 0; overflow-x: auto;">
            <table class="tbl">
                <thead><tr>
                    <th>Matéria</th>
                    <th class="num text-right">Score</th>
                    <th class="num text-right">Retenção</th>
                    <th class="num text-right">Consistência</th>
                    <th class="num text-right">Acerto</th>
                    <th class="num text-right">Min. (30d)</th>
                    <th class="num text-right">Cards</th>
                </tr></thead>
                <tbody>
                    ${ipa.by_subject.map(s => {
                        const c = s.score >= 75 ? 'var(--success)' : s.score >= 50 ? 'var(--warning)' : 'var(--danger)';
                        return `<tr>
                            <td style="color:var(--text); font-weight: 500;">${esc(s.subject_name)}</td>
                            <td class="num text-right"><span style="color:${c}; font-weight: 600;">${s.score.toFixed(0)}</span></td>
                            <td class="num text-right">${s.retention_pct.toFixed(0)}%</td>
                            <td class="num text-right">${s.consistency_pct.toFixed(0)}%</td>
                            <td class="num text-right">${s.exercises_pct.toFixed(0)}%</td>
                            <td class="num text-right">${s.minutes_30d}</td>
                            <td class="num text-right">${s.cards_count}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}

// ─── Radar de Lacunas ─────────────────────────────────────────────────
function renderGapsCard(gaps) {
    if (!gaps.gaps?.length) {
        return `<div class="card"><div class="card-header"><span class="card-title"><i class="fa-solid fa-radar text-[11px]" style="color:var(--success)"></i> Radar de Lacunas</span></div>
        <div class="card-body">${emptyState('fa-circle-check', 'Sem lacunas detectadas', 'Continue estudando consistentemente.')}</div></div>`;
    }
    return `
    <div class="card">
        <div class="card-header">
            <span class="card-title">Radar de Lacunas</span>
            <span class="card-sub ml-auto">${gaps.gaps.length} ${gaps.gaps.length === 1 ? 'item' : 'itens'}</span>
        </div>
        <div class="card-body" style="padding: 0; max-height: 380px; overflow-y: auto;">
            ${gaps.gaps.map(g => {
                const sev = g.attention_score >= 70 ? 'var(--danger)' : g.attention_score >= 40 ? 'var(--warning)' : 'var(--text-4)';
                return `<div onclick="showSubjects()" class="p-3 cursor-pointer hover:bg-opacity-50" style="border-bottom: 1px solid var(--border); transition: background .12s" onmouseover="this.style.background='var(--bg-2)'" onmouseout="this.style.background=''">
                    <div class="flex items-center justify-between mb-1">
                        <p class="text-[13px] font-medium" style="color:var(--text)">${esc(g.subject_name)}</p>
                        <span class="badge" style="background:${sev}1a;color:${sev};border-color:${sev}40">${g.attention_score} pts</span>
                    </div>
                    <ul class="text-[11.5px] space-y-0.5" style="color:var(--text-3)">
                        ${g.reasons.map(r => `<li><i class="fa-solid fa-circle text-[3px] mr-1.5" style="vertical-align:middle"></i>${esc(r)}</li>`).join('')}
                    </ul>
                </div>`;
            }).join('')}
        </div>
    </div>`;
}

// ─── Caderno de Erros ─────────────────────────────────────────────────
function renderErrorBookCard(errors) {
    if (!errors.cards?.length) {
        return `<div class="card"><div class="card-header"><span class="card-title">Caderno de Erros</span></div>
        <div class="card-body">${emptyState('fa-book-open-reader', 'Sem cards com baixa retenção', 'Revise mais cards pra ver dados aqui.')}</div></div>`;
    }
    return `
    <div class="card">
        <div class="card-header">
            <span class="card-title">Caderno de Erros</span>
            <span class="card-sub ml-auto">${errors.total_weak_cards} cards &lt; 70%</span>
        </div>
        <div class="card-body" style="padding: 0; max-height: 380px; overflow-y: auto;">
            ${errors.by_subject.slice(0, 6).map(s => `
                <div class="p-2.5" style="border-bottom: 1px solid var(--border); background: var(--bg-2);">
                    <div class="flex items-center justify-between">
                        <p class="text-[12px] font-medium" style="color:var(--text)">${esc(s.subject_name)}</p>
                        <span class="text-[11px] mono" style="color:var(--danger)">${s.count} cards · ${s.avg_accuracy.toFixed(0)}%</span>
                    </div>
                </div>
            `).join('')}
            ${errors.cards.slice(0, 15).map(c => `
                <div onclick="showFlashcards()" class="p-2.5 cursor-pointer hover:opacity-90" style="border-bottom: 1px solid var(--border);">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-[10px] mono uppercase" style="color:var(--text-4); letter-spacing:.04em;">${esc(c.subject_name)}</span>
                        <span class="badge" style="background:var(--danger-bg);color:var(--danger);border-color:var(--danger)">${c.accuracy_pct.toFixed(0)}%</span>
                    </div>
                    <p class="text-[12px] line-clamp-2" style="color:var(--text)">${esc(c.front)}</p>
                </div>
            `).join('')}
        </div>
    </div>`;
}

// ─── Heatmap Acadêmico ────────────────────────────────────────────────
function renderHeatmapCard(heatmap) {
    if (!heatmap.by_subject?.length && !heatmap.by_day?.length) {
        return '';
    }
    const maxMin = Math.max(1, ...heatmap.by_subject.map(s => s.minutes));
    const maxDay = Math.max(1, ...heatmap.by_day.map(d => d.minutes));

    return `
    <div class="card mb-5">
        <div class="card-header">
            <span class="card-title">Heatmap Acadêmico</span>
            <span class="card-sub ml-auto">${heatmap.period_days} dias</span>
        </div>
        <div class="card-body">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                    <p class="text-[11px] uppercase mono mb-2" style="color:var(--text-4); letter-spacing:.08em;">Esforço por matéria</p>
                    ${heatmap.by_subject.length === 0 ? emptyState('fa-chart-bar', 'Sem dados', '') : heatmap.by_subject.map(s => {
                        const w = (s.minutes / maxMin) * 100;
                        return `<div class="mb-2">
                            <div class="flex items-baseline justify-between mb-1">
                                <span class="text-[12px]" style="color:var(--text)">${esc(s.subject_name)}</span>
                                <span class="text-[11px] mono" style="color:var(--text-4)">${fmtDuration(s.minutes * 60)} · ${s.sessions} sess.</span>
                            </div>
                            <div class="bar" style="height:6px"><div style="width:${w}%; background:var(--accent)"></div></div>
                        </div>`;
                    }).join('')}
                </div>
                <div>
                    <p class="text-[11px] uppercase mono mb-2" style="color:var(--text-4); letter-spacing:.08em;">Por dia (últimos ${heatmap.period_days})</p>
                    <div class="heatmap-grid">
                        ${heatmap.by_day.map(d => {
                            const intensity = d.minutes > 0 ? Math.min(1, d.minutes / maxDay) : 0;
                            const bg = intensity === 0 ? 'var(--bg-2)' : `rgba(37,99,235,${0.15 + intensity * 0.85})`;
                            return `<div class="heatmap-cell" style="background:${bg}" title="${d.date}: ${d.minutes} min"></div>`;
                        }).join('')}
                    </div>
                    <div class="flex items-center gap-2 mt-3 text-[10.5px]" style="color:var(--text-4)">
                        <span>Menos</span>
                        <span class="heatmap-cell" style="background:var(--bg-2)"></span>
                        <span class="heatmap-cell" style="background:rgba(37,99,235,0.3)"></span>
                        <span class="heatmap-cell" style="background:rgba(37,99,235,0.6)"></span>
                        <span class="heatmap-cell" style="background:rgba(37,99,235,1)"></span>
                        <span>Mais</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <style>
        .heatmap-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(14px, 1fr));
            gap: 3px;
        }
        .heatmap-cell {
            width: 14px; height: 14px;
            border-radius: 2px;
            display: inline-block;
            transition: transform .08s;
        }
        .heatmap-cell:hover { transform: scale(1.3); cursor: help; }
    </style>`;
}

// ─── Linha do Tempo ─────────────────────────────────────────────────────
async function showTimeline() {
    setActive('menu-inteligencia');
    setPage('Linha do Tempo', 'Análise');
    document.getElementById('mainContent').innerHTML = `<div class="page-shell">${loadingBlock()}</div>`;

    try {
        const r = await api('/timeline/me?limit=100');
        renderTimeline(r);
    } catch (e) {
        document.getElementById('mainContent').innerHTML = `<div class="page-shell">${emptyState('fa-triangle-exclamation', 'Erro ao carregar', e.message)}</div>`;
    }
}

function renderTimeline(r) {
    const EVENT_LABELS = {
        leitura:           { label: 'Leitura',           icon: 'fa-book-open',         color: '#3b82f6' },
        grifo:             { label: 'Grifo',             icon: 'fa-highlighter',       color: '#eab308' },
        anotacao:          { label: 'Anotação',          icon: 'fa-note-sticky',       color: '#f59e0b' },
        etiqueta:          { label: 'Etiqueta',          icon: 'fa-tag',               color: '#10b981' },
        flashcard_criado:  { label: 'Flashcard criado',  icon: 'fa-layer-group',       color: '#8b5cf6' },
        revisao:           { label: 'Revisão',           icon: 'fa-rotate',            color: '#06b6d4' },
        sessao_iniciada:   { label: 'Sessão iniciada',   icon: 'fa-play',              color: '#84cc16' },
        sessao_concluida:  { label: 'Sessão concluída',  icon: 'fa-flag-checkered',    color: '#16a34a' },
    };

    // Agrupa por dia
    const byDay = {};
    r.events.forEach(e => {
        const d = e.occurred_at.slice(0, 10);
        if (!byDay[d]) byDay[d] = [];
        byDay[d].push(e);
    });

    const days = Object.keys(byDay).sort().reverse();

    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="flex items-baseline justify-between mb-5 flex-wrap gap-2">
            <div>
                <h1 class="page-title">Linha do Tempo</h1>
                <p class="page-sub">${r.total} ${r.total === 1 ? 'evento registrado' : 'eventos registrados'}</p>
            </div>
            <button onclick="showIntelligence()" class="btn btn-sm">
                <i class="fa-solid fa-arrow-left text-[10px]"></i> Inteligência
            </button>
        </div>

        ${r.events.length === 0 ? `<div class="card"><div class="card-body">${emptyState('fa-clock-rotate-left', 'Sem eventos ainda', 'Use o sistema (grifos, revisões, sessões) que os eventos vão aparecer aqui.')}</div></div>` :
        days.map(d => {
            const dateLabel = fmtDate(d + 'T00:00:00');
            return `
            <div class="mb-5">
                <p class="text-[11px] uppercase mono mb-3" style="color:var(--text-4); letter-spacing:.08em;">${dateLabel}</p>
                <div class="space-y-2">
                    ${byDay[d].map(e => {
                        const cfg = EVENT_LABELS[e.event_type] || { label: e.event_type, icon: 'fa-circle', color: '#71717a' };
                        const time = e.occurred_at.slice(11, 16);
                        const subjBadge = e.subject_name ? `<span class="badge badge-em-curso ml-2">${esc(e.subject_name)}</span>` : '';
                        const meta = [];
                        if (e.page_number) meta.push(`pg. ${e.page_number}`);
                        if (e.score) meta.push(`score ${e.score}/5`);
                        if (e.meta?.duration_seconds) meta.push(fmtDuration(e.meta.duration_seconds));
                        if (e.meta?.tag) meta.push(e.meta.tag);
                        if (e.meta?.text_preview) meta.push(`"${e.meta.text_preview.slice(0, 60)}..."`);

                        return `<div class="flex items-start gap-3 p-2.5" style="background:var(--surface); border:1px solid var(--border); border-radius: 4px;">
                            <div style="width: 28px; height: 28px; border-radius: 50%; background:${cfg.color}1a; color:${cfg.color}; display:flex; align-items:center; justify-content:center; flex-shrink: 0;">
                                <i class="fa-solid ${cfg.icon} text-[11px]"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center flex-wrap">
                                    <span class="text-[13px] font-medium" style="color:var(--text)">${cfg.label}</span>
                                    ${subjBadge}
                                </div>
                                ${meta.length ? `<p class="text-[11.5px] mt-0.5" style="color:var(--text-4)">${meta.map(esc).join(' · ')}</p>` : ''}
                            </div>
                            <span class="text-[11px] mono" style="color:var(--text-5); flex-shrink: 0;">${time}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        }).join('')}
    </div>`;
}
