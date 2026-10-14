"use client";

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import logoControlCel from '../assets/logo.png';
import { Icono } from './Icons';
import { filtrarSecciones } from './Navbar';
import { TITULOS_APP, SUPERFICIE_MARCA } from '../lib/theme';

interface TopbarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  darkMode: boolean;
  setDarkMode: (val: any) => void;
  isCollapsed: boolean;
  esMovil: boolean;
  usuarioActivo: any | null;
  pedidosPendientes?: number;
}

// Barra superior: es el marco fijo de la app.
// Concentra el título de la sección, el acceso rápido a todo el sistema
// (Ctrl/Cmd + K) y el menú de navegación en el celular.
export default function Topbar({ activeTab, setActiveTab, darkMode, setDarkMode, isCollapsed, esMovil, usuarioActivo, pedidosPendientes = 0 }: TopbarProps) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const secciones = useMemo(() => filtrarSecciones(usuarioActivo), [usuarioActivo]);

  const irA = (tab: string) => {
    setActiveTab(tab);
    setMenuAbierto(false);
  };

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
          left: esMovil ? 0 : (isCollapsed ? 76 : 248),
          right: 0,
          height: 62,
          zIndex: 900,
          background: superficie,
          borderBottom: `1px solid ${borde}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: esMovil ? '0 12px' : '0 18px'
        }}
      >
        {/* Lado izquierdo: en celular abre el menú */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            className={esMovil ? undefined : 'solo-movil'}
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir menú"
            style={{
              background: 'transparent', border: `1px solid ${borde}`, borderRadius: 10,
              width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: texto, cursor: 'pointer', flexShrink: 0
            }}
          >
            <Icono.Menu size={20} />
          </button>

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
              onClick={() => irA('pedidos_web')}
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

      {/* ================= MENÚ DEL CELULAR ================= */}
      {menuAbierto && (
        <div
          onClick={() => setMenuAbierto(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: darkMode ? 'rgba(2,6,23,0.72)' : 'rgba(15,23,42,0.45)',
            display: 'flex'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(300px, 86vw)', background: SUPERFICIE_MARCA.bg, color: '#fff',
              display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 16px', borderBottom: SUPERFICIE_MARCA.borde }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Image src={logoControlCel} alt="Logo" width={30} height={30} style={{ objectFit: 'contain' }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 800, fontSize: '0.92rem' }}>Pueblos del Mundo</span>
                  <span style={{ display: 'block', fontSize: '0.62rem', color: SUPERFICIE_MARCA.textoTenue, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sistema de Gestión</span>
                </span>
              </div>
              <button
                onClick={() => setMenuAbierto(false)}
                aria-label="Cerrar menú"
                style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <Icono.Cerrar size={18} />
              </button>
            </div>

            <div style={{ flex: 1, padding: '10px 10px 20px' }}>
              {secciones.map((sec) => (
                <div key={sec.label} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '0.62rem', color: SUPERFICIE_MARCA.textoTenue, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 12px 6px' }}>
                    {sec.label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {sec.items.map((it) => {
                      const I = Icono[it.icono];
                      const activo = activeTab === it.key;
                      return (
                        <button
                          key={it.key}
                          onClick={() => irA(it.key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                            padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', minHeight: 46,
                            background: activo ? SUPERFICIE_MARCA.activo : 'transparent',
                            color: '#fff', fontWeight: activo ? 700 : 500, fontSize: '0.92rem'
                          }}
                        >
                          <I size={19} />
                          {it.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {usuarioActivo && (
              <div style={{ padding: '14px 16px', borderTop: SUPERFICIE_MARCA.borde, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                  {(usuarioActivo.nombre?.[0] || usuarioActivo.username?.[0] || 'U').toUpperCase()}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', color: '#fff', fontSize: '0.82rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usuarioActivo.nombre || usuarioActivo.username}</span>
                  <span style={{ display: 'block', fontSize: '0.62rem', color: SUPERFICIE_MARCA.textoTenue, textTransform: 'uppercase' }}>{usuarioActivo.username === 'admin' ? 'Administrador' : 'Usuario'}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}