"use client";

import React from 'react';

/* Ojito de visibilidad en la web pública.
   👁️ = se muestra en la web · ojo tachado = oculto.
   Se muestra SIEMPRE (no al pasar el mouse) porque informa estado, y el clic
   alterna. Lo oculto sigue viéndose en el sistema, solo cambia en la página. */

export type TipoOcultable = 'categoria' | 'subcategoria' | 'subsubcategoria' | 'producto';

/* Fila oculta en la web: solo cuenta `visible_web === false`. Mientras la
   columna todavía no exista en Supabase, todo se considera visible. */
export const ocultaEnWeb = (fila: any) => fila?.visible_web === false;

const textoSegun = (tipo: TipoOcultable, visible: boolean) => {
  const que = tipo === 'producto' ? 'producto'
    : tipo === 'categoria' ? 'categoría'
    : tipo === 'subcategoria' ? 'subcategoría'
    : 'sub-subcategoría';
  return visible
    ? `${que[0].toUpperCase()}${que.slice(1)} visible en la web · clic para ocultar`
    : `${que[0].toUpperCase()}${que.slice(1)} oculto en la web · clic para mostrar`;
};

export default function OjoVisibilidad({
  visible, tipo = 'producto', onToggle, tamanio = '0.9rem', oscuro = true, disabled = false, titulo
}: {
  visible: boolean;
  tipo?: TipoOcultable;
  onToggle: () => void;
  tamanio?: string;
  oscuro?: boolean;
  disabled?: boolean;
  titulo?: string;
}) {
  const linea = visible ? 'transparent' : (oscuro ? '#ef4444' : '#dc2626');
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (!disabled) onToggle(); }}
      title={titulo || textoSegun(tipo, visible)}
      aria-label={textoSegun(tipo, visible)}
      aria-pressed={!visible}
      style={{
        background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0, lineHeight: 1, flexShrink: 0, fontSize: tamanio,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.45 : 1, transition: 'transform .12s ease'
      }}
      onMouseEnter={(e: any) => { if (!disabled) e.currentTarget.style.transform = 'scale(1.18)'; }}
      onMouseLeave={(e: any) => { e.currentTarget.style.transform = 'none'; }}
    >
      <span style={{ position: 'relative', display: 'inline-block', width: '1.05em', textAlign: 'center' }}>
        👁️
        <span
          aria-hidden
          style={{
            position: 'absolute', left: '-1px', right: '-1px', top: '50%',
            height: '2px', borderRadius: '2px', backgroundColor: linea,
            transform: 'translateY(-50%) rotate(-34deg)'
          }}
        />
      </span>
    </button>
  );
}
