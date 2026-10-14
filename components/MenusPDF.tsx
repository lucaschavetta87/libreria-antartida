"use client";
import React, { useEffect, useRef, useState } from 'react';

type Ruta = { cat: string; sub: string | null; subsub?: string | null };

type OpcionExtra = { label: string; onClick: () => void };

type Carpeta = { id: string; label: string };
type SubCarpeta = { key: string; label: string; count?: number };
type ConteoCategoria = { total?: number };

// Menú desplegable para generar PDFs: muestra primero las categorías principales
// y después las demás. Con mostrarSubs=true también despliega subcategorías y
// sub-subcategorías para imprimir solo lo elegido.
export default function MenuBotonCategorias({
  darkMode, label, icono = '🖨️', colorBoton = '#7c3aed', categorias = [], principalesIds = [],
  mostrarSubs = true, subsDe, subsubsDe, conteos = {}, extra = null, onElegir, btnBaseStyle,
  accionCarpeta = 'Imprimir todos los códigos de', accionRuta = 'Imprimir los códigos de', menuStyle
}: {
  darkMode: boolean;
  label: string;
  icono?: string;
  colorBoton?: string;
  categorias: Carpeta[];
  principalesIds: string[];
  mostrarSubs?: boolean;
  subsDe?: (catId: string) => SubCarpeta[];
  subsubsDe?: (catId: string, subKey: string) => SubCarpeta[];
  conteos?: Record<string, ConteoCategoria>;
  extra?: OpcionExtra | null;
  onElegir: (ruta: Ruta) => void;
  btnBaseStyle?: React.CSSProperties;
  accionCarpeta?: string;
  accionRuta?: string;
  /** Ajuste del panel desplegable (en celular se ancla al ancho de la pantalla). */
  menuStyle?: React.CSSProperties;
}) {
  const [abierto, setAbierto] = useState(false);
  const [expCats, setExpCats] = useState<Record<string, boolean>>({});
  const [expSubs, setExpSubs] = useState<Record<string, boolean>>({});
  const [mostrarOtras, setMostrarOtras] = useState(false);
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
    hover: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
    input: darkMode ? '#0f172a' : '#ffffff'
  };

  const principales = categorias.filter(c => principalesIds.includes(String(c.id).toLowerCase()));
  const principalesOrdenadas = principalesIds
    .map(id => principales.find(c => String(c.id).toLowerCase() === id))
    .filter((c): c is Carpeta => Boolean(c));
  const otras = categorias.filter(c => !principalesIds.includes(String(c.id).toLowerCase()));

  const elegir = (ruta: Ruta) => { setAbierto(false); onElegir(ruta); };

  const estiloFila = (id: string, nivel = 0): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '7px',
    padding: `7px 8px`,
    borderRadius: '8px', cursor: 'pointer', userSelect: 'none',
    fontSize: nivel === 0 ? '0.88rem' : '0.84rem',
    fontWeight: nivel === 0 ? 700 : 500,
    color: t.text,
    backgroundColor: hover === id ? t.hover : 'transparent'
  });

  const chevron = (id: string, abiertoCat: boolean, alternar: () => void) => (
    <span
      onClick={(e) => { e.stopPropagation(); alternar(); }}
      style={{ width: '14px', flexShrink: 0, fontSize: '0.62rem', color: t.subtext, cursor: 'pointer', textAlign: 'center' }}
    >
      {abiertoCat ? '▼' : '▶'}
    </span>
  );

  const conteoCat = (catId: string) => conteos[catId]?.total ?? 0;
  const conteoSub = (catId: string, subKey: string) => {
    if (!mostrarSubs || !subsDe) return 0;
    return subsDe(catId).find(s => s.key === subKey)?.count ?? 0;
  };

  const renderCarpeta = (cat: Carpeta) => {
    const catId = String(cat.id).toLowerCase();
    const expandida = !!expCats[catId];
    const subs = mostrarSubs && subsDe ? subsDe(catId) : [];

    return (
      <div key={catId}>
        <div
          onClick={() => elegir({ cat: catId, sub: null, subsub: null })}
          onMouseEnter={() => setHover(catId)}
          onMouseLeave={() => setHover(null)}
          style={estiloFila(catId)}
          title={`${accionCarpeta} ${cat.label}`}
        >
          {mostrarSubs && subs.length > 0
            ? chevron(catId, expandida, () => setExpCats(p => ({ ...p, [catId]: !expandida })))
            : <span style={{ width: '14px', flexShrink: 0 }} />}
          <span>{expandida ? '📂' : '📁'}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.label}</span>
          <span style={{ fontSize: '0.72rem', color: t.subtext, fontWeight: 600 }}>{conteoCat(catId)}</span>
        </div>

        {expandida && subs.map((s: SubCarpeta) => {
          const keySub = `${catId}|${s.key}`;
          const subAbierta = !!expSubs[keySub];
          const hijos = subsubsDe ? subsubsDe(catId, s.key) : [];
          return (
            <div key={keySub}>
              <div
                onClick={() => elegir({ cat: catId, sub: s.key, subsub: null })}
                onMouseEnter={() => setHover(keySub)}
                onMouseLeave={() => setHover(null)}
                style={{ ...estiloFila(keySub, 1), borderLeft: `2px solid ${t.border}`, borderRadius: '0 8px 8px 0' }}
                title={`${accionRuta} ${s.label}`}
              >
                {hijos.length > 0
                  ? chevron(keySub, subAbierta, () => setExpSubs(p => ({ ...p, [keySub]: !subAbierta })))
                  : <span style={{ width: '14px', flexShrink: 0 }} />}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↳ {s.label}</span>
                <span style={{ fontSize: '0.72rem', color: t.subtext, fontWeight: 600 }}>{conteoSub(catId, s.key)}</span>
              </div>

              {subAbierta && hijos.map((h: SubCarpeta) => {
                const keyHijo = `${keySub}|${h.key}`;
                return (
                  <div
                    key={keyHijo}
                    onClick={() => elegir({ cat: catId, sub: s.key, subsub: h.key })}
                    onMouseEnter={() => setHover(keyHijo)}
                    onMouseLeave={() => setHover(null)}
                    style={{ ...estiloFila(keyHijo, 2), borderLeft: `2px solid ${t.border}`, borderRadius: '0 8px 8px 0' }}
                    title={`${accionRuta} ${h.label}`}
                  >
                    <span style={{ width: '14px', flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>↳↳ {h.label}</span>
                    <span style={{ fontSize: '0.7rem', color: t.subtext, fontWeight: 600 }}>{h.count ?? 0}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const encabezado = (texto: string) => (
    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: t.subtext, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 8px 4px' }}>
      {texto}
    </div>
  );

  return (
    <div ref={contenedorRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setAbierto(v => !v)}
        style={{ ...(btnBaseStyle || {}), backgroundColor: colorBoton }}
      >
        {icono} {label} <span style={{ fontSize: '0.7rem' }}>{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 4000,
          minWidth: '330px', maxWidth: '440px', maxHeight: '72vh', overflowY: 'auto',
          backgroundColor: t.card, border: `1px solid ${t.border}`, borderRadius: '16px',
          boxShadow: '0 20px 45px rgba(0,0,0,0.35)', padding: '6px 6px 10px',
          textAlign: 'left'
        }}>
          {extra && (
            <>
              <div style={{ padding: '4px 4px 2px' }}>
                <div
                  onClick={() => { setAbierto(false); extra.onClick(); }}
                  onMouseEnter={() => setHover('__extra')}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    ...estiloFila('__extra'), backgroundColor: hover === '__extra' ? t.hover : (darkMode ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.1)'),
                    border: `1px solid #10b981`, color: '#059669'
                  }}
                >
                  <span style={{ width: '14px', flexShrink: 0 }} />
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{extra.label}</span>
                </div>
              </div>
              <div style={{ height: '1px', backgroundColor: t.border, margin: '6px 4px' }} />
            </>
          )}

          {principalesOrdenadas.length > 0 && encabezado('Marcas principales')}
          {principalesOrdenadas.map(renderCarpeta)}

          {otras.length > 0 && (
            <>
              <div
                onClick={() => setMostrarOtras(v => !v)}
                onMouseEnter={() => setHover('__otras')}
                onMouseLeave={() => setHover(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 8px',
                  cursor: 'pointer', fontSize: '0.72rem', fontWeight: 800, color: t.subtext,
                  textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: '8px',
                  backgroundColor: hover === '__otras' ? t.hover : 'transparent'
                }}
              >
                <span style={{ width: '14px', fontSize: '0.62rem' }}>{mostrarOtras ? '▼' : '▶'}</span>
                Otras categorías ({otras.length})
              </div>
              {mostrarOtras && otras.map(renderCarpeta)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
