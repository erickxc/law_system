/* ═══════════════════════════════════════════════════════════════════════
   common.js — shared utilities
   - api(): fetch wrapper com auth + 401 redirect
   - toast(), openModal/closeModal()
   - format helpers (data, duração, iniciais)
   - KPI/empty/loading HTML builders
   Globals: API_BASE (config.js), token (localStorage)
   ═══════════════════════════════════════════════════════════════════════ */

const token = localStorage.getItem('access_token');

// ─── API ─────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...opts.headers },
        ...opts
    });
    if (res.status === 401) { localStorage.removeItem('access_token'); location.href = 'index.html'; return; }
    if (res.status === 204) return null;
    return res.json().then(d => { if (!res.ok) throw new Error(d.detail || `Erro ${res.status}`); return d; });
}

// ─── Toast ───────────────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3000) {
    const icons = { success:'circle-check', error:'circle-xmark', warning:'triangle-exclamation', info:'circle-info' };
    const colors = { success:'var(--success)', error:'var(--danger)', warning:'var(--warning)', info:'var(--accent)' };
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="fa-solid fa-${icons[type]} text-[13px]" style="margin-top:2px;color:${colors[type]}"></i><span class="flex-1">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>`;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 300); }, duration);
}

// ─── Modal ───────────────────────────────────────────────────────────────
function openModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
}
function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

// ─── Format helpers ──────────────────────────────────────────────────────
function fmtDuration(s) {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
    if (h > 0) return `${h}h${String(m).padStart(2,'0')}`;
    return `${m}m`;
}
function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function fmtShortDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}
function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${fmtDate(iso)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function fmtMoney(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
function getInitials(name) {
    if (!name) return '—';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '—';
    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
}
function escAttr(s) { return (s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

// ─── HTML builders ───────────────────────────────────────────────────────
function emptyState(icon, title, sub) {
    return `<div class="empty"><i class="fa-solid ${icon}"></i><p class="title">${title}</p><p class="sub">${sub || ''}</p></div>`;
}
function loadingBlock() {
    return `<div class="empty"><i class="fa-solid fa-circle-notch fa-spin"></i><p class="sub">Carregando…</p></div>`;
}
function kpi(label, value, icon, unit) {
    return `<div class="kpi">
        <div class="kpi-label">${icon ? `<i class="fa-solid ${icon}"></i>` : ''}${label}</div>
        <div class="kpi-value">${value}${unit ? `<span class="unit">${unit}</span>` : ''}</div>
    </div>`;
}

// ─── Logout ──────────────────────────────────────────────────────────────
function logout() { localStorage.removeItem('access_token'); location.href = 'index.html'; }

// ─── Dark mode ───────────────────────────────────────────────────────────
function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
}
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    const btn = document.getElementById('theme-toggle-icon');
    if (btn) btn.className = next === 'dark' ? 'fa-solid fa-sun text-[12px]' : 'fa-solid fa-moon text-[12px]';
}
// Init theme ASAP (antes do init() pra evitar flash)
(function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
})();

// ─── Notification API local ──────────────────────────────────────────────
function requestNotificationPermission() {
    if (!('Notification' in window)) {
        toast('Seu navegador não suporta notificações.', 'warning');
        return Promise.resolve('unsupported');
    }
    return Notification.requestPermission();
}
function showNotification(title, body, opts = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        new Notification(title, { body, icon: '/favicon.ico', badge: '/favicon.ico', ...opts });
    } catch (e) { /* silent */ }
}

// ─── Markdown render (simples, sem dependência) ──────────────────────────
function renderMarkdown(src) {
    if (!src) return '';
    // Escape HTML primeiro
    let s = src
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    // Code inline
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    // Headers (no início da linha)
    s = s.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    s = s.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    s = s.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    // Bold + italic
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?!\w)/g, '<em>$1</em>');
    s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    // Links
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Blockquote
    s = s.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');
    // Unordered lists
    s = s.replace(/(^|\n)((?:[-*]\s+.+\n?)+)/g, (m, pre, block) => {
        const items = block.trim().split('\n').map(l => l.replace(/^[-*]\s+/, '')).map(t => `<li>${t}</li>`).join('');
        return `${pre}<ul>${items}</ul>`;
    });
    // Ordered lists
    s = s.replace(/(^|\n)((?:\d+\.\s+.+\n?)+)/g, (m, pre, block) => {
        const items = block.trim().split('\n').map(l => l.replace(/^\d+\.\s+/, '')).map(t => `<li>${t}</li>`).join('');
        return `${pre}<ol>${items}</ol>`;
    });
    // Paragraphs (linhas não-tag viram <p>)
    s = s.split(/\n\n+/).map(block => {
        if (/^<(h\d|ul|ol|blockquote|pre)/.test(block)) return block;
        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
    return s;
}
