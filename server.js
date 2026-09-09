import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'profiles.json');

// Configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://supabase.agrolara.dedyn.io';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4MDk4MDE4MCwiZXhwIjo0OTM2NjUzNzgwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.jU61l2XNxwvk_955XHpXC5YV7nWHxcODH-c-AzPYN5w';

const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

function getSupabaseHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper local para leer perfiles
async function getLocalProfiles() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await fs.writeFile(DATA_FILE, '[]', 'utf-8');
      return [];
    }
    throw error;
  }
}

// Helper local para guardar perfiles
async function saveLocalProfiles(profiles) {
  await fs.writeFile(DATA_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
}

// Sanitizador de slug en el servidor
function sanitizeSlug(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Quitar caracteres no alfanuméricos
    .replace(/[\s_]+/g, '-') // Espacios a guiones
    .replace(/^-+|-+$/g, ''); // Quitar guiones iniciales o finales
}

// Convertidor de URLs de Google Drive, Dropbox, etc. a enlaces directos de imagen
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

// ==========================================
// AUTENTICACIÓN Y ROLES (SUPERADMIN & COLABORADORES)
// ==========================================
const SUPERADMIN_EMAIL = process.env.ADMIN_EMAIL || 'materiales.integrity@gmail.com';
const SUPERADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Agro1280@';

// Mapa de sesiones activas en memoria para tokens
const activeSessions = new Map();

// Endpoint de login (Superadministrador y Colaboradores)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Debes proporcionar correo y contraseña.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = password.trim();

  // 1. Verificación directa de Superadmin
  if (cleanEmail === SUPERADMIN_EMAIL.toLowerCase() && cleanPass === SUPERADMIN_PASSWORD) {
    const token = 'token-superadmin-' + crypto.randomBytes(16).toString('hex');
    const user = {
      email: SUPERADMIN_EMAIL,
      name: 'Mauricio Lara',
      role: 'superadmin',
    };
    activeSessions.set(token, user);
    return res.json({ success: true, token, user });
  }

  // 2. Verificación en base de datos Supabase (linktree_users)
  try {
    if (useSupabase) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/linktree_users?email=eq.${encodeURIComponent(cleanEmail)}&password=eq.${encodeURIComponent(cleanPass)}&select=*`,
        { headers: getSupabaseHeaders() }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const dbUser = data[0];
        const token = 'token-user-' + crypto.randomBytes(16).toString('hex');
        const user = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role || 'collaborator',
        };
        activeSessions.set(token, user);
        return res.json({ success: true, token, user });
      }
    }
  } catch (err) {
    console.error('Error al verificar usuario en Supabase:', err);
  }

  return res.status(401).json({
    error: 'Credenciales inválidas. Acceso exclusivo para usuarios autorizados.',
  });
});

// Endpoint para verificar sesión activa
app.get('/api/auth/check', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token && activeSessions.has(token)) {
    const user = activeSessions.get(token);
    return res.json({ authenticated: true, user });
  }

  // Fallback para token fijo inicial si existiera
  if (token === 'auth-linkcard-master-session-token-2026') {
    return res.json({
      authenticated: true,
      user: { email: SUPERADMIN_EMAIL, name: 'Mauricio Lara', role: 'superadmin' },
    });
  }

  return res.status(401).json({ authenticated: false });
});

// Middleware: requiere estar autenticado (superadmin o colaborador)
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token && (activeSessions.has(token) || token === 'auth-linkcard-master-session-token-2026')) {
    req.user = activeSessions.get(token) || { email: SUPERADMIN_EMAIL, role: 'superadmin' };
    return next();
  }
  return res.status(401).json({
    error: 'Acceso restringido. Por favor inicia sesión.',
  });
}

// Middleware: requiere rol Superadmin exclusivamente
function requireSuperadmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    if (token === 'auth-linkcard-master-session-token-2026') {
      req.user = { email: SUPERADMIN_EMAIL, role: 'superadmin' };
      return next();
    }
    const session = activeSessions.get(token);
    if (session && session.role === 'superadmin') {
      req.user = session;
      return next();
    }
  }
  return res.status(403).json({
    error: 'Permiso denegado. Esta acción requiere privilegios de Superadministrador.',
  });
}

// ==========================================
// RUTAS DE GESTIÓN DE USUARIOS / COLABORADORES
// (Solo accesibles para el Superadmin)
// ==========================================

// Listar colaboradores
app.get('/api/users', requireSuperadmin, async (req, res) => {
  try {
    if (useSupabase) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/linktree_users?select=id,email,name,role,created_at&order=created_at.desc`,
        { headers: getSupabaseHeaders() }
      );
      const data = await response.json();
      return res.json(data);
    }
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los usuarios.' });
  }
});

