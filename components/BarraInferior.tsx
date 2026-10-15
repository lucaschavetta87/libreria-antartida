"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Icono } from './Icons';
import { filtrarSecciones } from './Navbar';
import { SUPERFICIE_MARCA } from '../lib/theme';

// =============================================================================
// Barra inferior de navegación (móvil y tablet)
// -----------------------------------------------------------------------------
// Reemplaza al botón hamburguesa: la navegación está siempre visible, así que
// nunca queda una pantalla sin acceso al sistema. En escritorio (>1024px) se
// oculta por CSS y corre la sidebar lateral.
// =============================================================================

// Las 5 secciones de uso diario, en el orden en que se usan durante la jornada.
const FIJOS = [
  { key: 'inicio', label: 'Inicio', icono: 'Inicio' as const },
  { key: 'ventas', label: 'Venta', icono: 'Venta' as const },
  { key: 'ventas_mayoristas', label: 'Mayorista', icono: 'Mayorista' as const },
  { key: 'pedidos_web', label: 'Pedidos', icono: 'Pedidos' as const },
  { key: 'stock', label: 'Productos', icono: 'Inventario' as const }
];

export default function BarraInferior({
  activeTab,
  setActiveTab,
  darkMode,
  usuarioActivo,
  pedidosPendientes = 0
}: {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  darkMode: boolean;
  usuarioActivo: any | null;
  pedidosPendientes?: number;
}) {
  const [masAbierto, setMasAbierto] = useState(false);
  const secciones = useMemo(() => filtrarSecciones(usuarioActivo), [usuarioActivo]);

  // Al cambiar de sección se cierra el panel de "Más".
  useEffect(() => { setMasAbierto(false); }, [activeTab]);

  // Escape cierra el panel.
  useEffect(() => {
    if (!masAbierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setMasAbierto(false); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [masAbierto]);

  const irA = (tab: string) => {
    setActiveTab(tab);
    setMasAbierto(false);
  };

  // Solo las secciones a las que el usuario tiene acceso.
  const fijosVisibles = FIJOS.filter((f) => secciones.some((s) => s.items.some((i) => i.key === f.key)));
  const colorTexto = darkMode ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.72)';

  const item = (activo: boolean) => ({
    flex: '1 1 0',
    minWidth: 62,
    border: 'none',
    background: 'transparent',
    color: activo ? '#fff' : colorTexto,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    padding: '6px 2px',
    cursor: 'pointer',
    // 62px es el mínimo cómodo para tocar con el dedo
    minHeight: 58
  });

  return (
    <>
      <nav
        className="barra-inferior"
        aria-label="Navegación principal"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'stretch',
          background: SUPERFICIE_MARCA.bg,
          borderTop: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 -8px 24px -12px rgba(0,0,0,0.55)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        {fijosVisibles.map((f) => {
          const I = Icono[f.icono];
          const activo = activeTab === f.key;
          return (
            <button
              key={f.key}
              onClick={() => irA(f.key)}
              aria-current={activo ? 'page' : undefined}
              aria-label={f.label}
              style={{ ...item(activo), position: 'relative', background: activo ? 'rgba(255,255,255,0.14)' : 'transparent' }}
            >
              <span style={{ position: 'relative', display: 'flex' }}>
                <I size={21} />
                {f.key === 'pedidos_web' && pedidosPendientes > 0 && (
                  <span style={{
                    position: 'absolute', top: -5, right: -8, minWidth: 17, height: 17, padding: '0 4px',
                    borderRadius: 999, background: '#ef4444', color: '#fff', fontSize: '0.62rem',
                    fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {pedidosPendientes}
                  </span>
                )}
              </span>
              <span style={{ fontSize: '0.64rem', fontWeight: activo ? 800 : 600, letterSpacing: '0.01em' }}>{f.label}</span>
              {/* Indicador de sección activa */}
              <span style={{
                position: 'absolute', top: 0, left: '22%', right: '22%', height: 3, borderRadius: '0 0 3px 3px',
                background: activo ? '#fff' : 'transparent'
              }} />
            </button>
          );
        })}

        {/* Botón "Más": acceso a TODAS las secciones */}
        <button
          onClick={() => setMasAbierto(true)}
          aria-label="Ver todas las secciones"
          aria-expanded={masAbierto}
          style={item(masAbierto)}
        >
          <span style={{
            width: 34, height: 26, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: masAbierto ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)',
            color: '#fff'
          }}>
            <Icono.Agregar size={17} />
          </span>
          <span style={{ fontSize: '0.64rem', fontWeight: 600 }}>Más</span>
        </button>
      </nav>

      {/* ---------- Panel con todas las secciones ---------- */}
      {masAbierto && (
        <div
          onClick={() => setMasAbierto(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: darkMode ? 'rgba(2,6,23,0.72)' : 'rgba(15,23,42,0.5)',
            display: 'flex', alignItems: 'flex-end'
          }}
        >
          <div
            role="dialog"
            aria-label="Todas las secciones"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '86dvh',
              overflowY: 'auto',
              background: darkMode ? '#1e293b' : '#ffffff',
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              borderTop: '1px solid rgba(255,255,255,0.12)',
              padding: '8px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
              boxShadow: '0 -20px 50px rgba(0,0,0,0.45)'
            }}
          >
            {/* Tirador */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 12px' }}>
              <span style={{ width: 42, height: 4, borderRadius: 999, background: darkMode ? '#475569' : '#cbd5e1' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                Todas las secciones
              </h2>
              <button
                onClick={() => setMasAbierto(false)}
                aria-label="Cerrar"
                style={{
                  background: 'transparent', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                  borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: darkMode ? '#94a3b8' : '#64748b', cursor: 'pointer'
                }}
              >
                <Icono.Cerrar size={17} />
              </button>
            </div>

            {secciones.map((sec) => (
              <div key={sec.label} style={{ marginTop: 14 }}>
                <div style={{
                  fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
                  color: darkMode ? '#94a3b8' : '#64748b', marginBottom: 8
                }}>
                  {sec.label}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {sec.items.map((it) => {
                    const I = Icono[it.icono];
                    const activo = activeTab === it.key;
                    return (
                      <button
                        key={it.key}
                        onClick={() => irA(it.key)}
                        aria-current={activo ? 'page' : undefined}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 7, padding: '14px 6px', borderRadius: 14, cursor: 'pointer', minHeight: 86,
                          background: activo
                            ? 'rgba(79,70,229,0.12)'
                            : (darkMode ? 'rgba(255,255,255,0.04)' : '#f8fafc'),
                          border: `1px solid ${activo ? '#4f46e5' : darkMode ? '#334155' : '#e2e8f0'}`,
                          color: activo ? (darkMode ? '#c7d2fe' : '#4338ca') : (darkMode ? '#f8fafc' : '#0f172a')
                        }}
                      >
                        <I size={22} />
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.25 }}>
                          {it.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Usuario (solo en móvil) */}
            {usuarioActivo && (
              <div style={{
                marginTop: 18, paddingTop: 14, borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                display: 'flex', alignItems: 'center', gap: 11
              }}>
                <span style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#fff', color: '#4f46e5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0
                }}>
                  {(usuarioActivo.nombre?.[0] || usuarioActivo.username?.[0] || 'U').toUpperCase()}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: darkMode ? '#f8fafc' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {usuarioActivo.nombre || usuarioActivo.username}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.66rem', color: darkMode ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>
                    {usuarioActivo.username === 'admin' ? 'Administrador' : 'Usuario'}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}