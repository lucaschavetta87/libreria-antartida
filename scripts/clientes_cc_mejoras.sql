-- ============================================================
--  MEJORAS EN CLIENTES CC Y PEDIDOS WEB - Nuevas columnas
--  Ejecutar en el editor SQL de Supabase (una sola vez)
-- ============================================================
--
--  Agrega campos a la tabla `clientes` para soportar:
--    - localidad: localidad del cliente
--    - domicilio: dirección de domicilio
--    - codigo_postal: código postal
--  Y a la tabla `pedidos_web` para soportar los mismos campos al generar pedidos:
--    - localidad, domicilio, codigo_postal, transporte
--
--  Si estas columnas ya existen, el `if not exists` evita errores.
-- ============================================================

alter table clientes
  add column if not exists localidad text,
  add column if not exists domicilio text,
  add column if not exists codigo_postal text;

alter table pedidos_web
  add column if not exists localidad text,
  add column if not exists domicilio text,
  add column if not exists codigo_postal text,
  add column if not exists transporte text;

-- ============================================================
--  NOTA: La tabla `clientes` ya tiene `descuento_especial` desde migraciones
--  anteriores. Si no existe, agregarla también:
-- ============================================================

alter table clientes
  add column if not exists descuento_especial numeric default 0;
