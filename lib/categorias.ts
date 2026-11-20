// =============================================================================
// Categorías
// -----------------------------------------------------------------------------
// Las categorías son el primer nivel del stock. Las subcategorías y las
// sub-subcategorías son carpetas dentro de cada categoría.
//
// Ya no existe el concepto de "categoría principal": el panel y la web
// muestran y manejan todas las categorías de la misma forma, con su orden.
// =============================================================================

export type Categoria = {
  id: string;
  label: string;
  imagen_url?: string | null;
  orden?: number | null;
};

/** Normaliza un id a minúsculas para comparar sin sorpresas. */
export const idCat = (c: any): string => String(c?.id || '').trim().toLowerCase();

/** Ordena categorías: primero por `orden` (si existe) y luego alfabéticamente por label. */
export function ordenarCategorias(categorias: any[]): any[] {
  return [...(categorias || [])].sort((a, b) => {
    const oa = Number(a?.orden) || 0;
    const ob = Number(b?.orden) || 0;
    if (oa !== ob) return oa - ob;
    return String(a?.label || '').localeCompare(String(b?.label || ''), 'es', { sensitivity: 'base', numeric: true });
  });
}

/** Genera el id de una categoría a partir del nombre (mismo criterio que el alta). */
export const generarIdCategoria = (nombre: string) =>
  nombre.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
