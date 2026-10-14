// =============================================================================
// Helpers de estilo derivados de los tokens
// -----------------------------------------------------------------------------
// Objetivo: que cada componente pueda tomar estos estilos con UNA línea en lugar de
// re-declarar `inputStyle`, `cardStyle`, `btnBaseStyle`... en 20 archivos.
// Todos aceptan `isMobile` para poder aplicar responsive sin condicionales JSX.
// =============================================================================
import type { Tema } from './theme';

/** Devuelve el valor de escritorio en desktop y el de móvil en teléfono. */
export const responsive = <T,>(isMobile: boolean, escritorio: T, movil: T): T => (isMobile ? movil : escritorio);

/** Padding del contenido principal según el ancho disponible. */
export const paddingContenido = (isMobile: boolean) =>
  isMobile
    ? { padding: '16px', paddingTop: '76px' }
    : { padding: '28px 32px', paddingTop: '28px' };

export type EstilosTema = {
  theme: Tema;
  inputStyle: React.CSSProperties;
  cardStyle: React.CSSProperties;
  btnBaseStyle: React.CSSProperties;
  actionBtnStyle: (color: string) => React.CSSProperties;
  tablaHeadStyle: React.CSSProperties;
  etiquetaStyle: React.CSSProperties;
  separadorStyle: React.CSSProperties;
};

/** Construye el set de estilos base de una pantalla a partir del tema. */
export const crearEstilos = (theme: Tema, isMobile = false): EstilosTema => {
  const inputStyle: React.CSSProperties = {
    padding: isMobile ? '10px 12px' : '11px 14px',
    borderRadius: 10,
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.input,
    color: theme.text,
    outline: 'none',
    fontSize: 15, // >=16px en móvil evita el zoom automático de Safari
    width: '100%',
    minWidth: 0
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: isMobile ? 14 : 18,
    boxShadow: theme.shadowCard
  };

  const btnBaseStyle: React.CSSProperties = {
    padding: isMobile ? '12px 14px' : '11px 16px',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    cursor: 'pointer',
    width: isMobile ? '100%' : 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    transition: 'filter 0.15s ease, transform 0.05s ease'
  };

  const actionBtnStyle = (color: string): React.CSSProperties => ({
    background: theme.darkMode ? 'rgba(255,255,255,0.04)' : '#f8fafc',
    border: `1px solid ${color}`,
    borderRadius: 10,
    color,
    cursor: 'pointer',
    padding: '8px 12px',
    fontSize: 14,
    whiteSpace: 'nowrap',
    minHeight: 40
  });

  return {
    theme,
    inputStyle,
    cardStyle,
    btnBaseStyle,
    actionBtnStyle,
    tablaHeadStyle: {
      borderBottom: `1px solid ${theme.border}`,
      textAlign: 'left',
      fontSize: '0.72rem',
      fontWeight: 800,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: theme.subtext,
      padding: '10px 12px',
      whiteSpace: 'nowrap'
    },
    etiquetaStyle: {
      fontSize: '0.68rem',
      fontWeight: 800,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: theme.subtext
    },
    separadorStyle: { height: 1, backgroundColor: theme.border, border: 'none', margin: '12px 0' }
  };
};

/** Formatea precios en pesos argentinos. Única función para todo el sistema. */
export const precio = (valor: unknown): string => `$${Number(valor || 0).toLocaleString('es-AR')}`;

/** Versión sin el símbolo, para cuando ya viene en un contexto con "$". */
export const monto = (valor: unknown): string => Number(valor || 0).toLocaleString('es-AR');