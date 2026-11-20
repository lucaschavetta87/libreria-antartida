"use client";

import React, { useRef, useState } from 'react';
import { Icono } from './Icons';

// =============================================================================
// Editar / crear una categoría
// -----------------------------------------------------------------------------
// Permite:
//   • cambiar el nombre
//   • cambiar la imagen
//   • crear una categoría nueva
// =============================================================================

export default function ModalCategoria({
  categoria,           // null = crear una nueva
  darkMode = true,
  subiendo = false,
  onClose,
  onGuardar
}: {
  categoria?: { id: string; label: string; imagen_url?: string | null } | null;
  darkMode?: boolean;
  subiendo?: boolean;
  onClose: () => void;
  onGuardar: (datos: { id?: string; label: string; imagen_url: string | null; archivo?: File | null }) => void;
}) {
  const [nombre, setNombre] = useState(categoria?.label || '');
  const [imagenUrl, setImagenUrl] = useState(categoria?.imagen_url || '');

  const [imagenArchivo, setImagenArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(categoria?.imagen_url || '');
  const archivoRef = useRef<HTMLInputElement>(null);

  const esNueva = !categoria;

  const t = {
    card: darkMode ? '#1e293b' : '#ffffff',
    bg: darkMode ? '#0f172a' : '#f8fafc',
    text: darkMode ? '#f8fafc' : '#0f172a',
    subtext: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    input: darkMode ? '#0b1220' : '#ffffff'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 13px', borderRadius: 10,
    border: `1px solid ${t.border}`, background: t.input, color: t.text,
    outline: 'none', fontSize: '0.95rem'
  };

  const elegirArchivo = (archivo: File) => {
    setImagenArchivo(archivo);
    setPreviewUrl(URL.createObjectURL(archivo));
    setImagenUrl('');
  };

  const guardar = () => {
    if (!nombre.trim()) return;
    onGuardar({
      id: categoria?.id,
      label: nombre.trim(),
      imagen_url: imagenArchivo ? '' : (imagenUrl.trim() || null),
      archivo: imagenArchivo
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: darkMode ? 'rgba(2,6,23,0.75)' : 'rgba(15,23,42,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%', maxWidth: 470, background: t.card,
          border: `1px solid ${t.border}`, borderRadius: 20,
          padding: 22, maxHeight: '90dvh', overflowY: 'auto'
        }}
      >
        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: t.text }}>
              {esNueva ? 'Nueva categoría' : 'Editar categoría'}
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: t.subtext }}>
              {esNueva ? 'Se suma al panel de productos' : `ID: ${categoria?.id}`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 10,
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: t.subtext, cursor: 'pointer', flexShrink: 0
            }}
          >
            <Icono.Cerrar size={17} />
          </button>
        </div>

        {/* Imagen */}
        <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.subtext, marginBottom: 8 }}>
          Imagen
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{
            width: 78, height: 78, borderRadius: 14, overflow: 'hidden', flexShrink: 0,
            background: t.bg, border: `1px solid ${t.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {previewUrl
              ? <img src={previewUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '1.6rem' }}>🖼️</span>}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              ref={archivoRef}
              type="file"
              accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) elegirArchivo(f); }}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => archivoRef.current?.click()}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontWeight: 700, fontSize: '0.85rem'
              }}
            >
              {imagenArchivo ? 'Cambiar archivo' : 'Seleccionar imagen'}
            </button>
            <input
              type="url"
              placeholder="O pegá una URL de imagen..."
              value={imagenUrl}
              onChange={(e) => { setImagenUrl(e.target.value); setImagenArchivo(null); setPreviewUrl(e.target.value); }}
              style={{ ...inputStyle, marginTop: 8, fontSize: '0.85rem' }}
            />
            {(imagenArchivo || imagenUrl || categoria?.imagen_url) && (
              <button
                type="button"
                onClick={() => { setImagenArchivo(null); setImagenUrl(''); setPreviewUrl(''); if (archivoRef.current) archivoRef.current.value = ''; }}
                style={{
                  marginTop: 8, background: 'transparent', border: `1px solid ${t.border}`,
                  borderRadius: 9, padding: '7px 12px', color: t.subtext, cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 600
                }}
              >
                Quitar imagen
              </button>
            )}
          </div>
        </div>

        {/* Nombre */}
        <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.subtext, marginBottom: 8 }}>
          Nombre
        </div>
        <input
          type="text"
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') onClose(); }}
          placeholder="Nombre de la categoría"
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        {/* Acciones */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              padding: '11px 18px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
              border: `1px solid ${t.border}`, background: 'transparent', color: t.text, minHeight: 44
            }}
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={!nombre.trim() || subiendo}
            style={{
              padding: '11px 18px', borderRadius: 10, cursor: nombre.trim() && !subiendo ? 'pointer' : 'not-allowed',
              border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.88rem', minHeight: 44,
              background: 'linear-gradient(180deg,#4f46e5 0%,#4338ca 100%)', opacity: nombre.trim() && !subiendo ? 1 : 0.6
            }}
          >
            {subiendo ? 'Guardando...' : (esNueva ? 'Crear categoría' : 'Guardar cambios')}
          </button>
        </div>
      </div>
    </div>
  );
}