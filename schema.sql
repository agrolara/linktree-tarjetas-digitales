-- ==============================================================================
-- ESQUEMA SQL PARA SUPABASE / POSTGRESQL
-- Plataforma de Perfiles de Enlaces & Tarjeta Digital (Linktree Clone)
-- ==============================================================================

-- 1. Extensión para generación de UUIDs (generalmente activa por defecto en Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Creación de la tabla principal de perfiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    bio_title VARCHAR(150),
    company_name VARCHAR(150),
    avatar_url TEXT,
    phone VARCHAR(50),
    whatsapp_message TEXT,
    email VARCHAR(150),
    website TEXT,
    instagram VARCHAR(100),
    facebook TEXT,
    linkedin TEXT,
    theme_color VARCHAR(50) DEFAULT '#0f172a',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Índices para optimización de consultas
-- Búsqueda ultra-rápida por slug en la vista pública /u/:slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_slug ON public.profiles(slug);
-- Filtrado de perfiles activos
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active);

-- 4. Función y Trigger para actualización automática de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Configuración de Row Level Security (RLS) para Supabase
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública: cualquiera puede ver perfiles activos
CREATE POLICY "Acceso público de lectura a perfiles activos"
    ON public.profiles
    FOR SELECT
    USING (is_active = true);

-- Política para administradores/autenticados (o para entorno local de prueba)
CREATE POLICY "Permitir todas las operaciones a usuarios autenticados"
    ON public.profiles
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- (Opcional: Si deseas permitir operaciones anónimas en desarrollo/demo)
CREATE POLICY "Permitir gestión anónima en modo desarrollo"
    ON public.profiles
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- DATOS SEMILLA (SEEDS) DE EJEMPLO
-- ==============================================================================
INSERT INTO public.profiles (
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
    is_active
) VALUES 
(
    'carlos-lara',
    'Carlos Lara',
    'Desarrollador Fullstack Senior',
    'DevCraft Studio',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&h=400&q=80',
    '+56912345678',
    '¡Hola Carlos! Vi tu tarjeta digital y me gustaría cotizar un proyecto web.',
    'carlos.lara@devcraft.io',
    'https://devcraft.io',
    'carloslara_dev',
    'https://facebook.com/carloslaradev',
    'https://linkedin.com/in/carlos-lara-dev',
    '#0284c7',
    true
),
(
    'cafe-artesanal',
    'Café de Origen Boutique',
    'Tostaduría & Bar de Café de Especialidad',
    'Café Gourmet Ltda.',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=400&h=400&q=80',
    '+56987654321',
    '¡Hola! Quisiera consultar por la carta de cafés y reservar una mesa.',
    'contacto@cafedeorigen.cl',
    'https://cafedeorigen.cl',
    'cafedeorigen_cl',
    'https://facebook.com/cafedeorigenchile',
    '',
    '#78350f',
    true
)
ON CONFLICT (slug) DO NOTHING;
