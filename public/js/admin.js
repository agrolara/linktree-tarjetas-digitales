// ==============================================================================
// LINKCARD PRO - LÓGICA DEL PANEL DE ADMINISTRACIÓN Y AUTENTICACIÓN
// ==============================================================================

let profiles = [];
let isAutoSlug = true;
let activeShareProfile = null;
let currentQrInstance = null;
let currentUser = null;

// Inicialización cuando carga el DOM
document.addEventListener('DOMContentLoaded', () => {
  checkAuthState();
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
// GESTIÓN DE SESIÓN Y AUTENTICACIÓN
// ------------------------------------------------------------------------------
function getAuthToken() {
  return localStorage.getItem('linkcard_token');
}

function updateUserRoleUI(user) {
  const roleBadge = document.getElementById('userRoleBadge');
  const tabUsersBtn = document.getElementById('tabUsersBtn');

  if (user) {
    const isSuper = user.role === 'superadmin';
    if (roleBadge) {
      roleBadge.textContent = isSuper
        ? 'Superadministrador: Mauricio Lara'
        : `Cliente: ${user.name || user.email}`;
      roleBadge.className = isSuper
        ? 'text-xs text-cyan-400 font-semibold hidden sm:block'
        : 'text-xs text-slate-300 font-medium hidden sm:block';
    }
    if (tabUsersBtn) {
      if (isSuper) {
        tabUsersBtn.classList.remove('hidden');
      } else {
        tabUsersBtn.classList.add('hidden');
      }
    }
  }
}

async function checkAuthState() {
  const token = getAuthToken();
  const landingView = document.getElementById('landingView');
  const adminView = document.getElementById('adminView');

  if (!token) {
    landingView.classList.remove('hidden');
    adminView.classList.add('hidden');
    refreshIcons();
    return;
  }

  try {
    const res = await fetch('/api/auth/check', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      updateUserRoleUI(currentUser);
      landingView.classList.add('hidden');
      adminView.classList.remove('hidden');
      await loadProfiles();
    } else {
      localStorage.removeItem('linkcard_token');
      currentUser = null;
      landingView.classList.remove('hidden');
      adminView.classList.add('hidden');
    }
  } catch (err) {
    landingView.classList.remove('hidden');
    adminView.classList.add('hidden');
  }

  refreshIcons();
}

function openLoginModal() {
  const modal = document.getElementById('loginModal');
  document.getElementById('loginError').classList.add('hidden');
  modal.classList.remove('hidden');
  document.getElementById('loginEmail').focus();
  refreshIcons();
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.add('hidden');
}

async function handleLoginSubmit(e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitBtn = document.getElementById('loginSubmitBtn');
  const submitText = document.getElementById('loginSubmitText');
  const errorEl = document.getElementById('loginError');
  const errorText = document.getElementById('loginErrorText');

  errorEl.classList.add('hidden');
  submitBtn.disabled = true;
  submitText.textContent = 'Verificando...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Credenciales incorrectas');
    }

    // Guardar token
    localStorage.setItem('linkcard_token', data.token);
    currentUser = data.user;
    updateUserRoleUI(currentUser);
    closeLoginModal();
    showToast('¡Bienvenido al Panel de Control!', 'success');

    // Cambiar a vista administrativa
    document.getElementById('landingView').classList.add('hidden');
    document.getElementById('adminView').classList.remove('hidden');

    await loadProfiles();
  } catch (err) {
    errorText.textContent = err.message;
    errorEl.classList.remove('hidden');
    refreshIcons();
  } finally {
    submitBtn.disabled = false;
    submitText.textContent = 'Entrar al Panel de Control';
  }
}

