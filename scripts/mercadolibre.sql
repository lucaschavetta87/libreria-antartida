-- ============================================================
--  MERCADOLIBRE - Tablas para integracion con la API de ML
--  Ejecutar en el editor SQL de Supabase (una sola vez)
-- ============================================================

-- Tokens de autenticacion con MercadoLibre (OAuth 2.0)
create table if not exists ml_tokens (
  id text primary key default 'config',
  user_id_ml bigint,
  nickname text,
  access_token text,
  refresh_token text,
  expires_at timestamp,
  actualizado_en timestamp default now()
);

-- Productos sincronizados de MercadoLibre
create table if not exists ml_productos_sync (
  id bigint primary key,              -- ID de ML (MLA123456789)
  titulo text,
  precio numeric,
  stock_disponible int default 0,
  estado text default 'active',        -- active, paused, closed, under_review
  permalink text,
  imagen_url text,
  stock_id_local int,                  -- vinculo con stock interno (FK opcional)
  categoria_ml text,
  sincronizado_en timestamp default now()
);

-- Ventas de MercadoLibre
create table if not exists ml_ventas (
  id bigint primary key,              -- order_id de ML
  comprador_nombre text,
  comprador_email text,
  comprador_telefono text,
  direccion_envio text,
  metodo_envio text,
  tracking_number text,
  productos jsonb,
  total numeric,
  estado_pago text,                   -- paid, pending, cancelled, etc.
  estado_envio text,                  -- shipped, delivered, pending, etc.
  fecha timestamp,
  sincronizado_en timestamp default now(),
  facturado boolean default false,    -- si ya se genero factura
  factura_numero text,                -- numero de factura (pendiente de implementar)
  preparado boolean default false     -- si ya se preparo para envio
);

-- RLS: permitir lectura/escritura (el sistema de gestion usa anon key)
alter table ml_tokens enable row level security;
alter table ml_productos_sync enable row level security;
alter table ml_ventas enable row level security;

drop policy if exists "ml_tokens_all" on ml_tokens;
create policy "ml_tokens_all" on ml_tokens for all using (true) with check (true);

drop policy if exists "ml_productos_all" on ml_productos_sync;
create policy "ml_productos_all" on ml_productos_sync for all using (true) with check (true);

drop policy if exists "ml_ventas_all" on ml_ventas;
create policy "ml_ventas_all" on ml_ventas for all using (true) with check (true);

-- ============================================================
--  NOTA: Para usar la integracion, registrar la app en:
--  https://developers.mercadolibre.com.ar/
--  y completar ML_APP_ID y ML_SECRET_KEY en .env.local
-- ============================================================",>