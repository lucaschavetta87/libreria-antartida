"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../app/supabase';
import { prepararImagenHero, subirArchivoAStorage, medirImagen, recomendacionesImagenHero } from '../lib/imageUtils';
import { useToast } from './ui/Avisos';

interface GestionPortadaProps {
  darkMode: boolean;
  theme: {
    bg: string;
    card: string;
    text: string;
    subtext: string;
    border: string;
    innerBox: string;
  };
  isMobile: boolean;
}

type TipoPortada = 'novedad' | 'oferta' | 'banner';

interface FilaPortada {
  id: number;
  tipo: string;
  orden: number;
  stock_id: number | null;
  imagen_url: string | null;
  precio_oferta: number | null;
  titulo: string | null;
  activo: boolean;
}

interface ProductoPortada {
  id: number;
  nombre: string;
  precio_mayorista: number | null;
  precio_minorista: number | null;
  imagen_url: string | null;
  categoria: string | null;
}

const TIPOS: { id: TipoPortada; label: string; icon: string; descripcion: string }[] = [
  { id: 'novedad', label: 'Últimos ingresos', icon: '✨', descripcion: 'Productos que se muestran en el carrusel "Últimos ingresos" de la portada.' },
  { id: 'oferta', label: 'Ofertas', icon: '🔥', descripcion: 'Productos en oferta. Si cargás un precio de oferta, la web lo muestra tachado junto al mayorista.' },
  { id: 'banner', label: 'Imágenes del hero', icon: '🖼️', descripcion: 'Fondos del carrusel principal de la portada. Si no cargás ninguno, se usan los que ya están en la web.' },
];

const CANTIDAD_POR_PAGINA = 12;

