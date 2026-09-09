# LinkCard Pro 🚀

> Aplicación web moderna, minimalista y 100% responsive para crear, personalizar y administrar perfiles de enlaces estilo Linktree y Tarjetas de Presentación Digitales Inteligentes con código QR en alta resolución y descarga de vCard (.vcf).

---

## 📱 Características Principales

1. **URLs Públicas Únicas y Limpias (`/u/:slug`)**:
   - Generación automática de slugs amigables, sin acentos ni caracteres extraños.
   - Enrutamiento directo y ultrarrápido desde el servidor.

2. **Generador y Descargador de Código QR**:
   - Renderizado en vivo con `qrcode` sobre `<canvas>`.
   - Botón de descarga en alta resolución formato PNG (`qr-<slug>.png`).
   - Botón de copiado de URL directa con feedback instantáneo.

3. **Landing Page Móvil Ultra-Rápida (Mobile-First)**:
   - Avatar circular con halo temático dinámico.
   - Nombre, cargo y distintivo de empresa.
   - **Botón destacado de WhatsApp** con mensaje predefinido automático (`https://wa.me/...`).
   - Botonera vertical con enlaces directos: llamada telefónica, correo electrónico, sitio web, Instagram, Facebook y LinkedIn.

4. **Botón "Guardar Contacto" con vCard (.vcf)**:
   - Genera dinámicamente un archivo estándar vCard 3.0 (`.vcf`).
   - Compatible nativamente con la app de Contactos de **iPhone (iOS)** y **Android (Google Contacts)**.

5. **Panel de Administración con Simulador de Smartphone en Tiempo Real**:
   - Formulario completo con validación y auto-slug.
   - Simulador visual de smartphone que reacciona a cada tecla en tiempo real.
   - Selector visual de colores y selector hexadecimal libre.
   - Lista de perfiles con acciones: Ver, Editar, Eliminar y Compartir.

6. **Doble Estrategia de Persistencia**:
   - **Local inmediata**: Persistencia en archivo JSON (`data/profiles.json`) con perfiles semilla precargados para ejecución inmediata sin configuración.
   - **Cloud Ready**: Archivo `schema.sql` listo para producción con PostgreSQL / Supabase, incluyendo tablas, índices, triggers y Row Level Security (RLS).

---

## 📂 Estructura del Proyecto

```text
LINKTREE COPIA/
├── data/
│   └── profiles.json       # Base de datos local en JSON con perfiles semilla
├── public/
│   ├── css/
│   │   └── custom.css      # Estilos personalizados, marco de smartphone y animaciones
│   ├── js/
│   │   ├── admin.js        # Lógica del panel de administración, QR y previsualizador
│   │   └── profile.js      # Lógica de la vista pública y generador de archivo .vcf
│   ├── index.html          # Panel de administración y creador de perfiles
│   └── profile.html        # Vista pública móvil del perfil (/u/:slug)
├── package.json            # Dependencias y scripts de ejecución
├── schema.sql              # Esquema DDL para Supabase / PostgreSQL con RLS
├── server.js               # Servidor Express y API RESTful
└── README.md               # Documentación completa del proyecto
```

---

## 🚀 Puesta en Marcha Rápida

### 1. Requisitos Previos
- Node.js v18 o superior instalado.

### 2. Instalación de dependencias
```bash
npm install
```

### 3. Iniciar el servidor
```bash
npm start
```
O en modo desarrollo con recarga automática:
```bash
npm run dev
```

### 4. Abrir en el navegador
- **Panel de Administración**: [http://localhost:3000](http://localhost:3000)
- **Perfil de Demostración 1 (Carlos Lara)**: [http://localhost:3000/u/carlos-lara](http://localhost:3000/u/carlos-lara)
- **Perfil de Demostración 2 (Café Gourmet)**: [http://localhost:3000/u/cafe-artesanal](http://localhost:3000/u/cafe-artesanal)

---

## 🗄️ Modelo de Datos (Campos por Perfil)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID / String | Identificador único del perfil. |
| `slug` | String | Slug único para la URL (ej: `carlos-lara`). |
| `full_name` | String | Nombre completo o nombre del negocio. |
| `bio_title` | String | Cargo, profesión o subtítulo descriptivo. |
| `company_name`| String | Nombre de la empresa (opcional). |
| `avatar_url` | String (URL) | Imagen circular de perfil o logotipo corporativo. |
| `phone` | String | Teléfono móvil con código de país (ej: `+56912345678`). |
| `whatsapp_message` | String | Mensaje de bienvenida predefinido para WhatsApp. |
| `email` | String | Correo electrónico de contacto directo. |
| `website` | String (URL) | Sitio web del negocio o portafolio. |
| `instagram` | String | Usuario o enlace directo a perfil de Instagram. |
| `facebook` | String (URL) | Enlace a página o perfil de Facebook. |
| `linkedin` | String (URL) | Enlace a perfil profesional de LinkedIn. |
| `theme_color` | String (Hex) | Color de acento para la tarjeta, bordes y botones. |
| `is_active` | Boolean | Determina si el perfil está público o inactivo. |

---

## 🌐 Integración con Supabase (Opcional para Producción)

Si deseas migrar el backend local a Supabase:
1. Crea un nuevo proyecto en [Supabase](https://supabase.com).
2. Ve al **SQL Editor** de Supabase y pega el contenido del archivo `schema.sql`.
3. Ejecuta la consulta para crear la tabla `profiles`, los índices y las políticas RLS.
4. Conecta el SDK de `@supabase/supabase-js` en `server.js` utilizando `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
