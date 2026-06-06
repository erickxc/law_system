/* ═══════════════════════════════════════════════════════════════════════
   admin.js — controle de acessos + cobranças
   Usa common.js (api, toast, getInitials, fmtDate, fmtMoney)
   ═══════════════════════════════════════════════════════════════════════ */

async function initAdmin() {
    if (!token) return redirectLogin();
    try {
        const me = await api('/users/me');
        if (me.role !== 'admin') return redirectLogin();
        document.getElementById('adminName').textContent = me.full_name;
        document.getElementById('adminInitial').textContent = getInitials(me.full_name);
    } catch { redirectLogin(); }
}

function redirectLogin() { window.location.href = 'index.html'; }

let allUsers = [];

function setTab(tab) {
    ['acessos','cobrancas'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== tab);
        document.getElementById(`nav-${t}`).classList.toggle('active', t === tab);
    });
    document.getElementById('crumb-page').textContent = tab === 'acessos' ? 'Acessos' : 'Cobranças';
    if (tab === 'cobrancas' && allUsers.length === 0) loadBillingUsers();
}

async function loadPending() {
    const list = document.getElementById('pendingList');
    try {
        const users = await api('/admin/pending');
        document.getElementById('pendingCount').textContent = `${users.length} pendente${users.length !== 1 ? 's' : ''}`;
        if (!users.length) {
            list.innerHTML = `<div class="card"><div class="card-body"><div class="empty"><i class="fa-solid fa-circle-check" style="color:var(--success)"></i><p class="title">Nenhuma solicitação pendente</p><p class="sub">Todas as solicitações foram processadas.</p></div></div></div>`;
            return;
        }
        list.innerHTML = `<div class="card"><table class="tbl">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Curso</th><th style="width:140px">Solicitado em</th><th style="width:160px" class="actions">Ações</th></tr></thead>
            <tbody>${users.map(u => `
                <tr id="pending-${u.id}">
                    <td style="color:var(--text); font-weight:500;">${u.full_name}</td>
                    <td class="mono text-[12px]" style="color:var(--text-3)">${u.email}</td>
                    <td style="color:var(--text-3)">${u.curso || '—'}</td>
                    <td class="num text-[12px]">${fmtDate(u.created_at)}</td>
                    <td class="actions">
                        <button onclick="approveUser('${u.id}')" class="btn btn-success btn-sm"><i class="fa-solid fa-check text-[10px]"></i> Aprovar</button>
                        <button onclick="rejectUser('${u.id}')" class="btn btn-sm" style="color:var(--danger)">Recusar</button>
                    </td>
                </tr>`).join('')}</tbody>
        </table></div>`;
    } catch(e) { list.innerHTML = `<p class="text-[13px]" style="color:var(--danger)">${e.message}</p>`; }
}

async function approveUser(id) {
    try {
        await api(`/admin/approve/${id}`, { method: 'POST' });
        toast('Usuário aprovado');
        await loadPending();
        loadUsers();
    } catch(e) { toast(e.message, 'error'); }
}

async function rejectUser(id) {
    if (!confirm('Recusar e remover esta solicitação?')) return;
    try {
        await api(`/admin/users/${id}`, { method: 'DELETE' });
        toast('Solicitação removida');
        await loadPending();
    } catch(e) { toast(e.message, 'error'); }
}

