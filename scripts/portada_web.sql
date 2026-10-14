-- ============================================================
--  PORTADA WEB - Tabla de control de la portada pública
--  Ejecutar en el editor SQL de Supabase (una sola vez)
-- ============================================================

create table if not exists portada_web (
  id            serial primary key,
  tipo          text not null,             -- 'novedad' | 'oferta' | 'banner'
  orden         integer default 0,
  stock_id      integer references stock(id) on delete cascade,
  imagen_url    text,
  precio_oferta numeric,
  titulo        text,
  activo        boolean default true,
  created_at    timestamptz default now()
);

create index if not exists idx_portada_web_tipo_orden on portada_web (tipo, orden);

alter table portada_web enable row level security;

-- La pagina publica necesita LEER la configuracion
drop policy if exists "lectura publica portada_web" on portada_web;
create policy "lectura publica portada_web" on portada_web
  for select using (true);

-- El sistema de gestion escribe. Mismo nivel de seguridad que el resto del
-- proyecto (la tabla stock tambien se escribe con la anon key).
drop policy if exists "escritura portada_web" on portada_web;
create policy "escritura portada_web" on portada_web
  for all using (true) with check (true);


-- ============================================================
--  BUCKET para las imagenes del carrusel del hero
-- ============================================================
insert into storage.buckets (id, name, public)
values ('portada-imagenes', 'portada-imagenes', true)
on conflict (id) do nothing;

-- Permitir que la anon key lea y escriba archivos del bucket
drop policy if exists "lectura publica portada-imagenes" on storage.objects;
create policy "lectura publica portada-imagenes" on storage.objects
  for select using (bucket_id = 'portada-imagenes');

drop policy if exists "escritura portada-imagenes" on storage.objects;
create policy "escritura portada-imagenes" on storage.objects
  for all using (bucket_id = 'portada-imagenes') with check (bucket_id = 'portada-imagenes');