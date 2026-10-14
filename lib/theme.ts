// =============================================================================
// Tokens de diseño del sistema (fuente única de verdad)
// -----------------------------------------------------------------------------
// Ningún componente debe inventar colores: todo sale de acá.
// Los componentes siguen recibiendo `theme`, `inputStyle`, `btnBaseStyle`, etc.
// con la misma forma que antes, así que migrarlos es gradual y sin riesgos.
// =============================================================================

export type Tema = {
  darkMode: boolean;
  // Superficies
  bg: string;
  card: string;
  cardAlt: string;
  innerBox: string;
  input: string;
  // Texto
  text: string;
  textStrong: string;
  subtext: string;
  muted: string;
  // Bordes
  border: string;
  borderStrong: string;
  rowBorder: string;
  // Interacción
  hover: string;
  overlay: string;
  shadow: string;
  shadowCard: string;
  // Marca y estados (son los mismos en ambos temas: mantienen la identidad)
  accent: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  // Roles de precio (se usan en tablas, POS y catálogos)
  mayorista: string;
  minorista: string;
  promo: string;
};

/** Colores de marca y estados: idénticos en claro y oscuro (identidad del sistema). */
export const COLORES = {
  accent: '#4f46e5',
  accentHover: '#4338ca',
  accentSoft: 'rgba(79, 70, 229, 0.12)',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  mayorista: '#8b5cf6',
  minorista: '#10b981',
  promo: '#f43f5e'
} as const;

const TEMA_OSCURO: Omit<Tema, 'darkMode'> = {
  bg: '#0f172a',
  card: '#1e293b',
  cardAlt: '#243449',
  innerBox: '#0f172a',
  input: '#0b1220',
  text: '#f8fafc',
  textStrong: '#ffffff',
  subtext: '#94a3b8',
  muted: '#64748b',
  border: '#334155',
  borderStrong: '#475569',
  rowBorder: '#1e293b',
  hover: 'rgba(255,255,255,0.06)',
  overlay: 'rgba(2, 6, 23, 0.75)',
  shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.25), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
  shadowCard: '0 10px 30px -12px rgba(0, 0, 0, 0.55)',
  ...COLORES,
  accentSoft: 'rgba(99, 102, 241, 0.16)'
};

const TEMA_CLARO: Omit<Tema, 'darkMode'> = {
  bg: '#f1f5f9',
  card: '#ffffff',
  cardAlt: '#f8fafc',
  innerBox: '#f8fafc',
  input: '#ffffff',
  text: '#0f172a',
  textStrong: '#020617',
  subtext: '#475569',
  muted: '#94a3b8',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  rowBorder: '#f1f5f9',
  hover: '#f1f5f9',
  overlay: 'rgba(15, 23, 42, 0.55)',
  shadow: '0 10px 15px -3px rgba(15, 23, 42, 0.06), 0 4px 6px -2px rgba(15, 23, 42, 0.04)',
  shadowCard: '0 12px 28px -14px rgba(15, 23, 42, 0.28)',
  accent: COLORES.accent,
  accentSoft: COLORES.accentSoft,
  // En fondo blanco los colores base pierden contraste: se usan tonos más oscuros.
  success: '#059669',
  warning: '#b45309',
  danger: '#dc2626',
  info: '#2563eb',
  mayorista: '#7c3aed',
  minorista: '#047857',
  promo: '#e11d48'
};

export const crearTema = (darkMode: boolean): Tema => ({
  darkMode,
  ...(darkMode ? TEMA_OSCURO : TEMA_CLARO)
});

/** Tema de marca para superficies siempre oscuras (sidebar, topbar, cabeceras). */
export const SUPERFICIE_MARCA = {
  bg: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)',
  borde: 'rgba(255,255,255,0.10)',
  texto: '#ffffff',
  textoTenue: 'rgba(255,255,255,0.62)',
  hover: 'rgba(255,255,255,0.12)',
  activo: 'rgba(255,255,255,0.18)'
} as const;

// =============================================================================
// Escala de espaciado, radios y tipografía
// =============================================================================

export const ESPACIO = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIO = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;

/** Base tipográfica: una sola escala para todos los textos. */
export const TIPOGRAFIA = {
  h1: { fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' },
  h2: { fontSize: '1.25rem', fontWeight: 800 },
  h3: { fontSize: '1rem', fontWeight: 700 },
  cuerpo: { fontSize: '0.92rem' },
  chico: { fontSize: '0.82rem' },
  micro: { fontSize: '0.72rem' },
  etiqueta: { fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  precio: { fontSize: '0.95rem', fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  total: { fontSize: '1.35rem', fontWeight: 800, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
} as const;

/** Alturas táctiles mínimas: importante en el celular y en los puntos de venta. */
export const TOQUE = { minimo: 40, comfortable: 48 } as const;

// =============================================================================
// Breakpoints (reemplazan el `window.innerWidth <= 768` duplicado en 4 archivos)
// =============================================================================

export const BREAKPOINTS = { movil: 640, tablet: 1024, desktop: 1280 } as const;

/** Etiqueta de sección para el título de la app. */
export const TITULOS_APP: Record<string, string> = {
  inicio: 'Inicio',
  stock: 'Productos',
  ventas: 'Venta Minorista',
  ventas_mayoristas: 'Venta Mayorista',
  pedidos_web: 'Pedidos Web',
  clientes: 'Cuenta Corriente',
  caja: 'Cierre de Caja',
  usuarios: 'Gestión de Usuarios',
  pagina_web: 'Página Web',
  portada_web: 'Control Portada'
};