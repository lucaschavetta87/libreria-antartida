-- =============================================================================
-- Retira la función de "categorías principales"
-- -----------------------------------------------------------------------------
-- Con esta migración se elimina el concepto de categoría principal (la columna
-- `es_principal` y su lógica). El stock y la web usan una sola jerarquía:
-- categoría -> subcategoría -> sub-subcategoría.
--
-- Después de correr este script, reconstruí el panel y la web para que ya no
-- exista la separación "principales / otras" ni el selector de categorías
-- principales.
-- =============================================================================

alter table categorias drop column if exists es_principal;
