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

// Normalizador de enlaces de Google Drive, Dropbox, etc.
function normalizeImageUrl(url) {
  if (!url) return '';
  const cleanUrl = url.trim();

  // Google Drive
  const driveFileMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const driveIdMatch = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const fileId = (driveFileMatch && driveFileMatch[1]) || (driveIdMatch && driveIdMatch[1]);

  if (fileId && (cleanUrl.includes('drive.google.com') || cleanUrl.includes('docs.google.com'))) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // Dropbox
  if (cleanUrl.includes('dropbox.com')) {
    return cleanUrl.replace(/[?&]dl=0/, '?raw=1');
  }

  return cleanUrl;
}

// Renderizado de datos del perfil en el DOM
function renderProfile(p) {
  // 1. Título de página y tema de color dinámico
  document.title = `${p.full_name} | Tarjeta Digital`;
  const themeColor = p.theme_color || '#0284c7';
  document.documentElement.style.setProperty('--theme-color', themeColor);

  // 1.5 Color de fondo personalizado de la aplicación
  if (p.bg_color) {
    document.body.style.backgroundColor = p.bg_color;
    if (p.bg_color !== '#030712' && p.bg_color !== '#0f172a') {
      document.body.style.backgroundImage = 'none';
    }
    if (isColorLight(p.bg_color)) {
      document.body.classList.add('light-mode-card');
    } else {
      document.body.classList.remove('light-mode-card');
    }
  }

  // 1.6 Foto de portada / Banner de fondo (Opcional)
  const coverBanner = document.getElementById('coverBanner');
  const coverImg = document.getElementById('coverImg');
  if (p.cover_image_url) {
    const normalizedCover = normalizeImageUrl(p.cover_image_url);
    coverImg.src = normalizedCover;
    coverBanner.classList.remove('hidden');

    const driveCoverMatch = (p.cover_image_url || '').match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || (p.cover_image_url || '').match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveCoverMatch && driveCoverMatch[1]) {
      coverImg.onerror = function() {
        this.src = `https://drive.google.com/thumbnail?id=${driveCoverMatch[1]}&sz=w1200`;
      };
    }
  } else if (coverBanner) {
    coverBanner.classList.add('hidden');
  }

  // 2. Avatar normalizado
  const avatarImg = document.getElementById('avatarImg');
  avatarImg.setAttribute('referrerpolicy', 'no-referrer');
  const normalizedAvatar = normalizeImageUrl(p.avatar_url);
  avatarImg.src = normalizedAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&h=300&q=80';
  avatarImg.style.borderColor = themeColor;

  // Si falla el CDN principal de Google, intentar con el endpoint de thumbnail de alta resolución
  const driveIdMatch = (p.avatar_url || '').match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || (p.avatar_url || '').match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && driveIdMatch[1]) {
    avatarImg.onerror = function() {
      this.onerror = function() {
        this.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&h=300&q=80';
      };
      this.src = `https://drive.google.com/thumbnail?id=${driveIdMatch[1]}&sz=w1000`;
    };
  }

  // 3. Textos principales
  document.getElementById('fullName').textContent = p.full_name;
  document.getElementById('bioTitle').textContent = p.bio_title || '';

  // Empresa (opcional)
  if (p.company_name) {
    document.getElementById('companyName').textContent = p.company_name;
    document.getElementById('companyBadge').classList.remove('hidden');
  }

  // 3.5 Texto Libre / Información Adicional (opcional)
  const freeTextSection = document.getElementById('freeTextSection');
  const freeTextContent = document.getElementById('freeTextContent');
  if (p.free_text && p.free_text.trim()) {
    freeTextContent.textContent = p.free_text.trim();
    freeTextSection.classList.remove('hidden');
  } else if (freeTextSection) {
    freeTextSection.classList.add('hidden');
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

  // 6. Enlaces y Botones Personalizados Adicionales
  const customLinksList = document.getElementById('customLinksList');
  if (customLinksList) {
    customLinksList.innerHTML = '';
    if (p.custom_links && Array.isArray(p.custom_links) && p.custom_links.length > 0) {
      p.custom_links.forEach((link) => {
        if (!link || !link.title || !link.url) return;
        let destUrl = link.url.trim();
        if (!destUrl.startsWith('http://') && !destUrl.startsWith('https://')) {
          destUrl = `https://${destUrl}`;
        }
        const iconName = link.icon || 'external-link';
        const linkEl = document.createElement('a');
        linkEl.href = destUrl;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
        linkEl.className = 'group flex items-center justify-between w-full p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 text-slate-100 transition-all duration-200 hover:-translate-y-0.5 shadow-md';
        linkEl.innerHTML = `
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-slate-800 group-hover:bg-slate-700 flex items-center justify-center shrink-0 transition" style="color: ${themeColor}">
              <i data-lucide="${escapeHtml(iconName)}" class="w-5 h-5"></i>
            </div>
            <div class="text-left min-w-0">
              <span class="block text-sm font-semibold text-white truncate">${escapeHtml(link.title)}</span>
              <span class="block text-xs text-slate-400 font-mono truncate">${escapeHtml(formatDisplayUrl(link.url))}</span>
            </div>
          </div>
          <i data-lucide="chevron-right" class="w-4 h-4 text-slate-500 group-hover:text-white shrink-0 transition"></i>
        `;
        customLinksList.appendChild(linkEl);
      });
    }
  }

  // Refrescar iconos de Lucide tras insertar contenido
  setTimeout(() => {
    if (window.lucide) lucide.createIcons();
  }, 50);
}

// Helper para determinar si un color hexadecimal es claro
function isColorLight(color) {
  if (!color || typeof color !== 'string' || !color.startsWith('#')) return false;
  const hex = color.replace('#', '');
  if (hex.length !== 6 && hex.length !== 3) return false;
  const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
  const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
  const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

// Sanitizador seguro contra inyecciones HTML en perfiles
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.toString().replace(/[&<>"']/g, (m) => map[m]);
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
