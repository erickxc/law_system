/* ═══════════════════════════════════════════════════════════════════════
   profile.js — Perfil do usuário (dados pessoais + foto)
   ═══════════════════════════════════════════════════════════════════════ */

async function showProfile() {
    setActive('menu-perfil');
    setPage('Perfil', 'Conta');
    const u = me;
    document.getElementById('mainContent').innerHTML = `
    <div class="page-shell">
        <div class="mb-5">
            <h1 class="page-title">Perfil</h1>
            <p class="page-sub">Informações da conta</p>
        </div>

        <div class="max-w-2xl space-y-3">
            <div class="card">
                <div class="card-body">
                    <div class="flex items-start gap-4 pb-5 mb-5" style="border-bottom: 1px solid var(--border)">
                        <div class="relative">
                            ${u.photo_url
                                ? `<img src="${u.photo_url}" style="width:64px;height:64px;object-fit:cover;border-radius:4px;border:1px solid var(--border)" onerror="this.outerHTML='<div class=\\'avatar\\' style=\\'width:64px;height:64px;font-size:22px\\'>${getInitials(u.full_name)}</div>'">`
                                : `<div class="avatar" style="width:64px;height:64px;font-size:22px">${getInitials(u.full_name)}</div>`}
                            <button onclick="openPhotoModal()" style="position:absolute;bottom:-4px;right:-4px;width:22px;height:22px;background:var(--text);color:white;display:flex;align-items:center;justify-content:center;border-radius:3px;cursor:pointer;">
                                <i class="fa-solid fa-camera text-[9px]"></i>
                            </button>
                        </div>
                        <div class="flex-1 pt-1">
                            <p class="text-[16px] font-semibold" style="color:var(--text)">${u.full_name}</p>
                            <p class="text-[12.5px] mt-0.5" style="color:var(--text-3)">${u.email}</p>
                            <span class="badge ${u.role==='admin' ? 'badge-em-curso' : 'badge-default'} mt-2">${u.role==='admin'?'Administrador':'Estudante'}</span>
                        </div>
                    </div>

                    <form onsubmit="saveProfile(event)" class="space-y-3">
                        <div class="grid grid-cols-2 gap-3">
                            <div><label class="label">Nome completo</label><input class="input" id="p-name" value="${u.full_name||''}"></div>
                            <div><label class="label">Curso</label><input class="input" id="p-curso" value="${u.curso||''}" placeholder="Direito"></div>
                        </div>
                        <div class="grid grid-cols-3 gap-3">
                            <div><label class="label">Período atual</label><input type="number" class="input mono" id="p-period" value="${u.current_period||''}" min="1" max="12"></div>
                            <div><label class="label">Total períodos</label><input type="number" class="input mono" id="p-total" value="${u.total_periods||''}" min="1" max="12"></div>
                            <div><label class="label">Previsão</label><input class="input" id="p-estimate" value="${u.completion_estimate||''}" placeholder="Dez/2027"></div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div><label class="label">Telefone</label><input class="input mono" id="p-phone" value="${u.phone||''}" placeholder="(11) 99999-0000"></div>
                            <div><label class="label">CPF</label><input class="input mono" id="p-cpf" value="${u.cpf||''}" placeholder="000.000.000-00" ${u.cpf ? 'disabled' : ''}>${u.cpf ? '<p class="help">CPF não pode ser alterado</p>' : ''}</div>
                        </div>
                        <div class="flex justify-end pt-2">
                            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk text-[10px]"></i> Salvar</button>
                        </div>
                    </form>
                </div>
            </div>

            <div class="card">
                <div class="card-body flex items-center justify-between">
                    <div>
                        <p class="text-[12.5px] font-medium" style="color:var(--text)">Sair da conta</p>
                        <p class="text-[11.5px] mt-0.5" style="color:var(--text-4)">Encerra a sessão neste navegador.</p>
                    </div>
                    <button onclick="logout()" class="btn btn-danger"><i class="fa-solid fa-arrow-right-from-bracket text-[10px]"></i> Sair</button>
                </div>
            </div>
        </div>
    </div>`;
}

function openPhotoModal() {
    openModal(`
    <div class="modal-head"><h3>Foto de perfil</h3><button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button></div>
    <p class="text-[12.5px] mb-3" style="color:var(--text-3)">URL pública (http/https). Deixe em branco para remover.</p>
    <input id="photo-url-input" class="input mono" placeholder="https://..." value="${me.photo_url || ''}">
    <div class="flex gap-2 justify-end mt-4">
        <button onclick="closeModal()" class="btn">Cancelar</button>
        <button onclick="savePhoto()" class="btn btn-primary">Salvar</button>
    </div>`);
}

async function savePhoto() {
    const url = document.getElementById('photo-url-input').value.trim();
    try {
        const updated = await api('/users/me/photo', { method: 'PUT', body: JSON.stringify({ photo_url: url || null }) });
        me = { ...me, ...updated };
        closeModal();
        showProfile();
        toast(url ? 'Foto atualizada' : 'Foto removida', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

async function saveProfile(e) {
    e.preventDefault();
    const data = {
        full_name: document.getElementById('p-name').value.trim() || undefined,
        curso: document.getElementById('p-curso').value.trim() || null,
        current_period: parseInt(document.getElementById('p-period').value) || null,
        total_periods: parseInt(document.getElementById('p-total').value) || null,
        completion_estimate: document.getElementById('p-estimate').value.trim() || null,
        phone: document.getElementById('p-phone').value.trim() || null,
    };
    const cpfEl = document.getElementById('p-cpf');
    if (!cpfEl.disabled && cpfEl.value.trim()) data.cpf = cpfEl.value.trim();

    try {
        const updated = await api('/users/me/update', { method: 'PUT', body: JSON.stringify(data) });
        me = { ...me, ...updated };
        document.getElementById('userDisplayName').textContent = me.full_name;
        document.getElementById('sidebar-name').textContent = me.full_name;
        toast('Perfil atualizado', 'success');
    } catch (e) { toast(e.message, 'error'); }
}
