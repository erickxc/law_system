/* ═══════════════════════════════════════════════════════════════════════
   app.js — shared state + init + sidebar handler
   Loaded AFTER all modules. Globals shared: me, subjects, teachers, etc.
   ═══════════════════════════════════════════════════════════════════════ */

// State global compartilhado entre módulos
let me = null;
let subjects = [];
let teachers = [];
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let sessionTasks = [];
let editingSubjectId = null;
let editingBookId = null;
let editingFlashcardId = null;
let currentBookId = null;
let reviewQueue = [];
let reviewIndex = 0;

// Charts (Chart.js instances mantidas para destroy antes de recriar)
let _activityChart = null;
let _subjectsChart = null;

if (!token) location.href = 'index.html';

// ─── Navegação ───────────────────────────────────────────────────────────
function setActive(id) {
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('sidebar-active'));
    document.getElementById(id)?.classList.add('sidebar-active');
}

function setPage(title, section = '') {
    document.getElementById('crumb-section').textContent = section || 'Geral';
    document.getElementById('crumb-page').textContent = title;
    document.title = `${title} — Law System`;
}

// ─── Init ────────────────────────────────────────────────────────────────
async function init() {
    try {
        me = await api('/users/me');
        const initials = getInitials(me.full_name);
        document.getElementById('userDisplayName').textContent = me.full_name;
        document.getElementById('sidebar-name').textContent = me.full_name;
        document.getElementById('sidebar-initial').textContent = initials;
        document.getElementById('headerAvatar').textContent = initials;
        document.getElementById('sidebar-role').textContent = me.role === 'admin' ? 'Administrador' : (me.curso || 'Estudante');
        if (me.role === 'admin') document.getElementById('admin-menu').classList.remove('hidden');
        subjects = await api('/subjects/').catch(() => []);
        teachers = await api('/teachers/').catch(() => []);
        loadFlashcardBadge();
        showDashboard();
    } catch (e) { toast('Erro ao carregar dados. ' + e.message, 'error'); }
}

async function loadFlashcardBadge() {
    try {
        const due = await api('/flashcards/due');
        const badge = document.getElementById('fc-due-badge');
        if (due.length > 0) { badge.textContent = due.length > 99 ? '99+' : due.length; badge.classList.remove('hidden'); }
        else badge.classList.add('hidden');
    } catch {}
}

init();
