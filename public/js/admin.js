// ==============================================================================
// LINKCARD PRO - LÓGICA DEL PANEL DE ADMINISTRACIÓN
// ==============================================================================

let profiles = [];
let isAutoSlug = true;
let activeShareProfile = null;

// Inicialización cuando carga el DOM
document.addEventListener('DOMContentLoaded', () => {
  loadProfiles();
  setupLivePreviewListeners();
  lucide.createIcons();
});

// Helper para iconos de Lucide
function refreshIcons() {
  setTimeout(() => {
    if (window.lucide) {
      lucide.createIcons();
    }
  }, 50);
}

// ------------------------------------------------------------------------------
// SANITIZACIÓN Y GENERACIÓN DE SLUGS
// ------------------------------------------------------------------------------
function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Solo caracteres válidos
    .replace(/[\s_]+/g, '-') // Espacios a guiones
    .replace(/^-+|-+$/g, ''); // Quitar guiones sobrantes
}

function toggleAutoSlug() {
  isAutoSlug = !isAutoSlug;
  const toggleBtn = document.getElementById('autoSlugToggle');
  if (isAutoSlug) {
    toggleBtn.textContent = 'Auto';
    toggleBtn.className = 'px-3 py-2 text-xs text-cyan-400 hover:text-cyan-300 font-medium';
    // Sincronizar inmediatamente con el nombre
    const nameVal = document.getElementById('full_name').value;
    document.getElementById('slug').value = slugify(nameVal);
  } else {
    toggleBtn.textContent = 'Manual';
    toggleBtn.className = 'px-3 py-2 text-xs text-amber-400 hover:text-amber-300 font-medium';
    document.getElementById('slug').focus();
  }
}

// ------------------------------------------------------------------------------
// CARGA Y GESTIÓN DE PERFILES DESDE LA API
// ------------------------------------------------------------------------------
async function loadProfiles() {
  const container = document.getElementById('profilesList');
  try {
    const response = await fetch('/api/profiles');
    if (!response.ok) throw new Error('Error al conectar con la API');
    
    profiles = await response.json();
    renderProfilesList(profiles);
    updateStats(profiles);

    // Si el formulario está vacío y hay perfiles, inicializar la vista previa con el primero
    const currentId = document.getElementById('profileId').value;
    if (!currentId && profiles.length > 0) {
      updateLivePreview(profiles[0]);
    }
  } catch (error) {
    console.error(error);
    container.innerHTML = `
      <div class="p-4 bg-rose-950/40 border border-rose-900 rounded-xl text-xs text-rose-300 text-center">
        Error al cargar los perfiles. Verifica que el servidor esté activo.
      </div>
    `;
  }
}

function updateStats(items) {
  const total = items.length;
  const active = items.filter((p) => p.is_active).length;

  document.getElementById('statTotalCount').textContent = total;
  document.getElementById('statActiveCount').textContent = active;
  document.getElementById('profilesBadgeCount').textContent = `${total} perfil${total === 1 ? '' : 'es'}`;
}