export default function GestionPortada({ darkMode, theme, isMobile }: GestionPortadaProps) {
  const toast = useToast();
  const { confirmar } = toast;
  const [pestanaActiva, setPestanaActiva] = useState<TipoPortada>('novedad');
  const [filas, setFilas] = useState<FilaPortada[]>([]);
  const [stock, setStock] = useState<ProductoPortada[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [paginaBusqueda, setPaginaBusqueda] = useState(1);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);
  const [avisoImagen, setAvisoImagen] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avisar = (texto: string, ok = true) => {
    setMensaje({ texto, ok });
    setTimeout(() => setMensaje(null), 3500);
  };

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [resPortada, resStock] = await Promise.all([
        supabase.from('portada_web').select('*').order('orden', { ascending: true }),
        supabase.from('stock').select('id, nombre, precio_mayorista, precio_minorista, imagen_url, categoria')
      ]);

      if (resPortada.error) {
        console.error('Error portada_web:', resPortada.error);
        avisar('No se pudo leer la tabla portada_web. Ejecutá el SQL de scripts/portada_web.sql', false);
      } else if (resPortada.data) {
        setFilas(resPortada.data as FilaPortada[]);
      }

      if (!resStock.error && resStock.data) {
        setStock(resStock.data as ProductoPortada[]);
      }
    } catch (err) {
      console.error('Error inesperado:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  // --- PRODUCTOS ---
  const stockPorId = useMemo(() => {
    const mapa = new Map<number, ProductoPortada>();
    stock.forEach((p) => mapa.set(p.id, p));
    return mapa;
  }, [stock]);

  const productosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const ordenados = [...stock].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    if (!term) return ordenados;
    return ordenados.filter((p) => p.nombre.toLowerCase().includes(term));
  }, [stock, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / CANTIDAD_POR_PAGINA));
  const itemsPaginaActual = useMemo(() => {
    const inicio = (paginaBusqueda - 1) * CANTIDAD_POR_PAGINA;
    return productosFiltrados.slice(inicio, inicio + CANTIDAD_POR_PAGINA);
  }, [productosFiltrados, paginaBusqueda]);

  useEffect(() => { setPaginaBusqueda(1); }, [busqueda]);

  // --- FILAS DE LA PESTAÑA ACTIVA ---
  const filasActivas = useMemo(
    () => filas.filter((f) => f.tipo === pestanaActiva).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
    [filas, pestanaActiva]
  );

  const stockIdsEnPortada = useMemo(
    () => new Set(filasActivas.map((f) => f.stock_id).filter((v): v is number => v !== null)),
    [filasActivas]
  );

  // ================== PRODUCTOS: AGREGAR / QUITAR ==================
  const agregarSeleccionados = async () => {
    const aAgregar = seleccionados.filter((id) => !stockIdsEnPortada.has(id));
    if (aAgregar.length === 0) {
      avisar('Los productos seleccionados ya están en la lista.', false);
      return;
    }

    const base = filasActivas.length;
    const payloads = aAgregar.map((stockId, i) => ({
      tipo: pestanaActiva,
      orden: base + i,
      stock_id: stockId,
      imagen_url: stockPorId.get(stockId)?.imagen_url || null,
      precio_oferta: null,
      activo: true
    }));

    const { error } = await supabase.from('portada_web').insert(payloads);
    if (error) {
      console.error(error);
      avisar('Error al agregar: ' + error.message, false);
      return;
    }
    setSeleccionados([]);
    avisar(`✅ ${aAgregar.length} producto(s) agregado(s).`);
    await cargarDatos();
  };

  const quitarFila = async (fila: FilaPortada) => {
    const nombre = fila.stock_id ? stockPorId.get(fila.stock_id)?.nombre : 'el ítem';
    if (!(await confirmar({ titulo: 'Quitar de la portada', mensaje: `¿Quitar "${nombre}" de la lista?`, textoOk: 'Quitar', peligro: true }))) return;

    const { error } = await supabase.from('portada_web').delete().eq('id', fila.id);
    if (error) {
      avisar('Error al quitar: ' + error.message, false);
      return;
    }
    // Reordenar para dejar la secuencia sin huecos
    const restantes = filasActivas.filter((f) => f.id !== fila.id);
    await reordenar(restantes);
    await cargarDatos();
  };

  // ================== REORDENAR ==================
  const reordenar = async (lista: FilaPortada[]) => {
    await Promise.all(
      lista.map((f, i) => supabase.from('portada_web').update({ orden: i }).eq('id', f.id))
    );
  };

  const mover = async (indice: number, delta: number) => {
    const nuevaLista = [...filasActivas];
    const destino = indice + delta;
    if (destino < 0 || destino >= nuevaLista.length) return;
    const temp = nuevaLista[indice];
    nuevaLista[indice] = nuevaLista[destino];
    nuevaLista[destino] = temp;
    await reordenar(nuevaLista);
    await cargarDatos();
  };

  // ================== CAMPOS EDITABLES ==================
  const actualizarFila = async (fila: FilaPortada, cambios: Partial<FilaPortada>) => {
    const { error } = await supabase.from('portada_web').update(cambios).eq('id', fila.id);
    if (error) {
      console.error(error);
      avisar('Error al guardar: ' + error.message, false);
      return;
    }
    setFilas((prev) => prev.map((f) => (f.id === fila.id ? { ...f, ...cambios } : f)));
  };

  // ================== BANNERS: SUBIR IMAGEN ==================
  const revisarImagenBanner = async (archivo: File) => {
    const medida = await medirImagen(archivo);
    setAvisoImagen(recomendacionesImagenHero(medida));
  };

  const subirImagenBanner = async (archivoOriginal: File) => {
    setSubiendoImagen(true);
    try {
      // Solo redimensionamos (nunca recortamos) y recomprimimos.
      // Asi la foto conserva su encuadre original y se ve nítida en cualquier pantalla.
      const archivo = await prepararImagenHero(archivoOriginal);
      const pesoKB = Math.round(archivo.size / 1024);
      const msg = archivoOriginal.size > archivo.size
        ? `✅ Imagen optimizada (${Math.round(archivoOriginal.size / 1024)} KB → ${pesoKB} KB)`
        : '✅ Imagen agregada al carrusel del hero.';

      const url = await subirArchivoAStorage(supabase, 'portada-imagenes', archivo);
      if (!url) {
        avisar('No se pudo subir la imagen a Supabase Storage.', false);
        return;
      }

      const { error: errInsert } = await supabase.from('portada_web').insert({
        tipo: 'banner',
        orden: filasActivas.length,
        imagen_url: url,
        titulo: archivoOriginal.name.replace(/\.[^/.]+$/, '').slice(0, 60),
        activo: true
      });
      if (errInsert) throw errInsert;

      avisar(msg);
      await cargarDatos();
    } catch (err: any) {
      console.error(err);
      avisar('Error al subir la imagen: ' + (err.message || 'desconocido'), false);
    } finally {
      setSubiendoImagen(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ================== ESTILOS ==================
  const inputStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: '10px',
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.innerBox,
    color: theme.text,
    outline: 'none',
    fontSize: '15px',
    width: '100%'
  };

  const btnPrimario: React.CSSProperties = {
    backgroundColor: '#3b82f6', color: '#fff', border: 'none',
    padding: '11px 20px', borderRadius: '10px', fontWeight: 'bold',
    fontSize: '0.9rem', cursor: 'pointer'
  };

  const btnSecundario: React.CSSProperties = {
    backgroundColor: theme.innerBox, color: theme.text,
    border: `1px solid ${theme.border}`, padding: '8px 12px',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem'
  };

  const togglePermiso = (id: number) => {
    setSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const pestanaActual = TIPOS.find((t) => t.id === pestanaActiva)!;
  const esProductos = pestanaActiva !== 'banner';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ENCABEZADO */}
      <div>
        <h2 style={{ margin: 0, fontWeight: '900', color: theme.text }}>🖼️ Control de la Portada Web</h2>
        <p style={{ margin: '4px 0 0 0', color: theme.subtext }}>
          Elegí qué productos y qué imágenes se muestran en la portada pública.
        </p>
      </div>

      {/* AVISO */}
      {mensaje && (
        <div style={{
          padding: '13px 18px', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem',
          backgroundColor: mensaje.ok ? (darkMode ? '#064e3b' : '#d1fae5') : (darkMode ? '#7f1d1d' : '#fee2e2'),
          color: mensaje.ok ? (darkMode ? '#6ee7b7' : '#065f46') : (darkMode ? '#fca5a5' : '#991b1b'),
          border: `1px solid ${mensaje.ok ? '#10b981' : '#ef4444'}`
        }}>
          {mensaje.texto}
        </div>
      )}

      {/* PESTAÑAS */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px' }}>
        {TIPOS.map((t) => {
          const activo = pestanaActiva === t.id;
          const cantidad = filas.filter((f) => f.tipo === t.id).length;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { setPestanaActiva(t.id); setSeleccionados([]); setAvisoImagen([]); }}
              style={{
                textAlign: 'left', cursor: 'pointer', padding: '16px',
                borderRadius: '16px',
                border: `2px solid ${activo ? '#3b82f6' : theme.border}`,
                backgroundColor: activo ? (darkMode ? '#1e3a5f' : '#eff6ff') : theme.card,
                boxShadow: activo ? '0 6px 18px -4px rgba(59,130,246,0.35)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ fontSize: '1.4rem' }}>{t.icon}</div>
              <div style={{ fontWeight: '900', color: theme.text, marginTop: '6px' }}>{t.label}</div>
              <div style={{ fontSize: '0.78rem', color: theme.subtext, marginTop: '3px' }}>
                {cantidad} {cantidad === 1 ? 'ítem configurado' : 'ítems configurados'}
              </div>
            </button>
          );
        })}
      </div>

      {/* DESCRIPCIÓN DE LA PESTAÑA */}
      <div style={{
        backgroundColor: theme.innerBox, padding: '14px 18px',
        borderRadius: '12px', border: `1px solid ${theme.border}`,
        fontSize: '0.88rem', color: theme.subtext
      }}>
        <strong style={{ color: theme.text }}>{pestanaActual.icon} {pestanaActual.label}:</strong> {pestanaActual.descripcion}
      </div>

      {/* AVISOS DE CALIDAD DE IMAGEN */}
      {avisoImagen.length > 0 && (
        <div style={{
          padding: '14px 18px', borderRadius: '12px',
          backgroundColor: darkMode ? '#78350f' : '#fffbeb',
          color: darkMode ? '#fcd34d' : '#92400e',
          border: '1px solid #f59e0b', fontSize: '0.86rem', lineHeight: 1.6
        }}>
          <strong>⚠️ Sobre la última imagen:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
            {avisoImagen.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      )}

      {/* ============ MODO BANNERS ============ */}
      {!esProductos && (
        <div style={{ backgroundColor: theme.card, padding: '25px', borderRadius: '20px', border: `1px solid ${theme.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: theme.text, fontWeight: '800' }}>Imágenes del carrusel principal</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={subiendoImagen}
                style={{ ...btnPrimario, opacity: subiendoImagen ? 0.6 : 1 }}
              >
                {subiendoImagen ? '⏳ Subiendo...' : '📤 Subir imagen'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  if (archivo) {
                    revisarImagenBanner(archivo);
                    subirImagenBanner(archivo);
                  }
                }}
              />
            </div>
          </div>

          {filasActivas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: theme.subtext }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🖼️</div>
              <p style={{ margin: 0, fontWeight: '700' }}>No hay imágenes configuradas.</p>
              <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>
                La web sigue funcionando con las imágenes que ya tiene ({' '}
                <code>banner.webp</code>, <code>aromanza.webp</code>, etc.).
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: '18px' }}>
              {filasActivas.map((fila, indice) => (
                <div key={fila.id} style={{
                  border: `1px solid ${theme.border}`, borderRadius: '16px',
                  overflow: 'hidden', backgroundColor: theme.innerBox
                }}>
                  <div style={{ position: 'relative', height: '150px', backgroundColor: '#e5e7eb' }}>
                    {fila.imagen_url && (
                      <img src={fila.imagen_url} alt={fila.titulo || 'banner'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                    <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '5px' }}>
                      <span style={{ backgroundColor: '#000', color: '#fff', fontSize: '0.7rem', fontWeight: '900', padding: '3px 8px', borderRadius: '6px' }}>
                        #{indice + 1}
                      </span>
                      {!fila.activo && (
                        <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '0.7rem', fontWeight: '900', padding: '3px 8px', borderRadius: '6px' }}>
                          OCULTA
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '13px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    <input
                      type="text"
                      value={fila.titulo || ''}
                      placeholder="Título / etiqueta"
                      onChange={(e) => setFilas((prev) => prev.map((f) => f.id === fila.id ? { ...f, titulo: e.target.value } : f))}
                      onBlur={(e) => actualizarFila(fila, { titulo: e.target.value })}
                      style={inputStyle}
                    />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => mover(indice, -1)} style={btnSecundario} title="Subir">▲</button>
                      <button type="button" onClick={() => mover(indice, 1)} style={btnSecundario} title="Bajar">▼</button>
                      <button
                        type="button"
                        onClick={() => actualizarFila(fila, { activo: !fila.activo })}
                        style={{ ...btnSecundario, backgroundColor: fila.activo ? '#fef3c7' : '#d1fae5', borderColor: fila.activo ? '#f59e0b' : '#10b981' }}
                      >
                        {fila.activo ? '👁️ Visible' : '🚫 Oculta'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (await confirmar({ titulo: 'Quitar imagen', mensaje: '¿Eliminar esta imagen del carrusel?', textoOk: 'Quitar', peligro: true })) quitarFila(fila);
                        }}
                        style={{ ...btnSecundario, backgroundColor: 'transparent', borderColor: '#ef4444', color: '#ef4444' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ MODO PRODUCTOS (NUEVOS / OFERTAS) ============ */}
      {esProductos && (
        <>
          {/* LISTA CONFIGURADA */}
          <div style={{ backgroundColor: theme.card, padding: '25px', borderRadius: '20px', border: `1px solid ${theme.border}` }}>
            <h3 style={{ margin: '0 0 6px 0', color: theme.text, fontWeight: '800' }}>
              En la portada ahora ({filasActivas.length})
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: theme.subtext }}>
              El orden es el mismo en que se ven en la web. Usá ▲▼ para reordenar.
            </p>

            {filasActivas.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '25px', color: theme.subtext, margin: 0 }}>
                Todavía no agregaste productos. Buscá abajo y agregá los primeros.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filasActivas.map((fila, indice) => {
                  const prod = fila.stock_id ? stockPorId.get(fila.stock_id) : undefined;
                  return (
                    <div key={fila.id} style={{
                      display: 'flex', alignItems: 'center', gap: '13px',
                      backgroundColor: theme.innerBox, border: `1px solid ${theme.border}`,
                      borderRadius: '12px', padding: '11px'
                    }}>
                      <span style={{ minWidth: '32px', textAlign: 'center', fontWeight: '900', color: theme.subtext, fontSize: '0.9rem' }}>
                        {indice + 1}
                      </span>

                      {prod?.imagen_url ? (
                        <img src={prod.imagen_url} alt="" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '9px', border: `1px solid ${theme.border}`, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '52px', height: '52px', borderRadius: '9px', backgroundColor: theme.card, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📦</div>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '700', color: theme.text, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prod?.nombre || 'Producto eliminado del stock'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: theme.subtext }}>
                          Mayorista: ${Number(prod?.precio_mayorista || 0).toLocaleString('es-AR')}
                        </div>
                      </div>

                      {pestanaActiva === 'oferta' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.72rem', color: theme.subtext, fontWeight: '800' }}>OFERTA</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="—"
                            value={fila.precio_oferta ?? ''}
                            onChange={(e) => setFilas((prev) => prev.map((f) => f.id === fila.id ? { ...f, precio_oferta: e.target.value === '' ? null : Number(e.target.value) } : f))}
                            onBlur={(e) => actualizarFila(fila, { precio_oferta: e.target.value === '' ? null : Number(e.target.value) })}
                            style={{ ...inputStyle, width: '110px' }}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                        <button type="button" onClick={() => mover(indice, -1)} style={btnSecundario} title="Subir">▲</button>
                        <button type="button" onClick={() => mover(indice, 1)} style={btnSecundario} title="Bajar">▼</button>
                        <button type="button" onClick={() => quitarFila(fila)} style={{ ...btnSecundario, backgroundColor: 'transparent', borderColor: '#ef4444', color: '#ef4444' }} title="Quitar">🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* BUSCADOR */}
          <div style={{ backgroundColor: theme.card, padding: '25px', borderRadius: '20px', border: `1px solid ${theme.border}` }}>
            <h3 style={{ margin: '0 0 15px 0', color: theme.text, fontWeight: '800' }}>Buscar productos para agregar</h3>

            <input
              type="text"
              placeholder="🔍 Buscar por nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ ...inputStyle, marginBottom: '15px' }}
            />

            {seleccionados.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px', flexWrap: 'wrap' }}>
                <button type="button" onClick={agregarSeleccionados} style={btnPrimario}>
                  ✅ Agregar {seleccionados.length} a la portada
                </button>
                <button type="button" onClick={() => setSeleccionados([])} style={btnSecundario}>Cancelar</button>
              </div>
            )}

            {cargando ? (
              <p style={{ color: theme.subtext, textAlign: 'center' }}>⏳ Cargando...</p>
            ) : itemsPaginaActual.length === 0 ? (
              <p style={{ color: theme.subtext, textAlign: 'center' }}>No se encontraron productos.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(190px, 1fr))', gap: '12px' }}>
                {itemsPaginaActual.map((prod) => {
                  const yaEsta = stockIdsEnPortada.has(prod.id);
                  const chequeado = seleccionados.includes(prod.id);
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => !yaEsta && togglePermiso(prod.id)}
                      disabled={yaEsta}
                      style={{
                        textAlign: 'left', cursor: yaEsta ? 'not-allowed' : 'pointer',
                        padding: '11px', borderRadius: '13px',
                        border: `2px solid ${yaEsta ? '#10b981' : chequeado ? '#3b82f6' : theme.border}`,
                        backgroundColor: yaEsta ? (darkMode ? '#064e3b' : '#d1fae5') : theme.innerBox,
                        opacity: yaEsta ? 0.65 : 1
                      }}
                    >
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {prod.imagen_url ? (
                          <img src={prod.imagen_url} alt="" style={{ width: '46px', height: '46px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: '46px', height: '46px', borderRadius: '8px', backgroundColor: theme.card, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📦</div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: '700', fontSize: '0.86rem', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {prod.nombre}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: theme.subtext }}>
                            ${Number(prod.precio_mayorista || 0).toLocaleString('es-AR')}
                          </div>
                        </div>
                        {yaEsta && <span style={{ fontSize: '1.05rem' }}>✅</span>}
                        {!yaEsta && <span style={{ fontSize: '1.05rem' }}>{chequeado ? '☑️' : '⬜'}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {totalPaginas > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setPaginaBusqueda((p) => Math.max(1, p - 1))}
                  disabled={paginaBusqueda === 1}
                  style={{ ...btnSecundario, opacity: paginaBusqueda === 1 ? 0.4 : 1 }}
                >← Anterior</button>
                <span style={{ color: theme.subtext, fontSize: '0.85rem', fontWeight: '700' }}>
                  Página {paginaBusqueda} de {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPaginaBusqueda((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaBusqueda === totalPaginas}
                  style={{ ...btnSecundario, opacity: paginaBusqueda === totalPaginas ? 0.4 : 1 }}
                >Siguiente →</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}