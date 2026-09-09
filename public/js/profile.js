// ==============================================================================
// LINKCARD PRO - LÓGICA DE LA VISTA PÚBLICA DEL PERFIL
// ==============================================================================

let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
  const slug = getSlugFromUrl();

  if (!slug) {
    showError('No se especificó ningún perfil en la dirección.');
    return;
  }

  await loadPublicProfile(slug);
  lucide.createIcons();
});

// Helper para extraer el slug desde la URL (/u/:slug o ?u=:slug)
function getSlugFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/\/u\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // Fallback para query parameter ?u=slug
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('u');
}

// Cargar perfil desde la API
async function loadPublicProfile(slug) {
  const loadingEl = document.getElementById('loadingState');
  const contentEl = document.getElementById('profileContent');

  try {
    const res = await fetch(`/api/profiles/slug/${slug}`);
    if (!res.ok) {
      if (res.status === 404) {
        showError('El perfil solicitado no existe o el enlace ha cambiado.');
      } else {
        showError('No fue posible cargar el perfil. Intenta nuevamente.');
      }
      return;
    }

    currentProfile = await res.json();

    // Si el perfil está inactivo
    if (!currentProfile.is_active) {
      showError('Este perfil se encuentra inactivo temporalmente por su propietario.');
      return;
    }

    renderProfile(currentProfile);

    // Ocultar carga y mostrar contenido
    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
  } catch (error) {
    console.error('Error al cargar perfil:', error);
    showError('Ocurrió un error de red al intentar cargar la tarjeta digital.');
  }
}

// Renderizado de datos del perfil en el DOM
function renderProfile(p) {
  // 1. Título de página y tema de color dinámico
  document.title = `${p.full_name} | Tarjeta Digital`;
  const themeColor = p.theme_color || '#0284c7';
  document.documentElement.style.setProperty('--theme-color', themeColor);

  // 2. Avatar
  const avatarImg = document.getElementById('avatarImg');
  avatarImg.src = p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&h=300&q=80';
  avatarImg.style.borderColor = themeColor;

  // 3. Textos principales
  document.getElementById('fullName').textContent = p.full_name;
  document.getElementById('bioTitle').textContent = p.bio_title || '';

  // Empresa (opcional)
  if (p.company_name) {
    document.getElementById('companyName').textContent = p.company_name;
    document.getElementById('companyBadge').classList.remove('hidden');
  }

  // 4. Botón destacado de WhatsApp
  if (p.phone) {
    const cleanPhone = p.phone.replace(/\D/g, '');
    let waUrl = `https://wa.me/${cleanPhone}`;
    if (p.whatsapp_message) {
      waUrl += `?text=${encodeURIComponent(p.whatsapp_message)}`;
    }
    const waBtn = document.getElementById('whatsappBtn');
    waBtn.href = waUrl;
    waBtn.style.backgroundColor = themeColor;
  } else {
    document.getElementById('whatsappSection').classList.add('hidden');
  }

  // 5. Botonera vertical de contacto
  // Llamar directo
  if (p.phone) {
    const callBtn = document.getElementById('callBtn');
    callBtn.href = `tel:${p.phone.replace(/\s+/g, '')}`;
    document.getElementById('callBtnSub').textContent = p.phone;
    callBtn.classList.remove('hidden');
  }

  // Correo electrónico
  if (p.email) {
    const emailBtn = document.getElementById('emailBtn');
    emailBtn.href = `mailto:${p.email}`;
    document.getElementById('emailBtnSub').textContent = p.email;
    emailBtn.classList.remove('hidden');
  }

  // Sitio web
  if (p.website) {
    const webBtn = document.getElementById('websiteBtn');
    let webUrl = p.website;
    if (!webUrl.startsWith('http://') && !webUrl.startsWith('https://')) {
      webUrl = `https://${webUrl}`;
    }
    webBtn.href = webUrl;
    document.getElementById('websiteBtnSub').textContent = formatDisplayUrl(p.website);
    webBtn.classList.remove('hidden');
  }

  // Instagram
  if (p.instagram) {
    const instaBtn = document.getElementById('instagramBtn');
    const instaUser = p.instagram.replace(/^@/, '').trim();
    let instaUrl = p.instagram;
    if (!instaUrl.startsWith('http://') && !instaUrl.startsWith('https://')) {
      instaUrl = `https://instagram.com/${instaUser}`;
    }
    instaBtn.href = instaUrl;
    document.getElementById('instagramBtnSub').textContent = `@${instaUser}`;
    instaBtn.classList.remove('hidden');
  }

  // Facebook
  if (p.facebook) {
    const fbBtn = document.getElementById('facebookBtn');
    let fbUrl = p.facebook;
    if (!fbUrl.startsWith('http://') && !fbUrl.startsWith('https://')) {
      fbUrl = `https://${fbUrl}`;
    }
    fbBtn.href = fbUrl;
    fbBtn.classList.remove('hidden');
  }

  // LinkedIn
  if (p.linkedin) {
    const liBtn = document.getElementById('linkedinBtn');
    let liUrl = p.linkedin;
    if (!liUrl.startsWith('http://') && !liUrl.startsWith('https://')) {
      liUrl = `https://${liUrl}`;
    }
    liBtn.href = liUrl;
    liBtn.classList.remove('hidden');
  }

  // Refrescar iconos de Lucide tras insertar contenido
  setTimeout(() => {
    if (window.lucide) lucide.createIcons();
  }, 50);
}