// Crear nuevo colaborador
app.post('/api/users', requireSuperadmin, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();
    const cleanName = name.trim();

    if (useSupabase) {
      // Verificar si ya existe
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/linktree_users?email=eq.${encodeURIComponent(cleanEmail)}&select=id`,
        { headers: getSupabaseHeaders() }
      );
      const existing = await checkRes.json();
      if (existing && existing.length > 0) {
        return res.status(409).json({ error: `El correo "${cleanEmail}" ya está registrado.` });
      }

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/linktree_users`, {
        method: 'POST',
        headers: { ...getSupabaseHeaders(), Prefer: 'return=representation' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPass,
          name: cleanName,
          role: 'collaborator',
        }),
      });

      if (!insertRes.ok) {
        throw new Error('Error al registrar colaborador en Supabase');
      }

      const created = await insertRes.json();
      return res.status(201).json(created[0]);
    }

    res.status(501).json({ error: 'Base de datos no disponible para registrar usuarios.' });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: error.message || 'Error al crear el colaborador.' });
  }
});

// Eliminar un colaborador
app.delete('/api/users/:id', requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (useSupabase) {
      // Evitar que se elimine al superadmin
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/linktree_users?id=eq.${id}&select=role,email`, {
        headers: getSupabaseHeaders(),
      });
      const checkData = await checkRes.json();
      if (checkData && checkData.length > 0 && checkData[0].role === 'superadmin') {
        return res.status(400).json({ error: 'No es posible eliminar la cuenta del Superadministrador.' });
      }

      const delRes = await fetch(`${SUPABASE_URL}/rest/v1/linktree_users?id=eq.${id}`, {
        method: 'DELETE',
        headers: getSupabaseHeaders(),
      });

      if (!delRes.ok) throw new Error('Error al eliminar usuario');
      return res.json({ success: true, message: 'Colaborador eliminado correctamente.' });
    }

    res.status(404).json({ error: 'Usuario no encontrado.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el colaborador.' });
  }
});

// ==========================================
// RUTAS DE LA API REST (SUPABASE + LOCAL)
// ==========================================

// 1. Obtener todos los perfiles (Protegido por autenticación)
app.get('/api/profiles', requireAuth, async (req, res) => {
  try {
    if (useSupabase) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/linktree_profiles?select=*&order=updated_at.desc`, {
        headers: getSupabaseHeaders(),
      });
      if (!response.ok) throw new Error('Error al consultar Supabase');
      const data = await response.json();
      return res.json(data);
    }

    const profiles = await getLocalProfiles();
    profiles.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    res.json(profiles);
  } catch (error) {
    console.error('Error al obtener perfiles:', error);
    res.status(500).json({ error: 'Error al obtener los perfiles.' });
  }
});

// 2. Obtener un perfil por slug (para la vista pública /u/:slug)
app.get('/api/profiles/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const cleanSlug = sanitizeSlug(slug);

    if (useSupabase) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/linktree_profiles?slug=eq.${cleanSlug}&select=*`, {
        headers: getSupabaseHeaders(),
      });
      if (!response.ok) throw new Error('Error al consultar Supabase');
      const data = await response.json();
      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Perfil no encontrado.' });
      }
      return res.json(data[0]);
    }

    const profiles = await getLocalProfiles();
    const profile = profiles.find((p) => p.slug === cleanSlug);
    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado.' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Error al buscar perfil:', error);
    res.status(500).json({ error: 'Error al buscar el perfil.' });
  }
});

// 3. Obtener un perfil por ID (para editar)
app.get('/api/profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (useSupabase) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/linktree_profiles?id=eq.${id}&select=*`, {
        headers: getSupabaseHeaders(),
      });
      if (!response.ok) throw new Error('Error al consultar Supabase');
      const data = await response.json();
      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Perfil no encontrado.' });
      }
      return res.json(data[0]);
    }

    const profiles = await getLocalProfiles();
    const profile = profiles.find((p) => p.id === id);
    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado.' });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar el perfil.' });
  }
});

