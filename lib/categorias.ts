// =============================================================================
// Categorías principales
// -----------------------------------------------------------------------------
// Las "principales" son las que se destacan en el panel y son las que se usan
// como imagen destacada en la web. Antes estaban escritas a fuego en el código
// (CATEGORIAS_PRINCIPALES); ahora el usuario decide cuáles son.
//
// La fuente de verdad es la columna `es_principal` de la tabla `categorias`.
// Mientras esa columna no exista en Supabase, el sistema guarda la selección en
// localStorage para que se pueda usar igual, y avisa que falta la migración.
// =============================================================================

export const PRINCIPALES_POR_DEFECTO = ['aromanza', 'sagrada_madre', 'ganesha', 'iluminarte'];

const CLAVE_LOCAL = 'categoriasPrincipales';

export type Categoria = {
  id: string;
  label: string;
  imagen_url?: string | null;
  orden?: number | null;
  es_principal?: boolean | null;
};

/** Normaliza un id a minúsculas para comparar sin sorpresas. */
export const idCat = (c: any): string => String(c?.id || '').trim().toLowerCase();

/** ids marcados como principales, en el orden en que deben mostrarse. */
export function calcularPrincipales(
  categorias: Categoria[],
  porDefecto: string[] = PRINCIPALES_POR_DEFECTO
): string[] {
  const marcadas = categorias
    .filter((c) => c?.es_principal === true)
    .map(idCat)
    .filter(Boolean);

  const unicas = Array.from(new Set(marcadas));

  // Si nadie marcó nada, se usan las de fábrica para no romper el panel.
  if (unicas.length === 0) return [...porDefecto];

  // Las de fábrica conserva su orden original; las nuevas quedan al final,
  // ordenadas alfabéticamente para que sea estable.
  const enOrigen = unicas.filter((id) => porDefecto.includes(id));
  const nuevas = unicas.filter((id) => !porDefecto.includes(id)).sort();
  return [...enOrigen, ...nuevas];
}

/** ¿La categoría es principal? */
export const esPrincipal = (c: any, principales: string[]): boolean =>
  principales.includes(idCat(c));

// --- Respaldo local (mientras la columna es_principal no exista) -------------

export function leerPrincipalesLocal(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const crudo = window.localStorage.getItem(CLAVE_LOCAL);
    if (!crudo) return null;
    const lista = JSON.parse(crudo);
    return Array.isArray(lista) ? lista.map((s) => String(s).toLowerCase()) : null;
  } catch {
    return null;
  }
}

export function guardarPrincipalesLocal(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLAVE_LOCAL, JSON.stringify(ids.map((s) => s.toLowerCase())));
  } catch {
    /* modo privado */
  }
}

export function limpiarPrincipalesLocal() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(CLAVE_LOCAL); } catch { /* modo privado */ }
}

/** Genera el id de una categoría a partir del nombre (mismo criterio que el alta). */
export const generarIdCategoria = (nombre: string) =>
  nombre.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');