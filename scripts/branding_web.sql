-- ============================================================
--  BRANDING TEMATICO PARA LA WEB PUBLICA - Tabla de configuracion
--  Ejecutar en el editor SQL de Supabase (una sola vez)
-- ============================================================
--
--  Agrega una tabla para configurar el tema/branding visual de la web
--  publica (Navidad, Halloween, Dia de la Madre, festividades esotericas,
--  etc.). Se usa desde "Control de portada" en el sistema de gestion.
--
--  Si esta tabla todavia no existe, la web sigue funcionando con su
--  apariencia por defecto (sin tema).
-- ============================================================

create table if not exists configuracion_web (
  id text primary key default 'config',
  tema_activo text default null,          -- 'navidad' | 'halloween' | 'dia_madre' | 'esoterico' | 'verano' | 'invierno' | null
  mensaje_tema text default '',            -- frase corta que se muestra en la web
  color_primario text default '#111827',   -- hex botones y acentos
  color_secundario text default '#ffffff', -- hex fondo secundario
  imagen_fondo text default null,          -- URL storage (fondo del hero)
  imagen_banner text default null,         -- URL storage (banner de portada)
  actualizado_en timestamp default now()
);

-- Fila inicial (si no existe)
insert into configuracion_web (id) values ('config') on conflict (id) do nothing;

-- RLS: permitir lectura publica y escritura autenticada
alter table configuracion_web enable row level security;

-- Politica de lectura publica (la web publica lee sin auth)
create policy "lectura_publica_configuracion_web"
  on configuracion_web for select
  using (true);

-- Politica de escritura (solo usuarios autenticados / anon con permisos del sistema)
create policy "escritura_configuracion_web"
  on configuracion_web for all
  using (true)
  with check (true);

-- ============================================================
--  Temas disponibles (referencia, no es tabla):
--    null         -> sin tema (apariencia por defecto)
--    'navidad'    -> Navidad (rojo/verde/dorado, copos, aurora)
--    'halloween'  -> Halloween (naranja/negro/morado, calabazas)
--    'dia_madre'  -> Dia de la Madre (rosa/blanco/dorado, flores)
--    'esoterico'  -> Esoterico general (violeta/negro/dorado, luna/estrellas)
--    'verano'     -> Verano (amarillo/turquesa, sol)
--    'invierno'   -> Invierno (azul/blanco, nieve)
-- ============================================================",