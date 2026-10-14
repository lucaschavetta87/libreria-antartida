"use client";
import React, { useEffect, useRef, useState } from 'react';

export type OpcionesCatalogoCompleto = {
  incluirSinStock: boolean;
  incluirVariedades: boolean;
  incluirCodigos: boolean;
};

type Props = {
  darkMode: boolean;
  btnBaseStyle?: React.CSSProperties;
  totalProductos: number;
  opciones: OpcionesCatalogoCompleto;
  setOpciones: (o: OpcionesCatalogoCompleto) => void;
  generandoPdf?: boolean;
  generandoExcel?: boolean;
  onPdf: () => void;
  onExcel: () => void;
};

// Botón "Catálogo Mayorista Completo": a diferencia del menú por carpeta,
// este genera TODO el listado de productos en una sola descarga (PDF o Excel),
// agrupado por categoría / subcategoría / sub-subcategoría.
export default function MenuCatalogoCompleto({
  darkMode, btnBaseStyle, totalProductos, opciones, setOpciones,
  generandoPdf, generandoExcel, onPdf, onExcel
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const alClickear = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setAbierto(false);
    };
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', alClickear);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alClickear);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  const t = {
    card: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f8fafc' : '#0f172a',
    subtext: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    hover: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'
  };

  const ocupado = !!generandoPdf || !!generandoExcel;
  const textoBoton = ocupado
    ? (generandoPdf ? '📄 Generando PDF...' : '📊 Generando Excel...')
    : '📚 CATÁLOGO MAYORISTA COMPLETO';

  const opcion = (key: keyof OpcionesCatalogoCompleto, texto: string) => (
    <label
      key={key}
      onMouseEnter={() => setHover(key)}
      onMouseLeave={() => setHover(null)}
      style={{
        display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 8px',
        borderRadius: '8px', cursor: 'pointer',
        backgroundColor: hover === key ? t.hover : 'transparent',
        color: t.text, fontSize: '0.83rem', fontWeight: 500
      }}
    >
      <input
        type="checkbox"
        checked={opciones[key]}
        onChange={(e) => setOpciones({ ...opciones, [key]: e.target.checked })}
        style={{ width: '15px', height: '15px', accentColor: '#ef4444', cursor: 'pointer' }}
      />
      {texto}
    </label>
  );

  const accion = (id: string, icono: string, texto: string, color: string, fn: () => void, deshabilitado = false) => (
    <div
      key={id}
      onClick={() => { if (deshabilitado) return; setAbierto(false); fn(); }}
      onMouseEnter={() => setHover(id)}
      onMouseLeave={() => setHover(null)}
      style={{
        display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 10px',
        borderRadius: '9px', cursor: deshabilitado ? 'not-allowed' : 'pointer',
        backgroundColor: hover === id && !deshabilitado ? t.hover : 'transparent',
        color: deshabilitado ? t.subtext : color, fontSize: '0.87rem', fontWeight: 700
      }}
    >
      <span>{icono}</span>
      <span style={{ flex: 1 }}>{texto}</span>
    </div>
  );

  return (
    <div ref={contenedorRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setAbierto(v => !v)} disabled={ocupado} style={{ ...(btnBaseStyle || {}), backgroundColor: '#b91c1c', opacity: ocupado ? 0.7 : 1 }}>
        {textoBoton} <span style={{ fontSize: '0.7rem' }}>{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 4000,
          minWidth: '330px', maxWidth: '440px',
          backgroundColor: t.card, border: `1px solid ${t.border}`, borderRadius: '16px',
          boxShadow: '0 20px 45px rgba(0,0,0,0.35)', padding: '6px 6px 10px', textAlign: 'left'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: t.subtext, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 8px 4px' }}>
            Opciones del listado
          </div>
          {opcion('incluirSinStock', 'Incluir productos sin stock')}
          {opcion('incluirVariedades', 'Incluir variedades (1 fila por variedad)')}
          {opcion('incluirCodigos', 'Incluir código de producto')}

          <div style={{ height: '1px', backgroundColor: t.border, margin: '8px 4px' }} />
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: t.subtext, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 8px' }}>
            Descargar todo el catálogo ({totalProductos} productos)
          </div>
          {accion('pdf', '📄', 'PDF completo por categorías', '#dc2626', onPdf, generandoPdf || generandoExcel)}
          {accion('excel', '📊', 'Excel completo por categorías', '#16a34a', onExcel, generandoPdf || generandoExcel)}
        </div>
      )}
    </div>
  );
}