// 4. Crear nuevo perfil (Protegido por autenticación)
app.post('/api/profiles', requireAuth, async (req, res) => {
  try {
    const {
      slug,
      full_name,
      bio_title,
      company_name,
      avatar_url,
      phone,
      whatsapp_message,
      email,
      website,
      instagram,
      facebook,
      linkedin,
      theme_color,
      is_active,
    } = req.body;

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'El nombre completo es obligatorio.' });
    }

    const cleanSlug = sanitizeSlug(slug || full_name);
    if (!cleanSlug) {
      return res.status(400).json({ error: 'El slug generado no es válido.' });
    }

    const now = new Date().toISOString();
    const newProfile = {
      id: crypto.randomUUID(),
      slug: cleanSlug,
      full_name: full_name.trim(),
      bio_title: (bio_title || '').trim(),
      company_name: (company_name || '').trim(),
      avatar_url: normalizeImageUrl(avatar_url),
      phone: (phone || '').trim(),
      whatsapp_message: (whatsapp_message || '').trim(),
      email: (email || '').trim(),
      website: (website || '').trim(),
      instagram: (instagram || '').trim().replace(/^@/, ''),
      facebook: (facebook || '').trim(),
      linkedin: (linkedin || '').trim(),
      theme_color: theme_color || '#0284c7',
      is_active: is_active !== false,
      created_at: now,
      updated_at: now,
    };

    if (useSupabase) {
      // Verificar unicidad de slug en Supabase
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/linktree_profiles?slug=eq.${cleanSlug}&select=id`, {
        headers: getSupabaseHeaders(),
      });
      const existing = await checkRes.json();
      if (existing && existing.length > 0) {
        return res.status(409).json({ error: `El slug "${cleanSlug}" ya está en uso. Por favor, elige otro.` });
      }

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/linktree_profiles`, {
        method: 'POST',
        headers: {
          ...getSupabaseHeaders(),
          Prefer: 'return=representation',
        },
        body: JSON.stringify(newProfile),
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error('Error insertando en Supabase:', errText);
        return res.status(500).json({ error: 'Error al guardar el perfil en Supabase.' });
      }

      const insertedData = await insertRes.json();
      return res.status(201).json(insertedData[0] || newProfile);
    }

    const profiles = await getLocalProfiles();
    const exists = profiles.some((p) => p.slug === cleanSlug);
    if (exists) {
      return res.status(409).json({ error: `El slug "${cleanSlug}" ya está en uso. Por favor, elige otro.` });
    }

    profiles.push(newProfile);
    await saveLocalProfiles(profiles);
    res.status(201).json(newProfile);
  } catch (error) {
    console.error('Error al crear perfil:', error);
    res.status(500).json({ error: 'Error al guardar el perfil.' });
  }
});

