"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import logoControlCel from '../assets/logo.png';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  darkMode: boolean;
  setDarkMode: (val: any) => void;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  usuarioActivo: any | null; // 🔥 PROP AGREGADA: Para leer los permisos del usuario activo
}

export default function Navbar({ activeTab, setActiveTab, darkMode, setDarkMode, isCollapsed, setIsCollapsed, usuarioActivo }: NavbarProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Detectar tamaño de pantalla para activar modo responsive
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setMobileMenuOpen(false); // Resetear estado si vuelve a desktop
    };

    handleResize(); // Ejecución inicial
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- FUNCIÓN HELPER: Valida si la sección debe mostrarse según permisos ---
  const tienePermiso = (tabKey: string) => {
    if (!usuarioActivo) return false;
    if (usuarioActivo.username === 'admin') return true; // Acceso total irrestricto
    return usuarioActivo.permisos.includes(tabKey);
  };

  // Estilo para los botones de navegación
  const navButtonStyle = (tabName: string): React.CSSProperties => {
    const isActive = activeTab === tabName;
    const isHovered = hoveredTab === tabName;
    const esMayorista = tabName === 'ventas_mayoristas';
    const esUsuarios = tabName === 'usuarios';
    const esPedidos = tabName === 'pedidos_web'; // Destacar pedidos si se quiere

    return {
      width: '100%',
      padding: '12px 14px',
      borderRadius: '12px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: (isCollapsed && !isMobile) ? '0' : '12px',
      transition: 'all 0.2s ease',
      backgroundColor: isActive 
        ? '#ffffff' 
        : (isHovered ? 'rgba(255, 255, 255, 0.15)' : 'transparent'),
      color: isActive 
        ? (esMayorista ? '#8b5cf6' : (esUsuarios ? '#8b5cf6' : (esPedidos ? '#10b981' : '#4f46e5'))) 
        : '#e0e7ff',
      border: isActive && (esMayorista || esUsuarios || esPedidos) ? `1px solid ${esPedidos ? '#10b981' : '#8b5cf6'}` : 'none',
      fontWeight: isActive ? '700' : '500',
      justifyContent: (isCollapsed && !isMobile) ? 'center' : 'flex-start',
      marginBottom: '4px',
      fontSize: '0.9rem'
    };
  };

  const menuBackground = darkMode 
    ? 'linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)' 
    : 'linear-gradient(180deg, #4f46e5 0%, #6366f1 100%)';

  // Array maestro de rutas para mapeo dinámico simplificado y seguro
  const rutasBase = [
    { key: 'inicio', label: 'Inicio', icon: '🏠' },
    { key: 'ventas', label: 'Venta Minorista 🍏', icon: '💰' },
    { key: 'ventas_mayoristas', label: 'Venta Mayorista 🏢', icon: '📦' },
    { key: 'pedidos_web', label: 'Pedidos Web', icon: '🛒' }, // NUEVO BOTÓN
    { key: 'stock', label: 'Inventario', icon: '🧸' },
    { key: 'clientes', label: 'Cuenta Corriente', icon: '💳' },
    { key: 'caja', label: 'Cierre de Caja', icon: '📊' },
    { key: 'portada_web', label: 'Control Portada', icon: '🖼️' },
  ];

  // Secciones agrupadas para el modo escritorio
  const secciones = [
    {
      label: 'Operaciones',
      items: [
        { key: 'inicio', label: 'Inicio', icon: '🏠' },
        { key: 'ventas', label: 'Venta Minorista', icon: '🍏' },
        { key: 'ventas_mayoristas', label: 'Venta Mayorista', icon: '📦' },
        { key: 'pedidos_web', label: 'Pedidos Web', icon: '🛒' },
      ],
    },
    {
      label: 'Comercial',
      items: [
        { key: 'stock', label: 'Productos', icon: '📦' },
        { key: 'clientes', label: 'Cuenta Corriente', icon: '💳' },
        { key: 'caja', label: 'Cierre de Caja', icon: '📊' },
      ],
    },
    {
      label: 'Seguridad',
      adminOnly: true,
      items: [{ key: 'usuarios', label: 'Gestión Usuarios', icon: '👥' }],
    },
    {
      label: 'Web',
      alwaysVisible: true,
      items: [
        { key: 'pagina_web', label: 'Página Web', icon: '🌐' },
        { key: 'portada_web', label: 'Control Portada', icon: '🖼️' },
      ],
    },
  ];

  // --- MODO RESPONSIVE CELULAR ---
  if (isMobile) {
    return (
      <>
        {/* BOTÓN TRIPLE PUNTO FLOTANTE (ESTADO COMPACTO) */}
        {!mobileMenuOpen && (
          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{
              position: 'fixed',
              top: '16px',
              right: '16px',
              width: '45px',
              height: '45px',
              borderRadius: '12px',
              background: menuBackground,
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              zIndex: 1100,
              fontSize: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
          >
            ⋮
          </button>
        )}

        {/* MENÚ EXTENDIDO HAMBURGUESA */}
        {mobileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              top: '16px',
              left: '16px',
              right: '16px',
              background: menuBackground,
              borderRadius: '20px',
              padding: '20px',
              zIndex: 1100,
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '15px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Image src={logoControlCel} alt="Logo" width={30} height={30} style={{ objectFit: 'contain' }} />
                <h1 style={{ color: '#fff', fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>Pueblos del Mundo</h1>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.3rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>

            {/* Listado de pestañas con filtros en Celular */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {rutasBase.filter(t => tienePermiso(t.key)).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setMobileMenuOpen(false);
                  }}
                  style={navButtonStyle(tab.key)}
                >
                  <span>{tab.icon}</span> {tab.label}
                </button>
              ))}

              {/* 🔥 GESTIÓN DE USUARIOS MÓVIL (EXCLUSIVO ADMIN) */}
              {usuarioActivo?.username === 'admin' && (
                <button
                  onClick={() => {
                    setActiveTab('usuarios');
                    setMobileMenuOpen(false);
                  }}
                  style={navButtonStyle('usuarios')}
                >
                  <span>👥</span> Gestión Usuarios
                </button>
              )}

              {/* 🌐 PÁGINA WEB MÓVIL (VISIBLE PARA TODOS) */}
              <button
                onClick={() => {
                  setActiveTab('pagina_web');
                  setMobileMenuOpen(false);
                }}
                style={navButtonStyle('pagina_web')}
              >
                <span>🌐</span> Página Web
              </button>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', marginTop: '5px' }}>
              <button onClick={() => setDarkMode(!darkMode)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
                {darkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // --- MODO ESCRITORIO ---
  const toggleBtnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    width: '28px',
    height: '28px',
    borderRadius: '9px',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '0.62rem',
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '800',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    margin: '14px 0 6px 10px',
  };

  const initial = (usuarioActivo?.nombre?.[0] || usuarioActivo?.username?.[0] || 'U').toUpperCase();

  return (
    <nav style={{
      position: 'fixed',
      left: '0px',
      top: '0px',
      bottom: '0px',
      width: isCollapsed ? '72px' : '250px',
      transition: 'width 0.3s ease',
      padding: isCollapsed ? '18px 10px' : '20px 14px',
      zIndex: 1000,
      background: menuBackground,
      borderRight: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '6px 0 24px -12px rgba(0,0,0,0.35)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Encabezado: logo + branding + colapsar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', marginBottom: '6px' }}>
        <button
          onClick={() => setActiveTab('inicio')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', padding: isCollapsed ? '0' : '4px' }}
        >
          <span style={{
            background: 'rgba(255,255,255,0.12)',
            borderRadius: '12px',
            padding: '7px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)'
          }}>
            <Image src={logoControlCel} alt="Logo" width={26} height={26} style={{ objectFit: 'contain' }} />
          </span>
          {!isCollapsed && (
            <span style={{ textAlign: 'left' }}>
              <h1 style={{ color: '#fff', fontSize: '0.95rem', lineHeight: '1.15', margin: 0, fontWeight: 800 }}>Pueblos del Mundo</h1>
              <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.6px', textTransform: 'uppercase', fontWeight: 700 }}>Sistema de Gestión</span>
            </span>
          )}
        </button>

        {!isCollapsed && (
          <button onClick={() => setIsCollapsed(true)} style={toggleBtnStyle} title="Colapsar menú">
            ◂
          </button>
        )}
      </div>

      {isCollapsed && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 4px' }}>
          <button onClick={() => setIsCollapsed(false)} style={toggleBtnStyle} title="Expandir menú">
            ▸
          </button>
        </div>
      )}

      {/* Navegación agrupada por secciones */}
      <div style={{ flex: 1, overflowY: 'auto', marginTop: '10px' }}>
        {secciones.map((sec) => {
          const items = sec.items.filter((it) => sec.adminOnly ? usuarioActivo?.username === 'admin' : (sec.alwaysVisible ? true : tienePermiso(it.key)));
          if (items.length === 0) return null;
          return (
            <div key={sec.label}>
              {!isCollapsed && <div style={sectionTitleStyle}>{sec.label}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {items.map((tab) => (
                  <button
                    key={tab.key}
                    onMouseEnter={() => setHoveredTab(tab.key)}
                    onMouseLeave={() => setHoveredTab(null)}
                    onClick={() => setActiveTab(tab.key)}
                    style={navButtonStyle(tab.key)}
                  >
                    <span>{tab.icon}</span> {!isCollapsed && tab.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: usuario + modo oscuro */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {!isCollapsed && usuarioActivo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.07)' }}>
            <span style={{
              width: '30px', height: '30px', borderRadius: '50%', background: '#fff', color: '#4f46e5',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0
            }}>
              {initial}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {usuarioActivo.nombre || usuarioActivo.username}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {usuarioActivo.username === 'admin' ? 'Administrador' : 'Usuario'}
              </span>
            </span>
          </div>
        )}

        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px', fontWeight: 600, fontSize: '0.8rem' }}
        >
          <span>{darkMode ? '☀️' : '🌙'}</span> {!isCollapsed && (darkMode ? 'Modo Claro' : 'Modo Oscuro')}
        </button>
      </div>
    </nav>
  );
}