"use client";
import React, { useState } from 'react';
import ModalGenerico from './ModalGenerico';

export default function ModificadoresMasivos({
  darkMode, isMobile, theme, inputStyle, btnBaseStyle, CATEGORIAS,
  catAumentar, setCatAumentar, columnaAumentar, setColumnaAumentar, COLUMNAS_PRECIO,
  porcentajeAumento, setPorcentajeAumento, actualizandoGlobal, ejecutarAumentoGlobal,
  nuevaCategoriaMasiva, setNuevaCategoriaMasiva, seleccionados, actualizandoCategoriaMasiva, ejecutarModificacionCategoriaMasiva,
  onAbrirGestionCategorias
}: any) {
  const [mostrarModalPrecios, setMostrarModalPrecios] = useState(false);
  const [mostrarModalCategoriaMasiva, setMostrarModalCategoriaMasiva] = useState(false);

  const labelStyle: React.CSSProperties = { fontSize: '0.72rem', color: theme.subtext, fontWeight: 'bold', display: 'block', marginBottom: '4px' };

  const botonCuadroStyle = (color: string): React.CSSProperties => ({
    flex: 1, padding: '18px', backgroundColor: darkMode ? '#151f32' : '#f8fafc', borderRadius: '15px',
    borderStyle: 'dashed', borderWidth: '2px', borderColor: color, cursor: 'pointer', textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: '4px', transition: 'filter 0.15s ease'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>

      {/* Acceso a gestión de categorías */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onAbrirGestionCategorias} style={{ background: darkMode ? 'rgba(255,255,255,0.04)' : '#f1f5f9', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: '999px', color: theme.text, cursor: 'pointer', padding: '8px 16px', fontSize: '0.82rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          🗂️ Gestionar categorías
        </button>
      </div>

      {/* Botones que abren los modales (mismos colores/bordes que las cajas originales) */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px' }}>
        <button type="button" onClick={() => setMostrarModalPrecios(true)} style={botonCuadroStyle('#8b5cf6')}>
          <h4 style={{ margin: 0, color: '#8b5cf6', fontWeight: '800', fontSize: '1rem' }}>⚡ Modificador Masivo de Precios</h4>
          <span style={{ fontSize: '0.78rem', color: theme.subtext }}>Ajustar precios por categoría y columna</span>
        </button>

        <button type="button" onClick={() => setMostrarModalCategoriaMasiva(true)} style={botonCuadroStyle('#0ea5e9')}>
          <h4 style={{ margin: 0, color: '#0ea5e9', fontWeight: '800', fontSize: '1rem' }}>📦 Cambiar Categoría a Seleccionados ({seleccionados.length})</h4>
          <span style={{ fontSize: '0.78rem', color: theme.subtext }}>Mover productos seleccionados a otra categoría</span>
        </button>
      </div>

      {/* Modal: Modificador Masivo de Precios */}
      {mostrarModalPrecios && (
        <ModalGenerico titulo="⚡ Modificador Masivo de Precios" darkMode={darkMode} onClose={() => setMostrarModalPrecios(false)}>
          <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
            <div>
              <label style={labelStyle}>SELECCIONAR CATEGORÍA A AFECTAR</label>
              <select value={catAumentar} onChange={e => setCatAumentar(e.target.value)} style={inputStyle}>
                {CATEGORIAS.map((cat: any) => <option key={cat.id} value={cat.id}>✨ {cat.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>SELECCIONAR COLUMNA A MODIFICAR</label>
              <select value={columnaAumentar} onChange={e => setColumnaAumentar(e.target.value)} style={inputStyle}>
                {COLUMNAS_PRECIO.map((col: any) => <option key={col.id} value={col.id}>{col.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>% AJUSTE (Ej: 10 o -5)</label>
                <input type="number" placeholder="Ej: 15" value={porcentajeAumento} onChange={e => setPorcentajeAumento(e.target.value)} style={inputStyle} />
              </div>
              <button type="button" disabled={actualizandoGlobal} onClick={ejecutarAumentoGlobal} style={{ ...btnBaseStyle, backgroundColor: '#8b5cf6', minHeight: '45px' }}>
                {actualizandoGlobal ? 'PROCESANDO...' : 'APLICAR'}
              </button>
            </div>
          </div>
        </ModalGenerico>
      )}

      {/* Modal: Cambiar Categoría a Seleccionados */}
      {mostrarModalCategoriaMasiva && (
        <ModalGenerico titulo={`📦 Cambiar Categoría a Seleccionados (${seleccionados.length})`} darkMode={darkMode} onClose={() => setMostrarModalCategoriaMasiva(false)}>
          <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
            <div>
              <label style={labelStyle}>NUEVA CATEGORÍA DESTINO</label>
              <select value={nuevaCategoriaMasiva} onChange={e => setNuevaCategoriaMasiva(e.target.value)} style={inputStyle}>
                {CATEGORIAS.map((cat: any) => <option key={cat.id} value={cat.id}>✨ {cat.label}</option>)}
              </select>
            </div>
            <button
              type="button"
              disabled={actualizandoCategoriaMasiva || seleccionados.length === 0}
              onClick={ejecutarModificacionCategoriaMasiva}
              style={{ ...btnBaseStyle, backgroundColor: '#0ea5e9', minHeight: '45px', opacity: seleccionados.length === 0 ? 0.5 : 1 }}
            >
              {actualizandoCategoriaMasiva ? 'CAMBIANDO...' : 'CAMBIAR CATEGORÍA A SELECCIONADOS'}
            </button>
          </div>
        </ModalGenerico>
      )}
    </div>
  );
}