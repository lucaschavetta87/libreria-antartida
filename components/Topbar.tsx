"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  usuarioActivo: any | null;
  stock?: any[];
  pedidosPendientes?: number;
}

type Sugerencia = { tipo: 'seccion' | 'producto'; titulo: string; detalle?: string; tab: string };

// Barra superior: es el marco fijo de la app.
// Concentra el título de la sección, el acceso rápido a todo el sistema
// (Ctrl/Cmd + K) y el menú de navegación en el celular.
export default function Topbar({ activeTab, setActiveTab, darkMode, setDarkMode, isCollapsed, usuarioActivo, stock = [], pedidosPendientes = 0 }: TopbarProps) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [paletaAbierta, setPaletaAbierta] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [resaltado, setResaltado] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const secciones = useMemo(() => filtrarSecciones(usuarioActivo), [usuarioActivo]);

  const sugerencias = useMemo<Sugerencia[]>(() => {
    const navegables: Sugerencia[] = secciones.flatMap((sec) =>
      sec.items.map((it) => ({ tipo: 'seccion' as const, titulo: it.label, detalle: sec.label, tab: it.key }))
    );
    if (!consulta.trim()) return navegables;

    const q = consulta.trim().toLowerCase();
    const seccionesFiltradas = navegables.filter((s) => s.titulo.toLowerCase().includes(q));
    const productos = (stock || [])
      .filter((p: any) => {
        const nombre = String(p.nombre || '').toLowerCase();
        const codigo = String(p.codigo || '').toLowerCase();
        return nombre.includes(q) || codigo.includes(q);
      })
      .slice(0, 6)
      .map((p: any) => ({
        tipo: 'producto' as const,
        titulo: String(p.nombre || ''),
        detalle: p.codigo ? `Código ${p.codigo}` : 'Producto',
        tab: 'stock'
      }));
    return [...seccionesFiltradas, ...productos];
  }, [consulta, secciones, stock]);

  // Ctrl/Cmd + K abre la paleta desde cualquier pantalla
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletaAbierta(true);
        setTimeout(() => inputRef.current?.focus(), 30);
      }
      if (e.key === 'Escape') { setPaletaAbierta(false); setMenuAbierto(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setResaltado(0); }, [consulta]);

  const irA = (tab: string) => {
    setActiveTab(tab);
    setPaletaAbierta(false);
    setMenuAbierto(false);
    setConsulta('');
  };

  const onKeyPaleta = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setResaltado((i) => Math.min(i + 1, sugerencias.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setResaltado((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && sugerencias[resaltado]) { e.preventDefault(); irA(sugerencias[resaltado].tab); }
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
          left: isCollapsed ? 76 : 248,
          right: 0,
          height: 62,
          zIndex: 900,
          background: superficie,
          borderBottom: `1px solid ${borde}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '0 18px'
        }}
      >
        {/* Lado izquierdo: en celular abre el menú */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            className="solo-movil"
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

        {/* Buscador: en escritorio visible, en celular botón que abre la paleta */}
        <button
          onClick={() => { setPaletaAbierta(true); setTimeout(() => inputRef.current?.focus(), 30); }}
          aria-label="Buscar en el sistema"
          title="Buscar (Ctrl + K)"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, flex: '0 1 340px',
            background: darkMode ? '#0f172a' : '#f8fafc',
            border: `1px solid ${borde}`, borderRadius: 999, padding: '9px 14px',
            color: subtexto, cursor: 'pointer', fontSize: '0.85rem', minHeight: 40
          }}
        >
          <Icono.Buscar size={16} />
          <span className="solo-escritorio" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Buscar productos o secciones...
          </span>
          <kbd className="solo-escritorio" style={{
            marginLeft: 'auto', fontSize: '0.68rem', border: `1px solid ${borde}`, borderRadius: 6,
            padding: '2px 6px', color: subtexto, fontFamily: 'inherit'
          }}>Ctrl K</kbd>
        </button>

        {/* Acciones rápidas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => irA('ventas')}
            className="solo-escritorio"
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10,
              border: 'none', background: 'linear-gradient(180deg,#4f46e5 0%,#4338ca 100%)', color: '#fff',
              fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', minHeight: 40
            }}
          >
            <Icono.Agregar size={15} />
            Nueva venta
          </button>

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

      {/* ================= PALETA DE COMANDOS (Ctrl/Cmd + K) ================= */}
      {paletaAbierta && (
        <div
          onClick={() => setPaletaAbierta(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200, background: darkMode ? 'rgba(2,6,23,0.7)' : 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 16px 16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560, background: superficie, border: `1px solid ${borde}`,
              borderRadius: 18, boxShadow: '0 30px 70px rgba(0,0,0,0.45)', overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${borde}` }}>
              <Icono.Buscar size={18} />
              <input
                ref={inputRef}
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                onKeyDown={onKeyPaleta}
                placeholder="Buscar secciones o productos..."
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '1rem', padding: 0 }}
              />
              <button onClick={() => setPaletaAbierta(false)} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', color: subtexto, cursor: 'pointer' }}>
                <Icono.Cerrar size={18} />
              </button>
            </div>

            <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: 6 }}>
              {sugerencias.length === 0 && (
                <p style={{ padding: '22px', textAlign: 'center', color: subtexto, margin: 0, fontSize: '0.88rem' }}>
                  Sin resultados para “{consulta}”
                </p>
              )}
              {sugerencias.map((s, i) => (
                <button
                  key={`${s.tipo}-${s.titulo}-${i}`}
                  onClick={() => irA(s.tab)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
                    padding: '11px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: i === resaltado ? (darkMode ? 'rgba(79,70,229,0.18)' : 'rgba(79,70,229,0.08)') : 'transparent',
                    color: texto
                  }}
                >
                  <span style={{
                    width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: s.tipo === 'producto' ? '#8b5cf6' : '#4f46e5', flexShrink: 0
                  }}>
                    {s.tipo === 'producto' ? <Icono.Etiqueta size={16} /> : <Icono.Menu size={16} />}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.titulo}</span>
                    {s.detalle && <span style={{ display: 'block', fontSize: '0.72rem', color: subtexto, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.detalle}</span>}
                  </span>
                  {i === resaltado && <span style={{ fontSize: '0.68rem', color: subtexto }}>↵</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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