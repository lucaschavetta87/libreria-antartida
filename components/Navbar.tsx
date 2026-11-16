"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import logoControlCel from '../assets/logo.png';
import { Icono } from './Icons';
import { SUPERFICIE_MARCA } from '../lib/theme';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  darkMode: boolean;
  setDarkMode: (val: any) => void;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  usuarioActivo: any | null;
}

// Secciones del sistema. Cada item declara su icono y el permiso necesario
// (la lógica de permisos no cambió: admin ve todo, el resto según su lista).
export const SECCIONES = [
  {
    label: 'Operaciones',
    items: [
      { key: 'inicio', label: 'Inicio', icono: 'Inicio' as const, permiso: 'inicio' },
      { key: 'ventas', label: 'Venta Minorista', icono: 'Venta' as const, permiso: 'ventas' },
      { key: 'ventas_mayoristas', label: 'Venta Mayorista', icono: 'Mayorista' as const, permiso: 'ventas_mayoristas' },
      { key: 'pedidos_web', label: 'Pedidos Web', icono: 'Pedidos' as const, permiso: 'pedidos_web' }
    ]
  },
  {
    label: 'Comercial',
    items: [
      { key: 'stock', label: 'Productos', icono: 'Inventario' as const, permiso: 'stock' },
      { key: 'clientes', label: 'Cuenta Corriente', icono: 'CuentaCorriente' as const, permiso: 'clientes' },
      { key: 'caja', label: 'Cierre de Caja', icono: 'Caja' as const, permiso: 'caja' }
    ]
  },
  {
    label: 'Web',
    items: [
      { key: 'pagina_web', label: 'Página Web', icono: 'Web' as const, permiso: null },
      { key: 'portada_web', label: 'Control Portada', icono: 'Portada' as const, permiso: 'portada_web' },
      { key: 'mercadolibre', label: 'MercadoLibre', icono: 'Web' as const, permiso: 'mercadolibre' }
    ]
  },
  {
    label: 'Seguridad',
    adminOnly: true,
    items: [
      { key: 'usuarios', label: 'Gestión Usuarios', icono: 'Usuarios' as const, permiso: 'usuarios' }
    ]
  }
];

export function filtrarSecciones(usuarioActivo: any | null) {
  const tienePermiso = (permiso: string | null) => {
    if (!usuarioActivo) return false;
    if (usuarioActivo.username === 'admin') return true;
    if (!permiso) return true; // la página web es visible para todos
    return usuarioActivo.permisos.includes(permiso);
  };
  return SECCIONES
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => (sec.adminOnly ? usuarioActivo?.username === 'admin' : tienePermiso(it.permiso))) }))
    .filter((sec) => sec.items.length > 0);
}

