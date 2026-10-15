"use client";

import React from 'react';
import { Icono } from './Icons';
import { TITULOS_APP } from '../lib/theme';

interface TopbarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  darkMode: boolean;
  setDarkMode: (val: any) => void;
  isCollapsed: boolean;
  esEscritorio: boolean;
  usuarioActivo: any | null;
  pedidosPendientes?: number;
}

// Barra superior: el marco fijo de la app.
// Muestra el título de la sección, el contador de pedidos pendientes y el
// cambio de tema. La navegación del celular vive en BarraInferior.
export default function Topbar({ activeTab, setActiveTab, darkMode, setDarkMode, isCollapsed, esEscritorio, usuarioActivo, pedidosPendientes = 0 }: TopbarProps) {
  const superficie = darkMode ? '#1e293b' : '#ffffff';
  const texto = darkMode ? '#f8fafc' : '#0f172a';
  const subtexto = darkMode ? '#94a3b8' : '#64748b';
  const borde = darkMode ? '#334155' : '#e2e8f0';

  return (
    <>
      <header
        className="no-imprimir"
        style={{
          position: 'fixed',
          top: 0,
          left: esEscritorio ? (isCollapsed ? 76 : 248) : 0,
          right: 0,
          height: 62,
          zIndex: 900,
          background: superficie,
          borderBottom: `1px solid ${borde}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: esEscritorio ? '0 18px' : '0 12px'
        }}
      >
        {/* Lado izquierdo: título de la sección */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: texto, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {TITULOS_APP[activeTab] || 'Inicio'}
            </h1>
          </div>
        </div>

        {/* Acciones de la derecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {pedidosPendientes > 0 && (
            <button
              onClick={() => setActiveTab('pedidos_web')}
              title={`${pedidosPendientes} pedido(s) pendiente(s)`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 10,
                border: `1px solid ${borde}`, background: 'transparent', color: texto,
                cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', minHeight: 40
              }}
            >
              <Icono.Pedidos size={16} />
              <span style={{
                background: darkMode ? '#ef4444' : '#dc2626', color: '#fff', borderRadius: 999,
                padding: '1px 7px', fontSize: '0.72rem'
              }}>{pedidosPendientes}</span>
            </button>
          )}

          <button
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={darkMode ? 'Modo claro' : 'Modo oscuro'}
            className="solo-movil"
            style={{
              background: 'transparent', border: `1px solid ${borde}`, borderRadius: 10,
              width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: texto, cursor: 'pointer', flexShrink: 0
            }}
          >
            {darkMode ? <Icono.Sol size={18} /> : <Icono.Luna size={18} />}
          </button>
        </div>
      </header>
    </>
  );
}
