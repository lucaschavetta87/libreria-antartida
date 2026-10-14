"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useToast } from './ui/Avisos';

export default function ModalCategorias({ categorias, darkMode, onClose, crearCategoria, actualizarCategoria, eliminarCategoria }: any) {
  const toast = useToast();
  const { confirmar } = toast;
  const [nombreNueva, setNombreNueva] = useState('');
  const [imagenNuevaUrl, setImagenNuevaUrl] = useState('');
  const [imagenNuevaArchivo, setImagenNuevaArchivo] = useState<File | null>(null);
  const [imagenNuevaPreview, setImagenNuevaPreview] = useState('');
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEdicion, setNombreEdicion] = useState('');
  const [imagenEdicionUrl, setImagenEdicionUrl] = useState('');
  const [imagenEdicionArchivo, setImagenEdicionArchivo] = useState<File | null>(null);
  const [imagenEdicionPreview, setImagenEdicionPreview] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const inputNuevaRef = useRef<HTMLInputElement>(null);
  const inputEdicionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!imagenNuevaArchivo) {
      setImagenNuevaPreview(imagenNuevaUrl);
      return;
    }
    const previewUrl = URL.createObjectURL(imagenNuevaArchivo);
    setImagenNuevaPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imagenNuevaArchivo, imagenNuevaUrl]);

  useEffect(() => {
    if (!imagenEdicionArchivo) {
      setImagenEdicionPreview(imagenEdicionUrl);
      return;
    }
    const previewUrl = URL.createObjectURL(imagenEdicionArchivo);
    setImagenEdicionPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imagenEdicionArchivo, imagenEdicionUrl]);

  const theme = {
    card: darkMode ? '#1e293b' : '#ffffff',
    bg: darkMode ? '#0f172a' : '#f8fafc',
    text: darkMode ? '#f8fafc' : '#0f172a',
    subtext: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };

  const inputStyle: React.CSSProperties = { padding: '10px 14px', borderRadius: '10px', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, backgroundColor: theme.bg, color: theme.text, outline: 'none', fontSize: '14px', width: '100%' };
  const previewStyle: React.CSSProperties = { width: '68px', height: '68px', flexShrink: 0, overflow: 'hidden', borderRadius: '12px', backgroundColor: darkMode ? '#111827' : '#e2e8f0', border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.subtext, fontSize: '0.7rem', textAlign: 'center' };
  const smallPreviewStyle: React.CSSProperties = { width: '44px', height: '44px', flexShrink: 0, overflow: 'hidden', borderRadius: '10px', backgroundColor: darkMode ? '#111827' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.subtext, fontSize: '0.65rem' };

  const limpiarNueva = () => {
    setNombreNueva('');
    setImagenNuevaUrl('');
    setImagenNuevaArchivo(null);
    setImagenNuevaPreview('');
    if (inputNuevaRef.current) inputNuevaRef.current.value = '';
  };

  const handleCrear = async () => {
    if (!nombreNueva.trim()) return;
    setCreando(true);
    try {
      const resultado = await crearCategoria(nombreNueva, imagenNuevaArchivo, imagenNuevaUrl);
      if (resultado) limpiarNueva();
    } finally {
      setCreando(false);
    }
  };

  const iniciarEdicion = (cat: any) => {
    setEditandoId(cat.id);
    setNombreEdicion(cat.label || '');
    setImagenEdicionUrl(cat.imagen_url || '');
    setImagenEdicionArchivo(null);
    if (inputEdicionRef.current) inputEdicionRef.current.value = '';
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setNombreEdicion('');
    setImagenEdicionUrl('');
    setImagenEdicionArchivo(null);
    setImagenEdicionPreview('');
  };

  const guardarEdicion = async (id: string) => {
    if (!nombreEdicion.trim()) return;
    setGuardandoEdicion(true);
    try {
      const resultado = await actualizarCategoria(id, nombreEdicion, imagenEdicionArchivo, imagenEdicionUrl);
      if (resultado) cancelarEdicion();
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!(await confirmar({ titulo: 'Eliminar categoría', mensaje: '¿Seguro que querés eliminar esta categoría?', textoOk: 'Eliminar', peligro: true }))) return;
    setBorrandoId(id);
    await eliminarCategoria(id);
    setBorrandoId(null);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(6px)', animation: 'fadeIn 0.15s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: theme.card, borderRadius: '24px', width: '100%', maxWidth: '620px', border: `1px solid ${theme.border}`, overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.5)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '22px 24px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, color: theme.text, fontSize: '1.15rem', fontWeight: 800 }}>Gestionar Categorías</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ background: darkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: theme.text, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: darkMode ? '#3b82f6' : '#2563eb', marginBottom: '10px' }}>Nueva categoría</div>
          <input type="text" placeholder="Nombre de la categoría..." value={nombreNueva} onChange={e => setNombreNueva(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCrear(); }} style={inputStyle} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
            <div style={previewStyle}>
              {imagenNuevaPreview ? <img src={imagenNuevaPreview} alt="Vista previa de la categoría" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Sin imagen'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input ref={inputNuevaRef} type="file" accept="image/*" onChange={e => setImagenNuevaArchivo(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              <button type="button" onClick={() => inputNuevaRef.current?.click()} style={{ width: '100%', padding: '9px 12px', borderRadius: '9px', border: `1px solid ${theme.border}`, backgroundColor: darkMode ? '#1e293b' : '#ffffff', color: theme.text, fontWeight: 700, cursor: 'pointer' }}>
                {imagenNuevaArchivo ? 'Cambiar archivo' : 'Seleccionar imagen'}
              </button>
              <input type="url" placeholder="O pegá una URL de imagen..." value={imagenNuevaUrl} onChange={e => setImagenNuevaUrl(e.target.value)} style={{ ...inputStyle, marginTop: '8px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button type="button" onClick={handleCrear} disabled={creando || !nombreNueva.trim()} style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 700, cursor: creando || !nombreNueva.trim() ? 'not-allowed' : 'pointer', opacity: creando || !nombreNueva.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}>{creando ? 'Creando...' : 'Crear'}</button>
          </div>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.subtext, marginBottom: '10px' }}>Categorías existentes ({categorias.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {categorias.map((cat: any) => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '12px', backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}>
                {editandoId === cat.id ? (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={smallPreviewStyle}>
                        {imagenEdicionPreview ? <img src={imagenEdicionPreview} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Sin imagen'}
                      </div>
                      <input type="text" value={nombreEdicion} onChange={e => setNombreEdicion(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(cat.id); }} autoFocus style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
                      <button type="button" onClick={() => guardarEdicion(cat.id)} disabled={guardandoEdicion} style={{ background: '#3b82f6', border: 'none', borderRadius: '8px', color: 'white', padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>Guardar</button>
                      <button type="button" onClick={cancelarEdicion} style={{ background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: '8px', color: theme.subtext, padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>Cancelar</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input ref={inputEdicionRef} type="file" accept="image/*" onChange={e => setImagenEdicionArchivo(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                      <button type="button" onClick={() => inputEdicionRef.current?.click()} style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${theme.border}`, backgroundColor: darkMode ? '#1e293b' : '#ffffff', color: theme.text, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Seleccionar imagen</button>
                      <input type="url" placeholder="URL de imagen" value={imagenEdicionUrl} onChange={e => setImagenEdicionUrl(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={smallPreviewStyle}>
                      {cat.imagen_url ? <img src={cat.imagen_url} alt={`Imagen de ${cat.label}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Sin imagen'}
                    </div>
                    <span style={{ flex: 1, color: theme.text, fontSize: '0.9rem', fontWeight: 600 }}>{cat.label}</span>
                    <button type="button" onClick={() => iniciarEdicion(cat)} aria-label={`Editar ${cat.label}`} style={{ background: 'transparent', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: '8px', color: '#3b82f6', padding: '7px 10px', cursor: 'pointer', fontSize: '0.85rem' }}>Editar</button>
                    <button type="button" onClick={() => handleEliminar(cat.id)} disabled={borrandoId === cat.id} aria-label={`Eliminar ${cat.label}`} style={{ background: 'transparent', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', padding: '7px 10px', cursor: 'pointer', fontSize: '0.85rem', opacity: borrandoId === cat.id ? 0.5 : 1 }}>Eliminar</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
