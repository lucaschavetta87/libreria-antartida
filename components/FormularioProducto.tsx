"use client";
import React from 'react';

export default function FormularioProducto({ 
  form, setForm, editando, resetForm, guardar, subiendoImagen,
  imagenArchivo, setImagenArchivo, fileInputRef, isMobile, theme, darkMode, inputStyle, btnBaseStyle, CATEGORIAS 
}: any) {
  return (
    <div style={{
      backgroundColor: theme.card, 
      borderRadius: '20px', 
      padding: isMobile ? '15px 0' : '20px 0', // Reducido el padding vertical ahora que es plano
      width: '100%',
      maxWidth: isMobile ? '100%' : '1000px', // 🔥 Limita el ancho del formulario en desktop para que no se estire al infinito
      border: `1px solid ${theme.border}`
    }}>
      <h3 style={{ color: editando ? '#ed8936' : '#3b82f6', marginBottom: '20px', fontWeight: '800', fontSize: '1.2rem', letterSpacing: '0.02em' }}>
        {editando ? '✏️ EDITANDO PRODUCTO MULTIPRECIO' : '➕ NUEVO PRODUCTO'}
      </h3>
      
      <form onSubmit={guardar} style={{ display: 'flex', gap: '18px', flexDirection: 'column' }}>
        
        {/* FILA 1: Código y Nombre */}
        <div style={{ display: 'flex', gap: '12px', flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{ flex: isMobile ? '1' : '0 0 280px' }}> {/* 🔥 El campo código ahora es más corto y fijo en desktop */}
            <input type="text" placeholder="Código / Barras" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <input type="text" placeholder="Nombre del Producto" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required style={inputStyle} />
          </div>
        </div>

        {/* FILA 2: Bloque de precios en grilla */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: theme.subtext, fontWeight: '800', display: 'block', marginBottom: '4px', letterSpacing: '0.02em' }}>COSTO ($)</label>
            <input type="number" step="any" placeholder="0.00" value={form.precio_costo} onChange={e => setForm({ ...form, precio_costo: e.target.value })} required style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: theme.subtext, fontWeight: '800', display: 'block', marginBottom: '4px', letterSpacing: '0.02em' }}>IVA ($)</label>
            <input type="number" step="any" placeholder="0.00" value={form.precio_iva} onChange={e => setForm({ ...form, precio_iva: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#8b5cf6', fontWeight: '800', display: 'block', marginBottom: '4px', letterSpacing: '0.02em' }}>MAYORISTA ($)</label>
            <input type="number" step="any" placeholder="0.00" value={form.precio_mayorista} onChange={e => setForm({ ...form, precio_mayorista: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '800', display: 'block', marginBottom: '4px', letterSpacing: '0.02em' }}>MINORISTA ($)</label>
            <input type="number" step="any" placeholder="0.00" value={form.precio_minorista} onChange={e => setForm({ ...form, precio_minorista: e.target.value })} required style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#f43f5e', fontWeight: '800', display: 'block', marginBottom: '4px', letterSpacing: '0.02em' }}>PROMO MASIVA</label>
            <input type="text" placeholder="Ej: 2x3900" value={form.precio_promo} onChange={e => setForm({ ...form, precio_promo: e.target.value })} style={inputStyle} />
          </div>
        </div>

        {/* FILA 3: Selección de Categoría */}
        <div style={{ width: '100%', maxWidth: isMobile ? '100%' : '400px' }}> {/* 🔥 Evitamos que el select ocupe toda la pantalla */}
          <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={inputStyle}>
            {CATEGORIAS.map((cat: any) => <option key={cat.id} value={cat.id}>✨ {cat.label}</option>)}
          </select>
        </div>

        {/* SUBIDA DE IMAGEN */}
        <div style={{ padding: '16px', borderRadius: '14px', border: `2px dashed ${darkMode ? '#334155' : '#cbd5e1'}`, backgroundColor: theme.bg }}>
          <label style={{ fontSize: '0.75rem', color: theme.subtext, fontWeight: '800', display: 'block', marginBottom: '10px', letterSpacing: '0.02em' }}>
            🖼️ IMAGEN DEL PRODUCTO (Opcional)
          </label>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: darkMode ? '#1e293b' : '#ffffff' }}>
              {imagenArchivo ? (
                <img src={URL.createObjectURL(imagenArchivo)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : form.imagen_url ? (
                <img src={form.imagen_url} alt="actual" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '1.8rem' }}>📦</span>
              )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: isMobile ? '100%' : '500px' }}>
              <label style={{ padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem', border: `1px solid #3b82f6`, color: '#3b82f6', fontWeight: '600', background: 'transparent', display: 'inline-block', textAlign: 'center', width: isMobile ? '100%' : '200px', transition: 'all 0.15s ease' }}>
                {imagenArchivo ? `📎 Cargado` : '📁 Elegir imagen'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const archivo = e.target.files?.[0] || null;
                    setImagenArchivo(archivo);
                    if (archivo) setForm({ ...form, imagen_url: '' });
                  }}
                />
              </label>

              <input
                type="url"
                placeholder="O pegá una URL de imagen..."
                value={imagenArchivo ? '' : form.imagen_url}
                disabled={!!imagenArchivo}
                onChange={e => setForm({ ...form, imagen_url: e.target.value })}
                style={{ ...inputStyle, fontSize: '0.85rem', opacity: imagenArchivo ? 0.4 : 1 }}
              />

              {(imagenArchivo || form.imagen_url) && (
                <button
                  type="button"
                  onClick={() => { setImagenArchivo(null); setForm({ ...form, imagen_url: '' }); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', padding: 0, fontWeight: '600' }}
                >
                  ✕ Quitar imagen
                </button>
              )}
            </div>
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start', marginTop: '4px' }}>
          <button type="submit" disabled={subiendoImagen} style={{ ...btnBaseStyle, backgroundColor: editando ? '#ed8936' : '#3b82f6', opacity: subiendoImagen ? 0.7 : 1, padding: '12px 32px' }}>
            {subiendoImagen ? '⏳ SUBIENDO...' : editando ? 'ACTUALIZAR' : 'GUARDAR PRODUCTO'}
          </button>
          {editando && <button type="button" onClick={resetForm} style={{ ...btnBaseStyle, backgroundColor: '#475569', padding: '12px 24px' }}>CANCELAR</button>}
        </div>
      </form>
    </div>
  );
}