---
id: "tarjetas-de-contactos"
title: "Tarjetas de Contactos Pro"
subtitle: "Plataforma SaaS de Tarjetas Digitales Inteligentes & Hub de Enlaces"
category: "SaaS & Web Applications"
status: "Producción"
featured: true
date: "2026-10-20"
liveUrl: "https://tarjetadecontactos.agrolara.dedyn.io"
legacyUrl: "https://linktree-tarjetas-digitales.agrolara.dedyn.io"
githubUrl: "https://github.com/agrolara/linktree-tarjetas-digitales"
author: "Mauricio Lara"
technologies:
  - "Node.js"
  - "Express"
  - "Supabase (PostgreSQL / RLS)"
  - "Tailwind CSS"
  - "JavaScript Vanilla (ESM)"
  - "Docker"
  - "Coolify"
  - "Traefik"
  - "vCard 3.0"
  - "HTML5 Canvas QR"
---

# Tarjetas de Contactos Pro — Plataforma SaaS de Tarjetas Digitales Inteligentes

Plataforma web de última generación concebida para la creación, gestión y distribución masiva de identidades profesionales y comerciales. Transforma el concepto tradicional de tarjeta de presentación física en un hub de contacto interactivo, accesible al instante mediante código QR o enlace web dedicado.

---

## 🌟 Características Principales y Nuevas Funcionalidades

### 1. Identidad Digital & Hub de Enlaces Ilimitados
- **URLs Únicas y Personalizadas (`/u/slug`):** Generador y sanitizador automático de slugs sin acentos ni caracteres especiales, con opción de edición manual en tiempo real.
- **Botonera Dinámica Ilimitada:** Capacidad de añadir enlaces adicionales con títulos, URLs e iconografía contextual (Web, PDF/Catálogos, Tienda Online, Agendamiento de Citas, Video, Audio, Ubicaciones).
- **Bloque de Biografía Comercial (Texto Libre):** Espacio enriquecido para resumen del negocio, servicios profesionales, dirección física y horarios de atención al cliente.

### 2. Diseño y Personalización Visual Avanzada
- **Foto de Portada / Banner Panorámico Opcional:** Encabezado con degradado de contraste que resalta el avatar de perfil. Soporte directo para archivos multimedia y conversión automática de enlaces compartidos de Google Drive.
- **Personalizador de Color de Botones (con Verde Oficial de WhatsApp Protegido):** Selector de paletas cromáticas rápidas y código Hexadecimal para los botones de contacto y enlaces, manteniendo de forma referencial el color verde oficial de WhatsApp (`#25D366`).
- **Selector de Color de Fondo de la Tarjeta:** Temas rápidos (Oscuro, Noche, Grafito, Tierra, Blanco) y libre selección Hex.
- **Motor de Contraste Inteligente (`isColorLight`):** Algoritmo de luminancia adaptativa que conmuta automáticamente tipografías e iconos a modo oscuro al seleccionar fondos o botones claros, garantizando máxima legibilidad.

### 3. Contacto & Conversión en Un Solo Toque
- **Acceso Directo a WhatsApp:** Botón prioritario con mensaje de bienvenida predefinido.
- **Generador de Tarjeta vCard 3.0 (.vcf):** Descarga de contacto para guardado instantáneo en la libreta de direcciones de dispositivos iPhone (iOS) y Android.
- **Códigos QR de Alta Definición:** Renderizado mediante HTML5 Canvas para descarga directa en PNG, listo para impresión en tarjetas físicas o papelería corporativa.

### 4. Arquitectura Multi-Usuario & Seguridad
- **Roles Jerárquicos:**
  - **Superadministrador (Mauricio Lara):** Control maestro de la plataforma, visor de métricas globales y visor de credenciales de clientes.
  - **Colaboradores:** Acceso asistido a las tarjetas del superadministrador para soporte y mantenimiento.
  - **Clientes:** Acceso restringido exclusivamente a la creación y gestión de sus propias tarjetas digitales.
- **Simulador de Smartphone en Tiempo Real:** Visualizador reactivo que emula un dispositivo móvil durante la edición en el panel administrativo.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Backend & Servidor** | Node.js, Express.js (ES Modules), NGINX / Nixpacks |
| **Base de Datos & Auth** | Supabase (PostgreSQL en la nube, pg_query, RLS) |
| **Frontend & UI** | HTML5, Tailwind CSS, JavaScript Vanilla, Lucide Icons |
| **Formatos Digitales** | vCard 3.0 Generator, QRCode Canvas Engine |
| **Infraestructura** | Oracle Cloud VPS, Coolify PaaS, Docker, Traefik, deSEC DNS |
| **Seguridad & SSL** | Let's Encrypt Wildcard SSL, Bearer Tokens, Bcrypt |

---

## 🌐 Enlaces del Proyecto

- **Dominio Principal:** [https://tarjetadecontactos.agrolara.dedyn.io](https://tarjetadecontactos.agrolara.dedyn.io)
- **Dominio Histórico de Respaldo:** [https://linktree-tarjetas-digitales.agrolara.dedyn.io](https://linktree-tarjetas-digitales.agrolara.dedyn.io)
- **Repositorio GitHub:** [agrolara/linktree-tarjetas-digitales](https://github.com/agrolara/linktree-tarjetas-digitales)