export default function Navbar({ activeTab, setActiveTab, darkMode, setDarkMode, isCollapsed, setIsCollapsed, usuarioActivo }: NavbarProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const secciones = filtrarSecciones(usuarioActivo);

  // En pantallas medianas la sidebar arranca colapsada para no comer el espacio.
  useEffect(() => {
    // En pantallas medianas la sidebar arranca colapsada para no comer espacio.
    // (La sidebar solo existe desde 1025px: hasta ahí corre la barra inferior.)
    const aplicar = () => { if (window.innerWidth > 1024 && window.innerWidth <= 1280) setIsCollapsed(true); };
    aplicar();
    window.addEventListener('resize', aplicar);
    return () => window.removeEventListener('resize', aplicar);
  }, [setIsCollapsed]);

  const navButtonStyle = (tabName: string): React.CSSProperties => {
    const isActive = activeTab === tabName;
    const isHovered = hoveredTab === tabName;
    return {
      width: '100%',
      padding: isCollapsed ? '11px 0' : '11px 12px',
      borderRadius: 12,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      justifyContent: isCollapsed ? 'center' : 'flex-start',
      backgroundColor: isActive ? SUPERFICIE_MARCA.activo : (isHovered ? SUPERFICIE_MARCA.hover : 'transparent'),
      color: '#fff',
      border: 'none',
      fontWeight: isActive ? 700 : 500,
      fontSize: '0.88rem',
      marginBottom: 3,
      position: 'relative',
      transition: 'background-color 0.15s ease',
      minHeight: 42
    };
  };

  // Indicador de sección activa: un solo color para todo el sistema.
  const IndicadorActivo = () => (
    <span style={{
      position: 'absolute', left: isCollapsed ? 6 : 0, top: '50%', transform: 'translateY(-50%)',
      width: 3, height: 20, borderRadius: '0 3px 3px 0', background: '#fff'
    }} />
  );

  const initial = (usuarioActivo?.nombre?.[0] || usuarioActivo?.username?.[0] || 'U').toUpperCase();

  return (
    <nav style={{
      position: 'fixed',
      left: 0, top: 0, bottom: 0,
      width: isCollapsed ? 76 : 248,
      transition: 'width 0.25s ease',
      padding: isCollapsed ? '18px 10px' : '18px 14px',
      zIndex: 1000,
      background: SUPERFICIE_MARCA.bg,
      borderRight: SUPERFICIE_MARCA.borde,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Marca */}
      <button
        onClick={() => setActiveTab('inicio')}
        title="Pueblos del Mundo"
        style={{
          background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
          gap: 10, padding: isCollapsed ? 0 : '4px', justifyContent: isCollapsed ? 'center' : 'flex-start', marginBottom: 14
        }}
      >
        <span style={{
          background: 'rgba(255,255,255,0.14)',
          borderRadius: 12, padding: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)'
        }}>
          <Image src={logoControlCel} alt="Logo" width={26} height={26} style={{ objectFit: 'contain' }} />
        </span>
        {!isCollapsed && (
          <span style={{ textAlign: 'left', minWidth: 0 }}>
            <span style={{ color: '#fff', fontSize: '0.92rem', lineHeight: 1.15, display: 'block', fontWeight: 800 }}>Pueblos del Mundo</span>
            <span style={{ fontSize: '0.6rem', color: SUPERFICIE_MARCA.textoTenue, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>Sistema de Gestión</span>
          </span>
        )}
      </button>

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        style={{
          background: 'rgba(255,255,255,0.10)', border: 'none', color: '#fff', cursor: 'pointer',
          width: '100%', height: 34, borderRadius: 10, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8, marginBottom: 12, fontSize: '0.75rem'
        }}
      >
        <Icono.ChevronLeft size={14} className={isCollapsed ? 'rotado' : ''} />
        {!isCollapsed && <span>MINIMIZAR</span>}
      </button>

      {/* Navegación */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', marginBottom: 8 }}>
        {secciones.map((sec) => (
          <div key={sec.label} style={{ marginBottom: 6 }}>
            {!isCollapsed && (
              <div style={{ fontSize: '0.6rem', color: SUPERFICIE_MARCA.textoTenue, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '12px 12px 6px' }}>
                {sec.label}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {sec.items.map((tab) => {
                const I = Icono[tab.icono];
                const activo = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onMouseEnter={() => setHoveredTab(tab.key)}
                    onMouseLeave={() => setHoveredTab(null)}
                    onClick={() => setActiveTab(tab.key)}
                    title={isCollapsed ? tab.label : undefined}
                    aria-current={activo ? 'page' : undefined}
                    style={navButtonStyle(tab.key)}
                  >
                    {activo && <IndicadorActivo />}
                    <I size={19} />
                    {!isCollapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Usuario + tema */}
      <div style={{ borderTop: SUPERFICIE_MARCA.borde, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!isCollapsed && usuarioActivo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.08)' }}>
            <span style={{
              width: 30, height: 30, borderRadius: '50%', background: '#fff', color: '#4f46e5', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0
            }}>{initial}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {usuarioActivo.nombre || usuarioActivo.username}
              </span>
              <span style={{ color: SUPERFICIE_MARCA.textoTenue, fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {usuarioActivo.username === 'admin' ? 'Administrador' : 'Usuario'}
              </span>
            </span>
          </div>
        )}

        <button
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          style={{
            width: '100%', padding: '10px', borderRadius: 12, border: SUPERFICIE_MARCA.borde,
            background: 'rgba(255,255,255,0.10)', color: '#fff', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600, fontSize: '0.78rem'
          }}
        >
          {darkMode ? <Icono.Sol size={16} /> : <Icono.Luna size={16} />}
          {!isCollapsed && (darkMode ? 'Modo claro' : 'Modo oscuro')}
        </button>
      </div>
    </nav>
  );
}