function renderProfilesList(items) {
  const container = document.getElementById('profilesList');
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 px-4 border border-dashed border-slate-800 rounded-2xl">
        <i data-lucide="layers" class="w-8 h-8 mx-auto text-slate-600 mb-2"></i>
        <p class="text-xs text-slate-400 font-medium">No hay perfiles registrados todavía.</p>
        <p class="text-[11px] text-slate-600 mt-1">Crea tu primer perfil con el formulario.</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  container.innerHTML = items
    .map((profile) => {
      const avatarSrc = profile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';
      const statusBadge = profile.is_active
        ? '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Activo</span>'
        : '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">Inactivo</span>';

      return `
        <div class="p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <img src="${avatarSrc}" alt="${profile.full_name}" 
              onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'"
              class="w-11 h-11 rounded-full object-cover border-2 shadow-sm shrink-0" style="border-color: ${profile.theme_color || '#0284c7'}">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h4 class="text-xs font-bold text-white truncate">${escapeHtml(profile.full_name)}</h4>
                ${statusBadge}
              </div>
              <p class="text-[11px] text-slate-400 truncate">${escapeHtml(profile.bio_title || 'Sin cargo definido')}</p>
              <a href="/u/${profile.slug}" target="_blank" class="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-0.5">
                <span>/u/${profile.slug}</span>
                <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
              </a>
            </div>
          </div>

          <!-- Acciones -->
          <div class="flex items-center gap-1.5 self-end sm:self-center shrink-0">
            <!-- Ver enlace -->
            <a href="/u/${profile.slug}" target="_blank" title="Ver perfil público"
              class="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            </a>

            <!-- Compartir y QR -->
            <button type="button" onclick="openShareModalById('${profile.id}')" title="Compartir y QR"
              class="p-2 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-400 hover:text-cyan-300 border border-cyan-800/40 transition">
              <i data-lucide="qr-code" class="w-3.5 h-3.5"></i>
            </button>

            <!-- Editar -->
            <button type="button" onclick="editProfile('${profile.id}')" title="Editar perfil"
              class="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>

            <!-- Eliminar -->
            <button type="button" onclick="deleteProfile('${profile.id}', '${escapeHtml(profile.full_name)}')" title="Eliminar perfil"
              class="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 border border-rose-900/40 transition">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  refreshIcons();
}

// ------------------------------------------------------------------------------
// SINCRONIZACIÓN EN VIVO CON EL SIMULADOR DE SMARTPHONE
// ------------------------------------------------------------------------------
function setupLivePreviewListeners() {
  const form = document.getElementById('profileForm');

  // Input listeners
  document.getElementById('full_name').addEventListener('input', (e) => {
    const val = e.target.value;
    if (isAutoSlug) {
      document.getElementById('slug').value = slugify(val);
    }
    updateLivePreview();
  });

  const liveInputs = [
    'bio_title',
    'company_name',
    'avatar_url',
    'phone',
    'email',
    'website',
    'instagram',
    'facebook',
    'linkedin',
    'theme_color',
  ];

  liveInputs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => updateLivePreview());
    }
  });

  document.getElementById('is_active').addEventListener('change', (e) => {
    const dot = document.getElementById('statusDot');
    if (e.target.checked) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400';
    } else {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-slate-600';
    }
  });
}

function updateLivePreview(profileData = null) {
  // Si nos pasan un objeto de datos explícito, usarlo; sino leer del formulario
  const data = profileData || {
    full_name: document.getElementById('full_name').value || 'Tu Nombre',
    bio_title: document.getElementById('bio_title').value || 'Cargo o Profesión',
    company_name: document.getElementById('company_name').value || '',
    avatar_url:
      document.getElementById('avatar_url').value ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&h=400&q=80',
    phone: document.getElementById('phone').value || '',
    email: document.getElementById('email').value || '',
    theme_color: document.getElementById('theme_color').value || '#0284c7',
  };

  // Avatar
  const avatarEl = document.getElementById('prevAvatar');
  avatarEl.src = data.avatar_url;
  avatarEl.style.borderColor = data.theme_color;

  // Textos
  document.getElementById('prevName').textContent = data.full_name;
  document.getElementById('prevTitle').textContent = data.bio_title;

  const compEl = document.getElementById('prevCompany');
  if (data.company_name) {
    compEl.textContent = data.company_name;
    compEl.classList.remove('hidden');
  } else {
    compEl.classList.add('hidden');
  }

  // Color del botón de WhatsApp
  const waBtn = document.getElementById('prevWhatsappBtn');
  if (waBtn) {
    waBtn.style.backgroundColor = data.theme_color;
  }
}

// Paleta de colores
function setThemeColor(hex) {
  document.getElementById('theme_color').value = hex;
  document.getElementById('themeColorPicker').value = hex;
  updateLivePreview();
}

function syncThemeColorFromPicker(hex) {
  document.getElementById('theme_color').value = hex;
  updateLivePreview();
}

function setSampleAvatar() {
  const samples = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&h=400&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&h=400&q=80',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=400&h=400&q=80',
  ];
  const randomImg = samples[Math.floor(Math.random() * samples.length)];
  document.getElementById('avatar_url').value = randomImg;
  updateLivePreview();
}

// ------------------------------------------------------------------------------
// ENVÍO DEL FORMULARIO (CREAR O ACTUALIZAR)
// ------------------------------------------------------------------------------
async function handleFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('profileId').value;
  const isEditing = Boolean(id);

  const payload = {
    full_name: document.getElementById('full_name').value.trim(),
    bio_title: document.getElementById('bio_title').value.trim(),
    company_name: document.getElementById('company_name').value.trim(),
    avatar_url: document.getElementById('avatar_url').value.trim(),
    slug: slugify(document.getElementById('slug').value),
    phone: document.getElementById('phone').value.trim(),
    whatsapp_message: document.getElementById('whatsapp_message').value.trim(),
    email: document.getElementById('email').value.trim(),
    website: document.getElementById('website').value.trim(),
    instagram: document.getElementById('instagram').value.trim(),
    facebook: document.getElementById('facebook').value.trim(),
    linkedin: document.getElementById('linkedin').value.trim(),
    theme_color: document.getElementById('theme_color').value.trim(),
    is_active: document.getElementById('is_active').checked,
  };

  if (!payload.full_name) {
    showToast('El nombre es obligatorio.', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  const submitText = document.getElementById('submitBtnText');
  submitBtn.disabled = true;
  submitText.textContent = isEditing ? 'Actualizando...' : 'Guardando...';

  try {
    const url = isEditing ? `/api/profiles/${id}` : '/api/profiles';
    const method = isEditing ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Ocurrió un error al guardar');
    }

    showToast(isEditing ? '¡Perfil actualizado con éxito!' : '¡Perfil creado con éxito!', 'success');
    resetFormToCreate();
    await loadProfiles();

    // Abrir automáticamente modal de compartir para el nuevo perfil
    if (!isEditing) {
      openShareModal(data);
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = document.getElementById('profileId').value ? 'Actualizar Perfil' : 'Guardar Perfil';
  }
}

// ------------------------------------------------------------------------------
// EDICIÓN Y REINICIO DE FORMULARIO
// ------------------------------------------------------------------------------
function editProfile(id) {
  const profile = profiles.find((p) => p.id === id);
  if (!profile) return;

  document.getElementById('profileId').value = profile.id;
  document.getElementById('full_name').value = profile.full_name || '';
  document.getElementById('bio_title').value = profile.bio_title || '';
  document.getElementById('company_name').value = profile.company_name || '';
  document.getElementById('avatar_url').value = profile.avatar_url || '';
  document.getElementById('slug').value = profile.slug || '';
  document.getElementById('phone').value = profile.phone || '';
  document.getElementById('whatsapp_message').value = profile.whatsapp_message || '';
  document.getElementById('email').value = profile.email || '';
  document.getElementById('website').value = profile.website || '';
  document.getElementById('instagram').value = profile.instagram || '';
  document.getElementById('facebook').value = profile.facebook || '';
  document.getElementById('linkedin').value = profile.linkedin || '';
  document.getElementById('theme_color').value = profile.theme_color || '#0284c7';
  document.getElementById('themeColorPicker').value = profile.theme_color || '#0284c7';
  document.getElementById('is_active').checked = profile.is_active !== false;

  // Cambiar textos del formulario
  document.getElementById('formTitle').innerHTML = `
    <i data-lucide="edit" class="w-5 h-5 text-amber-400"></i>
    <span>Editar Perfil: ${escapeHtml(profile.full_name)}</span>
  `;
  document.getElementById('formSubtitle').textContent = 'Modifica los datos del perfil y presiona Actualizar.';
  document.getElementById('submitBtnText').textContent = 'Actualizar Perfil';
  document.getElementById('cancelEditBtn').classList.remove('hidden');

  isAutoSlug = false;
  document.getElementById('autoSlugToggle').textContent = 'Manual';
  document.getElementById('autoSlugToggle').className = 'px-3 py-2 text-xs text-amber-400 hover:text-amber-300 font-medium';

  updateLivePreview(profile);
  refreshIcons();

  // Scroll suave al formulario
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFormToCreate() {
  document.getElementById('profileForm').reset();
  document.getElementById('profileId').value = '';
  document.getElementById('formTitle').innerHTML = `
    <i data-lucide="user-plus" class="w-5 h-5 text-cyan-400"></i>
    <span>Crear Nuevo Perfil</span>
  `;
  document.getElementById('formSubtitle').textContent = 'Completa los datos para generar tu URL pública y código QR único.';
  document.getElementById('submitBtnText').textContent = 'Guardar Perfil';
  document.getElementById('cancelEditBtn').classList.add('hidden');

  isAutoSlug = true;
  document.getElementById('autoSlugToggle').textContent = 'Auto';
  document.getElementById('autoSlugToggle').className = 'px-3 py-2 text-xs text-cyan-400 hover:text-cyan-300 font-medium';

  setThemeColor('#0284c7');
  updateLivePreview();
  refreshIcons();
}

// ------------------------------------------------------------------------------
// ELIMINACIÓN DE PERFIL
// ------------------------------------------------------------------------------
async function deleteProfile(id, name) {
  if (!confirm(`¿Estás seguro de eliminar el perfil "${name}"? Esta acción no se puede deshacer.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar');

    showToast('Perfil eliminado correctamente.', 'success');
    if (document.getElementById('profileId').value === id) {
      resetFormToCreate();
    }
    await loadProfiles();
  } catch (error) {
    showToast('No se pudo eliminar el perfil.', 'error');
  }
}

// ------------------------------------------------------------------------------
// MODAL DE COMPARTIR, QR Y DESCARGA PNG
// ------------------------------------------------------------------------------
function openShareModalById(id) {
  const profile = profiles.find((p) => p.id === id);
  if (profile) openShareModal(profile);
}

function openShareModal(profile) {
  activeShareProfile = profile;
  const modal = document.getElementById('shareModal');
  const fullUrl = `${window.location.origin}/u/${profile.slug}`;

  document.getElementById('modalProfileName').textContent = profile.full_name;
  document.getElementById('modalProfileSlug').textContent = `/u/${profile.slug}`;
  document.getElementById('modalFullUrl').value = fullUrl;
  document.getElementById('modalOpenTabLink').href = `/u/${profile.slug}`;

  // Renderizado del código QR en alta resolución sobre el canvas
  const canvas = document.getElementById('qrCanvas');
  QRCode.toCanvas(
    canvas,
    fullUrl,
    {
      width: 256,
      margin: 1.5,
      color: {
        dark: '#090d16',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    },
    (err) => {
      if (err) console.error('Error al generar código QR:', err);
    }
  );

  modal.classList.remove('hidden');
  refreshIcons();
}

function closeShareModal() {
  document.getElementById('shareModal').classList.add('hidden');
  activeShareProfile = null;
}

// Descargar QR como imagen PNG
function downloadQRCode() {
  const canvas = document.getElementById('qrCanvas');
  if (!canvas || !activeShareProfile) return;

  const image = canvas.toDataURL('image/png');
  const downloadLink = document.createElement('a');
  downloadLink.href = image;
  downloadLink.download = `qr-${activeShareProfile.slug}.png`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  showToast('¡Código QR descargado en PNG!', 'success');
}

// Copiar enlace al portapapeles
async function copyModalUrl() {
  const input = document.getElementById('modalFullUrl');
  try {
    await navigator.clipboard.writeText(input.value);
    const copyBtnText = document.getElementById('copyBtnText');
    copyBtnText.textContent = '¡Copiado!';
    showToast('Enlace copiado al portapapeles.', 'success');
    setTimeout(() => {
      copyBtnText.textContent = 'Copiar';
    }, 2000);
  } catch (err) {
    input.select();
    document.execCommand('copy');
    showToast('Enlace copiado.', 'success');
  }
}

// ------------------------------------------------------------------------------
// SISTEMA DE NOTIFICACIONES TOAST
// ------------------------------------------------------------------------------
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMessage');
  const iconEl = document.getElementById('toastIcon');

  msgEl.textContent = message;

  if (type === 'success') {
    toast.className =
      'fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 transition-all duration-300 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold bg-emerald-500 text-white shadow-emerald-500/20';
    iconEl.setAttribute('data-lucide', 'check-circle-2');
  } else {
    toast.className =
      'fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 transition-all duration-300 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold bg-rose-500 text-white shadow-rose-500/20';
    iconEl.setAttribute('data-lucide', 'alert-circle');
  }

  refreshIcons();

  setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-2');
  }, 3000);
}

// Escape de HTML para prevención XSS básica en renderizado
function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