// 5. Actualizar un perfil (Protegido por autenticación)
app.put('/api/profiles/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      slug,
      full_name,
      bio_title,
      company_name,
      avatar_url,
      phone,
      whatsapp_message,
      email,
      website,
      instagram,
      facebook,
      linkedin,
      theme_color,
      is_active,
    } = req.body;

    const cleanSlug = sanitizeSlug(slug || full_name);

    if (useSupabase) {
      // Verificar si el slug colisiona con otro registro
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/linktree_profiles?slug=eq.${cleanSlug}&id=neq.${id}&select=id`,
        { headers: getSupabaseHeaders() }
      );
      const conflict = await checkRes.json();
      if (conflict && conflict.length > 0) {
        return res.status(409).json({ error: `El slug "${cleanSlug}" ya está en uso por otro perfil.` });
      }

      const updatePayload = {
        slug: cleanSlug,
        full_name: full_name?.trim(),
        bio_title: bio_title?.trim(),
        company_name: company_name?.trim(),
        avatar_url: avatar_url !== undefined ? normalizeImageUrl(avatar_url) : undefined,
        phone: phone?.trim(),
        whatsapp_message: whatsapp_message?.trim(),
        email: email?.trim(),
        website: website?.trim(),
        instagram: instagram?.trim()?.replace(/^@/, ''),
        facebook: facebook?.trim(),
        linkedin: linkedin?.trim(),
        theme_color: theme_color || '#0284c7',
        is_active: is_active !== undefined ? Boolean(is_active) : true,
        updated_at: new Date().toISOString(),
      };

      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/linktree_profiles?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          ...getSupabaseHeaders(),
          Prefer: 'return=representation',
        },
        body: JSON.stringify(updatePayload),
      });

      if (!updateRes.ok) {
        return res.status(500).json({ error: 'Error al actualizar el perfil en Supabase.' });
      }

      const updated = await updateRes.json();
      return res.json(updated[0]);
    }

    const profiles = await getLocalProfiles();
    const index = profiles.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Perfil no encontrado.' });
    }

    const slugConflict = profiles.some((p) => p.slug === cleanSlug && p.id !== id);
    if (slugConflict) {
      return res.status(409).json({ error: `El slug "${cleanSlug}" ya está en uso por otro perfil.` });
    }

    const updatedProfile = {
      ...profiles[index],
      slug: cleanSlug,
      full_name: full_name !== undefined ? full_name.trim() : profiles[index].full_name,
      bio_title: bio_title !== undefined ? bio_title.trim() : profiles[index].bio_title,
      company_name: company_name !== undefined ? company_name.trim() : profiles[index].company_name,
      avatar_url: avatar_url !== undefined ? normalizeImageUrl(avatar_url) : profiles[index].avatar_url,
      phone: phone !== undefined ? phone.trim() : profiles[index].phone,
      whatsapp_message: whatsapp_message !== undefined ? whatsapp_message.trim() : profiles[index].whatsapp_message,
      email: email !== undefined ? email.trim() : profiles[index].email,
      website: website !== undefined ? website.trim() : profiles[index].website,
      instagram: instagram !== undefined ? instagram.trim().replace(/^@/, '') : profiles[index].instagram,
      facebook: facebook !== undefined ? facebook.trim() : profiles[index].facebook,
      linkedin: linkedin !== undefined ? linkedin.trim() : profiles[index].linkedin,
      theme_color: theme_color || profiles[index].theme_color || '#0284c7',
      is_active: is_active !== undefined ? Boolean(is_active) : profiles[index].is_active,
      updated_at: new Date().toISOString(),
    };

    profiles[index] = updatedProfile;
    await saveLocalProfiles(profiles);
    res.json(updatedProfile);
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ error: 'Error al actualizar el perfil.' });
  }
});

// 6. Eliminar un perfil (Protegido por autenticación)
app.delete('/api/profiles/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (useSupabase) {
      const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/linktree_profiles?id=eq.${id}`, {
        method: 'DELETE',
        headers: getSupabaseHeaders(),
      });
      if (!deleteRes.ok) {
        return res.status(500).json({ error: 'Error al eliminar el perfil en Supabase.' });
      }
      return res.json({ success: true, message: 'Perfil eliminado correctamente de Supabase.' });
    }

    const profiles = await getLocalProfiles();
    const filtered = profiles.filter((p) => p.id !== id);
    if (filtered.length === profiles.length) {
      return res.status(404).json({ error: 'Perfil no encontrado.' });
    }

    await saveLocalProfiles(filtered);
    res.json({ success: true, message: 'Perfil eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el perfil.' });
  }
});

// ==========================================
// ENRUTAMIENTO DE VISTAS
// ==========================================

// Servir la vista pública: /u/:slug
app.get('/u/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// Servir el panel de administración
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`🗄️ Persistencia activa: ${useSupabase ? 'Supabase (' + SUPABASE_URL + ')' : 'Local JSON'}`);
});
