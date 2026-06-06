/* ═══════════════════════════════════════════════════════════════════════
   auth.js — login + register (usado só em index.html)
   ═══════════════════════════════════════════════════════════════════════ */

if (localStorage.getItem('access_token')) location.href = 'dash.html';

function showTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('form-login').classList.toggle('hidden', !isLogin);
    document.getElementById('form-register').classList.toggle('hidden', isLogin);
    document.getElementById('tab-login').classList.toggle('active', isLogin);
    document.getElementById('tab-register').classList.toggle('active', !isLogin);
    clearAlert();
}

function showAlert(msg, type = 'error') {
    const el = document.getElementById('alert');
    const icons = { error: 'circle-xmark', success: 'circle-check', warning: 'triangle-exclamation' };
    el.className = `alert alert-${type}`;
    el.style.display = 'flex';
    el.innerHTML = `<i class="fa-solid fa-${icons[type] || 'info'}"></i><span>${msg}</span>`;
}

function clearAlert() { document.getElementById('alert').style.display = 'none'; }

function togglePwd(id, btn) {
    const inp = document.getElementById(id);
    const hide = inp.type === 'text';
    inp.type = hide ? 'password' : 'text';
    btn.querySelector('i').className = `fa-regular fa-eye${hide ? '' : '-slash'} text-xs`;
}

function checkStrength(pwd) {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    const labels = ['Fraca', 'Regular', 'Boa', 'Forte'];
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`s${i}`).className = `strength${i <= score ? ' on-' + score : ''}`;
    }
    document.getElementById('strength-label').textContent = pwd.length > 0 ? (labels[score-1] || '') : '';
}

async function handleLogin(e) {
    e.preventDefault();
    clearAlert();
    const btn = document.getElementById('btn-login');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando…';
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('login-email').value.trim(),
                password: document.getElementById('login-password').value,
            })
        });
        const data = await res.json();
        if (!res.ok) {
            showAlert(data.detail || 'Erro ao entrar.');
        } else {
            localStorage.setItem('access_token', data.access_token);
            location.href = 'dash.html';
        }
    } catch {
        showAlert('Erro de conexão.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    clearAlert();
    const pwd = document.getElementById('reg-password').value;
    if (pwd.length < 8) { showAlert('Senha deve ter pelo menos 8 caracteres.'); return; }
    const btn = document.getElementById('btn-register');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando…';
    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: document.getElementById('reg-name').value.trim(),
                email: document.getElementById('reg-email').value.trim(),
                password: pwd,
                curso: document.getElementById('reg-curso').value.trim() || null,
            })
        });
        const data = await res.json();
        if (!res.ok) {
            showAlert(data.detail || 'Erro ao criar conta.');
        } else {
            showAlert('Conta criada. Aguarde aprovação do administrador.', 'warning');
            document.getElementById('form-register').reset();
            setTimeout(() => showTab('login'), 3000);
        }
    } catch {
        showAlert('Erro de conexão.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}