// Limpiador visual de URL para mostrar dominio limpio
function formatDisplayUrl(url) {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
}

// ------------------------------------------------------------------------------
// FUNCIÓN GENERADORA Y DESCARGA DE VCARD (.VCF)
// Compatible al 100% con Contactos de iPhone (iOS) y Google Contacts (Android)
// ------------------------------------------------------------------------------
function handleSaveContact() {
  if (!currentProfile) return;
  downloadVCard(currentProfile);
}

function downloadVCard(profile) {
  // Separar nombre y apellido para el campo estructurado N
  const nameParts = (profile.full_name || '').trim().split(/\s+/);
  let firstName = '';
  let lastName = '';

  if (nameParts.length === 1) {
    firstName = nameParts[0];
  } else if (nameParts.length > 1) {
    lastName = nameParts.slice(-1).join(' ');
    firstName = nameParts.slice(0, -1).join(' ');
  }

  // Construcción de líneas estándar vCard 3.0
  const vcardLines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN;CHARSET=UTF-8:${profile.full_name || ''}`,
    `N;CHARSET=UTF-8:${lastName};${firstName};;;`,
  ];

  if (profile.company_name) {
    vcardLines.push(`ORG;CHARSET=UTF-8:${profile.company_name}`);
  }

  if (profile.bio_title) {
    vcardLines.push(`TITLE;CHARSET=UTF-8:${profile.bio_title}`);
  }

  if (profile.phone) {
    vcardLines.push(`TEL;TYPE=CELL,VOICE:${profile.phone}`);
  }

  if (profile.email) {
    vcardLines.push(`EMAIL;TYPE=WORK,INTERNET:${profile.email}`);
  }

  if (profile.website) {
    let site = profile.website;
    if (!site.startsWith('http://') && !site.startsWith('https://')) {
      site = `https://${site}`;
    }
    vcardLines.push(`URL:${site}`);
  }

  // Agregar nota identificadora
  vcardLines.push(`NOTE;CHARSET=UTF-8:Contacto guardado desde la Tarjeta Digital /u/${profile.slug}`);
  vcardLines.push(`REV:${new Date().toISOString()}`);
  vcardLines.push('END:VCARD');

  const vcardContent = vcardLines.join('\r\n');

  // Crear Blob UTF-8 con tipo MIME de vCard
  const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' });
  const filename = `${profile.slug || 'contacto'}.vcf`;

  // Disparar descarga en el navegador
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Limpiar memoria
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  }, 300);

  // Mostrar notificación visual
  showToast('¡Archivo de contacto descargado! Ábrelo para guardar.');
}

// ------------------------------------------------------------------------------
// MANEJO DE ESTADOS DE ERROR Y FEEDBACK
// ------------------------------------------------------------------------------
function showError(msg) {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('profileContent').classList.add('hidden');

  const errorEl = document.getElementById('errorState');
  document.getElementById('errorMessage').textContent = msg;
  errorEl.classList.remove('hidden');

  setTimeout(() => {
    if (window.lucide) lucide.createIcons();
  }, 50);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMessage').textContent = msg;

  toast.classList.remove('opacity-0', 'translate-y-2');
  toast.classList.add('opacity-100', 'translate-y-0');

  setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-2');
  }, 3500);
}