async function loadUsers() {
    try {
        const users = await api('/admin/users');
        allUsers = users;
        renderUsersTable(users);
    } catch(e) { toast(e.message, 'error'); }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTable');
    const empty = document.getElementById('usersEmpty');
    if (!users.length) {
        tbody.innerHTML = '';
        empty.innerHTML = `<div class="card-body"><div class="empty"><i class="fa-solid fa-users"></i><p class="title">Nenhum usuário</p><p class="sub">Não há usuários cadastrados.</p></div></div>`;
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    tbody.innerHTML = users.map((u, i) => `
    <tr>
        <td class="id">${String(i+1).padStart(2,'0')}</td>
        <td style="color:var(--text); font-weight: 500;">${u.full_name}</td>
        <td class="mono text-[12px]" style="color:var(--text-3)">${u.email}</td>
        <td style="color:var(--text-3)">${u.curso || '—'}</td>
        <td class="num text-[12px]">${fmtDate(u.created_at)}</td>
        <td><span class="badge badge-${u.is_active ? 'active' : 'inactive'}"><span class="dot" style="background:currentColor"></span>${u.is_active ? 'Ativo' : 'Inativo'}</span></td>
        <td class="actions">
            <button onclick="toggleUser('${u.id}', ${u.is_active})" class="btn btn-icon btn-sm" title="${u.is_active ? 'Desativar' : 'Ativar'}">
                <i class="fa-solid ${u.is_active ? 'fa-ban' : 'fa-circle-check'} text-[11px]"></i>
            </button>
        </td>
    </tr>`).join('');
}

function filterUsers() {
    const q = document.getElementById('userSearch').value.toLowerCase();
    renderUsersTable(allUsers.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
}

async function toggleUser(id, isActive) {
    try {
        await api(`/admin/users/${id}/toggle`, { method: 'PATCH' });
        toast(isActive ? 'Acesso desativado' : 'Acesso reativado');
        loadUsers();
    } catch(e) { toast(e.message, 'error'); }
}

// ─── Cobranças ───────────────────────────────────────────────────────────
let billingUsers = [];
let selectedUser = null;

async function loadBillingUsers() {
    try { billingUsers = await api('/admin/users'); renderBillingList(billingUsers); document.getElementById('billingUserCount').textContent = `${billingUsers.length}`; }
    catch(e) { toast(e.message, 'error'); }
}

function renderBillingList(users) {
    if (!users.length) { document.getElementById('billingUserList').innerHTML = `<p class="text-[12px] text-center py-6" style="color:var(--text-4)">Nenhum.</p>`; return; }
    document.getElementById('billingUserList').innerHTML = users.map(u => `
    <button onclick="selectUser('${u.id}','${escAttr(u.full_name)}','${escAttr(u.email)}')" id="billing-user-${u.id}" class="user-list-item">
        <p class="text-[13px] font-medium" style="color:var(--text)">${u.full_name}</p>
        <p class="mono text-[11px] truncate mt-0.5" style="color:var(--text-4)">${u.email}</p>
    </button>`).join('');
}

function filterBillingUsers() {
    const q = document.getElementById('billingSearch').value.toLowerCase();
    renderBillingList(billingUsers.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
}

async function selectUser(id, name, email) {
    selectedUser = id;
    document.querySelectorAll('.user-list-item').forEach(b => b.classList.remove('active'));
    document.getElementById(`billing-user-${id}`)?.classList.add('active');
    document.getElementById('selectedUserName').textContent = name;
    document.getElementById('selectedUserEmail').textContent = email;
    document.getElementById('billingEmpty').classList.add('hidden');
    document.getElementById('billingContent').classList.remove('hidden');
    closePaymentForm();
    await loadPayments();
}

async function loadPayments() {
    if (!selectedUser) return;
    try {
        const payments = await api(`/admin/users/${selectedUser}/payments`);
        renderPayments(payments);
        renderSummary(payments);
    } catch(e) { toast(e.message, 'error'); }
}

function renderSummary(payments) {
    const total = payments.reduce((s, p) => s + p.amount, 0);
    const paid = payments.filter(p => p.status === 'pago').reduce((s, p) => s + p.amount, 0);
    const pending = payments.filter(p => p.status !== 'pago').reduce((s, p) => s + p.amount, 0);
    document.getElementById('billingSummary').innerHTML = `
        ${summaryKpi('Total lançado', total, 'var(--text)')}
        ${summaryKpi('Total recebido', paid, 'var(--success)')}
        ${summaryKpi('Em aberto', pending, pending > 0 ? 'var(--warning)' : 'var(--text-4)')}`;
}

function summaryKpi(label, value, color) {
    return `<div class="kpi"><p class="kpi-label">${label}</p><p class="kpi-value mono" style="color:${color}">${fmtMoney(value)}</p></div>`;
}

function renderPayments(payments) {
    const tbody = document.getElementById('paymentsTable');
    const empty = document.getElementById('paymentsEmpty');
    if (!payments.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    tbody.innerHTML = payments.map(p => `
    <tr>
        <td style="color:var(--text); font-weight: 500;">${p.description}</td>
        <td class="num text-[12px]">${fmtDate(p.payment_date)}</td>
        <td class="num text-right" style="font-weight: 500;">${fmtMoney(p.amount)}</td>
        <td>
            <select onchange="updatePaymentStatus('${p.id}', this.value)" class="input mono text-[11px]" style="padding: 3px 22px 3px 8px; width: auto; display: inline-block;">
                <option value="pago"     ${p.status==='pago'?'selected':''}>Pago</option>
                <option value="pendente" ${p.status==='pendente'?'selected':''}>Pendente</option>
                <option value="inadimplente" ${p.status==='inadimplente'?'selected':''}>Inadimplente</option>
            </select>
        </td>
        <td class="actions">
            <button onclick="deletePayment('${p.id}')" class="btn btn-icon btn-sm" title="Remover"><i class="fa-solid fa-trash text-[10px]"></i></button>
        </td>
    </tr>`).join('');
}

function openPaymentForm() {
    document.getElementById('paymentForm').classList.remove('hidden-panel');
    document.getElementById('pDate').value = new Date().toISOString().split('T')[0];
}

function closePaymentForm() {
    document.getElementById('paymentForm').classList.add('hidden-panel');
    ['pDesc','pAmount','pDate'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('pStatus').value = 'pendente';
}

async function savePayment() {
    const desc = document.getElementById('pDesc').value.trim();
    const amount = parseFloat(document.getElementById('pAmount').value);
    const date = document.getElementById('pDate').value;
    const status = document.getElementById('pStatus').value;
    if (!desc || !amount || !date) { toast('Preencha todos os campos', 'error'); return; }
    try {
        await api(`/admin/users/${selectedUser}/payments`, { method: 'POST', body: JSON.stringify({ description: desc, amount, payment_date: date, status }) });
        toast('Lançamento salvo');
        closePaymentForm();
        loadPayments();
    } catch(e) { toast(e.message, 'error'); }
}

async function updatePaymentStatus(id, status) {
    try { await api(`/admin/payments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); toast('Status atualizado'); loadPayments(); }
    catch(e) { toast(e.message, 'error'); }
}

async function deletePayment(id) {
    if (!confirm('Remover este lançamento?')) return;
    try { await api(`/admin/payments/${id}`, { method: 'DELETE' }); toast('Lançamento removido'); loadPayments(); }
    catch(e) { toast(e.message, 'error'); }
}

initAdmin().then(() => { setTab('acessos'); loadPending(); loadUsers(); });
