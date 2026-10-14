"use client";

import React from 'react';
import { Icono } from '../Icons';
import { crearTema } from '../../lib/theme';

// =============================================================================
// Piezas visuales compartidas por todas las pantallas
// -----------------------------------------------------------------------------
// Reciben `darkMode` explícito (no leen del DOM) para que el render del servidor
// y el del cliente coincidan siempre: cero avisos de hidratación.
// =============================================================================

export function Vacio({
  icono = '📦', titulo, detalle, accion, darkMode = true
}: { icono?: string; titulo: string; detalle?: string; accion?: { texto: string; onClick: () => void }; darkMode?: boolean }) {
  const t = crearTema(darkMode);
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: '2.4rem', marginBottom: 8, opacity: 0.65 }}>{icono}</div>
      <div style={{ fontWeight: 700, color: t.text, fontSize: '0.95rem' }}>{titulo}</div>
      {detalle && <div style={{ color: t.subtext, fontSize: '0.85rem', marginTop: 4 }}>{detalle}</div>}
      {accion && (
        <button
          onClick={accion.onClick}
          style={{
            marginTop: 16, padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(180deg,#4f46e5 0%,#4338ca 100%)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', minHeight: 42
          }}
        >
          {accion.texto}
        </button>
      )}
    </div>
  );
}

export function Cargando({ filas = 5, alto = 46, darkMode = true }: { filas?: number; alto?: number; darkMode?: boolean }) {
  const t = crearTema(darkMode);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 2px' }} aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }).map((_, i) => (
        <div
          key={i}
          style={{
            height: alto, borderRadius: 12,
            background: `linear-gradient(90deg, ${t.border} 25%, ${t.innerBox} 37%, ${t.border} 63%)`,
            backgroundSize: '400% 100%',
            animation: `brilloCargando 1.4s ease infinite`,
            animationDelay: `${i * 0.08}s`,
            opacity: Math.max(0.45, 1 - i * 0.09)
          }}
        />
      ))}
    </div>
  );
}

export function Pill({ texto, color, fondo }: { texto: string; color: string; fondo?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
      fontSize: '0.7rem', fontWeight: 800, whiteSpace: 'nowrap',
      color, background: fondo || `${color}22`, border: `1px solid ${color}44`
    }}>
      {texto}
    </span>
  );
}

export function Paginacion({
  pagina, totalPaginas, onCambiar, darkMode = true
}: { pagina: number; totalPaginas: number; onCambiar: (p: number) => void; darkMode?: boolean }) {
  const t = crearTema(darkMode);
  if (totalPaginas <= 1) return null;

  const paginas = Array.from({ length: totalPaginas }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1);

  const btn = (contenido: React.ReactNode, destino: number | null, activo = false, desactivado = false) => (
    <button
      onClick={() => destino && !desactivado && onCambiar(destino)}
      disabled={desactivado}
      aria-label={destino ? `Ir a la página ${destino}` : 'Anterior'}
      style={{
        minWidth: 38, height: 38, padding: '0 10px', borderRadius: 9, cursor: desactivado ? 'not-allowed' : 'pointer',
        border: `1px solid ${t.border}`, fontWeight: 700, fontSize: '0.84rem',
        background: activo ? 'linear-gradient(180deg,#4f46e5 0%,#4338ca 100%)' : 'transparent',
        color: activo ? '#fff' : t.text, opacity: desactivado ? 0.4 : 1
      }}
    >
      {contenido}
    </button>
  );

  return (
    <nav aria-label="Paginación" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 18 }}>
      {btn(<Icono.ChevronLeft size={15} />, pagina - 1, false, pagina === 1)}
      {paginas.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && paginas[i - 1] !== p - 1 && <span style={{ color: t.subtext, padding: '0 2px' }}>…</span>}
          {btn(p, p, p === pagina)}
        </React.Fragment>
      ))}
      {btn(<Icono.ChevronRight size={15} />, pagina + 1, false, pagina === totalPaginas)}
    </nav>
  );
}

export function TituloSeccion({
  titulo, detalle, acciones, darkMode = true
}: { titulo: string; detalle?: string; acciones?: React.ReactNode; darkMode?: boolean }) {
  const t = crearTema(darkMode);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: t.text }}>{titulo}</h2>
        {detalle && <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: t.subtext }}>{detalle}</p>}
      </div>
      {acciones && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{acciones}</div>}
    </div>
  );
}