function handleLogout() {
  if (confirm('¿Deseas cerrar tu sesión actual?')) {
    localStorage.removeItem('linkcard_token');
    currentUser = null;
    document.getElementById('adminView').classList.add('hidden');
    document.getElementById('landingView').classList.remove('hidden');
    showToast('Sesión cerrada correctamente.', 'success');
    refreshIcons();
  }
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
// NORMALIZACIÓN DE IMÁGENES (GOOGLE DRIVE, DROPBOX, ETC.)
// ------------------------------------------------------------------------------
function normalizeImageUrl(url) {
  if (!url) return '';
  const cleanUrl = url.trim();

  // Google Drive (Enlaces de compartir, vista previa, visor web)
  const driveFileMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const driveIdMatch = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const fileId = (driveFileMatch && driveFileMatch[1]) || (driveIdMatch && driveIdMatch[1]);

  if (fileId && (cleanUrl.includes('drive.google.com') || cleanUrl.includes('docs.google.com'))) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // Dropbox (reemplazar dl=0 por raw=1 para streaming directo)
  if (cleanUrl.includes('dropbox.com')) {
    return cleanUrl.replace(/[?&]dl=0/, '?raw=1');
  }

  return cleanUrl;
}

// ------------------------------------------------------------------------------
// CARGA Y GESTIÓN DE PERFILES DESDE LA API
// ------------------------------------------------------------------------------
async function loadProfiles() {
  const container = document.getElementById('profilesList');
  const token = getAuthToken();

  try {
    const response = await fetch('/api/profiles', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      handleLogout();
      return;
    }

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
        Error al cargar los perfiles. Verifica la conexión con el servidor.
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
  const isSuper = currentUser && currentUser.role === 'superadmin';

  if (!items || items.length === 0) {
    const emptyMsg = isSuper
      ? 'No hay tarjetas registradas en el sistema todavía.'
      : 'Aún no has creado tu tarjeta digital.';
    const emptySub = isSuper
      ? 'Crea un perfil o asigna cuentas a tus clientes.'
      : 'Completa los datos en el formulario de la izquierda para publicarla.';

    container.innerHTML = `
      <div class="text-center py-10 px-4 border border-dashed border-slate-800 rounded-2xl">
        <i data-lucide="layers" class="w-8 h-8 mx-auto text-slate-600 mb-2"></i>
        <p class="text-xs text-slate-400 font-medium">${emptyMsg}</p>
        <p class="text-[11px] text-slate-600 mt-1">${emptySub}</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  container.innerHTML = items
    .map((profile) => {
      const avatarSrc = normalizeImageUrl(profile.avatar_url) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';
      const statusBadge = profile.is_active
        ? '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Activo</span>'
        : '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">Inactivo</span>';

      const ownerBadge = (isSuper && profile.user_email)
        ? `<span class="text-[9px] font-mono px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 truncate max-w-[140px]" title="Propietario: ${escapeHtml(profile.user_email)}">Cliente: ${escapeHtml(profile.user_email.split('@')[0])}</span>`
        : '';

      return `
        <div class="p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <img src="${avatarSrc}" alt="${profile.full_name}" referrerpolicy="no-referrer"
              onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'"
              class="w-11 h-11 rounded-full object-cover border-2 shadow-sm shrink-0" style="border-color: ${profile.theme_color || '#0284c7'}">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="text-xs font-bold text-white truncate">${escapeHtml(profile.full_name)}</h4>
                ${statusBadge}
                ${ownerBadge}
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
  const fullNameEl = document.getElementById('full_name');
  if (fullNameEl) {
    fullNameEl.addEventListener('input', (e) => {
      const val = e.target.value;
      if (isAutoSlug) {
        document.getElementById('slug').value = slugify(val);
      }
      updateLivePreview();
    });
  }

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

  const isActiveEl = document.getElementById('is_active');
  if (isActiveEl) {
    isActiveEl.addEventListener('change', (e) => {
      const dot = document.getElementById('statusDot');
      if (dot) {
        if (e.target.checked) {
          dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400';
        } else {
          dot.className = 'w-2.5 h-2.5 rounded-full bg-slate-600';
        }
      }
    });
  }
}

function updateLivePreview(profileData = null) {
  const avatarInput = document.getElementById('avatar_url');
  const rawAvatar =
    (profileData ? profileData.avatar_url : (avatarInput ? avatarInput.value : '')) ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&h=400&q=80';

  const normalizedAvatar = normalizeImageUrl(rawAvatar);

  const data = profileData || {
    full_name: document.getElementById('full_name')?.value || 'Tu Nombre',
    bio_title: document.getElementById('bio_title')?.value || 'Cargo o Profesión',
    company_name: document.getElementById('company_name')?.value || '',
    avatar_url: normalizedAvatar,
    phone: document.getElementById('phone')?.value || '',
    email: document.getElementById('email')?.value || '',
    theme_color: document.getElementById('theme_color')?.value || '#0284c7',
  };

  // Avatar con referrerpolicy
  const avatarEl = document.getElementById('prevAvatar');
  if (avatarEl) {
    avatarEl.setAttribute('referrerpolicy', 'no-referrer');
    avatarEl.src = normalizedAvatar;
    avatarEl.style.borderColor = data.theme_color;
  }

  // Textos
  const prevName = document.getElementById('prevName');
  if (prevName) prevName.textContent = data.full_name;

  const prevTitle = document.getElementById('prevTitle');
  if (prevTitle) prevTitle.textContent = data.bio_title;

  const compEl = document.getElementById('prevCompany');
  if (compEl) {
    if (data.company_name) {
      compEl.textContent = data.company_name;
      compEl.classList.remove('hidden');
    } else {
      compEl.classList.add('hidden');
    }
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
  const token = getAuthToken();

  const rawAvatarUrl = document.getElementById('avatar_url').value.trim();
  const normalizedAvatar = normalizeImageUrl(rawAvatarUrl);

  const payload = {
    full_name: document.getElementById('full_name').value.trim(),
    bio_title: document.getElementById('bio_title').value.trim(),
    company_name: document.getElementById('company_name').value.trim(),
    avatar_url: normalizedAvatar,
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        handleLogout();
        throw new Error('Sesión expirada. Por favor ingresa nuevamente.');
      }
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

  const token = getAuthToken();

  try {
    const res = await fetch(`/api/profiles/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        handleLogout();
        throw new Error('Sesión expirada.');
      }
      throw new Error('Error al eliminar');
    }

    showToast('Perfil eliminado correctamente.', 'success');
    if (document.getElementById('profileId').value === id) {
      resetFormToCreate();
    }
    await loadProfiles();
  } catch (error) {
    showToast(error.message || 'No se pudo eliminar el perfil.', 'error');
  }
}

// ------------------------------------------------------------------------------
// MODAL DE COMPARTIR, QR Y DESCARGA PNG (100% LOCAL Y ROBUSTO)
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

  // Renderizado del código QR usando librería local integrada
  const container = document.getElementById('qrCodeContainer');
  container.innerHTML = '';

  try {
    currentQrInstance = new QRCode(container, {
      text: fullUrl,
      width: 192,
      height: 192,
      colorDark: '#090d16',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  } catch (err) {
    console.error('Error al generar código QR:', err);
    container.innerHTML = '<p class="text-xs text-rose-500">Error al dibujar el código QR.</p>';
  }

  modal.classList.remove('hidden');
  refreshIcons();
}

function closeShareModal() {
  document.getElementById('shareModal').classList.add('hidden');
  activeShareProfile = null;
  currentQrInstance = null;
}

// Descargar QR como imagen PNG
function downloadQRCode() {
  const container = document.getElementById('qrCodeContainer');
  if (!container || !activeShareProfile) return;

  const canvas = container.querySelector('canvas');
  const img = container.querySelector('img');

  let dataUrl = '';
  if (canvas) {
    dataUrl = canvas.toDataURL('image/png');
  } else if (img && img.src) {
    dataUrl = img.src;
  }

  if (!dataUrl) {
    showToast('Generando código QR, por favor espera un instante...', 'error');
    return;
  }

  const downloadLink = document.createElement('a');
  downloadLink.href = dataUrl;
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
// GESTIÓN DE COLABORADORES & PESTAÑAS (SUPERADMINISTRADOR)
// ------------------------------------------------------------------------------
function switchAdminTab(tab) {
  const cardsSection = document.getElementById('cardsViewSection');
  const usersSection = document.getElementById('usersViewSection');
  const tabCardsBtn = document.getElementById('tabCardsBtn');
  const tabUsersBtn = document.getElementById('tabUsersBtn');

  if (tab === 'users') {
    cardsSection.classList.add('hidden');
    usersSection.classList.remove('hidden');

    tabUsersBtn.className = 'px-3 py-1.5 rounded-lg bg-cyan-600 text-white shadow-sm transition';
    tabCardsBtn.className = 'px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition';

    loadUsers();
  } else {
    usersSection.classList.add('hidden');
    cardsSection.classList.remove('hidden');

    tabCardsBtn.className = 'px-3 py-1.5 rounded-lg bg-cyan-600 text-white shadow-sm transition';
    tabUsersBtn.className = 'px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition';
  }
  refreshIcons();
}

async function loadUsers() {
  const listEl = document.getElementById('usersList');
  const token = getAuthToken();
  if (!listEl) return;

  listEl.innerHTML = `
    <div class="text-center py-8 text-slate-500 text-xs">
      <i data-lucide="loader-2" class="w-5 h-5 mx-auto mb-2 animate-spin text-cyan-500"></i>
      Cargando lista de clientes...
    </div>
  `;
  refreshIcons();

  try {
    const res = await fetch('/api/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('No tienes permisos o ocurrió un error al obtener clientes.');
    const users = await res.json();

    if (!users || users.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-10 px-4 border border-dashed border-slate-800 rounded-2xl">
          <i data-lucide="users" class="w-8 h-8 mx-auto text-slate-600 mb-2"></i>
          <p class="text-xs text-slate-400 font-medium">No hay clientes registrados aún.</p>
          <p class="text-[11px] text-slate-600 mt-1">Crea cuentas para tus clientes con el botón 'Nuevo Cliente'.</p>
        </div>
      `;
      refreshIcons();
      return;
    }

    listEl.innerHTML = users.map(u => {
      const isSuper = u.role === 'superadmin';
      const badge = isSuper
        ? '<span class="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Superadmin</span>'
        : '<span class="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Cliente</span>';

      const deleteBtn = isSuper ? '' : `
        <button type="button" onclick="deleteUser('${u.id}', '${escapeHtml(u.name)}')" title="Revocar acceso y eliminar cliente"
          class="p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 border border-rose-900/40 transition flex items-center gap-1.5 text-xs">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          <span class="hidden sm:inline">Eliminar</span>
        </button>
      `;

      const dateFormatted = u.created_at ? new Date(u.created_at).toLocaleDateString('es-CL') : 'Activo';

      return `
        <div class="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-start sm:items-center gap-3.5 min-w-0">
            <div class="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 font-black text-sm shrink-0 shadow-inner">
              ${escapeHtml((u.name || u.email || 'C')[0].toUpperCase())}
            </div>
            <div class="min-w-0 space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="text-xs sm:text-sm font-bold text-white truncate">${escapeHtml(u.name || 'Sin Nombre')}</h4>
                ${badge}
                <span class="text-[10px] text-slate-500">Registrado el ${dateFormatted}</span>
              </div>
              
              <!-- Correo y Contraseña visible para recordar al cliente -->
              <div class="flex flex-wrap items-center gap-2 sm:gap-3 text-xs pt-1">
                <!-- Correo -->
                <div class="flex items-center gap-1 text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <i data-lucide="mail" class="w-3 h-3 text-cyan-400"></i>
                  <span class="font-mono text-[11px] text-slate-300">${escapeHtml(u.email)}</span>
                  <button type="button" onclick="copyText('${escapeHtml(u.email)}', 'Correo copiado')" title="Copiar correo" class="ml-1 p-0.5 text-slate-500 hover:text-cyan-300 transition">
                    <i data-lucide="copy" class="w-3 h-3"></i>
                  </button>
                </div>

                <!-- Contraseña Asignada -->
                <div class="flex items-center gap-1.5 text-slate-300 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-amber-500/30">
                  <i data-lucide="key" class="w-3 h-3 text-amber-400"></i>
                  <span class="text-slate-400 text-[11px]">Clave:</span>
                  <span class="font-mono text-[11px] text-amber-300 font-bold select-all tracking-wider">${escapeHtml(u.password || '(No disponible)')}</span>
                  <button type="button" onclick="copyText('${escapeHtml(u.password)}', 'Contraseña copiada')" title="Copiar contraseña para el cliente" class="ml-1 p-0.5 text-slate-500 hover:text-amber-300 transition">
                    <i data-lucide="copy" class="w-3 h-3"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="self-end sm:self-center shrink-0">
            ${deleteBtn}
          </div>
        </div>
      `;
    }).join('');

    refreshIcons();
  } catch (err) {
    listEl.innerHTML = `
      <div class="p-4 bg-rose-950/40 border border-rose-900 rounded-xl text-xs text-rose-300 text-center">
        ${escapeHtml(err.message)}
      </div>
    `;
  }
}

function openCreateUserModal() {
  const form = document.getElementById('createUserForm');
  if (form) form.reset();
  const modal = document.getElementById('createUserModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.getElementById('newUserName')?.focus();
  }
  refreshIcons();
}

function closeCreateUserModal() {
  const modal = document.getElementById('createUserModal');
  if (modal) modal.classList.add('hidden');
}

async function handleCreateUserSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('newUserName').value.trim();
  const email = document.getElementById('newUserEmail').value.trim();
  const password = document.getElementById('newUserPassword').value.trim();
  const submitBtn = document.getElementById('createUserSubmitBtn');
  const token = getAuthToken();

  if (!name || !email || !password) {
    showToast('Todos los campos son requeridos.', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando...';

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al registrar cliente');
    }

    showToast(`¡Cliente "${name}" registrado con éxito!`, 'success');
    closeCreateUserModal();
    await loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar Cliente';
  }
}

async function deleteUser(id, name) {
  if (!confirm(`¿Estás seguro de revocar el acceso a ${name}? Ya no podrá iniciar sesión ni gestionar sus tarjetas.`)) {
    return;
  }

  const token = getAuthToken();
  try {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al eliminar');
    }

    showToast(`Acceso revocado para ${name}.`, 'success');
    await loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Helper para copiar texto al portapapeles
async function copyText(text, msg = 'Copiado al portapapeles') {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast(`¡${msg}!`, 'success');
  } catch (err) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast(`¡${msg}!`, 'success');
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

// Escape de HTML para prevención XSS básica
function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
