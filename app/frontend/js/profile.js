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
    <div class="modal-head">
        <h3>Foto de perfil</h3>
        <button onclick="closeModal()" class="modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <!-- Preview -->
    <div class="flex items-center gap-4 mb-5">
        <div id="photo-preview" style="width:80px; height:80px; border:1px solid var(--border); border-radius:6px; background-size:cover; background-position:center; background-color:var(--bg-2); display:flex; align-items:center; justify-content:center;">
            ${me.photo_url ? '' : `<i class="fa-solid fa-user text-[28px]" style="color:var(--text-5)"></i>`}
        </div>
        <div class="flex-1">
            <p class="text-[13px] font-medium" style="color:var(--text)">${me.full_name}</p>
            <p class="text-[11.5px]" style="color:var(--text-4)">${me.email}</p>
        </div>
    </div>

    <!-- Tabs -->
    <div class="tab-bar" style="margin-bottom: 14px;">
        <button id="ptab-file" onclick="switchPhotoTab('file')" class="tab-btn active"><i class="fa-solid fa-cloud-arrow-up text-[10px]"></i> Enviar do dispositivo</button>
        <button id="ptab-url"  onclick="switchPhotoTab('url')"  class="tab-btn"><i class="fa-solid fa-link text-[10px]"></i> URL externa</button>
    </div>

    <!-- Tab: file -->
    <div id="ptab-content-file">
        <label for="photo-file-input" class="block cursor-pointer" style="border: 2px dashed var(--border-2); border-radius: 6px; padding: 24px; text-align: center; transition: all .15s;" onmouseover="this.style.borderColor='var(--accent)'; this.style.background='var(--accent-bg)'" onmouseout="this.style.borderColor='var(--border-2)'; this.style.background=''">
            <i class="fa-solid fa-image text-[28px] mb-2" style="color:var(--text-4)"></i>
            <p class="text-[13px] font-medium" style="color:var(--text)">Clique ou arraste uma imagem</p>
            <p class="text-[11.5px] mt-1" style="color:var(--text-4)">JPEG, PNG, WebP · até 5MB · será redimensionada para 256px</p>
        </label>
        <input type="file" id="photo-file-input" accept="image/jpeg,image/png,image/webp" style="display:none" onchange="handlePhotoFile(this.files[0])">
        <div id="photo-status" class="hidden text-[12px] mt-3 p-2" style="background:var(--bg-2); border-radius: 4px;"></div>
    </div>

    <!-- Tab: URL -->
    <div id="ptab-content-url" class="hidden">
        <label class="label">URL pública</label>
        <input id="photo-url-input" class="input mono" placeholder="https://..." value="${(me.photo_url && me.photo_url.startsWith('http')) ? me.photo_url : ''}">
        <p class="help">URL http(s) de uma imagem pública.</p>
    </div>

    <!-- Hidden state: o data:image base64 que vai ser salvo -->
    <input type="hidden" id="photo-data-url" value="${(me.photo_url && me.photo_url.startsWith('data:')) ? me.photo_url : ''}">

    <div class="flex gap-2 justify-between mt-5">
        ${me.photo_url ? '<button onclick="removePhoto()" class="btn btn-danger"><i class="fa-solid fa-trash text-[10px]"></i> Remover foto</button>' : '<div></div>'}
        <div class="flex gap-2">
            <button onclick="closeModal()" class="btn">Cancelar</button>
            <button onclick="savePhoto()" class="btn btn-primary">Salvar</button>
        </div>
    </div>`);

    // Atualiza preview se já tem foto
    if (me.photo_url) {
        const preview = document.getElementById('photo-preview');
        preview.style.backgroundImage = `url("${me.photo_url}")`;
    }
}

let _photoTab = 'file';
function switchPhotoTab(tab) {
    _photoTab = tab;
    document.getElementById('ptab-file').classList.toggle('active', tab === 'file');
    document.getElementById('ptab-url').classList.toggle('active', tab === 'url');
    document.getElementById('ptab-content-file').classList.toggle('hidden', tab !== 'file');
    document.getElementById('ptab-content-url').classList.toggle('hidden', tab !== 'url');
}

async function handlePhotoFile(file) {
    if (!file) return;
    const status = document.getElementById('photo-status');
    status.classList.remove('hidden');

    if (file.size > 5 * 1024 * 1024) {
        status.style.color = 'var(--danger)';
        status.textContent = 'Arquivo muito grande (máx 5MB).';
        return;
    }

    status.style.color = 'var(--text-3)';
    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando…';

    try {
        const dataUrl = await resizeImage(file, 256, 256, 0.85);
        const sizeKB = Math.round(dataUrl.length * 0.75 / 1024);
        document.getElementById('photo-data-url').value = dataUrl;
        // Show preview
        document.getElementById('photo-preview').style.backgroundImage = `url("${dataUrl}")`;
        document.getElementById('photo-preview').innerHTML = '';
        status.style.color = 'var(--success)';
        status.innerHTML = `<i class="fa-solid fa-circle-check"></i> Pronto · ${sizeKB}KB. Clique em Salvar.`;
    } catch (e) {
        status.style.color = 'var(--danger)';
        status.textContent = `Erro: ${e.message}`;
    }
}

/* Resize via canvas — retorna data URL JPEG */
function resizeImage(file, maxW, maxH, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = e => { img.src = e.target.result; };
        reader.onerror = () => reject(new Error('Não consegui ler o arquivo.'));
        img.onload = () => {
            // Calcular nova dimensão mantendo proporção
            let w = img.width, h = img.height;
            const ratio = Math.min(maxW / w, maxH / h, 1);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
            // Square crop centrado se o user enviar retangular muito alongado
            const side = Math.min(w, h);
            const canvas = document.createElement('canvas');
            canvas.width = side;
            canvas.height = side;
            const ctx = canvas.getContext('2d');
            const offX = (w - side) / 2;
            const offY = (h - side) / 2;
            ctx.drawImage(img, -offX, -offY, w, h);
            try {
                resolve(canvas.toDataURL('image/jpeg', quality));
            } catch (e) {
                reject(new Error('Erro ao processar imagem.'));
            }
        };
        img.onerror = () => reject(new Error('Imagem inválida.'));
        reader.readAsDataURL(file);
    });
}

async function savePhoto() {
    let photoUrl = null;
    if (_photoTab === 'file') {
        photoUrl = document.getElementById('photo-data-url').value || null;
    } else {
        photoUrl = document.getElementById('photo-url-input').value.trim() || null;
    }
    try {
        const updated = await api('/users/me/photo', {
            method: 'PUT',
            body: JSON.stringify({ photo_url: photoUrl }),
        });
        me = { ...me, ...updated };
        closeModal();
        showProfile();
        toast(photoUrl ? 'Foto atualizada' : 'Foto removida', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

async function removePhoto() {
    if (!confirm('Remover foto de perfil?')) return;
    try {
        const updated = await api('/users/me/photo', { method: 'PUT', body: JSON.stringify({ photo_url: null }) });
        me = { ...me, ...updated };
        closeModal();
        showProfile();
        toast('Foto removida', 'success');
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
