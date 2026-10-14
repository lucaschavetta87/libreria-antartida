"use client";
import React from 'react';

export default function TablaStock({
  isMobile, itemsPaginaActual, seleccionados, manejarSeleccionIndividual, setProductoSeleccionado,
  obtenerLabelCategoria, activarEdicion, borrarItem, actionBtnStyle, darkMode, theme
}: any) {
  const precioMinorista = (item: any) => {
    const variedades = Array.isArray(item.variedades) ? item.variedades : [];
    const precios = variedades.map((v: any) => Number(v.precio_minorista ?? item.precio_minorista)).filter(Number.isFinite);
    return (precios.length > 0 ? Math.min(...precios) : Number(item.precio_minorista || 0)).toLocaleString('es-AR');
  };

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {itemsPaginaActual.map((item: any) => (
          <div
            key={item.id}
            onClick={() => setProductoSeleccionado(item)}
            style={{
              padding: '16px', backgroundColor: theme.bg, borderRadius: '16px',
              border: seleccionados.includes(item.id) ? '1px solid #0ea5e9' : `1px solid ${theme.border}`, 
              display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer',
              transition: 'border-color 0.2s', position: 'relative'
            }}
          >
            <div onClick={(e) => manejarSeleccionIndividual(item.id, e)} style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, padding: '4px' }}>
              <input type="checkbox" checked={seleccionados.includes(item.id)} onChange={() => {}} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, backgroundColor: theme.card, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${theme.border}` }}>
                {item.imagen_url ? <img src={item.imagen_url} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '1.4rem' }}>📦</span>}
              </div>
              <div style={{ color: theme.text, fontWeight: '700', flex: 1, paddingRight: '25px' }}>{item.nombre}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.8rem' }}>
              <div>Costo: <strong>${item.precio_costo}</strong></div>
              <div>IVA: <strong>${item.precio_iva}</strong></div>
              <div style={{ color: '#8b5cf6' }}>May: <strong>${item.precio_mayorista}</strong></div>
              <div style={{ color: '#10b981' }}>Min: <strong>${precioMinorista(item)}</strong></div>
              <div style={{ gridColumn: 'span 2', color: theme.subtext }}>Cat: <strong>{obtenerLabelCategoria(item.categoria)}</strong></div>
              {item.precio_promo && <div style={{ color: '#f43f5e', gridColumn: 'span 2' }}>Promo: <strong>{item.precio_promo}</strong></div>}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: `1px solid ${theme.border}`, paddingTop: '10px' }}>
              <button onClick={e => { e.stopPropagation(); activarEdicion(item); }} style={actionBtnStyle('#3b82f6')}>✏️</button>
              <button onClick={e => { e.stopPropagation(); borrarItem(item.id); }} style={actionBtnStyle('#ef4444')}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="tabla-contenedor">
    <table className="tabla" style={{ minWidth: '880px' }}>
      <thead>
        <tr>
          <th style={{ width: '38px' }}></th>
          <th style={{ width: '48px' }}></th>
          <th>Producto</th>
          <th>Categoría</th>
          <th style={{ textAlign: 'right' }}>Costo</th>
          <th style={{ textAlign: 'right' }}>+IVA</th>
          <th style={{ textAlign: 'right', color: darkMode ? '#8b5cf6' : '#7c3aed' }}>Mayorista</th>
          <th style={{ textAlign: 'right', color: darkMode ? '#10b981' : '#047857' }}>Minorista</th>
          <th style={{ textAlign: 'right', color: darkMode ? '#f43f5e' : '#e11d48' }}>Promo</th>
          <th style={{ textAlign: 'right' }}>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {itemsPaginaActual.length === 0 ? (
          <tr><td colSpan={10} style={{ padding: '30px', textAlign: 'center', color: theme.subtext }}>No se encontraron productos.</td></tr>
        ) : (
          itemsPaginaActual.map((item: any) => (
            <tr
              key={item.id}
              onClick={() => setProductoSeleccionado(item)}
              style={{
                borderBottom: `1px solid ${theme.rowBorder}`, fontSize: '0.92rem', cursor: 'pointer', transition: 'background 0.15s',
                backgroundColor: seleccionados.includes(item.id) ? (darkMode ? 'rgba(14,165,233,0.08)' : 'rgba(14,165,233,0.05)') : 'transparent'
              }}
              onMouseEnter={e => { if(!seleccionados.includes(item.id)) e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255,255,255,0.03)' : '#f1f5f9' }}
              onMouseLeave={e => { if(!seleccionados.includes(item.id)) e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <td style={{ paddingLeft: '12px' }} onClick={(e) => manejarSeleccionIndividual(item.id, e)}>
                <input type="checkbox" checked={seleccionados.includes(item.id)} onChange={() => {}} style={{ width: '17px', height: '17px', cursor: 'pointer' }} />
              </td>
              <td style={{ padding: '10px 8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${theme.border}` }}>
                  {item.imagen_url ? <img src={item.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '1.1rem' }}>📦</span>}
                </div>
              </td>
              <td style={{ padding: '14px 12px', color: theme.text, fontWeight: '600', maxWidth: '260px' }}>{item.nombre}</td>
              <td style={{ color: theme.subtext, fontSize: '0.85rem' }}>{obtenerLabelCategoria(item.categoria)}</td>
              <td style={{ textAlign: 'right', color: theme.subtext }} className="precio">${Number(item.precio_costo || 0).toLocaleString('es-AR')}</td>
              <td style={{ textAlign: 'right', color: theme.subtext }} className="precio">${Number(item.precio_iva || 0).toLocaleString('es-AR')}</td>
              <td style={{ textAlign: 'right', color: darkMode ? '#8b5cf6' : '#7c3aed', fontWeight: '700' }} className="precio">${Number(item.precio_mayorista || 0).toLocaleString('es-AR')}</td>
              <td style={{ textAlign: 'right', color: darkMode ? '#10b981' : '#047857', fontWeight: '700' }} className="precio">${precioMinorista(item)}</td>
              <td style={{ textAlign: 'right', color: darkMode ? '#f43f5e' : '#e11d48', fontWeight: '700' }}>{item.precio_promo || '—'}</td>
              <td style={{ textAlign: 'right', paddingRight: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button onClick={e => { e.stopPropagation(); activarEdicion(item); }} style={actionBtnStyle('#3b82f6')}>✏️</button>
                  <button onClick={e => { e.stopPropagation(); borrarItem(item.id); }} style={actionBtnStyle('#ef4444')}>🗑️</button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
    </div>
  );
}