-- ============================================================
--  MEJORAS EN PUNTOS DE VENTA - Columnas para descuentos y vuelto
--  Ejecutar en el editor SQL de Supabase (una sola vez)
-- ============================================================
--
--  Agrega campos a la tabla `ventas` para soportar:
--    - descuento_efectivo: descuento adicional por pago en efectivo (manual)
--    - monto_entregado:    monto con el que paga el cliente en efectivo
--    - vuelto:             se calcula como monto_entregado - total (opcional, para auditoría)
--
--  Si estas columnas ya existen, el `if not exists` evita errores.
--  Valores por defecto en 0/null para no afectar ventas previas.
-- ============================================================

alter table ventas
  add column if not exists descuento_efectivo numeric default 0,
  add column if not exists monto_entregado numeric,
  add column if not exists vuelto numeric;

-- Las ventas existentes tendrán descuento_efectivo = 0 y monto_entregado = null
-- (comportamiento actual: sin descuento extra ni vuelto).
update ventas set descuento_efectivo = 0 where descuento_efectivo is null;

-- ============================================================
--  NOTA: También se añadió `estado` en migraciones anteriores para
--  distinguir ventas completadas ('completada') de borradores ('borrador').
--  Si la columna `estado` no existe, ejecuta también:
--
--  alter table ventas add column if not exists estado text default 'completada';
--  update ventas set estado = 'completada' where estado is null;
-- ============================================================