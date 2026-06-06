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

        // Atualizar ícone tema com tema salvo
        const t = document.documentElement.getAttribute('data-theme') || 'light';
        const ico = document.getElementById('theme-toggle-icon');
        if (ico) ico.className = t === 'dark' ? 'fa-solid fa-sun text-[12px]' : 'fa-solid fa-moon text-[12px]';

        // Atualizar visual do botão de notificações
        updateNotifButton();

        showDashboard();
    } catch (e) { toast('Erro ao carregar dados. ' + e.message, 'error'); }
}

function updateNotifButton() {
    const btn = document.getElementById('btn-notif');
    if (!btn) return;
    if (!('Notification' in window)) { btn.style.display = 'none'; return; }
    if (Notification.permission === 'granted') {
        btn.innerHTML = '<i class="fa-solid fa-bell text-[11px]" style="color:var(--success)"></i>';
        btn.title = 'Notificações ativas';
    } else if (Notification.permission === 'denied') {
        btn.innerHTML = '<i class="fa-solid fa-bell-slash text-[11px]" style="color:var(--text-5)"></i>';
        btn.title = 'Notificações bloqueadas no navegador';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-bell text-[11px]"></i>';
        btn.title = 'Ativar notificações';
    }
}

async function requestNotifPerm() {
    if (!('Notification' in window)) { toast('Navegador não suporta notificações.', 'warning'); return; }
    const result = await Notification.requestPermission();
    updateNotifButton();
    if (result === 'granted') {
        showNotification('Notificações ativas', 'Você será avisado sobre revisões pendentes e ciclos do Pomodoro.');
        toast('Notificações ativadas', 'success');
        scheduleReviewReminder();
    }
}

// Lembrete client-side: a cada 4h checa se tem cards pendentes
function scheduleReviewReminder() {
    if (Notification.permission !== 'granted') return;
    setInterval(async () => {
        try {
            const stats = await api('/flashcards/stats');
            if (stats && stats.due_today > 0) {
                showNotification(
                    'Hora da revisão',
                    `${stats.due_today} flashcard${stats.due_today > 1 ? 's' : ''} aguardando revisão.`
                );
            }
        } catch {}
    }, 4 * 60 * 60 * 1000); // 4 horas
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
