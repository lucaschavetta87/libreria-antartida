-- ============================================================
--  VISIBILIDAD EN LA WEB PUBLICA - Columna "visible_web"
--  Ejecutar en el editor SQL de Supabase (una sola vez)
-- ============================================================
--
--  Agrega un campo booleano a las tablas de catalogo para poder ocultar
--  categorias y productos de la pagina publica SIN borrarlos ni tocar su
--  informacion. Se usa con el "ojito" del sistema de gestion:
--     true  (default) = se muestra en la web
--     false           = queda oculto en la web (sigue visible en la gestion,
--                       en los POS y en las etiquetas de codigos de barra)
--
--  Si este script todavia no se corrio, no pasa nada: el sistema de gestion
--  muestra el ojito apagado con el aviso de agregar la columna, y la web
--  sigue mostrando todo como hasta ahora.
--
--  IMPORTANTE: agregar una columna a mano puede fallar si la tabla tiene
--  muchas filas y la base esta activa. Si da error, esperar unos segundos y
--  reintentar desde el mismo editor.
-- ============================================================

alter table stock            add column if not exists visible_web boolean default true;
alter table categorias       add column if not exists visible_web boolean default true;
alter table subcategorias    add column if not exists visible_web boolean default true;
alter table subsubcategorias add column if not exists visible_web boolean default true;

-- Todas las filas existentes quedan visibles (comportamiento actual de la web).
update stock            set visible_web = true where visible_web is null;
update categorias       set visible_web = true where visible_web is null;
update subcategorias    set visible_web = true where visible_web is null;
update subsubcategorias set visible_web = true where visible_web is null;
